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
            console.log("roleIds", roleIds);
            const users = await User.findAll(
                {
                    where: {
                        role_id: {
                            [Op.in]: roleIds
                        }
                    }
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
            const snapshot = user.toJSON();
            await user.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'User deleted',
                tableName: 'users',
                recordId: user.user_id,
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
            const { name, is_active, phone, role_id, email, image_url, address } = req.body;
            if (!address) {
                return res.status(400).json({ error: 'Address is required' });
            }
            const role = await Role.findByPk(role_id);
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            const user = await User.create({
                full_name: name,
                phone: phone,
                email: email,
                address,
                role_id: role_id,
                is_active: is_active,
                profile_image: image_url,
                created_at: new Date(),
                updated_at: new Date()
            });
            await UserRole.create({
                user_id: user.user_id,
                role_id: role_id
            });
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
            const { name, is_active, phone, role_id, email, image_url, address } = req.body;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updates = {
                full_name: name !== undefined ? name : user.full_name,
                phone: phone !== undefined ? phone : user.phone,
                email: email !== undefined ? email : user.email,
                address: address !== undefined ? address : user.address,
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