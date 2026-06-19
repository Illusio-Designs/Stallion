const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const msg91Service = require('../services/msg91Service');
const { allowedNumbers } = require('../constants/constants');
const { markPhoneVerified, consumePhoneVerification, normalizePhone } = require('../services/otpSession');
const { getJwtSecret } = require('../utils/jwtSecret');

class AuthController {

    async logout(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }
            const decoded = jwt.verify(token, getJwtSecret());
            const user = await User.findByPk(decoded.userId);
            if (!user) {
                return res.status(400).json({ error: 'User not found' });
            }
            await user.update({ last_login: null });
            res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async refreshToken(req, res) {
        try {
            const { token } = req.body;
            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }
            const decoded = jwt.verify(token, getJwtSecret());
            const user = await User.findByPk(decoded.userId);
            if (!user) {
                return res.status(400).json({ error: 'User not found' });
            }
            const newToken = jwt.sign({ userId: user.user_id }, getJwtSecret(), { expiresIn: '1h' });
            await user.update({ last_login: new Date() });
            res.status(200).json({ token: newToken });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async checkUser(req, res) {
        try {
            const { phoneNumber } = req.body;
            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            const user = await User.findOne({
                where: {
                    phone: phoneNumber,
                    is_active: true,
                },
            });
            if (!user) {
                return res.status(400).json({ error: 'User not found' });
            }
            res.status(200).json({ message: 'User found' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { phoneNumber, accessToken } = req.body;
            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }

            const normalizedPhone = normalizePhone(phoneNumber);
            const isBypassNumber = allowedNumbers.some((n) => normalizePhone(n) === normalizedPhone);

            // Single-call OTP login: verify the MSG91 widget's access-token right
            // here. Falls back to the prior markPhoneVerified/consume flow if a
            // caller still verifies in a separate step.
            if (!isBypassNumber) {
                if (accessToken) {
                    const otp = await msg91Service.verifyAccessToken(accessToken);
                    if (!otp.success) {
                        return res.status(401).json({ error: otp.message || 'OTP verification failed' });
                    }
                } else if (!consumePhoneVerification(phoneNumber)) {
                    return res.status(401).json({ error: 'OTP verification required before login' });
                }
            }

            const user = await User.findOne({
                where: {
                    phone: phoneNumber,
                    is_active: true,
                },
            });
            if (!user) {
                return res.status(400).json({ error: 'User not found' });
            }

            const userRole = await UserRole.findOne({ where: { user_id: user.user_id } });
            if (!userRole) {
                return res.status(400).json({ error: 'User role not found' });
            }

            const role = await Role.findOne({ where: { role_id: userRole.role_id } });
            if (!role) {
                return res.status(400).json({ error: 'Role not found' });
            }

            const token = jwt.sign(
                {
                    userId: user.user_id,
                    phone: user.phone,
                    email: user.email,
                    full_name: user.full_name,
                    role: role.role_name,
                },
                getJwtSecret(),
                { expiresIn: '24h' }
            );

            await user.update({ last_login: new Date() });

            res.status(200).json({ message: 'Login successful', token, role: role.role_name });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }

    async register(req, res) {
        try {
            const { phoneNumber, fullName, roleId, address } = req.body;
            if (!phoneNumber || !fullName || !roleId || !address) {
                return res.status(400).json({ error: 'Phone number, full name, role id, and address are required' });
            }

            const existingUser = await User.findOne({
                where: {
                    phone: phoneNumber,
                    is_active: true,
                },
            });
            if (existingUser) {
                return res.status(400).json({ error: 'User already exists' });
            }

            const role = await Role.findOne({ where: { role_id: roleId } });
            if (!role) {
                return res.status(400).json({ error: 'Role not found' });
            }

            const user = await User.create({
                phone: phoneNumber,
                full_name: fullName,
                address,
                role_id: roleId,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
            });

            await UserRole.create({
                user_id: user.user_id,
                role_id: role.role_id,
            });

            res.status(200).json(user.toJSON());
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }

    async sendOtp(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }

            if (allowedNumbers.includes(phoneNumber)) {
                return res.status(200).json({ message: 'OTP sent successfully' });
            }

            const result = await msg91Service.sendOtp(phoneNumber);

            if (!result.success) {
                return res.status(500).json({
                    error: result.message || 'Failed to send OTP',
                    details: result.error,
                });
            }

            res.status(200).json({
                message: 'OTP sent successfully',
                data: result.data,
            });
        } catch (error) {
            console.error('Send OTP Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async verifyOtp(req, res) {
        try {
            const { phoneNumber, otp } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }

            if (allowedNumbers.includes(phoneNumber)) {
                markPhoneVerified(phoneNumber);
                return res.status(200).json({ message: 'OTP verified successfully' });
            }

            if (!otp) {
                return res.status(400).json({ error: 'OTP is required' });
            }

            const result = await msg91Service.verifyOtp(phoneNumber, otp);

            if (!result.success) {
                return res.status(400).json({
                    error: result.message || 'Invalid OTP',
                    details: result.error,
                });
            }

            markPhoneVerified(phoneNumber);

            res.status(200).json({
                message: 'OTP verified successfully',
                data: result.data,
            });
        } catch (error) {
            console.error('Verify OTP Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    // Verify the JWT access-token from the MSG91 OTP widget (server side).
    async verifyAccessToken(req, res) {
        try {
            const { accessToken, phoneNumber } = req.body;

            // Whitelisted numbers skip MSG91 entirely.
            if (phoneNumber && allowedNumbers.includes(phoneNumber)) {
                markPhoneVerified(phoneNumber);
                return res.status(200).json({ message: 'OTP verified successfully' });
            }

            if (!accessToken) {
                return res.status(400).json({ error: 'Access token is required' });
            }

            const result = await msg91Service.verifyAccessToken(accessToken);
            if (!result.success) {
                return res.status(400).json({
                    error: result.message || 'Invalid access token',
                    details: result.error,
                });
            }

            if (phoneNumber) markPhoneVerified(phoneNumber);

            res.status(200).json({
                message: 'OTP verified successfully',
                data: result.data,
            });
        } catch (error) {
            console.error('Verify Access Token Error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async checkToken(req, res) {
        try {
            res.status(200).json({ message: 'Token is valid' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AuthController();
