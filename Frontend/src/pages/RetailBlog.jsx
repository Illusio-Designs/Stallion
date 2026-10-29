'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TableWithControls from '../components/ui/TableWithControls';
import AsidePanel from '../components/ui/AsidePanel';
import PagedMultiSelect from '../components/ui/PagedMultiSelect';
import StatusBadge from '../components/ui/StatusBadge';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { FiSearch } from '../components/icons/hugeicons';
import { FormSec, ChipRow } from '../components/forms/FormBits';
import RichTextEditor from '../components/retail/RichTextEditor';
import { PageHead, Chips, StateBox, Field, Thumb, TagInput, errorText } from '../components/retail/RetailBits';
import { getRetailPosts, createRetailPost, updateRetailPost, getRetailProducts, retailList } from '../services/api/retailApi';
import { showSuccess, showError } from '../services/notificationService';
import { sanitizeHtml, htmlToText } from '../utils/sanitizeHtml';
import { slugify, istDate, sentence } from '../utils/retailFormat';
import { resolveProfileImageUrl } from '../utils/profileImage';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const PAGE = 20;
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];
const FILTERS = [{ value: 'all', label: 'All posts' }, ...STATUSES];
const BADGE = { draft: 'pending', published: 'completed', archived: 'default' };

const frameLabel = (p) => [p.model_no, p.title && p.title !== p.model_no ? p.title : ''].filter(Boolean).join(' · ');

const blank = () => ({ id: null, title: '', slug: '', summary: '', cover_image: '', tags: [], body: '', status: 'draft', frames: [] });
const fromPost = (p) => {
  const linked = p.related_products || p.linked_products || p.products || [];
  const ids = p.product_ids || [];
  return {
    id: p.id,
    title: p.title || '',
    slug: p.slug || '',
    summary: p.summary || '',
    cover_image: p.cover_image || '',
    tags: Array.isArray(p.tags) ? p.tags : [],
    body: p.body || '',
    status: p.status || 'draft',
    frames: linked.length
      ? linked.map((f) => ({ id: f.id, label: frameLabel(f) || String(f.id) }))
      : ids.map((id) => ({ id, label: String(id) })),
  };
};

// Blog manager: write, publish and archive posts. Nothing is deleted.
export default function RetailBlog() {
  const confirm = useConfirm();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: '' });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const slugTouched = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await getRetailPosts({ status: filter === 'all' ? '' : filter, search: q, page, limit: PAGE });
      if (mine !== seq.current) return;
      const { rows, pagination } = retailList(res);
      setState({ rows, pagination, loading: false, error: '' });
    } catch (e) {
      if (mine === seq.current) setState((s) => ({ ...s, loading: false, error: errorText(e, 'Could not load posts.') }));
    }
  }, [filter, q, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setQ(qInput.trim()); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openNew = () => { slugTouched.current = false; setErrors({}); setForm(blank()); };
  const openEdit = (p) => { slugTouched.current = true; setErrors({}); setForm(fromPost(p)); };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Enter a title.';
    if (!form.slug.trim()) e.slug = 'Enter the address of the post.';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) e.slug = 'Use lowercase letters, numbers and hyphens only.';
    if (form.cover_image.trim() && !/^(https?:\/\/|\/)\S+$/i.test(form.cover_image.trim())) e.cover_image = 'Enter a web address (https://) or a path that starts with /.';
    if (form.status === 'published') {
      if (!form.summary.trim()) e.summary = 'Add a short summary before publishing.';
      if (!htmlToText(form.body)) e.body = 'Write the article before publishing.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const body = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      cover_image: form.cover_image.trim(),
      tags: form.tags,
      body: sanitizeHtml(form.body),
      status: form.status,
      product_ids: form.frames.map((f) => f.id),
    };
    setSaving(true);
    try {
      if (form.id) await updateRetailPost(form.id, body); else await createRetailPost(body);
      showSuccess(form.id ? 'Post saved' : 'Post created');
      setForm(null);
      load();
    } catch (e) {
      showError(errorText(e), null, 'Could not save the post');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (p, status) => {
    if (status === 'archived') {
      const ok = await confirm({ title: 'Archive this post?', message: 'It disappears from the store but is kept here. You can publish it again any time.', confirmLabel: 'Archive' });
      if (!ok) return;
    }
    setBusyId(p.id);
    try {
      await updateRetailPost(p.id, { status });
      showSuccess('', null, status === 'published' ? 'Post published' : status === 'archived' ? 'Post archived' : 'Moved to drafts', p.title);
      load();
    } catch (e) {
      showError(errorText(e), null, 'Could not change the post');
    } finally {
      setBusyId('');
    }
  };

  const fetchFrames = (pg, search) => getRetailProducts({ search, page: pg, limit: 20 }).then((r) => retailList(r).rows);
  const toggleFrame = (opt) => setForm((f) => (f.frames.some((x) => String(x.id) === String(opt.value))
    ? { ...f, frames: f.frames.filter((x) => String(x.id) !== String(opt.value)) }
    : { ...f, frames: [...f.frames, { id: opt.value, label: opt.label }] }));

  const columns = useMemo(() => [
    { key: 'title', label: 'Title', render: (v, r) => <span className="rt-cell"><b>{v}</b><small>/blog/{r.slug}</small></span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={BADGE[v] || 'default'}>{sentence(v)}</StatusBadge> },
    { key: 'tags', label: 'Tags', render: (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—') },
    { key: 'date', label: 'Date', render: (_v, r) => istDate(r.published_at || r.updated_at || r.created_at) || '—' },
    {
      key: 'actions', label: 'Action',
      render: (_v, r) => (
        <span className="rt-actions">
          <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => openEdit(r)} aria-label={`Edit ${r.title}`}>Edit</button>
          {r.status !== 'published' && <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" disabled={busyId === r.id} onClick={() => setStatus(r, 'published')} aria-label={`Publish ${r.title}`}>Publish</button>}
          {r.status !== 'archived' && <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" disabled={busyId === r.id} onClick={() => setStatus(r, 'archived')} aria-label={`Archive ${r.title}`}>Archive</button>}
        </span>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [busyId]);

  const total = state.pagination?.total ?? state.rows.length;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Blog manager" subtitle="Write guides for the store. Posts are archived, never deleted.">
          <button type="button" className="ui-btn ui-btn--primary" onClick={openNew}>New post</button>
        </PageHead>

        <Chips options={FILTERS} value={filter} onChange={(v) => { setPage(1); setFilter(v); }} label="Filter posts" />
        <div className="rt-toolbar">
          <label className="rt-search">
            <FiSearch aria-hidden="true" />
            <input type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search posts" aria-label="Search posts" />
          </label>
        </div>

        {state.error && !state.loading ? (
          <StateBox kind="error" title="Could not load posts" desc={state.error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={load}>Try again</button>} />
        ) : !state.loading && state.rows.length === 0 && !q && filter === 'all' ? (
          <StateBox title="No posts yet" desc="Guides on frames, face shapes and eye care bring visitors from search." action={<button type="button" className="ui-btn ui-btn--primary" onClick={openNew}>Write the first post</button>} />
        ) : (
          <div className="dash-card full rt-table">
            <TableWithControls
              title="Posts"
              titleAs="h2"
              columns={columns}
              rows={state.rows}
              itemName="Post"
              loading={state.loading}
              selectable={false}
              showSerialNumber={false}
              serverPagination
              serverPage={page}
              serverPageCount={state.pagination?.totalPages || 1}
              serverPageSize={PAGE}
              serverTotal={total}
              onServerPageChange={setPage}
              onServerSearch={(term) => { setPage(1); setQInput(term); }}
            />
          </div>
        )}
      </div>

      <AsidePanel
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit post' : 'New post'}
        width="lg"
        footer={(
          <>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save post'}</button>
          </>
        )}
      >
        {form && (
          <div className="rt-form rf-form">
            <FormSec title="Post">
              <Field label="Title *" full>
                <input
                  className="ui-input"
                  value={form.title}
                  onChange={(e) => { const t = e.target.value; setForm((f) => ({ ...f, title: t, slug: slugTouched.current ? f.slug : slugify(t) })); }}
                  placeholder="How to pick frames for your face shape"
                />
                {errors.title && <p className="rt-error" role="alert">{errors.title}</p>}
              </Field>
              <Field label="Page address (slug) *" full hint="The post opens at /blog/your-address">
                <input className="ui-input" value={form.slug} onChange={(e) => { slugTouched.current = true; set('slug', e.target.value.toLowerCase()); }} onBlur={() => set('slug', slugify(form.slug))} />
                {errors.slug && <p className="rt-error" role="alert">{errors.slug}</p>}
              </Field>
              <Field label="Summary" full hint="A short line shown on the blog list and in search results.">
                <textarea className="ui-input rt-ta" rows={3} maxLength={300} value={form.summary} onChange={(e) => set('summary', e.target.value)} />
                {errors.summary && <p className="rt-error" role="alert">{errors.summary}</p>}
              </Field>
              <Field label="Cover image address" full hint="A link to the picture shown at the top of the post and on the list.">
                <div className="rt-cover">
                  {form.cover_image.trim() ? <Thumb src={resolveProfileImageUrl(form.cover_image.trim())} alt="" /> : null}
                  <input className="ui-input" type="url" inputMode="url" value={form.cover_image} onChange={(e) => set('cover_image', e.target.value)} placeholder="https://" />
                </div>
                {errors.cover_image && <p className="rt-error" role="alert">{errors.cover_image}</p>}
              </Field>
              <Field label="Tags" full hint="Press Enter after each tag. Customers can filter the blog by tag.">
                <TagInput value={form.tags} onChange={(v) => set('tags', v)} />
              </Field>
            </FormSec>

            <FormSec title="Article">
              <div className="form-group rf-full">
                <RichTextEditor value={form.body} onChange={(v) => set('body', v)} />
                {errors.body && <p className="rt-error" role="alert">{errors.body}</p>}
              </div>
            </FormSec>

            <FormSec title="Frames in this article" hint="Shown as a strip of frames at the end of the post.">
              <div className="form-group rf-full">
                <PagedMultiSelect
                  fetchPage={fetchFrames}
                  mapItem={(p) => ({ value: p.id, label: frameLabel(p) })}
                  selected={form.frames}
                  onToggle={toggleFrame}
                  onRemove={(id) => setForm((f) => ({ ...f, frames: f.frames.filter((x) => String(x.id) !== String(id)) }))}
                  placeholder="Pick frames"
                  searchPlaceholder="Search frames by model number"
                />
              </div>
            </FormSec>

            <FormSec title="Status">
              <div className="form-group rf-full">
                <ChipRow label="Post status" options={STATUSES} value={form.status} onChange={(v) => set('status', v)} />
                <p className="rt-hint">Draft stays hidden. Published shows on the store. Archived hides it again but keeps it here.</p>
              </div>
            </FormSec>
          </div>
        )}
      </AsidePanel>
    </div>
  );
}
