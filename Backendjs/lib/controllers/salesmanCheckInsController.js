const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const Party = require('../models/Party');
const Order = require('../models/Order');
const Salesman = require('../models/Salesman');
const { logAudit } = require('../utils/auditLogger');
const { parsePaginationParams, parseOptionalPagination, buildPaginatedResponse, UNPAGINATED_CAP } = require('../utils/listSearchHelpers');
const { SalesmanCheckInType } = require('../constants/enums');
const { checkGeofence } = require('../utils/geo');
const { isOfficeRole, hasRole } = require('../utils/roleHelpers');

const IN_PROGRESS_MARK = '[In progress]';

// Who is calling: office roles (admin, sales/reports managers, ...) can see and
// manage every check-in; a salesman only their own; everyone else none.
async function resolveActor(req) {
    const roles = req.userRoleNames && req.userRoleNames.length ? req.userRoleNames : [req.userRoleName];
    const isOffice = isOfficeRole(roles);
    let salesmanId = null;
    if (!isOffice && hasRole(roles, ['salesman']) && req.user) {
        const me = await Salesman.findOne({ where: { user_id: req.user.user_id }, attributes: ['salesman_id'] });
        salesmanId = me ? me.salesman_id : null;
    }
    return { isOffice, salesmanId, allowed: isOffice || !!salesmanId };
}

// Enrich check-ins for the Visit Report: add party_name, and for ORDERED
// check-ins (type='ordered', which carry an order_id) the linked order's
// number / total / notes(remark) / status. VISIT check-ins use check_in_remarks.
async function enrichCheckIns(checkIns) {
    const rows = checkIns.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c));
    const partyIds = [...new Set(rows.map((r) => r.party_id).filter(Boolean))];
    const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))];
    const salesmanIds = [...new Set(rows.map((r) => r.salesman_id).filter(Boolean))];
    // Batched lookups so the Visit Report gets party name + coordinates and the
    // salesman name in ONE response — the client no longer fetches them per id.
    const [parties, orders, salesmen] = await Promise.all([
        partyIds.length ? Party.findAll({ where: { party_id: partyIds }, attributes: ['party_id', 'party_name', 'latitude', 'longitude'] }) : [],
        orderIds.length ? Order.findAll({ where: { order_id: orderIds } }) : [],
        salesmanIds.length ? Salesman.findAll({ where: { salesman_id: salesmanIds }, attributes: ['salesman_id', 'full_name'] }) : [],
    ]);
    const partyMap = {};
    parties.forEach((p) => { partyMap[p.party_id] = p; });
    const salesmanMap = {};
    salesmen.forEach((s) => { salesmanMap[s.salesman_id] = s.full_name; });
    const orderMap = {};
    orders.forEach((o) => { orderMap[o.order_id] = o; });
    // Total quantity across an order's items (order_items may be array/JSON string/object).
    const orderQty = (o) => {
        if (!o) return null;
        let its = o.order_items;
        if (typeof its === 'string') { try { its = JSON.parse(its); } catch { its = []; } }
        if (its && typeof its === 'object' && !Array.isArray(its)) its = Object.values(its);
        return Array.isArray(its)
            ? its.reduce((s, it) => s + (Number(it && (it.quantity ?? it.qty)) || 0), 0)
            : 0;
    };
    return rows.map((r) => {
        const o = r.order_id ? orderMap[r.order_id] : null;
        const p = partyMap[r.party_id] || null;
        return {
            ...r,
            in_progress: typeof r.check_in_remarks === 'string' && r.check_in_remarks.startsWith(IN_PROGRESS_MARK),
            party_name: p ? p.party_name : null,
            party_latitude: p ? p.latitude : null,
            party_longitude: p ? p.longitude : null,
            salesman_name: salesmanMap[r.salesman_id] || null,
            order_number: o ? o.order_number : null,
            order_total: o ? o.order_total : null,
            order_qty: o ? orderQty(o) : null,
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

    const inAt = new Date(in_time);
    const outAt = new Date(out_time);
    if (!Number.isNaN(inAt.getTime()) && !Number.isNaN(outAt.getTime()) && outAt <= inAt) {
        return 'Out time must be after in time';
    }
    const visitDay = new Date(check_in_date);
    const nextDay = new Date(next_visit_date);
    if (!Number.isNaN(visitDay.getTime()) && !Number.isNaN(nextDay.getTime())
        && nextDay.setHours(0, 0, 0, 0) < visitDay.setHours(0, 0, 0, 0)) {
        return 'Next visit date cannot be before the visit date';
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
            const actor = await resolveActor(req);
            if (!actor.allowed) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const body = { ...req.body };
            // A salesman can only check in as themselves, whatever the body says.
            if (actor.salesmanId) body.salesman_id = actor.salesmanId;
            // A visit saved offline is sent again until it gets through. If this one was already
            // saved, answer with the saved record instead of creating a second visit.
            const clientRequestId = body.client_request_id ? String(body.client_request_id).slice(0, 64) : null;
            if (clientRequestId && body.salesman_id) {
                const already = await SalesmanCheckIns.findOne({ where: { client_request_id: clientRequestId, salesman_id: body.salesman_id } });
                if (already) return res.status(200).json(already);
            }
            // Start-only check-in ("I'm at the shop"): the out time and next visit date are not
            // known yet. The columns are NOT NULL, so placeholders are kept server-side and the
            // remark is marked "[In progress]" until the salesman saves the visit report.
            if (body.start_only === true || body.start_only === 'true') {
                const inAt = new Date(body.in_time);
                if (!body.out_time && !Number.isNaN(inAt.getTime())) {
                    body.out_time = new Date(inAt.getTime() + 60 * 1000).toISOString();
                }
                if (!body.next_visit_date) body.next_visit_date = body.check_in_date;
                body.check_in_remarks = `${IN_PROGRESS_MARK} ${String(body.check_in_remarks || '').trim()}`.trim();
            }
            const fields = resolveCheckInFields(body);
            const validationError = validateCheckInFields(fields);
            if (validationError) {
                return res.status(400).json({ error: validationError });
            }

            // Enforce the geofence against the party's TRUSTED verified location.
            // Party location must be set via Add/Edit Party ("I'm at shop") —
            // check-in never captures or changes it. A salesman must send their
            // GPS, so the fence cannot be skipped by leaving it out.
            const hasDeviceLoc = fields.latitude != null && fields.latitude !== '' && fields.longitude != null && fields.longitude !== '';
            if (actor.salesmanId && !hasDeviceLoc) {
                return res.status(400).json({ error: 'Your current location is required to check in. Please allow location access and try again.' });
            }
            if (hasDeviceLoc) {
                const checkinParty = await Party.findOne({ where: { party_id: fields.party_id } });
                if (!checkinParty) {
                    return res.status(404).json({ error: 'Party not found' });
                }
                if (checkinParty.location_source === 'verified' && checkinParty.latitude != null && checkinParty.longitude != null) {
                    const geo = checkGeofence({ deviceLat: fields.latitude, deviceLng: fields.longitude, party: checkinParty, action: 'check in' });
                    if (!geo.ok) {
                        return res.status(403).json({ error: geo.reason });
                    }
                } else {
                    return res.status(403).json({
                        error: 'This party\'s exact location is not set yet. Open Add/Edit Party and use "I\'m at shop" to set it, then check in.',
                    });
                }
            }

            const salesmanCheckIn = await SalesmanCheckIns.create({
                ...toCheckInPayload(fields),
                client_request_id: clientRequestId,
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
            // The full list is for office roles only; a salesman uses /:salesman_id.
            const actor = await resolveActor(req);
            if (!actor.isOffice) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { count, rows: checkIns } = await SalesmanCheckIns.findAndCountAll({
                order: [['created_at', 'DESC'], ['id', 'DESC']],
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

            // Office roles can read anyone's; a salesman only their own.
            const actor = await resolveActor(req);
            if (!actor.isOffice && actor.salesmanId !== salesman_id) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const pagination = parseOptionalPagination(req);
            const order = [['created_at', 'DESC'], ['id', 'DESC']];
            if (pagination) {
                const { count, rows } = await SalesmanCheckIns.findAndCountAll({
                    where: { salesman_id }, order, limit: pagination.limit, offset: pagination.offset,
                });
                return res.status(200).json(buildPaginatedResponse(await enrichCheckIns(rows), pagination, count));
            }
            const checkIns = await SalesmanCheckIns.findAll({ where: { salesman_id }, order, limit: UNPAGINATED_CAP });
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

            // A salesman can edit only their own check-ins; office roles any.
            const actor = await resolveActor(req);
            if (!actor.allowed || (!actor.isOffice && existingCheckIn.salesman_id !== actor.salesmanId)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const body = { ...req.body };
            if (actor.salesmanId) body.salesman_id = actor.salesmanId;

            // Which party was visited, and on which day, is fixed once the visit is
            // recorded: the location was checked against THAT party when it was
            // created, so changing either would turn it into a visit that never
            // happened. (To correct a wrong party, an office user deletes the visit.)
            const dayKey = (v) => {
                const d = new Date(v);
                return Number.isNaN(d.getTime()) ? String(v || '') : d.toISOString().slice(0, 10);
            };
            const sameDay = (a, b) => dayKey(a) === dayKey(b);
            if (body.party_id !== undefined && String(body.party_id) !== String(existingCheckIn.party_id)) {
                return res.status(400).json({ error: 'The party of a visit cannot be changed after it is recorded.' });
            }
            if (body.check_in_date !== undefined && !sameDay(body.check_in_date, existingCheckIn.check_in_date)) {
                return res.status(400).json({ error: 'The date of a visit cannot be changed after it is recorded.' });
            }
            body.party_id = existingCheckIn.party_id;
            body.check_in_date = existingCheckIn.check_in_date;

            // Saving the visit report completes a started visit: drop the in-progress mark.
            const fields = resolveCheckInFields(body, existingCheckIn.toJSON());
            if (typeof fields.check_in_remarks === 'string' && fields.check_in_remarks.startsWith(IN_PROGRESS_MARK)) {
                fields.check_in_remarks = fields.check_in_remarks.slice(IN_PROGRESS_MARK.length).trim();
            }
            // The location was checked against the geofence when the check-in was
            // created. Editing later (remarks, times) keeps that stored point and
            // is not re-checked, so it works from anywhere.
            fields.latitude = existingCheckIn.latitude;
            fields.longitude = existingCheckIn.longitude;
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

            // Deleting is for office roles; a salesman cannot erase a visit record.
            const actor = await resolveActor(req);
            if (!actor.isOffice) {
                return res.status(403).json({ error: 'Access denied' });
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
