const Order = require('../models/Order');
const { logAudit } = require('../utils/auditLogger');
const Party = require('../models/Party');
const { checkVisitLocation, distanceMeters } = require('../utils/geo');
const { learnShopSpot } = require('../utils/shopSpot');
const { ensurePartyCoords } = require('../utils/geocode');
const Distributor = require('../models/distributor');
const Salesman = require('../models/Salesman');
const Product = require('../models/Product');
const TrayProducts = require('../models/TrayProducts');
const { TrayProductStatus, OrderStatus, OrderStatusTransitions, OrderType, SalesmanCheckInType } = require('../constants/enums');
const { generateUniqueOrderNumber } = require('../services/order_number_generator');
const Event = require('../models/event');
const OrderOperation = require('../models/OrderOperation');
const OrderShipment = require('../models/OrderShipment');
const TrayReturnTask = require('../models/TrayReturnTask');
const Notification = require('../models/Notification');
const Tray = require('../models/Tray');
const SalesmanTray = require('../models/SalesmanTray');
const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const Offer = require('../models/Offer');
const { isOfferActive, offerScopeMatches, applyOfferToItems } = require('../utils/offerPricing');
const Zone = require('../models/Zone');
const User = require('../models/User');
const sequelize = require('../constants/database');
const { Op } = require('sequelize');
const Country = require('../models/Country');
const State = require('../models/State');
const Cities = require('../models/Cities');
const salesmanTargetsController = require('./salesmanTargetsController');
const DistributorZones = require('../models/DistributorZones');
const { resolveDistributorIdForParty } = require('../utils/distributorMatch');
const { canManageOrders, normalizeRole, hasRole } = require('../utils/roleHelpers');
const { resolveUserScope, canViewAllOrders } = require('../utils/scopeHelpers');
const { salesmanCoversState, salesmanStateIds } = require('../utils/workingStates');
const { recordStockMove } = require('../utils/stockLedger');
const { toInt, allocateShipped, planItemCancel, spreadOver } = require('../utils/orderCancel');
const { getListSearchParams, buildNamePhoneFilter, mergeWhere, parsePaginationParams, buildPaginatedResponse } = require('../utils/listSearchHelpers');

const orderPartyInclude = {
    model: Party,
    as: 'party',
    attributes: ['party_name', 'address', 'billing_address', 'billing_same_as_shipping', 'latitude', 'longitude',
        'country_id', 'state_id', 'city_id', 'pincode'],
    required: false,
};

const TRAY_RETURN_ROLES = ['admin', 'order_manager', 'tray_manager'];
const READY_STATUSES = [OrderStatus.PROCESSED, OrderStatus.PARTIALLY_DISPATCHED, OrderStatus.HOLD_BY_TRAY];
const NO_HELD_STATUSES = [OrderStatus.DISPATCHED, OrderStatus.COMPLETED, OrderStatus.CANCELLED];

function sumItemQty(items) {
    let its = items;
    if (typeof its === 'string') { try { its = JSON.parse(its); } catch { its = []; } }
    if (its && typeof its === 'object' && !Array.isArray(its)) its = Object.values(its);
    return Array.isArray(its)
        ? its.reduce((s, it) => s + (Number(it && (it.quantity ?? it.qty)) || 0), 0)
        : 0;
}

// Adds the dispatch figures to plain order objects. A few grouped queries for the
// whole page (shipments, tray pieces, tray tasks), never one per order.
//   total_qty         pieces ordered
//   tray_qty          pieces booked from sample trays when the order was placed
//   tasks             one per tray part: who must send it back and where it is now
//   held_qty          tray pieces not yet received at the office (tasks booked or in transit);
//                     0 once dispatched / completed / cancelled. Orders placed before tray tasks
//                     existed have no tasks, so they hold nothing (they are not blocked).
//   in_transit_qty    pieces on a courier right now
//   received_tray_qty pieces the office has received back from trays
//   shipped_qty       pieces already sent in shipments
//   cancelled_qty     unsent pieces cancelled after part of the order was shipped (0 otherwise)
//   ready_qty         pieces that can be sent right now
async function decorateOrders(plainOrders, { transaction } = {}) {
    const ids = plainOrders.map((o) => o.order_id).filter(Boolean);
    const shipmentsByOrder = {};
    const trayByOrder = {};
    const tasksByOrder = {};
    if (ids.length) {
        const shipments = await OrderShipment.findAll({
            where: { order_id: ids },
            order: [['shipped_at', 'ASC'], ['created_at', 'ASC']],
            transaction,
        });
        shipments.forEach((sh) => {
            (shipmentsByOrder[sh.order_id] = shipmentsByOrder[sh.order_id] || []).push({
                shipment_id: sh.shipment_id,
                courier_name: sh.courier_name,
                tracking_number: sh.tracking_number,
                qty: Number(sh.qty) || 0,
                shipped_at: sh.shipped_at,
            });
        });
        const ops = await OrderOperation.findAll({
            where: { order_id: ids },
            attributes: ['order_id', [sequelize.fn('SUM', sequelize.col('tray_reduced_qty')), 'tray_sum']],
            group: ['order_id'],
            raw: true,
            transaction,
        });
        ops.forEach((r) => { trayByOrder[r.order_id] = Number(r.tray_sum) || 0; });

        const tasks = await TrayReturnTask.findAll({
            where: { order_id: ids },
            order: [['created_at', 'ASC']],
            transaction,
        });
        if (tasks.length) {
            const names = await taskNameMaps(tasks, transaction);
            tasks.forEach((t) => {
                (tasksByOrder[t.order_id] = tasksByOrder[t.order_id] || []).push(shapeTask(t, names));
            });
        }
    }
    return plainOrders.map((o) => {
        const total_qty = sumItemQty(o.order_items);
        const tray_qty = trayByOrder[o.order_id] || 0;
        const shipments = shipmentsByOrder[o.order_id] || [];
        const tasks = tasksByOrder[o.order_id] || [];
        const shipped_qty = shipments.reduce((s, sh) => s + sh.qty, 0);
        const sumQty = (statuses) => tasks.filter((t) => statuses.includes(t.status)).reduce((s, t) => s + t.qty, 0);
        const cancelled_qty = Number(o.cancelled_qty) || 0;
        const terminal = NO_HELD_STATUSES.includes(o.order_status) || cancelled_qty > 0;
        const held_qty = terminal ? 0 : sumQty(['booked', 'in_transit']);
        const in_transit_qty = sumQty(['in_transit']);
        const received_tray_qty = sumQty(['received']);
        const ready_qty = READY_STATUSES.includes(o.order_status) && cancelled_qty === 0
            ? Math.max(0, total_qty - shipped_qty - held_qty)
            : 0;
        return { ...o, total_qty, tray_qty, held_qty, in_transit_qty, received_tray_qty, shipped_qty, cancelled_qty, ready_qty, shipments, tasks };
    });
}

// Names for a batch of tasks (tray, salesman, model) in three queries.
async function taskNameMaps(tasks, transaction) {
    const uniq = (key) => [...new Set(tasks.map((t) => t[key]).filter(Boolean))];
    const trayIds = uniq('tray_id');
    const salesmanIds = uniq('salesman_id');
    const productIds = uniq('product_id');
    const [trays, salesmen, products] = await Promise.all([
        trayIds.length ? Tray.findAll({ where: { tray_id: trayIds }, attributes: ['tray_id', 'tray_name'], transaction }) : [],
        salesmanIds.length ? Salesman.findAll({ where: { salesman_id: salesmanIds }, attributes: ['salesman_id', 'full_name'], transaction }) : [],
        productIds.length ? Product.findAll({ where: { product_id: productIds }, attributes: ['product_id', 'model_no'], transaction }) : [],
    ]);
    const map = { tray: {}, salesman: {}, product: {} };
    trays.forEach((r) => { map.tray[r.tray_id] = r.tray_name; });
    salesmen.forEach((r) => { map.salesman[r.salesman_id] = r.full_name; });
    products.forEach((r) => { map.product[r.product_id] = r.model_no; });
    return map;
}

function shapeTask(t, names) {
    return {
        task_id: t.task_id,
        tray_id: t.tray_id,
        tray_name: names.tray[t.tray_id] || null,
        salesman_id: t.salesman_id,
        salesman_name: names.salesman[t.salesman_id] || null,
        product_id: t.product_id,
        model_no: names.product[t.product_id] || null,
        qty: Number(t.qty) || 0,
        status: t.status,
        courier_name: t.courier_name,
        tracking_number: t.tracking_number,
        in_transit_at: t.in_transit_at,
        received_at: t.received_at,
    };
}

async function decorateOrder(order, opts) {
    const plain = typeof order.get === 'function' ? order.get({ plain: true }) : order;
    return (await decorateOrders([plain], opts))[0];
}

// Shipping and billing addresses of the orders' parties as separate parts (line, city, state,
// country, pincode), so screens and the PDF can show each on its own line.
async function loadAddressNames(plainOrders) {
    const ids = { country: new Set(), state: new Set(), city: new Set() };
    plainOrders.forEach((o) => {
        const p = o.party;
        if (!p) return;
        if (p.country_id) ids.country.add(p.country_id);
        if (p.state_id) ids.state.add(p.state_id);
        if (p.city_id) ids.city.add(p.city_id);
    });
    const map = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.name]));
    const [countries, states, cities] = await Promise.all([
        ids.country.size ? Country.findAll({ where: { id: [...ids.country] }, attributes: ['id', 'name'] }) : [],
        ids.state.size ? State.findAll({ where: { id: [...ids.state] }, attributes: ['id', 'name'] }) : [],
        ids.city.size ? Cities.findAll({ where: { id: [...ids.city] }, attributes: ['id', 'name'] }) : [],
    ]);
    return { country: map(countries), state: map(states), city: map(cities) };
}

// The party's address as separate parts. The billing address has only its own line; when it
// is the same as shipping, all parts are the shipping parts.
function addressPartsOf(party, names, billing) {
    if (!party) return null;
    const ownLine = billing && !party.billing_same_as_shipping;
    return {
        line: (ownLine ? party.billing_address : party.address) || '',
        city: ownLine ? '' : (names.city[party.city_id] || ''),
        state: ownLine ? '' : (names.state[party.state_id] || ''),
        country: ownLine ? '' : (names.country[party.country_id] || ''),
        pincode: ownLine ? '' : (party.pincode || ''),
    };
}

async function mapOrdersWithPartyName(orders) {
    // Batched salesman-name lookup so order lists (and the Visit Report that
    // merges visit orders) carry salesman_name without the client fetching each
    // salesman by id.
    const salesmanIds = [...new Set(orders.map((o) => o.salesman_id).filter(Boolean))];
    const salesmanMap = {};
    if (salesmanIds.length) {
        const salesmen = await Salesman.findAll({ where: { salesman_id: salesmanIds }, attributes: ['salesman_id', 'full_name'] });
        salesmen.forEach((s) => { salesmanMap[s.salesman_id] = s.full_name; });
    }
    const decorated = await decorateOrders(orders.map((o) => o.get({ plain: true })));
    const addressNames = await loadAddressNames(decorated);
    return decorated.map((plain) => {
        const { party, ...rest } = plain;
        return {
            ...rest,
            salesman_name: salesmanMap[rest.salesman_id] || null,
            party_name: party ? party.party_name : null,
            party_address: party ? party.address : null,
            party_latitude: party ? party.latitude : null,
            party_longitude: party ? party.longitude : null,
            party_billing_address: party
                ? (party.billing_same_as_shipping ? party.address : party.billing_address)
                : null,
            party_address_parts: addressPartsOf(party, addressNames, false),
            party_billing_address_parts: addressPartsOf(party, addressNames, true),
        };
    });
}

// ---- Sample tray return tasks and notifications -------------------------------------------

async function notify({ transaction, userId = null, targetRole = null, title, message, kind, orderId = null }) {
    await Notification.create({
        user_id: userId,
        target_role: userId ? null : targetRole,
        title,
        message,
        kind,
        order_id: orderId,
        created_at: new Date(),
    }, { transaction });
}

// The salesman who holds a tray right now (latest assignment), with their login user id.
async function currentTrayHolder(trayId, transaction) {
    const link = await SalesmanTray.findOne({ where: { tray_id: trayId, released_at: null }, order: [['assigned_at', 'DESC']], transaction });
    if (!link) return null;
    const sm = await Salesman.findOne({ where: { salesman_id: link.salesman_id }, attributes: ['salesman_id', 'user_id', 'full_name'], transaction });
    return sm || null;
}

async function createTrayTask({ transaction, order, productId, modelNo, trayId, qty }) {
    const holder = await currentTrayHolder(trayId, transaction);
    const tray = await Tray.findOne({ where: { tray_id: trayId }, attributes: ['tray_name'], transaction });
    const trayName = tray ? tray.tray_name : 'your tray';
    await TrayReturnTask.create({
        order_id: order.order_id,
        product_id: productId,
        tray_id: trayId,
        salesman_id: holder ? holder.salesman_id : null,
        qty,
        status: 'booked',
    }, { transaction });
    await notify({
        transaction,
        userId: holder ? holder.user_id : null,
        targetRole: 'office',
        title: 'New task: send frames back',
        message: `New task: send ${qty} pieces of ${modelNo || 'the frame'} from ${trayName} back to the office (order ${order.order_number})`,
        kind: 'tray_task',
        orderId: order.order_id,
    });
}

// Called inside the cancel transaction: open tasks become cancelled and the salesmen are told.
async function cancelTrayTasks(order, transaction) {
    const open = await TrayReturnTask.findAll({
        where: { order_id: order.order_id, status: ['booked', 'in_transit'] },
        transaction,
    });
    if (!open.length) return;
    const salesmanIds = [...new Set(open.map((t) => t.salesman_id).filter(Boolean))];
    const salesmen = salesmanIds.length
        ? await Salesman.findAll({ where: { salesman_id: salesmanIds }, attributes: ['salesman_id', 'user_id'], transaction })
        : [];
    const userBySalesman = {};
    salesmen.forEach((sm) => { userBySalesman[sm.salesman_id] = sm.user_id; });
    const now = new Date();
    let notifyOffice = false;
    const notifiedUsers = new Set();
    for (const t of open) {
        t.status = 'cancelled';
        t.updated_at = now;
        await t.save({ transaction });
        const uid = t.salesman_id ? userBySalesman[t.salesman_id] : null;
        if (!uid) { notifyOffice = true; continue; }
        if (notifiedUsers.has(uid)) continue;
        notifiedUsers.add(uid);
        await notify({
            transaction, userId: uid,
            title: 'Order cancelled',
            message: `Order ${order.order_number} was cancelled. Keep the frames in your tray.`,
            kind: 'order_cancelled', orderId: order.order_id,
        });
    }
    if (notifyOffice) {
        await notify({
            transaction, targetRole: 'office',
            title: 'Order cancelled',
            message: `Order ${order.order_number} was cancelled. Keep the frames in your tray.`,
            kind: 'order_cancelled', orderId: order.order_id,
        });
    }
}

// Helper function to reverse an order operation (does not depend on controller instance).
// shippedByProduct (optional) is the number of already SHIPPED pieces per product (see
// allocateShipped). Those pieces are left alone: only the unsent part goes back to stock, and the
// order's operation row is kept, shrunk to the shipped pieces. With nothing shipped (the default)
// everything goes back and the operation rows are removed, as for any full cancel.
// Returns { restoredQty } = the pieces put back into stock (warehouse + tray).
async function reverseOrderOperation(orderId, transaction, actor = null, { shippedByProduct = {} } = {}) {
    const orderRow = await Order.findOne({ where: { order_id: orderId }, attributes: ['order_number'], transaction });
    const orderOperations = await OrderOperation.findAll({
        where: { order_id: orderId },
        transaction,
    });
    // Tray parts already RECEIVED by the office are physically in the warehouse now, so they go
    // back to warehouse_qty (not tray_qty) and their TrayProducts rows are left alone.
    const receivedTasks = await TrayReturnTask.findAll({
        where: { order_id: orderId, status: 'received' },
        transaction,
    });
    let restoredQty = 0;
    for (let i = 0; i < orderOperations.length; i++) {
        const orderOperation = orderOperations[i];
        const receivedByTray = {};
        let receivedTotal = 0;
        receivedTasks.forEach((t) => {
            if (t.product_id !== orderOperation.product_id) return;
            const q = Number(t.qty) || 0;
            receivedByTray[t.tray_id] = (receivedByTray[t.tray_id] || 0) + q;
            receivedTotal += q;
        });
        const shipped = toInt(shippedByProduct[orderOperation.product_id]);
        // Never move more out of the tray side than was taken from it.
        const plan = planItemCancel({
            warehouse: orderOperation.warehouse_reduced_qty,
            tray: orderOperation.tray_reduced_qty,
            received: receivedTotal,
            shipped,
        });
        const warehouseReducedQty = plan.unsentWarehouse + plan.unsentReceived;
        const trayReducedQty = plan.unsentBooked;
        const product = await Product.findOne({
            where: { product_id: orderOperation.product_id },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!product) {
            continue;
        }
        product.warehouse_qty = product.warehouse_qty + warehouseReducedQty;
        product.tray_qty = product.tray_qty + trayReducedQty;
        // Always derive total from warehouse + tray so it can never drift.
        product.total_qty = (Number(product.warehouse_qty) || 0) + (Number(product.tray_qty) || 0);
        await product.save({ transaction });
        restoredQty += warehouseReducedQty + trayReducedQty;
        await recordStockMove({
            transaction,
            productId: product.product_id,
            warehouseAfter: product.warehouse_qty,
            trayAfter: product.tray_qty,
            kind: 'cancel',
            dWarehouse: Number(warehouseReducedQty) || 0,
            dTray: Number(trayReducedQty) || 0,
            user: actor,
            reference: orderRow ? orderRow.order_number : null,
        });
        const trayIds = Array.isArray(orderOperation.tray_ids) ? orderOperation.tray_ids : [];
        // Booked tray pieces of each tray part (received frames are no longer in the tray).
        const parts = trayIds.map((entry) => {
            const e = entry || {};
            const takenBack = Math.min(receivedByTray[e.tray_id] || 0, Number(e.qty) || 0);
            const qty = (Number(e.qty) || 0) - takenBack;
            if (takenBack > 0) receivedByTray[e.tray_id] -= takenBack;
            return { entry: e, takenBack, qty };
        });
        const gives = shipped > 0
            ? spreadOver(parts.map((p) => p.qty), trayReducedQty)
            : parts.map((p) => p.qty);
        for (let j = 0; j < parts.length; j++) {
            const { entry, takenBack, qty } = parts[j];
            const trayId = entry.tray_id;
            const give = gives[j];
            const status = entry.status;
            if (takenBack > 0 && qty <= 0) continue;
            // Booked frames of this part that were already sent stay out of the tray.
            if (shipped > 0 && give <= 0 && qty > 0) continue;
            // Skip malformed/legacy entries without a tray id — querying with an
            // undefined tray_id throws ("WHERE parameter tray_id has invalid
            // undefined value") and aborts the whole reversal/delete.
            if (!trayId) {
                continue;
            }
            const trayProduct = await TrayProducts.findOne({
                where: { tray_id: trayId, product_id: orderOperation.product_id },
                transaction,
            });
            if (!trayProduct) {
                continue;
            }
            trayProduct.qty = trayProduct.qty + (give || 0);
            if (status) {
                trayProduct.status = status;
            }
            await trayProduct.save({ transaction });
        }
        const keptWarehouse = plan.shippedWarehouse;
        const keptReceived = plan.shippedReceived;
        if (shipped > 0 && keptWarehouse + keptReceived > 0) {
            // Keep what the shipped pieces took out of stock, so a later delete stays correct.
            orderOperation.warehouse_reduced_qty = keptWarehouse;
            orderOperation.tray_reduced_qty = keptReceived;
            orderOperation.total_reduced_qty = keptWarehouse + keptReceived;
            orderOperation.tray_ids = [];
            await orderOperation.save({ transaction });
        } else {
            await orderOperation.destroy({ transaction });
        }
    }
    return { restoredQty };
}


function resolveOrderStatusFilter(req) {
    const status = String(req.query.status ?? req.query.order_status ?? '').trim();
    if (!status) {
        return { filter: null };
    }
    if (!Object.values(OrderStatus).includes(status)) {
        return {
            error: `Invalid order status. Allowed values are: ${Object.values(OrderStatus).join(', ')}`,
            status: 400,
        };
    }
    return { filter: { order_status: status } };
}

function resolveOrderDateRangeFilter(req) {
    const startRaw = String(req.query.start_date ?? '').trim();
    const endRaw = String(req.query.end_date ?? '').trim();
    if (!startRaw && !endRaw) {
        return { filter: null };
    }

    let startDate = null;
    let endDate = null;

    if (startRaw) {
        const parsed = new Date(startRaw);
        if (Number.isNaN(parsed.getTime())) {
            return { error: 'Invalid start_date', status: 400 };
        }
        startDate = parsed;
        startDate.setHours(0, 0, 0, 0);
    }

    if (endRaw) {
        const parsed = new Date(endRaw);
        if (Number.isNaN(parsed.getTime())) {
            return { error: 'Invalid end_date', status: 400 };
        }
        endDate = parsed;
        endDate.setHours(23, 59, 59, 999);
    }

    if (startDate && endDate && startDate > endDate) {
        return { error: 'start_date must be on or before end_date', status: 400 };
    }

    const filter = {};
    if (startDate && endDate) {
        filter.order_date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
        filter.order_date = { [Op.gte]: startDate };
    } else if (endDate) {
        filter.order_date = { [Op.lte]: endDate };
    }

    return { filter };
}


// An error we expect and can explain to the user in plain words.
class OrderError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

const statusLabel = (st) => String(st || '').replace(/_/g, ' ');
const statusMoveMessage = (from, to) =>
    `This order is ${statusLabel(from)}, so it cannot be changed to ${statusLabel(to)}.`;

class OrderController {

    async getMyOrders(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const role = normalizeRole(req.userRoleName);
            if (!role) {
                return res.status(400).json({ error: 'User role is required' });
            }

            const scope = await resolveUserScope(user.user_id, role);
            let whereClause = {};

            if (role === 'party') {
                if (!scope.partyId) {
                    return res.status(404).json({ error: 'Party not found' });
                }
                whereClause.party_id = scope.partyId;
            } else if (role === 'distributor') {
                if (!scope.distributorId) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
                whereClause.distributor_id = scope.distributorId;
            } else if (role === 'salesman') {
                if (!scope.salesmanId) {
                    return res.status(404).json({ error: 'Salesman not found' });
                }
                whereClause.salesman_id = scope.salesmanId;
            } else if (canViewAllOrders(req.userRoleNames)) {
                // Routes pass these methods as bare callbacks, so `this` is not the
                // controller here; call the exported instance directly.
                return orderController.getOrders(req, res);
            } else {
                return res.status(403).json({ error: 'Access denied' });
            }

            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['order_number', 'order_status', 'order_type', 'courier_name', 'courier_tracking_number'],
                phoneFields: [],
            });
            const where = mergeWhere(whereClause, searchFilter);
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { count, rows: orders } = await Order.findAndCountAll({
                where,
                include: [orderPartyInclude],
                limit: pagination.limit,
                offset: pagination.offset,
                order: [['order_date', 'DESC']],
            });
            res.status(200).json(buildPaginatedResponse(await mapOrdersWithPartyName(orders), pagination, count));
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    }
    async getOrders(req, res) {
        try {
            if (!canViewAllOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { name } = getListSearchParams(req);
            const statusResult = resolveOrderStatusFilter(req);
            if (statusResult.error) {
                return res.status(statusResult.status).json({ error: statusResult.error });
            }
            const dateResult = resolveOrderDateRangeFilter(req);
            if (dateResult.error) {
                return res.status(dateResult.status).json({ error: dateResult.error });
            }
            const searchFilter = buildNamePhoneFilter({
                name,
                phone: null,
                nameFields: ['order_number', 'order_status', 'order_type', 'courier_name', 'courier_tracking_number'],
                phoneFields: [],
            });
            const baseFilter = {
                ...(statusResult.filter ?? {}),
                ...(dateResult.filter ?? {}),
            };
            const where = mergeWhere(baseFilter, searchFilter);
            const { count, rows: orders } = await Order.findAndCountAll({
                where,
                include: [orderPartyInclude],
                limit: pagination.limit,
                offset: pagination.offset,
                order: [['order_date', 'DESC']],
            });
            res.status(200).json(buildPaginatedResponse(await mapOrdersWithPartyName(orders), pagination, count));
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    }
    /**
     * GET /orders/sales-by-state?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Sales, orders and top parties per state for a period, plus the change against the period
     * before it. Cancelled orders are counted (the salesman's effort still counts). A party's state
     * decides the row; orders with no party or no state go under "No state set".
     * Admin and the office roles see every state; a salesman sees only the states they work in.
     */
    async getSalesByState(req, res) {
        try {
            const office = hasRole(req.userRoleNames, ['admin', 'reports_manager', 'expense_manager', 'order_manager', 'sales_manager', 'party_manager']);
            let stateFilter = '';
            const replacements = {};
            if (!office) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                if (!hasRole(req.userRoleNames, 'salesman') || !scope.salesmanId) {
                    return res.status(403).json({ error: 'Access denied' });
                }
                const ids = await salesmanStateIds(scope.salesmanId);
                if (!ids.length) return res.status(200).json({ from: null, to: null, states: [], total_sales: 0 });
                stateFilter = ' AND p.state_id IN (:stateIds)';
                replacements.stateIds = ids;
            }
            const toDate = req.query.to ? new Date(`${String(req.query.to).slice(0, 10)}T00:00:00`) : new Date();
            const fromDate = req.query.from ? new Date(`${String(req.query.from).slice(0, 10)}T00:00:00`) : new Date(toDate.getTime() - 30 * 86400000);
            if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime()) || fromDate > toDate) {
                return res.status(400).json({ error: 'Choose a valid date range' });
            }
            const end = new Date(toDate.getTime() + 86400000); // include the whole last day
            const span = end.getTime() - fromDate.getTime();
            const prevFrom = new Date(fromDate.getTime() - span);

            const totals = (from, to) => sequelize.query(
                `SELECT COALESCE(s.name, 'No state set') AS state, COUNT(*) AS orders,
                        COALESCE(SUM(o.order_total), 0) AS sales, COUNT(DISTINCT o.party_id) AS parties
                 FROM \`order\` o
                 LEFT JOIN parties p ON p.party_id = o.party_id
                 LEFT JOIN states s ON s.id = p.state_id
                 WHERE o.order_date >= :from AND o.order_date < :to${stateFilter}
                 GROUP BY s.name`,
                { replacements: { ...replacements, from, to }, type: sequelize.QueryTypes.SELECT }
            );
            const [now, before, tops] = await Promise.all([
                totals(fromDate, end),
                totals(prevFrom, fromDate),
                sequelize.query(
                    `SELECT COALESCE(s.name, 'No state set') AS state, p.party_name AS party_name, COUNT(*) AS orders,
                            COALESCE(SUM(o.order_total), 0) AS amount
                     FROM \`order\` o
                     JOIN parties p ON p.party_id = o.party_id
                     LEFT JOIN states s ON s.id = p.state_id
                     WHERE o.order_date >= :from AND o.order_date < :to${stateFilter}
                     GROUP BY s.name, p.party_id, p.party_name
                     ORDER BY amount DESC`,
                    { replacements: { ...replacements, from: fromDate, to: end }, type: sequelize.QueryTypes.SELECT }
                ),
            ]);
            const prev = new Map(before.map((r) => [r.state, Number(r.sales) || 0]));
            const topBy = new Map();
            for (const t of tops) {
                const list = topBy.get(t.state) || [];
                if (list.length < 4) list.push({ party_name: t.party_name, orders: Number(t.orders), amount: Number(t.amount) });
                topBy.set(t.state, list);
            }
            const states = now.map((r) => {
                const sales = Number(r.sales) || 0;
                const before = prev.get(r.state) || 0;
                return {
                    state: r.state,
                    sales,
                    orders: Number(r.orders) || 0,
                    parties: Number(r.parties) || 0,
                    change_percent: before > 0 ? Math.round(((sales - before) / before) * 100) : null,
                    top_parties: topBy.get(r.state) || [],
                };
            }).sort((a, b) => b.sales - a.sales);
            res.status(200).json({
                from: fromDate.toISOString().slice(0, 10),
                to: toDate.toISOString().slice(0, 10),
                total_sales: states.reduce((sum, r) => sum + r.sales, 0),
                states,
            });
        } catch (error) {
            console.error('Sales by state failed:', error.message);
            res.status(500).json({ error: 'Could not load sales by state' });
        }
    }

    async createOrder(req, res) {
        try {
            // latitude, logitude for visit order
            const { order_date, order_type, order_items, order_notes, event_id, party_id, latitude, longitude, zone_id, offer_id } = req.body;
            let distributor_id = req.body.distributor_id;
            let salesman_id = req.body.salesman_id;
            if (!order_date || !order_type || !order_items) {
                return res.status(400).json({ error: 'order_date, order_type, order_items  are required' });
            }
            if (!Array.isArray(order_items)) {
                return res.status(400).json({ error: 'Order items must be an array' });
            }
            // if order type is not among the allowed types, return error
            if (!Object.values(OrderType).includes(order_type)) {
                return res.status(400).json({ error: 'Invalid order type. Allowed types are: ' + Object.values(OrderType).join(', ') });
            }
            let isSalesmanRequired = false;
            let isDistributorRequired = false; // not required for event order
            let isPartyRequired = false;

            // if order type is event order, check if event id is provided
            if (order_type === OrderType.EVENT_ORDER) {
                isSalesmanRequired = true;
                isDistributorRequired = false;
                isPartyRequired = true;
                if (!event_id) {
                    return res.status(400).json({ error: 'Event ID is required for event orders' });
                }
                const event = await Event.findOne({ where: { event_id: event_id } });
                if (!event) {
                    return res.status(404).json({ error: 'Event not found' });
                }
                if (event.is_active === false) {
                    return res.status(400).json({ error: 'This event is inactive.' });
                }
            }
            // if order type is party order, check if party id is provided
            else if (order_type === OrderType.PARTY_ORDER) {
                isPartyRequired = true;
                isDistributorRequired = false;
                isSalesmanRequired = false;
                if (!party_id) {
                    return res.status(400).json({ error: 'Party ID is required for party orders' });
                }
                const party = await Party.findOne({ where: { party_id: party_id } });
                if (!party) {
                    return res.status(404).json({ error: 'Party not found' });
                }
                if (!party.is_active) {
                    return res.status(400).json({ error: 'Party is inactive' });
                }
                const distributor = await Distributor.findOne({ where: { distributor_id: party.distributor_id } });
                if (distributor) {
                    distributor_id = distributor.distributor_id;
                    isDistributorRequired = true;
                }
            }
            // if order type is distributor order, fetch distributor by user ID
            else if (order_type === OrderType.DISTRIBUTOR_ORDER) {
                isDistributorRequired = true;
                isPartyRequired = false;
                isSalesmanRequired = false;

                const user = req.user;

                // First, try to find distributor by user_id
                let distributor = await Distributor.findOne({
                    where: { user_id: user.user_id }
                });

                // If not found, fetch user's email/phone and search for distributor
                if (!distributor) {
                    const userDetails = await User.findOne({
                        where: { user_id: user.user_id }
                    });

                    if (!userDetails) {
                        return res.status(404).json({ error: 'User not found' });
                    }

                    // Search for distributor by email or phone
                    const whereConditions = [];
                    if (userDetails.email) whereConditions.push({ email: userDetails.email });
                    if (userDetails.phone) whereConditions.push({ phone: userDetails.phone });

                    if (whereConditions.length > 0) {
                        distributor = await Distributor.findOne({
                            where: {
                                [Op.or]: whereConditions
                            }
                        });
                    }

                    // If distributor found, link it to the user
                    if (distributor) {
                        distributor.user_id = user.user_id;
                        await distributor.save();
                    } else {
                        return res.status(404).json({ error: 'No distributor found for this user' });
                    }
                }

                distributor_id = distributor.distributor_id;
            }
            else if (order_type === OrderType.VISIT_ORDER) {
                if (!latitude || !longitude) {
                    return res.status(400).json({ error: 'Latitude and longitude are required for visit orders' });
                }
                isDistributorRequired = false;
                isPartyRequired = true;
                isSalesmanRequired = true;
                if (!party_id) {
                    return res.status(400).json({ error: 'Party ID is required for visit orders' });
                }
                const visitParty = await Party.findOne({ where: { party_id } });
                if (!visitParty) {
                    return res.status(404).json({ error: 'Party not found' });
                }
                // Distance between the party's saved latitude/longitude and the phone's:
                // 50m for a precise spot, 150m the first time (the point still comes from the
                // address), after which the phone's position is saved as the precise spot.
                const visitCheck = checkVisitLocation({
                    deviceLat: latitude, deviceLng: longitude, accuracy: req.body.accuracy,
                    party: visitParty, action: 'place a visit order',
                });
                if (!visitCheck.ok) {
                    return res.status(visitCheck.code === 'no_location' ? 409 : 403).json({ error: visitCheck.reason, code: visitCheck.code });
                }
                if (visitCheck.learn) {
                    await learnShopSpot(req, visitParty, { latitude, longitude, accuracy: req.body.accuracy });
                }
            }
            else {
                isDistributorRequired = false;
                isPartyRequired = true;
                isSalesmanRequired = true;
            }

            if (isDistributorRequired) {
                if (!distributor_id) {
                    return res.status(400).json({ error: 'Distributor ID is required' });
                }
                const distributor = await Distributor.findOne({ where: { distributor_id: distributor_id } });
                if (!distributor) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
            } else if (zone_id) {
                const zone = await Zone.findOne({ where: { id: zone_id } });
                if (!zone) {
                    return res.status(404).json({ error: 'Zone not found' });
                }
                const distributorZone = await DistributorZones.findOne({ where: { zone_id: zone_id } });
                if (!distributorZone) {
                    return res.status(404).json({ error: 'Distributor zone not found' });
                }
                const distributor = await Distributor.findOne({ where: { distributor_id: distributorZone.distributor_id } });
                if (!distributor) {
                    return res.status(404).json({ error: 'Distributor not found' });
                }
                distributor_id = distributor.distributor_id;
            }
            if (isPartyRequired) {
                if (!party_id) {
                    return res.status(400).json({ error: 'Party ID is required' });
                }
                const party = await Party.findOne({ where: { party_id: party_id } });
                if (!party) {
                    return res.status(404).json({ error: 'Party not found' });
                }
                if (!party.is_active) {
                    return res.status(400).json({ error: 'Party is inactive' });
                }
            }
            // Every order that belongs to a party (visit, event, WhatsApp, party order) is
            // given the distributor that works in the party's state, so the distributor
            // sees all of its state's orders. Distributor's own orders keep their own id.
            let matchedDistributorId = null;
            if (isPartyRequired && party_id) {
                const matchParty = await Party.findOne({ where: { party_id } });
                matchedDistributorId = await resolveDistributorIdForParty(matchParty);
            }
            if (isSalesmanRequired) {
                // If salesman_id is not provided, find it from the user_id
                if (!salesman_id) {
                    const user = req.user;
                    const salesman = await Salesman.findOne({ where: { user_id: user.user_id } });
                    if (!salesman) {
                        return res.status(404).json({ error: 'Salesman record not found for this user' });
                    }
                    salesman_id = salesman.salesman_id;
                } else {
                    // If salesman_id is provided, verify it exists
                    const salesman = await Salesman.findOne({ where: { salesman_id: salesman_id } });
                    if (!salesman) {
                        return res.status(404).json({ error: 'Salesman not found' });
                    }
                }
            }

            const user = req.user;
            for (let i = 0; i < order_items.length; i++) {
                const item = order_items[i];
                // if item is not an object, return error
                if (typeof item !== 'object') {
                    return res.status(400).json({ error: 'Order items must be an array of objects' });
                }
                if (!item.product_id || !item.quantity) {
                    return res.status(400).json({ error: 'product_id and quantity are required for each order item' });
                }
                // if product_id is not a string, return error
                if (typeof item.product_id !== 'string') {
                    return res.status(400).json({ error: 'Product ID must be a string' });
                }
                // if quantity is not a number, return error
                if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
                    return res.status(400).json({ error: 'Quantity must be a whole number, 1 or more.' });
                }
                const product = await Product.findOne({ where: { product_id: item.product_id } });
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
            }

            const userScope = await resolveUserScope(user.user_id, req.userRoleName);
            if (isPartyRequired && party_id && userScope.role === 'party' && userScope.partyId !== party_id) {
                return res.status(403).json({ error: 'Cannot create orders for another party' });
            }
            if (isDistributorRequired && distributor_id && userScope.role === 'distributor' && userScope.distributorId !== distributor_id) {
                return res.status(403).json({ error: 'Cannot create orders for another distributor' });
            }
            if (userScope.role === 'salesman') {
                if (!userScope.salesmanId) {
                    return res.status(404).json({ error: 'Salesman record not found for this user' });
                }
                if (isSalesmanRequired && salesman_id && userScope.salesmanId !== salesman_id) {
                    return res.status(403).json({ error: 'Cannot create orders for another salesman' });
                }
                // A salesman's orders always go under the logged-in salesman.
                if (isSalesmanRequired) salesman_id = userScope.salesmanId;
                // ...and only for parties that belong to them.
                if (party_id) {
                    const ownParty = await Party.findOne({ where: { party_id }, attributes: ['party_id', 'state_id'] });
                    if (!ownParty) {
                        return res.status(404).json({ error: 'Party not found' });
                    }
                    if (!(await salesmanCoversState(userScope.salesmanId, ownParty.state_id))) {
                        return res.status(403).json({ error: 'This party is outside the states you work in, so you cannot place an order for it.' });
                    }
                }
            }

            // The same product on two lines becomes one line, so an offer is worked out once.
            {
                const merged = new Map();
                for (const it of order_items) {
                    const prev = merged.get(it.product_id);
                    if (prev) prev.quantity += it.quantity;
                    else merged.set(it.product_id, { ...it });
                }
                order_items.splice(0, order_items.length, ...merged.values());
            }

            let orderTotal = 0;
            const resolvedOrderItems = [];
            const orderOperationsToCreate = [];
            const stockLines = [];

            await sequelize.transaction(async (transaction) => {
                // Lock all products in one fixed order so two carts cannot block each other.
                await Product.findAll({
                    where: { product_id: order_items.map((it) => it.product_id) },
                    order: [['product_id', 'ASC']],
                    attributes: ['product_id'],
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                for (let i = 0; i < order_items.length; i++) {
                    const item = order_items[i];
                    const product = await Product.findOne({
                        where: { product_id: item.product_id },
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (!product) {
                        throw new OrderError('One of the products in your cart is no longer available. Please remove it and try again.', 404);
                    }
                    if (product.is_active === false) {
                        throw new OrderError('This frame is no longer available.', 409);
                    }
                    if (product.total_qty < item.quantity) {
                        throw new OrderError(`Sorry, ${product.model_no} does not have enough stock for this quantity.`, 409);
                    }

                    const unitPrice = parseFloat(product.whp);
                    if (Number.isNaN(unitPrice) || unitPrice < 0) {
                        throw new OrderError(`${product.model_no} has no price set yet, so it cannot be ordered.`, 400);
                    }

                    const warehouse_qty = product.warehouse_qty;
                    let orderOperationData;

                    const oldProductSnapshot = product.toJSON();

                    if (item.quantity > warehouse_qty) {
                        const left = item.quantity - warehouse_qty;
                        product.warehouse_qty = 0;
                        product.tray_qty = product.tray_qty - left;
                        // Derive total from warehouse + tray (never drifts).
                        product.total_qty = (Number(product.warehouse_qty) || 0) + (Number(product.tray_qty) || 0);
                        const trayProducts = await TrayProducts.findAll({
                            where: { product_id: product.product_id, status: TrayProductStatus.ALLOTED },
                            transaction,
                        });
                        let remainingQty = left;
                        const trayIds = [];
                        for (let t = 0; t < trayProducts.length; t++) {
                            const trayProduct = trayProducts[t];
                            if (trayProduct.qty >= remainingQty) {
                                trayProduct.qty = trayProduct.qty - remainingQty;
                                trayIds.push({
                                    tray_id: trayProduct.tray_id,
                                    qty: remainingQty,
                                    status: trayProduct.status,
                                });
                                trayProduct.status = TrayProductStatus.PARTIALLY_BOOKED;
                                remainingQty = 0;
                            } else {
                                remainingQty = remainingQty - trayProduct.qty;
                                trayIds.push({
                                    tray_id: trayProduct.tray_id,
                                    qty: trayProduct.qty,
                                    status: trayProduct.status,
                                });
                                trayProduct.qty = 0;
                                trayProduct.status = TrayProductStatus.PRIORITY_BOOKED;
                            }
                            await trayProduct.save({ transaction });
                            if (remainingQty === 0) {
                                break;
                            }
                        }
                        if (remainingQty > 0) {
                            throw new OrderError(`Sorry, ${product.model_no} does not have enough stock for this quantity.`, 409);
                        }
                        orderOperationData = {
                            warehouse_reduced_qty: warehouse_qty,
                            tray_reduced_qty: left,
                            total_reduced_qty: item.quantity,
                            tray_ids: trayIds,
                            product_id: product.product_id,
                        };
                    } else {
                        product.warehouse_qty = warehouse_qty - item.quantity;
                        // Derive total from warehouse + tray (never drifts).
                        product.total_qty = (Number(product.warehouse_qty) || 0) + (Number(product.tray_qty) || 0);
                        orderOperationData = {
                            warehouse_reduced_qty: item.quantity,
                            tray_reduced_qty: 0,
                            total_reduced_qty: item.quantity,
                            tray_ids: [],
                            product_id: product.product_id,
                        };
                    }

                    await product.save({ transaction });
                    orderOperationsToCreate.push(orderOperationData);
                    stockLines.push({
                        productId: product.product_id,
                        warehouseAfter: product.warehouse_qty,
                        trayAfter: product.tray_qty,
                        dWarehouse: -(Number(orderOperationData.warehouse_reduced_qty) || 0),
                        dTray: -(Number(orderOperationData.tray_reduced_qty) || 0),
                    });

                    const resolvedItem = {
                        product_id: item.product_id,
                        // Snapshot the model number at order time so dashboards can
                        // label the item even after the product row is later deleted
                        // (deletes are hard, so a live lookup would return nothing →
                        // "Unknown Product"). Extra fields are preserved by
                        // applyOfferToItems (it spreads each item).
                        model_no: product.model_no,
                        quantity: item.quantity,
                        price: unitPrice,
                    };
                    resolvedOrderItems.push(resolvedItem);
                    orderTotal += unitPrice * item.quantity;

                    await logAudit({
                        req,
                        transaction,
                        action: 'update',
                        description: 'Product quantity updated',
                        tableName: 'product',
                        recordId: product.product_id,
                        oldValues: oldProductSnapshot,
                        newValues: product,
                    });
                }

                // Apply ONLY the offer the user explicitly selected (offer_id),
                // re-validated server-side. No auto-apply: an order with no offer
                // chosen places at full price. An inactive / expired / out-of-scope
                // offer is ignored.
                const offerLines = resolvedOrderItems.map(i => ({ product_id: i.product_id, qty: i.quantity, unit_price: i.price }));
                let appliedOfferModel = null;
                if (offer_id) {
                    const candidate = await Offer.findOne({ where: { offer_id }, transaction });
                    if (candidate && isOfferActive(candidate) && offerScopeMatches(candidate, offerLines)) {
                        appliedOfferModel = candidate;
                    }
                }
                const priced = applyOfferToItems(appliedOfferModel, resolvedOrderItems);

                // Pick a number that no existing order already has.
                let orderNumber = generateUniqueOrderNumber();
                for (let tries = 0; tries < 5; tries++) {
                    const clash = await Order.findOne({ where: { order_number: orderNumber }, attributes: ['order_id'], transaction });
                    if (!clash) break;
                    orderNumber = generateUniqueOrderNumber();
                }
                const orderData = {
                    order_number: orderNumber,
                    order_date,
                    order_type,
                    order_total: priced.orderTotal,
                    subtotal: priced.subtotal,
                    discount_total: priced.discountTotal,
                    applied_offer: priced.appliedOffer,
                    order_items: priced.pricedItems,
                    order_notes,
                    created_at: new Date(),
                    updated_at: new Date(),
                    order_status: OrderStatus.PENDING,
                    event_id,
                    latitude,
                    longitude,
                };

                // Distance at checkout: device position vs the party's saved shop
                // location. Only stored when both are known.
                if (party_id && latitude != null && longitude != null && latitude !== '' && longitude !== '') {
                    const distParty = await Party.findOne({ where: { party_id }, attributes: ['latitude', 'longitude'], transaction });
                    if (distParty && distParty.latitude != null && distParty.longitude != null) {
                        const metres = distanceMeters(latitude, longitude, distParty.latitude, distParty.longitude);
                        if (metres != null) orderData.distance_m = Math.round(metres);
                    }
                }

                if (isPartyRequired && party_id) {
                    orderData.party_id = party_id;
                }
                const finalDistributorId = matchedDistributorId
                    || ((isDistributorRequired || zone_id) ? distributor_id : null);
                if (finalDistributorId) {
                    orderData.distributor_id = finalDistributorId;
                }
                if (isSalesmanRequired && salesman_id) {
                    orderData.salesman_id = salesman_id;
                }

                // The database refuses a repeated order number. If that ever happens (two orders
                // made the same number at the same moment), make a new number and save again.
                let order;
                for (let attempt = 0; ; attempt++) {
                    try {
                        order = await Order.create(orderData, { transaction });
                        break;
                    } catch (err) {
                        const clash = err && err.name === 'SequelizeUniqueConstraintError'
                            && (err.fields && Object.prototype.hasOwnProperty.call(err.fields, 'order_number')
                                || /order_number/.test(String(err.message)));
                        if (!clash || attempt >= 4) throw err;
                        orderData.order_number = generateUniqueOrderNumber();
                    }
                }

                // A visit order closes the salesman's open "I'm at the shop" visit for this
                // party: the visit now points at the order, so the Visit Report shows one row.
                // Never blocks the order itself.
                if (order_type === OrderType.VISIT_ORDER && order.salesman_id && order.party_id) {
                    try {
                        const openVisit = await SalesmanCheckIns.findOne({
                            where: {
                                salesman_id: order.salesman_id,
                                party_id: order.party_id,
                                order_id: null,
                                type: SalesmanCheckInType.VISIT,
                                check_in_remarks: { [Op.like]: '[In progress]%' },
                                in_time: { [Op.gte]: new Date(Date.now() - 12 * 60 * 60 * 1000) },
                            },
                            order: [['in_time', 'DESC']],
                            transaction,
                        });
                        if (openVisit) {
                            await openVisit.update({ order_id: order.order_id, type: SalesmanCheckInType.ORDERED }, { transaction });
                        }
                    } catch (linkErr) {
                        console.error('[order] could not link the open visit:', linkErr.message);
                    }
                }

                // Stock history: one line per product on this order.
                for (const line of stockLines) {
                    await recordStockMove({ transaction, ...line, kind: 'order', user, reference: order.order_number });
                }

                for (const operationData of orderOperationsToCreate) {
                    await OrderOperation.create({
                        order_id: order.order_id,
                        ...operationData,
                    }, { transaction });
                }

                // Sample-tray parts: one return task per tray part, and tell the salesman holding
                // that tray (or the office when nobody holds it) to send the frames back.
                const modelByProduct = {};
                resolvedOrderItems.forEach((it) => { modelByProduct[it.product_id] = it.model_no; });
                for (const operationData of orderOperationsToCreate) {
                    const parts = Array.isArray(operationData.tray_ids) ? operationData.tray_ids : [];
                    for (const part of parts) {
                        const partQty = Number(part && part.qty) || 0;
                        if (!part || !part.tray_id || partQty < 1) continue;
                        await createTrayTask({
                            transaction,
                            order,
                            productId: operationData.product_id,
                            modelNo: modelByProduct[operationData.product_id],
                            trayId: part.tray_id,
                            qty: partQty,
                        });
                    }
                }

                // Count the order toward the assigned salesman's target — for any
                // order that has a salesman_id, regardless of who placed it.
                if (order.salesman_id) {
                    await salesmanTargetsController.updateTargetFromOrder(order, { transaction });
                }

                await logAudit({
                    req,
                    transaction,
                    action: 'create',
                    description: 'Order created',
                    tableName: 'order',
                    recordId: order.order_id,
                    oldValues: null,
                    newValues: order,
                });

                req._createdOrder = order;
            });

            res.status(201).json(req._createdOrder);
        } catch (error) {
            console.error('Error creating order:', error);
            if (error instanceof OrderError) {
                return res.status(error.status).json({ error: error.message });
            }
            const code = error && (error.original?.code || error.parent?.code);
            if (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT') {
                return res.status(409).json({ error: 'Many orders are being placed right now. Please try again in a moment.' });
            }
            if (error && error.name === 'SequelizeValidationError') {
                return res.status(400).json({ error: 'Some order details are missing or not valid. Please check and try again.' });
            }
            res.status(500).json({ error: 'Something went wrong on our side. Your order was not placed. Please try again.' });
        }
    }

    async updateOrderStatus(req, res) {
        try {
            if (!canManageOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const user = req.user;
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Order ID is required' });
            }
            const { order_status } = req.body;
            if (!order_status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const order = await Order.findOne({ where: { order_id: id } });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const oldSnapshot = order.toJSON();
            if (!Object.values(OrderStatus).includes(order_status)) {
                return res.status(400).json({ error: 'Invalid order status. Allowed values are: ' + Object.values(OrderStatus).join(', ') });
            }
            // Status can be moved to any value directly (no forced step-by-step
            // sequence). We still capture the previous status to guard the
            // cancellation inventory reversal below against running twice.
            const currentStatus = order.order_status;
            // A cancelled order stays cancelled. Its stock was already returned, and
            // moving it back would leave the shelf count too high because nothing takes
            // the stock out again. To order the same frames again, place a new order.
            if (currentStatus === OrderStatus.CANCELLED && order_status !== OrderStatus.CANCELLED) {
                return res.status(400).json({ error: 'A cancelled order cannot be reopened. Place a new order instead.' });
            }
            // Only valid moves are allowed (see OrderStatusTransitions). Re-sending
            // "cancelled" on a cancelled order stays a harmless no-op, as before.
            if (!(currentStatus === OrderStatus.CANCELLED && order_status === OrderStatus.CANCELLED)
                && !(OrderStatusTransitions[currentStatus] || []).includes(order_status)) {
                return res.status(409).json({ error: statusMoveMessage(currentStatus, order_status) });
            }
            // Every dispatch goes through the shipment route so each parcel is recorded.
            if (order_status === OrderStatus.DISPATCHED || order_status === OrderStatus.PARTIALLY_DISPATCHED) {
                return res.status(409).json({ error: 'Use the Dispatch form to send pieces' });
            }
            if (order_status === OrderStatus.COMPLETED) {
                return res.status(409).json({ error: 'Use Mark completed' });
            }
            let cancelReason = null;
            if (order_status === OrderStatus.CANCELLED && currentStatus !== OrderStatus.CANCELLED) {
                cancelReason = String(req.body.cancel_reason ?? '').trim();
                if (cancelReason.length < 3 || cancelReason.length > 500) {
                    return res.status(400).json({ error: 'Please give a reason for cancelling (3 to 500 characters).' });
                }
            }
            if (order_status === OrderStatus.PROCESSED && currentStatus !== OrderStatus.PROCESSED) {
                order.processed_by = user ? user.user_id : null;
                order.processed_at = new Date();
            }
            // Reverse stock only when an order first transitions INTO cancelled,
            // not on a cancelled -> cancelled no-op (which would reverse twice).
            if (order_status === OrderStatus.CANCELLED && currentStatus !== OrderStatus.CANCELLED) {
                // Two people can press Cancel at the same moment. Lock the order row and
                // read its status again INSIDE the transaction: the second request waits
                // here, then sees "cancelled" and returns the stock zero times, not twice.
                const cancelledAt = new Date();
                order.cancel_reason = cancelReason;
                order.cancelled_by = user ? user.user_id : null;
                order.cancelled_at = cancelledAt;
                const outcome = await sequelize.transaction(async (transaction) => {
                    const locked = await Order.findOne({
                        where: { order_id: order.order_id },
                        transaction,
                        lock: transaction.LOCK.UPDATE,
                    });
                    if (!locked || locked.order_status === OrderStatus.CANCELLED) return 'already';
                    const sent = Number(await OrderShipment.sum('qty', { where: { order_id: locked.order_id }, transaction })) || 0;
                    const inTransit = await TrayReturnTask.count({
                        where: { order_id: locked.order_id, status: 'in_transit' },
                        transaction,
                    });
                    if (inTransit > 0) return 'in_transit';
                    if (sent > 0) {
                        // Part of the order was already sent: cancel only the unsent pieces.
                        // The sent pieces are not touched; the order then counts as dispatched
                        // (everything left is resolved) and can be marked completed.
                        const totalQty = sumItemQty(locked.order_items);
                        const unsent = totalQty - sent - (Number(locked.cancelled_qty) || 0);
                        if (unsent < 1) return 'nothing_left';
                        const { restoredQty } = await reverseOrderOperation(locked.order_id, transaction, req.user, {
                            shippedByProduct: allocateShipped(locked.order_items, sent),
                        });
                        await cancelTrayTasks(locked, transaction);
                        const before = locked.toJSON();
                        locked.order_status = OrderStatus.DISPATCHED;
                        locked.cancelled_qty = (Number(locked.cancelled_qty) || 0) + unsent;
                        locked.cancel_reason = cancelReason;
                        locked.cancelled_by = user ? user.user_id : null;
                        locked.cancelled_at = cancelledAt;
                        if (!locked.dispatched_at) locked.dispatched_at = cancelledAt;
                        locked.updated_at = new Date();
                        await locked.save({ transaction });
                        await logAudit({
                            req,
                            transaction,
                            action: 'update',
                            description: `Order partly cancelled: ${unsent} of ${totalQty} pieces cancelled, ${sent} already sent, ${restoredQty} returned to stock`,
                            tableName: 'order',
                            recordId: locked.order_id,
                            oldValues: before,
                            newValues: locked,
                        });
                        return 'partial';
                    }
                    await reverseOrderOperation(locked.order_id, transaction, req.user);
                    await cancelTrayTasks(locked, transaction);
                    locked.order_status = OrderStatus.CANCELLED;
                    locked.cancel_reason = cancelReason;
                    locked.cancelled_by = user ? user.user_id : null;
                    locked.cancelled_at = cancelledAt;
                    locked.updated_at = new Date();
                    await locked.save({ transaction });
                    return 'done';
                });
                if (outcome === 'already') {
                    return res.status(409).json({ error: 'This order was just cancelled by someone else.' });
                }
                if (outcome === 'in_transit') {
                    return res.status(409).json({ error: 'A tray parcel for this order is on its way. Wait until the office marks it received, then cancel.' });
                }
                if (outcome === 'nothing_left') {
                    return res.status(409).json({ error: 'All pieces of this order were already sent or cancelled, so there is nothing left to cancel.' });
                }
                if (outcome === 'partial') {
                    const fresh = await Order.findOne({ where: { order_id: order.order_id } });
                    return res.status(200).json(await decorateOrder(fresh));
                }
            }
            order.order_status = order_status;
            order.updated_at = new Date();
            await order.save();
            await logAudit({
                req,
                action: 'update',
                description: 'Order status updated',
                tableName: 'order',
                recordId: order.order_id,
                oldValues: oldSnapshot,
                newValues: order,
            });
            res.status(200).json(await decorateOrder(order));
        }
        catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ error: 'Failed to update order status' });
        }
    }

    // POST /:id/dispatch  { courier_name, courier_tracking_number, qty? }
    // Records one shipment. Can be called again for the remaining pieces.
    async dispatchOrder(req, res) {
        try {
            if (!canManageOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const { id } = req.params;
            const courierName = String(req.body?.courier_name ?? '').trim();
            const trackingNumber = String(req.body?.courier_tracking_number ?? '').trim();
            if (!courierName || !trackingNumber) {
                return res.status(400).json({ error: 'Courier name and tracking number are required' });
            }
            if (courierName.length > 255 || trackingNumber.length > 255) {
                return res.status(400).json({ error: 'Courier name and tracking number must be 255 characters or fewer' });
            }
            const rawQty = req.body?.qty;
            const qtyGiven = rawQty !== undefined && rawQty !== null && rawQty !== '';
            const wantedQty = qtyGiven ? Number(rawQty) : null;
            if (qtyGiven && (!Number.isInteger(wantedQty) || wantedQty < 1)) {
                return res.status(400).json({ error: 'Quantity must be a whole number, 1 or more.' });
            }
            const exists = await Order.findOne({ where: { order_id: id }, attributes: ['order_id'] });
            if (!exists) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const result = await sequelize.transaction(async (transaction) => {
                // Lock the order so two people dispatching at once cannot send the same pieces twice.
                const order = await Order.findOne({ where: { order_id: id }, transaction, lock: transaction.LOCK.UPDATE });
                if (!order) return { status: 404, error: 'Order not found' };
                const currentStatus = order.order_status;
                if (![OrderStatus.PROCESSED, OrderStatus.HOLD_BY_TRAY, OrderStatus.PARTIALLY_DISPATCHED].includes(currentStatus)) {
                    return { status: 409, error: `This order is ${statusLabel(currentStatus)}, so pieces cannot be dispatched.` };
                }
                const fig = await decorateOrder(order, { transaction });
                const qty = qtyGiven ? wantedQty : fig.ready_qty;
                if (fig.ready_qty < 1) {
                    return fig.held_qty > 0
                        ? { status: 409, error: `No pieces are ready yet. All ${fig.held_qty} remaining are held by sample tray.` }
                        : { status: 400, error: 'There are no pieces left to dispatch.' };
                }
                if (qty > fig.ready_qty) {
                    return fig.held_qty > 0
                        ? { status: 409, error: `Only ${fig.ready_qty} pieces are ready. The other ${fig.held_qty} are held by sample tray.` }
                        : { status: 400, error: `Only ${fig.ready_qty} pieces are left to dispatch.` };
                }
                const oldSnapshot = order.toJSON();
                const now = new Date();
                await OrderShipment.create({
                    order_id: order.order_id,
                    courier_name: courierName,
                    tracking_number: trackingNumber,
                    qty,
                    shipped_at: now,
                    created_by: req.user ? req.user.user_id : null,
                }, { transaction });
                const shippedTotal = fig.shipped_qty + qty;
                const allSent = fig.total_qty - shippedTotal <= 0;
                order.courier_name = courierName;
                order.courier_tracking_number = trackingNumber;
                order.partial_dispatch_qty = shippedTotal;
                order.order_status = allSent ? OrderStatus.DISPATCHED : OrderStatus.PARTIALLY_DISPATCHED;
                if (allSent) order.dispatched_at = now;
                order.updated_at = now;
                await order.save({ transaction });
                await logAudit({
                    req,
                    transaction,
                    action: 'update',
                    description: `Order dispatched: ${qty} pieces via ${courierName} (${trackingNumber})`,
                    tableName: 'order',
                    recordId: order.order_id,
                    oldValues: oldSnapshot,
                    newValues: order,
                });
                return { status: 200, body: await decorateOrder(order, { transaction }) };
            });
            if (result.error) return res.status(result.status).json({ error: result.error });
            res.status(200).json(result.body);
        } catch (error) {
            console.error('Error dispatching order:', error);
            res.status(500).json({ error: 'Failed to dispatch order' });
        }
    }

    // GET /tray-tasks?status=open|all  Salesman: own tasks. Admin / order manager / tray manager: all.
    async getTrayTasks(req, res) {
        try {
            const roles = req.userRoleNames;
            const where = {};
            if (!hasRole(roles, TRAY_RETURN_ROLES)) {
                if (!hasRole(roles, ['salesman'])) return res.status(403).json({ error: 'Access denied' });
                const sm = await Salesman.findOne({ where: { user_id: req.user.user_id }, attributes: ['salesman_id'] });
                if (!sm) return res.status(200).json([]);
                where.salesman_id = sm.salesman_id;
            }
            if (String(req.query.status || '').toLowerCase() === 'open') where.status = ['booked', 'in_transit'];
            const tasks = await TrayReturnTask.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
            if (!tasks.length) return res.status(200).json([]);
            const names = await taskNameMaps(tasks);
            const orderIds = [...new Set(tasks.map((t) => t.order_id))];
            const orders = await Order.findAll({
                where: { order_id: orderIds },
                attributes: ['order_id', 'order_number', 'party_id'],
                include: [orderPartyInclude],
            });
            const orderMap = {};
            orders.forEach((o) => { orderMap[o.order_id] = o; });
            res.status(200).json(tasks.map((t) => {
                const o = orderMap[t.order_id];
                return {
                    ...shapeTask(t, names),
                    order_id: t.order_id,
                    order_number: o ? o.order_number : null,
                    party_name: o && o.party ? o.party.party_name : null,
                    created_at: t.created_at,
                };
            }));
        } catch (error) {
            console.error('Error loading tray tasks:', error);
            res.status(500).json({ error: 'Failed to load tray tasks' });
        }
    }

    // POST /tray-tasks/:taskId/in-transit  { courier_name, tracking_number }
    async trayTaskInTransit(req, res) {
        try {
            const roles = req.userRoleNames;
            const isOffice = hasRole(roles, TRAY_RETURN_ROLES);
            if (!isOffice && !hasRole(roles, ['salesman'])) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const courier = String(req.body?.courier_name ?? '').trim();
            const tracking = String(req.body?.tracking_number ?? '').trim();
            if (!courier || !tracking) {
                return res.status(400).json({ error: 'Courier name and tracking number are required' });
            }
            if (courier.length > 255 || tracking.length > 255) {
                return res.status(400).json({ error: 'Courier name and tracking number must be 255 characters or fewer' });
            }
            const result = await sequelize.transaction(async (transaction) => {
                const task = await TrayReturnTask.findOne({ where: { task_id: req.params.taskId }, transaction, lock: transaction.LOCK.UPDATE });
                if (!task) return { status: 404, error: 'Task not found' };
                if (!isOffice) {
                    const sm = await Salesman.findOne({ where: { user_id: req.user.user_id }, attributes: ['salesman_id'], transaction });
                    if (!sm || sm.salesman_id !== task.salesman_id) {
                        return { status: 403, error: 'This task belongs to another salesman.' };
                    }
                }
                if (task.status !== 'booked') {
                    return { status: 409, error: task.status === 'in_transit'
                        ? 'This parcel is already marked in transit.'
                        : `This task is ${task.status}, so it cannot be sent.` };
                }
                const old = task.toJSON();
                task.status = 'in_transit';
                task.courier_name = courier;
                task.tracking_number = tracking;
                task.in_transit_at = new Date();
                task.updated_at = new Date();
                await task.save({ transaction });
                const ord = await Order.findOne({ where: { order_id: task.order_id }, attributes: ['order_id', 'order_number'], transaction });
                const tray = task.tray_id ? await Tray.findOne({ where: { tray_id: task.tray_id }, attributes: ['tray_name'], transaction }) : null;
                await notify({
                    transaction, targetRole: 'office',
                    title: 'Frames in transit',
                    message: `${task.qty} pieces from ${tray ? tray.tray_name : 'a tray'} are in transit (${courier}, ${tracking}). Mark received when they arrive.`,
                    kind: 'tray_in_transit', orderId: task.order_id,
                });
                await logAudit({
                    req, transaction, action: 'update',
                    description: `Tray frames sent back for order ${ord ? ord.order_number : ''}: ${task.qty} pieces via ${courier} (${tracking})`,
                    tableName: 'tray_return_tasks', recordId: task.task_id, oldValues: old, newValues: task,
                });
                return { status: 200, task };
            });
            if (result.error) return res.status(result.status).json({ error: result.error });
            const names = await taskNameMaps([result.task]);
            res.status(200).json(shapeTask(result.task, names));
        } catch (error) {
            console.error('Error marking tray task in transit:', error);
            res.status(500).json({ error: 'Failed to update the tray task' });
        }
    }

    // POST /tray-tasks/:taskId/received  Office has the parcel.
    async trayTaskReceived(req, res) {
        try {
            if (!canManageOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const result = await sequelize.transaction(async (transaction) => {
                const task = await TrayReturnTask.findOne({ where: { task_id: req.params.taskId }, transaction, lock: transaction.LOCK.UPDATE });
                if (!task) return { status: 404, error: 'Task not found' };
                if (task.status !== 'in_transit') {
                    return { status: 409, error: task.status === 'booked'
                        ? 'The salesman has not sent this parcel yet.'
                        : `This task is already ${task.status}.` };
                }
                const order = await Order.findOne({ where: { order_id: task.order_id }, transaction, lock: transaction.LOCK.UPDATE });
                if (!order || order.order_status === OrderStatus.CANCELLED) {
                    return { status: 409, error: 'This order is cancelled.' };
                }
                const old = task.toJSON();
                task.status = 'received';
                task.received_at = new Date();
                task.received_by = req.user ? req.user.user_id : null;
                task.updated_at = new Date();
                await task.save({ transaction });

                // Stock was already moved from the tray to this order when it was placed (product
                // tray_qty and the tray's own qty went down then). Nothing is deducted again here;
                // the history line below only records that the frames reached the office.
                const tray = task.tray_id ? await Tray.findOne({ where: { tray_id: task.tray_id }, attributes: ['tray_name'], transaction }) : null;
                const trayName = tray ? tray.tray_name : 'tray';
                const note = `Received from ${trayName}: reserved in warehouse for order ${order.order_number}`;
                const product = task.product_id ? await Product.findOne({ where: { product_id: task.product_id }, transaction }) : null;
                if (product) {
                    await recordStockMove({
                        transaction, productId: product.product_id,
                        warehouseAfter: product.warehouse_qty, trayAfter: product.tray_qty,
                        kind: 'tray', dWarehouse: 0, dTray: 0, user: req.user, reference: order.order_number, note,
                    });
                }
                await logAudit({
                    req, transaction, action: 'update',
                    description: `${note} (${task.qty} pieces, ${task.courier_name || ''} ${task.tracking_number || ''})`.trim(),
                    tableName: 'tray_return_tasks', recordId: task.task_id, oldValues: old, newValues: task,
                });

                const all = await TrayReturnTask.findAll({ where: { order_id: order.order_id }, transaction });
                const live = all.filter((t) => t.status !== 'cancelled');
                if (live.length && live.every((t) => t.status === 'received')) {
                    const total = live.reduce((s, t) => s + (Number(t.qty) || 0), 0);
                    await notify({
                        transaction, targetRole: 'office',
                        title: 'Ready to dispatch',
                        message: `All ${total} tray pieces of order ${order.order_number} were received. Ready to dispatch.`,
                        kind: 'ready_to_dispatch', orderId: order.order_id,
                    });
                }
                return { status: 200, task };
            });
            if (result.error) return res.status(result.status).json({ error: result.error });
            const names = await taskNameMaps([result.task]);
            res.status(200).json(shapeTask(result.task, names));
        } catch (error) {
            console.error('Error marking tray task received:', error);
            res.status(500).json({ error: 'Failed to update the tray task' });
        }
    }

    // POST /:id/complete  { received_by? }  Dispatched -> completed.
    async completeOrder(req, res) {
        try {
            if (!canManageOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const { id } = req.params;
            const receivedBy = String(req.body?.received_by ?? '').trim();
            if (receivedBy.length > 255) {
                return res.status(400).json({ error: 'Received by must be 255 characters or fewer' });
            }
            const result = await sequelize.transaction(async (transaction) => {
                const order = await Order.findOne({ where: { order_id: id }, transaction, lock: transaction.LOCK.UPDATE });
                if (!order) return { status: 404, error: 'Order not found' };
                if (!(OrderStatusTransitions[order.order_status] || []).includes(OrderStatus.COMPLETED)
                    || order.order_status !== OrderStatus.DISPATCHED) {
                    return { status: 409, error: 'Only a fully dispatched order can be marked completed.' };
                }
                const oldSnapshot = order.toJSON();
                order.order_status = OrderStatus.COMPLETED;
                order.delivered_at = new Date();
                order.received_by = receivedBy || null;
                order.updated_at = new Date();
                await order.save({ transaction });
                await logAudit({
                    req,
                    transaction,
                    action: 'update',
                    description: 'Order marked completed',
                    tableName: 'order',
                    recordId: order.order_id,
                    oldValues: oldSnapshot,
                    newValues: order,
                });
                return { status: 200, body: await decorateOrder(order, { transaction }) };
            });
            if (result.error) return res.status(result.status).json({ error: result.error });
            res.status(200).json(result.body);
        } catch (error) {
            console.error('Error completing order:', error);
            res.status(500).json({ error: 'Failed to mark order completed' });
        }
    }

    async deleteOrder(req, res) {
        try {
            if (!canManageOrders(req.userRoleNames)) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Order ID is required' });
            }
            const order = await Order.findOne({ where: { order_id: id } });
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }
            // Lock the order and re-read its status inside the transaction so a double click
            // (or a cancel at the same moment) cannot return the stock twice.
            const alreadyGone = await sequelize.transaction(async (transaction) => {
                const locked = await Order.findOne({
                    where: { order_id: order.order_id },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!locked) return true;
                if (locked.order_status !== OrderStatus.CANCELLED && locked.order_status !== OrderStatus.COMPLETED) {
                    await reverseOrderOperation(locked.order_id, transaction, req.user);
                }
                return false;
            });
            if (alreadyGone) {
                return res.status(404).json({ error: 'Order not found' });
            }
            const snapshot = order.toJSON();
            // Clear the rows that reference this order before deleting it,
            // otherwise the FK constraints block the delete (the generic 500):
            //  - salesman_check_ins: a visit order is created from a check-in;
            //    keep the visit record but drop the order link (order_id is nullable).
            //  - order_operation: usually removed by the reversal above, but a
            //    cancelled/completed order skips that, so clear any leftovers.
            await SalesmanCheckIns.update({ order_id: null, type: SalesmanCheckInType.VISIT }, { where: { order_id: order.order_id } });
            await OrderOperation.destroy({ where: { order_id: order.order_id } });
            await order.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Order deleted',
                tableName: 'order',
                recordId: order.order_id,
                oldValues: snapshot,
                newValues: null,
            });
            return res.status(200).json({ message: 'Order deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting order:', error);
            res.status(500).json({ error: error.message || 'Failed to delete order' });
        }
    }

    /**
     * Price preview for the cart. Body: { order_items:[{product_id, quantity}],
     * offer_id? }. Computes subtotal/discount/total off WHP using the SAME
     * pricing as createOrder, without creating an order or touching stock.
     */
    async quoteOrder(req, res) {
        try {
            const { order_items, offer_id } = req.body;
            if (!Array.isArray(order_items) || order_items.length === 0) {
                return res.status(400).json({ error: 'order_items are required' });
            }
            const ids = [...new Set(order_items.map(i => String(i.product_id)).filter(Boolean))];
            const products = ids.length ? await Product.findAll({ where: { product_id: ids } }) : [];
            const priceById = new Map(products.map(p => [String(p.product_id), parseFloat(p.whp) || 0]));

            const resolvedItems = order_items
                .filter(i => priceById.has(String(i.product_id)))
                .map(i => ({
                    product_id: String(i.product_id),
                    quantity: Number(i.quantity) || 0,
                    price: priceById.get(String(i.product_id)),
                }));
            if (resolvedItems.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
                return res.status(400).json({ error: 'Quantity must be a whole number, 1 or more.' });
            }
            {
                const merged = new Map();
                for (const it of resolvedItems) {
                    const prev = merged.get(it.product_id);
                    if (prev) prev.quantity += it.quantity;
                    else merged.set(it.product_id, it);
                }
                resolvedItems.splice(0, resolvedItems.length, ...merged.values());
            }

            const offerLines = resolvedItems.map(i => ({ product_id: i.product_id, qty: i.quantity, unit_price: i.price }));
            let offer = null;
            if (offer_id) {
                const candidate = await Offer.findOne({ where: { offer_id } });
                if (candidate && isOfferActive(candidate) && offerScopeMatches(candidate, offerLines)) {
                    offer = candidate;
                }
            }
            const priced = applyOfferToItems(offer, resolvedItems);
            res.status(200).json({
                subtotal: priced.subtotal,
                discount_total: priced.discountTotal,
                order_total: priced.orderTotal,
                applied_offer: priced.appliedOffer,
                lines: priced.pricedItems,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

}

const orderController = new OrderController();
module.exports = orderController;