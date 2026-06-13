'use client';
import React from 'react';
import '../../styles/components/Tooltip.css';

/**
 * Tooltip — reusable custom-UI tooltip.
 *
 * Wrap any focusable trigger. The bubble reveals on hover and on keyboard
 * focus (focus-within), animates from the trigger edge, and is hidden from
 * pointer events. Motion is GPU-cheap (transform/opacity) and respects
 * prefers-reduced-motion via the global motion layer.
 *
 * @param {React.ReactNode} children - the trigger element
 * @param {string} label - tooltip text (renders nothing if empty)
 * @param {'top'|'bottom'|'left'|'right'} [placement='top']
 */
const Tooltip = ({ children, label, placement = 'top', className = '' }) => {
  if (!label) return children;

  // Per-placement bubble position + hidden/revealed transform + arrow position.
  // Hidden state = small offset toward trigger edge + scale(0.96); revealed
  // (group-hover / group-focus-within) returns to resting position + scale(1).
  const placementClasses = {
    top:
      'bottom-[calc(100%+0.5rem)] left-1/2 origin-bottom -translate-x-1/2 translate-y-[4px] scale-[0.96] ' +
      'group-hover:-translate-x-1/2 group-hover:translate-y-0 group-hover:scale-100 ' +
      'group-focus-within:-translate-x-1/2 group-focus-within:translate-y-0 group-focus-within:scale-100 ' +
      "after:bottom-[-3px] after:left-1/2 after:-ml-[3px]",
    bottom:
      'top-[calc(100%+0.5rem)] left-1/2 origin-top -translate-x-1/2 -translate-y-[4px] scale-[0.96] ' +
      'group-hover:-translate-x-1/2 group-hover:translate-y-0 group-hover:scale-100 ' +
      'group-focus-within:-translate-x-1/2 group-focus-within:translate-y-0 group-focus-within:scale-100 ' +
      "after:top-[-3px] after:left-1/2 after:-ml-[3px]",
    right:
      'left-[calc(100%+0.5rem)] top-1/2 origin-left -translate-y-1/2 -translate-x-[4px] scale-[0.96] ' +
      'group-hover:-translate-y-1/2 group-hover:translate-x-0 group-hover:scale-100 ' +
      'group-focus-within:-translate-y-1/2 group-focus-within:translate-x-0 group-focus-within:scale-100 ' +
      "after:left-[-3px] after:top-1/2 after:-mt-[3px]",
    left:
      'right-[calc(100%+0.5rem)] top-1/2 origin-right -translate-y-1/2 translate-x-[4px] scale-[0.96] ' +
      'group-hover:-translate-y-1/2 group-hover:translate-x-0 group-hover:scale-100 ' +
      'group-focus-within:-translate-y-1/2 group-focus-within:translate-x-0 group-focus-within:scale-100 ' +
      "after:right-[-3px] after:top-1/2 after:-mt-[3px]",
  };

  const bubbleClasses = [
    'ui-tooltip__bubble',
    'absolute z-[60] whitespace-nowrap pointer-events-none max-w-[240px]',
    'bg-grey-900 text-text-on-primary',
    'text-[length:var(--text-xs)] font-medium leading-[var(--leading-tight)] tracking-[0.01em]',
    'py-1 px-2 rounded-sm shadow-md',
    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
    'transition-[opacity,transform] duration-[120ms] ease-out motion-reduce:transition-none',
    // Arrow (::after) — 6x6 rotated square in same grey-900
    "after:content-[''] after:absolute after:w-[6px] after:h-[6px] after:bg-grey-900 after:rotate-45",
    placementClasses[placement],
  ].join(' ');

  return (
    <span
      className={`ui-tooltip ui-tooltip--${placement} group relative inline-flex ${className}`.trim()}
    >
      {children}
      <span className={bubbleClasses} role="tooltip">
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
