
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
    indexes: [
        { fields: ['distributor_id'], name: 'idx_distributor_zones_distributor_id' },
        { fields: ['zone_id'], name: 'idx_distributor_zones_zone_id' },
        { fields: ['distributor_id', 'zone_id'], name: 'idx_distributor_zones_dist_zone_unique', unique: true },
    ],
});

module.exports = DistributorZones;