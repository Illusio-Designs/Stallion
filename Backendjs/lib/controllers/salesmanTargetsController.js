const SalesmanTargets = require('../models/SalesmanTargets');
const Order = require('../models/Order');
const { logAudit } = require('../utils/auditLogger');
const { Op } = require('sequelize');
const { parsePaginationParams, buildPaginatedResponse } = require('../utils/listSearchHelpers');

// Compute a target's achieved amount LIVE from the orders, so existing and new
// orders always count (the report never depends on the stored running total).
const computeCompleted = async (target) => {
    const where = {
        salesman_id: target.salesman_id,
        order_date: { [Op.between]: [target.start_date, target.end_date] },
    };
    if (target.order_type) where.order_type = target.order_type; // null = "overall" = any type
    const orders = await Order.findAll({ where, attributes: ['order_total'] });
    return orders.reduce((sum, o) => sum + (Number(o.order_total) || 0), 0);
};

const enrichTarget = async (t) => {
    const completed = await computeCompleted(t);
    const targetAmount = Number(t.target_amount) || 0;
    const target_status = (targetAmount > 0 && completed >= targetAmount) ? 'completed' : (t.target_status || 'pending');
    return { ...t.toJSON(), completed_amount: completed, target_status };
};

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
            await logAudit({
                req,
                action: 'create',
                description: 'Salesman target created',
                tableName: 'salesman_targets',
                recordId: salesmanTarget.id,
                oldValues: null,
                newValues: salesmanTarget,
            });
            res.status(200).json(salesmanTarget);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getSalesmanTargets(req, res) {
        try {
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { count, rows: salesmanTargets } = await SalesmanTargets.findAndCountAll({
                limit: pagination.limit,
                offset: pagination.offset,
            });
            const enriched = await Promise.all(salesmanTargets.map(enrichTarget));
            res.status(200).json(buildPaginatedResponse(enriched, pagination, count));
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
            const enriched = await Promise.all(salesmanTargets.map(enrichTarget));
            res.status(200).json(enriched);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateTargetFromOrder(order) {
        try {
            const { salesman_id, order_date } = order;
            if (!salesman_id) return;

            // DECIMAL columns come back as strings in MySQL — always do the math
            // with Number() so we add the value instead of concatenating strings.
            const orderTotal = Number(order.order_total) || 0;
            if (orderTotal <= 0) return;

            const salesmanTargets = await SalesmanTargets.findAll({
                where: {
                    salesman_id: salesman_id,
                    // Targets whose window still covers this order date.
                    end_date: { [Op.gte]: new Date(order_date) }
                }
            });
            if (!salesmanTargets || salesmanTargets.length === 0) {
                return;
            }

            for (const target of salesmanTargets) {
                const completed = Number(target.completed_amount) || 0;
                const targetAmount = Number(target.target_amount) || 0;
                if (targetAmount > 0 && completed >= targetAmount) {
                    continue; // already achieved
                }
                // Count when the target is "overall" (no order_type) OR matches this order's type.
                if (target.order_type == null || target.order_type === order.order_type) {
                    const next = completed + orderTotal;
                    target.completed_amount = next;
                    if (targetAmount > 0 && next >= targetAmount) {
                        target.target_status = 'completed';
                    }
                    await target.save();
                }
            }
        }
        catch (error) {
            console.error('updateTargetFromOrder failed:', error.message);
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
            const salesmanTarget = await SalesmanTargets.findOne({ where: { id } });
            if (!salesmanTarget) {
                return res.status(404).json({ error: 'Salesman target not found' });
            }
            const oldSnapshot = salesmanTarget.toJSON();
            const payload = {
                completed_amount,
                target_amount,
                start_date,
                end_date,
                order_type,
                target_description,
                target_remarks,
                updated_at: new Date(),
            };
            await SalesmanTargets.update(payload, { where: { id } });
            await logAudit({
                req,
                action: 'update',
                description: 'Salesman target updated',
                tableName: 'salesman_targets',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
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
            const salesmanTarget = await SalesmanTargets.findOne({ where: { id } });
            if (!salesmanTarget) {
                return res.status(404).json({ error: 'Salesman target not found' });
            }
            const snapshot = salesmanTarget.toJSON();
            await salesmanTarget.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Salesman target deleted',
                tableName: 'salesman_targets',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Salesman target deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new SalesmanTargetsController();
