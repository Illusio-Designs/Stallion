const axios = require('axios');

class Msg91Service {
    constructor() {
        this.apiKey = process.env.MSG91_API_KEY;
        this.baseUrl = 'https://control.msg91.com/api/v5';
        
        if (!this.apiKey) {
            console.warn('MSG91_API_KEY is not set in environment variables');
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
                throw new Error('MSG91_API_KEY is not configured');
            }

            if (!phoneNumber) {
                throw new Error('Phone number is required');
            }

            // Remove any spaces, dashes, or special characters except +
            const cleanedPhoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
            
            const url = `${this.baseUrl}/otp`;
            const payload = {
                authkey: this.apiKey,
                mobile: cleanedPhoneNumber,
            };

            // Add template ID if provided
            if (templateId) {
                payload.template_id = templateId;
            }

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
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
                throw new Error('MSG91_API_KEY is not configured');
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
            const params = {
                authkey: this.apiKey,
                mobile: cleanedPhoneNumber,
                otp: otp,
            };

            const response = await axios.get(url, { params });

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
}

module.exports = new Msg91Service();
