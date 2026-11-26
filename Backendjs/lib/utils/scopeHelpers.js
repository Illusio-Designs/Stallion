const Party = require('../models/Party');
const Distributor = require('../models/distributor');
const Salesman = require('../models/Salesman');
const { normalizeRole, canManageOrders } = require('./roleHelpers');

async function resolveUserScope(userId, roleName) {
    const role = normalizeRole(roleName);
    const scope = {
        role,
        partyId: null,
        distributorId: null,
        salesmanId: null,
    };

    // A user can hold several roles (a sales manager who is also a salesman), so
    // find every profile the user has — not only the one matching the main role.
    const [party, distributor, salesman] = await Promise.all([
        Party.findOne({ where: { user_id: userId } }),
        Distributor.findOne({ where: { user_id: userId } }),
        Salesman.findOne({ where: { user_id: userId } }),
    ]);
    scope.partyId = party ? party.party_id : null;
    scope.distributorId = distributor ? distributor.distributor_id : null;
    scope.salesmanId = salesman ? salesman.salesman_id : null;

    return scope;
}

function canViewAllOrders(roleName) {
    return canManageOrders(roleName);
}

module.exports = {
    resolveUserScope,
    canViewAllOrders,
};
