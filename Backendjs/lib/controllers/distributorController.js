const Distributor = require('../models/distributor');
const { logAudit } = require('../utils/auditLogger');
const User = require('../models/User');
const { Op } = require('sequelize');
const Party = require('../models/Party');
const Zone = require('../models/Zone');
const DistributorZones = require('../models/DistributorZones');
const DistributorStates = require('../models/DistributorStates');
const State = require('../models/State');
const { resolveStateIds, resolveStateId } = require('../utils/stateResolver');
const { findOrCreateRoleUser } = require('../utils/userFactory');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere, parsePaginationParams, buildPaginatedResponse } = require('../utils/listSearchHelpers');

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
            const distributorZones = await DistributorZones.findAll({ where: { distributor_id: distributor.distributor_id } });
            const distributorStates = await DistributorStates.findAll({ where: { distributor_id: distributor.distributor_id } });
            res.status(200).json({ ...distributor.toJSON(), zones: distributorZones, states: distributorStates });
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

    async getDistributorById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Distributor ID is required' });
            }
            const distributor = await Distributor.findOne({ where: { distributor_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            const distributorZones = await DistributorZones.findAll({ where: { distributor_id: id } });
            const distributorStates = await DistributorStates.findAll({ where: { distributor_id: id } });
            res.status(200).json({ ...distributor.toJSON(), zones: distributorZones, states: distributorStates });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getDistributors(req, res) {
        try {
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { country_id } = req.body;
            const { name, phone } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone,
                nameFields: ['distributor_name', 'trade_name', 'contact_person'],
                phoneFields: ['phone'],
            });
            const where = mergeWhere({ is_active: true, country_id }, searchFilter);
            const { count, rows: distributors } = await Distributor.findAndCountAll({
                where,
                limit: pagination.limit,
                offset: pagination.offset,
            });
            const distributorIds = distributors.map(distributor => distributor.distributor_id);
            const distributorZones = distributorIds.length
                ? await DistributorZones.findAll({ where: { distributor_id: distributorIds } })
                : [];
            let distributorStates = [];
            if (distributorIds.length) {
                try {
                    distributorStates = await DistributorStates.findAll({ where: { distributor_id: distributorIds } });
                } catch (e) {
                    console.warn('distributor_states read skipped:', e.message);
                }
            }
            const response = distributors.map(distributor => ({
                ...distributor.toJSON(),
                zones: distributorZones.filter(zone => zone.distributor_id === distributor.distributor_id).map(zone => zone.toJSON()),
                states: distributorStates.filter(s => s.distributor_id === distributor.distributor_id).map(s => s.toJSON()),
            }));
            res.status(200).json(buildPaginatedResponse(response, pagination, count));
        } catch (error) {
            console.log("error", error);
            res.status(500).json({ error: error.message });
        }
    }
    async createDistributor(req, res) {
        try {
            const user = req.user;
            const { distributor_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zones, state_ids, pincode, gstin, pan, territory, commission_rate } = req.body;

            // Find or create login user by email or phone
            const whereConditions = [];
            if (email) whereConditions.push({ email });
            if (phone) whereConditions.push({ phone });

            let distributorUser = null;
            if (whereConditions.length > 0) {
                distributorUser = await User.findOne({
                    where: {
                        [Op.or]: whereConditions,
                    },
                });
            }

            if (!distributorUser) {
                if (!phone) {
                    return res.status(400).json({ error: 'Phone is required to create distributor login' });
                }
                distributorUser = await findOrCreateRoleUser({
                    phone,
                    email,
                    fullName: contact_person || distributor_name,
                    roleName: 'distributor',
                });
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

            for (const zone of (zones || [])) {
                const existingZone = await Zone.findOne({ where: { id: zone } });
                if (!existingZone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                await DistributorZones.create({
                    distributor_id: distributor.distributor_id,
                    zone_id: existingZone.id
                });
            }
            // Working states (multi-state coverage) — accepts state names or ids
            for (const stId of await resolveStateIds(state_ids)) {
                await DistributorStates.create({ distributor_id: distributor.distributor_id, state_id: stId });
            }

            await logAudit({
                req,
                action: 'create',
                description: 'Distributor created',
                tableName: 'distributors',
                recordId: distributor.distributor_id,
                oldValues: null,
                newValues: distributor,
            });
            const distributorZones = await DistributorZones.findAll({ where: { distributor_id: distributor.distributor_id } });
            const distributorStates = await DistributorStates.findAll({ where: { distributor_id: distributor.distributor_id } });
            res.status(200).json({ ...distributor.toJSON(), zones: distributorZones, states: distributorStates });
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
            const { distributor_name, trade_name, contact_person, email, phone, address, country_id, state_id, city_id, zones, state_ids, pincode, gstin, pan, territory, commission_rate, is_active } = req.body;
            const user = req.user;
            const distributor = await Distributor.findOne({ where: { distributor_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            const oldSnapshot = distributor.toJSON();
            const payload = {
                distributor_name: distributor_name || distributor.distributor_name,
                trade_name: trade_name || distributor.trade_name,
                contact_person: contact_person || distributor.contact_person,
                email: email || distributor.email,
                phone: phone || distributor.phone,
                address: address || distributor.address,
                country_id: country_id || distributor.country_id,
                state_id: state_id || distributor.state_id,
                city_id: city_id || distributor.city_id,
                pincode: pincode || distributor.pincode,
                gstin: gstin || distributor.gstin,
                pan: pan || distributor.pan,
                territory: territory || distributor.territory,
                commission_rate: commission_rate || distributor.commission_rate,
                is_active: is_active || distributor.is_active,
                updated_at: new Date(),
                updated_by: user.user_id
            };
            await Distributor.update(payload, { where: { distributor_id: id } });
            if (Array.isArray(zones)) {
                await DistributorZones.destroy({ where: { distributor_id: id } });
                for (const zone of zones) {
                    const existingZone = await Zone.findOne({ where: { id: zone } });
                    if (!existingZone) {
                        return res.status(404).json({ error: 'Zone not found' });
                    }
                    await DistributorZones.create({ distributor_id: id, zone_id: existingZone.id });
                }
            }
            if (Array.isArray(state_ids)) {
                await DistributorStates.destroy({ where: { distributor_id: id } });
                for (const stId of await resolveStateIds(state_ids)) {
                    await DistributorStates.create({ distributor_id: id, state_id: stId });
                }
            }
            await logAudit({
                req,
                action: 'update',
                description: 'Distributor updated',
                tableName: 'distributors',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
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
            const distributor = await Distributor.findOne({ where: { distributor_id: id } });
            if (!distributor) {
                return res.status(404).json({ error: 'Distributor not found' });
            }
            const snapshot = distributor.toJSON();
            await DistributorZones.destroy({ where: { distributor_id: id } });
            await DistributorStates.destroy({ where: { distributor_id: id } });
            await distributor.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Distributor deleted',
                tableName: 'distributors',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Distributor deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Distributors whose working states include the given state (name or id).
    async getDistributorsByState(req, res) {
        try {
            const stateId = await resolveStateId(req.params.stateId);
            if (!stateId) {
                return res.status(404).json({ error: 'State not found' });
            }
            const links = await DistributorStates.findAll({ where: { state_id: stateId } });
            const ids = links.map(l => l.distributor_id);
            const distributors = ids.length ? await Distributor.findAll({ where: { distributor_id: ids } }) : [];
            res.status(200).json(distributors);
        } catch (error) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }
}

module.exports = new DistributorController();