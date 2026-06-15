
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// NOTE: no FK `references` here on purpose — the join table is created plainly
// so it can never fail to sync on a MySQL foreign-key/collation mismatch.
// Integrity (valid state/salesman ids) is enforced in the controllers.
const SalesmanStates = sequelize.define('SalesmanStates', {
    state_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    tableName: 'salesman_states',
    timestamps: false,
    indexes: [
        { fields: ['salesman_id'], name: 'idx_salesman_states_salesman_id' },
        { fields: ['state_id'], name: 'idx_salesman_states_state_id' },
        { fields: ['salesman_id', 'state_id'], name: 'idx_salesman_states_unique', unique: true },
    ],
});

module.exports = SalesmanStates;
