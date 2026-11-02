const { Op } = require('sequelize');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const Party = require('../models/Party');
const Salesman = require('../models/Salesman');
const Distributor = require('../models/distributor');

// Normalize any phone form to E.164 (+91XXXXXXXXXX) — the exact form OTP login
// matches against users.phone.
function toE164(p) {
    let s = String(p || '').trim().replace(/[\s\-()]/g, '');
    if (!s) return s;
    if (s.startsWith('+')) return s;
    s = s.replace(/^0+/, '');
    if (!s.startsWith('91')) s = `91${s}`;
    return `+${s}`;
}

// Find a party whose phone matches (by last 10 digits, so +91 / 91 / spaces /
// dashes all match). Returns the Party instance or null.
async function findPartyByPhone(phone) {
    const last10 = String(phone || '').replace(/\D/g, '').slice(-10);
    if (last10.length < 10) return null;
    return Party.findOne({ where: { phone: { [Op.like]: `%${last10}` } } });
}


// Salesmen and distributors sign in with the phone saved on their partner record. Their login user
// can be missing, or saved with the number in another form (+91..., 91..., plain 10 digits), and
// then the exact-match lookup says "User not found" although the partner is registered.
// Match by the last 10 digits, and with dryRun only report whether an active partner owns the number.
async function findPartnerLoginUser(phone, { dryRun = false } = {}) {
    const last10 = String(phone || '').replace(/\D/g, '').slice(-10);
    if (last10.length < 10) return null;
    const like = { [Op.like]: `%${last10}` };

    // 1) an active login user that already carries this number in any format
    const direct = await User.findOne({ where: { phone: like, is_active: true } });
    if (direct) return direct;

    // 2) an active salesman or distributor that owns the number
    for (const [Model, roleName] of [[Salesman, 'salesman'], [Distributor, 'distributor']]) {
        const attrs = Model.rawAttributes || {};
        const phoneMatch = [{ phone: like }];
        if (attrs.alternate_phone) phoneMatch.push({ alternate_phone: like });
        const where = { [Op.or]: phoneMatch };
        if (attrs.is_active) where.is_active = true;
        const row = await Model.findOne({ where });
        if (!row) continue;
        if (dryRun) return row;

        const linked = row.user_id ? await User.findByPk(row.user_id) : null;
        let user = linked;
        // The partner record is active (filtered above) and is where admins switch a person on or off: it mirrors
        // the choice onto the login user. A login user left inactive next to an active partner is drift, so bring it back.
        if (linked && !linked.is_active) await linked.update({ is_active: true });
        if (!user) {
            user = await findOrCreateRoleUser({
                phone: toE164(phone),
                email: row.email || null,
                fullName: row.full_name || row.distributor_name || row.name || roleName,
                roleName,
                address: row.address || 'N/A',
            });
            await Model.update({ user_id: user.user_id }, { where: { [Model.primaryKeyAttribute]: row[Model.primaryKeyAttribute] } });
        }
        // the login needs the role link too
        const role = await Role.findOne({ where: { role_name: roleName } });
        if (role) {
            const link = await UserRole.findOne({ where: { user_id: user.user_id, role_id: role.role_id } });
            if (!link) await UserRole.create({ user_id: user.user_id, role_id: role.role_id });
        }
        return user;
    }
    return null;
}

/**
 * Self-healing login resolver. Given a phone:
 *  - returns the existing active user if one matches, else
 *  - if a PARTY matches that phone, creates a party-role login user (if the
 *    party isn't already linked to a real user) and links the party to it,
 *  - returns null if neither a user nor a party matches.
 * Never throws to the caller — a failure just resolves to null so login can
 * fall back to its normal "user not found" handling and never blocks ordering.
 */
async function ensureLoginUserByPhone(phone) {
    try {
        if (!phone) return null;
        const e164 = toE164(phone);

        // 1) already a user? (try the E.164 form and the raw input)
        let user = await User.findOne({ where: { phone: e164, is_active: true } });
        if (!user && e164 !== phone) {
            user = await User.findOne({ where: { phone, is_active: true } });
        }
        if (user) return user;

        // 1b) a salesman or distributor whose login user is missing or saved with the number in another form
        const partner = await findPartnerLoginUser(e164);
        if (partner) return partner;

        // 2) does a party own this phone?
        const party = await findPartyByPhone(e164);
        if (!party) return null;

        // 3) party already linked to a real user? use it.
        if (party.user_id) {
            const linked = await User.findByPk(party.user_id);
            if (linked) return linked;
        }

        // 4) create the party's login user (E.164 phone) and link the party.
        const created = await findOrCreateRoleUser({
            phone: e164,
            email: party.email || null,
            fullName: party.party_name || party.contact_person || 'Party',
            roleName: 'party',
            address: party.address || 'N/A',
        });
        await Party.update({ user_id: created.user_id }, { where: { party_id: party.party_id } });
        return created;
    } catch (err) {
        console.error('ensureLoginUserByPhone failed:', err.message);
        return null;
    }
}

const last10Of = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// Only one create per phone number at a time (per server). A double tap, a slow connection or two
// tabs send the same form twice within a second; without this both pass the "already exists" check
// before either has saved, and the party / salesman is created twice.
const inFlightCreates = new Set();
function acquireCreateLock(kind, phone) {
    const digits = last10Of(phone);
    if (digits.length < 10) return () => {};
    const key = `${kind}:${digits}`;
    if (inFlightCreates.has(key)) {
        throw httpError(409, 'This is already being saved. Please wait a moment and check the list before trying again.');
    }
    inFlightCreates.add(key);
    return () => inFlightCreates.delete(key);
}

// Make sure a user holds a role (adds the link when it is missing) and is active.
async function ensureUserRole(user, role, transaction) {
    if (!user.is_active) {
        await user.update({ is_active: true, updated_at: new Date() }, { transaction });
    }
    const link = await UserRole.findOne({ where: { user_id: user.user_id, role_id: role.role_id }, transaction });
    if (!link) {
        await UserRole.create({ user_id: user.user_id, role_id: role.role_id }, { transaction });
    }
    return user;
}

// Finds or creates the login user for a salesman / distributor / party and gives it the role.
// Runs inside the caller's transaction so partner creation is ATOMIC: if the partner record fails,
// the login user it would have created rolls back too, and if the login user cannot be made or
// linked, this throws and the partner is not created at all.
//
// The user is matched on the phone's last 10 digits (a number saved as +91..., 91... or plain digits is
// the same person), including a switched-off user, which is switched on again. An e-mail match is only
// used when it is the same person; an e-mail that belongs to someone else's login is refused instead
// of silently handing that login to the new partner.
async function findOrCreateRoleUser({ phone, email, fullName, roleName, address }, options = {}) {
    const { transaction } = options;
    if (!phone) {
        throw httpError(400, 'Phone is required to create a login user');
    }
    if (!address) {
        throw httpError(400, 'Address is required to create a login user');
    }

    const role = await Role.findOne({ where: { role_name: roleName }, transaction });
    if (!role) {
        throw httpError(500, `Role '${roleName}' not found`);
    }

    const digits = last10Of(phone);
    let user = await User.findOne({ where: { phone }, transaction });
    if (!user && digits.length === 10) {
        user = await User.findOne({
            where: { phone: { [Op.like]: `%${digits}` } },
            order: [['is_active', 'DESC']],
            transaction,
        });
    }
    if (!user && email) {
        const byEmail = await User.findOne({ where: { email }, transaction });
        if (byEmail) {
            if (byEmail.phone && last10Of(byEmail.phone) !== digits) {
                throw httpError(400, `This email is already used by another login (${byEmail.phone}). Use a different email.`);
            }
            user = byEmail;
        }
    }

    if (user) {
        return ensureUserRole(user, role, transaction);
    }

    user = await User.create({
        phone,
        email: email || null,
        full_name: fullName,
        address,
        role_id: role.role_id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    }, { transaction });

    await UserRole.create({
        user_id: user.user_id,
        role_id: role.role_id,
    }, { transaction });

    return user;
}

module.exports = { findOrCreateRoleUser, ensureUserRole, acquireCreateLock, last10Of, ensureLoginUserByPhone, findPartnerLoginUser, findPartyByPhone, toE164 };
