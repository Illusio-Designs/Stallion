const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');

// Optionally runs inside a caller-provided transaction so partner creation
// (salesman/distributor/party) is ATOMIC — if the partner record fails, the
// login user it would have created rolls back too, leaving no orphan.
async function findOrCreateRoleUser({ phone, email, fullName, roleName, address }, options = {}) {
    const { transaction } = options;
    if (!phone) {
        throw new Error('Phone is required to create a login user');
    }
    if (!address) {
        throw new Error('Address is required to create a login user');
    }

    const role = await Role.findOne({ where: { role_name: roleName }, transaction });
    if (!role) {
        throw new Error(`Role '${roleName}' not found`);
    }

    let user = await User.findOne({ where: { phone, is_active: true }, transaction });
    if (!user && email) {
        user = await User.findOne({ where: { email, is_active: true }, transaction });
    }

    if (user) {
        const existingUserRole = await UserRole.findOne({
            where: { user_id: user.user_id, role_id: role.role_id },
            transaction,
        });
        if (!existingUserRole) {
            await UserRole.create({
                user_id: user.user_id,
                role_id: role.role_id,
            }, { transaction });
        }
        return user;
    }

    user = await User.create({
        phone,
        email: email || null,
        full_name: fullName,
        address,
        role_id: role.role_id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
    }, { transaction });

    await UserRole.create({
        user_id: user.user_id,
        role_id: role.role_id,
    }, { transaction });

    return user;
}

module.exports = { findOrCreateRoleUser };
