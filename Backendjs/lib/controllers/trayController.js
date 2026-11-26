const Tray = require('../models/Tray');
const { logAudit } = require('../utils/auditLogger');
const TrayProducts = require('../models/TrayProducts');
const Product = require('../models/Product');
const SalesmanTray = require('../models/SalesmanTray');
const Salesman = require('../models/Salesman');
const TrayReturnTask = require('../models/TrayReturnTask');
const { trayPieceCount } = require('../utils/trayLifecycle');
const { activeOnlyWhere, activeUpdate } = require('../utils/attributeActive');
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { hasRole } = require('../utils/roleHelpers');
const { resolveUserScope } = require('../utils/scopeHelpers');
const { parsePaginationParams, buildPaginatedResponse, getListSearchParams, buildNamePhoneFilter, likeContains } = require('../utils/listSearchHelpers');

// Adds what the tray cards show: the frames inside (model_no + status), a piece count and the
// salesman who holds the tray. Three extra queries per page, no matter how many trays.
async function withTrayDetails(rows) {
    const trays = rows.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : { ...r }));
    const ids = trays.map((t) => t.tray_id);
    if (ids.length === 0) return trays;
    const [items, links] = await Promise.all([
        TrayProducts.findAll({ where: { tray_id: { [Op.in]: ids } }, order: [['assigned_at', 'ASC']] }),
        SalesmanTray.findAll({ where: { tray_id: { [Op.in]: ids }, released_at: null }, order: [['assigned_at', 'DESC']] }),
    ]);
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const salesmanIds = [...new Set(links.map((l) => l.salesman_id))];
    const [products, salesmen] = await Promise.all([
        productIds.length ? Product.findAll({ where: { product_id: { [Op.in]: productIds } }, attributes: ['product_id', 'model_no'] }) : [],
        salesmanIds.length ? Salesman.findAll({ where: { salesman_id: { [Op.in]: salesmanIds } }, attributes: ['salesman_id', 'full_name', 'is_active'] }) : [],
    ]);
    const modelById = new Map(products.map((p) => [p.product_id, p.model_no]));
    const salesmanById = new Map(salesmen.map((s) => [s.salesman_id, s]));
    const framesByTray = new Map();
    items.forEach((i) => {
        const list = framesByTray.get(i.tray_id) || [];
        list.push({ product_id: i.product_id, model_no: modelById.get(i.product_id) || null, qty: Number(i.qty) || 1, status: i.status });
        framesByTray.set(i.tray_id, list);
    });
    const linkByTray = new Map();
    links.forEach((l) => { if (!linkByTray.has(l.tray_id)) linkByTray.set(l.tray_id, l); });
    return trays.map((t) => {
        const frames = framesByTray.get(t.tray_id) || [];
        const link = linkByTray.get(t.tray_id);
        const sm = link ? salesmanById.get(link.salesman_id) : null;
        return {
            ...t,
            frames,
            product_count: frames.reduce((n, f) => n + f.qty, 0),
            salesman_id: link ? link.salesman_id : null,
            salesman_name: sm ? sm.full_name : null,
            salesman_active: sm ? sm.is_active !== false : null,
            assigned_at: link ? link.assigned_at : null,
        };
    });
}

class TrayController {
    // Search the catalog, including products without stock or a tray assignment.
    async searchProducts(req, res) {
        try {
            const pagination = parsePaginationParams(req);
            const { name } = getListSearchParams(req);
            if (!name) return res.status(200).json(buildPaginatedResponse([], pagination, 0));
            const { count, rows } = await Product.findAndCountAll({
                where: sqlWhere(fn('LOWER', col('model_no')), { [Op.like]: likeContains(name.toLowerCase()) }),
                attributes: ['product_id', 'model_no'],
                order: [['model_no', 'ASC'], ['product_id', 'ASC']],
                limit: pagination.limit,
                offset: pagination.offset,
            });
            const ids = rows.map((p) => p.product_id);
            const items = ids.length ? await TrayProducts.findAll({
                where: { product_id: { [Op.in]: ids }, qty: { [Op.gt]: 0 }, status: { [Op.ne]: 'returned' } },
            }) : [];
            const trayIds = [...new Set(items.map((i) => i.tray_id))];
            const trays = trayIds.length ? await withTrayDetails(await Tray.findAll({
                where: { tray_id: { [Op.in]: trayIds } },
                order: [['tray_name', 'ASC']],
            })) : [];
            const data = rows.map((p) => ({
                product_id: p.product_id,
                model_no: p.model_no,
                assignments: trays.filter((t) => items.some((i) => i.product_id === p.product_id && i.tray_id === t.tray_id))
                    .map((t) => ({ tray_id: t.tray_id, tray_name: t.tray_name, holder_name: t.salesman_name })),
            }));
            return res.status(200).json(buildPaginatedResponse(data, pagination, count));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    async getTrays(req, res) {
        try {
            const pagination = parsePaginationParams(req);
            if (pagination.error) {
                return res.status(pagination.status).json({ error: pagination.error });
            }
            const { name } = getListSearchParams(req);
            const searchFilter = buildNamePhoneFilter({ name, nameFields: ['tray_name'] });
            // A salesman sees only the trays that are with him right now.
            let ownOnly = null;
            if (hasRole(req.userRoleNames, ['salesman']) && !hasRole(req.userRoleNames, ['admin', 'tray_manager', 'sales_manager'])) {
                const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
                const links = scope.salesmanId
                    ? await SalesmanTray.findAll({ where: { salesman_id: scope.salesmanId, released_at: null }, attributes: ['tray_id'] })
                    : [];
                ownOnly = { tray_id: { [Op.in]: links.map((l) => l.tray_id) } };
            }
            const { count, rows: trays } = await Tray.findAndCountAll({
                where: { ...(searchFilter || {}), ...activeOnlyWhere(req), ...(ownOnly || {}) },
                order: [['tray_name', 'ASC']],
                limit: pagination.limit,
                offset: pagination.offset,
            });
            res.status(200).json(buildPaginatedResponse(await withTrayDetails(trays), pagination, count));
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async createTray(req, res) {
        try {
            const { tray_name, tray_status } = req.body;
            if (!tray_name || !tray_status) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const tray = await Tray.create({
                tray_name,
                tray_status,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Tray created',
                tableName: 'tray',
                recordId: tray.tray_id,
                oldValues: null,
                newValues: tray,
            });
            res.status(200).json(tray);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async updateTray(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Tray ID is required' });
            }
            const { tray_name, tray_status } = req.body;
            const tray = await Tray.findByPk(id);
            if (!tray) {
                return res.status(404).json({ error: 'Tray not found' });
            }
            const active = activeUpdate(req.body);
            if (active.is_active === false && tray.is_active !== false) {
                // A tray can only be switched off once it is empty and nothing is on its way back.
                const pieces = await trayPieceCount(id);
                const openReturns = await TrayReturnTask.count({ where: { tray_id: id, status: { [Op.in]: ['booked', 'in_transit'] } } });
                if (pieces > 0 || openReturns > 0) {
                    return res.status(409).json({ error: 'Take the frames back to the warehouse first.' });
                }
            }
            const oldSnapshot = tray.toJSON();
            const payload = {
                tray_name: tray_name || tray.tray_name,
                tray_status: tray_status || tray.tray_status,
                ...active,
                updated_at: new Date(),
            };
            await tray.update(payload);
            await logAudit({
                req,
                action: 'update',
                description: 'Tray updated',
                tableName: 'tray',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...payload },
            });
            res.status(200).json({ message: 'Tray updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteTray(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'Tray ID is required' });
            }
            const tray = await Tray.findByPk(id);
            if (!tray) {
                return res.status(404).json({ error: 'Tray not found' });
            }
            const snapshot = tray.toJSON();
            await tray.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Tray deleted',
                tableName: 'tray',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Tray deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TrayController();
