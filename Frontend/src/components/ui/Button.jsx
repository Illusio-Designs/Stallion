'use client';
import React from 'react';
import '../../styles/components/ui.css';

const BTN_BASE =
  'ui-btn inline-flex items-center justify-center gap-2 rounded-md font-semibold text-[length:var(--text-base)] leading-[1.2] border border-transparent px-4 min-h-[40px] cursor-pointer whitespace-nowrap select-none transition duration-200 ease-[ease] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:translate-y-[0.5px] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-[0.55] disabled:transform-none disabled:shadow-none motion-reduce:transition-none';

const VARIANT_CLASS = {
  primary:
    'ui-btn--primary bg-primary text-text-on-primary border-primary shadow-xs hover:bg-primary-hover hover:border-primary-hover hover:text-text-on-primary active:bg-primary-active active:border-primary-active disabled:bg-primary disabled:border-primary',
  secondary:
    'ui-btn--secondary bg-surface text-text border-border-strong hover:bg-grey-100 hover:border-grey-400 hover:text-text active:bg-grey-200',
  ghost:
    'ui-btn--ghost bg-transparent text-text-muted border-transparent hover:bg-grey-100 hover:text-primary active:bg-grey-200',
  danger:
    'ui-btn--danger bg-error text-text-on-primary border-error shadow-xs hover:bg-[color-mix(in_srgb,var(--color-error)_88%,#000)] hover:border-[color-mix(in_srgb,var(--color-error)_88%,#000)] active:bg-[color-mix(in_srgb,var(--color-error)_78%,#000)] focus-visible:shadow-[var(--focus-ring-error)]',
};

const SIZE_CLASS = {
  sm: 'ui-btn--sm min-h-[32px] px-3 text-[length:var(--text-xs)] rounded-sm',
  md: 'ui-btn--md min-h-[40px] text-[length:var(--text-base)]',
  lg: 'ui-btn--lg min-h-[48px] px-5 text-[length:var(--text-md)]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  leadingIcon = null,
  trailingIcon = null,
  className = '',
  ...props
}) {
  const classes = [
    BTN_BASE,
    VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
    SIZE_CLASS[size] || `ui-btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...props}>
      {leadingIcon && (
        <span className="ui-btn__icon ui-btn__icon--leading inline-flex items-center shrink-0">{leadingIcon}</span>
      )}
      <span className="ui-btn__label font-sans">{children}</span>
      {trailingIcon && (
        <span className="ui-btn__icon ui-btn__icon--trailing inline-flex items-center shrink-0">{trailingIcon}</span>
      )}
    </button>
  );
}
