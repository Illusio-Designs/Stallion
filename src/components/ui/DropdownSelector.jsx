'use client';
import React, { useState, useRef, useEffect } from 'react';
import '../../styles/components/ui.css';

export default function DropdownSelector({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  className = '',
  disabled = false,
  searchable = true, // Enable search by default
  onOpen, // Called when the dropdown is opened (use to lazy-load options)
  // --- server-search mode (20-per-page pickers) ---
  serverSearch = false, // when true: never client-filter; ask the parent to query
  onSearch, // (term) => void — called (debounced) as the user types in server mode
  loading = false, // show a loading row while the parent fetches
  selectedLabel = '', // label to show for the current value when it isn't in `options`
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Find the selected option label. In server-search mode the selected item may
  // not be in the current (filtered) `options`, so fall back to selectedLabel.
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const hasValue = selectedOption !== undefined || (serverSearch && !!value && !!selectedLabel);
  const displayValue = selectedOption
    ? selectedOption.label
    : (hasValue ? selectedLabel : placeholder);

  // Debounced server query as the user types (server-search mode only).
  useEffect(() => {
    if (!serverSearch || !onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(searchQuery), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, serverSearch]);

  // Filter options: server mode shows whatever the parent returned, as-is.
  const filteredOptions = serverSearch
    ? options
    : (searchQuery
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : options);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery(''); // Reset search when closing
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    setIsOpen(false);
    setSearchQuery(''); // Reset search after selection
  };

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen) {
        // Opening: give the parent a chance to lazy-load the options
        onOpen?.();
      } else {
        setSearchQuery(''); // Reset search when closing
      }
      setIsOpen(!isOpen);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={`ui-dropdown-custom relative inline-block w-auto min-w-[120px] ${isOpen ? 'z-[99998]' : 'z-[1]'} ${className} ${disabled ? 'ui-dropdown-custom--disabled' : ''} ${isOpen ? 'ui-dropdown-custom--open' : ''}`}
    >
      <div
        className={`ui-dropdown-custom__trigger flex items-center justify-between gap-2 px-3 min-h-[40px] rounded-pill border bg-surface cursor-pointer transition duration-200 ease-[ease] ${
          isOpen
            ? 'border-primary shadow-[var(--focus-ring)]'
            : 'border-border-strong hover:border-grey-400 focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[var(--focus-ring)]'
        } ${disabled ? 'opacity-55 cursor-not-allowed bg-grey-100' : ''}`}
        onClick={handleToggle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled || undefined}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            handleToggle();
          } else if (e.key === 'Escape' && isOpen) {
            setIsOpen(false);
            setSearchQuery('');
          }
        }}
      >
        <span className={`ui-dropdown-custom__value flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-[length:var(--text-base)] font-normal ${!hasValue ? 'ui-dropdown-custom__value--placeholder text-text-subtle' : 'text-text'}`}>{displayValue}</span>
        <svg
          className={`ui-dropdown-custom__chevron shrink-0 ml-2 w-4 h-4 transition duration-200 ease-[ease] ${isOpen ? 'rotate-180 text-primary' : 'text-text-muted'}`}
          width="16"
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && !disabled && (
        <div className="ui-dropdown-custom__menu absolute top-[calc(100%+6px)] left-0 right-0 min-w-full z-[99999] overflow-hidden bg-surface border border-border rounded-lg shadow-lg">
          {((searchable && options.length > 5) || serverSearch) && (
            <div className="ui-dropdown-custom__search p-2 border-b border-border bg-surface">
              <input
                ref={searchInputRef}
                type="text"
                className="ui-dropdown-custom__search-input w-full px-3 min-h-[36px] border border-border-strong rounded-sm text-[length:var(--text-base)] text-text outline-none transition duration-200 ease-[ease] placeholder:text-text-subtle focus:border-primary focus:shadow-[var(--focus-ring)]"
                placeholder={serverSearch ? 'Type to search…' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="ui-dropdown-custom__options max-h-[220px] overflow-y-auto py-1">
            {loading ? (
              <div className="ui-dropdown-custom__loading p-3 text-[length:var(--text-base)] text-text-subtle text-center">
                Loading…
              </div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value != null ? String(opt.value) : `opt-${index}`}
                    className={`ui-dropdown-custom__option px-3 py-2 text-[length:var(--text-base)] cursor-pointer transition-colors duration-[120ms] ease-[ease] ${
                      isSelected
                        ? 'ui-dropdown-custom__option--selected bg-primary-soft text-primary font-medium'
                        : 'text-text font-normal hover:bg-grey-100'
                    } ${opt.className || ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.label}
                  </div>
                );
              })
            ) : (
              <div className="ui-dropdown-custom__no-results p-3 text-[length:var(--text-base)] text-text-subtle text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


