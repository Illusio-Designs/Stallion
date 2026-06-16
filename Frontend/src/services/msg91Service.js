/**
 * OTP via the backend MSG91 OTP API (the flow that works with MSG91's default
 * OTP template — no DLT registration, no widget, no WhatsApp setup needed).
 *
 *   sendOTP   -> POST /auth/send-otp   (backend calls MSG91 /otp with the authkey)
 *   verifyOTP -> POST /auth/verify-otp (backend verifies + marks the phone verified)
 *   login     -> POST /auth/login      (backend consumes that verification)
 *
 * The phone is passed through in the SAME E.164 form (+91…) used for check-user
 * and login, because the backend's verified-phone session is keyed on that exact
 * string (it only strips spaces/dashes, not the leading +).
 */

import { apiRequest } from './api/client';

// The phone for the current OTP attempt (set on send / initialize, reused on verify/resend).
let currentPhoneNumber = null;

/** Digits-only with country code, no + (e.g. 919999999999). Kept for callers that need it. */
export const formatPhoneNumberForMSG91 = (phoneNumber) => {
  if (!phoneNumber) return '';
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

/** Send the OTP. Resolves with the backend response, throws on failure. */
export const sendOTP = async (phoneNumber) => {
  currentPhoneNumber = phoneNumber;
  return apiRequest('/auth/send-otp', {
    method: 'POST',
    body: { phoneNumber },
    includeAuth: false,
  });
};

/** No widget to load anymore — just remember the phone for verify/resend. */
export const initializeOTPWidget = async (phoneNumber) => {
  currentPhoneNumber = phoneNumber;
  return { initialized: true, phoneNumber };
};

/**
 * Verify the entered OTP. Throws (via apiRequest) on an invalid code.
 * accessToken is null in this flow — the backend marks the phone verified and
 * login() consumes that, so login is called without a token.
 */
export const verifyOTP = async (otp, phoneNumber = currentPhoneNumber) => {
  const res = await apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: { phoneNumber, otp },
    includeAuth: false,
  });
  return { success: true, message: res?.message || 'OTP verified successfully', data: res, accessToken: null };
};

/** Resend = send the OTP again to the same number. */
export const resendOTP = async (phoneNumber = currentPhoneNumber) => {
  const res = await apiRequest('/auth/send-otp', {
    method: 'POST',
    body: { phoneNumber },
    includeAuth: false,
  });
  return { success: true, message: res?.message || 'OTP resent successfully', data: res };
};

export const getCurrentPhone = () => currentPhoneNumber;

export const destroyOTPWidget = () => {
  currentPhoneNumber = null;
};

// Legacy aliases (kept so older imports don't break).
export const verifyOTPWithWidget = verifyOTP;
export const resendOTPWithWidget = resendOTP;
