const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Collection = sequelize.define('Collection', {
    collection_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    collection_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    brand_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'brand',
            key: 'brand_id'
        }
    },
}, {
    tableName: 'collection',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Collection;