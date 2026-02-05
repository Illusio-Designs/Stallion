const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const UserRole = sequelize.define('UserRole', {
    user_role_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        },
        onDelete: 'CASCADE'
    },
    role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'roles',
            key: 'role_id'
        },
        onDelete: 'CASCADE'
    },
    assigned_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    assigned_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'user_id'
        }
    }
}, {
    tableName: 'user_roles',
    timestamps: false,
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'role_id']
        }
    ]
});

// Define associations (set up on load so they work without a central associate() call)
const User = require('./User');
const Role = require('./Role');

UserRole.belongsTo(User, {
    foreignKey: 'user_id',
    as: 'user'
});

UserRole.belongsTo(Role, {
    foreignKey: 'role_id',
    as: 'role'
});

UserRole.belongsTo(User, {
    foreignKey: 'assigned_by',
    as: 'assigner'
});

// Keep for any code that may call associate(models) in the future
UserRole.associate = function (models) {
    UserRole.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    UserRole.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role' });
    UserRole.belongsTo(models.User, { foreignKey: 'assigned_by', as: 'assigner' });
};

module.exports = UserRole;

