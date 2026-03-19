const Party = require('../models/Party');
const AuditLog = require('../models/AuditLog');
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
const DistributorZones = require('../models/DistributorZones');
class PartyController {
    async getPartie(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const party = await Party.findOne({ where: { user_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            res.status(200).json(party);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async getParties(req, res) {
        try {
            const parties = await Party.findAll({ where: { is_active: true } });
            if (!parties || parties.length === 0) {
                return res.status(404).json({ error: 'Parties not found' });
            }
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
            const parties = await Party.findAll({ where: { zone_id: zone_id } });

            if (!parties || parties.length === 0) {
                return res.status(404).json({ error: 'No parties found for the assigned zone' });
            }

            res.status(200).json(parties);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createParty(req, res) {
        try {
            const user = req.user;
            const { distributor_id, salesman_id, user_id, party_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier } = req.body;
            if (!user_id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const party = await Party.create({
                distributor_id,
                salesman_id,
                user_id,
                party_name,
                trade_name,
                contact_person,
                email,
                phone,
                address,
                country_id,
                state_id,
                city_id,
                zone_id,
                pincode,
                gstin,
                pan,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                credit_days,
                prefered_courier
            });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Party created',
                table_name: 'parties',
                record_id: party.party_id,
                old_values: null,
                new_values: party,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json(party);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateParty(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Party ID is required' });
            }
            const user = req.user;
            const { distributor_id, salesman_id, party_name, trade_name, contact_person, email,
                phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier } = req.body;
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            await Party.update({
                distributor_id: distributor_id || party.distributor_id,
                salesman_id: salesman_id || party.salesman_id,
                party_name: party_name || party.party_name,
                trade_name: trade_name || party.trade_name,
                contact_person: contact_person || party.contact_person,
                email: email || party.email,
                phone: phone || party.phone,
                address: address || party.address,
                country_id: country_id || party.country_id,
                state_id: state_id || party.state_id,
                city_id: city_id || party.city_id,
                zone_id: zone_id || party.zone_id,
                pincode: pincode || party.pincode,
                gstin: gstin || party.gstin,
                pan: pan || party.pan,
                credit_days: credit_days || party.credit_days,
                prefered_courier: prefered_courier || party.prefered_courier,
                updated_at: new Date(),
                updated_by: user.user_id
            }, { where: { party_id: id } });

            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Party updated',
                table_name: 'parties',
                record_id: id,
                old_values: party,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
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
            const party = await Party.destroy({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            const user = req.user;
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Party deleted',
                table_name: 'parties',
                record_id: id,
                old_values: party,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
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

                const payload = {
                    party_name: row.party_name,
                    trade_name: row.trade_name ?? null,
                    contact_person: row.contact_person ?? null,
                    email: row.email ?? null,
                    phone: row.phone ?? null,
                    address: row.address ?? null,
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
                    await Party.update(payload, { where: { party_id: existing.party_id } });
                    result.updated++;
                    await AuditLog.create({
                        user_id: userId,
                        action: 'update',
                        description: 'Party updated via bulk upload',
                        table_name: 'parties',
                        record_id: existing.party_id,
                        old_values: existing,
                        new_values: payload,
                        ip_address: req && req.ip,
                        created_at: new Date(),
                    });
                } else {
                    await Party.create({
                        ...payload,
                        created_by: userId,
                        user_id: userId,
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
}

module.exports = new PartyController();