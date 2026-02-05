const Salesman = require('../models/Salesman');
const AuditLog = require('../models/AuditLog');
const Tray = require('../models/Tray');
const { TrayStatus } = require('../constants/enums');
const SalesmanTray = require('../models/SalesmanTray');

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
            res.status(200).json(salesman);
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
            res.status(200).json(salesmen);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createSalesman(req, res) {
        try {
            const user = req.user;
            const { user_id, employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date } = req.body;
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
            res.status(200).json(salesman);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateSalesman(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const { employee_code, phone, alternate_phone, email, full_name, reporting_manager, address, country_id, state_id, city_id, zone_preference, joining_date, is_active } = req.body;
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