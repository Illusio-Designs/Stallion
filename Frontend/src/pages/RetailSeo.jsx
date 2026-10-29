'use client';
import React, { useMemo, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import { FormSec } from '../components/forms/FormBits';
import { PageHead, Card, StateBox, Field, Pill, Switch, KpiRow, Kpi, useRetailLoad, errorText } from '../components/retail/RetailBits';
import { getRetailPages, updateRetailPage, retailList } from '../services/api/retailApi';
import { showSuccess, showError } from '../services/notificationService';
import { lengthHint, seoStatus, TITLE_RANGE, DESC_RANGE, crumbUrl } from '../utils/retailFormat';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const AUTOMATIC = ['Sitemap', 'Robots file', 'Product data (price, stock)', 'Article data', 'Canonical links', 'Share cards'];

const labelOf = (r) => r.label || r.name || (r.path === '/' ? 'Home' : String(r.path || '').replace(/^\//, '').replace(/[-/]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) || 'Page');
const blank = () => ({ isNew: true, path: '/', title: '', description: '', og_image: '', canonical: '', noindex: false });

// SEO: the title, description and share image of each page of the store, with a Google-style preview.
export default function RetailSeo() {
  const { data, loading, error, reload } = useRetailLoad(async () => retailList(await getRetailPages()).rows, []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => (data || []).map((r) => ({ ...r, id: r.id || r.path, page_label: labelOf(r) })), [data]);
  const complete = rows.filter((r) => String(r.title || '').trim() && String(r.description || '').trim()).length;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openEdit = (r) => { setErrors({}); setForm({ isNew: false, path: r.path, title: r.title || '', description: r.description || '', og_image: r.og_image || '', canonical: r.canonical || '', noindex: !!r.noindex, label: r.page_label }); };

  const validate = () => {
    const e = {};
    const p = form.path.trim();
    if (!p.startsWith('/')) e.path = 'The address must start with /, for example /shop.';
    else if (/\s/.test(p)) e.path = 'The address cannot contain spaces.';
    else if (form.isNew && rows.some((r) => r.path === p)) e.path = 'This page already has a row. Edit it from the list.';
    if (form.canonical.trim() && !/^https?:\/\/\S+$/i.test(form.canonical.trim())) e.canonical = 'Enter a full web address that starts with https://';
    if (form.og_image.trim() && !/^(https?:\/\/|\/)\S+$/i.test(form.og_image.trim())) e.og_image = 'Enter a web address (https://) or a path that starts with /.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await updateRetailPage({
        path: form.path.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        og_image: form.og_image.trim(),
        canonical: form.canonical.trim(),
        noindex: !!form.noindex,
      });
      showSuccess('Search details saved');
      setForm(null);
      reload();
    } catch (e) {
      showError(errorText(e), null, 'Could not save the page');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => [
    { key: 'page_label', label: 'Page', render: (v) => <b>{v}</b> },
    { key: 'path', label: 'Address' },
    { key: 'title', label: 'Title length', render: (v) => { const h = lengthHint(v, TITLE_RANGE); return <span className="rt-num">{h.n}</span>; } },
    { key: 'description', label: 'Description length', render: (v) => { const h = lengthHint(v, DESC_RANGE); return <span className="rt-num">{h.n}</span>; } },
    { key: 'status', label: 'Status', render: (_v, r) => { const s = seoStatus(r.title, r.description); return <Pill tone={s.tone}>{s.label}</Pill>; } },
    { key: 'actions', label: 'Action', render: (_v, r) => <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => openEdit(r)} aria-label={`Edit ${r.page_label}`}>Edit</button> },
  ], []);

  const tH = form ? lengthHint(form.title, TITLE_RANGE) : null;
  const dH = form ? lengthHint(form.description, DESC_RANGE) : null;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="SEO" subtitle="How the store appears on Google and when a link is shared.">
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => { setErrors({}); setForm(blank()); }}>Add page</button>
        </PageHead>

        <KpiRow>
          <Kpi label="Pages with title and description" value={loading && !data ? '—' : `${complete} of ${rows.length}`} loading={loading && !data} />
          <Kpi label="Sitemap" value="Automatic" sub="Updated as pages change" />
        </KpiRow>

        {error && !loading && !data ? (
          <StateBox kind="error" title="Could not load the pages" desc={error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={reload}>Try again</button>} />
        ) : !loading && rows.length === 0 ? (
          <StateBox title="No pages yet" desc="Add the pages of the store (Home, Shop, About...) to set their title and description." action={<button type="button" className="ui-btn ui-btn--primary" onClick={() => { setErrors({}); setForm(blank()); }}>Add page</button>} />
        ) : (
          <div className="dash-card full rt-table">
            <TableWithControls title="Pages" titleAs="h2" columns={columns} rows={rows} itemName="Page" loading={loading && !data} selectable={false} showSerialNumber={false} />
          </div>
        )}

        <Card title="Frames and blog posts" hint="Each frame has its own search title and description in Frames on store. Blog posts use their title and summary.">
          <div className="rt-chips rt-chips--static" aria-label="Made automatically">
            {AUTOMATIC.map((a) => <span key={a} className="rt-chip is-on">{a}</span>)}
          </div>
          <p className="rt-hint">These are made automatically for the whole store.</p>
        </Card>
      </div>

      <AsidePanel
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.isNew ? 'Add page' : `Edit: ${form?.label || form?.path || ''}`}
        footer={(
          <>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </>
        )}
      >
        {form && (
          <div className="rt-form rf-form">
            <FormSec title="Search results">
              <Field label="Page address *" full hint={form.isNew ? 'For example /shop or /about' : 'The address of an existing page cannot change.'}>
                <input className="ui-input" value={form.path} disabled={!form.isNew} onChange={(e) => set('path', e.target.value.toLowerCase())} />
                {errors.path && <p className="rt-error" role="alert">{errors.path}</p>}
              </Field>
              <Field label={`Page title (${tH.n}/60)`} full>
                <input className="ui-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
                <p className={`rt-count rt-count--${tH.tone}`}>{tH.label}: aim for {TITLE_RANGE[0]} to {TITLE_RANGE[1]} characters</p>
              </Field>
              <Field label={`Description (${dH.n}/155)`} full>
                <textarea className="ui-input rt-ta" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
                <p className={`rt-count rt-count--${dH.tone}`}>{dH.label}: aim for {DESC_RANGE[0]} to {DESC_RANGE[1]} characters</p>
              </Field>
            </FormSec>

            <div className="rt-serp" aria-label="How it looks on Google">
              <span className="rt-serp__t">{form.title.trim() || 'Page title appears here'}</span>
              <span className="rt-serp__u">{crumbUrl(form.path)}</span>
              <span className="rt-serp__d">{form.description.trim() || 'The description appears here, up to about 155 characters.'}</span>
            </div>

            <FormSec title="Sharing and indexing">
              <Field label="Share image" full hint="The picture shown when the link is shared on WhatsApp or social media.">
                <input className="ui-input" type="url" inputMode="url" value={form.og_image} onChange={(e) => set('og_image', e.target.value)} placeholder="https://" />
                {errors.og_image && <p className="rt-error" role="alert">{errors.og_image}</p>}
              </Field>
              <Field label="Canonical address (optional)" full hint="Only set this if the same page is reachable at another address.">
                <input className="ui-input" type="url" inputMode="url" value={form.canonical} onChange={(e) => set('canonical', e.target.value)} placeholder="https://" />
                {errors.canonical && <p className="rt-error" role="alert">{errors.canonical}</p>}
              </Field>
              <div className="form-group rf-full rt-switchrow">
                <div><span className="rt-switchrow__l">Hide from Google</span><small>Adds a noindex tag. Use it for pages that should not appear in search.</small></div>
                <Switch checked={form.noindex} onChange={(v) => set('noindex', v)} label="Hide from Google" />
              </div>
            </FormSec>
          </div>
        )}
      </AsidePanel>
    </div>
  );
}
