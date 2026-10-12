const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const UserRole = require('../models/UserRole');
const Party = require('../models/Party');
const msg91Service = require('../services/msg91Service');
const { ensureLoginUserByPhone, findPartyByPhone } = require('../utils/userFactory');
const { markPhoneVerified, consumePhoneVerification, normalizePhone } = require('../services/otpSession');
const { identifierMatchesPhone, allowUnboundToken } = require('../utils/otpBinding');
const { getJwtSecret } = require('../utils/jwtSecret');
const limiter = require('../utils/rateLimiter');

// Wrong-code protection: after this many failed verifications a phone (or an IP)
// is locked out for the window.
const FAIL_MAX_PHONE = 5;
const FAIL_MAX_IP = 30;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const failKeys = (req) => [`fail-phone:${limiter.phoneKey(req)}`, `fail-ip:${limiter.clientIp(req)}`];
// Returns true (and sends 429) when the caller is locked out.
const lockedOut = (req, res) => {
    const [pk, ik] = failKeys(req);
    for (const [k, max] of [[pk, FAIL_MAX_PHONE], [ik, FAIL_MAX_IP]]) {
        const r = limiter.blocked(k, max);
        if (!r.ok) { limiter.deny(res, r.retryAfterSec, 'Too many wrong or failed OTP attempts.'); return true; }
    }
    return false;
};
const recordFail = (req) => {
    const [pk, ik] = failKeys(req);
    limiter.hit(pk, FAIL_MAX_PHONE + 1, FAIL_WINDOW_MS);
    limiter.hit(ik, FAIL_MAX_IP + 1, FAIL_WINDOW_MS);
};

// Limits on how many codes one phone / device may ask for. Returns null when
// allowed, else { retryAfterSec, message }.
function checkSendLimits(req, kind) {
    const phone = limiter.phoneKey(req);
    const WIN = 15 * 60 * 1000;
    const checks = [
        [`otp-gap:${phone}`, 1, 30 * 1000, 'Please wait before asking for another code.'],
        [`otp-phone:${phone}`, 5, WIN, 'Too many codes requested for this number.'],
        ...(kind === 'resend' ? [[`otp-resend:${phone}`, 3, WIN, 'Too many resend requests for this number.']] : []),
        [`otp-ip:${limiter.clientIp(req)}`, 20, 60 * 60 * 1000, 'Too many code requests from this device.'],
    ];
    for (const [key, max, win, message] of checks) {
        const r = limiter.hit(key, max, win);
        if (!r.ok) return { retryAfterSec: r.retryAfterSec, message };
    }
    return null;
}

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
                // Self-heal: a party may own this phone but have no login user yet.
                // Recognize it here so OTP is sent; the actual user is created and
                // linked on the login call (after OTP is verified).
                const party = await findPartyByPhone(phoneNumber);
                if (party) {
                    return res.status(200).json({ message: 'User found' });
                }
                return res.status(400).json({ error: 'User not found' });
            }
            res.status(200).json({ message: 'User found' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { phoneNumber, accessToken, verificationTicket } = req.body;
            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            if (lockedOut(req, res)) return;

            const normalizedPhone = normalizePhone(phoneNumber);

            // Single-call OTP login: verify the MSG91 widget's access-token right
            // here. Falls back to the prior markPhoneVerified/consume flow if a
            // caller still verifies in a separate step.
            // Every number, with no exceptions, must prove it with a real OTP.
            if (accessToken) {
                const otp = await msg91Service.verifyAccessToken(accessToken);
                if (!otp.success) {
                    recordFail(req);
                    return res.status(401).json({ error: otp.message || 'OTP verification failed' });
                }
                // The proof must have been issued for THIS phone number. Without this
                // check, anyone could verify their own phone and use that proof to log
                // in as somebody else.
                if (!identifierMatchesPhone(otp.identifier, phoneNumber) && !allowUnboundToken()) {
                    console.warn('[auth] OTP proof does not match the phone number; login refused.',
                        { requested: normalizedPhone, verifiedFor: String(otp.identifier || '').slice(0, 4) + '…' });
                    recordFail(req);
                    return res.status(401).json({ error: 'This OTP was not verified for this phone number. Please request a new code.' });
                }
            } else if (!consumePhoneVerification(phoneNumber, verificationTicket)) {
                recordFail(req);
                return res.status(401).json({ error: 'OTP verification required before login' });
            }

            let user = await User.findOne({
                where: {
                    phone: phoneNumber,
                },
            });
            if (!user) {
                // Self-heal: OTP is already verified above, so if a PARTY owns this
                // phone but has no login user, create the party's user now and link
                // it, then continue the login. Never blocks — returns null on any
                // issue, falling through to the normal "user not found".
                user = await ensureLoginUserByPhone(phoneNumber);
            }
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

            if (role.role_name.toLowerCase() === 'party') {
                const party = await Party.findOne({ where: { user_id: user.user_id } });
                if (!party || !party.is_active) {
                    return res.status(403).json({ error: 'Party account is deactivated' });
                }
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

            // Security: a non-admin may only create the FIELD/partner account they
            // manage — never an office or admin login (that would be privilege
            // escalation). Admins may create any role.
            const callerRoles = (Array.isArray(req.userRoleNames) && req.userRoleNames.length
                ? req.userRoleNames
                : [req.userRoleName]
            ).map((r) => String(r || '').toLowerCase());
            const isCallerAdmin = callerRoles.includes('admin');
            if (!isCallerAdmin) {
                const managerToPartner = {
                    sales_manager: 'salesman',
                    party_manager: 'party',
                    distributor_manager: 'distributor',
                };
                const allowedPartnerRoles = callerRoles
                    .map((r) => managerToPartner[r])
                    .filter(Boolean);
                const targetRole = String(role.role_name || '').toLowerCase();
                if (!allowedPartnerRoles.includes(targetRole)) {
                    return res.status(403).json({
                        error: 'You can only create partner accounts for the roles you manage.',
                    });
                }
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

    // The OTP widget sends and re-sends codes straight from the browser, so the
    // server can't see those SMS. The page asks here FIRST for every send/resend;
    // this is where the limits are enforced (and counted).
    async otpRequest(req, res) {
        const phone = limiter.phoneKey(req);
        if (!phone || phone.length < 8) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        const kind = req.body && req.body.kind === 'resend' ? 'resend' : 'send';
        const denied = checkSendLimits(req, kind);
        if (denied) return limiter.deny(res, denied.retryAfterSec, denied.message);
        res.status(200).json({ message: 'OK' });
    }

    // Same limits as a middleware, for endpoints that themselves trigger a send.
    otpGate(req, res, next) {
        const phone = limiter.phoneKey(req);
        if (!phone) return next(); // handler returns its own 400
        const denied = checkSendLimits(req, 'send');
        if (denied) return limiter.deny(res, denied.retryAfterSec, denied.message);
        next();
    }

    async sendOtp(req, res) {
        try {
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
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

            if (!otp) {
                return res.status(400).json({ error: 'OTP is required' });
            }
            if (lockedOut(req, res)) return;

            const result = await msg91Service.verifyOtp(phoneNumber, otp);

            if (!result.success) {
                recordFail(req);
                return res.status(400).json({
                    error: result.message || 'Invalid OTP',
                    details: result.error,
                });
            }

            const verificationTicket = markPhoneVerified(phoneNumber);
            limiter.clear(failKeys(req)[0]);

            res.status(200).json({
                message: 'OTP verified successfully',
                verificationTicket,
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

            if (!accessToken) {
                return res.status(400).json({ error: 'Access token is required' });
            }
            if (!phoneNumber) {
                return res.status(400).json({ error: 'Phone number is required' });
            }
            if (lockedOut(req, res)) return;

            const result = await msg91Service.verifyAccessToken(accessToken);
            if (!result.success) {
                recordFail(req);
                return res.status(400).json({
                    error: result.message || 'Invalid access token',
                    details: result.error,
                });
            }
            // Same rule as login: the proof must belong to this phone number.
            if (!identifierMatchesPhone(result.identifier, phoneNumber) && !allowUnboundToken()) {
                recordFail(req);
                return res.status(400).json({ error: 'This OTP was not verified for this phone number. Please request a new code.' });
            }

            const verificationTicket = markPhoneVerified(phoneNumber);
            limiter.clear(failKeys(req)[0]);

            res.status(200).json({
                message: 'OTP verified successfully',
                verificationTicket,
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
