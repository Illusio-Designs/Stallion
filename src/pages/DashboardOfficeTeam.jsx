import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import PagedMultiSelect from '../components/ui/PagedMultiSelect';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { createUser, updateUserById, getRoles, getUsers, deleteUser, getIndianCountries, getStates, getCities } from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import { FiSearch } from '../components/icons/hugeicons';
import { Avatar, FormSection, usePeopleQuery } from '../components/people/PeopleBits';
import '../styles/redesign-p-people.css';

const PAGE_STEP = 20;

const DashboardOfficeTeam = () => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('All');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    roleIds: [],
    email: '',
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
  });
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    phoneNumber: '',
    roleIds: [],
    isActive: true,
    email: '',
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
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

  // Fetch countries once on mount for the cascade dropdowns
  useEffect(() => {
    getIndianCountries()
      .then(r => setCountries(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => {});
  }, []);

  const fetchStates = async (countryId) => {
    if (!countryId) { setStates([]); return; }
    try {
      const r = await getStates(countryId);
      setStates(Array.isArray(r) ? r : (r?.data || []));
    } catch { setStates([]); }
  };

  const fetchCities = async (stateId) => {
    if (!stateId) { setCities([]); return; }
    try {
      const r = await getCities(stateId);
      setCities(Array.isArray(r) ? r : (r?.data || []));
    } catch { setCities([]); }
  };

  // Update edit form data when editRow changes
  useEffect(() => {
    if (editRow) {
      setEditFormData({
        fullName: editRow.fullName || '',
        phoneNumber: editRow.phoneNumber || '',
        roleIds: Array.isArray(editRow.roleIds) && editRow.roleIds.length
          ? editRow.roleIds
          : (editRow.roleId ? [editRow.roleId] : []),
        isActive: editRow.isActive !== undefined ? editRow.isActive : true,
        email: editRow.email || '',
        address: editRow.address || '',
        country_id: editRow.country_id || '',
        state_id: editRow.state_id || '',
        city_id: editRow.city_id || '',
      });
      fetchStates(editRow.country_id);
      fetchCities(editRow.state_id);
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

      // Multi-role: the backend now returns each user's full roles array. Build
      // the list of role ids + a display string; fall back to the primary role.
      const roleList = Array.isArray(user.roles) && user.roles.length
        ? user.roles.map(r => ({
            id: r.role_id || r.id,
            label: formatRoleName(r.role_name || r.name || '') || (r.role_id || r.id),
          }))
        : (user.role_id ? [{ id: user.role_id, label: roleName }] : []);
      const roleIds = roleList.map(r => r.id);
      const rolesDisplay = roleList.map(r => r.label).join(', ') || roleName;

      return {
        id: user.user_id || user.id,
        fullName: user.full_name || user.fullName || user.name || '',
        phoneNumber: user.phone || user.phoneNumber || '',
        role: rolesDisplay,
        roleId: user.role_id || user.roleId,
        roleIds,
        status: user.is_active ? 'Active' : 'Inactive',
        isActive: user.is_active || false,
        profile_image: user.profile_image || '',
        email: user.email || '',
        address: user.address || '',
        country_id: user.country_id || '',
        state_id: user.state_id || '',
        city_id: user.city_id || '',
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

  // --- Roles multi-select (uses our PagedMultiSelect widget) ---------------
  // Roles is a small static list, so "fetch a page" just filters + slices the
  // in-memory roleOptions. This lets us reuse the same widget as zones/states.
  const roleFetchPage = (page, search) => {
    const term = String(search || '').trim().toLowerCase();
    const filtered = term
      ? roleOptions.filter((o) => o.label.toLowerCase().includes(term))
      : roleOptions;
    const start = (page - 1) * 20;
    return Promise.resolve(filtered.slice(start, start + 20));
  };
  const roleMapItem = (o) => ({ value: o.value, label: o.label });
  // roleIds -> [{ id, label }] chips for the widget's `selected` prop.
  const selectedRoleChips = (ids) =>
    (ids || []).map((id) => {
      const opt = roleOptions.find((o) => String(o.value) === String(id));
      return { id, label: opt ? opt.label : id };
    });
  // Toggle a role id on/off in an ids array and hand the result to `setNext`.
  const toggleRoleId = (ids, opt, setNext) => {
    const list = ids || [];
    const exists = list.some((id) => String(id) === String(opt.value));
    setNext(exists
      ? list.filter((id) => String(id) !== String(opt.value))
      : [...list, opt.value]);
  };

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

  const roleListOf = (row) => String(row.role || '').split(', ').filter(Boolean);

  const [query, setQuery] = usePeopleQuery();
  const [shown, setShown] = useState(PAGE_STEP);

  const listRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredRowsByTab;
    return filteredRowsByTab.filter(r => [r.fullName, r.phoneNumber, r.email, r.role]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [filteredRowsByTab, query]);

  useEffect(() => { setShown(PAGE_STEP); }, [query, activeTab]);

  const tabCounts = useMemo(() => ({
    All: rows.length,
    Activate: rows.filter(r => r.isActive).length,
    Deactivate: rows.filter(r => !r.isActive).length,
  }), [rows]);

  const columns = useMemo(() => ([
    { key: 'fullName', label: 'NAME', render: (_v, row) => (
      <div className="pp-who">
        <Avatar name={row.fullName} />
        <div className="pp-who__t">
          <span className="pp-who__n">{row.fullName}</span>
          {row.email ? <span className="pp-sub">{row.email}</span> : null}
        </div>
      </div>
    ) },
    { key: 'role', label: 'ROLES', render: (v) => (
      <span className="pp-pills">
        {String(v || '').split(', ').filter(Boolean).map((r) => <span key={r} className="pp-pill">{r}</span>)}
      </span>
    ) },
    { key: 'phoneNumber', label: 'PHONE', render: (v) => <span className="pp-num">{v ? (String(v).startsWith('+') ? v : `+${v}`) : '-'}</span> },
    { key: 'status', label: 'STATUS', render: (v, row) => (
      <span className={`pp-pill ${row.isActive ? 'pp-pill--ok' : 'pp-pill--off'}`}>{v}</span>
    ) },
    { key: 'action', label: 'ACTION', render: (_v, row) => (
      <RowActions onEdit={() => setEditRow(row)}/>
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
        name: formData.fullName.trim(),
        phone: phoneNumber,
        email: formData.email || '',
        address: formData.address || '',
        country_id: formData.country_id || null,
        state_id: formData.state_id || null,
        city_id: formData.city_id || null,
        role_ids: formData.roleIds,
        is_active: true,
      };

      await createUser(userData);

      // Reset form and close modal
      setFormData({
        fullName: '',
        phoneNumber: '',
        roleIds: [],
        email: '',
        address: '',
        country_id: '',
        state_id: '',
        city_id: '',
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

      await updateUserById(editRow.id, {
        name: editFormData.fullName,
        phone: phoneNumber,
        email: editFormData.email || '',
        address: editFormData.address || '',
        country_id: editFormData.country_id || null,
        state_id: editFormData.state_id || null,
        city_id: editFormData.city_id || null,
        is_active: editFormData.isActive,
        role_ids: editFormData.roleIds,
      });
      
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
    const confirmed = await confirm(`Are you sure you want to delete user "${row.fullName}"?`);
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

  const emptyAdd = {
    fullName: '',
    phoneNumber: '',
    roleIds: [],
    email: '',
    address: '',
    country_id: '',
    state_id: '',
    city_id: '',
  };
  const emptyEdit = { ...emptyAdd, isActive: true };

  const closeAdd = () => {
    setOpenAdd(false);
    setFormData(emptyAdd);
  };
  const closeEdit = () => {
    setEditRow(null);
    setEditFormData(emptyEdit);
  };

  const footerFor = (isEdit) => {
    const d = isEdit ? editFormData : formData;
    return (
      <>
        <span className="pp-foot-note">Nothing is saved until you press {isEdit ? 'Update' : 'Save'}.</span>
        <button className="ui-btn ui-btn--secondary pp-btn" onClick={isEdit ? closeEdit : closeAdd} disabled={loading}>
          Cancel
        </button>
        <button
          className="ui-btn ui-btn--primary pp-btn pp-btn--pri"
          onClick={isEdit ? handleEditSubmit : handleSubmit}
          disabled={loading || !d.fullName || !d.phoneNumber || !d.roleIds.length || !d.address}
        >
          {loading ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update' : 'Save')}
        </button>
      </>
    );
  };

  // Same fields for Add and Edit; Edit also has the Active switch.
  const renderFields = (isEdit) => {
    const d = isEdit ? editFormData : formData;
    const patch = (obj) => (isEdit
      ? setEditFormData(prev => ({ ...prev, ...obj }))
      : setFormData(prev => ({ ...prev, ...obj })));
    return (
      <form className="ui-form pp-form" onSubmit={isEdit ? handleEditSubmit : handleSubmit}>
        <FormSection title="Person" hint="Who they are and how to reach them.">
          <div className="form-group pp-full">
            <label className="ui-label">Full name *</label>
            <input
              className="ui-input"
              placeholder="Enter full name"
              value={d.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Phone number *</label>
            <PhoneInput
              defaultCountry="in"
              value={d.phoneNumber ? (String(d.phoneNumber).startsWith('+') ? String(d.phoneNumber) : '+' + d.phoneNumber) : ''}
              onChange={(phone) => patch({ phoneNumber: phone.replace(/^\+/, '') })}
              className="phone-intl"
              inputProps={{ required: true, placeholder: isEdit ? 'Enter phone number' : 'Enter your phone number' }}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Email</label>
            <input
              className="ui-input"
              type="email"
              placeholder="Enter email"
              value={d.email}
              onChange={(e) => patch({ email: e.target.value })}
            />
          </div>
        </FormSection>

        <FormSection title="Roles" hint="A member can hold several roles and sees the pages of all of them.">
          <div className="form-group pp-full">
            <label className="ui-label">Roles * <span className="text-text-muted font-normal">(select one or more)</span></label>
            <PagedMultiSelect
              fetchPage={roleFetchPage}
              mapItem={roleMapItem}
              selected={selectedRoleChips(d.roleIds)}
              onToggle={(opt) => toggleRoleId(d.roleIds, opt, (next) => patch({ roleIds: next }))}
              onRemove={(id) => patch({ roleIds: d.roleIds.filter((rid) => String(rid) !== String(id)) })}
              placeholder="Select roles"
              searchPlaceholder="Search roles…"
            />
          </div>
        </FormSection>

        <FormSection title="Address">
          <div className="form-group pp-full">
            <label className="ui-label">Address *</label>
            <input
              className="ui-input"
              placeholder="Enter address"
              value={d.address}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="ui-label">Country</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select Country' },
                ...countries.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={d.country_id}
              onChange={(value) => {
                patch({ country_id: value, state_id: '', city_id: '' });
                fetchStates(value);
              }}
              onOpen={() => { if (!countries.length) getIndianCountries().then(r => setCountries(Array.isArray(r) ? r : (r?.data || []))).catch(() => {}); }}
              placeholder="Select Country"
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">State</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select State' },
                ...states.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={d.state_id}
              onChange={(value) => {
                patch({ state_id: value, city_id: '' });
                fetchCities(value);
              }}
              placeholder="Select State"
              disabled={!d.country_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
          <div className="form-group">
            <label className="ui-label">City</label>
            <DropdownSelector
              options={[
                { value: '', label: 'Select City' },
                ...cities.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={d.city_id}
              onChange={(value) => patch({ city_id: value })}
              placeholder="Select City"
              disabled={!d.state_id}
              className="ui-dropdown-custom--full-width"
            />
          </div>
        </FormSection>

        {isEdit && (
          <FormSection title="Status" hint="Inactive people stay in the list. Nothing is deleted.">
            <div className="form-group pp-full">
              <label className="pp-check">
                <input
                  type="checkbox"
                  checked={d.isActive}
                  onChange={(e) => patch({ isActive: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
          </FormSection>
        )}
      </form>
    );
  };

  const tabLabel = { All: 'All', Activate: 'Active', Deactivate: 'Inactive' };

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4 pp-team">
        <div className="pg-head">
          <div><h1>Office team</h1><p>Admin only. A member can hold several roles and sees the pages of all of them.</p></div>
          <button type="button" className="pp-btn pp-btn--pri" onClick={() => setOpenAdd(true)}>Add team member</button>
        </div>

        <div className="pp-bar">
          <label className="pp-search">
            <FiSearch size={18} />
            <input
              type="search"
              placeholder="Search name, phone or role"
              aria-label="Search the office team"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="pp-chips" role="group" aria-label="Filter by status">
          {['All', 'Activate', 'Deactivate'].map(tab => (
            <button key={tab} type="button" className="pp-chip" aria-pressed={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tabLabel[tab]} <b>{tabCounts[tab]}</b>
            </button>
          ))}
        </div>

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
              <button className="ui-btn ui-btn--secondary pp-btn" onClick={() => fetchUsers()}>
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
              <button className="ui-btn ui-btn--primary pp-btn pp-btn--pri" onClick={() => setOpenAdd(true)}>
                Add team member
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="pp-list pp-desk">
              <TableWithControls
                title="Office team"
                columns={columns}
                rows={listRows}
                showSerialNumber={false}
                selectable={false}
                loading={loading}
              />
            </div>
            <div className="pp-mob" aria-busy={loading}>
              {loading ? (
                <div className="pp-empty">Loading the team...</div>
              ) : listRows.length === 0 ? (
                <div className="pp-empty">No team members match.</div>
              ) : (
                <>
                  {listRows.slice(0, shown).map((row) => (
                    <article className="pp-card" key={row.id}>
                      <div className="pp-card__top">
                        <div className="pp-who">
                          <Avatar name={row.fullName} />
                          <div className="pp-who__t">
                            <span className="pp-who__n">{row.fullName}</span>
                            {row.email ? <span className="pp-sub">{row.email}</span> : null}
                          </div>
                        </div>
                        <span className={`pp-pill ${row.isActive ? 'pp-pill--ok' : 'pp-pill--off'}`}>{row.status}</span>
                      </div>
                      <span className="pp-pills">
                        {roleListOf(row).map(r => <span key={r} className="pp-pill">{r}</span>)}
                      </span>
                      <div className="pp-card__foot">
                        {row.phoneNumber
                          ? <a href={`tel:${String(row.phoneNumber).startsWith('+') ? row.phoneNumber : '+' + row.phoneNumber}`}>{String(row.phoneNumber).startsWith('+') ? row.phoneNumber : `+${row.phoneNumber}`}</a>
                          : <span className="pp-sub">No phone</span>}
                        <button type="button" className="pp-btn" onClick={() => setEditRow(row)} aria-label={`Edit ${row.fullName}`}>Edit</button>
                      </div>
                    </article>
                  ))}
                  {listRows.length > shown && (
                    <button type="button" className="pp-btn pp-more" onClick={() => setShown(n => n + PAGE_STEP)}>
                      Show more ({listRows.length - shown} left)
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      <AsidePanel
        open={openAdd}
        onClose={closeAdd}
        title="Add new user"
        width="lg"
        footer={footerFor(false)}
      >
        {renderFields(false)}
      </AsidePanel>
      <AsidePanel
        open={!!editRow}
        onClose={closeEdit}
        title="Edit user"
        width="lg"
        footer={footerFor(true)}
      >
        {renderFields(true)}
      </AsidePanel>
    </div>
  );
};

export default DashboardOfficeTeam;
