const SalesmanTargets = require('../models/SalesmanTargets');
const AuditLog = require('../models/AuditLog');

class SalesmanTargetsController {

    async createSalesmanTarget(req, res) {
        try {
            const { salesman_id, target_amount, target_date, order_type, target_description, target_remarks } = req.body;
            if (!salesman_id || !target_amount || !target_date || !target_description || !target_remarks) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const salesmanTarget = await SalesmanTargets.create({
                salesman_id,
                target_amount,
                target_date,
                order_type,
                target_status: 'pending',
                target_description,
                target_remarks,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'create',
                description: 'Salesman target created',
                table_name: 'salesman_targets',
                record_id: salesmanTarget.id,
            });
            res.status(200).json(salesmanTarget);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanTargets(req, res) {
        try {
            const salesmanTargets = await SalesmanTargets.findAll();
            res.status(200).json(salesmanTargets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanTargetsBySalesmanId(req, res) {
        try {
            const { salesman_id } = req.params;
            if (!salesman_id) {
                return res.status(400).json({ error: 'Salesman ID is required' });
            }
            const salesmanTargets = await SalesmanTargets.findAll({ where: { salesman_id: salesman_id } });
            if (!salesmanTargets || salesmanTargets.length === 0) {
                return res.status(404).json({ error: 'Salesman targets not found' });
            }
            res.status(200).json(salesmanTargets);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSalesmanTarget(req, res) {
        try {
            const { id } = req.params;
            const { target_amount, target_date, order_type, target_description, target_remarks } = req.body;
            const salesmanTarget = await SalesmanTargets.update({
                target_amount,
                target_date,
                order_type,
                target_description,
                target_remarks,
                updated_at: new Date(),
            }, { where: { id: id } });
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'update',
                description: 'Salesman target updated',
                table_name: 'salesman_targets',
                record_id: id,
                old_values: salesmanTarget,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date(),
            });
            const updatedSalesmanTarget = await SalesmanTargets.findOne({ where: { id: id } });
            res.status(200).json(updatedSalesmanTarget);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteSalesmanTarget(req, res) {
        try {
            const { id } = req.params;
            await SalesmanTargets.destroy({ where: { id: id } });
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'delete',
                description: 'Salesman target deleted',
                table_name: 'salesman_targets',
                record_id: id,
            });
            res.status(200).json({ message: 'Salesman target deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanTargetsController();
