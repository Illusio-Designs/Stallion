const { Op } = require('sequelize');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const Party = require('../models/Party');

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

// Optionally runs inside a caller-provided transaction so partner creation
// (salesman/distributor/party) is ATOMIC — if the partner record fails, the
// login user it would have created rolls back too, leaving no orphan.
async function findOrCreateRoleUser({ phone, email, fullName, roleName, address }, options = {}) {
    const { transaction } = options;
    if (!phone) {
        throw new Error('Phone is required to create a login user');
    }
    if (!address) {
        throw new Error('Address is required to create a login user');
    }

    const role = await Role.findOne({ where: { role_name: roleName }, transaction });
    if (!role) {
        throw new Error(`Role '${roleName}' not found`);
    }

    let user = await User.findOne({ where: { phone, is_active: true }, transaction });
    if (!user && email) {
        user = await User.findOne({ where: { email, is_active: true }, transaction });
    }

    if (user) {
        const existingUserRole = await UserRole.findOne({
            where: { user_id: user.user_id, role_id: role.role_id },
            transaction,
        });
        if (!existingUserRole) {
            await UserRole.create({
                user_id: user.user_id,
                role_id: role.role_id,
            }, { transaction });
        }
        return user;
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

module.exports = { findOrCreateRoleUser, ensureLoginUserByPhone, findPartyByPhone, toE164 };
