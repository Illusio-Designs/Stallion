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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find the selected option label
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayValue = selectedOption ? selectedOption.label : placeholder;
  const hasValue = selectedOption !== undefined;

  // Filter options based on search query
  const filteredOptions = searchQuery
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

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
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchQuery(''); // Reset search when closing
      }
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={`ui-dropdown-custom ${className} ${disabled ? 'ui-dropdown-custom--disabled' : ''} ${isOpen ? 'ui-dropdown-custom--open' : ''}`}
    >
      <div 
        className="ui-dropdown-custom__trigger"
        onClick={handleToggle}
      >
        <span className={`ui-dropdown-custom__value ${!hasValue ? 'ui-dropdown-custom__value--placeholder' : ''}`}>{displayValue}</span>
        <svg 
          className="ui-dropdown-custom__chevron"
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
        <div className="ui-dropdown-custom__menu">
          {searchable && options.length > 5 && (
            <div className="ui-dropdown-custom__search">
              <input
                ref={searchInputRef}
                type="text"
                className="ui-dropdown-custom__search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="ui-dropdown-custom__options">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value != null ? String(opt.value) : `opt-${index}`}
                    className={`ui-dropdown-custom__option ${isSelected ? 'ui-dropdown-custom__option--selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.label}
                  </div>
                );
              })
            ) : (
              <div className="ui-dropdown-custom__no-results">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


