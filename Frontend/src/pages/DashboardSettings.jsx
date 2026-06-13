import React, { useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { showSuccess, showError } from '../services/notificationService';
import { updateUser, getUsers } from '../services/apiService';
import { getUser } from '../services/authService';
import '../styles/pages/dashboard-settings.css';

const DashboardSettings = () => {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState(''); // data URL or URL for preview
  const [avatarFile, setAvatarFile] = useState(null); // Store original file for upload
  const [avatarError, setAvatarError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentRoleId, setCurrentRoleId] = useState(null);
  const [isActive, setIsActive] = useState(true);

  const initial = useMemo(() => ({ name: '', email: '', phone: '', avatar: '' }), []);
  const [initialData, setInitialData] = useState(initial);

  // Debug: Log avatar changes
  useEffect(() => {
    console.log('Avatar state changed:', {
      hasAvatar: !!avatar,
      avatarLength: avatar ? avatar.length : 0,
      isBase64: avatar ? avatar.startsWith('data:') : false,
      preview: avatar ? avatar.substring(0, 80) + '...' : 'empty',
      hasError: avatarError
    });
  }, [avatar, avatarError]);

  // Fetch current user data from API
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const currentUser = getUser();
        if (!currentUser || !currentUser.id) {
          // No user ID found - this is expected if user is not logged in
          // Fallback to localStorage
          loadFromLocalStorage();
          return;
        }

        setCurrentUserId(currentUser.id);
        
        // Fetch all users to find current user's data
        const usersResponse = await getUsers();
        let usersArray = [];
        if (Array.isArray(usersResponse)) {
          usersArray = usersResponse;
        } else if (usersResponse && Array.isArray(usersResponse.data)) {
          usersArray = usersResponse.data;
        } else if (usersResponse && Array.isArray(usersResponse.users)) {
          usersArray = usersResponse.users;
        }

        // Find current user in the list
        const userData = usersArray.find(u => 
          (u.user_id || u.id) === currentUser.id
        );

        if (userData) {
          setUserName(userData.full_name || userData.name || userData.fullName || '');
          setEmail(userData.email || '');
          setPhone(userData.phone || userData.phoneNumber || '');
          
          // Prioritize API image over localStorage for cross-device sync
          // Accept both URLs and base64 data URLs from API (backend stores base64)
          // Check both image_url and profile_image fields from API
          const apiImageUrl = userData.image_url && userData.image_url.trim() !== ''
            ? userData.image_url 
            : null;
          const apiProfileImage = userData.profile_image && userData.profile_image.trim() !== ''
            ? userData.profile_image 
            : null;
          
          // Debug logging
          console.log('User data from API:', {
            userId: userData.user_id || userData.id,
            hasImageUrl: !!apiImageUrl,
            hasProfileImage: !!apiProfileImage,
            profileImageLength: apiProfileImage ? apiProfileImage.length : 0,
            profileImagePreview: apiProfileImage ? apiProfileImage.substring(0, 50) + '...' : null,
            profileImageEnd: apiProfileImage ? '...' + apiProfileImage.substring(Math.max(0, apiProfileImage.length - 50)) : null,
            isBase64: apiProfileImage ? apiProfileImage.startsWith('data:') : false
          });
          
          // Validate base64 data URL format
          if (apiProfileImage && apiProfileImage.startsWith('data:')) {
            const base64Match = apiProfileImage.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (!base64Match) {
              console.warn('Invalid base64 data URL format:', apiProfileImage.substring(0, 100));
            } else {
              const base64Data = base64Match[2];
              console.log('Base64 data validation:', {
                imageType: base64Match[1],
                base64Length: base64Data.length,
                isValidLength: base64Data.length > 100 // Base64 should be substantial
              });
            }
          }
          
          // Use API response first (for cross-device sync) - accept base64 from API
          const apiAvatar = apiImageUrl || apiProfileImage;
          const storedAvatar = typeof window !== 'undefined' ? window.localStorage.getItem('userAvatarUrl') : null;
          const validStoredAvatar = storedAvatar && storedAvatar.trim() !== ''
            ? storedAvatar 
            : null;
          
          // Prioritize API response (for cross-device sync) - can be URL or base64
          const avatarValue = apiAvatar || validStoredAvatar || '';
          
          console.log('Setting avatar value:', {
            hasValue: !!avatarValue,
            valueLength: avatarValue ? avatarValue.length : 0,
            isBase64: avatarValue ? avatarValue.startsWith('data:') : false,
            preview: avatarValue ? avatarValue.substring(0, 50) + '...' : 'empty'
          });
          
          setAvatar(avatarValue);
          setAvatarError(false); // Reset error state when setting new avatar
          setIsActive(userData.is_active !== undefined ? userData.is_active : true);
          setCurrentRoleId(userData.role_id || userData.roleId || null);
          
          // Update initial data
          const next = {
            name: userData.full_name || userData.name || userData.fullName || '',
            email: userData.email || '',
            phone: userData.phone || userData.phoneNumber || '',
            avatar: avatarValue,
          };
          setInitialData(next);
          
          // Update localStorage with API data (for offline/header display)
          // Store base64 from API if that's what we got (for cross-device sync)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('userName', next.name);
            if (avatarValue && avatarValue.trim() !== '') {
              // Store whatever we got from API (URL or base64) for display
              window.localStorage.setItem('userAvatarUrl', avatarValue);
            } else {
              // Remove avatar from localStorage if it's empty
              window.localStorage.removeItem('userAvatarUrl');
            }
          }
        } else {
          // Fallback to localStorage if user not found in API
          loadFromLocalStorage();
        }
      } catch (error) {
        // Silently handle API errors - fallback to localStorage
        // This is expected if API is not available or user is offline
        console.warn('Could not fetch user data from API, using localStorage:', error.message);
        // Fallback to localStorage on error
        loadFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    const loadFromLocalStorage = () => {
      try {
        const storedName = typeof window !== 'undefined' ? window.localStorage.getItem('userName') : '';
        const storedAvatar = typeof window !== 'undefined' ? window.localStorage.getItem('userAvatarUrl') : '';
        const userStr = typeof window !== 'undefined' ? window.localStorage.getItem('user') : null;
        
        // Only use avatar if it's a valid non-empty value
        const validStoredAvatar = storedAvatar && storedAvatar.trim() !== '' ? storedAvatar : '';
        const userAvatar = userStr ? (() => {
          try {
            const u = JSON.parse(userStr);
            return (u?.avatar && u.avatar.trim() !== '') ? u.avatar : '';
          } catch {
            return '';
          }
        })() : '';
        
        const avatarValue = validStoredAvatar || userAvatar || '';
        
        let next = { 
          name: storedName || '', 
          email: '', 
          phone: '', 
          avatar: avatarValue 
        };
        
        if (userStr) {
          const u = JSON.parse(userStr);
          next = {
            name: storedName || u?.name || '',
            email: u?.email || '',
            phone: u?.phone || '',
            avatar: avatarValue,
          };
          // Set user ID and role ID from localStorage if available
          setCurrentUserId(u?.id || null);
          // Try to get role_id from user object (might be stored during login)
          if (u?.role_id || u?.roleId) {
            setCurrentRoleId(u?.role_id || u?.roleId);
          }
        }
        setUserName(next.name);
        setEmail(next.email);
        setPhone(next.phone);
        setAvatar(next.avatar);
        setInitialData(next);
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    };

    fetchUserData();
  }, []);

  // Helper function to compress/resize image
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            file.type || 'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarChange = async (file) => {
    if (!file) return;
    
    // Reset error state
    setAvatarError(false);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file');
      return;
    }
    
    // Validate file size (max 2MB as per hint)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      showError('Image size should be less than 2MB');
      return;
    }
    
    try {
      // Compress the image to reduce size
      const compressedFile = await compressImage(file);
      setAvatarFile(compressedFile);
      
      // Create preview using data URL
      const reader = new FileReader();
      reader.onerror = () => {
        showError('Failed to read image file');
        setAvatarError(true);
      };
      reader.onload = () => {
        const result = reader.result;
        if (result) {
          setAvatar(String(result));
          setAvatarError(false);
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback to original file if compression fails
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result) {
          setAvatar(String(result));
          setAvatarError(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setUserName(initialData.name || '');
    setEmail(initialData.email || '');
    setPhone(initialData.phone || '');
    setAvatar(initialData.avatar || '');
    setAvatarFile(null);
    setAvatarError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    
    // Always save to localStorage first (works even if API fails)
    const saveToLocalStorage = () => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('userName', userName || '');
        // Only save avatar to localStorage if it's a valid non-empty value
        if (avatar && avatar.trim() !== '') {
          window.localStorage.setItem('userAvatarUrl', avatar);
        } else {
          // Remove avatar from localStorage if it's empty
          window.localStorage.removeItem('userAvatarUrl');
        }
        
        // Update user object in localStorage
        const userStr = window.localStorage.getItem('user');
        const u = userStr ? JSON.parse(userStr) : {};
        const avatarValue = (avatar && avatar.trim() !== '') ? avatar : (u?.avatar && u.avatar.trim() !== '' ? u.avatar : '');
        const next = { ...u, name: userName, email, phone, avatar: avatarValue };
        window.localStorage.setItem('user', JSON.stringify(next));
      }
    };

    // Try to update via API if we have the required data
    if (currentUserId && currentRoleId) {
      try {
        // Prepare user data
        // If we have a file, send it directly in updateUser (it will use FormData)
        // If we have a URL (not data URL), send it in image_url
        const isDataUrl = avatar && avatar.startsWith('data:image/');
        const imageUrlValue = isDataUrl ? '' : (avatar || '');

        // If we have a file, convert it to base64 (compressed) for JSON payload
        // Otherwise use the existing URL
        let profileImageBase64 = '';
        if (avatarFile) {
          try {
            // Convert compressed file to base64
            profileImageBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onerror = reject;
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(avatarFile);
            });
          } catch (error) {
            console.error('Error converting file to base64:', error);
            showError('Failed to process image');
            setLoading(false);
            return;
          }
        }

        const userData = {
          name: userName.trim(),
          email: email.trim() || '',
          phone: phone.trim() || '',
          profile_image: profileImageBase64, // Send compressed base64 if file exists
          is_active: isActive,
          image_url: imageUrlValue, // Send URL if it's a regular URL (not data URL)
          role_id: currentRoleId,
          profileImageFile: null, // Don't use FormData, send as base64 in JSON
        };

        console.log('Updating user with data:', { 
          ...userData, 
          profileImageFile: avatarFile ? `File: ${avatarFile.name}` : null,
          image_url: imageUrlValue || ''
        });
        
        const response = await updateUser(currentUserId, userData);
        console.log('Update user response:', response);
        
        // Extract image URL from response - backend should return the stored image URL
        let updatedImageUrl = null;
        
        // Check various response formats
        if (response?.data?.image_url && !response.data.image_url.startsWith('data:')) {
          updatedImageUrl = response.data.image_url;
        } else if (response?.data?.profile_image && !response.data.profile_image.startsWith('data:')) {
          updatedImageUrl = response.data.profile_image;
        } else if (response?.image_url && !response.image_url.startsWith('data:')) {
          updatedImageUrl = response.image_url;
        } else if (response?.profile_image && !response.profile_image.startsWith('data:')) {
          updatedImageUrl = response.profile_image;
        } else if (response?.data?.user?.image_url && !response.data.user.image_url.startsWith('data:')) {
          updatedImageUrl = response.data.user.image_url;
        } else if (response?.data?.user?.profile_image && !response.data.user.profile_image.startsWith('data:')) {
          updatedImageUrl = response.data.user.profile_image;
        }
        
        // If we got image from API (URL or base64), use it (this ensures cross-device sync)
        if (updatedImageUrl && updatedImageUrl.trim() !== '') {
          setAvatar(updatedImageUrl);
          setAvatarFile(null); // Clear file since it's uploaded
          console.log('Profile image from API:', updatedImageUrl.substring(0, 50) + '...');
        } else if (avatarFile) {
          // If we uploaded a file but didn't get image back, refetch user data
          console.log('No image in response, refetching user data...');
          try {
            const usersResponse = await getUsers();
            let usersArray = [];
            if (Array.isArray(usersResponse)) {
              usersArray = usersResponse;
            } else if (usersResponse?.data) {
              usersArray = Array.isArray(usersResponse.data) ? usersResponse.data : [];
            }
            
            const updatedUser = usersArray.find(u => (u.user_id || u.id) === currentUserId);
            if (updatedUser) {
              const fetchedImage = updatedUser.image_url || updatedUser.profile_image;
              if (fetchedImage && fetchedImage.trim() !== '') {
                console.log('Fetched image after update:', {
                  hasImage: !!fetchedImage,
                  imageLength: fetchedImage.length,
                  isBase64: fetchedImage.startsWith('data:'),
                  preview: fetchedImage.substring(0, 50) + '...',
                  end: '...' + fetchedImage.substring(Math.max(0, fetchedImage.length - 50))
                });
                setAvatar(fetchedImage);
                setAvatarError(false); // Reset error state
              } else {
                console.warn('No image found in refetched user data');
              }
            } else {
              console.warn('Updated user not found in refetched data');
            }
          } catch (refetchError) {
            console.warn('Failed to refetch user data:', refetchError);
          }
          setAvatarFile(null);
        }
        
        // Save to localStorage after successful API update (store whatever API returned)
        if (updatedImageUrl && updatedImageUrl.trim() !== '') {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('userAvatarUrl', updatedImageUrl);
          }
        }
        saveToLocalStorage();
        
        // Notify others
        window.dispatchEvent(new Event('authChange'));
        showSuccess('Profile updated successfully');
      } catch (error) {
        console.error('API update failed:', error);
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        // Still save to localStorage even if API fails
        saveToLocalStorage();
        
        // Notify others
        window.dispatchEvent(new Event('authChange'));
        showError(`API update failed: ${errorMessage}. Profile saved locally.`);
      }
    } else {
      // No API credentials, just save to localStorage
      saveToLocalStorage();
      
      // Notify others
      window.dispatchEvent(new Event('authChange'));
      showSuccess('Profile saved locally');
    }
    
    // Update initial data
    const next = {
      name: userName,
      email,
      phone,
      avatar: avatar || initialData.avatar,
    };
    setInitialData(next);
    
    setLoading(false);
  };

  return (
    <div className="dash-page">
      <div className="dash-container">
        <div className="dash-row">
          <div className="dash-card full settings p-4 min-[561px]:p-6">
            <div className="settings-header flex flex-wrap items-end justify-between gap-4 mb-5 min-[561px]:mb-6">
              <div>
                <h4 className="settings-title m-0 text-[length:var(--text-xl)] leading-[var(--leading-tight)] tracking-[-0.01em] font-semibold text-text">Profile Settings</h4>
                <p className="settings-subtitle mt-1 mb-0 text-text-muted text-[length:var(--text-base)] leading-[var(--leading-normal)]">Update your personal information and profile photo.</p>
              </div>
            </div>

            <div className="settings-grid grid grid-cols-1 items-start gap-6 mt-6 min-[769px]:grid-cols-[280px_1fr] min-[769px]:gap-8 min-[769px]:mt-8">
              <aside className="settings-sidebar flex flex-col gap-3">
                <div className="settings-avatar__preview settings-avatar__preview--lg flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted text-center text-[length:var(--text-xs)] text-text-subtle">
                  {avatar && !avatarError ? (
                    <img 
                      key={avatar.substring(0, 100)} // Force re-render if avatar changes
                      src={avatar} 
                      alt="Avatar" 
                      onError={(e) => {
                        console.error('Failed to load avatar image:', {
                          src: avatar ? avatar.substring(0, 100) : 'empty',
                          hasAvatar: !!avatar,
                          avatarLength: avatar ? avatar.length : 0,
                          isBase64: avatar ? avatar.startsWith('data:') : false,
                          error: e.target?.error,
                          naturalWidth: e.target?.naturalWidth,
                          naturalHeight: e.target?.naturalHeight
                        });
                        setAvatarError(true);
                      }}
                      onLoad={(e) => {
                        console.log('Avatar image loaded successfully:', {
                          naturalWidth: e.target.naturalWidth,
                          naturalHeight: e.target.naturalHeight,
                          complete: e.target.complete,
                          avatarLength: avatar.length
                        });
                        setAvatarError(false);
                      }}
                      style={{ 
                        display: 'block', 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        visibility: 'visible',
                        opacity: 1
                      }}
                    />
                  ) : avatarError ? (
                    <span style={{ color: '#ef4444', fontSize: '12px' }}>Failed to load image</span>
                  ) : (
                    <span>No Image</span>
                  )}
                </div>
                <div className="settings-avatar__actions flex flex-wrap items-center gap-2">
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    className="hidden-input hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      handleAvatarChange(file);
                      // Reset input to allow selecting the same file again
                      if (e.target) {
                        e.target.value = '';
                      }
                    }} 
                  />
                  <Button type="button" onClick={() => document.getElementById('avatar-input').click()} size="sm">Change Photo</Button>
                  {avatar && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setAvatar('');
                      setAvatarFile(null);
                      setAvatarError(false);
                    }}>Remove</Button>
                  )}
                  <div className="settings-hint mt-1 text-[length:var(--text-xs)] leading-[var(--leading-normal)] text-text-subtle">JPG, PNG up to ~2MB recommended.</div>
                </div>
              </aside>

              <form onSubmit={handleSubmit} className="settings-form ui-form grid max-w-[720px] grid-cols-1 gap-5 min-[561px]:gap-6">
                <div className="form-group flex flex-col gap-2">
                  <label className="ui-label">User Name</label>
                  <input className="ui-input" type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Enter your name" required />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="ui-label">Email</label>
                  <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label className="ui-label">Phone Number</label>
                  <PhoneInput
                    defaultCountry="in"
                    value={phone ? (String(phone).startsWith('+') ? String(phone) : '+' + phone) : ''}
                    onChange={(phone) => setPhone(phone.replace(/^\+/, ''))}
                    className="phone-intl"
                    inputProps={{
                      placeholder: 'Enter your phone number',
                    }}
                  />
                </div>

                <div className="settings-actions flex flex-col-reverse items-stretch gap-3 mt-2 pt-6 border-t border-border [&_.ui-btn]:w-full min-[561px]:flex-row min-[561px]:items-center min-[561px]:justify-end min-[561px]:[&_.ui-btn]:w-auto">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleReset}
                    disabled={loading}
                  >
                    Reset
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !userName.trim()}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettings;

