const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Role = require('../models/Role');
const { logAudit } = require('../utils/auditLogger');
const UserRole = require('../models/UserRole');
const Salesman = require('../models/Salesman');
const Party = require('../models/Party');
const Distributor = require('../models/distributor');
const { canManageUsers } = require('../utils/roleHelpers');
const sequelize = require('../constants/database');

class UserController {
    async getUsers(req, res) {
        try {
            const roles = await Role.findAll(
                {
                    where: {
                        is_office_role: true
                    }
                }
            );
            const roleIds = roles.map(role => role.role_id);
            const users = await User.findAll(
                {
                    where: {
                        role_id: {
                            [Op.in]: roleIds
                        }
                    },
                    // Include every assigned role (multi-role) so the office-team
                    // UI can show/edit all of a member's roles, not just primary.
                    include: [{
                        model: Role,
                        as: 'roles',
                        attributes: ['role_id', 'role_name'],
                        through: { attributes: [] },
                    }],
                }
            );
            res.status(200).json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async deleteUser(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const callerId = (req.user && req.user.user_id) || null;

            // Never allow deleting the protected superadmin or your own account —
            // that could lock everyone out.
            const PROTECTED_ADMIN_EMAIL = 'illusiodesigns@gmail.com';
            if (user.email && user.email.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
                return res.status(403).json({ error: 'This is the protected superadmin account and cannot be deleted.' });
            }
            if (callerId && String(callerId) === String(id)) {
                return res.status(400).json({ error: 'You cannot delete your own account while logged in as it.' });
            }

            // Block only when the user OWNS a business entity — deleting would
            // orphan its data (orders, etc.). Those must be removed/reassigned first.
            const [ownParty, ownSalesman, ownDistributor] = await Promise.all([
                Party.findOne({ where: { user_id: id }, attributes: ['party_id'] }),
                Salesman.findOne({ where: { user_id: id }, attributes: ['salesman_id'] }),
                Distributor.findOne({ where: { user_id: id }, attributes: ['distributor_id'] }),
            ]);
            const owns = [];
            if (ownDistributor) owns.push('a distributor');
            if (ownSalesman) owns.push('a salesman');
            if (ownParty) owns.push('a party');
            if (owns.length) {
                return res.status(409).json({
                    error: `Cannot delete this user because they are linked to ${owns.join(', ')} record. Delete or reassign that record first, then delete the user.`,
                });
            }

            const snapshot = user.toJSON();

            // Auto-clean the SAFE links so a user with no owned business entity can
            // be deleted: remove their own role rows, null the nullable "assigned by"
            // pointer, and reassign the NOT-NULL "created by" attribution to the admin
            // performing the delete (non-destructive — no business data is removed).
            await sequelize.transaction(async (t) => {
                await UserRole.destroy({ where: { user_id: id }, transaction: t });
                await UserRole.update({ assigned_by: null }, { where: { assigned_by: id }, transaction: t });
                if (callerId) {
                    await Party.update({ created_by: callerId }, { where: { created_by: id }, transaction: t });
                    await Salesman.update({ created_by: callerId }, { where: { created_by: id }, transaction: t });
                    await Distributor.update({ created_by: callerId }, { where: { created_by: id }, transaction: t });
                }
                await user.destroy({ transaction: t });
            });

            await logAudit({
                req,
                action: 'delete',
                description: 'User deleted (safe links auto-cleaned)',
                tableName: 'users',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'User deleted successfully' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async createUser(req, res) {
        try {
            const { name, is_active, phone, role_id, role_ids, email, image_url, address, country_id, state_id, city_id } = req.body;
            if (!address) {
                return res.status(400).json({ error: 'Address is required' });
            }
            // Support multiple roles: role_ids (array) is preferred; role_id is
            // kept for backward compatibility. The first role becomes the user's
            // primary role_id; all of them are written to user_roles.
            let roleIdList = Array.isArray(role_ids) ? role_ids.filter(Boolean).map(String) : [];
            if (roleIdList.length === 0 && role_id) roleIdList = [String(role_id)];
            roleIdList = [...new Set(roleIdList)];
            if (roleIdList.length === 0) {
                return res.status(400).json({ error: 'At least one role is required' });
            }
            const foundRoles = await Role.findAll({ where: { role_id: { [Op.in]: roleIdList } } });
            if (foundRoles.length !== roleIdList.length) {
                return res.status(404).json({ error: 'One or more roles not found' });
            }
            const primaryRoleId = roleIdList[0];
            const user = await User.create({
                full_name: name,
                phone: phone,
                email: email,
                address,
                country_id: country_id || null,
                state_id: state_id || null,
                city_id: city_id || null,
                role_id: primaryRoleId,
                is_active: is_active,
                profile_image: image_url,
                created_at: new Date(),
                updated_at: new Date()
            });
            await UserRole.bulkCreate(roleIdList.map((rid) => ({
                user_id: user.user_id,
                role_id: rid,
            })));
            await logAudit({
                req,
                action: 'create',
                description: 'User created',
                tableName: 'users',
                recordId: user.user_id,
                oldValues: null,
                newValues: user,
            });
            res.status(200).json(user);
        } catch (error) {
            console.log("error", error);
            res.status(500).json({ error: error.message });
        }
    }
    async updateUser(req, res) {
        try {
            const id = req.user.user_id;
            console.log("id", id);
            const { name, is_active, phone, role_id, email, image_url, address, country_id, state_id, city_id } = req.body;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updates = {
                full_name: name !== undefined ? name : user.full_name,
                phone: phone !== undefined ? phone : user.phone,
                email: email !== undefined ? email : user.email,
                address: address !== undefined ? address : user.address,
                country_id: country_id !== undefined ? (country_id || null) : user.country_id,
                state_id: state_id !== undefined ? (state_id || null) : user.state_id,
                city_id: city_id !== undefined ? (city_id || null) : user.city_id,
                profile_image: image_url !== undefined ? image_url : user.profile_image,
                updated_at: new Date(),
            };

            if (!updates.address) {
                return res.status(400).json({ error: 'Address is required' });
            }

            if (is_active !== undefined) {
                updates.is_active = is_active;
            }

            if (role_id !== undefined && canManageUsers(req.userRoleName)) {
                const role = await Role.findByPk(role_id);
                if (!role) {
                    return res.status(404).json({ error: 'Role not found' });
                }
                updates.role_id = role_id;
            } else if (role_id !== undefined && role_id !== user.role_id) {
                return res.status(403).json({ error: 'Only admins can change user roles' });
            }

            const oldSnapshot = user.toJSON();

            await user.update(updates);
            const salesmen = await Salesman.findOne({ where: { user_id: user.user_id } });
            if (salesmen) {
                await salesmen.update({
                    full_name: name || salesmen.full_name,
                    phone: phone || salesmen.phone,
                    email: email || salesmen.email,
                    address: address || salesmen.address,
                    updated_at: new Date()
                });
            }
            const party = await Party.findOne({ where: { user_id: user.user_id } });
            if (party) {
                await party.update({
                    party_name: name || party.party_name,
                    phone: phone || party.phone,
                    email: email || party.email,
                    address: address || party.address,
                    updated_at: new Date()
                });
            }
            const distributor = await Distributor.findOne({ where: { user_id: user.user_id } });
            if (distributor) {
                await distributor.update({
                    distributor_name: name || distributor.distributor_name,
                    phone: phone || distributor.phone,
                    email: email || distributor.email,
                    address: address || distributor.address,
                    updated_at: new Date()
                });
            }

            await logAudit({
                req,
                action: 'update',
                description: 'User updated',
                tableName: 'users',
                recordId: user.user_id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...updates },
            });
            const updatedUser = await User.findByPk(id);
            res.status(200).json(updatedUser);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Admin: update ANY user by id (office-team management). updateUser above
    // only updates the logged-in user's own profile, so it can't be used to
    // edit another office-team member.
    async updateUserById(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            const { name, is_active, phone, role_id, role_ids, email, image_url, address, country_id, state_id, city_id } = req.body;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Multi-role: role_ids (array) preferred, role_id kept for back-compat.
            // null => roles not being changed in this request.
            let roleIdList = Array.isArray(role_ids) ? role_ids.filter(Boolean).map(String) : null;
            if (roleIdList === null && role_id !== undefined && role_id !== null && role_id !== '') {
                roleIdList = [String(role_id)];
            }
            if (roleIdList) {
                roleIdList = [...new Set(roleIdList)];
                if (roleIdList.length === 0) {
                    return res.status(400).json({ error: 'At least one role is required' });
                }
                const foundRoles = await Role.findAll({ where: { role_id: { [Op.in]: roleIdList } } });
                if (foundRoles.length !== roleIdList.length) {
                    return res.status(404).json({ error: 'One or more roles not found' });
                }
            }

            const updates = {
                full_name: name !== undefined ? name : user.full_name,
                phone: phone !== undefined ? phone : user.phone,
                email: email !== undefined ? email : user.email,
                address: address !== undefined ? address : user.address,
                country_id: country_id !== undefined ? (country_id || null) : user.country_id,
                state_id: state_id !== undefined ? (state_id || null) : user.state_id,
                city_id: city_id !== undefined ? (city_id || null) : user.city_id,
                profile_image: image_url !== undefined ? image_url : user.profile_image,
                updated_at: new Date(),
            };

            if (!updates.address) {
                return res.status(400).json({ error: 'Address is required' });
            }
            if (is_active !== undefined) {
                updates.is_active = is_active;
            }
            if (roleIdList) {
                updates.role_id = roleIdList[0]; // first is the primary role
            }

            const oldSnapshot = user.toJSON();
            await user.update(updates);

            // Replace the role mapping table with the new set when roles change.
            if (roleIdList) {
                await UserRole.destroy({ where: { user_id: user.user_id } });
                await UserRole.bulkCreate(roleIdList.map((rid) => ({
                    user_id: user.user_id,
                    role_id: rid,
                })));
            }

            await logAudit({
                req,
                action: 'update',
                description: 'User updated (admin)',
                tableName: 'users',
                recordId: user.user_id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...updates },
            });
            const updatedUser = await User.findByPk(id);
            res.status(200).json(updatedUser);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }


    // Upload profile image
    async uploadProfileImage(req, res) {
        try {
            console.log("req.fileInfo", req.fileInfo);
            if (!req.fileInfo) {
                console.log("No file uploaded");
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const id = req.user.user_id;
            const user = await User.findByPk(id);

            if (!user) {
                console.log("User not found");
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Delete old profile image if exists
            if (user.profile_image) {
                const oldImagePath = path.join(__dirname, '../uploads/profile', user.profile_image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // Update user with new image
            await user.update({
                profile_image: req.fileInfo.filename
            });
            const updatedUser = await User.findByPk(id);
            res.status(200).json(updatedUser);
        } catch (error) {
            console.log("error", error);
            res.status(500).json({
                success: false,
                message: 'Error uploading profile image',
                error: error.message
            });
        }
    };

    async getMe(req, res) {
        try {
            res.status(200).json(req.user);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getUserRole(req, res) {
        try {
            const user = req.user;

            const userRoles = await UserRole.findAll({
                where: { user_id: user.user_id },
                include: [{
                    model: Role,
                    as: 'role'
                }]
            });
            const roles = userRoles.map(ur => ({
                role_id: ur.role_id,
                role_name: ur.role ? ur.role.role_name : null,
                role_description: ur.role ? ur.role.description : null,
                assigned_at: ur.assigned_at
            }));
            res.status(200).json(roles);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new UserController();