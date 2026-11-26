// Which distributor handles an order. Every order that belongs to a party gets one:
//   1. the party's own distributor, if one is assigned to it;
//   2. else the distributor whose WORKING STATES include the party's state;
//   3. else a distributor whose home state is the party's state.
// When several distributors cover the state the earliest created active one is used, so the
// answer is always the same for the same party.
const Distributor = require('../models/distributor');
const DistributorStates = require('../models/DistributorStates');

async function resolveDistributorIdForParty(party, transaction) {
    if (!party) return null;
    const opts = transaction ? { transaction } : {};

    if (party.distributor_id) {
        const own = await Distributor.findOne({ where: { distributor_id: party.distributor_id }, ...opts });
        if (own && own.is_active !== false) return own.distributor_id;
    }
    if (!party.state_id) return null;

    const links = await DistributorStates.findAll({ where: { state_id: party.state_id }, ...opts });
    const ids = links.map((l) => l.distributor_id);
    if (ids.length) {
        const matches = await Distributor.findAll({
            where: { distributor_id: ids },
            order: [['created_at', 'ASC'], ['distributor_id', 'ASC']],
            ...opts,
        });
        const active = matches.find((d) => d.is_active !== false);
        if (active) return active.distributor_id;
    }
    const home = await Distributor.findAll({
        where: { state_id: party.state_id },
        order: [['created_at', 'ASC'], ['distributor_id', 'ASC']],
        ...opts,
    });
    const homeActive = home.find((d) => d.is_active !== false);
    return homeActive ? homeActive.distributor_id : null;
}

module.exports = { resolveDistributorIdForParty };
