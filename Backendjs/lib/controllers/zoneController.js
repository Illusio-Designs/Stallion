const Zone = require('../models/Zone');
const { logAudit } = require('../utils/auditLogger');
const UserRole = require('../models/UserRole');
const Role = require('../models/Role');
const Party = require('../models/Party');
const Salesman = require('../models/Salesman');
const SalesmanZones = require('../models/SalesmanZones');
const Distributor = require('../models/distributor');
const DistributorZones = require('../models/DistributorZones');
const User = require('../models/User');
const { Op } = require('sequelize');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');
class ZoneController {

    async getZones(req, res) {
        try {
            const { city_id } = req.body;
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['name', 'zone_code'],
                phoneFields: [],
            });
            const where = mergeWhere({ is_active: true, city_id }, searchFilter);
            const zones = await Zone.findAll({ where });
            res.status(200).json(zones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMyZones(req, res) {
        try {
            const user = req.user;
            let zones = [];
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

                zones = await Zone.findAll({ where: { is_active: true, id: party.zone_id } });

            } else if (roleName === 'salesman') {
                // Get zone_preference from Salesman model (stored as text)
                const salesman = await Salesman.findOne({
                    where: { user_id: user.user_id }
                });

                if (!salesman) {
                    return res.status(404).json({ error: 'Salesman record not found for this user' });
                }

                const salesmanZones = await SalesmanZones.findAll({ where: { salesman_id: salesman.salesman_id } });
                zones = await Zone.findAll({ where: { is_active: true, id: salesmanZones.map(zone => zone.zone_id) } });

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
                zones = await Zone.findAll({ where: { is_active: true, id: distributorZones.map(zone => zone.zone_id) } });

            } else {
                return res.status(400).json({ error: `Role '${roleName}' is not supported for this operation` });
            }

            res.status(200).json(zones);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getZoneById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Zone ID is required' });
            }
            const zone = await Zone.findOne({ where: { id } });
            if (!zone) {
                return res.status(404).json({ error: 'Zone not found' });
            }
            res.status(200).json(zone);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createZone(req, res) {
        try {
            const user = req.user;
            const { name, description, city_id, state_id, country_id, zone_code } = req.body;
            const zone = await Zone.create({
                name,
                description,
                city_id,
                state_id,
                country_id,
                zone_code,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Zone created',
                tableName: 'zones',
                recordId: zone.id,
                oldValues: null,
                newValues: zone,
            });
            res.status(201).json(zone);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateZone(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Zone ID is required' });
            }
            const { name, description, city_id, state_id, country_id, zone_code } = req.body;
            const user = req.user;
            const zone = await Zone.findOne({ where: { id } });
            if (!zone) {
                return res.status(404).json({ error: 'Zone not found' });
            }
            const oldSnapshot = zone.toJSON();
            const payload = {
                name,
                description,
                city_id,
                state_id,
                country_id,
                zone_code,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            await Zone.update(payload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Zone updated',
                tableName: 'zones',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Zone updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteZone(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Zone ID is required' });
            }
            const zone = await Zone.findOne({ where: { id } });
            if (!zone) {
                return res.status(404).json({ error: 'Zone not found' });
            }
            const snapshot = zone.toJSON();
            await zone.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Zone deleted',
                tableName: 'zones',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Zone deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

}

module.exports = new ZoneController();