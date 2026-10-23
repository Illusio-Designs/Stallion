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

// Shipments are order-level quantities. Give the shipped pieces to the items in item order:
// the first item first, each item up to its ordered quantity. Returns { [product_id]: pieces }.
function allocateShipped(orderItems, shippedQty) {
    let left = toInt(shippedQty);
    const byProduct = {};
    for (const it of itemsOf(orderItems)) {
        if (!it || !it.product_id) continue;
        const take = Math.min(left, toInt(it.quantity ?? it.qty));
        byProduct[it.product_id] = (byProduct[it.product_id] || 0) + take;
        left -= take;
    }
    return byProduct;
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

module.exports = { toInt, itemsOf, allocateShipped, planItemCancel, spreadOver };
