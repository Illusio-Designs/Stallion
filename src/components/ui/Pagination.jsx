"use client";
import React from "react";
import "../../styles/components/ui.css";

export default function Pagination({
  page,
  pageCount,
  onPageChange,
  className = "",
}) {
  const go = (p) => onPageChange?.(Math.min(Math.max(1, p), pageCount));

  const buildPages = () => {
    if (pageCount <= 7)
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages = new Set(
      [1, 2, page - 1, page, page + 1, pageCount - 1, pageCount].filter(
        (p) => p >= 1 && p <= pageCount
      )
    );
    const ordered = Array.from(pages).sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < ordered.length; i++) {
      const p = ordered[i];
      result.push(p);
      if (i < ordered.length - 1 && ordered[i + 1] - p > 1) result.push("…");
    }
    return result;
  };

  const pageBtnClass =
    "ui-page-btn inline-flex h-9 min-h-9 items-center gap-1 rounded-md border border-transparent bg-transparent px-3 font-medium text-text-muted transition duration-200 ease-[ease] hover:enabled:bg-grey-100 hover:enabled:text-text focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

  return (
    <div className={`ui-pagination flex items-center gap-2 ${className}`}>
      <button
        className={`${pageBtnClass} ui-page-btn--prev`}
        disabled={page === 1}
        onClick={() => go(page - 1)}
      >
        <svg className="text-current" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Prev</span>
      </button>
      <div className="ui-page-list flex items-center gap-1">
        {buildPages().map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="ui-page-ellipsis px-1 text-text-subtle">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`ui-page-num inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2 font-medium transition duration-200 ease-[ease] cursor-pointer focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] motion-reduce:transition-none ${
                p === page
                  ? "is-active bg-primary text-text-on-primary hover:bg-primary-hover hover:text-text-on-primary"
                  : "text-text-muted hover:bg-grey-100 hover:text-text"
              }`}
              onClick={() => go(p)}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        className={`${pageBtnClass} ui-page-btn--next`}
        disabled={page === pageCount}
        onClick={() => go(page + 1)}
      >
        <span>Next</span>
        <svg className="text-current" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
