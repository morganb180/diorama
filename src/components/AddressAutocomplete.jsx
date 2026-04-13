import React, { useRef, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function AddressAutocomplete({ value, onChange, placeholder, className }) {
  const inputRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setSuggestions(data.predictions || []);
      setShowDropdown(true);
      setHighlightIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  const selectSuggestion = (description) => {
    onChange(description);
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex].description);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.parentElement.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px',
            marginTop: '4px',
            padding: 0,
            listStyle: 'none',
            zIndex: 1000,
            maxHeight: '240px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              onMouseDown={() => selectSuggestion(s.description)}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#333',
                background: i === highlightIndex ? '#f0f4ff' : 'transparent',
              }}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
