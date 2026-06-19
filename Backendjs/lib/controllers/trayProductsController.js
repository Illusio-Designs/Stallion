const TrayProducts = require('../models/TrayProducts');
const { logAudit } = require('../utils/auditLogger');
const Product = require('../models/Product');
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

            const product = await Product.findOne({ where: { product_id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            if (product.warehouse_qty < 1) {
                return res.status(400).json({ error: 'Product out of stock' });
            }

            const trayProduct = await TrayProducts.create({
                tray_id,
                product_id,
                qty: 1,
                status,
                created_at: new Date(),
                updated_at: new Date(),
                assigned_at: new Date(),
            });

            await Product.update({
                warehouse_qty: product.warehouse_qty - 1,
                tray_qty: product.tray_qty + 1,
                total_qty: product.total_qty,
                updated_at: new Date(),
            }, { where: { product_id } });

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
            const product = await Product.findOne({ where: { product_id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            const trayProduct = await TrayProducts.findOne({ where: { tray_id, product_id } });
            if (!trayProduct) {
                return res.status(404).json({ error: 'Tray product not found' });
            }

            const snapshot = trayProduct.toJSON();
            const qtyToRestore = trayProduct.qty;
            await trayProduct.destroy();
            await Product.update({
                warehouse_qty: product.warehouse_qty + qtyToRestore,
                tray_qty: Math.max(0, product.tray_qty - qtyToRestore),
                total_qty: product.total_qty,
                updated_at: new Date(),
            }, { where: { product_id } });

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
