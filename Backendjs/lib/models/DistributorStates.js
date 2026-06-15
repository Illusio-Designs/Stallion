
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// NOTE: no FK `references` here on purpose — the join table is created plainly
// so it can never fail to sync on a MySQL foreign-key/collation mismatch.
// Integrity (valid state/distributor ids) is enforced in the controllers.
const DistributorStates = sequelize.define('DistributorStates', {
    state_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    distributor_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    tableName: 'distributor_states',
    timestamps: false,
    indexes: [
        { fields: ['distributor_id'], name: 'idx_distributor_states_distributor_id' },
        { fields: ['state_id'], name: 'idx_distributor_states_state_id' },
        { fields: ['distributor_id', 'state_id'], name: 'idx_distributor_states_unique', unique: true },
    ],
});

module.exports = DistributorStates;
