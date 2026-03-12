const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const AuditLog = require('../models/AuditLog');

class SalesmanCheckInsController {

    async createSalesmanCheckIn(req, res) {
        try {
            const { salesman_id, check_in_date, party_id, latitude, longitude, check_in_remarks } = req.body;

            if (!salesman_id || !check_in_date || !party_id) {
                return res.status(400).json({ error: 'Salesman ID, check-in date, and party ID are required' });
            }

            const salesmanCheckIn = await SalesmanCheckIns.create({
                salesman_id,
                check_in_date,
                party_id,
                latitude,
                longitude,
                check_in_remarks,
                created_at: new Date(),
                updated_at: new Date(),
            });

            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'create',
                description: 'Salesman check-in created',
                table_name: 'salesman_check_ins',
                record_id: salesmanCheckIn.id,
                old_values: null,
                new_values: salesmanCheckIn,
                ip_address: req.ip,
            });

            res.status(201).json(salesmanCheckIn);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanCheckIns(req, res) {
        try {
            const checkIns = await SalesmanCheckIns.findAll();
            if (!checkIns || checkIns.length === 0) {
                return res.status(404).json({ error: 'Salesman check-ins not found' });
            }
            res.status(200).json(checkIns);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanCheckInsBySalesmanId(req, res) {
        try {
            const { salesman_id } = req.params;

            if (!salesman_id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }

            const checkIns = await SalesmanCheckIns.findAll({ where: { salesman_id } });

            if (!checkIns || checkIns.length === 0) {
                return res.status(404).json({ error: 'Salesman check-ins not found' });
            }

            res.status(200).json(checkIns);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSalesmanCheckIn(req, res) {
        try {
            const { id } = req.params;
            const { salesman_id, check_in_date, party_id, latitude, longitude, check_in_remarks } = req.body;

            if (!id) {
                return res.status(400).json({ error: 'Check-in ID is required' });
            }

            const existingCheckIn = await SalesmanCheckIns.findOne({ where: { id } });
            if (!existingCheckIn) {
                return res.status(404).json({ error: 'Salesman check-in not found' });
            }

            const updatedFields = {
                salesman_id: salesman_id !== undefined ? salesman_id : existingCheckIn.salesman_id,
                check_in_date: check_in_date !== undefined ? check_in_date : existingCheckIn.check_in_date,
                party_id: party_id !== undefined ? party_id : existingCheckIn.party_id,
                latitude: latitude !== undefined ? latitude : existingCheckIn.latitude,
                longitude: longitude !== undefined ? longitude : existingCheckIn.longitude,
                check_in_remarks: check_in_remarks !== undefined ? check_in_remarks : existingCheckIn.check_in_remarks,
                updated_at: new Date(),
            };

            await SalesmanCheckIns.update(updatedFields, { where: { id } });

            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'update',
                description: 'Salesman check-in updated',
                table_name: 'salesman_check_ins',
                record_id: id,
                old_values: existingCheckIn,
                new_values: updatedFields,
                ip_address: req.ip,
            });

            const updatedCheckIn = await SalesmanCheckIns.findOne({ where: { id } });
            res.status(200).json(updatedCheckIn);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteSalesmanCheckIn(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: 'Check-in ID is required' });
            }

            const existingCheckIn = await SalesmanCheckIns.findOne({ where: { id } });
            if (!existingCheckIn) {
                return res.status(404).json({ error: 'Salesman check-in not found' });
            }

            await SalesmanCheckIns.destroy({ where: { id } });

            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'delete',
                description: 'Salesman check-in deleted',
                table_name: 'salesman_check_ins',
                record_id: id,
                old_values: existingCheckIn,
                new_values: null,
                ip_address: req.ip,
            });

            res.status(200).json({ message: 'Salesman check-in deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanCheckInsController();