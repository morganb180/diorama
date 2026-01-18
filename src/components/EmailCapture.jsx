import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function EmailCapture({ address }) {
  const [isInterested, setIsInterested] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Focus input when expanded
  useEffect(() => {
    if (isInterested && !isSubmitted && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isInterested, isSubmitted]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/capture-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, address, timestamp: new Date().toISOString() }),
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to save email:', err);
      // Still show success to user - we don't want to block the experience
      setIsSubmitted(true);
    }
    setIsSubmitting(false);
  };

  // Submitted state - compact confirmation
  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200"
      >
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        </div>
        <span className="text-sm text-green-800">
          We'll be in touch at <span className="font-medium">{email}</span>
        </span>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Checkbox trigger */}
      <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
        <input
          type="checkbox"
          checked={isInterested}
          onChange={(e) => setIsInterested(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">
          Track my home value with Opendoor
        </span>
      </label>

      {/* Email input - expands when interested */}
      <AnimatePresence>
        {isInterested && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onSubmit={handleSubmit}
            className="overflow-visible"
          >
            <div className="flex gap-2 pt-2 pb-1">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
              <motion.button
                type="submit"
                disabled={!email.includes('@') || isSubmitting}
                whileTap={{ scale: 0.97 }}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  email.includes('@') && !isSubmitting
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12,5 19,12 12,19" />
                  </svg>
                )}
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
