import React, { useState, useEffect, useMemo } from 'react';
import Skeleton from '../components/ui/Skeleton';
import TableWithControls from '../components/ui/TableWithControls';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import AsidePanel from '../components/ui/AsidePanel';
import RowActions from '../components/ui/RowActions';
import DropdownSelector from '../components/ui/DropdownSelector';
import { useConfirm } from '../components/ui/ConfirmProvider';
import {
  getSalesmanExpenses,
  getAllAdminExpenses,
  createSalesmanExpense,
  uploadExpenseImages,
  updateSalesmanExpense,
  deleteSalesmanExpense
} from '../services/expenseService';
import { showSuccess, showError } from '../services/notificationService';
import { getUserRole, getUserRoles, getUser } from '../services/authService';
import '../styles/pages/dashboard-expenses.css';


const EXPENSE_TYPE_OPTIONS = [
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'city_tour', label: 'City tour' },
  { value: 'toll', label: 'Toll' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'other', label: 'Other' },
];
const TRAVEL_MODE_OPTIONS = [
  { value: 'bus', label: 'Bus' },
  { value: 'train', label: 'Train' },
  { value: 'rapido', label: 'Rapido' },
  { value: 'auto', label: 'Auto' },
  { value: 'cab', label: 'Cab' },
  { value: 'metro', label: 'Metro' },
  { value: 'bike', label: 'Bike' },
  { value: 'own_vehicle', label: 'Own vehicle' },
  { value: 'other', label: 'Other' },
];
const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') : 'N/A');
const typeLabel = (e) => {
  const base = labelOf(EXPENSE_TYPE_OPTIONS, e.expense_type);
  return e.expense_type === 'travel' && e.travel_mode ? `${base} · ${labelOf(TRAVEL_MODE_OPTIONS, e.travel_mode)}` : base;
};

const DashboardExpenses = () => {
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  // The user role comes from localStorage, which is empty during SSR. Reading it
  // on the first render produces server/client markup that disagrees (hydration
  // mismatch). Gate role-dependent UI on `mounted` so the first client render
  // matches the server, then switch to the real role after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const userRole = getUserRole();
  const user = getUser();
  
  // Who sees which view. Only the admin reviews EVERY salesman's claims (approve / reject).
  // Only a salesman files and tracks their own. Other roles do not get this page at all.
  // A person with several roles gets the review view if any of them is admin.
  const REVIEWER_ROLES = ['admin', 'administrator'];
  const allRoles = (typeof getUserRoles === 'function' ? getUserRoles() : []).map((r) => String(r || '').toLowerCase().trim());
  const normalizedRole = userRole?.toLowerCase()?.trim();
  const isAdmin = mounted && (REVIEWER_ROLES.includes(normalizedRole) || allRoles.some((r) => REVIEWER_ROLES.includes(r)));
  const isSalesman = normalizedRole === 'salesman' || normalizedRole === 'sales' || normalizedRole === 'salesperson';

  const shouldShowAdminFeatures = isAdmin;
  const shouldShowSalesmanFeatures = !isAdmin; // only salesmen reach this page without a reviewer role

  // Bill photos are saved by the server as /uploads/bills/<file> (same-origin through the proxy).
  const billSrc = (img) => (/^https?:/.test(img) || String(img).startsWith('/uploads') ? img : `${getBaseURL()}/${img}`);

  // Helper function for base URL
  const getBaseURL = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      let url = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
      if (!url.includes('/api')) {
        url = `${url}/api`;
      }
      return url;
    }
    return 'https://stallion.nishree.com/api';
  };
  
  const [createFormData, setCreateFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    expense_amount: '',
    expense_description: '',
    expense_type: 'food',
    travel_mode: '',
    toll_message: '',
    kilometers: '',
    images: []
  });
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [filePreviewUrls, setFilePreviewUrls] = useState([]);

  // Fetch expenses
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      
      console.log('User role:', userRole);
      console.log('Should show admin features:', shouldShowAdminFeatures);
      
      if (shouldShowAdminFeatures) {
        // Admin: Get ALL expenses from ALL salesmen using the new endpoint
        console.log('Calling getAllAdminExpenses...');
        response = await getAllAdminExpenses();
        console.log('Admin API Response:', response);
        console.log('First expense object:', response[0]);
        if (response[0]) {
          console.log('Salesman name in first expense:', response[0].salesman_name);
          console.log('Salesman ID in first expense:', response[0].salesman_id);
        }
      } else {
        // Salesman: Get only their own expenses
        console.log('Calling getSalesmanExpenses...');
        response = await getSalesmanExpenses();
        console.log('Salesman API Response:', response);
      }
      
      setExpenses(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      const message = err?.message || 'Failed to fetch expenses';
      
      // Don't show error for "not found" - just means no expenses exist
      if (!message.toLowerCase().includes('not found')) {
        showError(message);
        setError(message);
      }
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for mount so the role (from localStorage) is resolved before we
    // pick the admin vs salesman endpoint — avoids a wrong first fetch.
    if (mounted) fetchExpenses();
  }, [mounted]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      cleanupPreviewUrls();
    };
  }, []);

  // Transform expenses to table rows
  const rows = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];

    return expenses.map(expense => {
      // Parse images - handle both array and JSON string formats
      let parsedImages = [];
      try {
        if (expense.images) {
          if (Array.isArray(expense.images)) {
            parsedImages = expense.images;
          } else if (typeof expense.images === 'string') {
            parsedImages = JSON.parse(expense.images);
          }
        }
      } catch (e) {
        console.error('Error parsing images for expense:', expense.id, e);
        parsedImages = [];
      }

      return {
        id: expense.id,
        date: new Date(expense.expense_date).toLocaleDateString('en-IN'),
        salesman: shouldShowAdminFeatures ? (
          expense.salesman_name || 
          `Salesman ${expense.salesman_id?.substring(0, 8)}...` || 
          'Unknown'
        ) : undefined,
        type: typeLabel(expense),
        description: expense.expense_description || 'N/A',
        amount: `₹${parseFloat(expense.expense_amount || 0).toLocaleString('en-IN')}`,
        kilometers: expense.kilometers ? `${expense.kilometers} km` : '-',
        status: expense.status || 'pending',
        remarks: expense.remarks || '-',
        images: parsedImages,
        originalExpense: {
          ...expense,
          images: parsedImages // Ensure the original expense also has parsed images
        }
      };
    });
  }, [expenses, shouldShowAdminFeatures]);

  // Filter by tab
  const filteredRows = useMemo(() => {
    if (activeTab === 'All') return rows;
    return rows.filter(row => row.status.toLowerCase() === activeTab.toLowerCase());
  }, [rows, activeTab]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    
    // Create preview URLs
    const previewUrls = files.map(file => URL.createObjectURL(file));
    setFilePreviewUrls(previewUrls);
  };

  // Clean up preview URLs
  const cleanupPreviewUrls = () => {
    filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setFilePreviewUrls([]);
  };

  // Handle create expense
  const handleCreateExpense = async () => {
    try {
      if (!createFormData.expense_amount || !createFormData.expense_description) {
        showError('Please fill all required fields');
        return;
      }

      if (createFormData.expense_type === 'travel' && !createFormData.travel_mode) {
        showError('Please choose how you travelled (bus, train, Rapido ...)');
        return;
      }
      if (createFormData.expense_type === 'toll' && !createFormData.toll_message.trim()) {
        showError('Please add a toll message (which toll, where)');
        return;
      }

      // Validate amount is positive
      if (parseFloat(createFormData.expense_amount) <= 0) {
        showError('Amount must be greater than 0');
        return;
      }

      // Validate kilometers is positive if provided
      if (createFormData.kilometers && parseInt(createFormData.kilometers) <= 0) {
        showError('Kilometers must be greater than 0');
        return;
      }

      setLoading(true);

      // Upload images first if any
      let imageUrls = [];
      if (selectedFiles.length > 0) {
        try {
          setUploadingImages(true);
          const uploadResponse = await uploadExpenseImages(selectedFiles);
          imageUrls = uploadResponse.images || [];
          showSuccess(`${selectedFiles.length} image(s) uploaded successfully`);
        } catch (uploadError) {
          showError(`Failed to upload images: ${uploadError.message}`);
          setUploadingImages(false);
          setLoading(false);
          return;
        } finally {
          setUploadingImages(false);
        }
      }

      // Create expense
      const expenseData = {
        expense_date: new Date(createFormData.expense_date).toISOString(),
        expense_amount: parseFloat(createFormData.expense_amount),
        expense_description: createFormData.expense_description,
        expense_type: createFormData.expense_type,
        images: imageUrls
      };

      if (createFormData.expense_type === 'travel') expenseData.travel_mode = createFormData.travel_mode;
      if (createFormData.expense_type === 'toll') expenseData.toll_message = createFormData.toll_message.trim();

      // Kilometers are optional for travel and city tour
      if (createFormData.kilometers && ['travel', 'city_tour'].includes(createFormData.expense_type)) {
        expenseData.kilometers = parseInt(createFormData.kilometers);
      }

      await createSalesmanExpense(expenseData);
      showSuccess('Expense created successfully');
      setCreateModalOpen(false);
      resetCreateForm();
      await fetchExpenses();
    } catch (err) {
      const message = err?.message || 'Failed to create expense';
      showError(message);
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  // Reset create form
  const resetCreateForm = () => {
    setCreateFormData({
      expense_date: new Date().toISOString().split('T')[0],
      expense_amount: '',
      expense_description: '',
      expense_type: 'food',
      travel_mode: '',
      toll_message: '',
      kilometers: '',
      images: []
    });
    setSelectedFiles([]);
    cleanupPreviewUrls();
  };

  // Handle update expense (admin only)
  const handleUpdateExpense = async () => {
    try {
      if (!selectedExpense) return;

      setLoading(true);
      const updateData = {
        status: selectedExpense.status,
        remarks: selectedExpense.remarks || ''
      };

      await updateSalesmanExpense(selectedExpense.id, updateData);
      showSuccess('Expense updated successfully');
      setEditModalOpen(false);
      setSelectedExpense(null);
      await fetchExpenses();
    } catch (err) {
      const message = err?.message || 'Failed to update expense';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete expense
  const handleDelete = async (row) => {
    if (!(await confirm('Are you sure you want to delete this expense?'))) return;

    try {
      setLoading(true);
      await deleteSalesmanExpense(row.id);
      showSuccess('Expense deleted successfully');
      await fetchExpenses();
    } catch (err) {
      const message = err?.message || 'Failed to delete expense';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalExpenses = expenses.length;
    const pendingExpenses = expenses.filter(e => e.status === 'pending').length;
    const approvedExpenses = expenses.filter(e => e.status === 'approved').length;
    const rejectedExpenses = expenses.filter(e => e.status === 'rejected').length;
    const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.expense_amount || 0), 0);
    const approvedAmount = expenses
      .filter(e => e.status === 'approved')
      .reduce((sum, e) => sum + parseFloat(e.expense_amount || 0), 0);

    // Calculate by expense type
    const expensesByType = expenses.reduce((acc, expense) => {
      const type = expense.expense_type || 'other';
      if (!acc[type]) {
        acc[type] = { count: 0, amount: 0 };
      }
      acc[type].count += 1;
      acc[type].amount += parseFloat(expense.expense_amount || 0);
      return acc;
    }, {});

    return {
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      rejectedExpenses,
      totalAmount,
      approvedAmount,
      expensesByType
    };
  }, [expenses]);

  const columns = useMemo(() => {
    const baseColumns = [
      { key: 'date', label: 'DATE' },
      ...(shouldShowAdminFeatures ? [{ key: 'salesman', label: 'SALESMAN' }] : []),
      { key: 'type', label: 'TYPE' },
      { key: 'kilometers', label: 'KM' },
      { 
        key: 'status', 
        label: 'STATUS', 
        render: (v) => {
          const k = String(v).toLowerCase();
          const label = k.charAt(0).toUpperCase() + k.slice(1);
          return <StatusBadge status={k === 'approved' ? 'completed' : k}>{label}</StatusBadge>;
        }
      },
      { key: 'amount', label: 'AMOUNT', render: (v) => <b className="exp-amount">{v}</b> },
      { 
        key: 'action', 
        label: 'ACTION', 
        render: (_v, row) => (
          <div className="flex gap-2 relative z-[1]">
            <button 
              className="ui-btn ui-btn--ghost ui-btn--sm has-tt" 
              onClick={() => {
                setSelectedExpense(row.originalExpense);
                setEditModalOpen(true);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7-11-7-11-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <span className="ui-tt">View</span>
            </button>
            {shouldShowAdminFeatures && row.originalExpense.status === 'pending' && (
              <>
                <button
                  className="ui-btn ui-btn--ghost ui-btn--sm has-tt"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await updateSalesmanExpense(row.id, { status: 'approved', remarks: row.originalExpense.remarks || '' });
                      showSuccess('Expense approved successfully');
                      await fetchExpenses();
                    } catch (err) {
                      showError(err?.message || 'Failed to approve expense');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="ui-tt">Approve</span>
                </button>
                <button
                  className="ui-btn ui-btn--ghost ui-btn--sm has-tt"
                  onClick={async () => {
                    const remarks = prompt('Enter rejection remarks (optional):');
                    if (remarks !== null) { // User didn't cancel
                      try {
                        setLoading(true);
                        await updateSalesmanExpense(row.id, { status: 'rejected', remarks: remarks || '' });
                        showSuccess('Expense rejected successfully');
                        await fetchExpenses();
                      } catch (err) {
                        showError(err?.message || 'Failed to reject expense');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={loading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="ui-tt">Reject</span>
                </button>
              </>
            )}
          </div>
        ) 
      },
    ];
    
    return baseColumns;
  }, [shouldShowAdminFeatures, shouldShowSalesmanFeatures, loading]);

  return (
    <div className="dash-page">
      <div className="dash-container exp-page">
        <div className="pg-head"><div><h1>Expenses</h1><p>Salesmen submit claims with bills. Admin and expense managers review them.</p></div></div>
        {/* Summary Cards */}
        <div className="dash-row expenses-summary grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="dash-card p-5 lg:p-6">
            <h4>Total Expenses</h4>
            <div className="metric-value my-2 text-[length:var(--text-xl)] lg:text-[length:var(--text-2xl)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.totalExpenses}</div>
            <div className="metric-sub mt-2 text-[length:var(--text-sm)] text-text-muted tabular-nums">₹{summaryStats.totalAmount.toLocaleString('en-IN')}</div>
          </div>

          <div className="dash-card p-5 lg:p-6">
            <h4>Pending</h4>
            <div className="metric-value my-2 text-[length:var(--text-xl)] lg:text-[length:var(--text-2xl)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.pendingExpenses}</div>
            <div className="metric-sub mt-2 text-[length:var(--text-sm)] text-text-muted tabular-nums">Awaiting Approval</div>
          </div>

          <div className="dash-card p-5 lg:p-6">
            <h4>Approved</h4>
            <div className="metric-value my-2 text-[length:var(--text-xl)] lg:text-[length:var(--text-2xl)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.approvedExpenses}</div>
            <div className="metric-sub mt-2 text-[length:var(--text-sm)] text-text-muted tabular-nums">₹{summaryStats.approvedAmount.toLocaleString('en-IN')}</div>
          </div>

          <div className="dash-card p-5 lg:p-6">
            <h4>Rejected</h4>
            <div className="metric-value my-2 text-[length:var(--text-xl)] lg:text-[length:var(--text-2xl)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text tabular-nums">{loading ? <Skeleton width={90} height={24} /> : summaryStats.rejectedExpenses}</div>
            <div className="metric-sub mt-2 text-[length:var(--text-sm)] text-text-muted tabular-nums">Need Review</div>
          </div>
        </div>

        {/* Status filter chips */}
        <Tabs
          className="exp-chips mb-4"
          active={activeTab}
          onChange={setActiveTab}
          tabs={['All', 'Pending', 'Approved', 'Rejected'].map((t) => ({
            value: t,
            label: `${t} ${t === 'All' ? rows.length : rows.filter((r) => r.status.toLowerCase() === t.toLowerCase()).length}`,
          }))}
        />

        {/* Expenses Table */}
        <div className="dash-card">
          <div className="card-header flex flex-col items-stretch md:flex-row md:items-center md:justify-between gap-4 p-6 border-b border-border">
            <h3 className="m-0 text-center md:text-left text-[length:var(--text-lg)] font-semibold leading-[var(--leading-tight)] tracking-[-0.01em] text-text">{shouldShowAdminFeatures ? 'All Salesman Expenses' : 'My Expenses'}</h3>
            {shouldShowSalesmanFeatures && (
              <Button onClick={() => setCreateModalOpen(true)}>
                New expense
              </Button>
            )}
          </div>
          
          {error && !loading ? (
            <div className="ui-state ui-state--error">
              <div className="ui-state__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16.5" r="1" fill="currentColor" />
                </svg>
              </div>
              <p className="ui-state__title">Couldn't load expenses</p>
              <p className="ui-state__desc">{error}</p>
              <button className="ui-btn ui-btn--secondary" onClick={fetchExpenses}>
                Try again
              </button>
            </div>
          ) : !loading && expenses.length === 0 ? (
            <div className="ui-state ui-state--empty">
              <div className="ui-state__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 7h16M4 7l1.5 12.5A2 2 0 0 0 7.5 21h9a2 2 0 0 0 2-1.5L20 7M4 7l2-3h12l2 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 11v6M9 11v6M15 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="ui-state__title">No expenses yet</p>
              <p className="ui-state__desc">
                {shouldShowSalesmanFeatures
                  ? 'Add your first expense to start tracking travel, fuel and other costs.'
                  : 'No expenses have been submitted by any salesman yet.'}
              </p>
              {shouldShowSalesmanFeatures && (
                <button className="ui-btn ui-btn--primary" onClick={() => setCreateModalOpen(true)}>
                  New expense
                </button>
              )}
            </div>
          ) : (
            <TableWithControls
              columns={columns}
              rows={filteredRows}
              loading={loading}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tabs={['All', 'Pending', 'Approved', 'Rejected']}
              searchPlaceholder="Search expenses..."
            />
          )}
        </div>
      </div>

      {/* Create Expense Modal */}
      <AsidePanel
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetCreateForm();
        }}
        title="New expense"
      >
        <div className="modal-form flex flex-col gap-4">
          <div className="form-group flex flex-col gap-2">
            <label className="text-[length:var(--text-sm)] font-medium text-text">Expense Date *</label>
            <input
              className="min-h-10 px-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed"
              type="date"
              value={createFormData.expense_date}
              onChange={(e) => setCreateFormData({ ...createFormData, expense_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group flex flex-col gap-2">
            <label className="text-[length:var(--text-sm)] font-medium text-text">Expense Type *</label>
            <DropdownSelector
              options={EXPENSE_TYPE_OPTIONS}
              value={createFormData.expense_type}
              onChange={(value) => setCreateFormData({ ...createFormData, expense_type: value, travel_mode: '', toll_message: '' })}
              searchable={false}
              className="ui-dropdown-custom--full-width"
            />
          </div>

          {createFormData.expense_type === 'travel' && (
            <div className="form-group flex flex-col gap-2">
              <label className="text-[length:var(--text-sm)] font-medium text-text">Mode *</label>
              <DropdownSelector
                options={TRAVEL_MODE_OPTIONS}
                value={createFormData.travel_mode}
                onChange={(value) => setCreateFormData({ ...createFormData, travel_mode: value })}
                placeholder="Bus, train, Rapido ..."
                searchable={false}
                className="ui-dropdown-custom--full-width"
              />
            </div>
          )}

          {createFormData.expense_type === 'toll' && (
            <div className="form-group flex flex-col gap-2">
              <label className="text-[length:var(--text-sm)] font-medium text-text">Toll message *</label>
              <input
                className="min-h-10 px-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] placeholder:text-text-subtle transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)]"
                type="text"
                maxLength={500}
                placeholder="Which toll, from where to where"
                value={createFormData.toll_message}
                onChange={(e) => setCreateFormData({ ...createFormData, toll_message: e.target.value })}
              />
            </div>
          )}

          <div className="form-group flex flex-col gap-2">
            <label className="text-[length:var(--text-sm)] font-medium text-text">Amount *</label>
            <input
              className="min-h-10 px-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] placeholder:text-text-subtle transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed"
              type="number"
              placeholder="Enter amount"
              value={createFormData.expense_amount}
              onChange={(e) => setCreateFormData({ ...createFormData, expense_amount: e.target.value })}
              required
            />
          </div>

          {/* Kilometers are optional for travel and city tour */}
          {['travel', 'city_tour'].includes(createFormData.expense_type) && (
            <div className="form-group flex flex-col gap-2">
              <label className="text-[length:var(--text-sm)] font-medium text-text">Kilometers (optional)</label>
              <input
                className="min-h-10 px-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] placeholder:text-text-subtle transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed"
                type="number"
                placeholder="Enter kilometers"
                value={createFormData.kilometers}
                onChange={(e) => setCreateFormData({ ...createFormData, kilometers: e.target.value })}
              />
            </div>
          )}

          <div className="form-group flex flex-col gap-2">
            <label className="text-[length:var(--text-sm)] font-medium text-text">Description *</label>
            <textarea
              className="min-h-20 p-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] leading-[var(--leading-normal)] resize-y placeholder:text-text-subtle transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed"
              placeholder="Enter description"
              value={createFormData.expense_description}
              onChange={(e) => setCreateFormData({ ...createFormData, expense_description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="form-group flex flex-col gap-2">
            <label className="text-[length:var(--text-sm)] font-medium text-text">Upload Bills</label>
            <input
              className="min-h-10 px-3 rounded-md border border-border-strong bg-surface text-text text-[length:var(--text-base)] transition-[border-color,box-shadow] duration-[var(--transition-fast)] hover:border-grey-400 focus:outline-none focus:border-primary focus:shadow-[var(--focus-ring)] disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
            />
            {selectedFiles.length > 0 && (
              <div className="file-preview-section mt-2">
                <div className="file-list flex flex-col gap-2 mt-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="file-item flex flex-col items-start gap-1 sm:flex-row sm:justify-between sm:items-center sm:gap-3 px-3 py-2 rounded-md bg-surface-muted text-[length:var(--text-sm)] text-text-muted">
                      <span>{file.name}</span>
                      <span className="file-size text-[length:var(--text-xs)] text-text-subtle tabular-nums">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ))}
                </div>
                {filePreviewUrls.length > 0 && (
                  <div className="image-preview-grid grid grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(100px,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-4 mt-2">
                    {filePreviewUrls.map((url, idx) => (
                      <div key={idx} className="image-preview-container group relative cursor-pointer rounded-lg overflow-hidden border border-border transition-[box-shadow,border-color] duration-[var(--transition)] hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
                        <img src={url} alt={`Preview ${idx + 1}`} className="bill-preview block w-full h-[100px] md:h-[150px] object-cover transition-transform duration-[var(--transition)] group-hover:scale-[1.04]" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-actions flex flex-col md:flex-row justify-end gap-3 mt-6 pt-4 border-t border-border [&_button]:w-full md:[&_button]:w-auto">
            <Button 
              variant="secondary" 
              onClick={() => {
                setCreateModalOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateExpense}
              disabled={loading || uploadingImages}
            >
              {uploadingImages ? 'Uploading...' : loading ? 'Creating...' : 'Create Expense'}
            </Button>
          </div>
        </div>
      </AsidePanel>

      {/* View Expense Modal */}
      <AsidePanel
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedExpense(null);
        }}
        title="Expense Details"
      >
        {selectedExpense && (
          <div className="expense-details flex flex-col gap-1">
            <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
              <strong className="font-medium text-text-muted min-w-[120px]">Date:</strong>
              <span className="flex-1 text-right text-text tabular-nums">{new Date(selectedExpense.expense_date).toLocaleDateString('en-IN')}</span>
            </div>

            <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
              <strong className="font-medium text-text-muted min-w-[120px]">Type:</strong>
              <span className="flex-1 text-right text-text tabular-nums">{typeLabel(selectedExpense)}</span>
            </div>

            {selectedExpense.toll_message && (
              <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
                <strong className="font-medium text-text-muted min-w-[120px]">Toll message:</strong>
                <span className="flex-1 text-right text-text">{selectedExpense.toll_message}</span>
              </div>
            )}

            <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
              <strong className="font-medium text-text-muted min-w-[120px]">Amount:</strong>
              <span className="flex-1 text-right text-text tabular-nums">₹{parseFloat(selectedExpense.expense_amount).toLocaleString('en-IN')}</span>
            </div>

            <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
              <strong className="font-medium text-text-muted min-w-[120px]">Description:</strong>
              <span className="flex-1 text-right text-text tabular-nums">{selectedExpense.expense_description}</span>
            </div>

            {selectedExpense.kilometers && (
              <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
                <strong className="font-medium text-text-muted min-w-[120px]">Kilometers:</strong>
                <span className="flex-1 text-right text-text tabular-nums">{selectedExpense.kilometers} km</span>
              </div>
            )}

            <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
              <strong className="font-medium text-text-muted min-w-[120px]">Status:</strong>
              <span className={`status-${selectedExpense.status} inline-flex items-center px-2 py-0.5 rounded-pill text-[length:var(--text-xs)] font-semibold tracking-[var(--tracking-label)] leading-[var(--leading-tight)] ${selectedExpense.status === 'pending' ? 'text-warning bg-warning-soft' : selectedExpense.status === 'approved' ? 'text-success bg-success-soft' : selectedExpense.status === 'rejected' ? 'text-error bg-error-soft' : ''}`}>
                {selectedExpense.status?.toUpperCase()}
              </span>
            </div>

            {selectedExpense.remarks && (
              <div className="detail-row flex justify-between items-start gap-4 py-3 border-b border-border last:border-b-0">
                <strong className="font-medium text-text-muted min-w-[120px]">Remarks:</strong>
                <span className="flex-1 text-right text-text tabular-nums">{selectedExpense.remarks}</span>
              </div>
            )}

            {selectedExpense.images && selectedExpense.images.length > 0 && (
              <div className="uploaded-bills mt-4">
                <strong className="block mb-2 font-semibold text-text">Uploaded Bills:</strong>
                <div className="image-preview-grid grid grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(100px,1fr))] md:[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] gap-4 mt-2">
                  {selectedExpense.images.map((img, idx) => (
                    <div key={idx} className="image-preview-container group relative cursor-pointer rounded-lg overflow-hidden border border-border transition-[box-shadow,border-color] duration-[var(--transition)] hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
                      <img
                        src={billSrc(img)}
                        alt={`Bill ${idx + 1}`}
                        className="bill-preview block w-full h-[100px] md:h-[150px] object-cover transition-transform duration-[var(--transition)] group-hover:scale-[1.04]"
                        onClick={() => window.open(billSrc(img), '_blank')}
                      />
                      <div className="image-preview-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-[var(--transition)] bg-[rgba(24,18,101,0.72)] text-text-on-primary text-[length:var(--text-sm)] font-medium text-center p-2 group-hover:opacity-100 group-focus-visible:opacity-100">
                        <span>Click to view full size</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions flex flex-col md:flex-row justify-end gap-3 mt-6 pt-4 border-t border-border [&_button]:w-full md:[&_button]:w-auto">
              <Button 
                variant="secondary" 
                onClick={() => {
                  setEditModalOpen(false);
                  setSelectedExpense(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </AsidePanel>
    </div>
  );
};

export default DashboardExpenses;
