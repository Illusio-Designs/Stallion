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
const { Op } = require('sequelize');
const { geocodeAddress, geocodeDiagnostic } = require('../utils/geocode');
const { validateOnsiteCapture } = require('../utils/geo');
const DistributorZones = require('../models/DistributorZones');
const SalesmanStates = require('../models/SalesmanStates');
const DistributorStates = require('../models/DistributorStates');
const { resolveStateId } = require('../utils/stateResolver');
const { findOrCreateRoleUser } = require('../utils/userFactory');
const { canManageParties, canCreateParty, normalizeRole, partyActiveFilter, denyInactiveParty, isAdmin } = require('../utils/roleHelpers');
const { resolveUserScope } = require('../utils/scopeHelpers');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere, parsePaginationParams, buildPaginatedResponse } = require('../utils/listSearchHelpers');

class PartyController {
    async getPartie(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const party = await Party.findOne({ where: { user_id: id } });
            if (denyInactiveParty(party, req.userRoleName)) {
                return res.status(404).json({ error: 'Party not found' });
            }
            res.status(200).json(party);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /** GET / — party managers/admins get paginated list; party role gets own record */
    async getPartiesRoot(req, res) {
        if (canManageParties(req.userRoleName)) {
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
            if (!canManageParties(req.userRoleName)) {
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
            const where = mergeWhere(partyActiveFilter(req.userRoleName), searchFilter);
            const { count, rows: parties } = await Party.findAndCountAll({
                where,
                limit: pagination.limit,
                offset: pagination.offset,
            });
            res.status(200).json(buildPaginatedResponse(parties, pagination, count));
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
            if (denyInactiveParty(party, req.userRoleName)) {
                return res.status(404).json({ error: 'Party not found' });
            }

            if (!canManageParties(req.userRoleName)) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                const role = normalizeRole(req.userRoleName);
                const allowed = (role === 'party' && scope.partyId === id)
                    || (role === 'salesman' && party.salesman_id === scope.salesmanId)
                    || (role === 'distributor' && party.distributor_id === scope.distributorId);
                if (!allowed) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }

            res.status(200).json(party);
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
            res.status(200).json(buildPaginatedResponse(parties, pagination, count));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getPartiesBySalesmanId(req, res) {
        try {
            const salesman_id = req.params.salesman_id;
            if (!canManageParties(req.userRoleName)) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                if (normalizeRole(req.userRoleName) !== 'salesman' || scope.salesmanId !== salesman_id) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            const parties = await Party.findAll({
                where: mergeWhere({ salesman_id: salesman_id }, partyActiveFilter(req.userRoleName)),
            });
            res.status(200).json(parties);
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
            const parties = await Party.findAll({
                where: mergeWhere({ zone_id: zone_id }, partyActiveFilter(roleName)),
            });

            res.status(200).json(parties);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createParty(req, res) {
        try {
            if (!canCreateParty(req.userRoleName)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const user = req.user;
            const { distributor_id, salesman_id, party_name, trade_name, contact_person, email, phone, address, billing_address, billing_same_as_shipping, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier, latitude, longitude } = req.body;
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

            // Auto-assign distributor & salesman from whoever covers this state.
            // A value explicitly passed in the body always wins (manual override).
            let finalDistributorId = distributor_id || null;
            let finalSalesmanId = salesman_id || null;
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

            // Location for the visit/check-in geofence is ALWAYS derived from the
            // party's ADDRESS (geocoded), never from the creator's device GPS — so a
            // party's pin reflects where the shop actually is, not where whoever
            // registered it happened to be standing. Visit orders / check-ins then
            // only VERIFY the salesman's device against this address anchor.
            let finalLat = null, finalLng = null, locationSource = null;
            const geo = await geocodeAddress(address, { pincode });
            if (geo) { finalLat = geo.latitude; finalLng = geo.longitude; locationSource = 'geocoded'; }

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
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                credit_days,
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
            if (!isAdmin(req.userRoleName)) {
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
    // as the TRUSTED location_source='verified' anchor for the strict 250m geofence.
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

            const { latitude, longitude, accuracy } = req.body || {};

            // Geocode the party's address as the reference to validate against.
            let refLat = null, refLng = null;
            try {
                let city, state;
                if (party.city_id) { const c = await Cities.findByPk(party.city_id); city = c && c.name; }
                if (party.state_id) { const s = await State.findByPk(party.state_id); state = s && s.name; }
                const ref = party.address
                    ? await geocodeAddress(party.address, { city, state, pincode: party.pincode })
                    : null;
                if (ref) { refLat = ref.latitude; refLng = ref.longitude; }
            } catch (_) { /* no reference — capture still allowed, validated on accuracy only */ }

            const check = validateOnsiteCapture({
                deviceLat: latitude, deviceLng: longitude, accuracy, refLat, refLng,
            });
            if (!check.ok) {
                return res.status(422).json({ error: check.reason });
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
                description: `Party location verified on-site (±${Math.round(acc)}m)`,
                tableName: 'parties',
                recordId: party.party_id,
                oldValues: oldSnapshot,
                newValues: party,
            });

            return res.status(200).json({
                message: 'On-site location verified and saved.',
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

    async updateParty(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const user = req.user;
            const party = await Party.findOne({ where: { party_id: id } });
            if (denyInactiveParty(party, req.userRoleName)) {
                return res.status(404).json({ error: 'Party not found' });
            }

            if (!canManageParties(req.userRoleName)) {
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

            if (is_active !== undefined) {
                if (!isAdmin(req.userRoleName)) {
                    return res.status(403).json({ error: 'Only admin can change party status' });
                }
                if (typeof is_active !== 'boolean') {
                    return res.status(400).json({ error: 'is_active must be a boolean' });
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

            const payload = {
                distributor_id: distributor_id !== undefined ? distributor_id : party.distributor_id,
                salesman_id: salesman_id !== undefined ? salesman_id : party.salesman_id,
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
                gstin: gstin !== undefined ? gstin : party.gstin,
                pan: pan !== undefined ? pan : party.pan,
                credit_days: credit_days !== undefined ? credit_days : party.credit_days,
                prefered_courier: prefered_courier !== undefined ? prefered_courier : party.prefered_courier,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            if (is_active !== undefined) {
                payload.is_active = is_active;
            }
            // Re-geocode when the address changes so the geofence anchor stays
            // correct (best-effort; leaves coords as-is on failure).
            if (address !== undefined && address && address !== party.address) {
                const geo = await geocodeAddress(address, { pincode: pincode !== undefined ? pincode : party.pincode });
                if (geo) { payload.latitude = geo.latitude; payload.longitude = geo.longitude; }
            }
            await Party.update(payload, { where: { party_id: id } });

            if (is_active !== undefined) {
                await User.update(
                    { is_active, updated_at: new Date() },
                    { where: { user_id: party.user_id } }
                );
            }

            let description = 'Party updated';
            if (is_active !== undefined && is_active !== party.is_active) {
                description = is_active ? 'Party reactivated' : 'Party deactivated';
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
            res.status(200).json({ message: 'Party updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteParty(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            const snapshot = party.toJSON();
            await party.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Party deleted',
                tableName: 'parties',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Party deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
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

                if (row.country) {
                    const country = await Country.findOne({ where: { name: { [Op.eq]: row.country } } });
                    if (country) { country_id = country.id; }
                    else {
                        return {
                            success: false,
                            message: row.country + ' Country not found',
                            data: null,
                        };
                    }
                }
                if (row.state) {
                    const state = await State.findOne({ where: { name: { [Op.eq]: row.state } } });
                    if (state) state_id = state.id;
                    else {
                        return {
                            success: false,
                            message: row.state + ' State not found',
                            data: null,
                        };
                    }
                }
                if (row.city && state_id) {
                    const city = await Cities.findOne({ where: { name: { [Op.eq]: row.city }, state_id } });
                    if (city) city_id = city.id;
                    else {
                        return {
                            success: false,
                            message: row.city + ' City not found',
                            data: null,
                        };
                    }
                } else if (row.city) {
                    const city = await Cities.findOne({ where: { name: { [Op.eq]: row.city } } });
                    if (city) city_id = city.id;
                    else {
                        return {
                            success: false,
                            message: row.city + ' City not found',
                            data: null,
                        };
                    }
                }
                if (row.zone) {
                    const zoneWhere = { name: { [Op.eq]: row.zone } };
                    if (city_id) zoneWhere.city_id = city_id;
                    if (state_id) zoneWhere.state_id = state_id;
                    const zone = await Zone.findOne({ where: zoneWhere });
                    if (zone) zone_id = zone.id;
                    else {
                        return {
                            success: false,
                            message: row.zone + ' Zone not found',
                            data: null,
                        };
                    }
                }
                if (row.distributor) {
                    const dist = await Distributor.findOne({ where: { distributor_name: { [Op.eq]: row.distributor } } });
                    if (dist) distributor_id = dist.distributor_id;
                    else {
                        return {
                            success: false,
                            message: row.distributor + ' Distributor not found',
                            data: null,
                        };
                    }
                }
                if (row.salesman) {
                    const sm = await Salesman.findOne({ where: { full_name: { [Op.eq]: row.salesman } } });
                    if (sm) salesman_id = sm.salesman_id;
                    else {
                        return {
                            success: false,
                            message: row.salesman + ' Salesman not found',
                            data: null,
                        };
                    }
                }

                const existing = await Party.findOne({
                    where: {
                        [Op.or]: [
                            { party_name: row.party_name },
                            ...(row.email ? [{ email: row.email }] : []),
                        ],
                    },
                });

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
                    gstin: row.gstin ?? null,
                    pan: row.pan ?? null,
                    is_active: row.active !== false,
                    credit_days: row.credit_days ?? 0,
                    prefered_courier: row.prefered_courier ?? null,
                    distributor_id: distributor_id ?? null,
                    salesman_id: salesman_id ?? null,
                    updated_at: new Date(),
                };

                if (existing) {
                    const oldSnapshot = existing.toJSON();
                    await Party.update(payload, { where: { party_id: existing.party_id } });
                    result.updated++;
                    await logAudit({
                        req,
                        actorId: userId,
                        action: 'update',
                        description: 'Party updated via bulk upload',
                        tableName: 'parties',
                        recordId: existing.party_id,
                        oldValues: oldSnapshot,
                        newValues: { ...oldSnapshot, ...payload },
                    });
                } else {
                    if (!row.phone) {
                        return {
                            success: false,
                            message: `Row ${rowNum}: phone is required to create party login`,
                            data: null,
                        };
                    }
                    if (!row.address) {
                        return {
                            success: false,
                            message: `Row ${rowNum}: address is required to create party login`,
                            data: null,
                        };
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
        const message = result.errors.length === 0
            ? `Bulk upload complete. Created: ${result.created}, Updated: ${result.updated}.`
            : `Processed ${total} parties; ${result.errors.length} row(s) failed.`;

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
            const parties = await Party.findAll({
                where: mergeWhere({ state_id: resolved }, partyActiveFilter(req.userRoleName)),
            });
            res.status(200).json(parties);
        } catch (error) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }

    // Diagnostic. Two modes:
    //  - ?q=<address>        → geocode that free text.
    //  - ?party_id=<uuid>    → build the SAME query ensurePartyCoords builds for
    //    that real party (address + resolved city/state + pincode), geocode it,
    //    and (if found) STORE the coordinates on the party. This shows exactly
    //    what data we send for a party and whether it resolves.
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
                let stored = false;
                if (coords) {
                    await party.update({ latitude: coords.latitude, longitude: coords.longitude });
                    stored = true;
                }
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
                    stored,
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
                    await party.update({ latitude: geo.latitude, longitude: geo.longitude });
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