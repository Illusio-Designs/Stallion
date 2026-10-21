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

// Who may see a salesman's KYC documents (PAN, Aadhar, cancel cheque, photo).
const SALESMAN_DOC_ROLES = ['admin', 'sales_manager'];
const INVENTORY_ROLES = ['admin', 'tray_manager'];
const ORDER_ADMIN_ROLES = ['admin', 'order_manager'];
const PARTY_ADMIN_ROLES = ['admin', 'party_manager', 'sales_manager'];
// Creating a party is also allowed for field roles (salesman/distributor) so
// they can add a new party in the field/cart flow. Listing, editing, deleting
// and bulk-upload stay restricted to PARTY_ADMIN_ROLES.
const PARTY_CREATE_ROLES = ['admin', 'party_manager', 'sales_manager', 'salesman', 'distributor'];
const PRODUCT_ADMIN_ROLES = ['admin', 'product_manager'];
const USER_ADMIN_ROLES = ['admin'];

// Order used to pick one "main" role for a user who holds several: admin first,
// then the office roles, then salesman, distributor and party.
const ROLE_RANK = ['admin', 'sales_manager', 'order_manager', 'party_manager', 'distributor_manager',
    'product_manager', 'tray_manager', 'expense_manager', 'reports_manager',
    'salesman', 'distributor', 'party'];

function pickPrimaryRole(roleNames) {
    const rank = (r) => {
        const i = ROLE_RANK.indexOf(String(r).toLowerCase());
        return i === -1 ? ROLE_RANK.length : i;
    };
    return [...(roleNames || [])].sort((a, b) => rank(a) - rank(b))[0] || null;
}

function normalizeRole(roleName) {
    return roleName ? String(roleName).toLowerCase() : null;
}

// A member can hold several roles. hasRole accepts EITHER a single role name or
// an array of role names, and returns true if ANY of them is allowed.
function hasRole(roleOrRoles, allowedRoles) {
    const allowed = allowedRoles.map(normalizeRole);
    const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    return roles.map(normalizeRole).some((r) => r != null && allowed.includes(r));
}

// True if `target` is one of the user's roles (accepts a string or an array).
function isRole(roleOrRoles, target) {
    return hasRole(roleOrRoles, [target]);
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

function canCreateParty(roleName) {
    return hasRole(roleName, PARTY_CREATE_ROLES);
}

function canManageProducts(roleName) {
    return hasRole(roleName, PRODUCT_ADMIN_ROLES);
}

function canManageUsers(roleName) {
    return hasRole(roleName, USER_ADMIN_ROLES);
}

function isAdmin(roleName) {
    return hasRole(roleName, ['admin']);
}

function partyActiveFilter(roleName) {
    return isAdmin(roleName) ? {} : { is_active: true };
}

function denyInactiveParty(party, roleName) {
    return !party || (!party.is_active && !isAdmin(roleName));
}

function isFieldRole(roleName) {
    const normalized = normalizeRole(roleName);
    return normalized === 'party' || normalized === 'distributor' || normalized === 'salesman';
}

module.exports = {
    OFFICE_ROLES,
    SALESMAN_DOC_ROLES,
    INVENTORY_ROLES,
    ORDER_ADMIN_ROLES,
    normalizeRole,
    hasRole,
    pickPrimaryRole,
    isRole,
    isOfficeRole,
    canManageInventory,
    canManageOrders,
    canManageParties,
    canCreateParty,
    canManageProducts,
    canManageUsers,
    isAdmin,
    partyActiveFilter,
    denyInactiveParty,
    isFieldRole,
};
