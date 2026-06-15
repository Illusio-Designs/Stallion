const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const Tray = require('../models/Tray');
const { TrayStatus } = require('../constants/enums');
const SalesmanTray = require('../models/SalesmanTray');
const Party = require('../models/Party');
const SalesmanZones = require('../models/SalesmanZones');
const Zone = require('../models/Zone');
const User = require('../models/User');
const { findOrCreateRoleUser } = require('../utils/userFactory');

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
            res.status(200).json({ ...salesman.toJSON(), zones: salesmanZones });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanParties(req, res) {
        try {
            const id = req.user.user_id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const salesman = await Salesman.findOne({ where: { user_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            const parties = await Party.findAll({ where: { salesman_id: salesman.salesman_id } });
            res.status(200).json(parties);
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
            const salesmen = await Salesman.findAll({ where: { is_active: true } });
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
            const { zones, user_id, employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date } = req.body;
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
                const loginUser = await findOrCreateRoleUser({
                    phone,
                    email,
                    fullName: full_name,
                    roleName: 'salesman',
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
            for (const zone of zones) {
                const existingZone = await Zone.findOne({ where: { id: zone } });
                if (!existingZone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                await SalesmanZones.create({
                    salesman_id: salesman.salesman_id,
                    zone_id: existingZone.id
                });
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
            res.status(200).json({ ...salesman.toJSON(), zones: salesmanZones });
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
            const { zones, employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date, is_active } = req.body;
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
            await SalesmanZones.destroy({ where: { salesman_id: id } });
            for (const zone of zones) {
                const existingZone = await Zone.findOne({ where: { id: zone } });
                if (!existingZone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                await SalesmanZones.create({
                    salesman_id: id,
                    zone_id: existingZone.id
                });
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
}

module.exports = new SalesmanController();