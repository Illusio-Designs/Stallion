const { hasRole, normalizeRole } = require('../utils/roleHelpers');

/**
 * Require the authenticated user to have one of the given roles.
 * Expects req.userRoleName to be set by authenticateToken.
 */
const checkRole = (roles) => {
    const allowedRoles = (Array.isArray(roles) ? roles : [roles]).map(normalizeRole);

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const userRole = normalizeRole(req.userRoleName);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ success: false, message: 'Access denied - insufficient permissions' });
        }

        next();
    };
};

const isAdmin = checkRole(['admin']);
const isOrderManager = checkRole(['admin', 'order_manager']);
const isPartyManager = checkRole(['admin', 'party_manager', 'sales_manager']);
// Creating a party is additionally open to field roles (salesman/distributor);
// other party routes stay limited to isPartyManager.
const isPartyCreator = checkRole(['admin', 'party_manager', 'sales_manager', 'salesman', 'distributor']);
const isProductManager = checkRole(['admin', 'product_manager']);
const isInventoryManager = checkRole(['admin', 'tray_manager']);
const isOfficeStaff = checkRole([
    'admin',
    'sales_manager',
    'expense_manager',
    'tray_manager',
    'order_manager',
    'reports_manager',
    'product_manager',
    'party_manager',
    'distributor_manager',
]);

module.exports = {
    checkRole,
    isAdmin,
    isOrderManager,
    isPartyManager,
    isPartyCreator,
    isProductManager,
    isInventoryManager,
    isOfficeStaff,
};
