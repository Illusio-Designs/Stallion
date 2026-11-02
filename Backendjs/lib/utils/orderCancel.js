// Pure helpers for cancelling an order, also when part of it was already shipped.
// No database access here, so the arithmetic can be tested on its own.

const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

// Order items as an array (the column may arrive as JSON text or an object).
function itemsOf(orderItems) {
    let its = orderItems;
    if (typeof its === 'string') { try { its = JSON.parse(its); } catch { its = []; } }
    if (its && typeof its === 'object' && !Array.isArray(its)) its = Object.values(its);
    return Array.isArray(its) ? its : [];
}

// An order line can be an upcoming (pre-order) line: it has no stock rows at all. The flag is
// stored on the order item at order time, so old orders (no flag) are always normal lines.
const isUpcomingItem = (it) => !!(it && (it.is_upcoming === true || it.is_upcoming === 1 || it.is_upcoming === '1' || it.is_upcoming === 'true'));

// Shipments are order-level quantities. Give the shipped pieces to the items in item order:
// the first item first, each item up to its ordered quantity. Returns { [product_id]: pieces }.
// Normal lines come first and upcoming lines last: a normal line is the only one that holds
// stock, so a shipped piece is never wrongly counted as an upcoming piece (which would make a
// later cancel put back stock that was sent). Orders without upcoming lines behave as before.
function allocateShipped(orderItems, shippedQty) {
    let left = toInt(shippedQty);
    const byProduct = {};
    const items = itemsOf(orderItems).filter((it) => it && it.product_id);
    const ordered = [...items.filter((it) => !isUpcomingItem(it)), ...items.filter(isUpcomingItem)];
    for (const it of ordered) {
        const take = Math.min(left, toInt(it.quantity ?? it.qty));
        byProduct[it.product_id] = (byProduct[it.product_id] || 0) + take;
        left -= take;
    }
    return byProduct;
}

// Pieces of upcoming lines that a cancel takes off the pre-order count: for each upcoming item,
// its ordered quantity minus the pieces already shipped. Returns { [product_id]: pieces }.
function upcomingToRelease(orderItems, shippedByProduct = {}) {
    const out = {};
    const shippedLeft = { ...shippedByProduct };
    for (const it of itemsOf(orderItems)) {
        if (!it || !it.product_id || !isUpcomingItem(it)) continue;
        const ordered = toInt(it.quantity ?? it.qty);
        const shipped = Math.min(ordered, toInt(shippedLeft[it.product_id]));
        shippedLeft[it.product_id] = toInt(shippedLeft[it.product_id]) - shipped;
        const rest = ordered - shipped;
        if (rest > 0) out[it.product_id] = (out[it.product_id] || 0) + rest;
    }
    return out;
}

// What happens to one item's pieces when only the unsent part is cancelled.
//   warehouse  pieces taken from the warehouse when the order was placed
//   tray       pieces taken from sample trays when the order was placed
//   received   tray pieces already received back at the office (now in the warehouse)
//   shipped    pieces of this item already sent
// Shipped pieces came first from the warehouse part, then from the received tray pieces.
// The unsent rest is: warehouse pieces and received tray pieces (back to warehouse stock) and
// booked tray pieces (back to the tray). A shipped count larger than warehouse + received
// would mean pieces left that were never ready; those are taken off the booked part, so no
// stock is ever created out of nothing.
function planItemCancel({ warehouse, tray, received, shipped }) {
    const W = toInt(warehouse);
    const T = toInt(tray);
    const R = Math.min(toInt(received), T);
    const B = T - R;
    const s = toInt(shipped);
    const shippedWarehouse = Math.min(s, W);
    const shippedReceived = Math.min(s - shippedWarehouse, R);
    const over = s - shippedWarehouse - shippedReceived;
    return {
        shippedWarehouse,
        shippedReceived,
        unsentWarehouse: W - shippedWarehouse,
        unsentReceived: R - shippedReceived,
        unsentBooked: Math.max(0, B - over),
        receivedQty: R,
        bookedQty: B,
    };
}

// Share a booked-piece budget over the tray parts of an item, first part first.
// Returns the quantity to give back for each entry (same length as entries).
function spreadOver(entryQtys, budget) {
    let left = toInt(budget);
    return entryQtys.map((q) => {
        const give = Math.min(left, toInt(q));
        left -= give;
        return give;
    });
}

module.exports = { toInt, itemsOf, isUpcomingItem, allocateShipped, upcomingToRelease, planItemCancel, spreadOver };
