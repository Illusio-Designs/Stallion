const SalesmanStates = require('../models/SalesmanStates');
const DistributorStates = require('../models/DistributorStates');
const Salesman = require('../models/Salesman');
const Distributor = require('../models/distributor');

// A salesman or distributor works in a set of states. A party belongs to the state it
// is in, so every salesman working in that state can see and use the party.

async function salesmanStateIds(salesmanId) {
    if (!salesmanId) return [];
    const rows = await SalesmanStates.findAll({ where: { salesman_id: salesmanId } });
    const ids = rows.map((r) => String(r.state_id));
    const salesman = await Salesman.findOne({ where: { salesman_id: salesmanId }, attributes: ['state_id'] });
    if (salesman && salesman.state_id && !ids.includes(String(salesman.state_id))) ids.push(String(salesman.state_id));
    return ids;
}

async function distributorStateIds(distributorId) {
    if (!distributorId) return [];
    const rows = await DistributorStates.findAll({ where: { distributor_id: distributorId } });
    const ids = rows.map((r) => String(r.state_id));
    const distributor = await Distributor.findOne({ where: { distributor_id: distributorId }, attributes: ['state_id'] });
    if (distributor && distributor.state_id && !ids.includes(String(distributor.state_id))) ids.push(String(distributor.state_id));
    return ids;
}

async function salesmanCoversState(salesmanId, stateId) {
    if (!stateId) return false;
    return (await salesmanStateIds(salesmanId)).includes(String(stateId));
}

async function distributorCoversState(distributorId, stateId) {
    if (!stateId) return false;
    return (await distributorStateIds(distributorId)).includes(String(stateId));
}

module.exports = { salesmanStateIds, distributorStateIds, salesmanCoversState, distributorCoversState };
