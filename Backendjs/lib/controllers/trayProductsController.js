const TrayProducts = require('../models/TrayProducts');
const { logAudit } = require('../utils/auditLogger');
const Product = require('../models/Product');
const sequelize = require('../constants/database');
const Tray = require('../models/Tray');
const { TrayProductStatus, TrayProductStatusTransitions, TrayStatus } = require('../constants/enums');
const { syncTrayStatus } = require('../utils/trayLifecycle');
const { recordStockMove } = require('../utils/stockLedger');

function isValidTrayProductStatus(status) {
    return Object.values(TrayProductStatus).includes(status);
}

function canTransitionTrayStatus(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) {
        return true;
    }
    const allowed = TrayProductStatusTransitions[currentStatus] || [];
    return allowed.includes(nextStatus);
}

class TrayProductsController {
    async getProductsInTray(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Tray ID is required' });
            }
            const trayProducts = await TrayProducts.findAll({ where: { tray_id: id } });
            res.status(200).json(trayProducts);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async addProductToTray(req, res) {
        try {
            const { tray_id, product_id, status } = req.body;
            if (!tray_id || !product_id || !status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            if (!isValidTrayProductStatus(status)) {
                return res.status(400).json({ error: 'Invalid tray product status' });
            }
            if (status !== TrayProductStatus.ALLOTED) {
                return res.status(400).json({ error: 'New tray products must start as alloted' });
            }

            const alreadyInTray = await TrayProducts.findOne({ where: { tray_id, product_id } });
            if (alreadyInTray) {
                if (!canTransitionTrayStatus(alreadyInTray.status, status)) {
                    return res.status(400).json({
                        error: `Cannot update tray product status from '${alreadyInTray.status}' to '${status}'`,
                    });
                }
                const oldSnapshot = alreadyInTray.toJSON();
                const payload = {
                    status,
                    updated_at: new Date(),
                };
                alreadyInTray.status = status;
                alreadyInTray.updated_at = new Date();
                const updatedTrayProduct = await alreadyInTray.save();
                await logAudit({
                    req,
                    action: 'update',
                    description: 'Tray product status updated',
                    tableName: 'tray_products',
                    recordId: alreadyInTray.id,
                    oldValues: oldSnapshot,
                    newValues: { ...oldSnapshot, ...payload },
                });
                return res.status(200).json(updatedTrayProduct);
            }

            // One transaction: lock the product row, re-read it, then create the tray row and
            // move exactly 1 piece from the warehouse to the tray. Two requests for the same
            // product wait for each other, so no piece is counted twice or lost.
            const outcome = await sequelize.transaction(async (transaction) => {
                const product = await Product.findOne({
                    where: { product_id },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!product) return { status: 404, error: 'Product not found' };
                const targetTray = await Tray.findOne({ where: { tray_id }, transaction });
                if (!targetTray) return { status: 404, error: 'Tray not found' };
                if (targetTray.is_active === false) return { status: 409, error: 'This tray is inactive, so nothing can be added to it.' };
                if (targetTray.tray_status === TrayStatus.INACTIVE) return { status: 409, error: 'This tray is inactive, so nothing can be added to it.' };
                const duplicate = await TrayProducts.findOne({ where: { tray_id, product_id }, transaction });
                if (duplicate) return { status: 409, error: 'This product is already in the tray' };
                if ((Number(product.warehouse_qty) || 0) < 1) return { status: 400, error: 'Product out of stock' };

                const created = await TrayProducts.create({
                    tray_id,
                    product_id,
                    qty: 1,
                    status,
                    created_at: new Date(),
                    updated_at: new Date(),
                    assigned_at: new Date(),
                }, { transaction });

                const nextWarehouse = (Number(product.warehouse_qty) || 0) - 1;
                const nextTray = (Number(product.tray_qty) || 0) + 1;
                await Product.update({
                    warehouse_qty: nextWarehouse,
                    tray_qty: nextTray,
                    // Total is always warehouse + tray.
                    total_qty: nextWarehouse + nextTray,
                    updated_at: new Date(),
                }, { where: { product_id }, transaction });
                await recordStockMove({
                    transaction, productId: product_id, warehouseAfter: nextWarehouse, trayAfter: nextTray,
                    kind: 'tray', dWarehouse: -1, dTray: 1, user: req.user, reference: 'Tray', note: 'Given to a tray',
                });
                return { trayProduct: created };
            });
            if (outcome.error) {
                return res.status(outcome.status).json({ error: outcome.error });
            }
            const trayProduct = outcome.trayProduct;

            await logAudit({
                req,
                action: 'create',
                description: 'Tray product created',
                tableName: 'tray_products',
                recordId: trayProduct.id,
                oldValues: null,
                newValues: trayProduct,
            });
            res.status(200).json(trayProduct);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateProductInTray(req, res) {
        try {
            const { tray_id, product_id, status } = req.body;
            if (!tray_id || !product_id || !status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            if (!isValidTrayProductStatus(status)) {
                return res.status(400).json({ error: 'Invalid tray product status' });
            }

            const trayProduct = await TrayProducts.findOne({ where: { tray_id, product_id } });
            if (!trayProduct) {
                return res.status(404).json({ error: 'Tray product not found' });
            }
            if (!canTransitionTrayStatus(trayProduct.status, status)) {
                return res.status(400).json({
                    error: `Cannot update tray product status from '${trayProduct.status}' to '${status}'`,
                });
            }

            const oldSnapshot = trayProduct.toJSON();
            const payload = {
                status,
                updated_at: new Date(),
            };
            await trayProduct.update(payload);

            await logAudit({
                req,
                action: 'update',
                description: 'Tray product updated',
                tableName: 'tray_products',
                recordId: trayProduct.id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Tray product updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteProductFromTray(req, res) {
        try {
            // A DELETE has no body in browsers, so the ids may come in the query string.
            const { tray_id, product_id } = { ...(req.query || {}), ...(req.body || {}) };
            if (!tray_id || !product_id) {
                return res.status(400).json({ error: 'Tray product ID is required' });
            }
            // One transaction with the product row locked, so removing a tray product
            // cannot overwrite a stock change made at the same moment (an order, another add).
            const outcome = await sequelize.transaction(async (transaction) => {
                const product = await Product.findOne({
                    where: { product_id },
                    transaction,
                    lock: transaction.LOCK.UPDATE,
                });
                if (!product) return { status: 404, error: 'Product not found' };
                const found = await TrayProducts.findOne({ where: { tray_id, product_id }, transaction });
                if (!found) return { status: 404, error: 'Tray product not found' };

                const snap = found.toJSON();
                const qtyToRestore = Number(found.qty) || 0;
                await found.destroy({ transaction });
                const nextWarehouse = (Number(product.warehouse_qty) || 0) + qtyToRestore;
                const nextTray = Math.max(0, (Number(product.tray_qty) || 0) - qtyToRestore);
                await Product.update({
                    warehouse_qty: nextWarehouse,
                    tray_qty: nextTray,
                    // Total is always warehouse + tray.
                    total_qty: nextWarehouse + nextTray,
                    updated_at: new Date(),
                }, { where: { product_id }, transaction });
                await recordStockMove({
                    transaction, productId: product_id, warehouseAfter: nextWarehouse, trayAfter: nextTray,
                    kind: 'tray', dWarehouse: qtyToRestore, dTray: -qtyToRestore, user: req.user, reference: 'Tray', note: 'Taken out of a tray',
                });
                await syncTrayStatus(tray_id, transaction);
                return { snapshot: snap };
            });
            if (outcome.error) {
                return res.status(outcome.status).json({ error: outcome.error });
            }
            const snapshot = outcome.snapshot;

            await logAudit({
                req,
                action: 'delete',
                description: 'Tray product deleted',
                tableName: 'tray_products',
                recordId: snapshot.id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Tray product deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * Move pieces out of a tray. Body: { transfers: [{ from_tray_id, product_id, qty?, to_tray_id? }] }
     * - to_tray_id missing/null: the pieces go back to the warehouse.
     * - to_tray_id set: the pieces move to that tray (1 row per product per tray).
     * - qty missing: the whole row moves. A smaller qty splits it, so one tray can send some
     *   pieces to the warehouse and others to another tray.
     * Everything is one transaction. A tray whose owner has left becomes inactive when it is empty.
     */
    async transferTrayProducts(req, res) {
        try {
            const { transfers } = req.body;
            if (!Array.isArray(transfers) || transfers.length === 0) {
                return res.status(400).json({ error: 'transfers are required' });
            }
            for (const t of transfers) {
                if (!t || !t.from_tray_id || !t.product_id) {
                    return res.status(400).json({ error: 'Each transfer needs from_tray_id and product_id' });
                }
                if (t.qty !== undefined && (!Number.isInteger(t.qty) || t.qty < 1)) {
                    return res.status(400).json({ error: 'Quantity must be a whole number, 1 or more.' });
                }
                if (t.to_tray_id && t.to_tray_id === t.from_tray_id) {
                    return res.status(400).json({ error: 'Choose a different tray to move to' });
                }
            }
            const done = [];
            const outcome = await sequelize.transaction(async (transaction) => {
                // Lock the products in a fixed order so two transfers cannot block each other.
                const productIds = [...new Set(transfers.map((t) => t.product_id))].sort();
                const products = {};
                for (const pid of productIds) {
                    const product = await Product.findOne({ where: { product_id: pid }, transaction, lock: transaction.LOCK.UPDATE });
                    if (!product) return { status: 404, error: 'Product not found' };
                    products[pid] = product;
                }
                const touched = new Set();
                for (const t of transfers) {
                    const row = await TrayProducts.findOne({ where: { tray_id: t.from_tray_id, product_id: t.product_id }, transaction });
                    if (!row) return { status: 404, error: 'That product is not in the tray' };
                    const have = Number(row.qty) || 0;
                    const qty = t.qty === undefined ? have : t.qty;
                    if (qty > have) return { status: 400, error: `Only ${have} piece(s) are in the tray` };
                    const product = products[t.product_id];

                    if (t.to_tray_id) {
                        const dest = await Tray.findOne({ where: { tray_id: t.to_tray_id }, transaction });
                        if (!dest) return { status: 404, error: 'Destination tray not found' };
                        if (dest.is_active === false) return { status: 409, error: 'The destination tray is inactive' };
                        if (dest.tray_status === TrayStatus.INACTIVE) return { status: 409, error: 'The destination tray is inactive' };
                        const existing = await TrayProducts.findOne({ where: { tray_id: t.to_tray_id, product_id: t.product_id }, transaction });
                        if (existing) return { status: 409, error: 'That product is already in the destination tray' };
                        if (qty === have) {
                            await TrayProducts.update({ tray_id: t.to_tray_id, assigned_at: new Date(), updated_at: new Date() },
                                { where: { id: row.id }, transaction });
                        } else {
                            await TrayProducts.update({ qty: have - qty, updated_at: new Date() }, { where: { id: row.id }, transaction });
                            await TrayProducts.create({
                                tray_id: t.to_tray_id, product_id: t.product_id, qty, status: row.status,
                                created_at: new Date(), updated_at: new Date(), assigned_at: new Date(),
                            }, { transaction });
                        }
                        touched.add(t.to_tray_id);
                    } else {
                        // Back to the warehouse: warehouse goes up, tray goes down, total is unchanged.
                        if (qty === have) await TrayProducts.destroy({ where: { id: row.id }, transaction });
                        else await TrayProducts.update({ qty: have - qty, updated_at: new Date() }, { where: { id: row.id }, transaction });
                        const nextWarehouse = (Number(product.warehouse_qty) || 0) + qty;
                        const nextTray = Math.max(0, (Number(product.tray_qty) || 0) - qty);
                        product.warehouse_qty = nextWarehouse;
                        product.tray_qty = nextTray;
                        product.total_qty = nextWarehouse + nextTray;
                        await Product.update({
                            warehouse_qty: nextWarehouse, tray_qty: nextTray, total_qty: nextWarehouse + nextTray, updated_at: new Date(),
                        }, { where: { product_id: t.product_id }, transaction });
                        await recordStockMove({
                            transaction, productId: t.product_id, warehouseAfter: nextWarehouse, trayAfter: nextTray,
                            kind: 'tray', dWarehouse: qty, dTray: -qty, user: req.user, reference: 'Tray', note: 'Moved back to the warehouse',
                        });
                    }
                    touched.add(t.from_tray_id);
                    done.push({ from_tray_id: t.from_tray_id, product_id: t.product_id, qty, to_tray_id: t.to_tray_id || null });
                }
                for (const trayId of touched) await syncTrayStatus(trayId, transaction);
                return { ok: true };
            });
            if (outcome.error) {
                return res.status(outcome.status).json({ error: outcome.error });
            }
            await logAudit({
                req,
                action: 'update',
                description: 'Tray products transferred',
                tableName: 'tray_products',
                recordId: transfers[0].from_tray_id,
                oldValues: null,
                newValues: { transfers: done },
            });
            res.status(200).json({ message: 'Transferred successfully', transfers: done });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TrayProductsController();
