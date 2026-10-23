const { Op } = require('sequelize');
const SalesmanCheckIns = require('../models/SalesmanCheckIns');
const SalesmanExpense = require('../models/SalesmanExpense');
const Salesman = require('../models/Salesman');
const Party = require('../models/Party');
const Cities = require('../models/Cities');
const Order = require('../models/Order');
const Tray = require('../models/Tray');
const TrayProducts = require('../models/TrayProducts');
const { TrayStatus } = require('../constants/enums');
const { isOfficeRole, hasRole } = require('../utils/roleHelpers');
const { resolveUserScope } = require('../utils/scopeHelpers');

const WEEKS = 12;
const UNUSED_TRAY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Monday of the week the date falls in (local time).
const startOfWeek = (d) => {
    const s = startOfDay(d);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return s;
};
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const rolesOf = (req) => (req.userRoleNames && req.userRoleNames.length ? req.userRoleNames : [req.userRoleName]);

// Weekly order value for the last 12 weeks, oldest first. Cancelled orders are
// counted on purpose: they still count toward targets, so the chart agrees with them.
async function weeklySales(now) {
    const firstWeek = startOfWeek(now);
    firstWeek.setDate(firstWeek.getDate() - 7 * (WEEKS - 1));
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
        const d = new Date(firstWeek);
        d.setDate(d.getDate() + 7 * i);
        return { week_start: dayKey(d), total: 0 };
    });
    const rows = await Order.findAll({
        where: { order_date: { [Op.gte]: firstWeek } },
        attributes: ['order_date', 'order_total'],
        raw: true,
    });
    rows.forEach((r) => {
        const d = new Date(r.order_date);
        if (Number.isNaN(d.getTime())) return;
        const idx = Math.floor((startOfWeek(d) - firstWeek) / (7 * DAY_MS) + 0.01);
        if (idx >= 0 && idx < WEEKS) weeks[idx].total += Number(r.order_total) || 0;
    });
    weeks.forEach((w) => { w.total = Math.round(w.total * 100) / 100; });
    return weeks;
}

// Unused trays: a tray that is not inactive/closed, holds no pieces at all, and has
// not been touched (no product put in, tray not edited) for 30 or more days.
async function countUnusedTrays(now) {
    const cutoff = new Date(now.getTime() - UNUSED_TRAY_DAYS * DAY_MS);
    const trays = await Tray.findAll({
        where: { tray_status: { [Op.notIn]: [TrayStatus.INACTIVE, TrayStatus.CLOSED] }, updated_at: { [Op.lt]: cutoff } },
        attributes: ['tray_id'],
        raw: true,
    });
    if (trays.length === 0) return 0;
    const ids = trays.map((t) => t.tray_id);
    const filled = await TrayProducts.findAll({
        where: { tray_id: { [Op.in]: ids }, [Op.or]: [{ qty: { [Op.gt]: 0 } }, { assigned_at: { [Op.gte]: cutoff } }] },
        attributes: ['tray_id'],
        group: ['tray_id'],
        raw: true,
    });
    const used = new Set(filled.map((f) => f.tray_id));
    return ids.filter((id) => !used.has(id)).length;
}

class DashboardController {
    // GET /api/dashboard/summary  (admin and office managers only)
    async getSummary(req, res) {
        try {
            if (!isOfficeRole(rolesOf(req))) {
                return res.status(403).json({ error: 'Access denied' });
            }
            const now = new Date();
            const dayStartAt = startOfDay(now);
            const dayEndAt = new Date(dayStartAt.getTime() + DAY_MS);
            const today = {
                [Op.or]: [
                    { check_in_date: { [Op.gte]: dayStartAt, [Op.lt]: dayEndAt } },
                    { created_at: { [Op.gte]: dayStartAt, [Op.lt]: dayEndAt } },
                ],
            };

            const [salesmenTotal, checkIns, pendingExpenses, unusedTrays, weekly] = await Promise.all([
                Salesman.count({ where: { is_active: { [Op.ne]: false } } }),
                SalesmanCheckIns.findAll({ where: today, order: [['created_at', 'DESC']], raw: true }),
                SalesmanExpense.count({ where: { status: 'pending' } }),
                countUnusedTrays(now),
                weeklySales(now),
            ]);

            // One row per salesman: their latest check-in today.
            const latest = new Map();
            checkIns.forEach((c) => { if (!latest.has(c.salesman_id)) latest.set(c.salesman_id, c); });
            const salesmanIds = [...latest.keys()];
            const partyIds = [...new Set([...latest.values()].map((c) => c.party_id).filter(Boolean))];
            const [salesmen, parties] = await Promise.all([
                salesmanIds.length ? Salesman.findAll({ where: { salesman_id: { [Op.in]: salesmanIds } }, attributes: ['salesman_id', 'full_name'], raw: true }) : [],
                partyIds.length ? Party.findAll({ where: { party_id: { [Op.in]: partyIds } }, attributes: ['party_id', 'party_name', 'city_id'], raw: true }) : [],
            ]);
            const cityIds = [...new Set(parties.map((p) => p.city_id).filter(Boolean))];
            const cities = cityIds.length ? await Cities.findAll({ where: { id: { [Op.in]: cityIds } }, attributes: ['id', 'name'], raw: true }) : [];
            const nameOf = new Map(salesmen.map((s) => [s.salesman_id, s.full_name]));
            const partyOf = new Map(parties.map((p) => [p.party_id, p]));
            const cityOf = new Map(cities.map((c) => [c.id, c.name]));

            const inField = [...latest.values()].map((c) => {
                const p = partyOf.get(c.party_id);
                return {
                    name: nameOf.get(c.salesman_id) || 'Salesman',
                    party_name: p ? p.party_name : null,
                    city: p && p.city_id ? (cityOf.get(p.city_id) || null) : null,
                    checked_in_at: c.in_time || c.created_at,
                };
            });

            res.status(200).json({
                salesmen_total: salesmenTotal,
                salesmen_in_field: inField.length,
                in_field: inField,
                visits_today: checkIns.length,
                pending_expenses: pendingExpenses,
                unused_trays: unusedTrays,
                weekly_sales: weekly,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // GET /api/dashboard/my-salesman  (party and distributor only)
    // Party: the salesman assigned to the party. Distributor: the salesmen assigned
    // to the distributor's active parties (at most 5). Only name and phone are returned.
    async getMySalesman(req, res) {
        try {
            const roles = rolesOf(req);
            const scope = await resolveUserScope(req.user.user_id, req.userRoleName);
            let salesmanIds = [];
            if (hasRole(roles, ['party']) && scope.partyId) {
                const party = await Party.findOne({ where: { party_id: scope.partyId }, attributes: ['salesman_id'], raw: true });
                if (party && party.salesman_id) salesmanIds = [party.salesman_id];
            } else if (hasRole(roles, ['distributor']) && scope.distributorId) {
                const rows = await Party.findAll({
                    where: { distributor_id: scope.distributorId, is_active: { [Op.ne]: false }, salesman_id: { [Op.ne]: null } },
                    attributes: ['salesman_id'], raw: true,
                });
                salesmanIds = [...new Set(rows.map((r) => r.salesman_id))].slice(0, 5);
            } else {
                return res.status(403).json({ error: 'Access denied' });
            }
            const salesmen = salesmanIds.length
                ? await Salesman.findAll({ where: { salesman_id: { [Op.in]: salesmanIds } }, attributes: ['salesman_id', 'full_name', 'phone'], raw: true })
                : [];
            res.status(200).json({ salesmen: salesmen.map((s) => ({ name: s.full_name, phone: s.phone || null })) });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new DashboardController();
