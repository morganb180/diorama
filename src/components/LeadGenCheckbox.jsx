import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export function LeadGenCheckbox({ checked, onChange, disabled }) {
  return (
    <motion.label
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={`
        flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer
        transition-all duration-200
        ${checked ? 'border-opendoor-blue bg-opendoor-blue-light' : 'border-studio-warm bg-white hover:border-slate-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {/* Custom Checkbox */}
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <motion.div
          className={`
            w-5 h-5 rounded-md border-2 flex items-center justify-center
            transition-colors duration-200
            ${checked ? 'bg-opendoor-blue border-opendoor-blue' : 'bg-white border-slate-300'}
          `}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            initial={false}
            animate={{
              scale: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={{ duration: 0.15 }}
          >
            <Check size={14} className="text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>

      {/* Label Text */}
      <div className="flex-1">
        <p className={`text-sm font-medium ${checked ? 'text-opendoor-blue-dark' : 'text-slate-700'}`}>
          Send me information about Opendoor
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Get updates about selling your home, market insights, and exclusive offers.
        </p>
      </div>
    </motion.label>
  );
}
