

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Salesman = require('./Salesman');

const SalesmanExpense = sequelize.define('SalesmanExpense', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
    },
    expense_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    expense_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    expense_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    expense_type: {
        // 'fuel' is kept only so old rows still load; new expenses use the other types.
        type: DataTypes.ENUM('fuel', 'hotel', 'travel', 'other', 'food', 'city_tour', 'toll'),
        allowNull: false
    },
    images: {
        type: DataTypes.JSON,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
    },
    kilometers: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    // Travel only: how the salesman travelled (bus, train, rapido, ...).
    travel_mode: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    // Toll only: the note the salesman writes about the toll.
    toll_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'salesman_expense',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['salesman_id'], name: 'idx_salesman_expense_salesman_id' },
        { fields: ['status'], name: 'idx_salesman_expense_status' },
        { fields: ['expense_date'], name: 'idx_salesman_expense_date' },
        { fields: ['salesman_id', 'status'], name: 'idx_salesman_expense_salesman_status' },
    ],
});

SalesmanExpense.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id',
    as: 'salesman',
});

module.exports = SalesmanExpense;