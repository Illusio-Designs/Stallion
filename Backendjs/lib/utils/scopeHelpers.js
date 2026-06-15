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

    if (role === 'party') {
        const party = await Party.findOne({ where: { user_id: userId } });
        scope.partyId = party ? party.party_id : null;
    } else if (role === 'distributor') {
        const distributor = await Distributor.findOne({ where: { user_id: userId } });
        scope.distributorId = distributor ? distributor.distributor_id : null;
    } else if (role === 'salesman') {
        const salesman = await Salesman.findOne({ where: { user_id: userId } });
        scope.salesmanId = salesman ? salesman.salesman_id : null;
    }

    return scope;
}

function canViewAllOrders(roleName) {
    return canManageOrders(roleName);
}

module.exports = {
    resolveUserScope,
    canViewAllOrders,
};
