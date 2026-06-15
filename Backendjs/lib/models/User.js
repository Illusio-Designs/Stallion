const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const jwt = require('jsonwebtoken');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  profile_image: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'roles',
      key: 'role_id'
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

// Define associations
User.associate = function (models) {
  User.belongsToMany(models.Role, {
    through: models.UserRole,
    foreignKey: 'user_id',
    otherKey: 'role_id',
    as: 'roles'
  });
};

// Generate JWT token for user
User.prototype.generateToken = async function () {
  const UserRole = require('./UserRole');
  const Role = require('./Role');

  // Get user roles
  const userRole = await UserRole.findOne({
    where: { user_id: this.user_id },
  });

  const roles = userRoles.map(ur => ur.role ? ur.role.role_name : null).filter(Boolean);

  return jwt.sign(
    {
      userId: this.user_id,
      phone: this.phone,
      email: this.email,
      full_name: this.full_name,
      roles: roles
    },
    process.env.JWT_SECRET || 'default_jwt_secret',
    { expiresIn: '24h' }
  );
};

// Instance method to get user's roles
User.prototype.getRoles = async function () {
  const UserRole = require('./UserRole');
  const Role = require('./Role');

  const userRoles = await UserRole.findAll({
    where: { user_id: this.user_id },
    include: [{
      model: Role,
      as: 'role'
    }]
  });

  return userRoles.map(ur => ({
    role_id: ur.role_id,
    role_name: ur.role ? ur.role.role_name : null,
    role_description: ur.role ? ur.role.description : null,
    assigned_at: ur.assigned_at
  }));
};

// Instance method to check if user is active
User.prototype.isActive = function () {
  return this.is_active === true;
};

module.exports = User; 