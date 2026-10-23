const Party = require('../models/Party');
const { logAudit } = require('../utils/auditLogger');
const Distributor = require('../models/distributor');
const User = require('../models/User');
const Salesman = require('../models/Salesman');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const Country = require('../models/Country');
const State = require('../models/State');
const Cities = require('../models/Cities');
const Zone = require('../models/Zone');
const { Op, fn, col, where } = require('sequelize');

// Case-insensitive exact match on a `name` column (LOWER(name) = lower(value)),
// so "gujarat", "Gujarat" and "GUJARAT" all resolve to the same row and we never
// create case-variant duplicates during bulk upload.
const ciNameEq = (value) => where(fn('LOWER', col('name')), String(value || '').trim().toLowerCase());
const { geocodeAddress, geocodeDiagnostic } = require('../utils/geocode');
const { validateOnsiteCapture } = require('../utils/geo');
const DistributorZones = require('../models/DistributorZones');
const SalesmanStates = require('../models/SalesmanStates');
const DistributorStates = require('../models/DistributorStates');
const { resolveStateId } = require('../utils/stateResolver');
const { findOrCreateRoleUser } = require('../utils/userFactory');
const { hasRole, canManageParties, canCreateParty, normalizeRole, partyActiveFilter, denyInactiveParty, isAdmin } = require('../utils/roleHelpers');
const { resolveUserScope } = require('../utils/scopeHelpers');
const { salesmanCoversState, distributorCoversState } = require('../utils/workingStates');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere, parsePaginationParams, buildPaginatedResponse, listWithOptionalPagination } = require('../utils/listSearchHelpers');

// PAN and GSTIN are tax identifiers: only managers (and the party itself) see them. A salesman or
// distributor still gets the name, phone and address they need for visits and orders.
/** Adds `salesman_name` (from Salesman.full_name via salesman_id) to party rows. One extra query per page. */
const withSalesmanNames = async (rows) => {
    const plain = (rows || []).map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : { ...r }));
    const ids = [...new Set(plain.map((p) => p.salesman_id).filter(Boolean))];
    if (ids.length === 0) return plain;
    const sms = await Salesman.findAll({ where: { salesman_id: { [Op.in]: ids } }, attributes: ['salesman_id', 'full_name'] });
    const names = new Map(sms.map((m) => [m.salesman_id, m.full_name]));
    return plain.map((p) => ({ ...p, salesman_name: names.get(p.salesman_id) || null }));
};

const PARTY_SECRET_FIELDS = ['pan', 'gstin'];
function hidePartySecrets(req, data) {
    if (canManageParties(req.userRoleNames)) return data;
    const strip = (row) => {
        if (!row) return row;
        const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        if (String(plain.user_id || '') === String(req.user && req.user.user_id)) return plain; // the party's own record
        PARTY_SECRET_FIELDS.forEach((f) => { delete plain[f]; });
        return plain;
    };
    if (Array.isArray(data)) return data.map(strip);
    if (data && Array.isArray(data.data)) return { ...data, data: data.data.map(strip) };
    return strip(data);
}

class PartyController {
    async getPartie(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const party = await Party.findOne({ where: { user_id: id } });
            if (denyInactiveParty(party, req.userRoleNames)) {
                return res.status(404).json({ error: 'Party not found' });
            }
            res.status(200).json(party);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /** GET / — party managers/admins get paginated list; party role gets own record */
    async getPartiesRoot(req, res) {
        if (canManageParties(req.userRoleNames)) {
            if (!req.query.page) req.query.page = '1';
            if (!req.query.limit) req.query.limit = '20';
            return this.getParties(req, res);
        }
        if (normalizeRole(req.userRoleName) === 'party') {
            return this.getPartie(req, res);
        }
        return res.status(403).json({ error: 'Access denied' });
    }

    async getParties(req, res) {
        try {
            if (!canManageParties(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { name, phone } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone,
                nameFields: ['party_name', 'trade_name', 'contact_person'],
                phoneFields: ['phone'],
            });
            const where = mergeWhere(partyActiveFilter(req.userRoleNames), searchFilter);
            const { count, rows: parties } = await Party.findAndCountAll({
                where,
                limit: pagination.limit,
                offset: pagination.offset,
            });
            res.status(200).json(buildPaginatedResponse(await withSalesmanNames(parties), pagination, count));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPartyById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const party = await Party.findOne({ where: { party_id: id } });
            if (denyInactiveParty(party, req.userRoleNames)) {
                return res.status(404).json({ error: 'Party not found' });
            }

            if (!canManageParties(req.userRoleNames)) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                const role = normalizeRole(req.userRoleName);
                const allowed = (role === 'party' && scope.partyId === id)
                    || (role === 'salesman' && await salesmanCoversState(scope.salesmanId, party.state_id))
                    || (role === 'distributor' && party.distributor_id === scope.distributorId);
                if (!allowed) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }

            res.status(200).json(hidePartySecrets(req, party));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMyParties(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(400).json({ error: 'User is required' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const userRole = await UserRole.findOne({ where: { user_id: user.user_id } });
            if (!userRole) {
                return res.status(404).json({ error: 'User role not found' });
            }
            const role = await Role.findOne({ where: { role_id: userRole.role_id } });
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            const roleName = role.role_name.toLowerCase();
            let where;

            if (roleName === 'party') {
                where = { user_id: user.user_id };
            } else if (roleName === 'salesman') {
                const salesman = await Salesman.findOne({ where: { user_id: user.user_id } });
                if (!salesman) {
                    return res.status(404).json({ error: 'Salesman not found' });
                }
                const salesmanStates = await SalesmanStates.findAll({ where: { salesman_id: salesman.salesman_id } });
                const stateIds = salesmanStates.map((s) => s.state_id);
                if (salesman.state_id && !stateIds.includes(salesman.state_id)) {
                    stateIds.push(salesman.state_id);
                }
                if (stateIds.length === 0) {
                    return res.status(200).json(buildPaginatedResponse([], pagination, 0));
                }
                where = { state_id: { [Op.in]: stateIds } };
            } else if (roleName === 'distributor') {
                const distributor = await Distributor.findOne({ where: { user_id: user.user_id } });
                if (!distributor) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
                where = { distributor_id: distributor.distributor_id };
            } else {
                return res.status(400).json({ error: `Role '${roleName}' is not supported for this operation` });
            }

            const { name, phone } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone,
                nameFields: ['party_name', 'trade_name', 'contact_person'],
                phoneFields: ['phone'],
            });
            where = mergeWhere(where, searchFilter);
            where = mergeWhere(where, partyActiveFilter(roleName));

            const { count, rows: parties } = await Party.findAndCountAll({
                where,
                limit: pagination.limit,
                offset: pagination.offset,
            });
            res.status(200).json(hidePartySecrets(req, buildPaginatedResponse(await withSalesmanNames(parties), pagination, count)));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPartiesBySalesmanId(req, res) {
        try {
            const salesman_id = req.params.salesman_id;
            if (!canManageParties(req.userRoleNames)) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                if (normalizeRole(req.userRoleName) !== 'salesman' || scope.salesmanId !== salesman_id) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            const body = await listWithOptionalPagination(Party, req, {
                where: mergeWhere({ salesman_id: salesman_id }, partyActiveFilter(req.userRoleNames)),
                order: [['created_at', 'ASC'], ['party_id', 'ASC']],
            });
            res.status(200).json(hidePartySecrets(req, body));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPartiesByZoneId(req, res) {
        try {
            const user = req.user;
            let zone_id = null;

            // Get user's role using manual join
            const userRole = await UserRole.findOne({
                where: { user_id: user.user_id }
            });

            if (!userRole) {
                return res.status(404).json({ error: 'User role not found' });
            }

            // Get the role details manually
            const role = await Role.findOne({
                where: { role_id: userRole.role_id }
            });

            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }

            const roleName = role.role_name.toLowerCase();

            // A party must not see the other parties in its zone.
            if (roleName === 'party') {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Based on role, get zone_id from appropriate model
            if (roleName === 'party') {
                // Get zone_id from Party model
                const party = await Party.findOne({
                    where: {
                        [Op.or]: [
                            { email: user.email },
                            { phone: user.phone }
                        ]
                    }
                });

                if (!party) {
                    return res.status(404).json({ error: 'Party record not found for this user' });
                }

                zone_id = party.zone_id;

            } else if (roleName === 'salesman') {
                // Get zone_preference from Salesman model (stored as text)
                const salesman = await Salesman.findOne({
                    where: { user_id: user.user_id }
                });

                if (!salesman) {
                    return res.status(404).json({ error: 'Salesman record not found for this user' });
                }

                // zone_preference is stored as text containing zone_id
                zone_id = salesman.zone_preference;

            } else if (roleName === 'distributor') {
                // Get zone_id from Distributor model
                let distributor = await Distributor.findOne({
                    where: { user_id: user.user_id }
                });

                // If not found, try to find by email/phone and link
                if (!distributor) {
                    const userDetails = await User.findOne({
                        where: { user_id: user.user_id }
                    });

                    if (!userDetails) {
                        return res.status(404).json({ error: 'User not found' });
                    }

                    const whereConditions = [];
                    if (userDetails.email) whereConditions.push({ email: userDetails.email });
                    if (userDetails.phone) whereConditions.push({ phone: userDetails.phone });

                    if (whereConditions.length > 0) {
                        distributor = await Distributor.findOne({
                            where: { [Op.or]: whereConditions }
                        });
                    }

                    // If distributor found, link it to the user
                    if (distributor) {
                        distributor.user_id = user.user_id;
                        await distributor.save();
                    } else {
                        return res.status(404).json({ error: 'Distributor record not found for this user' });
                    }
                }
                const distributorZones = await DistributorZones.findAll({ where: { distributor_id: distributor.distributor_id } });
                zone_id = distributorZones.map(zone => zone.zone_id);

            } else {
                return res.status(400).json({ error: `Role '${roleName}' is not supported for this operation` });
            }

            // Validate zone_id
            if (!zone_id) {
                return res.status(400).json({ error: `No zone assigned for this ${roleName}` });
            }

            // Find all parties in the zone
            const body = await listWithOptionalPagination(Party, req, {
                where: mergeWhere({ zone_id: zone_id }, partyActiveFilter(roleName)),
                order: [['created_at', 'ASC'], ['party_id', 'ASC']],
            });
            res.status(200).json(hidePartySecrets(req, body));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createParty(req, res) {
        try {
            if (!canCreateParty(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const user = req.user;
            const { distributor_id, salesman_id, party_name, trade_name, contact_person, email, phone, address, billing_address, billing_same_as_shipping, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier, latitude, longitude, accuracy, location_accuracy_m } = req.body;
            // address, city, state and pincode are required so the party can be
            // geocoded accurately for the visit/check-in geofence.
            if (!party_name || !phone || !address) {
                return res.status(400).json({ error: 'Party name, phone, and address are required' });
            }
            if (!city_id) {
                return res.status(400).json({ error: 'City is required' });
            }
            if (!pincode || String(pincode).trim() === '') {
                return res.status(400).json({ error: 'Pincode is required' });
            }
            const billingSameAsShipping = billing_same_as_shipping !== false;
            const billing = billingSameAsShipping ? null : (billing_address || null);
            // State is required — it drives the salesman/distributor assignment.
            // Accepts a state name or id; city & zone are optional.
            if (!state_id) {
                return res.status(400).json({ error: 'State is required' });
            }
            const resolvedStateId = await resolveStateId(state_id);
            if (!resolvedStateId) {
                return res.status(404).json({ error: `State not found: ${state_id}` });
            }

            // A salesman or distributor can only add parties in the states they work in.
            if (!canManageParties(req.userRoleNames)) {
                const creatorScope = await resolveUserScope(req.user.user_id, req.userRoleName);
                if (creatorScope.salesmanId && hasRole(req.userRoleNames, 'salesman')) {
                    if (!(await salesmanCoversState(creatorScope.salesmanId, resolvedStateId))) {
                        return res.status(403).json({ error: 'You can only add parties in the states you work in.' });
                    }
                } else if (creatorScope.distributorId && hasRole(req.userRoleNames, 'distributor')) {
                    if (!(await distributorCoversState(creatorScope.distributorId, resolvedStateId))) {
                        return res.status(403).json({ error: 'You can only add parties in the states you work in.' });
                    }
                }
            }

            // Auto-assign distributor & salesman from whoever covers this state.
            // A value explicitly passed in the body always wins (manual override).
            let finalDistributorId = distributor_id || null;
            let finalSalesmanId = salesman_id || null;
            if (!canManageParties(req.userRoleNames)) {
                // The person who adds the party is its default salesman / distributor.
                const me = await resolveUserScope(req.user.user_id, req.userRoleName);
                if (!finalSalesmanId && me.salesmanId && hasRole(req.userRoleNames, 'salesman')) finalSalesmanId = me.salesmanId;
                if (!finalDistributorId && me.distributorId && hasRole(req.userRoleNames, 'distributor')) finalDistributorId = me.distributorId;
            }
            if (!finalDistributorId) {
                const ds = await DistributorStates.findOne({ where: { state_id: resolvedStateId } });
                if (ds) finalDistributorId = ds.distributor_id;
            }
            if (!finalSalesmanId) {
                const ss = await SalesmanStates.findOne({ where: { state_id: resolvedStateId } });
                if (ss) finalSalesmanId = ss.salesman_id;
            }

            const loginUser = await findOrCreateRoleUser({
                phone,
                email,
                fullName: contact_person || party_name,
                roleName: 'party',
                address,
            });

            // Prefer an on-site GPS capture from "I'm at shop" on create (trusted
            // verified anchor). Otherwise fall back to geocoding the address so the
            // party still has coordinates for the visit/check-in geofence.
            let finalLat = null, finalLng = null, locationSource = null, locationAccuracyM = null;
            const hasDeviceLoc = latitude != null && latitude !== '' && longitude != null && longitude !== '';
            // Geocode once; it is both the validation reference and the fallback.
            const geo = await geocodeAddress(address, { pincode });
            let captured = false;
            if (hasDeviceLoc) {
                const acc = accuracy != null && accuracy !== '' ? accuracy : location_accuracy_m;
                const check = validateOnsiteCapture({
                    deviceLat: latitude, deviceLng: longitude, accuracy: acc,
                    refLat: geo ? geo.latitude : null, refLng: geo ? geo.longitude : null,
                    refPrecision: geo ? geo.precision : null,
                });
                if (check.ok) {
                    finalLat = Number(latitude);
                    finalLng = Number(longitude);
                    locationSource = 'verified';
                    const accNum = Number(acc);
                    locationAccuracyM = Number.isFinite(accNum) ? accNum : null;
                    captured = true;
                } else if (!check.noReference) {
                    return res.status(422).json({ error: check.reason });
                }
                // noReference: the address could not be located well enough to
                // verify the capture, so the party is still created, just without a
                // verified location. Capture it later with "I'm at shop".
            }
            if (!captured && geo) {
                finalLat = geo.latitude;
                finalLng = geo.longitude;
                locationSource = 'geocoded';
            }

            const party = await Party.create({
                distributor_id: finalDistributorId,
                salesman_id: finalSalesmanId,
                user_id: loginUser.user_id,
                party_name,
                trade_name,
                contact_person,
                email,
                phone,
                address,
                billing_address: billing,
                billing_same_as_shipping: billingSameAsShipping,
                country_id,
                state_id: resolvedStateId,
                city_id,
                zone_id,
                pincode,
                gstin,
                pan,
                latitude: finalLat,
                longitude: finalLng,
                location_source: locationSource,
                location_accuracy_m: locationAccuracyM,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                credit_days: canManageParties(req.userRoleNames) ? credit_days : 0,
                prefered_courier
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Party created',
                tableName: 'parties',
                recordId: party.party_id,
                oldValues: null,
                newValues: party,
            });
            res.status(200).json(party);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Admin-only: set a party's location (the visit-geofence anchor).
    //  - Body with valid { latitude, longitude } -> use those exact coordinates
    //    (trusted 'gps').
    //  - Body without coordinates -> derive them from the party's own address /
    //    city / state / pincode (best-effort geocode, 'geocoded').
    async setPartyLocation(req, res) {
        try {
            if (!isAdmin(req.userRoleNames)) {
                return res.status(403).json({ error: 'Only admin can set a party location' });
            }
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }

            const { latitude, longitude } = req.body || {};
            const hasCoords = latitude != null && latitude !== '' && longitude != null && longitude !== '';

            let finalLat, finalLng, source, message;
            if (hasCoords) {
                const lat = Number(latitude);
                const lng = Number(longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
                }
                finalLat = lat; finalLng = lng; source = 'gps';
                message = 'Party location updated';
            } else {
                // Geocode from the address data.
                if (!party.address) {
                    return res.status(400).json({ error: 'Party has no address to geocode' });
                }
                let city, state;
                try {
                    const Cities = require('../models/Cities');
                    const State = require('../models/State');
                    if (party.city_id) { const c = await Cities.findByPk(party.city_id); city = c && c.name; }
                    if (party.state_id) { const s = await State.findByPk(party.state_id); state = s && s.name; }
                } catch (_) { /* geocode with the address alone */ }
                const coords = await geocodeAddress(party.address, { city, state, pincode: party.pincode });
                if (!coords) {
                    return res.status(422).json({ error: 'Could not resolve coordinates from this address.' });
                }
                finalLat = coords.latitude; finalLng = coords.longitude; source = 'geocoded';
                message = 'Party location set from address';
            }

            const oldSnapshot = party.toJSON();
            party.latitude = finalLat;
            party.longitude = finalLng;
            party.location_source = source;
            party.updated_at = new Date();
            await party.save();
            await logAudit({
                req,
                action: 'update',
                description: `Party location set by admin (${source})`,
                tableName: 'parties',
                recordId: party.party_id,
                oldValues: oldSnapshot,
                newValues: party,
            });
            return res.status(200).json({ message, latitude: finalLat, longitude: finalLng, location_source: source });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // On-site capture ("I'm at the shop — capture location"). Salesman/admin sends
    // the device GPS + accuracy while physically at the party. We validate the fix
    // (accuracy + proximity to the party's geocoded address) and, on pass, store it
    // as the TRUSTED location_source='verified' anchor for the strict 50m geofence.
    async verifyPartyLocation(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }

            const adminOverride = isAdmin(req.userRoleNames);

            // Capture works once for everyone. To fix a wrong location, a manager
            // first removes it (DELETE /parties/:id/location), then captures again.
            if (party.location_source === 'verified' && party.latitude != null && party.longitude != null) {
                return res.status(409).json({
                    error: 'This party already has a verified location. Ask a manager to remove it first if it is wrong.',
                });
            }

            const { latitude, longitude, accuracy } = req.body || {};

            let check;
            if (adminOverride) {
                // Admin sets the party's location to the device's current GPS
                // without requiring on-site proximity to the address.
                const lat = Number(latitude), lng = Number(longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                    return res.status(400).json({
                        error: 'A valid current location is required. Please enable GPS and try again.',
                    });
                }
                check = { ok: true, distance: null };
            } else {
                // Geocode the party's address as the reference to validate against.
                let refLat = null, refLng = null, refPrecision = null;
                try {
                    let city, state;
                    if (party.city_id) { const c = await Cities.findByPk(party.city_id); city = c && c.name; }
                    if (party.state_id) { const s = await State.findByPk(party.state_id); state = s && s.name; }
                    const ref = party.address
                        ? await geocodeAddress(party.address, { city, state, pincode: party.pincode })
                        : null;
                    if (ref) { refLat = ref.latitude; refLng = ref.longitude; refPrecision = ref.precision; }
                } catch (_) { /* no reference: validateOnsiteCapture rejects with a clear message */ }

                check = validateOnsiteCapture({
                    deviceLat: latitude, deviceLng: longitude, accuracy, refLat, refLng, refPrecision,
                });
                if (!check.ok) {
                    return res.status(422).json({ error: check.reason });
                }
            }

            const acc = Number(accuracy);
            const oldSnapshot = party.toJSON();
            party.latitude = Number(latitude);
            party.longitude = Number(longitude);
            party.location_source = 'verified';
            party.location_accuracy_m = Number.isFinite(acc) ? acc : null;
            party.updated_at = new Date();
            await party.save();

            await logAudit({
                req,
                action: 'update',
                description: adminOverride
                    ? `Party location set by admin (±${Number.isFinite(acc) ? Math.round(acc) : '?'}m)`
                    : `Party location verified on-site (±${Math.round(acc)}m)`,
                tableName: 'parties',
                recordId: party.party_id,
                oldValues: oldSnapshot,
                newValues: party,
            });

            return res.status(200).json({
                message: adminOverride
                    ? 'Party location set from your current position.'
                    : 'On-site location verified and saved.',
                latitude: party.latitude,
                longitude: party.longitude,
                location_source: 'verified',
                accuracy: party.location_accuracy_m,
                distance_from_address_m: check.distance,
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // Remove a party's saved location (used when the on-site capture was wrong).
    // Clears the coordinates so "I'm at shop" is available again. Route is limited
    // to admin / party manager / sales manager; every removal is audit-logged with
    // the old coordinates.
    async removePartyLocation(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            if (party.latitude == null && party.longitude == null && !party.location_source) {
                return res.status(409).json({ error: 'This party has no saved location to remove.' });
            }

            const oldSnapshot = party.toJSON();
            party.latitude = null;
            party.longitude = null;
            party.location_source = null;
            party.location_accuracy_m = null;
            party.updated_at = new Date();
            await party.save();

            await logAudit({
                req,
                action: 'update',
                description: 'Party location removed',
                tableName: 'parties',
                recordId: party.party_id,
                oldValues: oldSnapshot,
                newValues: party,
            });

            return res.status(200).json({
                message: 'Location removed. Use "I\'m at shop" to set it again.',
                latitude: null,
                longitude: null,
                location_source: null,
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async updateParty(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const user = req.user;
            const party = await Party.findOne({ where: { party_id: id } });
            if (denyInactiveParty(party, req.userRoleNames)) {
                return res.status(404).json({ error: 'Party not found' });
            }

            if (!canManageParties(req.userRoleNames)) {
                const scope = await resolveUserScope(user.user_id, req.userRoleName);
                const role = normalizeRole(req.userRoleName);
                const allowed = (role === 'party' && scope.partyId === id)
                    || (role === 'salesman' && party.salesman_id === scope.salesmanId);
                if (!allowed) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }

            const { distributor_id, salesman_id, party_name, trade_name, contact_person, email,
                phone, address, billing_address, billing_same_as_shipping, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier, is_active } = req.body;

            // Login status (active/inactive) and the commercial terms (credit days,
            // GSTIN, PAN) are managed by admin / party / sales managers only. A party,
            // salesman or distributor often still sends the current values from the
            // edit form — ignore them instead of 403'ing the whole update.
            const isManager = canManageParties(req.userRoleNames);
            let nextIsActive;
            if (is_active !== undefined) {
                if (isManager) {
                    if (typeof is_active !== 'boolean') {
                        return res.status(400).json({ error: 'is_active must be a boolean' });
                    }
                    nextIsActive = is_active;
                }
            }

            const oldSnapshot = party.toJSON();

            let billingSameAsShipping = party.billing_same_as_shipping;
            if (billing_same_as_shipping !== undefined) {
                billingSameAsShipping = billing_same_as_shipping !== false;
            }
            let billing = party.billing_address;
            if (billingSameAsShipping) {
                billing = null;
            } else if (billing_address !== undefined) {
                billing = billing_address || null;
            }

            // Who owns the party is a manager decision. A salesman can edit their
            // party's details (including its address) but cannot reassign it.
            const canReassign = canManageParties(req.userRoleNames);
            const payload = {
                distributor_id: distributor_id !== undefined && canReassign ? distributor_id : party.distributor_id,
                salesman_id: salesman_id !== undefined && canReassign ? salesman_id : party.salesman_id,
                party_name: party_name !== undefined ? party_name : party.party_name,
                trade_name: trade_name !== undefined ? trade_name : party.trade_name,
                contact_person: contact_person !== undefined ? contact_person : party.contact_person,
                email: email !== undefined ? email : party.email,
                phone: phone !== undefined ? phone : party.phone,
                address: address !== undefined ? address : party.address,
                billing_address: billing,
                billing_same_as_shipping: billingSameAsShipping,
                country_id: country_id !== undefined ? country_id : party.country_id,
                state_id: state_id !== undefined ? state_id : party.state_id,
                city_id: city_id !== undefined ? city_id : party.city_id,
                zone_id: zone_id !== undefined ? zone_id : party.zone_id,
                pincode: pincode !== undefined ? pincode : party.pincode,
                gstin: gstin !== undefined && isManager ? gstin : party.gstin,
                pan: pan !== undefined && isManager ? pan : party.pan,
                credit_days: credit_days !== undefined && isManager ? credit_days : party.credit_days,
                prefered_courier: prefered_courier !== undefined ? prefered_courier : party.prefered_courier,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            if (nextIsActive !== undefined) {
                payload.is_active = nextIsActive;
            }
            // Re-derive the location when the address OR the pincode really changes
            // (a spacing/case-only edit does not count). If the party had a
            // verified on-site location, the shop may have moved, so that point is
            // no longer trusted: it is replaced by the new address's geocode (or
            // cleared if the address can't be located), and "I'm at shop" is
            // available again to capture the new spot.
            const normText = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const normPin = (v) => String(v || '').replace(/\D/g, '');
            const addressChanged = address !== undefined && !!address && normText(address) !== normText(party.address);
            const pincodeChanged = pincode !== undefined && normPin(pincode) !== normPin(party.pincode);
            let locationReset = false;
            if (addressChanged || pincodeChanged) {
                const wasVerified = party.location_source === 'verified';
                const geo = await geocodeAddress(
                    address !== undefined ? address : party.address,
                    { pincode: pincode !== undefined ? pincode : party.pincode }
                );
                if (geo) {
                    payload.latitude = geo.latitude;
                    payload.longitude = geo.longitude;
                    payload.location_source = 'geocoded';
                    payload.location_accuracy_m = null;
                } else if (wasVerified) {
                    // Never keep a verified point that belonged to the old address.
                    payload.latitude = null;
                    payload.longitude = null;
                    payload.location_source = null;
                    payload.location_accuracy_m = null;
                }
                locationReset = wasVerified;
            }
            await Party.update(payload, { where: { party_id: id } });

            if (nextIsActive !== undefined) {
                await User.update(
                    { is_active: nextIsActive, updated_at: new Date() },
                    { where: { user_id: party.user_id } }
                );
            }

            let description = 'Party updated';
            if (nextIsActive !== undefined && nextIsActive !== party.is_active) {
                description = nextIsActive ? 'Party reactivated' : 'Party deactivated';
            }
            if (locationReset) {
                description += ' (address changed, verified location reset)';
            }

            await logAudit({
                req,
                action: 'update',
                description,
                tableName: 'parties',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({
                message: 'Party updated successfully',
                location_reset: locationReset,
                latitude: payload.latitude !== undefined ? payload.latitude : party.latitude,
                longitude: payload.longitude !== undefined ? payload.longitude : party.longitude,
                location_source: payload.location_source !== undefined ? payload.location_source : party.location_source,
                location_accuracy_m: payload.location_accuracy_m !== undefined ? payload.location_accuracy_m : party.location_accuracy_m,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // A party is never deleted: its orders, check-ins and login all refer to it.
    // Make the party inactive instead (edit the party and switch it off).
    async deleteParty(req, res) {
        return res.status(409).json({ error: 'A party cannot be deleted because its records are kept. Make the party inactive instead.' });
    }

    /**
     * Bulk create/update parties from parsed Excel/CSV rows.
     * Each row has names for country, state, city, zone, distributor, salesman; resolve to IDs here.
     */
    async bulkUploadParty(parties, user, req, res) {
        const result = { created: 0, updated: 0, errors: [] };
        const userId = user && user.user_id ? user.user_id : null;

        if (!userId) {
            return { success: false, message: 'User not authenticated', data: result };
        }

        for (let i = 0; i < parties.length; i++) {
            const row = parties[i];
            const rowNum = i + 2; // 1-based + header row
            try {
                let country_id = null;
                let state_id = null;
                let city_id = null;
                let zone_id = null;
                let distributor_id = null;
                let salesman_id = null;

                // Trim geography names — Excel cells often carry trailing spaces,
                // which made exact-match lookups fail ("State/City not found") even
                // though the value looked correct.
                const countryName = row.country != null ? String(row.country).trim() : '';
                const stateName = row.state != null ? String(row.state).trim() : '';
                const cityName = row.city != null ? String(row.city).trim() : '';

                if (countryName) {
                    const country = await Country.findOne({ where: ciNameEq(countryName) });
                    if (country) { country_id = country.id; }
                    else {
                        throw new Error(countryName + ' Country not found');
                    }
                }
                if (stateName) {
                    // Case-insensitive lookup; auto-create the state (mapped to its
                    // country) when it doesn't exist yet, so bulk upload doesn't fail
                    // on new states.
                    let state = await State.findOne({
                        where: { [Op.and]: [ciNameEq(stateName), ...(country_id ? [{ country_id }] : [])] },
                    });
                    if (!state && country_id) {
                        state = await State.create({ name: stateName, country_id, is_active: true });
                    }
                    if (state) state_id = state.id;
                    else {
                        throw new Error(`Cannot create state "${stateName}" without a Country. Add a Country value for this row.`);
                    }
                }
                if (cityName && state_id) {
                    // Case-insensitive lookup; auto-create the city (mapped to its
                    // state) when it doesn't exist yet.
                    let city = await Cities.findOne({ where: { [Op.and]: [ciNameEq(cityName), { state_id }] } });
                    if (!city) {
                        city = await Cities.create({ name: cityName, state_id, is_active: true });
                    }
                    city_id = city.id;
                } else if (cityName) {
                    // A city needs a state to be attached to. Use an existing city by
                    // name if there is one; otherwise we can't create it without a state.
                    const city = await Cities.findOne({ where: ciNameEq(cityName) });
                    if (city) city_id = city.id;
                    else {
                        throw new Error(`Cannot create city "${cityName}" without a State. Add a State value for this row.`);
                    }
                }
                const zoneName = row.zone != null ? String(row.zone).trim() : '';
                if (zoneName) {
                    const zoneAnd = [ciNameEq(zoneName)];
                    if (city_id) zoneAnd.push({ city_id });
                    if (state_id) zoneAnd.push({ state_id });
                    const zone = await Zone.findOne({ where: { [Op.and]: zoneAnd } });
                    if (zone) zone_id = zone.id;
                    else {
                        throw new Error(zoneName + ' Zone not found');
                    }
                }
                if (row.distributor) {
                    const dist = await Distributor.findOne({ where: { distributor_name: { [Op.eq]: row.distributor } } });
                    if (dist) distributor_id = dist.distributor_id;
                    else {
                        throw new Error(row.distributor + ' Distributor not found');
                    }
                }
                if (row.salesman) {
                    const sm = await Salesman.findOne({ where: { full_name: { [Op.eq]: row.salesman } } });
                    if (sm) salesman_id = sm.salesman_id;
                    else {
                        throw new Error(row.salesman + ' Salesman not found');
                    }
                }

                // A row is the same party when its GST number matches. With no GST
                // number it is matched by PAN, and with no PAN by phone and email
                // together (both must be present). Otherwise there is no match and the row creates a party. The name is never used, so two shops with one name stay apart.
                const clean = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
                const gstin = clean(row.gstin) ? clean(row.gstin).toUpperCase() : null;
                const pan = clean(row.pan) ? clean(row.pan).toUpperCase() : null;
                const phone = clean(row.phone);
                const email = clean(row.email);
                let matchWhere = null;
                if (gstin) matchWhere = { gstin };
                else if (pan) matchWhere = { pan };
                else if (phone && email) matchWhere = { phone, email };
                const existing = matchWhere ? await Party.findOne({ where: matchWhere }) : null;

                const billingSameAsShipping = row.billing_same_as_shipping !== false;
                const billing = billingSameAsShipping ? null : (row.billing_address ?? null);

                const payload = {
                    party_name: row.party_name,
                    trade_name: row.trade_name ?? null,
                    contact_person: row.contact_person ?? null,
                    email: row.email ?? null,
                    phone: row.phone ?? null,
                    address: row.address ?? null,
                    billing_address: billing,
                    billing_same_as_shipping: billingSameAsShipping,
                    country_id: country_id ?? null,
                    state_id: state_id ?? null,
                    city_id: city_id ?? null,
                    zone_id: zone_id ?? null,
                    pincode: row.pincode ?? null,
                    gstin,
                    pan,
                    is_active: row.active !== false,
                    credit_days: row.credit_days ?? 0,
                    prefered_courier: row.prefered_courier ?? null,
                    distributor_id: distributor_id ?? null,
                    salesman_id: salesman_id ?? null,
                    updated_at: new Date(),
                };

                // On an update only the filled cells are written. A blank cell keeps
                // the value already saved; it never erases it.
                const updatePayload = { updated_at: new Date() };
                const filled = {
                    party_name: row.party_name, trade_name: row.trade_name, contact_person: row.contact_person,
                    email: row.email, phone: row.phone, address: row.address,
                    country_id, state_id, city_id, zone_id, pincode: row.pincode,
                    gstin, pan, credit_days: row.credit_days, prefered_courier: row.prefered_courier,
                    distributor_id, salesman_id,
                };
                for (const [k, v] of Object.entries(filled)) {
                    if (v !== null && v !== undefined && v !== '') updatePayload[k] = v;
                }
                if (row.active !== null && row.active !== undefined) updatePayload.is_active = row.active;
                if (row.billing_same_as_shipping !== null && row.billing_same_as_shipping !== undefined) {
                    updatePayload.billing_same_as_shipping = row.billing_same_as_shipping;
                    updatePayload.billing_address = row.billing_same_as_shipping ? null : (row.billing_address ?? existing?.billing_address ?? null);
                } else if (row.billing_address) {
                    updatePayload.billing_address = row.billing_address;
                }

                if (existing) {
                    const oldSnapshot = existing.toJSON();
                    await Party.update(updatePayload, { where: { party_id: existing.party_id } });
                    result.updated++;
                    await logAudit({
                        req,
                        actorId: userId,
                        action: 'update',
                        description: 'Party updated via bulk upload',
                        tableName: 'parties',
                        recordId: existing.party_id,
                        oldValues: oldSnapshot,
                        newValues: { ...oldSnapshot, ...updatePayload },
                    });
                } else {
                    if (!row.phone) {
                        throw new Error(`phone is required to create party login`);
                    }
                    if (!row.address) {
                        throw new Error(`address is required to create party login`);
                    }
                    const loginUser = await findOrCreateRoleUser({
                        phone: row.phone,
                        email: row.email,
                        fullName: row.contact_person || row.party_name,
                        roleName: 'party',
                        address: row.address,
                    });
                    await Party.create({
                        ...payload,
                        user_id: loginUser.user_id,
                        created_by: userId,
                        created_at: new Date(),
                    });
                    result.created++;
                }
            } catch (err) {
                result.errors.push({ row: rowNum, party_name: row.party_name, error: err.message });
            }
        }

        const total = result.created + result.updated;
        const skipped = result.errors.length;
        const reasons = result.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.error}`).join('; ');
        const message = skipped === 0
            ? `Bulk upload complete. Created: ${result.created}, Updated: ${result.updated}.`
            : `Saved ${total} (Created: ${result.created}, Updated: ${result.updated}). Skipped ${skipped} row(s). ${reasons}${skipped > 3 ? ' ...' : ''}`;

        return {
            success: result.errors.length < parties.length,
            message,
            data: result,
        };
    }

    // Parties in a given state (state passed as name or id).
    async getPartiesByStateId(req, res) {
        try {
            const { state_id } = req.body;
            if (!state_id) {
                return res.status(400).json({ error: 'state_id is required' });
            }
            const resolved = await resolveStateId(state_id);
            if (!resolved) {
                return res.status(404).json({ error: `State not found: ${state_id}` });
            }
            // Managers see every state. A salesman or distributor only sees the states they
            // work in. Everyone else (a party, for example) gets nothing.
            if (!canManageParties(req.userRoleNames)) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                let allowed = false;
                if (hasRole(req.userRoleNames, 'salesman') && scope.salesmanId) {
                    allowed = await salesmanCoversState(scope.salesmanId, resolved);
                }
                if (!allowed && hasRole(req.userRoleNames, 'distributor') && scope.distributorId) {
                    allowed = await distributorCoversState(scope.distributorId, resolved);
                }
                if (!allowed) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            const body = await listWithOptionalPagination(Party, req, {
                where: mergeWhere({ state_id: resolved }, partyActiveFilter(req.userRoleNames)),
                order: [['created_at', 'ASC'], ['party_id', 'ASC']],
            });
            res.status(200).json(hidePartySecrets(req, body));
        } catch (error) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }

    // Diagnostic. Two modes:
    //  - ?q=<address>        → geocode that free text.
    //  - ?party_id=<uuid>    → build the SAME query ensurePartyCoords builds for
    //    that real party (address + resolved city/state + pincode), geocode it,
    //    and report the result. This shows exactly what data we send for a party
    //    and whether it resolves. READ-ONLY: it never saves coordinates, so it
    //    cannot disturb a party's verified location.
    async geocodeTest(req, res) {
        try {
            const partyId = req.query && req.query.party_id;
            if (partyId) {
                const party = await Party.findOne({ where: { party_id: partyId } });
                if (!party) return res.status(404).json({ error: 'Party not found' });
                let city = null, state = null;
                if (party.city_id) { const c = await Cities.findByPk(party.city_id); city = c && c.name; }
                if (party.state_id) { const s = await State.findByPk(party.state_id); state = s && s.name; }
                // Full address + fallback (city/state) — the same path ensurePartyCoords uses.
                const coords = await geocodeAddress(party.address, { city, state, pincode: party.pincode });
                // If it couldn't resolve, include the raw failure detail for the full query.
                const detail = coords ? null : await geocodeDiagnostic(party.address, { city, state, pincode: party.pincode });
                return res.status(200).json({
                    party_id: partyId,
                    address: party.address,
                    resolved_city: city,
                    resolved_state: state,
                    pincode: party.pincode || null,
                    ok: !!coords,
                    coords: coords || null,
                    stored: false,
                    detail,
                });
            }
            const q = (req.query && req.query.q) || 'Seawoods Grand Central Mall, Navi Mumbai, Maharashtra';
            const result = await geocodeDiagnostic(q);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Proactively geocode every party that has an address but no coordinates yet
    // (the geofence anchor). Processes sequentially with a small delay to respect
    // the geocoder's rate limit. Also happens lazily on the first visit/check-in,
    // so this is just for filling them all up front.
    async backfillPartyCoords(req, res) {
        try {
            const limit = Math.min(Number(req.body?.limit) || 200, 500);
            const parties = await Party.findAll({
                where: {
                    latitude: { [Op.is]: null },
                    address: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
                },
                limit,
            });
            let updated = 0;
            const failed = [];
            for (const party of parties) {
                const geo = await geocodeAddress(party.address, { pincode: party.pincode });
                if (geo) {
                    // Only parties with no coordinates are selected, so a verified
                    // location is never touched. Mark the source as geocoded.
                    await party.update({ latitude: geo.latitude, longitude: geo.longitude, location_source: 'geocoded' });
                    updated += 1;
                } else {
                    failed.push(party.party_id);
                }
                // Be polite to the geocoder (Nominatim ~1 req/sec).
                await new Promise((r) => setTimeout(r, 1100));
            }
            res.status(200).json({
                message: `Backfilled coordinates for ${updated} of ${parties.length} parties`,
                scanned: parties.length,
                updated,
                unresolved: failed.length,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new PartyController();