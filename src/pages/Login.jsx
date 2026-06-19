import React, { useState, useRef, useEffect } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/pages/Login.css';
import { showLoginSuccess, showError, showSuccess } from '../services/notificationService';
import { setAuth, isLoggedIn, getUserRole, getUser } from '../services/authService';
import { checkUser, login, getMe, getMyRole } from '../services/apiService';
import { getAccessiblePages, hasPageAccess } from '../utils/rolePermissions';
import { pageKeyToPath } from '../utils/dashboardRoutes';
import { verifyOTP, resendOTP, initializeOTPWidget, destroyOTPWidget } from '../services/msg91Service';

const Login = ({ onPageChange }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const otpInputRefs = useRef([]);
  const [returnUrl, setReturnUrl] = useState(null);

  // Get return URL from query parameters on mount and check if already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // If user is already logged in, redirect them
      if (isLoggedIn()) {
        const params = new URLSearchParams(window.location.search);
        const returnUrlParam = params.get('returnUrl');
        if (returnUrlParam) {
          // Redirect to return URL
          const decodedUrl = decodeURIComponent(returnUrlParam);
          if (onPageChange) {
            const pathParts = decodedUrl.split('?');
            const path = pathParts[0];
            const page = path.slice(1) || 'products';
            const queryString = pathParts[1] || '';
            const searchParams = new URLSearchParams(queryString);
            const productId = searchParams.get('id');
            onPageChange(page, productId ? parseInt(productId) : null);
          } else {
            window.location.href = decodedUrl;
          }
        } else {
          // No return URL, redirect to dashboard
          if (onPageChange) {
            onPageChange('dashboard');
          } else {
            window.location.href = '/dashboard';
          }
        }
        return;
      }
      
      // Get return URL for after login
      const params = new URLSearchParams(window.location.search);
      const returnUrlParam = params.get('returnUrl');
      if (returnUrlParam) {
        setReturnUrl(decodeURIComponent(returnUrlParam));
      }
    }
  }, [onPageChange]);

  // Cleanup OTP widget on unmount
  useEffect(() => {
    return () => {
      destroyOTPWidget();
    };
  }, []);

  // Resend timer countdown
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setLoading(true);

    // Validate Indian phone numbers: require exactly 10 digits (excluding country code)
    const digitsOnly = String(phoneNumber || '').replace(/\D/g, '');
    const nationalNumber = digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
    if (nationalNumber.length !== 10) {
      const msg = 'Enter a valid 10-digit mobile number.';
      setPhoneError(msg);
      showError(msg);
      setLoading(false);
      return;
    }

    // Format phone number to E.164 format (must match format used during registration)
    // This ensures exact match with backend database
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      // Remove leading zeros
      formattedPhone = formattedPhone.replace(/^0+/, '');
      // If it doesn't start with country code, add 91 for India
      if (!formattedPhone.startsWith('91')) {
        formattedPhone = `91${formattedPhone}`;
      }
      formattedPhone = `+${formattedPhone}`;
    }
    
    console.log('[Login] Original phone:', phoneNumber, 'Formatted phone:', formattedPhone);

    try {
      console.log('[Login] Checking user with phone:', formattedPhone);
      // Check user and auto-send OTP via MSG91
      const response = await checkUser(formattedPhone);
      console.log('[Login] Check user response:', response);
      
      if (response.otpSent) {
        // Initialize OTP widget for verification
        await initializeOTPWidget(formattedPhone, {
          onSuccess: () => {
            console.log('OTP sent via MSG91');
          },
          onError: (error) => {
            console.error('MSG91 OTP error:', error);
            showError('Failed to send OTP. Please try again.');
          },
        });
        
        showSuccess('OTP sent successfully to your phone number');
        setShowOTP(true);
        setResendDisabled(true);
        setResendTimer(30); // 30 seconds cooldown
      } else {
        showError(response.otpError || 'Failed to send OTP. Please try again.');
      }
    } catch (error) {
      console.error('[Login] Check user error:', error);
      console.error('[Login] Error details:', {
        message: error.message,
        statusCode: error.statusCode,
        statusText: error.statusText,
        errorData: error.errorData,
        response: error.response,
        phoneNumber: formattedPhone
      });
      
      // Check if it's a 400 "User not found" error
      const errorMessage = (error.message || '').toLowerCase();
      const errorDataMessage = (error.errorData?.error || error.errorData?.message || error.errorData?.msg || '').toLowerCase();
      const errorText = JSON.stringify(error.errorData || {}).toLowerCase();
      
      if (error.statusCode === 400 || 
          errorMessage.includes('user not found') || 
          errorDataMessage.includes('user not found') ||
          errorText.includes('user not found')) {
        showError('User not found. Please ensure your phone number is registered. If you were just created by an administrator, please wait a few moments and try again, or contact your administrator.');
      } else {
        showError(error.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    if (otpError) setOtpError('');
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split('').concat(['', '', '', '', '', '']).slice(0, 6);
      setOtp(newOtp);
      const lastIndex = Math.min(pastedData.length - 1, 5);
      otpInputRefs.current[lastIndex]?.focus();
    }
  };

  const handleOTPVerify = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    setOtpError('');

    if (otpValue.length !== 6) {
      const msg = 'Enter the 6-digit code sent to your phone.';
      setOtpError(msg);
      showError(msg);
      return;
    }

    setLoading(true);

    try {
      // Format phone number to E.164 format (must match format used during registration)
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        // Remove leading zeros
        formattedPhone = formattedPhone.replace(/^0+/, '');
        // If it doesn't start with country code, add 91 for India
        if (!formattedPhone.startsWith('91')) {
          formattedPhone = `91${formattedPhone}`;
        }
        formattedPhone = `+${formattedPhone}`;
      }
      
      console.log('[Login] OTP verification - Original phone:', phoneNumber, 'Formatted phone:', formattedPhone);

      // Verify OTP via MSG91
      const verifyResponse = await verifyOTP(otpValue);

      if (verifyResponse.success) {
        // OTP verified by the widget — pass its access-token to login so the
        // backend verifies it server-side and issues the JWT in one call.
        const loginResponse = await login(formattedPhone, verifyResponse.accessToken);
        
        console.log('Login response:', loginResponse);
        
        if (loginResponse.token) {
          // Decode JWT token to extract user information (as fallback)
          let userData = null;
          try {
            // JWT token structure: header.payload.signature
            const tokenParts = loginResponse.token.split('.');
            if (tokenParts.length === 3) {
              // Decode the payload (second part)
              const payload = JSON.parse(atob(tokenParts[1]));
              userData = {
                id: payload.userId || payload.user_id,
                phone: payload.phone,
                email: payload.email,
                full_name: payload.full_name || payload.fullName,
                name: payload.full_name || payload.fullName || payload.name,
                // Note: role from JWT is fallback only - API response should have updated role
                role: payload.role || payload.role_name || payload.roleName,
                role_name: payload.role_name || payload.roleName || payload.role,
              };
            }
          } catch (decodeError) {
            console.error('Error decoding JWT token:', decodeError);
            // Fallback: create user object from available data
            userData = {
              phone: formattedPhone,
              role: null,
            };
          }
          
          // Prioritize user data from API response (which has updated role from database)
          // over JWT token payload (which might have stale role)
          let user = null;
          
          if (loginResponse.user) {
            // Use user object from API response - this should have the latest role from database
            user = {
              ...loginResponse.user,
              // Ensure role is set from API response user object first
              role: loginResponse.user.role || 
                    loginResponse.user.role_name || 
                    loginResponse.user.roleName ||
                    loginResponse.role ||
                    userData?.role,
              role_name: loginResponse.user.role_name || 
                        loginResponse.user.roleName || 
                        loginResponse.user.role ||
                        loginResponse.role ||
                        userData?.role_name,
            };
          } else if (loginResponse.role) {
            // If no user object but role is in response, merge with decoded data
            user = {
              ...userData,
              role: loginResponse.role,
              role_name: loginResponse.role,
            };
          } else {
            // Fallback to decoded JWT data (least preferred)
            user = userData;
          }
          
          if (user) {
            // Set authentication
            setAuth(user, loginResponse.token);
            
            // Save user name to localStorage for header display
            const userName = user.full_name || user.fullName || user.name || user.email || '';
            if (userName && typeof window !== 'undefined') {
              window.localStorage.setItem('userName', userName);
            }
            
            // Save profile image if available
            const profileImage = user.profile_image || user.image_url || user.avatar || user.avatarUrl || '';
            if (profileImage && profileImage.trim() !== '' && typeof window !== 'undefined') {
              window.localStorage.setItem('userAvatarUrl', profileImage.trim());
            }
            
            // Refresh user data from API to ensure we have the latest role information
            // This is important when a user's role has been updated
            const refreshUserData = async () => {
              try {
                const currentUser = getUser();
                if (!currentUser) return;

                // Use the role-agnostic self endpoints. GET /users (admin-only)
                // 403s for party/distributor/salesman; /users/me + /users/role
                // work for every role and return the latest profile + role.
                const [me, myRoles] = await Promise.all([
                  getMe().catch(() => null),
                  getMyRole().catch(() => []),
                ]);

                // /users/role returns [{ role_id, role_name, ... }] for the user.
                const roleList = Array.isArray(myRoles)
                  ? myRoles
                  : (myRoles?.data || myRoles?.roles || []);
                const roleName = roleList.length
                  ? (roleList[0].role_name || roleList[0].roleName || roleList[0].role || roleList[0].name)
                  : null;

                if (!me && !roleName) return;

                const updatedUser = {
                  ...currentUser,
                  ...(me || {}),
                  id: (me && (me.user_id || me.id)) || currentUser.id,
                  full_name: (me && (me.full_name || me.fullName || me.name)) || currentUser.full_name,
                  fullName: (me && (me.full_name || me.fullName || me.name)) || currentUser.fullName,
                  name: (me && (me.full_name || me.fullName || me.name)) || currentUser.name,
                  email: (me && me.email) || currentUser.email,
                  phone: (me && (me.phone || me.phoneNumber)) || currentUser.phone,
                  profile_image: (me && (me.profile_image || me.image_url)) || currentUser.profile_image,
                  image_url: (me && (me.image_url || me.profile_image)) || currentUser.image_url,
                  role_id: (me && (me.role_id || me.roleId)) || (roleList[0]?.role_id) || currentUser.role_id,
                  roleId: (me && (me.role_id || me.roleId)) || (roleList[0]?.role_id) || currentUser.roleId,
                  // Latest role name from /users/role wins; fall back to existing.
                  role: roleName || currentUser.role,
                  role_name: roleName || currentUser.role_name,
                  roleName: roleName || currentUser.roleName,
                };

                setAuth(updatedUser, loginResponse.token);

                console.log('User data refreshed with latest role:', {
                  role_id: updatedUser.role_id,
                  role: updatedUser.role,
                  role_name: updatedUser.role_name,
                });
              } catch (refreshError) {
                console.error('Error refreshing user data after login:', refreshError);
                // Don't block login if refresh fails - user can still proceed
              }
            };
            
            showLoginSuccess();
            
            // Cleanup OTP widget
            destroyOTPWidget();
            
            // Refresh user data and then redirect
            // This ensures we have the latest role information before redirecting
            refreshUserData().then(() => {
              // Redirect after user data is refreshed
              const userRole = getUserRole();
              
              if (returnUrl) {
                // Parse returnUrl - it should be a path like "/products" or "/products?id=123"
                if (returnUrl.startsWith('/')) {
                  // Product detail uses a clean /product/<model_no> path — navigate directly.
                  if (returnUrl.startsWith('/product/')) {
                    if (typeof window !== 'undefined') window.location.href = returnUrl;
                    return;
                  }
                  // Extract page name from path (remove leading slash)
                  const pathParts = returnUrl.split('?');
                  const path = pathParts[0];
                  const page = path.slice(1) || 'products'; // Remove leading slash, default to 'products'
                  
                  // Check if user has access to return URL page (if it's a dashboard page)
                  const dashboardPages = ['dashboard', 'dashboard-products', 'orders', 'tray', 'events', 'party', 'salesmen', 'distributor', 'office-team', 'manage', 'analytics', 'support', 'settings'];
                  if (dashboardPages.includes(page) && userRole && !hasPageAccess(userRole, page)) {
                    // User doesn't have access to return URL, redirect to first accessible page
                    const accessiblePages = getAccessiblePages(userRole);
                    if (accessiblePages.length > 0) {
                      if (onPageChange) {
                        onPageChange(accessiblePages[0]);
                      } else if (typeof window !== 'undefined') {
                        window.location.href = pageKeyToPath(accessiblePages[0]);
                      }
                    } else {
                      // No accessible pages, redirect to settings as fallback
                      if (onPageChange) {
                        onPageChange('settings');
                      } else if (typeof window !== 'undefined') {
                        window.location.href = pageKeyToPath('settings');
                      }
                    }
                    return;
                  }
                  
                  // Extract query parameters if any
                  const queryString = pathParts[1] || '';
                  const searchParams = new URLSearchParams(queryString);
                  const productId = searchParams.get('id');
                  const modelNo = searchParams.get('model_no');
                  const fromHome = searchParams.get('fromHome');
                  
                  // If there are query parameters (like model_no, fromHome), use window.location.href to preserve them
                  // Otherwise, use onPageChange for cleaner navigation
                  if (queryString && (modelNo || fromHome || productId)) {
                    // Preserve all query parameters by using window.location.href
                    if (typeof window !== 'undefined') {
                      window.location.href = returnUrl;
                    }
                  } else if (onPageChange) {
                    // Use onPageChange for navigation when no special query params
                    onPageChange(page, productId ? parseInt(productId) : null);
                  } else if (typeof window !== 'undefined') {
                    // Fallback to window.location
                    window.location.href = returnUrl;
                  }
                } else {
                  // If it's just a page name without leading slash
                  if (onPageChange) {
                    onPageChange(returnUrl);
                  } else if (typeof window !== 'undefined') {
                    window.location.href = `/${returnUrl}`;
                  }
                }
              } else {
                // No return URL, redirect to first accessible page based on role
                if (userRole) {
                  const accessiblePages = getAccessiblePages(userRole);
                  if (accessiblePages.length > 0) {
                    // Redirect to first accessible page
                    if (onPageChange) {
                      onPageChange(accessiblePages[0]);
                    } else if (typeof window !== 'undefined') {
                      window.location.href = pageKeyToPath(accessiblePages[0]);
                    }
                  } else {
                    // No accessible pages, redirect to settings as fallback
                    if (onPageChange) {
                      onPageChange('settings');
                    } else if (typeof window !== 'undefined') {
                      window.location.href = pageKeyToPath('settings');
                    }
                  }
                } else {
                  // No role, default to dashboard
                  if (onPageChange) {
                    onPageChange('dashboard');
                  } else if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard';
                  }
                }
              }
            }).catch((refreshError) => {
              // If refresh fails, still redirect with whatever role we have
              console.error('User data refresh failed, proceeding with available role:', refreshError);
              const userRole = getUserRole();
              
              if (returnUrl) {
                // Parse returnUrl - it should be a path like "/products" or "/products?id=123"
                if (returnUrl.startsWith('/')) {
                  // Product detail uses a clean /product/<model_no> path — navigate directly.
                  if (returnUrl.startsWith('/product/')) {
                    if (typeof window !== 'undefined') window.location.href = returnUrl;
                    return;
                  }
                  // Extract page name from path (remove leading slash)
                  const pathParts = returnUrl.split('?');
                  const path = pathParts[0];
                  const page = path.slice(1) || 'products'; // Remove leading slash, default to 'products'
                  
                  // Check if user has access to return URL page (if it's a dashboard page)
                  const dashboardPages = ['dashboard', 'dashboard-products', 'orders', 'tray', 'events', 'party', 'salesmen', 'distributor', 'office-team', 'manage', 'analytics', 'support', 'settings'];
                  if (dashboardPages.includes(page) && userRole && !hasPageAccess(userRole, page)) {
                    // User doesn't have access to return URL, redirect to first accessible page
                    const accessiblePages = getAccessiblePages(userRole);
                    if (accessiblePages.length > 0) {
                      if (onPageChange) {
                        onPageChange(accessiblePages[0]);
                      } else if (typeof window !== 'undefined') {
                        window.location.href = pageKeyToPath(accessiblePages[0]);
                      }
                    } else {
                      // No accessible pages, redirect to settings as fallback
                      if (onPageChange) {
                        onPageChange('settings');
                      } else if (typeof window !== 'undefined') {
                        window.location.href = pageKeyToPath('settings');
                      }
                    }
                    return;
                  }
                  
                  // Extract query parameters if any
                  const queryString = pathParts[1] || '';
                  const searchParams = new URLSearchParams(queryString);
                  const productId = searchParams.get('id');
                  const modelNo = searchParams.get('model_no');
                  const fromHome = searchParams.get('fromHome');
                  
                  // If there are query parameters (like model_no, fromHome), use window.location.href to preserve them
                  // Otherwise, use onPageChange for cleaner navigation
                  if (queryString && (modelNo || fromHome || productId)) {
                    // Preserve all query parameters by using window.location.href
                    if (typeof window !== 'undefined') {
                      window.location.href = returnUrl;
                    }
                  } else if (onPageChange) {
                    // Use onPageChange for navigation when no special query params
                    onPageChange(page, productId ? parseInt(productId) : null);
                  } else if (typeof window !== 'undefined') {
                    // Fallback to window.location
                    window.location.href = returnUrl;
                  }
                } else {
                  // If it's just a page name without leading slash
                  if (onPageChange) {
                    onPageChange(returnUrl);
                  } else if (typeof window !== 'undefined') {
                    window.location.href = `/${returnUrl}`;
                  }
                }
              } else {
                // No return URL, redirect to first accessible page based on role
                if (userRole) {
                  const accessiblePages = getAccessiblePages(userRole);
                  if (accessiblePages.length > 0) {
                    // Redirect to first accessible page
                    if (onPageChange) {
                      onPageChange(accessiblePages[0]);
                    } else if (typeof window !== 'undefined') {
                      window.location.href = pageKeyToPath(accessiblePages[0]);
                    }
                  } else {
                    // No accessible pages, redirect to settings as fallback
                    if (onPageChange) {
                      onPageChange('settings');
                    } else if (typeof window !== 'undefined') {
                      window.location.href = pageKeyToPath('settings');
                    }
                  }
                } else {
                  // No role, default to dashboard
                  if (onPageChange) {
                    onPageChange('dashboard');
                  } else if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard';
                  }
                }
              }
            });
          } else {
            showError('Login failed. Unable to extract user information.');
          }
        } else {
          showError(loginResponse.message || 'Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      const errorMessage = error.message || error.error?.message || 'Incorrect code. Please try again.';
      setOtpError(errorMessage);
      showError(errorMessage);

      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendDisabled || loading) return;

    setLoading(true);
    setResendDisabled(true);

    try {
      const resendResponse = await resendOTP();
      
      if (resendResponse.success) {
        showSuccess('OTP resent successfully');
        setResendTimer(30); // 30 seconds cooldown
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        showError(resendResponse.message || 'Failed to resend OTP');
        setResendDisabled(false);
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      showError(error.message || 'Failed to resend OTP. Please try again.');
      setResendDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    if (onPageChange) {
      onPageChange(page);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/${page}`;
    }
  };

  return (
    <div className="login-page relative flex min-h-screen flex-col bg-[var(--color-primary-active)]">
      <Header onPageChange={handlePageChange} currentPage="login" />
      <div className="login-background absolute left-0 top-0 z-0 w-full">
        <img src="/images/banners/loginbg.webp" alt="Login Background" className="login-bg-image h-auto w-full object-cover opacity-45" />
        <div className="login-gradient-overlay absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(18,14,77,0)_0%,var(--color-primary-active)_92%)]"></div>
      </div>
      <div className="login-content relative z-[2] flex flex-1 items-center justify-center px-4 py-10 md:py-16">
        <div className="login-container box-border w-full max-w-[440px] rounded-xl border border-border bg-surface px-5 py-6 shadow-xl sm:px-6 sm:py-8 md:px-10 md:py-12">
          {!showOTP ? (
            <>
              <h1 className="login-title m-0 mb-2 text-center text-xl font-bold leading-[var(--leading-tight)] tracking-[-0.02em] text-text sm:text-[length:var(--text-2xl)]">Sign in</h1>
              <p className="login-subtitle m-0 mb-8 text-center text-[length:var(--text-base)] font-normal leading-[var(--leading-normal)] text-text-muted">Enter your mobile number to receive a one-time code.</p>
              <form className="login-form flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
                <div className="login-input-group flex flex-col gap-2">
                  <label className="ui-label" htmlFor="phone">Mobile number</label>
                  <PhoneInput
                    defaultCountry="in"
                    value={phoneNumber}
                    onChange={(phone) => { setPhoneNumber(phone); if (phoneError) setPhoneError(''); }}
                    className={`phone-intl${phoneError ? ' phone-intl--error' : ''}`}
                    inputProps={{
                      id: 'phone',
                      required: true,
                      placeholder: 'Enter your mobile number',
                      'aria-invalid': phoneError ? 'true' : 'false',
                      'aria-describedby': phoneError ? 'phone-error' : undefined,
                    }}
                  />
                  {phoneError && (
                    <p className="ui-field-error" id="phone-error" role="alert">{phoneError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className={`ui-btn ui-btn--primary ui-btn--lg login-submit w-full${loading ? ' ui-btn--loading' : ''}`}
                  disabled={loading}
                >
                  <span className="ui-btn__label">{loading ? 'Sending code…' : 'Send code'}</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="login-title m-0 mb-2 text-center text-xl font-bold leading-[var(--leading-tight)] tracking-[-0.02em] text-text sm:text-[length:var(--text-2xl)]">Verify your number</h1>
              <p className="login-subtitle m-0 mb-8 text-center text-[length:var(--text-base)] font-normal leading-[var(--leading-normal)] text-text-muted">
                We sent a 6-digit code to
                {phoneNumber ? <strong className="login-phone-hint whitespace-nowrap font-semibold text-text"> +{String(phoneNumber).replace(/^\+/, '')}</strong> : ' your phone'}.
              </p>
              <form className="login-form flex flex-col gap-6" onSubmit={handleOTPVerify} noValidate>
                <div className="login-input-group flex flex-col gap-2">
                  <span className="ui-label" id="otp-label">One-time code</span>
                  <div
                    className={`otp-container flex justify-between gap-2${otpError ? ' otp-container--error' : ''}`}
                    role="group"
                    aria-labelledby="otp-label"
                  >
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (otpInputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOTPChange(index, e.target.value)}
                        onKeyDown={(e) => handleOTPKeyDown(index, e)}
                        onPaste={handleOTPPaste}
                        className={`otp-input h-[46px] min-w-0 flex-1 rounded-md border bg-surface text-center text-[length:var(--text-lg)] font-semibold text-text transition-[border-color,box-shadow] duration-200 ease-[ease] hover:enabled:border-grey-400 focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-subtle motion-reduce:transition-none sm:h-[52px] sm:text-[length:var(--text-xl)] ${otpError ? 'border-error focus-visible:shadow-[var(--focus-ring-error)]' : 'border-border-strong focus-visible:shadow-[var(--focus-ring)]'}`}
                        aria-label={`Digit ${index + 1}`}
                        aria-invalid={otpError ? 'true' : 'false'}
                        required
                        disabled={loading}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="ui-field-error" id="otp-error" role="alert">{otpError}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className={`ui-btn ui-btn--primary ui-btn--lg login-submit w-full${loading ? ' ui-btn--loading' : ''}`}
                  disabled={loading}
                >
                  <span className="ui-btn__label">{loading ? 'Verifying…' : 'Verify code'}</span>
                </button>
                <div className="resend-otp-container -mt-2 text-center">
                  <button
                    type="button"
                    className="resend-otp-btn cursor-pointer rounded-sm border-none bg-transparent px-3 py-2 text-[length:var(--text-sm)] font-medium text-primary transition-[color,background] duration-200 ease-[ease] hover:enabled:bg-primary-soft hover:enabled:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:text-text-subtle motion-reduce:transition-none"
                    onClick={handleResendOTP}
                    disabled={resendDisabled || loading}
                  >
                    {resendTimer > 0
                      ? `Resend code in ${resendTimer}s`
                      : 'Resend code'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
