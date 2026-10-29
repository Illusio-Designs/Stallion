const { hasRole } = require('../../utils/roleHelpers');

// Retail side roles. 'admin' is the super admin and sees both sides.
const RETAIL_ADMIN_ROLES = ['admin', 'retail_manager'];          // everything in retail
const RETAIL_CONTENT_ROLES = ['admin', 'retail_manager', 'retail_editor']; // blog, SEO, FAQs, pages only
const RETAIL_ROLE_NAMES = ['retail_manager', 'retail_editor'];

// What may this person open? wholesale = any role that is not a retail-only role.
function accessFor(roleNames) {
    const names = roleNames || [];
    const retail = hasRole(names, RETAIL_CONTENT_ROLES);
    const wholesale = hasRole(names, ['admin']) || names.some((r) => r && !RETAIL_ROLE_NAMES.includes(String(r).toLowerCase()));
    return { wholesale, retail };
}

module.exports = { RETAIL_ADMIN_ROLES, RETAIL_CONTENT_ROLES, RETAIL_ROLE_NAMES, accessFor };
