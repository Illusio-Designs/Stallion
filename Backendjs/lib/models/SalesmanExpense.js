

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const SalesmanExpense = sequelize.define('SalesmanExpense', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    salesman_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
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
        type: DataTypes.ENUM('fuel', 'hotel', 'travel', 'other'),
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
}, {
    tableName: 'salesman_expense',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = SalesmanExpense;