import React, { useEffect, useMemo, useState } from 'react';
import AsidePanel from '../components/ui/AsidePanel';
import {
  getEvents,
  createEvent,
  updateEvent,
} from '../services/apiService';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/pages/dashboard.css';
import '../styles/pages/dashboard-orders.css';
import '../styles/redesign-n-events.css';
import '../styles/redesign-n-manage.css';

const DashboardEvents = () => {
  const [when, setWhen] = useState('upcoming');
  const [openAdd, setOpenAdd] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    event_name: '', 
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    event_location: '',
    is_active: true
  });
  const [error, setError] = useState(null);       // the list could not load
  const [formError, setFormError] = useState(null); // a problem in the open form

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
    event_location: '',
    is_active: true
  });

  const handleSubmitNew = async () => {
    if (!form.event_name.trim()) {
      setFormError('Event name is required');
      return;
    }
    if (!form.start_date) {
      setFormError('Start date is required');
      return;
    }
    if (!form.end_date) {
      setFormError('End date is required');
      return;
    }
    if (!form.event_location.trim()) {
      setFormError('Event location is required');
      return;
    }
    if (new Date(form.start_date) > new Date(form.end_date)) {
      setFormError('End date must be after start date');
      return;
    }
    
    setSaving(true);
    setFormError(null);
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
      setFormError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setFormError(null);
    setEditRow(row);
    const startDate = row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const endDate = row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setForm({
      event_name: row.event_name || '',
      start_date: startDate,
      end_date: endDate,
      event_location: row.event_location || '',
      is_active: row.is_active !== false,
    });
  };

  const handleUpdate = async () => {
    const eventId = editRow?.event_id || editRow?.id;
    if (!eventId) return;
    if (!form.event_name.trim()) {
      setFormError('Event name is required');
      return;
    }
    if (!form.start_date) {
      setFormError('Start date is required');
      return;
    }
    if (!form.end_date) {
      setFormError('End date is required');
      return;
    }
    if (!form.event_location.trim()) {
      setFormError('Event location is required');
      return;
    }
    if (new Date(form.start_date) > new Date(form.end_date)) {
      setFormError('End date must be after start date');
      return;
    }
    
    setSaving(true);
    setFormError(null);
    try {
      const eventData = {
        event_name: form.event_name.trim(),
        start_date: `${form.start_date}T00:00:00`,
        end_date: `${form.end_date}T00:00:00`,
        event_location: form.event_location.trim(),
        is_active: form.is_active !== false,
      };
      await updateEvent(eventId, eventData);
      showSuccess('Event updated successfully');
      await fetchEvents();
      setEditRow(null);
      resetForm();
    } catch (err) {
      const message = err.message || 'Failed to update event';
      setFormError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const parseDay = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const isPast = (e) => {
    const end = parseDay(e.end_date) || parseDay(e.start_date);
    if (!end) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end < today;
  };
  const sorted = useMemo(() => {
    const t = (e) => (parseDay(e.start_date) || 0).valueOf();
    return [...events].sort((a, b) => t(a) - t(b));
  }, [events]);
  const upcoming = sorted.filter((e) => !isPast(e));
  const past = sorted.filter((e) => isPast(e)).reverse();
  const shown = when === 'upcoming' ? upcoming : past;

  const statusPill = (e) => {
    const past = isPast(e);
    const st = String(e.event_status || '').toLowerCase();
    if (past) return <span className="pill idle">Ended</span>;
    const started = parseDay(e.start_date) && parseDay(e.start_date) <= new Date();
    if (st === 'ongoing' || started) return <span className="pill ok">Running now</span>;
    return <span className="pill info">Upcoming</span>;
  };
  const detailLine = (e) => {
    const s = parseDay(e.start_date);
    const en = parseDay(e.end_date);
    let days = null;
    if (s && en) {
      const n = Math.round((en - s) / 86400000) + 1;
      if (n >= 1) days = `${n} ${n === 1 ? 'day' : 'days'}`;
    }
    const line = [e.event_location, days].filter(Boolean).join(', ') || 'No location';
    if (when === 'past') {
      const n = Number(e.order_count) || 0;
      return `${line} · ${n} ${n === 1 ? 'order' : 'orders'}`;
    }
    return line;
  };

  return (
    <div className="dash-page w-full ev-page">
      <div className="dash-container flex flex-col gap-4">
        <div className="page-head">
          <div>
            <h1>Events</h1>
            <p>Exhibitions and shows where orders are taken as event orders.</p>
          </div>
          <div className="page-head__actions">
            <div className="seg" role="tablist" aria-label="Event period">
              <button type="button" role="tab" aria-selected={when === 'upcoming'} className={when === 'upcoming' ? 'on' : ''} onClick={() => setWhen('upcoming')}>Upcoming</button>
              <button type="button" role="tab" aria-selected={when === 'past'} className={when === 'past' ? 'on' : ''} onClick={() => setWhen('past')}>Past</button>
            </div>
            <button className="ui-btn ui-btn--secondary" onClick={fetchEvents} disabled={loading}>Refresh</button>
            <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Event</button>
          </div>
        </div>

        {error && !loading ? (
          <div className="dash-card ui-state ui-state--error">
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
        ) : loading && events.length === 0 ? (
          <div className="ev-list" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="ev-row"><span className="ui-skeleton" style={{ display: 'block', height: 56, width: '100%', borderRadius: 12 }} /></div>)}
          </div>
        ) : shown.length === 0 ? (
          <div className="dash-card ui-state ui-state--empty">
            <div className="ui-state__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="ui-state__title">{events.length === 0 ? 'No events yet' : (when === 'upcoming' ? 'No upcoming events' : 'No past events')}</p>
            <p className="ui-state__desc">{events.length === 0 ? 'Create your first event to start managing schedules and locations.' : 'Switch the period above to see the others.'}</p>
            {events.length === 0 && <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add New Event</button>}
          </div>
        ) : (
          <div className="ev-list">
            {shown.map((e) => {
              const d = parseDay(e.start_date);
              return (
                <div className="ev-row" key={e.event_id || e.id || e.event_name}>
                  <span className="ev-date" aria-hidden="true">
                    <b>{d ? String(d.getDate()).padStart(2, '0') : '--'}</b>
                    <span>{d ? d.toLocaleDateString('en-IN', { month: 'short' }) : ''}</span>
                  </span>
                  <div className="ev-row__main">
                    <h3>{e.event_name}</h3>
                    <p>{detailLine(e)}</p>
                  </div>
                  {statusPill(e)}
                  <span className={`pill ${e.is_active === false ? 'idle' : 'ok'}`}>{e.is_active === false ? 'Inactive' : 'Active'}</span>
                  <div className="ev-row__actions">
                    <button className="ui-btn ui-btn--secondary" onClick={() => openEdit(e)}>Edit</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      <AsidePanel
        open={openAdd}
        onClose={() => {
          setOpenAdd(false);
          resetForm();
          setFormError(null);
        }}
        title="Add New Event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { resetForm(); setOpenAdd(false); setFormError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleSubmitNew}>Save</button>
          </>
        )}
      >
        <div className="ui-form grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
          {formError && <p className="ui-field-error col-span-full" role="alert">{formError}</p>}
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Name <span className="text-[#b00020]">*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event name"
              value={form.event_name}
              onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Start Date <span className="text-[#b00020]">*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">End Date <span className="text-[#b00020]">*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Location <span className="text-[#b00020]">*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event location"
              value={form.event_location}
              onChange={(e) => setForm((p) => ({ ...p, event_location: e.target.value }))}
            />
          </div>
        </div>
      </AsidePanel>

      {/* Edit Event Modal */}
      <AsidePanel
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
          setFormError(null);
        }}
        title="Edit Event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setEditRow(null); resetForm(); setFormError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleUpdate}>Update</button>
          </>
        )}
      >
        <div className="ui-form grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
          {formError && <p className="ui-field-error col-span-full" role="alert">{formError}</p>}
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Name <span className="text-[#b00020]">*</span></label>
            <input
              className="ui-input w-full"
              value={form.event_name}
              onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Start Date <span className="text-[#b00020]">*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">End Date <span className="text-[#b00020]">*</span></label>
            <input
              type="date"
              className="ui-input w-full"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2">
            <label className="ui-label text-sm font-medium text-text">Event Location <span className="text-[#b00020]">*</span></label>
            <input
              className="ui-input w-full"
              placeholder="Enter event location"
              value={form.event_location}
              onChange={(e) => setForm((p) => ({ ...p, event_location: e.target.value }))}
            />
          </div>
          <div className="form-group flex flex-col gap-2 col-span-full">
            <label className="ui-label text-sm font-medium text-text">Status</label>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active !== false}
              onClick={() => setForm((p) => ({ ...p, is_active: p.is_active === false }))}
              className="mng-switch"
            >
              <span className={`mng-switch__track ${form.is_active !== false ? 'is-on' : ''}`}>
                <span className="mng-switch__dot" />
              </span>
              <span className="mng-switch__label">{form.is_active !== false ? 'Active' : 'Inactive'}</span>
            </button>
            <p className="mng-note">Inactive items are hidden from forms. Nothing is ever deleted.</p>
          </div>
        </div>
      </AsidePanel>
    </div>
  );
};

export default DashboardEvents;
