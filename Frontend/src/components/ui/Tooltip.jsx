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
  return (
    <span className={`ui-tooltip ui-tooltip--${placement} ${className}`.trim()}>
      {children}
      <span className="ui-tooltip__bubble" role="tooltip">
        {label}
      </span>
    </span>
  );
};

export default Tooltip;
