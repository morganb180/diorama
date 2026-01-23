import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, RefreshCw, Copy, Check, ChevronDown, ChevronUp, MapPinOff } from 'lucide-react';
import { downloadImage, shareImage } from '../utils/api';
import { STYLES } from '../utils/config';

export function ResultDisplay({ result, selectedStyle, onReset }) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const style = STYLES[selectedStyle];

  const handleDownload = () => {
    const styleName = style?.shortName?.toLowerCase() || 'diorama';
    downloadImage(result.imageUrl, `my-home-${styleName}.png`);
  };

  const handleShare = async () => {
    setIsSharing(true);
    const shareResult = await shareImage(result.imageUrl, 'My Home Diorama');
    setIsSharing(false);

    if (shareResult.success) {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-lg mx-auto"
    >
      {/* No Street View Notice */}
      {result.noStreetView && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <MapPinOff size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Google Street View isn't available for this address
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {result.fallbackHome ? (
                  <>Here's the <strong>{result.fallbackHome.name}</strong> in {result.fallbackHome.location} instead!</>
                ) : (
                  <>Try a different address, or explore our gallery of famous homes.</>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Image Display */}
      <div className="result-pedestal group">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 100 }}
          className="relative aspect-square rounded-xl overflow-hidden bg-slate-100"
        >
          <img
            src={result.imageUrl}
            alt={`${style?.name || 'Diorama'} of your home`}
            className="w-full h-full object-cover"
            loading="eager"
          />

          {/* Overlay Gradient on Hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Style Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-card"
          >
            <span className="text-lg">{style?.icon}</span>
            <span className="text-xs font-display font-semibold text-slate-700">
              {result.noStreetView && result.fallbackHome
                ? result.fallbackHome.name
                : style?.shortName}
            </span>
          </motion.div>

          {/* Quick Actions on Hover */}
          <div className="absolute bottom-4 left-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
            <motion.button
              onClick={handleDownload}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/95 backdrop-blur-sm rounded-lg text-slate-700 font-medium text-sm shadow-card hover:bg-white transition-colors"
            >
              <Download size={16} />
              Download
            </motion.button>
            <motion.button
              onClick={handleShare}
              disabled={isSharing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-opendoor-blue text-white rounded-lg font-medium text-sm shadow-card hover:bg-opendoor-blue-dark transition-colors disabled:opacity-70"
            >
              {shareSuccess ? (
                <>
                  <Check size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  Share
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons - Mobile Friendly */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-3 mt-4 sm:hidden"
      >
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-white rounded-xl border-2 border-studio-warm text-slate-700 font-display font-semibold text-sm hover:border-slate-300 transition-colors"
        >
          <Download size={18} />
          Download
        </button>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-opendoor-blue rounded-xl text-white font-display font-semibold text-sm hover:bg-opendoor-blue-dark transition-colors disabled:opacity-70"
        >
          {shareSuccess ? (
            <>
              <Check size={18} />
              Copied!
            </>
          ) : (
            <>
              <Share2 size={18} />
              Share
            </>
          )}
        </button>
      </motion.div>

      {/* Generation Details Accordion */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6"
      >
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-studio-warm hover:border-slate-300 transition-colors"
        >
          <span className="text-sm font-display font-medium text-slate-600">
            Generation Details
          </span>
          {showDetails ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-4 bg-white rounded-xl border border-studio-warm space-y-4">
                {/* Semantic Description */}
                <div>
                  <h4 className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Property Analysis
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {result.semanticDescription}
                  </p>
                </div>

                {/* Generated Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wide">
                      Generation Prompt
                    </h4>
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1 text-xs text-opendoor-blue hover:text-opendoor-blue-dark transition-colors"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check size={12} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-mono bg-slate-50 p-3 rounded-lg">
                    {result.prompt}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Try Again Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 mt-4 py-3 text-slate-500 hover:text-opendoor-blue transition-colors"
      >
        <RefreshCw size={18} />
        <span className="font-display font-medium text-sm">Generate Another</span>
      </motion.button>
    </motion.div>
  );
}
