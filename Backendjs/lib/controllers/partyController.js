const Party = require('../models/Party');
const AuditLog = require('../models/AuditLog');
const Distributor = require('../models/distributor');
const User = require('../models/User');
const Salesman = require('../models/Salesman');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const { Op } = require('sequelize');
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

                zone_id = distributor.zone_id;

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
            const { user_id, party_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier } = req.body;
            if (!user_id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const party = await Party.create({
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
            const { party_name, trade_name, contact_person, email,
                phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, credit_days, prefered_courier } = req.body;
            const party = await Party.findOne({ where: { party_id: id } });
            if (!party) {
                return res.status(404).json({ error: 'Party not found' });
            }
            await Party.update({
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
}

module.exports = new PartyController();