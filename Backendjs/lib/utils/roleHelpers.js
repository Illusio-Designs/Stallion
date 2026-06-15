const OFFICE_ROLES = [
    'admin',
    'sales_manager',
    'expense_manager',
    'tray_manager',
    'order_manager',
    'reports_manager',
    'product_manager',
    'party_manager',
    'distributor_manager',
];

const INVENTORY_ROLES = ['admin', 'tray_manager'];
const ORDER_ADMIN_ROLES = ['admin', 'order_manager'];
const PARTY_ADMIN_ROLES = ['admin', 'party_manager', 'sales_manager'];
const PRODUCT_ADMIN_ROLES = ['admin', 'product_manager'];
const USER_ADMIN_ROLES = ['admin'];

function normalizeRole(roleName) {
    return roleName ? String(roleName).toLowerCase() : null;
}

function hasRole(roleName, allowedRoles) {
    const normalized = normalizeRole(roleName);
    return normalized != null && allowedRoles.map(normalizeRole).includes(normalized);
}

function isOfficeRole(roleName) {
    return hasRole(roleName, OFFICE_ROLES);
}

function canManageInventory(roleName) {
    return hasRole(roleName, INVENTORY_ROLES);
}

function canManageOrders(roleName) {
    return hasRole(roleName, ORDER_ADMIN_ROLES);
}

function canManageParties(roleName) {
    return hasRole(roleName, PARTY_ADMIN_ROLES);
}

function canManageProducts(roleName) {
    return hasRole(roleName, PRODUCT_ADMIN_ROLES);
}

function canManageUsers(roleName) {
    return hasRole(roleName, USER_ADMIN_ROLES);
}

function isFieldRole(roleName) {
    const normalized = normalizeRole(roleName);
    return normalized === 'party' || normalized === 'distributor' || normalized === 'salesman';
}

module.exports = {
    OFFICE_ROLES,
    INVENTORY_ROLES,
    ORDER_ADMIN_ROLES,
    normalizeRole,
    hasRole,
    isOfficeRole,
    canManageInventory,
    canManageOrders,
    canManageParties,
    canManageProducts,
    canManageUsers,
    isFieldRole,
};
