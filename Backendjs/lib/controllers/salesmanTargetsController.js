const SalesmanTargets = require('../models/SalesmanTargets');
const Order = require('../models/Order');
const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const { Op } = require('sequelize');
const { parsePaginationParams, parseOptionalPagination, buildPaginatedResponse, UNPAGINATED_CAP } = require('../utils/listSearchHelpers');

const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight (UTC) at the start of the day a timestamp falls on.
const startOfDay = (v) => {
    const d = new Date(v);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// A target's end_date is a calendar date stored as midnight, so without this the
// WHOLE last day would be missed (an order placed at 3 pm on the end date is
// "after" midnight). A date-only end counts through 23:59:59.999 of that day.
const endOfTargetDay = (v) => {
    const d = new Date(v);
    const dateOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0
        && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
    return dateOnly ? new Date(d.getTime() + DAY_MS - 1) : d;
};

// Compute achieved amounts LIVE from the orders for a SET of targets with ONE
// orders query (instead of one per target), so existing and new orders always
// count (the report never depends on the stored running total).
const computeCompletedMap = async (targets) => {
    const result = {};
    if (!targets.length) return result;
    const salesmanIds = [...new Set(targets.map((t) => t.salesman_id))];
    const minStart = new Date(Math.min(...targets.map((t) => new Date(t.start_date).getTime())));
    const maxEnd = new Date(Math.max(...targets.map((t) => endOfTargetDay(t.end_date).getTime())));
    const orders = await Order.findAll({
        where: {
            salesman_id: salesmanIds,
            order_date: { [Op.between]: [minStart, maxEnd] },
        },
        attributes: ['salesman_id', 'order_date', 'order_type', 'order_total'],
        raw: true,
    });
    const bySalesman = {};
    orders.forEach((o) => { (bySalesman[o.salesman_id] = bySalesman[o.salesman_id] || []).push(o); });
    targets.forEach((t) => {
        const start = new Date(t.start_date).getTime();
        const end = endOfTargetDay(t.end_date).getTime();
        let sum = 0;
        (bySalesman[t.salesman_id] || []).forEach((o) => {
            const d = new Date(o.order_date).getTime();
            if (d < start || d > end) return;
            if (t.order_type && o.order_type !== t.order_type) return; // null = "overall" = any type
            sum += Number(o.order_total) || 0;
        });
        result[t.id] = sum;
    });
    return result;
};

const enrichTargets = async (targets) => {
    const completedMap = await computeCompletedMap(targets);
    return targets.map((t) => {
        const completed = completedMap[t.id] || 0;
        const targetAmount = Number(t.target_amount) || 0;
        const target_status = (targetAmount > 0 && completed >= targetAmount) ? 'completed' : (t.target_status || 'pending');
        return { ...t.toJSON(), completed_amount: completed, target_status };
    });
};

// Attach salesman_name to a set of rows with ONE batched query, so the report
// doesn't fetch each salesman by id from the client.
const attachSalesmanNames = async (rows) => {
    const ids = [...new Set(rows.map((r) => r.salesman_id).filter(Boolean))];
    if (!ids.length) return rows;
    const salesmen = await Salesman.findAll({ where: { salesman_id: ids }, attributes: ['salesman_id', 'full_name'] });
    const map = {};
    salesmen.forEach((s) => { map[s.salesman_id] = s.full_name; });
    return rows.map((r) => ({ ...r, salesman_name: map[r.salesman_id] || null }));
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
                order: [['created_at', 'DESC'], ['id', 'DESC']],
                limit: pagination.limit,
                offset: pagination.offset,
            });
            const enriched = await attachSalesmanNames(await enrichTargets(salesmanTargets));
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
            const pagination = parseOptionalPagination(req);
            const order = [['created_at', 'DESC'], ['id', 'DESC']];
            if (pagination) {
                const { count, rows } = await SalesmanTargets.findAndCountAll({
                    where: { salesman_id }, order, limit: pagination.limit, offset: pagination.offset,
                });
                const data = await attachSalesmanNames(await enrichTargets(rows));
                return res.status(200).json(buildPaginatedResponse(data, pagination, count));
            }
            const salesmanTargets = await SalesmanTargets.findAll({ where: { salesman_id }, order, limit: UNPAGINATED_CAP });
            const enriched = await attachSalesmanNames(await enrichTargets(salesmanTargets));
            res.status(200).json(enriched);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Every order counts towards the salesman's target, including one that is later
    // cancelled (it still is the salesman's effort). Pass the order's transaction
    // so a rolled-back order cannot leave a target already raised.
    async updateTargetFromOrder(order, options = {}) {
        try {
            const { transaction } = options;
            const { salesman_id, order_date } = order;
            if (!salesman_id) return;

            // DECIMAL columns come back as strings in MySQL — always do the math
            // with Number() so we add the value instead of concatenating strings.
            const orderTotal = Number(order.order_total) || 0;
            if (orderTotal <= 0) return;

            const salesmanTargets = await SalesmanTargets.findAll({
                where: {
                    salesman_id: salesman_id,
                    // Targets whose window covers this order's day: it has started
                    // and its last day has not passed.
                    start_date: { [Op.lte]: new Date(order_date) },
                    end_date: { [Op.gte]: startOfDay(order_date) }
                },
                transaction
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
                    await target.save({ transaction });
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
