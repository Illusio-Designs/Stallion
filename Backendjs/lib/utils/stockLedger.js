const StockMovement = require('../models/StockMovement');

/**
 * Write one stock history line. Call it right after the product's numbers were saved, inside the
 * same transaction, so the history can never disagree with the stock. It never throws: a failure
 * to write history must not stop an order or a tray move.
 *
 * @param {Object} o
 * @param {Object} o.transaction  the open transaction (optional)
 * @param {string} o.productId
 * @param {number} o.warehouseAfter  warehouse quantity after the change
 * @param {number} o.trayAfter       tray quantity after the change
 * @param {string} o.kind            order | cancel | tray | sheet | manual
 * @param {number} o.dWarehouse      change to the warehouse quantity (+/-)
 * @param {number} o.dTray           change to the tray quantity (+/-)
 */
async function recordStockMove({ transaction, productId, warehouseAfter, trayAfter, kind, dWarehouse = 0, dTray = 0, user = null, reference = null, note = null }) {
    try {
        if (!productId || (!dWarehouse && !dTray)) return;
        await StockMovement.create({
            product_id: productId,
            kind,
            change_warehouse: Number(dWarehouse) || 0,
            change_tray: Number(dTray) || 0,
            warehouse_after: Number(warehouseAfter) || 0,
            tray_after: Number(trayAfter) || 0,
            user_id: user && user.user_id ? user.user_id : null,
            user_name: user ? (user.full_name || user.email || user.phone || null) : null,
            reference: reference ? String(reference).slice(0, 100) : null,
            note: note ? String(note).slice(0, 255) : null,
            created_at: new Date(),
        }, { transaction });
    } catch (err) {
        console.error('Stock history not written:', err.message);
    }
}

module.exports = { recordStockMove };
