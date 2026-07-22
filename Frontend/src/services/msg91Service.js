/**
 * MSG91 OTP Widget integration (official otp-provider.js script + exposeMethods).
 *
 * The widget sends/verifies the OTP in the browser (channel — SMS/WhatsApp/Email
 * — is configured in the MSG91 dashboard, so it works without managing DLT here)
 * and returns a JWT access-token on verify. That token is then verified
 * SERVER-SIDE via the backend (POST /auth/login or /auth/verify-token with the
 * secret authkey) so the OTP can't be spoofed and the authkey never ships to the
 * browser.
 *
 * Required env: NEXT_PUBLIC_MSG91_WIDGET_ID, NEXT_PUBLIC_MSG91_TOKEN_AUTH
 */

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '';
const TOKEN_AUTH = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH || '';
const WIDGET_SCRIPT = 'https://verify.msg91.com/otp-provider.js';

let widgetReady = false;
let widgetLoading = null;
let currentAccessToken = null;
let currentPhoneNumber = null;

/** Format to MSG91 form: digits only, with country code, no + (e.g. 919999999999). */
export const formatPhoneNumberForMSG91 = (phoneNumber) => {
  if (!phoneNumber) return '';
  const digits = String(phoneNumber).replace(/\D/g, '');
  if (digits.startsWith('91')) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

/** Load otp-provider.js once and run initSendOTP with exposeMethods enabled. */
const ensureWidget = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if (widgetReady && typeof window.sendOtp === 'function') return Promise.resolve();
  if (widgetLoading) return widgetLoading;
  if (!WIDGET_ID) return Promise.reject(new Error('NEXT_PUBLIC_MSG91_WIDGET_ID is not set'));
  if (!TOKEN_AUTH) return Promise.reject(new Error('NEXT_PUBLIC_MSG91_TOKEN_AUTH is not set'));

  widgetLoading = new Promise((resolve, reject) => {
    // Overall budget for the whole "load script -> initSendOTP appears -> methods
    // exposed" sequence. Every step below shares this deadline.
    const OVERALL_TIMEOUT_MS = 15000;
    const startedAt = Date.now();

    const doInit = () => {
      try {
        window.initSendOTP({
          widgetId: WIDGET_ID,
          tokenAuth: TOKEN_AUTH,
          exposeMethods: true, // expose window.sendOtp/verifyOtp/retryOtp, no popup
          success: () => {},
          failure: () => {},
        });
      } catch (e) {
        reject(e);
        return;
      }
      // exposeMethods attaches window.sendOtp/verifyOtp/retryOtp ASYNCHRONOUSLY,
      // so wait until they actually exist before resolving.
      const waitForMethods = () => {
        if (typeof window.sendOtp === 'function' && typeof window.verifyOtp === 'function') {
          widgetReady = true;
          resolve();
        } else if (Date.now() - startedAt > OVERALL_TIMEOUT_MS) {
          reject(new Error('MSG91 widget methods not exposed — check NEXT_PUBLIC_MSG91_WIDGET_ID / NEXT_PUBLIC_MSG91_TOKEN_AUTH'));
        } else {
          setTimeout(waitForMethods, 100);
        }
      };
      waitForMethods();
    };

    // The script's `load` event can fire a tick BEFORE it attaches
    // window.initSendOTP, so don't reject on the first miss — POLL for it until
    // it appears (or we hit the deadline). This is the intermittent
    // "widget loaded but initSendOTP is unavailable" fix.
    const waitForInit = () => {
      if (typeof window.initSendOTP === 'function') {
        doInit();
      } else if (Date.now() - startedAt > OVERALL_TIMEOUT_MS) {
        reject(new Error('MSG91 widget loaded but initSendOTP is unavailable. Please retry.'));
      } else {
        setTimeout(waitForInit, 100);
      }
    };

    // Make sure the script tag exists (add it once), then poll for initSendOTP
    // regardless of the load-event timing — covers already-loaded scripts too.
    if (typeof window.initSendOTP !== 'function') {
      const existing = document.querySelector(`script[src="${WIDGET_SCRIPT}"]`);
      if (!existing) {
        const s = document.createElement('script');
        s.src = WIDGET_SCRIPT;
        s.async = true;
        s.onerror = () => reject(new Error('Failed to load MSG91 widget script'));
        document.body.appendChild(s);
      }
    }
    waitForInit();
  }).catch((e) => {
    // Reset so a later attempt can retry instead of reusing a rejected promise.
    widgetLoading = null;
    throw e;
  });
  return widgetLoading;
};

const extractToken = (data) =>
  (data && (data.message || data['access-token'] || data.accessToken || data.token)) || null;

/** Load + init the widget (call once before send). */
export const initializeOTPWidget = async (phoneNumber) => {
  await ensureWidget();
  currentPhoneNumber = formatPhoneNumberForMSG91(phoneNumber);
  return { initialized: true, phoneNumber: currentPhoneNumber };
};

const describeError = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || error.type || error.errorMessage ||
    (Object.keys(error).length ? JSON.stringify(error) : fallback);
};

/** Send OTP to a phone number (identifier may also be an email). */
export const sendOTP = async (phoneNumber) => {
  await ensureWidget();
  const phone = formatPhoneNumberForMSG91(phoneNumber);
  currentPhoneNumber = phone;
  return new Promise((resolve, reject) => {
    window.sendOtp(
      phone,
      (data) => resolve({ success: true, message: 'OTP sent successfully', data }),
      (error) => {
        console.warn('[MSG91] sendOtp failed:', error);
        reject({ success: false, message: describeError(error, 'Failed to send OTP'), error });
      }
    );
  });
};

/** Verify the OTP the user entered; resolves with the JWT access-token. */
export const verifyOTP = async (otp) => {
  await ensureWidget();
  return new Promise((resolve, reject) => {
    window.verifyOtp(
      otp,
      (data) => {
        const token = extractToken(data);
        currentAccessToken = token;
        resolve({ success: true, message: 'OTP verified successfully', data, accessToken: token });
      },
      (error) => {
        console.warn('[MSG91] verifyOtp failed:', error);
        reject({ success: false, message: describeError(error, 'Invalid OTP'), error });
      }
    );
  });
};

/** Resend OTP. channel: null = widget default; '11' SMS, '4' Voice, '3' Email, '12' WhatsApp. */
export const resendOTP = async (channel = null) => {
  await ensureWidget();
  return new Promise((resolve, reject) => {
    if (typeof window.retryOtp !== 'function') {
      // Widget lost its methods — resend by starting a fresh OTP instead of failing.
      resendViaFreshSend(resolve, reject);
      return;
    }
    window.retryOtp(
      channel,
      (data) => resolve({ success: true, message: 'OTP resent successfully', data }),
      (error) => {
        // retryOtp needs a live widget session (reqId). If it's gone (idle page,
        // re-init), fall back to a fresh sendOtp so the user still gets a code.
        console.warn('[MSG91] retryOtp failed, falling back to a fresh send:', error);
        resendViaFreshSend(resolve, reject, error);
      }
    );
  });
};

// Fallback: send a brand-new OTP to the current number when retryOtp can't.
const resendViaFreshSend = (resolve, reject, originalError) => {
  if (typeof window.sendOtp !== 'function' || !currentPhoneNumber) {
    reject({ success: false, message: describeError(originalError, 'Failed to resend OTP'), error: originalError });
    return;
  }
  window.sendOtp(
    currentPhoneNumber,
    (data) => resolve({ success: true, message: 'OTP resent successfully', data }),
    (error) => {
      console.warn('[MSG91] fresh sendOtp (resend fallback) failed:', error);
      reject({ success: false, message: describeError(error, 'Failed to resend OTP'), error });
    }
  );
};

export const getAccessToken = () => currentAccessToken;
export const getCurrentPhone = () => currentPhoneNumber;

export const destroyOTPWidget = () => {
  currentAccessToken = null;
  currentPhoneNumber = null;
};

/**
 * Kept for backward compatibility. Real verification is SERVER-SIDE now
 * (the backend calls MSG91 /widget/verifyAccessToken with the secret authkey).
 */
export const verifyAccessToken = async (accessToken = null) => ({
  success: true,
  accessToken: accessToken || currentAccessToken,
});

// Legacy aliases
export const getJWTToken = getAccessToken;
export const verifyOTPWithWidget = verifyOTP;
export const resendOTPWithWidget = resendOTP;
export const getWidgetMethods = () =>
  (typeof window !== 'undefined'
    ? { sendOtp: window.sendOtp, verifyOtp: window.verifyOtp, retryOtp: window.retryOtp }
    : null);
