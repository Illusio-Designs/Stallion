
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const DistributorZones = sequelize.define('DistributorZones', {
    zone_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'zones',
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
    tableName: 'distributor_zones',
    timestamps: false,
});

module.exports = DistributorZones;