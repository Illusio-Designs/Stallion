import React, { useMemo, useState, useEffect, useCallback } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import { register, getRoles, getUsers, updateUser, deleteUser } from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';

const DashboardOfficeTeam = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    roleId: '',
  });
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phoneNumber: '',
    roleId: '',
    isActive: true,
  });

  // Fetch roles on component mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await getRoles();
        console.log('Roles API Response:', response); // Debug log
        
        // Handle different response structures
        let rolesArray = [];
        if (Array.isArray(response)) {
          rolesArray = response;
        } else if (response && Array.isArray(response.data)) {
          rolesArray = response.data;
        } else if (response && Array.isArray(response.roles)) {
          rolesArray = response.roles;
        } else if (response && response.data && Array.isArray(response.data.roles)) {
          rolesArray = response.data.roles;
        }
        
        console.log('Extracted roles array:', rolesArray); // Debug log
        setRoles(rolesArray);
      } catch (error) {
        console.error('Error fetching roles:', error);
        // Show user-friendly error message
        if (error.message?.includes('Failed to fetch') || error.message?.includes('CORS')) {
          showError('Unable to connect to server. Please check your internet connection or contact support.');
        } else {
          showError(`Failed to load roles: ${error.message || 'Unknown error'}`);
        }
        setRoles([]);
      }
    };
    fetchRoles();
  }, []);

  // Update edit form data when editRow changes
  useEffect(() => {
    if (editRow) {
      setEditFormData({
        fullName: editRow.fullName || '',
        phoneNumber: editRow.phoneNumber || '',
        roleId: editRow.roleId || '',
        isActive: editRow.isActive !== undefined ? editRow.isActive : true,
      });
    }
  }, [editRow]);

  // Function to format role name: capitalize first letter and replace underscores with spaces
  const formatRoleName = (name) => {
    if (!name) return '';
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper function to map users array to table rows format
  const mapUsersToRows = (usersArray) => {
    return usersArray.map(user => {
      // Find role name for display
      const userRole = roles.find(r => {
        const roleId = r.role_id || r.id || r.roleId || r._id || r.uuid || r.ID;
        return roleId === user.role_id;
      });
      const roleName = userRole 
        ? formatRoleName(userRole.role_name || userRole.name || userRole.roleName || userRole.title || userRole.role || userRole.Name || userRole.RoleName)
        : 'Unknown Role';
      
      return {
        id: user.user_id || user.id,
        fullName: user.full_name || user.fullName || user.name || '',
        phoneNumber: user.phone || user.phoneNumber || '',
        role: roleName,
        roleId: user.role_id || user.roleId,
        status: user.is_active ? 'Active' : 'Inactive',
        isActive: user.is_active || false,
        profile_image: user.profile_image || '',
        email: user.email || '',
      };
    });
  };

  const roleOptions = useMemo(() => {
    if (!roles || roles.length === 0) {
      console.log('No roles available');
      return [];
    }
    
    // Roles to exclude from the dropdown
    const excludedRoles = ['distributor', 'salesman', 'party'];
    
    const options = roles
      .map((role) => {
        // Try multiple possible property names for ID (including snake_case)
        const roleId = role.role_id || role.id || role.roleId || role._id || role.uuid || role.ID;
        // Try multiple possible property names for name (including snake_case)
        const roleName = role.role_name || role.name || role.roleName || role.title || role.role || role.Name || role.RoleName;
        
        // Only return if we have a valid ID
        if (!roleId) {
          return null;
        }
        
        // Exclude specific roles
        if (roleName && excludedRoles.includes(roleName.toLowerCase())) {
          return null;
        }
        
        return {
          value: roleId,
          label: formatRoleName(roleName) || roleId, // Format the role name properly
        };
      })
      .filter(opt => opt !== null); // Filter out null entries
    
    console.log('Role options:', options); // Debug log
    return options;
  }, [roles]);

  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);

  // Fetch users on component mount and after operations
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUsers();
      console.log('Users API Response:', response); // Debug log

      // Handle different response structures
      let usersArray = [];
      if (Array.isArray(response)) {
        usersArray = response;
      } else if (response && Array.isArray(response.data)) {
        usersArray = response.data;
      } else if (response && Array.isArray(response.users)) {
        usersArray = response.users;
      }

      setUsers(usersArray);
      setRows(mapUsersToRows(usersArray));
    } catch (error) {
      console.error('Error fetching users:', error);
      // Show user-friendly error message
      if (error.message?.includes('Failed to fetch') || error.message?.includes('CORS')) {
        showError('Unable to connect to server. Please check your internet connection or contact support.');
        setError('Unable to connect to server. Please check your internet connection or contact support.');
      } else if (!error.message?.toLowerCase().includes('token expired') &&
                 !error.message?.toLowerCase().includes('unauthorized')) {
        showError(`Failed to load users: ${error.message || 'Unknown error'}`);
        setError(error.message || 'Something went wrong while loading the team.');
      } else {
        setError(error.message || 'Something went wrong while loading the team.');
      }
      setUsers([]);
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  useEffect(() => {
    // Fetch users - if roles are empty, we'll still fetch users but role names might show as "Unknown Role"
    // This allows the page to work even if roles fail to load
    fetchUsers();
  }, [fetchUsers]);

  const filteredRowsByTab = useMemo(() => {
    let filtered = [];
    if (activeTab === 'All') {
      filtered = rows;
    } else if (activeTab === 'Activate') {
      filtered = rows.filter(r => r.isActive);
    } else if (activeTab === 'Deactivate') {
      filtered = rows.filter(r => !r.isActive);
    } else {
      filtered = rows;
    }
    
    return filtered;
  }, [rows, activeTab]);

  const columns = useMemo(() => ([
    { key: 'fullName', label: 'FULL NAME' },
    { key: 'phoneNumber', label: 'PHONE NUMBER' },
    { key: 'role', label: 'ROLE' },
    { key: 'status', label: 'STATUS' },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions onEdit={() => setEditRow(row)} onDelete={() => handleDelete(row)} />
    ) },
  ]), []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Format phone number to E.164 format if needed
      let phoneNumber = formData.phoneNumber.trim();
      if (!phoneNumber.startsWith('+')) {
        // If it doesn't start with +, assume it's an Indian number and add +91
        phoneNumber = phoneNumber.replace(/^0+/, ''); // Remove leading zeros
        if (!phoneNumber.startsWith('91')) {
          phoneNumber = `91${phoneNumber}`;
        }
        phoneNumber = `+${phoneNumber}`;
      }

      const userData = {
        phoneNumber,
        fullName: formData.fullName.trim(),
        roleId: formData.roleId,
      };

      await register(userData);
      
      // Reset form and close modal
      setFormData({
        fullName: '',
        phoneNumber: '',
        roleId: '',
      });
      setOpenAdd(false);
      
      // Refresh users list
      const response = await getUsers();
      let usersArray = [];
      if (Array.isArray(response)) {
        usersArray = response;
      } else if (response && Array.isArray(response.data)) {
        usersArray = response.data;
      } else if (response && Array.isArray(response.users)) {
        usersArray = response.users;
      }
      
      setUsers(usersArray);
      setRows(mapUsersToRows(usersArray));
      
      showSuccess('User registered successfully!');
    } catch (error) {
      console.error('Error registering user:', error);
      showError(error.message || 'Failed to register user');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    
    setLoading(true);
    try {
      // Format phone number to E.164 format if needed
      let phoneNumber = editFormData.phoneNumber.trim();
      if (!phoneNumber.startsWith('+')) {
        // If it doesn't start with +, assume it's an Indian number and add +91
        phoneNumber = phoneNumber.replace(/^0+/, ''); // Remove leading zeros
        if (!phoneNumber.startsWith('91')) {
          phoneNumber = `91${phoneNumber}`;
        }
        phoneNumber = `+${phoneNumber}`;
      }

      const userData = {
        name: editFormData.fullName,
        phoneNumber: phoneNumber,
        email: editRow.email || '',
        profile_image: '', // Legacy field, kept empty
        is_active: editFormData.isActive,
        image_url: editRow.profile_image || '',
        role_id: editFormData.roleId,
      };

      await updateUser(editRow.id, userData);
      
      // Refresh users list
      const response = await getUsers();
      let usersArray = [];
      if (Array.isArray(response)) {
        usersArray = response;
      } else if (response && Array.isArray(response.data)) {
        usersArray = response.data;
      } else if (response && Array.isArray(response.users)) {
        usersArray = response.users;
      }
      
      setUsers(usersArray);
      setRows(mapUsersToRows(usersArray));
      setEditRow(null);
      
      showSuccess('User updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      showError(error.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    // Confirm deletion
    const confirmed = window.confirm(`Are you sure you want to delete user "${row.fullName}"?`);
    if (!confirmed) return;
    
    setLoading(true);
    try {
      await deleteUser(row.id);
      
      // Refresh users list
      const response = await getUsers();
      let usersArray = [];
      if (Array.isArray(response)) {
        usersArray = response;
      } else if (response && Array.isArray(response.data)) {
        usersArray = response.data;
      } else if (response && Array.isArray(response.users)) {
        usersArray = response.users;
      }
      
      setUsers(usersArray);
      setRows(mapUsersToRows(usersArray));
      
      showSuccess('User deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      console.error('Error details:', {
        message: error.message,
        errorData: error.errorData,
        error: error.error,
        statusCode: error.statusCode,
        fullError: error
      });
      
      // Extract error message from various possible locations
      let errorMessage = '';
      let rawErrorString = '';
      
      // First, check if error.message is a JSON string
      if (error.message && typeof error.message === 'string') {
        rawErrorString = error.message;
        // Check if it's a JSON string
        if (rawErrorString.trim().startsWith('{') || rawErrorString.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(rawErrorString);
            errorMessage = parsed.error || parsed.message || parsed.msg || parsed.detail || '';
          } catch (e) {
            // Not JSON, use as is
            errorMessage = rawErrorString;
          }
        } else {
          errorMessage = rawErrorString;
        }
      }
      
      // Check errorData which contains the API response JSON
      // The API returns: { "error": "message" }
      if (!errorMessage && error.errorData) {
        if (typeof error.errorData === 'object') {
          errorMessage = error.errorData.error || 
                        error.errorData.message || 
                        error.errorData.msg ||
                        error.errorData.detail ||
                        '';
        } else if (typeof error.errorData === 'string') {
          // errorData might be a JSON string
          try {
            const parsed = JSON.parse(error.errorData);
            errorMessage = parsed.error || parsed.message || '';
          } catch (e) {
            errorMessage = error.errorData;
          }
        }
      }
      
      // If still no error message, check error.error
      if (!errorMessage && error.error) {
        if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (typeof error.error === 'object') {
          errorMessage = error.error.message || error.error.error || '';
        }
      }
      
      // Convert entire error object to string for checking
      const errorString = JSON.stringify({
        message: errorMessage,
        errorData: error.errorData,
        error: error.error,
        rawMessage: rawErrorString
      }).toLowerCase();
      const messageLower = (errorMessage || '').toLowerCase();
      const rawMessageLower = (rawErrorString || '').toLowerCase();
      
      // Check for foreign key constraint error in various formats
      // Check both the extracted message and the full error string
      const hasForeignKeyError = 
        messageLower.includes('foreign key constraint') || 
        messageLower.includes('foreign key') ||
        messageLower.includes('cannot delete or update a parent row') ||
        messageLower.includes('distributors_ibfk') ||
        messageLower.includes('created_by') ||
        messageLower.includes('references `users`') ||
        rawMessageLower.includes('foreign key constraint') ||
        rawMessageLower.includes('foreign key') ||
        rawMessageLower.includes('cannot delete or update a parent row') ||
        rawMessageLower.includes('distributors_ibfk') ||
        errorString.includes('foreign key constraint') ||
        errorString.includes('foreign key') ||
        errorString.includes('cannot delete or update a parent row') ||
        errorString.includes('distributors_ibfk') ||
        errorString.includes('created_by') ||
        errorString.includes('references `users`');
      
      if (hasForeignKeyError) {
        // Provide specific guidance based on the error
        if (messageLower.includes('distributors') || rawMessageLower.includes('distributors') || errorString.includes('distributors')) {
          showError('Cannot delete this user because they have created distributors in the system. Please delete or reassign those distributors to another user first, then try deleting this user again.');
        } else if (messageLower.includes('orders') || rawMessageLower.includes('orders') || errorString.includes('orders')) {
          showError('Cannot delete this user because they have orders in the system. Please delete or reassign those orders first, then try deleting this user again.');
        } else {
          showError('Cannot delete this user because they have related records in the system (distributors, orders, etc.). Please remove or reassign these records first before deleting the user.');
        }
      } else if (messageLower.includes('constraint') || rawMessageLower.includes('constraint') || errorString.includes('constraint')) {
        showError('Cannot delete this user because they have related records in the system. Please remove or reassign these records first.');
      } else {
        // Final fallback - show a generic message if we can't extract a meaningful error
        showError(errorMessage || 'Failed to delete user. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        <div className="dash-row grid grid-cols-12 gap-4">
          <div className="order-tabs-container col-span-full flex w-full gap-2 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
            {['All', 'Activate', 'Deactivate'].map(tab => (
              <button
                key={tab}
                className={`order-tab inline-flex min-h-10 flex-shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md px-4 py-2 text-[var(--text-base)] font-semibold leading-[var(--leading-snug)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:scale-[0.98] ${activeTab === tab ? 'active bg-primary text-text-on-primary' : 'text-text-muted hover:bg-primary-soft hover:text-primary'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="dash-row grid grid-cols-12 gap-4">
          <div className="dash-card full col-span-full rounded-lg border border-border bg-surface p-0 shadow-sm">
            {error && !loading ? (
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn&apos;t load the team</p>
                <p className="ui-state__desc">{error}</p>
                <div className="ui-state__actions">
                  <button className="ui-btn ui-btn--secondary" onClick={() => fetchUsers()}>
                    Try again
                  </button>
                </div>
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <p className="ui-state__title">No team members yet</p>
                <p className="ui-state__desc">Add your office team members to manage their roles and access.</p>
                <div className="ui-state__actions">
                  <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>
                    Add New User
                  </button>
                </div>
              </div>
            ) : (
              <TableWithControls
                title="Office Team"
                columns={columns}
                rows={filteredRowsByTab}
                onAddNew={() => setOpenAdd(true)}
                addNewText="Add New User"
                searchPlaceholder="Search users"
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>
      <Modal
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          setFormData({
            fullName: '',
            phoneNumber: '',
            roleId: '',
          });
        }}
        title="Add New User"
        footer={(
          <>
            <button
              className="ui-btn ui-btn--secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-[var(--text-base)] font-semibold leading-[1.2] text-text transition-colors hover:bg-grey-100 hover:border-grey-400 active:bg-grey-200 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => {
                setOpenAdd(false);
                setFormData({
                  fullName: '',
                  phoneNumber: '',
                  roleId: '',
                });
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="ui-btn ui-btn--primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-[var(--text-base)] font-semibold leading-[1.2] text-text-on-primary shadow-xs transition-colors hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55"
              onClick={handleSubmit}
              disabled={loading || !formData.fullName || !formData.phoneNumber || !formData.roleId}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      >
        <form className="ui-form grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Full Name *</label>
            <input
              className="ui-input min-h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-[var(--text-base)] text-text transition-colors placeholder:text-text-subtle hover:border-grey-400 focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              placeholder="Enter full name"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              required
            />
          </div>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Phone Number *</label>
            <PhoneInput
              country={'in'}
              value={formData.phoneNumber}
              onChange={(value) => handleInputChange('phoneNumber', value)}
              inputProps={{
                required: true,
                placeholder: 'Enter your phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Role *</label>
            <DropdownSelector
              options={roleOptions}
              value={formData.roleId}
              onChange={(value) => handleInputChange('roleId', value)}
              placeholder="Select a role"
            />
          </div>
        </form>
      </Modal>
      <Modal
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          setEditFormData({
            fullName: '',
            phoneNumber: '',
            roleId: '',
            isActive: true,
          });
        }}
        title="Edit User"
        footer={(
          <>
            <button
              className="ui-btn ui-btn--secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-[var(--text-base)] font-semibold leading-[1.2] text-text transition-colors hover:bg-grey-100 hover:border-grey-400 active:bg-grey-200 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => {
                setEditRow(null);
                setEditFormData({
                  fullName: '',
                  phoneNumber: '',
                  roleId: '',
                  isActive: true,
                });
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="ui-btn ui-btn--primary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-[var(--text-base)] font-semibold leading-[1.2] text-text-on-primary shadow-xs transition-colors hover:bg-primary-hover hover:border-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55"
              onClick={handleEditSubmit}
              disabled={loading || !editFormData.fullName || !editFormData.phoneNumber || !editFormData.roleId}
            >
              {loading ? 'Updating...' : 'Update'}
            </button>
          </>
        )}
      >
        <form className="ui-form grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleEditSubmit}>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Full Name *</label>
            <input
              className="ui-input min-h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-[var(--text-base)] text-text transition-colors placeholder:text-text-subtle hover:border-grey-400 focus:border-primary focus:outline-none focus:shadow-[var(--focus-ring)]"
              placeholder="Enter full name"
              value={editFormData.fullName}
              onChange={(e) => setEditFormData(prev => ({ ...prev, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Phone Number *</label>
            <PhoneInput
              country={'in'}
              value={editFormData.phoneNumber}
              onChange={(value) => setEditFormData(prev => ({ ...prev, phoneNumber: value }))}
              inputProps={{
                required: true,
                placeholder: 'Enter phone number',
              }}
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-button"
              dropdownClass="phone-input-dropdown"
              disableDropdown={false}
              disableCountryGuess={false}
            />
          </div>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Role *</label>
            <DropdownSelector
              options={roleOptions}
              value={editFormData.roleId}
              onChange={(value) => setEditFormData(prev => ({ ...prev, roleId: value }))}
              placeholder="Select a role"
            />
          </div>
          <div className="form-group form-group--full flex flex-col gap-2 sm:col-span-full">
            <label className="ui-label text-[var(--text-sm)] font-medium text-text">Status</label>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={editFormData.isActive}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <span>Active</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DashboardOfficeTeam;

