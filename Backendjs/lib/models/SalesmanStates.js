
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const SalesmanStates = sequelize.define('SalesmanStates', {
    state_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'states',
            key: 'id'
        }
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
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
