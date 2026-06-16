const axios = require('axios');

class Msg91Service {
    constructor() {
        this.apiKey = process.env.MSG91_AUTH_KEY || process.env.MSG91_API_KEY;
        this.templateId = process.env.MSG91_TEMPLATE_ID || null;
        this.baseUrl = 'https://control.msg91.com/api/v5';

        if (!this.apiKey) {
            console.warn('MSG91_AUTH_KEY is not set in environment variables');
        }
        if (!this.templateId) {
            console.warn('MSG91_TEMPLATE_ID is not set — MSG91 OTP send requires a template id');
        }
    }

    /**
     * Send OTP to a phone number
     * @param {string} phoneNumber - Phone number with country code (e.g., "919876543210")
     * @param {string} templateId - MSG91 template ID (optional, uses default if not provided)
     * @returns {Promise<Object>} Response from MSG91 API
     */
    async sendOtp(phoneNumber, templateId = null) {
        try {
            if (!this.apiKey) {
                throw new Error('MSG91_AUTH_KEY is not configured');
            }

            if (!phoneNumber) {
                throw new Error('Phone number is required');
            }

            // Remove any spaces, dashes, or special characters except +
            const cleanedPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
            
            const url = `${this.baseUrl}/otp`;
            const tid = templateId || this.templateId;
            const payload = { mobile: cleanedPhoneNumber };
            // MSG91 requires the OTP template id (DLT-approved) to send.
            if (tid) {
                payload.template_id = tid;
            }

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    authkey: this.apiKey, // MSG91 expects the auth key in the header
                },
            });

            return {
                success: true,
                data: response.data,
                message: 'OTP sent successfully',
            };
        } catch (error) {
            console.error('MSG91 Send OTP Error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to send OTP',
            };
        }
    }

    /**
     * Verify OTP for a phone number
     * @param {string} phoneNumber - Phone number with country code (e.g., "919876543210")
     * @param {string} otp - OTP code to verify
     * @returns {Promise<Object>} Response from MSG91 API
     */
    async verifyOtp(phoneNumber, otp) {
        try {
            if (!this.apiKey) {
                throw new Error('MSG91_AUTH_KEY is not configured');
            }

            if (!phoneNumber) {
                throw new Error('Phone number is required');
            }

            if (!otp) {
                throw new Error('OTP is required');
            }

            // Remove any spaces, dashes, or special characters except +
            const cleanedPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');

            const url = `${this.baseUrl}/otp/verify`;
            const response = await axios.get(url, {
                params: { mobile: cleanedPhoneNumber, otp },
                headers: { authkey: this.apiKey },
            });

            // MSG91 returns type "success" when OTP is verified
            const isVerified = response.data.type === 'success';

            return {
                success: isVerified,
                data: response.data,
                message: isVerified ? 'OTP verified successfully' : 'Invalid OTP',
            };
        } catch (error) {
            console.error('MSG91 Verify OTP Error:', error.response?.data || error.message);
            
            // Handle specific error cases
            let errorMessage = 'Failed to verify OTP';
            if (error.response?.data) {
                errorMessage = error.response.data.message || errorMessage;
            }

            return {
                success: false,
                error: error.response?.data || error.message,
                message: errorMessage,
            };
        }
    }

    /**
     * Verify the JWT access-token returned by the MSG91 OTP Widget (server side).
     * The widget verifies the OTP in the browser and returns an access-token;
     * the backend confirms it with the secret authkey so the OTP can't be faked.
     * @param {string} accessToken - JWT access-token from the widget
     * @returns {Promise<Object>}
     */
    async verifyAccessToken(accessToken) {
        try {
            if (!this.apiKey) {
                throw new Error('MSG91_AUTH_KEY is not configured');
            }
            if (!accessToken) {
                throw new Error('Access token is required');
            }

            const url = `${this.baseUrl}/widget/verifyAccessToken`;
            const response = await axios.post(url, {
                authkey: this.apiKey,
                'access-token': accessToken,
            }, {
                headers: { 'Content-Type': 'application/json' },
            });

            const ok = response.data && response.data.type === 'success';
            return {
                success: ok,
                data: response.data,
                message: ok ? 'Access token verified' : 'Invalid access token',
            };
        } catch (error) {
            console.error('MSG91 Verify Access Token Error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to verify access token',
            };
        }
    }
}

module.exports = new Msg91Service();
