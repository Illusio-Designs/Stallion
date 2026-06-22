const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const Party = require('../models/Party');
const Order = require('../models/Order');
const { logAudit } = require('../utils/auditLogger');
const { parsePaginationParams, buildPaginatedResponse } = require('../utils/listSearchHelpers');
const { SalesmanCheckInType } = require('../constants/enums');

// Enrich check-ins for the Visit Report: add party_name, and for ORDERED
// check-ins (type='ordered', which carry an order_id) the linked order's
// number / total / notes(remark) / status. VISIT check-ins use check_in_remarks.
async function enrichCheckIns(checkIns) {
    const rows = checkIns.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c));
    const partyIds = [...new Set(rows.map((r) => r.party_id).filter(Boolean))];
    const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
    const [parties, orders] = await Promise.all([
        partyIds.length ? Party.findAll({ where: { party_id: partyIds } }) : [],
        orderIds.length ? Order.findAll({ where: { order_id: orderIds } }) : [],
    ]);
    const partyMap = {};
    parties.forEach((p) => { partyMap[p.party_id] = p.party_name; });
    const orderMap = {};
    orders.forEach((o) => { orderMap[o.order_id] = o; });
    return rows.map((r) => {
        const o = r.order_id ? orderMap[r.order_id] : null;
        return {
            ...r,
            party_name: partyMap[r.party_id] || null,
            order_number: o ? o.order_number : null,
            order_total: o ? o.order_total : null,
            order_notes: o ? o.order_notes : null,
            order_status: o ? o.order_status : null,
        };
    });
}

function resolveCheckInFields(body, existing = {}) {
    return {
        salesman_id: body.salesman_id !== undefined ? body.salesman_id : existing.salesman_id,
        check_in_date: body.check_in_date !== undefined ? body.check_in_date : existing.check_in_date,
        party_id: body.party_id !== undefined ? body.party_id : existing.party_id,
        contact_person: body.contact_person !== undefined ? body.contact_person : existing.contact_person,
        type: body.type !== undefined ? body.type : existing.type,
        order_id: body.order_id !== undefined ? body.order_id : existing.order_id,
        in_time: body.in_time !== undefined ? body.in_time : existing.in_time,
        out_time: body.out_time !== undefined ? body.out_time : existing.out_time,
        next_visit_date: body.next_visit_date !== undefined ? body.next_visit_date : existing.next_visit_date,
        latitude: body.latitude !== undefined ? body.latitude : existing.latitude,
        longitude: body.longitude !== undefined ? body.longitude : existing.longitude,
        check_in_remarks: body.check_in_remarks !== undefined ? body.check_in_remarks : existing.check_in_remarks,
    };
}

function validateCheckInFields(fields) {
    const {
        salesman_id,
        check_in_date,
        party_id,
        contact_person,
        type,
        order_id,
        in_time,
        out_time,
        next_visit_date,
    } = fields;

    if (!salesman_id || !check_in_date || !party_id || !contact_person || !type || !in_time || !out_time || !next_visit_date) {
        return 'Salesman ID, check-in date, party ID, contact person, type, in time, out time, and next visit date are required';
    }

    const validTypes = Object.values(SalesmanCheckInType);
    if (!validTypes.includes(type)) {
        return `Type must be one of: ${validTypes.join(', ')}`;
    }

    if (type === SalesmanCheckInType.ORDERED && !order_id) {
        return 'Order ID is required when type is ordered';
    }

    if (type === SalesmanCheckInType.VISIT && order_id) {
        return 'Order ID must not be set when type is visit';
    }

    return null;
}

function toCheckInPayload(fields) {
    return {
        salesman_id: fields.salesman_id,
        check_in_date: fields.check_in_date,
        party_id: fields.party_id,
        contact_person: fields.contact_person,
        type: fields.type,
        order_id: fields.type === SalesmanCheckInType.ORDERED ? fields.order_id : null,
        in_time: fields.in_time,
        out_time: fields.out_time,
        next_visit_date: fields.next_visit_date,
        latitude: fields.latitude,
        longitude: fields.longitude,
        check_in_remarks: fields.check_in_remarks,
    };
}

class SalesmanCheckInsController {

    async createSalesmanCheckIn(req, res) {
        try {
            const fields = resolveCheckInFields(req.body);
            const validationError = validateCheckInFields(fields);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const salesmanCheckIn = await SalesmanCheckIns.create({
                ...toCheckInPayload(fields),
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
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { count, rows: checkIns } = await SalesmanCheckIns.findAndCountAll({
                limit: pagination.limit,
                offset: pagination.offset,
            });
            const enriched = await enrichCheckIns(checkIns);
            res.status(200).json(buildPaginatedResponse(enriched, pagination, count));
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
            const enriched = await enrichCheckIns(checkIns);

            res.status(200).json(enriched);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateSalesmanCheckIn(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: 'Check-in ID is required' });
            }

            const existingCheckIn = await SalesmanCheckIns.findOne({ where: { id } });
            if (!existingCheckIn) {
                return res.status(404).json({ error: 'Salesman check-in not found' });
            }

            const fields = resolveCheckInFields(req.body, existingCheckIn.toJSON());
            const validationError = validateCheckInFields(fields);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            const oldSnapshot = existingCheckIn.toJSON();
            const updatedFields = {
                ...toCheckInPayload(fields),
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
