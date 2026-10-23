const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const { hasRole } = require('../utils/roleHelpers');

const OFFICE_NOTIFY_ROLES = ['admin', 'order_manager'];

// Rows that belong to this user: addressed to them, or to the office when they are admin / order manager.
function mineWhere(req) {
    const or = [{ user_id: req.user.user_id }];
    if (hasRole(req.userRoleNames, OFFICE_NOTIFY_ROLES)) or.push({ target_role: 'office' });
    return { [Op.or]: or };
}

const notificationController = {
    // GET /?unread=true  -> { data: [...], unread_count }
    async getMine(req, res) {
        try {
            const base = mineWhere(req);
            const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';
            const where = unreadOnly ? { [Op.and]: [base, { read_at: null }] } : base;
            const data = await Notification.findAll({ where, order: [['created_at', 'DESC']], limit: 50 });
            const unread_count = await Notification.count({ where: { [Op.and]: [base, { read_at: null }] } });
            res.status(200).json({ data, unread_count });
        } catch (error) {
            console.error('Error loading notifications:', error);
            res.status(500).json({ error: 'Failed to load notifications' });
        }
    },

    // POST /read  { ids?: [uuid], all?: true }
    async markRead(req, res) {
        try {
            const base = mineWhere(req);
            const all = req.body && req.body.all === true;
            const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter((x) => typeof x === 'string' && x) : [];
            if (!all && !ids.length) {
                return res.status(400).json({ error: 'Send ids or all: true' });
            }
            const conds = [base, { read_at: null }];
            if (!all) conds.push({ notification_id: ids });
            const [updated] = await Notification.update({ read_at: new Date() }, { where: { [Op.and]: conds } });
            const unread_count = await Notification.count({ where: { [Op.and]: [base, { read_at: null }] } });
            res.status(200).json({ updated, unread_count });
        } catch (error) {
            console.error('Error marking notifications read:', error);
            res.status(500).json({ error: 'Failed to update notifications' });
        }
    },
};

module.exports = notificationController;
