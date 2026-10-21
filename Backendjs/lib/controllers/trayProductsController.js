const TrayProducts = require('../models/TrayProducts');
const { logAudit } = require('../utils/auditLogger');
const Product = require('../models/Product');
const sequelize = require('../constants/database');
const { TrayProductStatus, TrayProductStatusTransitions } = require('../constants/enums');

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
            const { tray_id, product_id } = req.body;
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
}

module.exports = new TrayProductsController();
