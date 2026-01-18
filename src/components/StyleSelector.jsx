import { motion } from 'framer-motion';
import { STYLES } from '../utils/config';

const styleOrder = ['diorama', 'simcity', 'simpsons'];

export function StyleSelector({ selectedStyle, onStyleChange, disabled }) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-600 mb-3 font-display">
        Choose Your Style
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {styleOrder.map((styleId, index) => {
          const style = STYLES[styleId];
          const isSelected = selectedStyle === styleId;

          return (
            <motion.button
              key={styleId}
              type="button"
              onClick={() => onStyleChange(styleId)}
              disabled={disabled}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ scale: disabled ? 1 : 1.02 }}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
              className={`
                style-chip group text-left
                ${isSelected ? 'selected' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={{
                '--style-color': style.color,
                '--style-bg': style.bgColor,
              }}
            >
              {/* Style Icon */}
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-lg text-xl
                  transition-all duration-300
                  ${isSelected ? 'scale-110' : 'group-hover:scale-105'}
                `}
                style={{
                  backgroundColor: isSelected ? style.bgColor : 'rgba(0,0,0,0.03)',
                }}
              >
                {style.icon}
              </div>

              {/* Style Info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`
                    font-display font-semibold text-sm truncate
                    transition-colors duration-200
                    ${isSelected ? 'text-opendoor-blue' : 'text-slate-700'}
                  `}
                >
                  {style.shortName}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {style.description}
                </div>
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <motion.div
                  layoutId="styleIndicator"
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-opendoor-blue"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {/* Hover Accent Line */}
              <div
                className={`
                  absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl
                  transition-all duration-300 origin-left
                  ${isSelected ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}
                `}
                style={{ backgroundColor: style.color }}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
