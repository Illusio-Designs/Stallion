// Retail orders: pricing, stock, order creation, tracking and the admin status flow.
// Prices and stock always come from retail_products; nothing the browser sends about money is trusted.
const { Op, fn, col } = require('sequelize');
const sequelize = require('../../constants/database');
const RetailProduct = require('../models/RetailProduct');
const RetailOrder = require('../models/RetailOrder');
const RetailOrderItem = require('../models/RetailOrderItem');
const RetailOrderEvent = require('../models/RetailOrderEvent');
const RetailCustomer = require('../models/RetailCustomer');
const RetailCounter = require('../models/RetailCounter');
const RetailVisit = require('../models/RetailVisit');
const { getSetting } = require('./settings');
const { getShippingConfig, computeFees, resolveState } = require('./shippingService');
const Notification = require('../../models/Notification');
const { logAudit } = require('../../utils/auditLogger');
const { HttpError } = require('./http');
const { parseFilterDate, istStartOfDay, istStartOfDaysAgo } = require('./istTime');
const {
    cleanText, normalizePhone, isValidPhone, normalizePincode, isValidPincode, isUuid, isSessionId, isEmail,
    toPaise, fromPaise, resolveSource,
} = require('./validators');

const ORDER_NUMBER_PREFIX = 'WEB-';
const ORDER_NUMBER_BASE = 1000;   // the first order is WEB-1001
const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 10;
const COUNTER_NAME = 'order_number';

// ---- statuses -----------------------------------------------------------------------------------------------
const FLOW = ['pending', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
const STATUSES = [...FLOW, 'cancelled', 'returned'];
const CANCELLABLE = ['pending', 'confirmed', 'packed'];            // once it has left the shop it can only come back as 'returned'
const RETURNABLE = ['dispatched', 'out_for_delivery', 'delivered'];

// Allowed next statuses: forward along the flow (steps may be skipped), cancel before dispatch, return after dispatch.
function allowedNext(status) {
    const i = FLOW.indexOf(status);
    if (i === -1) return [];
    const next = FLOW.slice(i + 1);
    if (CANCELLABLE.includes(status)) next.push('cancelled');
    if (RETURNABLE.includes(status)) next.push('returned');
    return next;
}

// ---- small helpers ------------------------------------------------------------------------------------------
const money = (v) => Number(v) || 0;
const iso = (d) => (d ? new Date(d).toISOString() : null);

function firstImage(images) {
    let list = images;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch (_e) { list = null; } }
    return Array.isArray(list) && list.length ? String(list[0]) : null;
}
const productTitle = (p) => p.title || p.model_no;

const isDeadlock = (err) => {
    const code = (err && (err.parent || err.original || err).code) || '';
    return code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT' || code === 'SQLITE_BUSY';
};

// Run a transaction, retrying when MySQL picks it as a deadlock victim. HttpErrors are answers, not failures.
async function inTransaction(work, attempts = 3) {
    for (let i = 1; ; i += 1) {
        try {
            return await sequelize.transaction(work);
        } catch (err) {
            if (i >= attempts || !isDeadlock(err)) throw err;
            await new Promise((r) => setTimeout(r, 30 * i + Math.random() * 40));
        }
    }
}

// ---- cart input ---------------------------------------------------------------------------------------------
// [{ product_id, quantity }] -> merged lines. Same product twice becomes one line.
function parseCartItems(raw) {
    if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'Your cart is empty.');
    if (raw.length > MAX_LINES * 2) throw new HttpError(400, 'Too many items in the cart.');
    const merged = new Map();
    for (const it of raw) {
        const id = it && typeof it.product_id === 'string' ? it.product_id.trim() : '';
        const qty = Number(it && it.quantity);
        if (!isUuid(id)) throw new HttpError(400, 'One of the items is not valid. Please refresh your cart.');
        if (!Number.isInteger(qty) || qty < 1) throw new HttpError(400, 'Quantity must be a whole number, at least 1.');
        merged.set(id.toLowerCase(), (merged.get(id.toLowerCase()) || 0) + qty);
    }
    if (merged.size > MAX_LINES) throw new HttpError(400, `You can order up to ${MAX_LINES} different frames at a time.`);
    const lines = [...merged].map(([product_id, quantity]) => ({ product_id, quantity }));
    if (lines.some((l) => l.quantity > MAX_QTY_PER_LINE)) {
        throw new HttpError(400, `You can order up to ${MAX_QTY_PER_LINE} of one frame. For bulk orders please contact us.`);
    }
    return lines;
}

// Load the products of a cart. With a transaction the rows are locked (FOR UPDATE) in id order, the same order
// everywhere, so two carts that share frames can never wait on each other in a circle.
async function loadProducts(lines, transaction) {
    const ids = lines.map((l) => l.product_id);
    const rows = await RetailProduct.findAll({
        where: { id: ids },
        order: [['id', 'ASC']],
        ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    return new Map(rows.map((p) => [p.id.toLowerCase(), p]));
}

// Price the cart from the database. Returns priced lines (sellable ones) and the issues found.
function priceLines(lines, products) {
    const priced = [];
    const issues = [];
    for (const l of lines) {
        const p = products.get(l.product_id);
        if (!p || !p.is_active || !p.show_on_store) {
            issues.push({ product_id: l.product_id, code: 'inactive', message: 'This frame is no longer available.' });
            continue;
        }
        const stock = Math.max(0, Number(p.stock) || 0);
        if (stock <= 0) {
            issues.push({ product_id: l.product_id, code: 'out_of_stock', message: `${productTitle(p)} is out of stock.` });
        } else if (stock < l.quantity) {
            issues.push({ product_id: l.product_id, code: 'limited_stock', message: `Only ${stock} left of ${productTitle(p)}.` });
        }
        const pricePaise = toPaise(p.mrp);
        priced.push({ product: p, quantity: l.quantity, pricePaise, linePaise: pricePaise * l.quantity, stock });
    }
    return { priced, issues };
}

// ---- quote --------------------------------------------------------------------------------------------------
async function quote(body) {
    const lines = parseCartItems(body.items);
    const paymentType = body.payment_type == null ? 'cod' : body.payment_type;
    if (paymentType !== 'cod') throw new HttpError(400, 'Only cash on delivery is available right now.');
    const shippingOption = body.shipping_option == null ? 'standard' : String(body.shipping_option);
    const pincode = normalizePincode(body.pincode);

    const [config, products] = await Promise.all([getShippingConfig(), loadProducts(lines)]);
    const { priced, issues } = priceLines(lines, products);
    const subtotalPaise = priced.reduce((s, l) => s + l.linePaise, 0);

    let fees;
    try {
        fees = computeFees(config, { pincode, state: await resolveState(body.state), subtotalPaise, shippingOption, paymentType });
    } catch (err) {
        throw new HttpError(err.code === 'unserviceable' ? 422 : 400, err.message, { code: err.code });
    }
    const shippingPaise = priced.length ? fees.shippingPaise : 0;
    const codPaise = priced.length ? fees.codPaise : 0;

    return {
        items: priced.map((l) => ({
            product_id: l.product.id,
            title: productTitle(l.product),
            image: firstImage(l.product.images),
            price: fromPaise(l.pricePaise),
            quantity: l.quantity,
            line_total: fromPaise(l.linePaise),
            available_stock: l.stock,
        })),
        subtotal: fromPaise(subtotalPaise),
        shipping_fee: fromPaise(shippingPaise),
        cod_fee: fromPaise(codPaise),
        total: fromPaise(subtotalPaise + shippingPaise + codPaise),
        issues,
    };
}

// ---- create order -------------------------------------------------------------------------------------------
// Check the form. Every problem is collected so the storefront can mark all the fields at once.
function validateOrderInput(body) {
    const errors = {};
    const c = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const a = body.address && typeof body.address === 'object' ? body.address : {};

    const name = cleanText(c.name, 120);
    if (!name || name.length < 2) errors['customer.name'] = 'Please enter your name.';
    const phone = normalizePhone(c.phone);
    if (!isValidPhone(phone)) errors['customer.phone'] = 'Please enter a valid 10-digit mobile number.';
    let email = cleanText(c.email, 190);
    if (email && !isEmail(email)) errors['customer.email'] = 'Please enter a valid email address or leave it empty.';
    email = email ? email.toLowerCase() : null;

    const line1 = cleanText(a.line1, 255);
    if (!line1 || line1.length < 3) errors['address.line1'] = 'Please enter your address.';
    const city = cleanText(a.city, 100);
    if (!city) errors['address.city'] = 'Please enter your city.';
    const state = cleanText(a.state, 100);
    if (!state) errors['address.state'] = 'Please select your state.';
    const pincode = normalizePincode(a.pincode);
    if (!isValidPincode(pincode)) errors['address.pincode'] = 'Please enter a valid 6-digit pincode.';

    if (body.payment_type != null && body.payment_type !== 'cod') errors.payment_type = 'Only cash on delivery is available right now.';
    const shippingOption = body.shipping_option == null ? 'standard' : String(body.shipping_option);
    if (!['standard', 'express'].includes(shippingOption)) errors.shipping_option = 'Please choose a delivery option.';

    if (Object.keys(errors).length) {
        throw new HttpError(400, Object.values(errors)[0], { errors });
    }

    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
    return {
        name, phone, email,
        address: { line1, line2: cleanText(a.line2, 255), city, state, pincode },
        paymentType: 'cod',
        shippingOption,
        notes: cleanText(body.notes, 500),
        sessionId: isSessionId(body.session_id) ? body.session_id : null,
        utm: {
            source: cleanText(utm.source, 150), medium: cleanText(utm.medium, 150), campaign: cleanText(utm.campaign, 150),
            term: cleanText(utm.term, 150), content: cleanText(utm.content, 150),
        },
        consent: body.consent === true,
    };
}

// Next WEB-number. Must run inside the order transaction: the counter row is locked until commit, so numbers are
// unique, strictly sequential, and a rolled-back order does not burn one.
let counterReady = false;
async function ensureCounter() {
    if (counterReady) return;
    try {
        await RetailCounter.findOrCreate({ where: { name: COUNTER_NAME }, defaults: { value: ORDER_NUMBER_BASE } });
    } catch (err) {
        if (err.name !== 'SequelizeUniqueConstraintError') throw err; // another request created it first: fine
    }
    counterReady = true;
}

async function nextOrderNumber(transaction) {
    const row = await RetailCounter.findByPk(COUNTER_NAME, { transaction, lock: transaction.LOCK.UPDATE });
    const next = Number(row.value) + 1;
    await row.update({ value: next }, { transaction });
    return `${ORDER_NUMBER_PREFIX}${next}`;
}

// Source of an order: explicit utm_source, else how the same browser session first arrived, else direct.
async function resolveOrderSource(utmSource, sessionId) {
    if (utmSource) return resolveSource(utmSource, null);
    if (sessionId) {
        const v = await RetailVisit.findOne({ where: { session_id: sessionId }, order: [['created_at', 'ASC']], attributes: ['source'] });
        if (v) return v.source;
    }
    return 'direct';
}

// Create or refresh the customer row for this phone (inside the order transaction).
async function touchCustomer(input, totalPaise, now, transaction) {
    const find = () => RetailCustomer.findOne({ where: { phone: input.phone }, transaction, lock: transaction.LOCK.UPDATE });
    let customer = await find();
    if (!customer) {
        try {
            customer = await RetailCustomer.create({ phone: input.phone, name: input.name, email: input.email, first_order_at: now }, { transaction });
        } catch (err) {
            if (err.name !== 'SequelizeUniqueConstraintError') throw err;
            customer = await find(); // a parallel order for the same phone created it first
        }
    }
    await customer.update({
        name: input.name,
        email: input.email || customer.email,
        marketing_consent: input.consent || customer.marketing_consent,
        order_count: customer.order_count + 1,
        total_spent: fromPaise(toPaise(customer.total_spent) + totalPaise),
        first_order_at: customer.first_order_at || now,
        last_order_at: now,
    }, { transaction });
    return customer;
}

/**
 * Place an order. ONE transaction: lock the frames, check stock, create order + items + first timeline row,
 * deduct stock, count the sale. Anything that is not part of that (tracking, notifications) must run after commit.
 */
async function createOrder(body) {
    const input = validateOrderInput(body);
    const lines = parseCartItems(body.items);

    // Read settings and work out the traffic source before the transaction so locks are held as briefly as possible.
    const [config, storeEnabled] = await Promise.all([getShippingConfig(), getSetting('store_enabled', true)]);
    if (storeEnabled === false) throw new HttpError(503, 'The store is not taking orders right now. Please try again later.');
    // The state must be one of Stallion's `states` (when that table is filled); the official spelling is stored.
    const stateInfo = await resolveState(input.address.state);
    if (!stateInfo.known && stateInfo.tableFilled) {
        throw new HttpError(400, 'Please select a valid state.', { errors: { 'address.state': 'Please select a valid state.' } });
    }
    input.address.state = stateInfo.name;
    const source = await resolveOrderSource(input.utm.source, input.sessionId);
    await ensureCounter();

    const result = await inTransaction(async (t) => {
        const products = await loadProducts(lines, t);
        const { priced, issues } = priceLines(lines, products);
        if (issues.length) {
            throw new HttpError(422, 'Some items in your cart changed. Please review your cart.', { issues });
        }

        const subtotalPaise = priced.reduce((s, l) => s + l.linePaise, 0);
        let fees;
        try {
            fees = computeFees(config, {
                pincode: input.address.pincode, state: stateInfo, subtotalPaise,
                shippingOption: input.shippingOption, paymentType: input.paymentType,
            });
        } catch (err) {
            throw new HttpError(err.code === 'unserviceable' ? 422 : 400, err.message, { code: err.code });
        }
        const totalPaise = subtotalPaise + fees.shippingPaise + fees.codPaise;
        const now = new Date();

        // Deduct stock first: the guarded UPDATE (stock >= qty) is the last line of defence against overselling.
        for (const l of priced) {
            const [changed] = await RetailProduct.update(
                { stock: sequelize.literal(`stock - ${l.quantity}`), total_sold: sequelize.literal(`total_sold + ${l.quantity}`) },
                { where: { id: l.product.id, stock: { [Op.gte]: l.quantity } }, transaction: t },
            );
            if (changed !== 1) {
                throw new HttpError(422, 'Some items in your cart changed. Please review your cart.', {
                    issues: [{ product_id: l.product.id, code: 'limited_stock', message: `Only a few left of ${productTitle(l.product)}.` }],
                });
            }
        }

        const customer = await touchCustomer(input, totalPaise, now, t);
        const orderNumber = await nextOrderNumber(t);

        const order = await RetailOrder.create({
            order_number: orderNumber,
            customer_id: customer.id,
            customer_name: input.name,
            customer_phone: input.phone,
            customer_email: input.email,
            address_line1: input.address.line1,
            address_line2: input.address.line2,
            city: input.address.city,
            state: input.address.state,
            pincode: input.address.pincode,
            subtotal: fromPaise(subtotalPaise),
            shipping_fee: fromPaise(fees.shippingPaise),
            cod_fee: fromPaise(fees.codPaise),
            total: fromPaise(totalPaise),
            payment_type: input.paymentType,
            payment_status: 'pending',
            status: 'pending',
            shipping_option: input.shippingOption,
            expected_delivery: fees.expectedDelivery,
            notes: input.notes,
            session_id: input.sessionId,
            source,
            utm_source: input.utm.source,
            utm_medium: input.utm.medium,
            utm_campaign: input.utm.campaign,
            utm_term: input.utm.term,
            utm_content: input.utm.content,
            consent: input.consent,
        }, { transaction: t });

        await RetailOrderItem.bulkCreate(priced.map((l) => ({
            order_id: order.id,
            product_id: l.product.id,
            title: productTitle(l.product),
            model_no: l.product.model_no,
            image: firstImage(l.product.images),
            price: fromPaise(l.pricePaise),
            quantity: l.quantity,
            line_total: fromPaise(l.linePaise),
        })), { transaction: t });

        await RetailOrderEvent.create({
            order_id: order.id, status: 'pending', kind: 'status', note: 'Order placed',
            actor_type: 'customer', actor_name: input.name,
        }, { transaction: t });

        return { order_number: order.order_number, total: money(order.total), status: order.status, customer_name: input.name };
    });

    await notifyOffice(result);
    return { order_number: result.order_number, total: result.total, status: result.status, track_url_hint: `/track?order=${encodeURIComponent(result.order_number)}` };
}

// After commit: tell the office (admin and order manager see target_role 'office' in their bell). A failure here
// must never undo or fail the order, so it is only logged. order_id stays empty: that column links wholesale orders.
async function notifyOffice(order) {
    try {
        await Notification.create({
            target_role: 'office',
            title: 'New web order',
            message: `${order.order_number} from ${order.customer_name}: ₹${order.total} (cash on delivery)`,
            kind: 'retail_order',
            created_at: new Date(),
        });
    } catch (err) {
        console.error('[retail] office notification not saved:', err.message);
    }
}

// ---- customer tracking --------------------------------------------------------------------------------------
const NOT_FOUND_MSG = 'We could not find an order with these details. Please check the order number and phone number.';

/** Order number + phone must both match, otherwise the same 404 whatever was wrong (nothing is leaked). */
async function trackOrder({ order_number: orderNumber, phone }) {
    const number = cleanText(typeof orderNumber === 'string' ? orderNumber : '', 20);
    const digits = normalizePhone(phone);
    if (!number || !isValidPhone(digits)) throw new HttpError(404, NOT_FOUND_MSG);

    const order = await RetailOrder.findOne({
        where: { order_number: number.toUpperCase(), customer_phone: digits },
        include: [
            { model: RetailOrderItem, as: 'items' },
            { model: RetailOrderEvent, as: 'events', where: { kind: 'status' }, required: false },
        ],
    });
    if (!order) throw new HttpError(404, NOT_FOUND_MSG);

    const timeline = [...order.events].sort((a, b) => a.created_at - b.created_at)
        .map((e) => ({ status: e.status, note: e.note, at: iso(e.created_at) }));
    const cancelled = ['cancelled', 'returned'].includes(order.status);
    return {
        order_number: order.order_number,
        status: order.status,
        payment_type: order.payment_type,
        payment_status: order.payment_status,
        subtotal: money(order.subtotal),
        shipping_fee: money(order.shipping_fee),
        cod_fee: money(order.cod_fee),
        total: money(order.total),
        created_at: iso(order.created_at),
        items: order.items.map((i) => ({ title: i.title, image: i.image, price: money(i.price), quantity: i.quantity, line_total: money(i.line_total) })),
        address: { name: order.customer_name, city: order.city, state: order.state, pincode: order.pincode },
        shipment: { courier: order.courier, awb: order.awb, tracking_url: order.tracking_url },
        timeline,
        expected_delivery: cancelled || order.status === 'delivered' ? null : order.expected_delivery,
    };
}

// ---- admin: lists -------------------------------------------------------------------------------------------
const listRow = (o, itemsCount) => ({
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    city: o.city,
    state: o.state,
    total: money(o.total),
    status: o.status,
    payment_type: o.payment_type,
    payment_status: o.payment_status,
    shipping_option: o.shipping_option,
    courier: o.courier,
    awb: o.awb,
    items_count: itemsCount || 0,
    source: o.source,
    created_at: iso(o.created_at),
});

async function listOrders({ status, q, from, to, page, limit, offset }) {
    const where = {};
    if (status) {
        if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
        where.status = status;
    }
    const start = parseFilterDate(from);
    const end = parseFilterDate(to, { endOfDay: true });
    if (start || end) {
        where.created_at = {};
        if (start) where.created_at[Op.gte] = start;
        if (end) where.created_at[Op.lt] = end;
    }
    const term = cleanText(typeof q === 'string' ? q : '', 100);
    if (term) {
        const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
        const digits = term.replace(/\D/g, '');
        where[Op.or] = [
            { order_number: { [Op.like]: like } },
            { customer_name: { [Op.like]: like } },
            ...(digits.length >= 3 ? [{ customer_phone: { [Op.like]: `%${digits}%` } }] : []),
        ];
    }

    const { count, rows } = await RetailOrder.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'ASC']], limit, offset });
    const counts = rows.length
        ? await RetailOrderItem.findAll({
            attributes: ['order_id', [fn('SUM', col('quantity')), 'qty']],
            where: { order_id: rows.map((r) => r.id) },
            group: ['order_id'],
            raw: true,
        })
        : [];
    const byOrder = new Map(counts.map((c) => [c.order_id, Number(c.qty)]));
    return { rows: rows.map((o) => listRow(o, byOrder.get(o.id))), total: count, page, limit };
}

async function summary() {
    const now = new Date();
    const todayStart = istStartOfDay(now);
    const monthStart = istStartOfDaysAgo(30, now);
    const live = { status: { [Op.notIn]: ['cancelled', 'returned'] } };

    const [byStatus, today, month] = await Promise.all([
        RetailOrder.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'n']], group: ['status'], raw: true }),
        RetailOrder.findOne({
            attributes: [[fn('COUNT', col('id')), 'n'], [fn('COALESCE', fn('SUM', col('total')), 0), 'revenue']],
            where: { ...live, created_at: { [Op.gte]: todayStart } }, raw: true,
        }),
        RetailOrder.findOne({
            attributes: [[fn('COUNT', col('id')), 'n'], [fn('COALESCE', fn('SUM', col('total')), 0), 'revenue']],
            where: { ...live, created_at: { [Op.gte]: monthStart } }, raw: true,
        }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.forEach((r) => { counts[r.status] = Number(r.n); });
    return {
        counts,
        orders_today: Number(today.n),
        revenue_today: money(today.revenue),
        orders_30_days: Number(month.n),
        revenue_30_days: money(month.revenue),
    };
}

// ---- admin: one order ---------------------------------------------------------------------------------------
async function getOrder(id) {
    if (!isUuid(id)) throw new HttpError(404, 'Order not found.');
    const order = await RetailOrder.findByPk(id, { include: [{ model: RetailOrderItem, as: 'items' }, { model: RetailOrderEvent, as: 'events' }] });
    if (!order) throw new HttpError(404, 'Order not found.');
    return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        allowed_next: allowedNext(order.status),
        payment_type: order.payment_type,
        payment_status: order.payment_status,
        customer: { id: order.customer_id, name: order.customer_name, phone: order.customer_phone, email: order.customer_email },
        address: { line1: order.address_line1, line2: order.address_line2, city: order.city, state: order.state, pincode: order.pincode },
        subtotal: money(order.subtotal),
        shipping_fee: money(order.shipping_fee),
        cod_fee: money(order.cod_fee),
        total: money(order.total),
        shipping_option: order.shipping_option,
        expected_delivery: order.expected_delivery,
        shipment: { courier: order.courier, awb: order.awb, tracking_url: order.tracking_url },
        notes: order.notes,
        session_id: order.session_id,
        source: order.source,
        utm: { source: order.utm_source, medium: order.utm_medium, campaign: order.utm_campaign, term: order.utm_term, content: order.utm_content },
        consent: order.consent,
        stock_returned: order.stock_returned,
        created_at: iso(order.created_at),
        delivered_at: iso(order.delivered_at),
        cancelled_at: iso(order.cancelled_at),
        items: order.items.sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)).map((i) => ({
            id: i.id, product_id: i.product_id, title: i.title, model_no: i.model_no, image: i.image,
            price: money(i.price), quantity: i.quantity, line_total: money(i.line_total),
        })),
        timeline: order.events.sort((a, b) => a.created_at - b.created_at).map((e) => ({
            id: e.id, status: e.status, kind: e.kind, note: e.note, actor_type: e.actor_type, actor_name: e.actor_name, at: iso(e.created_at),
        })),
    };
}

// Admin changes also go to the shared audit log (existing util). Written after commit; never blocks the change.
async function auditChange(req, orderId, description, oldValues, newValues) {
    try {
        await logAudit({ req, action: 'update', description, tableName: 'retail_orders', recordId: orderId, oldValues, newValues });
    } catch (err) {
        console.error('[retail] audit log not written:', err.message);
    }
}

const actorOf = (user) => ({
    actor_type: 'admin',
    actor_id: user && user.user_id ? user.user_id : null,
    actor_name: user ? String(user.full_name || user.email || user.phone || 'Admin').slice(0, 120) : 'Admin',
});

/**
 * Move an order to a new status (admin). Validates the transition, writes the timeline row, and on cancel gives
 * the stock back. The order row is locked first, so two clicks (or two admins) can never return stock twice.
 */
async function changeStatus(id, { status, note }, req) {
    const user = req.user;
    if (!isUuid(id)) throw new HttpError(404, 'Order not found.');
    if (!STATUSES.includes(status)) throw new HttpError(400, `Status must be one of: ${STATUSES.join(', ')}.`);
    const cleanNote = cleanText(note, 500);

    let before;
    await inTransaction(async (t) => {
        const order = await RetailOrder.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!order) throw new HttpError(404, 'Order not found.');
        before = order.status;
        const allowed = allowedNext(order.status);
        if (!allowed.includes(status)) {
            const hint = allowed.length ? `It can move to: ${allowed.join(', ')}.` : 'No further changes are possible.';
            throw new HttpError(409, `This order is ${order.status} and cannot be set to ${status}. ${hint}`, { allowed_next: allowed });
        }

        const now = new Date();
        const patch = { status };
        if (status === 'delivered') {
            patch.delivered_at = now;
            patch.payment_status = 'paid'; // cash is collected by the courier on delivery
        }

        if (status === 'cancelled') {
            patch.cancelled_at = now;
            patch.payment_status = 'cancelled';
            if (!order.stock_returned) {
                const items = await RetailOrderItem.findAll({ where: { order_id: order.id }, order: [['product_id', 'ASC']], transaction: t });
                // lock the frames in id order (same as order creation) before putting stock back
                await RetailProduct.findAll({ where: { id: items.map((i) => i.product_id) }, order: [['id', 'ASC']], transaction: t, lock: t.LOCK.UPDATE });
                for (const i of items) {
                    await RetailProduct.update(
                        { stock: sequelize.literal(`stock + ${Number(i.quantity)}`), total_sold: sequelize.literal(`CASE WHEN total_sold >= ${Number(i.quantity)} THEN total_sold - ${Number(i.quantity)} ELSE 0 END`) },
                        { where: { id: i.product_id }, transaction: t },
                    );
                }
                patch.stock_returned = true;
            }
        }
        if (status === 'returned') {
            // Goods that come back are not restocked automatically (they may be damaged): the team adds stock in the catalogue.
            patch.payment_status = order.payment_status === 'paid' ? 'refunded' : 'cancelled';
        }

        if (status === 'cancelled' || status === 'returned') {
            // The sale no longer counts towards the customer's totals.
            const customer = order.customer_id ? await RetailCustomer.findByPk(order.customer_id, { transaction: t, lock: t.LOCK.UPDATE }) : null;
            if (customer) {
                await customer.update({
                    order_count: Math.max(0, customer.order_count - 1),
                    total_spent: Math.max(0, fromPaise(toPaise(customer.total_spent) - toPaise(order.total))),
                }, { transaction: t });
            }
        }

        await order.update(patch, { transaction: t });
        await RetailOrderEvent.create({ order_id: order.id, status, kind: 'status', note: cleanNote, ...actorOf(user) }, { transaction: t });
    });

    await auditChange(req, id, `Retail order status ${before} -> ${status}`, { status: before }, { status, note: cleanNote });
    return getOrder(id);
}

const COURIER_URL_RE = /^https?:\/\/[^\s]+$/i;

/** Courier, AWB and tracking link (admin). Only the fields that were sent change; an empty string clears one. */
async function updateShipping(id, body, req) {
    const user = req.user;
    if (!isUuid(id)) throw new HttpError(404, 'Order not found.');
    const patch = {};
    const sent = (k) => Object.prototype.hasOwnProperty.call(body, k);
    if (sent('courier')) patch.courier = cleanText(body.courier, 100);
    if (sent('awb')) patch.awb = cleanText(body.awb, 100);
    if (sent('tracking_url')) {
        patch.tracking_url = cleanText(body.tracking_url, 500);
        if (patch.tracking_url && !COURIER_URL_RE.test(patch.tracking_url)) throw new HttpError(400, 'Tracking link must start with http:// or https://');
    }
    if (!Object.keys(patch).length) throw new HttpError(400, 'Send courier, awb or tracking_url.');

    let old;
    await inTransaction(async (t) => {
        const order = await RetailOrder.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!order) throw new HttpError(404, 'Order not found.');
        if (['cancelled', 'returned'].includes(order.status)) throw new HttpError(409, `This order is ${order.status}; shipment details cannot be changed.`);
        old = { courier: order.courier, awb: order.awb, tracking_url: order.tracking_url };
        await order.update(patch, { transaction: t });
        const summaryText = ['courier', 'awb', 'tracking_url'].filter((k) => k in patch)
            .map((k) => `${k === 'tracking_url' ? 'tracking link' : k}: ${patch[k] || 'cleared'}`).join(', ');
        await RetailOrderEvent.create({
            order_id: order.id, status: order.status, kind: 'shipping', note: `Shipment updated (${summaryText})`.slice(0, 500), ...actorOf(user),
        }, { transaction: t });
    });
    await auditChange(req, id, 'Retail order shipment details updated', old, patch);
    return getOrder(id);
}

module.exports = {
    STATUSES, allowedNext, quote, createOrder, trackOrder, listOrders, summary, getOrder, changeStatus, updateShipping,
};
