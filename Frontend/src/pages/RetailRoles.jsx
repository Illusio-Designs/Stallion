'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { PageHead, Card, Pill } from '../components/retail/RetailBits';
import { getRoles } from '../services/api/authApi';
import { getUserRoles } from '../services/authService';
import { hasAnyRolePageAccess } from '../utils/rolePermissions';
import '../styles/redesign-p-retail.css';
import '../styles/dark-retail.css';

const ROWS = [
  { key: 'admin', name: 'Super admin', sees: 'Wholesale and Retail', can: 'Everything on both sides' },
  { key: 'retail_manager', name: 'Store manager', sees: 'Retail only', can: 'Online orders, frames on store, blog, SEO, shipping, tracking and store settings' },
  { key: 'retail_editor', name: 'Content editor', sees: 'Retail only', can: 'Blog manager and SEO' },
  { key: '_wholesale', name: 'Wholesale roles', sees: 'Wholesale only', can: 'Salesman, party, distributor, order, tray and the other managers keep today\'s Wholesale menu' },
];

const nameOf = (r) => String(r?.role_name || r?.name || r?.roleName || r?.title || '').toLowerCase().trim();

// Roles and access: who can open which side. People and roles are managed in the existing Office team screen.
export default function RetailRoles({ onPageChange }) {
  const mine = useMemo(() => getUserRoles(), []);
  const canManage = hasAnyRolePageAccess(mine, 'office-team');
  const [known, setKnown] = useState(null); // names of the roles that exist on the server, or null if unknown

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await getRoles();
        const list = Array.isArray(res) ? res : (res?.data || res?.roles || []);
        if (!off) setKnown(list.map(nameOf).filter(Boolean));
      } catch { /* a person who cannot list roles just does not get the check */ }
    })();
    return () => { off = true; };
  }, []);

  return (
    <div className="dash-page w-full rt-page">
      <div className="dash-container flex flex-col gap-4">
        <PageHead title="Roles and access" subtitle="Who can open which side of Stallion.">
          {canManage && onPageChange ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => onPageChange('office-team')}>Manage users and roles</button> : null}
        </PageHead>

        <Card title="Roles">
          <div className="rt-tablewrap">
            <table className="rt-tbl">
              <thead><tr><th>Role</th><th>Sees</th><th>Can do</th></tr></thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.key}>
                    <td data-label="Role"><b>{r.name}</b>{r.key.startsWith('retail_') ? <small className="rt-code">{r.key}</small> : null}</td>
                    <td data-label="Sees"><Pill tone={r.sees === 'Wholesale only' ? 'mute' : 'ok'}>{r.sees}</Pill></td>
                    <td data-label="Can do">{r.can}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {known && ['retail_manager', 'retail_editor'].some((k) => !known.includes(k)) && (
            <p className="rt-error" role="alert">The server has no role named {['retail_manager', 'retail_editor'].filter((k) => !known.includes(k)).join(' or ')} yet, so it cannot be given to a person.</p>
          )}
        </Card>

        <Card title="How the switch works">
          <p className="rt-body">
            A person with both sides sees a Wholesale / Retail switch in the header, and the choice is remembered. A person with one side goes straight to it and sees no switch.
            Retail screens never show wholesale prices, parties or trays.
          </p>
          <p className="rt-body">
            Give someone Store manager or Content editor from the Office team screen, in the same Roles list as every other role.
            {canManage ? '' : ' Ask a super admin to do this.'}
          </p>
          <p className="rt-body rt-mute">You have: {mine.length ? mine.map((r) => r.replace(/_/g, ' ')).join(', ') : 'no role'}.</p>
        </Card>
      </div>
    </div>
  );
}
