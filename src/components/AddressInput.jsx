import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, X } from 'lucide-react';

// Sample addresses for autocomplete suggestions (in production, use Google Places API)
const SAMPLE_SUGGESTIONS = [
  '26141 Red Corral Rd, Laguna Hills, CA 92653',
  '742 Evergreen Terrace, Springfield, IL 62701',
  '1600 Pennsylvania Avenue NW, Washington, DC 20500',
  '221B Baker Street, London, UK',
  '350 Fifth Avenue, New York, NY 10118',
];

export function AddressInput({ value, onChange, onSubmit, disabled, isLoading }) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (value.length > 2 && isFocused) {
      const filtered = SAMPLE_SUGGESTIONS.filter((addr) =>
        addr.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 3));
    } else {
      setSuggestions([]);
    }
  }, [value, isFocused]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      setSuggestions([]);
      onSubmit();
    }
  };

  const handleSuggestionClick = (address) => {
    onChange(address);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const clearInput = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label className="block text-sm font-medium text-slate-600 mb-3 font-display">
        Enter Your Address
      </label>

      <div className="relative">
        {/* Input Container */}
        <motion.div
          className={`
            relative flex items-center bg-white rounded-xl border-2 overflow-hidden
            transition-all duration-300
            ${isFocused ? 'border-opendoor-blue shadow-glow' : 'border-studio-warm'}
            ${disabled ? 'opacity-60' : ''}
          `}
          animate={{
            boxShadow: isFocused
              ? '0 0 0 4px rgba(0, 116, 228, 0.1)'
              : '0 0 0 0px rgba(0, 116, 228, 0)',
          }}
        >
          {/* Map Pin Icon */}
          <div className="flex items-center justify-center w-14 h-14 text-slate-400">
            <MapPin
              size={20}
              className={`transition-colors duration-200 ${isFocused ? 'text-opendoor-blue' : ''}`}
            />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            disabled={disabled}
            placeholder="123 Main Street, City, State 12345"
            className="flex-1 py-4 pr-4 bg-transparent font-body text-slate-700 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
          />

          {/* Clear Button */}
          <AnimatePresence>
            {value && !disabled && (
              <motion.button
                type="button"
                onClick={clearInput}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center justify-center w-10 h-10 mr-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={!value.trim() || disabled}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            className={`
              flex items-center justify-center gap-2 h-10 px-5 mr-2 rounded-lg
              font-display font-semibold text-sm
              transition-all duration-200
              ${
                value.trim() && !disabled
                  ? 'bg-opendoor-blue text-white hover:bg-opendoor-blue-dark'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <>
                <Search size={16} />
                <span className="hidden sm:inline">Generate</span>
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-20 left-0 right-0 mt-2 bg-white rounded-xl border border-studio-warm shadow-card overflow-hidden"
            >
              {suggestions.map((address, index) => (
                <motion.button
                  key={address}
                  type="button"
                  onClick={() => handleSuggestionClick(address)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-opendoor-blue-light transition-colors"
                >
                  <MapPin size={16} className="text-opendoor-blue flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{address}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
