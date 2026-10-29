const express = require('express');
const router = express.Router();
const { limit, clientIp } = require('../../utils/rateLimiter');
const { authenticateToken } = require('../../middleware/auth');
const { checkRole } = require('../../middleware/roleAuth');
const { RETAIL_CONTENT_ROLES, accessFor } = require('./roles');

// ---- Public API: no login, rate limited, never returns wholesale data (WHP) ----
const publicLimiter = limit({ name: 'retail-public', max: 240, windowMs: 60 * 1000, keys: (req) => [clientIp(req)], message: 'Too many requests.' });
const publicRouter = express.Router();
publicRouter.use(publicLimiter);
publicRouter.use(require('./public/catalog'));
publicRouter.use(require('./public/content'));
publicRouter.use(require('./public/checkout'));
publicRouter.use(require('./public/tracking'));
router.use('/public', publicRouter);

// ---- Who can open which side (any logged-in user) ----
router.get('/access', authenticateToken, (req, res) => {
    res.json({ success: true, data: accessFor(req.userRoleNames) });
});

// ---- Admin API: login + a retail role. Finer per-route role checks live in each admin file. ----
const adminRouter = express.Router();
adminRouter.use(authenticateToken, checkRole(RETAIL_CONTENT_ROLES));
adminRouter.use(require('./admin/catalog'));
adminRouter.use(require('./admin/content'));
adminRouter.use(require('./admin/orders'));
adminRouter.use(require('./admin/settings'));
adminRouter.use(require('./admin/analytics'));
router.use('/admin', adminRouter);

module.exports = router;
