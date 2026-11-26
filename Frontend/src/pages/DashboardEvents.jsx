import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from '../components/ui/DatePicker';
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
import '../styles/redesign-p-events.css';
import '../styles/redesign-p-forms.css';
import { FormSec, ChipRow } from '../components/forms/FormBits';

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

  // "One day" keeps the end date equal to the start date. Null means: follow the dates already in the form.
  const [oneDay, setOneDay] = useState(null);
  useEffect(() => { setOneDay(null); }, [openAdd, editRow]);
  const isOneDay = oneDay === null ? form.start_date === form.end_date : oneDay;

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
  const isRunning = (e) => {
    if (isPast(e)) return false;
    const st = parseDay(e.start_date);
    return String(e.event_status || '').toLowerCase() === 'ongoing' || (!!st && st <= new Date());
  };
  const running = sorted.filter((e) => isRunning(e));
  const upcoming = sorted.filter((e) => !isPast(e) && !isRunning(e));
  const past = sorted.filter((e) => isPast(e)).reverse();
  const groups = { upcoming, running, past };
  const shown = groups[when] || upcoming;
  const TABS = [['upcoming', 'Upcoming'], ['running', 'Running'], ['past', 'Past']];

  const fmtDay = (v, withYear) => {
    const d = parseDay(v);
    return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }) : '';
  };
  const rangeText = (e) => {
    const a = fmtDay(e.start_date);
    const z = fmtDay(e.end_date, true);
    if (!a && !z) return 'No dates';
    if (!z || fmtDay(e.start_date, true) === z) return fmtDay(e.start_date, true) || z;
    return `${a} to ${z}`;
  };
  const ordersText = (e) => {
    const n = Number(e.order_count) || 0;
    return `${n} ${n === 1 ? 'order' : 'orders'}`;
  };
  const statusPill = (e) => {
    if (isPast(e)) return <span className="pill idle">Ended</span>;
    if (isRunning(e)) return <span className="pill ok">Running now</span>;
    return <span className="pill info">Upcoming</span>;
  };

  const eventFields = (isEdit) => (
    <div className="pev-form rf-form">
      {formError && <p className="ui-field-error pev-full" role="alert">{formError}</p>}
      <FormSec title="Event" className="pev-full">
        <div className="form-group rf-full">
          <label className="ui-label">Event name <span className="pev-req">*</span></label>
          <input
            className="ui-input w-full"
            placeholder="Optical Expo Mumbai"
            value={form.event_name}
            onChange={(e) => setForm((p) => ({ ...p, event_name: e.target.value }))}
          />
        </div>
        <div className="form-group rf-full">
          <label className="ui-label">City and venue <span className="pev-req">*</span></label>
          <input
            className="ui-input w-full"
            placeholder="Mumbai, Bombay Exhibition Centre"
            value={form.event_location}
            onChange={(e) => setForm((p) => ({ ...p, event_location: e.target.value }))}
          />
        </div>
      </FormSec>
      <FormSec title="Dates" hint="Pick One day and the end date follows the start date." className="pev-full">
        <div className="form-group rf-full">
          <label className="ui-label">Length</label>
          <ChipRow
            label="Event length"
            options={[{ value: 'one', label: 'One day' }, { value: 'several', label: 'Several days' }]}
            value={isOneDay ? 'one' : 'several'}
            onChange={(v) => {
              setOneDay(v === 'one');
              if (v === 'one') setForm((p) => ({ ...p, end_date: p.start_date }));
            }}
          />
        </div>
        <div className="form-group">
          <label className="ui-label">Start date <span className="pev-req">*</span></label>
          <DatePicker
            value={form.start_date}
            onChange={(v) => setForm((p) => ({ ...p, start_date: v, ...(isOneDay ? { end_date: v } : {}) }))}
            placeholder="Select date"
          />
        </div>
        <div className="form-group">
          <label className="ui-label">End date <span className="pev-req">*</span></label>
          <DatePicker value={form.end_date} onChange={(v) => setForm((p) => ({ ...p, end_date: v }))} placeholder="Select date" disabled={isOneDay} />
        </div>
      </FormSec>
      {isEdit && (
        <FormSec title="Status" className="pev-full">
          <div className="form-group rf-full">
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active !== false}
              onClick={() => setForm((p) => ({ ...p, is_active: p.is_active === false }))}
              className="mng-switch pev-switch"
            >
              <span className={`mng-switch__track ${form.is_active !== false ? 'is-on' : ''}`}>
                <span className="mng-switch__dot" />
              </span>
              <span className="mng-switch__label">{form.is_active !== false ? 'Active' : 'Inactive'}</span>
            </button>
            <p className="mng-note">Inactive items are hidden from forms. Nothing is ever deleted.</p>
          </div>
        </FormSec>
      )}
    </div>
  );

  return (
    <div className="dash-page w-full ev-page">
      <div className="dash-container flex flex-col gap-4">
        <div className="page-head">
          <div>
            <h1>Events</h1>
            <p>Exhibitions and shows where orders are taken as event orders.</p>
          </div>
          <div className="page-head__actions">
            <button className="ui-btn ui-btn--secondary" onClick={fetchEvents} disabled={loading}>Refresh</button>
            <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add event</button>
          </div>
        </div>

        <div className="seg pev-tabs" role="tablist" aria-label="Event period">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={when === k} className={when === k ? 'on' : ''} onClick={() => setWhen(k)}>
              {label} <span className="pev-count">{groups[k].length}</span>
            </button>
          ))}
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
            <p className="ui-state__title">{events.length === 0 ? 'No events yet' : `No ${when} events`}</p>
            <p className="ui-state__desc">{events.length === 0 ? 'Create your first event to start managing schedules and locations.' : 'Use the tabs above to see the others.'}</p>
            {events.length === 0 && <button className="ui-btn ui-btn--primary" onClick={() => setOpenAdd(true)}>Add event</button>}
          </div>
        ) : (
          <div className="ev-list">
            {shown.map((e) => {
              const d = parseDay(e.start_date);
              return (
                <div className="ev-row pev-row" key={e.event_id || e.id || e.event_name}>
                  <span className="ev-date" aria-hidden="true">
                    <b>{d ? String(d.getDate()).padStart(2, '0') : '--'}</b>
                    <span>{d ? d.toLocaleDateString('en-IN', { month: 'short' }) : ''}</span>
                  </span>
                  <div className="ev-row__main">
                    <h3>{e.event_name}</h3>
                    <p>{[e.event_location || 'No location', rangeText(e)].join(' · ')}</p>
                    <p className="pev-orders">{ordersText(e)} taken</p>
                  </div>
                  <div className="pev-pills">
                    {statusPill(e)}
                    {e.is_active === false && <span className="pill idle">Inactive</span>}
                  </div>
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
        title="Add event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { resetForm(); setOpenAdd(false); setFormError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleSubmitNew}>Save event</button>
          </>
        )}
      >
        {eventFields(false)}
      </AsidePanel>

      {/* Edit Event Modal */}
      <AsidePanel
        open={!!editRow}
        onClose={() => {
          setEditRow(null);
          resetForm();
          setFormError(null);
        }}
        title="Edit event"
        footer={(
          <>
            <button className="ui-btn ui-btn--secondary" onClick={() => { setEditRow(null); resetForm(); setFormError(null); }}>Cancel</button>
            <button className="ui-btn ui-btn--primary" disabled={saving} onClick={handleUpdate}>Update event</button>
          </>
        )}
      >
        {eventFields(true)}
      </AsidePanel>
    </div>
  );
};

export default DashboardEvents;
