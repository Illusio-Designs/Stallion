const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const { logAudit } = require('../utils/auditLogger');

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

            await logAudit({
                req,
                action: 'create',
                description: 'Salesman check-in created',
                tableName: 'salesman_check_ins',
                recordId: salesmanCheckIn.id,
                oldValues: null,
                newValues: salesmanCheckIn,
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

            const oldSnapshot = existingCheckIn.toJSON();
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

            await logAudit({
                req,
                action: 'update',
                description: 'Salesman check-in updated',
                tableName: 'salesman_check_ins',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...updatedFields },
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

            const snapshot = existingCheckIn.toJSON();
            await existingCheckIn.destroy();

            await logAudit({
                req,
                action: 'delete',
                description: 'Salesman check-in deleted',
                tableName: 'salesman_check_ins',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });

            res.status(200).json({ message: 'Salesman check-in deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanCheckInsController();
