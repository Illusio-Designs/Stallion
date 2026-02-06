const Distributor = require('../models/distributor');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { Op } = require('sequelize');
const Party = require('../models/Party');
class DistributorController {
    async getDistributor(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const distributor = await Distributor.findOne({ where: { user_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            res.status(200).json(distributor);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDistributorParties(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const distributor = await Distributor.findOne({ where: { user_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            const parties = await Party.findAll({ where: { distributor_id: distributor.distributor_id } });
            res.status(200).json(parties);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDistributors(req, res) {
        try {
            const distributors = await Distributor.findAll({ where: { is_active: true } });
            if (!distributors || distributors.length === 0) {
                return res.status(404).json({ error: 'Distributors not found' });
            }
            res.status(200).json(distributors);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createDistributor(req, res) {
        try {
            const user = req.user;
            const { distributor_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, territory, commission_rate } = req.body;

            // Find existing user by email or phone
            const whereConditions = [];
            if (email) whereConditions.push({ email });
            if (phone) whereConditions.push({ phone });

            let distributorUser = null;
            if (whereConditions.length > 0) {
                distributorUser = await User.findOne({
                    where: {
                        [Op.or]: whereConditions
                    }
                });
            }

            // If no user found, return error
            if (!distributorUser) {
                return res.status(404).json({ error: 'User not found with the provided email or phone number' });
            }

            // Create distributor record and link to user
            const distributor = await Distributor.create({
                distributor_name,
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
                territory,
                commission_rate,
                user_id: distributorUser.user_id,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true
            });

            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Distributor created',
                table_name: 'distributors',
                record_id: distributor.distributor_id,
                old_values: null,
                new_values: distributor.toJSON(),
                ip_address: req.ip,
                created_at: new Date()
            });

            res.status(200).json(distributor);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateDistributor(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Distributor ID is required' });
            }
            const { distributor_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zone_id, pincode, gstin, pan, territory, commission_rate, is_active } = req.body;
            const user = req.user;
            const distributor = await Distributor.update({
                distributor_name: distributor_name || distributor.distributor_name,
                trade_name: trade_name || distributor.trade_name,
                contact_person: contact_person || distributor.contact_person,
                email: email || distributor.email,
                phone: phone || distributor.phone,
                address: address || distributor.address,
                country_id: country_id || distributor.country_id,
                state_id: state_id || distributor.state_id,
                city_id: city_id || distributor.city_id,
                zone_id: zone_id || distributor.zone_id,
                pincode: pincode || distributor.pincode,
                gstin: gstin || distributor.gstin,
                pan: pan || distributor.pan,
                territory: territory || distributor.territory,
                commission_rate: commission_rate || distributor.commission_rate,
                is_active: is_active || distributor.is_active,
                updated_at: new Date(),
                updated_by: user.user_id
            }, { where: { distributor_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Distributor updated',
                table_name: 'distributors',
                record_id: id,
                old_values: distributor,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Distributor updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteDistributor(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Distributor ID is required' });
            }
            const distributor = await Distributor.destroy({ where: { distributor_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            const user = req.user;
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Distributor deleted',
                table_name: 'distributors',
                record_id: id,
                old_values: distributor,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Distributor deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new DistributorController();