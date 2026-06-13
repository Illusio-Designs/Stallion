import React, { useEffect, useMemo, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import Modal from '../components/ui/Modal';
import RowActions from '../components/ui/RowActions';
import StatusBadge from '../components/ui/StatusBadge';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-orders.css';

const EventStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Helper function to get status label
const getStatusLabel = (status) => {
  switch (status?.toLowerCase()) {
    case EventStatus.ACTIVE:
      return 'Active';
    case EventStatus.COMPLETED:
      return 'Completed';
    case EventStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status || 'Active';
  }
};

const DashboardEvents = () => {
  const [dateRange, setDateRange] = useState('Feb 25, 2025 - Mar 25, 2025');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    event_name: '', 
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    event_location: ''
  });
  const [error, setError] = useState(null);

  const columns = useMemo(() => ([
    { key: 'event_name', label: 'EVENT NAME' },
    { 
      key: 'start_date', 
      label: 'START DATE',
      render: (_v, row) => {
        if (!row.start_date) return 'N/A';
        try {
          const date = new Date(row.start_date);
          return date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        } catch (e) {
          return row.start_date;
        }
      }
    },
    { 
      key: 'end_date', 
      label: 'END DATE',
      render: (_v, row) => {
        if (!row.end_date) return 'N/A';
        try {
          const date = new Date(row.end_date);
          return date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        } catch (e) {
          return row.end_date;
        }
      }
    },
    { 
      key: 'event_location', 
      label: 'LOCATION',
      render: (_v, row) => {
        return row.event_location || 'N/A';
      }
    },
    { 
      key: 'event_status', 
      label: 'STATUS',
      render: (_v, row) => {
        const status = row.event_status || EventStatus.ACTIVE;
        return <StatusBadge status={status.toLowerCase()}>{getStatusLabel(status)}</StatusBadge>;
      }
    },
    {
      key: 'action',
      label: 'ACTIONS',
      render: (_v, row) => (
        <RowActions
          onEdit={() => openEdit(row)}
          onDownload={null}
          onDelete={() => handleDelete(row)}
        />
      ),
    },
  ]), []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err.message || 'Failed to load events';
      setError(message);
      setEvents([]);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const resetForm = () => setForm({ 
    event_name: '', 
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    event_location: ''
  });

  const handleSubmitNew = async () => {
    if (!form.event_name.trim()) {
      setError('Event name is required');
      return;
    }
    if (!form.start_date) {
      setError('Start date is required');
      return;
    }
    if (!form.end_date) {
      setError('End date is required');
      return;
    }
    if (!form.event_location.trim()) {
      setError('Event location is required');
      return;
    }
    if (new Date(form.start_date) > new Date(form.end_date)) {
      setError('End date must be after start date');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const eventData = {
        event_name: form.event_name.trim(),
        start_date: `${form.start_date}T00:00:00`,
        end_date: `${form.end_date}T00:00:00`,
        event_location: form.event_location.trim(),
      };
      await createEvent(eventData);
      showSuccess('Event created successfully');
      await fetchEvents();
      setOpenAdd(false);
      resetForm();
    } catch (err) {
      const message = err.message || 'Failed to create event';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    const startDate = row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const endDate = row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setForm({
      event_name: row.event_name || '',
      start_date: startDate,
      end_date: endDate,
      event_location: row.event_location || '',
    });
  };

  const handleUpdate = async () => {
    const eventId = editRow?.event_id || editRow?.id;
    if (!eventId) return;
    if (!form.event_name.trim()) {
      setError('Event name is required');
      return;
    }
    if (!form.start_date) {
      setError('Start date is required');
      return;
    }
    if (!form.end_date) {
      setError('End date is required');
      return;
    }
    if (!form.event_location.trim()) {
      setError('Event location is required');
      return;
    }
    if (new Date(form.start_date) > new Date(form.end_date)) {
      setError('End date must be after start date');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const eventData = {
        event_name: form.event_name.trim(),
        start_date: `${form.start_date}T00:00:00`,
        end_date: `${form.end_date}T00:00:00`,
        event_location: form.event_location.trim(),
      };
      await updateEvent(eventId, eventData);
      showSuccess('Event updated successfully');
      await fetchEvents();
      setEditRow(null);
      resetForm();
    } catch (err) {
      const message = err.message || 'Failed to update event';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const eventId = row?.event_id || row?.id;
    if (!eventId) return;
    const confirmed = window.confirm(`Delete event "${row.event_name}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEvent(eventId);
      showSuccess('Event deleted successfully');
      await fetchEvents();
    } catch (err) {
      const message = err.message || 'Failed to delete event';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => events, [events]);

  return (
    <div className="dash-page w-full">
      <div className="dash-container flex flex-col gap-4">
        <div className="dash-row grid grid-cols-1 gap-3 min-[560px]:grid-cols-12 min-[560px]:gap-4">
          <div className="dash-card full col-span-full bg-surface border border-border rounded-lg shadow-sm p-0">
            {error && !loading ? (
              <div className="ui-state ui-state--error">
                <div className="ui-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="ui-state__title">Couldn't load events</p>
                <p className="ui-state__desc">{error}</p>
                <button className="ui-btn ui-btn--secondary" onClick={fetchEvents}>Try again</button>
              </div>
            ) : !loading && events.length === 0 ? (
              <div className="ui-state ui-state--empty">
                <div className="ui-state__icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="ui-state__title">No events yet</p>
                <p className="ui-state__desc">Create your first event to start managing schedules and locations.</p>
                <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Event</button>
              </div>
            ) : (
              <TableWithControls
                title="Event Management"
                columns={columns}
                rows={rows}
                selectable={!loading}
                onAddNew={() => setOpenAdd(true)}
                addNewText="Add New Event"
                onImport={fetchEvents}
                importText="Refresh"
                dateRange={dateRange}
                onDateChange={setDateRange}
                itemName="Event"
                loading={loading}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Add Event Modal */}
      <Modal
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          resetForm();
          setError(null);
        }}
        title="Add New Event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { resetForm(); setOpenAdd(false); setError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleSubmitNew}>Save</button>
          </>
        )}
      >
        <div className="ui-form grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Name <span style={{ color: 'red' }}>*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event name"
              value={form.event_name}
              onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Start Date <span style={{ color: 'red' }}>*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">End Date <span style={{ color: 'red' }}>*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Location <span style={{ color: 'red' }}>*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event location"
              value={form.event_location}
              onChange={(e) => setForm((p) => ({ ...p, event_location: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
          setError(null);
        }}
        title="Edit Event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setEditRow(null); resetForm(); setError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleUpdate}>Update</button>
          </>
        )}
      >
        <div className="ui-form grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Name <span style={{ color: 'red' }}>*</span></label>
            <input
              className="ui-input w-full"
              value={form.event_name}
              onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Start Date <span style={{ color: 'red' }}>*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">End Date <span style={{ color: 'red' }}>*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Location <span style={{ color: 'red' }}>*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event location"
              value={form.event_location}
              onChange={(e) => setForm((p) => ({ ...p, event_location: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DashboardEvents;
