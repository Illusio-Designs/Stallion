'use client';
import React from 'react';
import Skeleton from './Skeleton';

// Shown while a dashboard page is loading: the page title, four number cards and a table, as grey
// shapes in the real sizes. The sidebar and header stay on screen around it.
export default function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading page" role="status">
      <div className="page-skeleton__head">
        <Skeleton width={180} height={26} radius={8} />
        <Skeleton width={'min(340px, 70%)'} height={14} />
      </div>
      <div className="page-skeleton__kpis">
        {[0, 1, 2, 3].map((i) => (
          <div className="page-skeleton__kpi" key={i}>
            <Skeleton width="55%" height={12} />
            <Skeleton width="40%" height={26} radius={8} />
            <Skeleton width="70%" height={12} />
          </div>
        ))}
      </div>
      <div className="page-skeleton__table">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="page-skeleton__row" key={i}>
            <Skeleton width="14%" height={14} />
            <Skeleton width="26%" height={14} />
            <Skeleton width="16%" height={14} />
            <Skeleton width="12%" height={18} radius={99} />
            <Skeleton width="12%" height={14} />
          </div>
        ))}
      </div>
    </div>
  );
}
