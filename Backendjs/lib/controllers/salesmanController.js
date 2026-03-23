const Salesman = require('../models/Salesman');
const AuditLog = require('../models/AuditLog');
const Tray = require('../models/Tray');
const { TrayStatus } = require('../constants/enums');
const SalesmanTray = require('../models/SalesmanTray');
const Party = require('../models/Party');
const SalesmanZones = require('../models/SalesmanZones');
const Zone = require('../models/Zone');
const User = require('../models/User');

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
            const existingUser = await User.findOne({ where: { user_id: user_id } });
            if (!existingUser) {
                return res.status(400).json({ error: 'User not found' });
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
                user_id: user_id,
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
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Salesman created',
                table_name: 'salesmen',
                record_id: salesman.salesman_id,
                old_values: null,
                new_values: salesman.toJSON(),
                ip_address: req.ip,
                created_at: new Date()
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
            const salesman = await Salesman.update({
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
            }, { where: { salesman_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
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
            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Salesman updated',
                table_name: 'salesmen',
                record_id: id,
                old_values: salesman,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
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
            const user = req.user;
            const salesman = await Salesman.destroy({ where: { salesman_id: id } });
            if (!salesman) {
                return res.status(404).json({ error: 'Salesman not found' });
            }
            await SalesmanZones.destroy({ where: { salesman_id: id } });
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Salesman deleted',
                table_name: 'salesmen',
                record_id: id,
                old_values: salesman,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
            });
            res.status(200).json({ message: 'Salesman deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanController();