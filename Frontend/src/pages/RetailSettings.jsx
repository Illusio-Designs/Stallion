'use client';
import React, { useEffect, useState } from 'react';
import { useConfirm } from '../components/ui/ConfirmProvider';
import { PageHead, Card, StateBox, Field, SwitchRow, useRetailLoad, errorText } from '../components/retail/RetailBits';
import { getRetailSettings, updateRetailSettings, retailData } from '../services/api/retailApi';
import { showSuccess, showError } from '../services/notificationService';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const MAX_USPS = 4;
const str = (v) => (v === undefined || v === null ? '' : String(v));

const toForm = (d = {}) => {
  const s = d.store || {}; const b = d.banner || {}; const t = d.tracking || {}; const sec = d.tracking_secrets || {};
  const soc = s.social || {};
  return {
    store_enabled: d.store_enabled !== false,
    store: { name: str(s.name), tagline: str(s.tagline), logo_url: str(s.logo_url), support_phone: str(s.support_phone), whatsapp: str(s.whatsapp), email: str(s.email), address: str(s.address), hours: str(s.hours), social: { instagram: str(soc.instagram), facebook: str(soc.facebook), youtube: str(soc.youtube) } },
    banner: { headline: str(b.headline), sub: str(b.sub), image: str(b.image), cta_label: str(b.cta_label), cta_url: str(b.cta_url) },
    usps: Array.isArray(d.usps) ? d.usps.map((u) => ({ title: str(u.title), text: str(u.text) })) : [],
    tracking: { ga_id: str(t.ga_id), meta_pixel_id: str(t.meta_pixel_id), cookie_notice: !!t.cookie_notice },
    // Secrets are write-only: the server sends them masked. Only a new value typed here is sent back.
    secrets: { meta_capi_token: '', ga_api_secret: '' },
    secretSaved: { meta_capi_token: !!sec.meta_capi_token, ga_api_secret: !!sec.ga_api_secret },
  };
};

const urlOk = (v) => !v.trim() || /^(https?:\/\/|\/)\S+$/i.test(v.trim());

// Store settings: name, contact, banner, promises, social links, tracking IDs and the store on / off switch.
export default function RetailSettings() {
  const confirm = useConfirm();
  const { data, loading, error, reload } = useRetailLoad(async () => retailData(await getRetailSettings()) || {}, []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (data) { setForm(toForm(data)); setDirty(false); } }, [data]);

  const patch = (fn) => { setForm((f) => fn(f)); setDirty(true); };
  const setIn = (group, key, v) => patch((f) => ({ ...f, [group]: { ...f[group], [key]: v } }));
  const setSocial = (key, v) => patch((f) => ({ ...f, store: { ...f.store, social: { ...f.store.social, [key]: v } } }));
  const setUsp = (i, key, v) => patch((f) => ({ ...f, usps: f.usps.map((u, idx) => (idx === i ? { ...u, [key]: v } : u)) }));

  const toggleStore = async (next) => {
    if (!next) {
      const ok = await confirm({ title: 'Switch the store off?', message: 'Customers will not be able to browse or order until you switch it back on. Press Save changes to apply.', confirmLabel: 'Switch off', danger: true });
      if (!ok) return;
    }
    patch((f) => ({ ...f, store_enabled: next }));
  };

  const validate = () => {
    const e = {};
    const { store, banner, tracking } = form;
    if (!store.name.trim()) e.name = 'Enter the store name.';
    if (store.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(store.email.trim())) e.email = 'Enter a valid email address.';
    ['support_phone', 'whatsapp'].forEach((k) => { if (store[k].trim() && !/^[+\d][\d\s-]{6,17}$/.test(store[k].trim())) e[k] = 'Enter a phone number, for example +91 98765 43210.'; });
    ['logo_url'].forEach((k) => { if (!urlOk(store[k])) e[k] = 'Enter a web address (https://) or a path that starts with /.'; });
    ['instagram', 'facebook', 'youtube'].forEach((k) => { if (!urlOk(store.social[k])) e[`s_${k}`] = 'Enter a web address that starts with https://'; });
    if (!urlOk(banner.image)) e.b_image = 'Enter a web address (https://) or a path that starts with /.';
    if (!urlOk(banner.cta_url)) e.b_cta_url = 'Enter a web address (https://) or a path that starts with /.';
    if (tracking.ga_id.trim() && !/^(G|UA|GT|AW)-[A-Z0-9-]+$/i.test(tracking.ga_id.trim())) e.ga_id = 'A Google Analytics ID looks like G-XXXXXXXXXX.';
    if (tracking.meta_pixel_id.trim() && !/^\d{6,20}$/.test(tracking.meta_pixel_id.trim())) e.meta_pixel_id = 'A Meta pixel ID is a number.';
    form.usps.forEach((u, i) => { if ((u.title.trim() || u.text.trim()) && !u.title.trim()) e[`usp_${i}`] = 'Give each promise a short title.'; });
    setErrors(e);
    if (Object.keys(e).length) showError('Check the highlighted fields and save again.');
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    const body = {
      store_enabled: form.store_enabled,
      store: { ...(data?.store || {}), ...Object.fromEntries(Object.entries(form.store).filter(([k]) => k !== 'social').map(([k, v]) => [k, v.trim()])), social: Object.fromEntries(Object.entries(form.store.social).map(([k, v]) => [k, v.trim()])) },
      banner: Object.fromEntries(Object.entries(form.banner).map(([k, v]) => [k, v.trim()])),
      usps: form.usps.filter((u) => u.title.trim() || u.text.trim()).map((u) => ({ title: u.title.trim(), text: u.text.trim() })),
      tracking: { ...(data?.tracking || {}), ga_id: form.tracking.ga_id.trim(), meta_pixel_id: form.tracking.meta_pixel_id.trim(), cookie_notice: form.tracking.cookie_notice },
    };
    const secrets = Object.fromEntries(Object.entries(form.secrets).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()]));
    if (Object.keys(secrets).length) body.tracking_secrets = secrets;
    setSaving(true);
    try {
      await updateRetailSettings(body);
      showSuccess('Store settings saved');
      reload();
    } catch (er) {
      showError(errorText(er), null, 'Could not save the settings');
    } finally {
      setSaving(false);
    }
  };

  const err = (k) => (errors[k] ? <p className="rt-error" role="alert">{errors[k]}</p> : null);
  const f = form;

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Store settings" subtitle="What the public sees on the store, and the tracking IDs.">
          <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={saving || !f || !dirty}>{saving ? 'Saving...' : 'Save changes'}</button>
        </PageHead>

        {error && !loading && !f ? (
          <StateBox kind="error" title="Could not load the settings" desc={error} action={<button type="button" className="ui-btn ui-btn--secondary" onClick={reload}>Try again</button>} />
        ) : !f ? (
          <span className="ui-skeleton rt-block-skel" aria-busy="true" />
        ) : (
          <>
            <Card title="Store status">
              <SwitchRow label={f.store_enabled ? 'Store is on' : 'Store is off'} hint="When off, customers see a closed notice and cannot order." checked={f.store_enabled} onChange={toggleStore} />
            </Card>

            <Card title="Store details" hint="Shown in the header, footer and contact page.">
              <div className="rf-grid rt-grid">
                <Field label="Store name *"><input className="ui-input" value={f.store.name} onChange={(e) => setIn('store', 'name', e.target.value)} />{err('name')}</Field>
                <Field label="Tagline"><input className="ui-input" value={f.store.tagline} onChange={(e) => setIn('store', 'tagline', e.target.value)} placeholder="Eyewear made for everyday faces" /></Field>
                <Field label="Support phone"><input className="ui-input" type="tel" inputMode="tel" value={f.store.support_phone} onChange={(e) => setIn('store', 'support_phone', e.target.value)} />{err('support_phone')}</Field>
                <Field label="WhatsApp number"><input className="ui-input" type="tel" inputMode="tel" value={f.store.whatsapp} onChange={(e) => setIn('store', 'whatsapp', e.target.value)} />{err('whatsapp')}</Field>
                <Field label="Support email"><input className="ui-input" type="email" inputMode="email" value={f.store.email} onChange={(e) => setIn('store', 'email', e.target.value)} />{err('email')}</Field>
                <Field label="Opening hours"><input className="ui-input" value={f.store.hours} onChange={(e) => setIn('store', 'hours', e.target.value)} placeholder="Mon to Sat, 10am to 7pm" /></Field>
                <Field label="Address" full><textarea className="ui-input rt-ta" rows={2} value={f.store.address} onChange={(e) => setIn('store', 'address', e.target.value)} /></Field>
                <Field label="Logo address" full hint="A link to the logo picture."><input className="ui-input" type="url" inputMode="url" value={f.store.logo_url} onChange={(e) => setIn('store', 'logo_url', e.target.value)} placeholder="https://" />{err('logo_url')}</Field>
              </div>
            </Card>

            <Card title="Home banner" hint="The first thing visitors read on the home page.">
              <div className="rf-grid rt-grid">
                <Field label="Headline" full><input className="ui-input" value={f.banner.headline} onChange={(e) => setIn('banner', 'headline', e.target.value)} placeholder="Frames you will actually wear every day." /></Field>
                <Field label="Line under the headline" full><input className="ui-input" value={f.banner.sub} onChange={(e) => setIn('banner', 'sub', e.target.value)} /></Field>
                <Field label="Banner image address" full><input className="ui-input" type="url" inputMode="url" value={f.banner.image} onChange={(e) => setIn('banner', 'image', e.target.value)} placeholder="https://" />{err('b_image')}</Field>
                <Field label="Button label"><input className="ui-input" value={f.banner.cta_label} onChange={(e) => setIn('banner', 'cta_label', e.target.value)} placeholder="Shop frames" /></Field>
                <Field label="Button goes to"><input className="ui-input" value={f.banner.cta_url} onChange={(e) => setIn('banner', 'cta_url', e.target.value)} placeholder="/shop" />{err('b_cta_url')}</Field>
              </div>
            </Card>

            <Card
              title="Store promises"
              hint={`Short points shown under the banner, up to ${MAX_USPS}. For example Free shipping over ₹1,999.`}
              actions={f.usps.length < MAX_USPS ? <button type="button" className="ui-btn ui-btn--secondary" onClick={() => patch((x) => ({ ...x, usps: [...x.usps, { title: '', text: '' }] }))}>Add promise</button> : null}
            >
              {f.usps.length === 0 ? <p className="rt-none">No promises yet.</p> : f.usps.map((u, i) => (
                <div className="rt-usp" key={i}>
                  <div className="rf-grid rt-grid">
                    <Field label={`Promise ${i + 1} title`}><input className="ui-input" value={u.title} onChange={(e) => setUsp(i, 'title', e.target.value)} />{err(`usp_${i}`)}</Field>
                    <Field label="Details"><input className="ui-input" value={u.text} onChange={(e) => setUsp(i, 'text', e.target.value)} /></Field>
                  </div>
                  <button type="button" className="ui-btn ui-btn--secondary rt-rowbtn" onClick={() => patch((x) => ({ ...x, usps: x.usps.filter((_, idx) => idx !== i) }))} aria-label={`Remove promise ${i + 1}`}>Remove</button>
                </div>
              ))}
            </Card>

            <Card title="Social links">
              <div className="rf-grid rt-grid">
                <Field label="Instagram"><input className="ui-input" type="url" inputMode="url" value={f.store.social.instagram} onChange={(e) => setSocial('instagram', e.target.value)} placeholder="https://instagram.com/..." />{err('s_instagram')}</Field>
                <Field label="Facebook"><input className="ui-input" type="url" inputMode="url" value={f.store.social.facebook} onChange={(e) => setSocial('facebook', e.target.value)} placeholder="https://facebook.com/..." />{err('s_facebook')}</Field>
                <Field label="YouTube"><input className="ui-input" type="url" inputMode="url" value={f.store.social.youtube} onChange={(e) => setSocial('youtube', e.target.value)} placeholder="https://youtube.com/..." />{err('s_youtube')}</Field>
              </div>
            </Card>

            <Card title="Tags and tracking IDs" hint="Used for Google Analytics and Meta ads. Leave empty to turn a tag off.">
              <div className="rf-grid rt-grid">
                <Field label="Google Analytics ID"><input className="ui-input" value={f.tracking.ga_id} onChange={(e) => setIn('tracking', 'ga_id', e.target.value)} placeholder="G-XXXXXXXXXX" />{err('ga_id')}</Field>
                <Field label="Meta pixel ID"><input className="ui-input" inputMode="numeric" value={f.tracking.meta_pixel_id} onChange={(e) => setIn('tracking', 'meta_pixel_id', e.target.value)} placeholder="1234567890" />{err('meta_pixel_id')}</Field>
                <Field label="Meta conversions token" hint={f.secretSaved.meta_capi_token ? 'Saved and hidden. Type a new one to replace it.' : 'Optional. Stored privately, never shown again.'}>
                  <input className="ui-input" type="password" autoComplete="new-password" value={f.secrets.meta_capi_token} onChange={(e) => setIn('secrets', 'meta_capi_token', e.target.value)} placeholder={f.secretSaved.meta_capi_token ? '••••••••' : ''} />
                </Field>
                <Field label="Google Analytics API secret" hint={f.secretSaved.ga_api_secret ? 'Saved and hidden. Type a new one to replace it.' : 'Optional. Stored privately, never shown again.'}>
                  <input className="ui-input" type="password" autoComplete="new-password" value={f.secrets.ga_api_secret} onChange={(e) => setIn('secrets', 'ga_api_secret', e.target.value)} placeholder={f.secretSaved.ga_api_secret ? '••••••••' : ''} />
                </Field>
              </div>
              <SwitchRow label="Cookie notice on the store" hint="Asks visitors to accept cookies before tags run." checked={f.tracking.cookie_notice} onChange={(v) => setIn('tracking', 'cookie_notice', v)} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
