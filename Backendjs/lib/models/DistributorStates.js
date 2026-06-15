
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const DistributorStates = sequelize.define('DistributorStates', {
    state_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'states',
            key: 'id'
        }
    },
    distributor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'distributors',
            key: 'distributor_id'
        }
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
