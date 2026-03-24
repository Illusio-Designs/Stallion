const SalesmanTargets = require('../models/SalesmanTargets');
const AuditLog = require('../models/AuditLog');
const { Op } = require('sequelize');

class SalesmanTargetsController {

    async createSalesmanTarget(req, res) {
        try {
            const { start_date, end_date, completed_amount, salesman_id, target_amount, order_type, target_description, target_remarks } = req.body;
            if (!salesman_id || !target_amount || !target_description || !target_remarks || !start_date || !end_date) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            if (startDate > endDate) {
                return res.status(400).json({ error: 'Start date must be before end date' });
            }
            console.log("startDate", startDate);
            console.log("endDate", endDate);
            const salesmanTarget = await SalesmanTargets.create({
                salesman_id,
                start_date: startDate,
                end_date: endDate,
                completed_amount,
                target_amount,
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

    async updateTargetFromOrder(order) {
        try {
            const { salesman_id, order_date } = order;

            const salesmanTargets = await SalesmanTargets.findAll({
                where: {
                    salesman_id: salesman_id,
                    // Use date range logic: update targets whose end_date is
                    // on/after the order_date (not strict equality).
                    end_date: { [Op.gte]: new Date(order_date) }
                }
            });
            if (!salesmanTargets || salesmanTargets.length === 0) {
                return;
            }
            for (const salesmanTarget of salesmanTargets) {
                if (salesmanTarget.completed_amount >= salesmanTarget.target_amount) {
                    continue;
                }
                if (salesmanTarget.order_type === order.order_type) {
                    salesmanTarget.completed_amount += order.order_total;
                }
                if (salesmanTarget.order_type == null) {
                    salesmanTarget.completed_amount += order.order_total;
                }
                await salesmanTarget.save();
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSalesmanTarget(req, res) {
        try {
            const { id } = req.params;
            const { completed_amount, target_amount, start_date, end_date, order_type, target_description, target_remarks } = req.body;
            let startDate = null;
            let endDate = null;
            if (start_date && end_date) {
                startDate = new Date(start_date);
                endDate = new Date(end_date);
                if (startDate > endDate) {
                    return res.status(400).json({ error: 'Start date must be before end date' });
                }
            }
            if (start_date) {
                startDate = new Date(start_date);
            }
            if (end_date) {
                endDate = new Date(end_date);
            }
            if (startDate && endDate && startDate > endDate) {
                return res.status(400).json({ error: 'Start date must be before end date' });
            }
            const salesmanTarget = await SalesmanTargets.update({
                completed_amount,
                target_amount,
                start_date,
                end_date,
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
