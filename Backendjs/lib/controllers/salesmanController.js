const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const Tray = require('../models/Tray');
const { TrayStatus } = require('../constants/enums');
const SalesmanTray = require('../models/SalesmanTray');
const SalesmanZones = require('../models/SalesmanZones');
const Zone = require('../models/Zone');
const SalesmanStates = require('../models/SalesmanStates');
const State = require('../models/State');
const { resolveStateIds, resolveStateId } = require('../utils/stateResolver');
const User = require('../models/User');
const { findOrCreateRoleUser } = require('../utils/userFactory');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere } = require('../utils/listSearchHelpers');

class SalesmanController {

    async getSalesman(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const salesman = await Salesman.findOne({ where: { user_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            const salesmanZones = await SalesmanZones.findAll({ where: { salesman_id: salesman.salesman_id } });
            const salesmanStates = await SalesmanStates.findAll({ where: { salesman_id: salesman.salesman_id } });
            res.status(200).json({ ...salesman.toJSON(), zones: salesmanZones, states: salesmanStates });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const salesman = await Salesman.findOne({ where: { salesman_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            const salesmanZones = await SalesmanZones.findAll({ where: { salesman_id: id } });
            res.status(200).json({ ...salesman.toJSON(), zones: salesmanZones });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmen(req, res) {
        try {
            const { name, phone } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone,
                nameFields: ['full_name', 'employee_code'],
                phoneFields: ['phone', 'alternate_phone'],
            });
            const where = mergeWhere({ is_active: true }, searchFilter);
            const salesmen = await Salesman.findAll({ where });
            if (!salesmen || salesmen.length === 0) {
                return res.status(404).json({ error: 'Salesmen not found' });
            }
            const response = await Promise.all(salesmen.map(async (salesman) => {
                const salesmanZones = await SalesmanZones.findAll({ where: { salesman_id: salesman.salesman_id } });
                return {
                    ...salesman.toJSON(),
                    zones: salesmanZones.map(zone => zone.toJSON())
                }
            }));
            res.status(200).json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createSalesman(req, res) {
        try {
            const user = req.user;
            const { zones, state_ids, user_id, employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date } = req.body;
            const existingSalesman = await Salesman.findOne({ where: { employee_code: employee_code } });
            if (existingSalesman) {
                return res.status(400).json({ error: 'Salesman with this employee code already exists' });
            }

            let linkedUserId = user_id;
            if (user_id) {
                const existingUser = await User.findOne({ where: { user_id } });
                if (!existingUser) {
                    return res.status(400).json({ error: 'User not found' });
                }
            } else {
                if (!phone) {
                    return res.status(400).json({ error: 'Phone is required to create salesman login' });
                }
                if (!address) {
                    return res.status(400).json({ error: 'Address is required to create salesman login' });
                }
                const loginUser = await findOrCreateRoleUser({
                    phone,
                    email,
                    fullName: full_name,
                    roleName: 'salesman',
                    address,
                });
                linkedUserId = loginUser.user_id;
            }

            const salesman = await Salesman.create({
                employee_code,
                phone,
                alternate_phone,
                email,
                full_name,
                reporting_manager,
                address,
                country_id,
                state_id,
                city_id,
                zone_preference,
                joining_date,
                created_by: user.user_id,
                created_at: new Date(),
                updated_at: new Date(),
                is_active: true,
                user_id: linkedUserId,
            });
            console.log("salesman.salesman_id ", salesman.salesman_id);
            // Zones (optional, kept for backward compatibility)
            for (const zone of (zones || [])) {
                const existingZone = await Zone.findOne({ where: { id: zone } });
                if (!existingZone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                await SalesmanZones.create({
                    salesman_id: salesman.salesman_id,
                    zone_id: existingZone.id
                });
            }
            // Working states (multi-state coverage) — accepts state names or ids
            for (const stId of await resolveStateIds(state_ids)) {
                await SalesmanStates.create({ salesman_id: salesman.salesman_id, state_id: stId });
            }
            const tray = await Tray.create({
                tray_name: full_name + "'s Tray",
                tray_status: TrayStatus.ASSIGNED,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await SalesmanTray.create({
                salesman_id: salesman.salesman_id,
                tray_id: tray.tray_id,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Salesman created',
                tableName: 'salesmen',
                recordId: salesman.salesman_id,
                oldValues: null,
                newValues: salesman,
            });
            const salesmanZones = await SalesmanZones.findAll({ where: { salesman_id: salesman.salesman_id } });
            const salesmanStates = await SalesmanStates.findAll({ where: { salesman_id: salesman.salesman_id } });
            res.status(200).json({ ...salesman.toJSON(), zones: salesmanZones, states: salesmanStates });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }
    async updateSalesman(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const { zones, state_ids, employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date, is_active } = req.body;
            const user = req.user;
            const salesman = await Salesman.findOne({ where: { salesman_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            const oldSnapshot = salesman.toJSON();
            const payload = {
                employee_code,
                phone,
                alternate_phone,
                email,
                full_name,
                reporting_manager,
                address,
                country_id,
                state_id,
                city_id,
                zone_preference,
                joining_date,
                updated_at: new Date(),
                updated_by: user.user_id,
                is_active: is_active,
            };
            await Salesman.update(payload, { where: { salesman_id: id } });
            // Replace zone mappings only when `zones` is provided (kept for back-compat)
            if (Array.isArray(zones)) {
                await SalesmanZones.destroy({ where: { salesman_id: id } });
                for (const zone of zones) {
                    const existingZone = await Zone.findOne({ where: { id: zone } });
                    if (!existingZone) {
                        return res.status(404).json({ error: 'Zone not found' });
                    }
                    await SalesmanZones.create({ salesman_id: id, zone_id: existingZone.id });
                }
            }
            // Replace working states only when `state_ids` is provided
            if (Array.isArray(state_ids)) {
                await SalesmanStates.destroy({ where: { salesman_id: id } });
                for (const stId of await resolveStateIds(state_ids)) {
                    await SalesmanStates.create({ salesman_id: id, state_id: stId });
                }
            }
            await logAudit({
                req,
                action: 'update',
                description: 'Salesman updated',
                tableName: 'salesmen',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Salesman updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteSalesman(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const salesman = await Salesman.findOne({ where: { salesman_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            const snapshot = salesman.toJSON();
            await SalesmanZones.destroy({ where: { salesman_id: id } });
            await SalesmanStates.destroy({ where: { salesman_id: id } });
            await salesman.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Salesman deleted',
                tableName: 'salesmen',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Salesman deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Salesmen whose working states include the given state (name or id).
    async getSalesmenByState(req, res) {
        try {
            const stateId = await resolveStateId(req.params.stateId);
            if (!stateId) {
                return res.status(404).json({ error: 'State not found' });
            }
            const links = await SalesmanStates.findAll({ where: { state_id: stateId } });
            const ids = links.map(l => l.salesman_id);
            const salesmen = ids.length ? await Salesman.findAll({ where: { salesman_id: ids } }) : [];
            res.status(200).json(salesmen);
        } catch (error) {
            res.status(error.statusCode || 500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanController();