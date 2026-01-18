import { motion } from 'framer-motion';
import { STYLES } from '../utils/config';

export function LoadingAnimation({ progress, selectedStyle }) {
  const style = STYLES[selectedStyle] || STYLES.diorama;
  const progressPercent = progress?.step > 0
    ? ((progress.step - 1) / (progress.total || 3)) * 100 + (100 / (progress.total || 3)) * 0.5
    : 5;

  const stepMessages = {
    1: 'Capturing street view of your property...',
    2: 'AI is analyzing architectural features...',
    3: 'Generating your custom diorama artwork...',
  };

  const currentMessage = stepMessages[progress?.step] || progress?.message || 'Starting...';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full max-w-md mx-auto"
    >
      {/* Main Loading Card */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
        {/* Animated Header Bar */}
        <div className="relative h-2 bg-slate-100 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-opendoor-blue"
            initial={{ width: '5%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Spinner */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-opendoor-blue"
              />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">
                {style.icon}
              </div>
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center space-y-2">
            <motion.h3
              key={progress?.step || 0}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-semibold text-lg text-slate-800"
            >
              {currentMessage}
            </motion.h3>
            <p className="text-sm text-slate-500">
              This typically takes 20-40 seconds
            </p>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    (progress?.step || 0) > step
                      ? 'bg-green-500 text-white'
                      : (progress?.step || 0) === step
                      ? 'bg-opendoor-blue text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {(progress?.step || 0) > step ? '✓' : step}
                </div>
                {step < 3 && (
                  <div className={`w-6 h-0.5 ${(progress?.step || 0) > step ? 'bg-green-500' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Labels */}
          <div className="flex justify-between mt-3 px-2 text-xs text-slate-400">
            <span>Capture</span>
            <span>Analyze</span>
            <span>Generate</span>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-slate-400 mt-4">
        Please wait while we create your artwork
      </p>
    </motion.div>
  );
}
