import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AddressAutocomplete } from './components/AddressAutocomplete';
import { EmailCapture } from './components/EmailCapture';
import { generateDiorama } from './utils/api';
import { getWatermarkedBlob } from './utils/watermark';

// Style data
const STYLES = [
  { id: 'diorama', name: 'Diorama', sample: '/style-samples/diorama.png' },
  { id: 'ghibli', name: 'Ghibli', sample: '/style-samples/ghibli.png' },
  { id: 'wesanderson', name: 'Wes Anderson', sample: '/style-samples/wesanderson.png' },
  { id: 'lego', name: 'LEGO', sample: '/style-samples/lego.png' },
  { id: 'simcity', name: 'SimCity', sample: '/style-samples/simcity.png' },
  { id: 'animalcrossing', name: 'Animal Crossing', sample: '/style-samples/animalcrossing.png' },
  { id: 'lofi', name: 'Lo-fi', sample: '/style-samples/lofi.png' },
  { id: 'bobross', name: 'Bob Ross', sample: '/style-samples/bobross.png' },
  { id: 'kinkade', name: 'Kinkade', sample: '/style-samples/kinkade.png' },
  { id: 'cottagecore', name: 'Cottagecore', sample: '/style-samples/cottagecore.png' },
  { id: 'ukiyoe', name: 'Ukiyo-e', sample: '/style-samples/ukiyoe.png' },
  { id: 'travelposter', name: 'Travel Poster', sample: '/style-samples/travelposter.png' },
  { id: 'bauhaus', name: 'Bauhaus', sample: '/style-samples/bauhaus.png' },
  { id: 'figurine', name: 'Figurine', sample: '/style-samples/figurine.png' },
  { id: 'richardscarry', name: 'Richard Scarry', sample: '/style-samples/richardscarry.png' },
  { id: 'hologram', name: 'Hologram', sample: '/style-samples/hologram.png' },
];

// Dot matrix background component
function DotMatrixBg() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Dot grid with gradient mask for non-uniform effect */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          maskImage: 'radial-gradient(ellipse 120% 100% at 50% 0%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse 120% 100% at 50% 0%, black 0%, transparent 70%)',
        }}
      />
      {/* Second dot layer with different gradient direction */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          maskImage: 'radial-gradient(ellipse 100% 80% at 80% 100%, black 0%, transparent 60%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 80% at 80% 100%, black 0%, transparent 60%)',
        }}
      />
      {/* Subtle center highlight dots */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 50%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 50%)',
        }}
      />
      {/* Accent glow in top-right */}
      <div
        className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4"
        style={{
          background: 'radial-gradient(circle, rgba(0, 116, 228, 0.2) 0%, transparent 50%)',
        }}
      />
      {/* Coral glow in bottom-left */}
      <div
        className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2"
        style={{
          background: 'radial-gradient(circle, rgba(255, 107, 74, 0.12) 0%, transparent 50%)',
        }}
      />
    </div>
  );
}

// Opendoor logo
function OpendoorLogo({ className = "h-6" }) {
  return (
    <svg className={className} viewBox="0 0 256 56" fill="currentColor">
      <path d="M154.378 38.5472L154.378 38.5473C153.466 38.9528 152.132 39.5455 150.289 39.5455C146.07 39.5455 143.85 36.6648 143.85 27.7977C143.85 18.4782 146.626 15.4851 150.622 15.4851C152.677 15.4851 154.009 16.671 154.952 17.857V38.3027C154.783 38.3671 154.592 38.452 154.378 38.5472ZM163.778 7.69108C163.778 4.7717 163.876 2.08934 163.928 0.988439C163.943 0.66633 163.674 0.407602 163.359 0.436253L155.364 1.36004C155.131 1.38131 154.952 1.57969 154.952 1.81802V9.72444C154.952 11.7574 155.063 13.8472 155.063 13.8472C153.898 13.5081 152.343 13.226 150.845 13.226C142.185 13.226 134.746 17.9139 134.746 29.6617C134.746 39.9406 140.13 44.0073 145.626 44.0073C149.512 44.0073 152.621 42.4258 155.008 40.3365H155.23L155.117 43.4538C155.104 43.7859 155.389 44.0485 155.712 44.0021L163.328 43.1369C163.586 43.1004 163.778 42.8756 163.778 42.6103V7.69108ZM18.6517 5.8832C24.7573 5.8832 26.9781 11.3616 26.9781 24.5776C26.9781 37.8501 24.3691 41.6346 18.8736 41.6346C12.6562 41.6346 10.5468 36.2122 10.5468 23.0531C10.5468 9.72376 13.2668 5.8832 18.6517 5.8832ZM18.985 3.51123C10.0471 3.51123 0 9.38472 0 24.239C0 37.7941 8.99286 44.0066 18.5399 44.0066C27.4778 44.0066 37.5249 38.302 37.5249 23.3352C37.5249 9.32872 28.5325 3.51123 18.985 3.51123ZM50.4951 39.7148C51.4948 40.9007 52.9932 41.7481 54.8808 41.7481C59.2661 41.7481 61.5978 39.3761 61.5978 29.04C61.5978 20.9634 59.2106 18.1396 54.9917 18.1396C53.0406 18.1396 51.7322 18.6632 50.8408 19.0199L50.8406 19.02L50.8402 19.0202C50.7175 19.0693 50.6026 19.1153 50.4951 19.1562V39.7148ZM50.4951 17.1233C52.8273 15.0899 55.9351 13.2263 59.8212 13.2263C65.0948 13.2263 70.7012 16.7843 70.7012 27.12C70.7012 38.8678 63.9291 44.0072 54.6589 44.0072C53.4933 44.0072 51.6612 43.7815 50.4401 43.4429C50.4401 43.4429 50.4951 44.9115 50.4951 46.888V52.0413V54.5539C50.4951 54.7879 50.3227 54.9845 50.0945 55.0106L42.1713 55.9213C41.9033 55.9522 41.6691 55.7386 41.6691 55.4646V52.0413V14.5686C41.6691 14.3346 41.8414 14.1379 42.0701 14.1115L49.7732 13.2255C50.0736 13.1907 50.3347 13.436 50.3249 13.7438L50.2178 17.1233H50.4951ZM82.7352 25.1992L92.2272 24.6908C92.2272 17.8571 91.3398 15.3718 88.0088 15.3718C85.1774 15.3718 82.957 18.0828 82.7352 25.1992ZM73.9646 28.5314C73.9646 18.704 81.1249 13.2256 88.4525 13.2256C96.0237 13.2256 100.775 17.0314 101.046 26.9886C101.051 27.1822 100.896 27.3454 100.705 27.3454H83.0837C82.8926 27.3454 82.7382 27.5086 82.7428 27.7027C82.9912 36.674 86.4173 39.1497 92.0608 39.1497C94.8154 39.1497 97.0362 38.4985 98.8947 37.6598C99.0317 37.5977 99.1904 37.6342 99.2881 37.7505L100.026 38.634C100.138 38.7672 100.136 38.9643 100.019 39.0911C97.9936 41.2638 93.8712 44.0069 88.4525 44.0069C78.7936 44.0069 73.9646 38.133 73.9646 28.5314ZM113.208 17.236C116.149 15.0902 119.813 13.2262 123.865 13.2262C128.584 13.2262 131.138 15.7114 131.138 20.7948V42.8819C131.138 43.1293 130.94 43.3294 130.697 43.3294H122.696C122.453 43.3294 122.256 43.1293 122.256 42.8819V22.9971C122.256 19.552 121.034 18.4789 118.426 18.4789C116.482 18.4789 114.484 18.9303 113.263 19.2129V42.8819C113.263 43.1293 113.065 43.3294 112.823 43.3294H104.876C104.634 43.3294 104.437 43.1293 104.437 42.8819V14.568C104.437 14.334 104.609 14.1378 104.838 14.1117L112.606 13.2157C112.872 13.1854 113.103 13.402 113.094 13.675L112.985 17.236H113.208ZM182.333 15.4283C186.108 15.4283 188.273 17.5745 188.273 28.9833C188.273 39.8273 185.998 41.8038 182.666 41.8038C178.614 41.8038 176.782 39.3194 176.782 27.7409C176.782 18.0264 178.836 15.4283 182.333 15.4283ZM182.5 13.2256C175.006 13.2256 167.457 17.8567 167.457 28.7011C167.457 39.0364 174.451 44.0074 182.5 44.0074C190.161 44.0074 197.599 39.2626 197.599 28.4185C197.599 18.1393 190.549 13.2256 182.5 13.2256ZM221.382 28.9833C221.382 17.5745 219.218 15.4283 215.443 15.4283C211.945 15.4283 209.892 18.0264 209.892 27.7409C209.892 39.3194 211.724 41.8038 215.776 41.8038C219.107 41.8038 221.382 39.8273 221.382 28.9833ZM200.565 28.7011C200.565 17.8567 208.115 13.2256 215.609 13.2256C223.658 13.2256 230.708 18.1393 230.708 28.4185C230.708 39.2626 223.27 44.0074 215.609 44.0074C207.56 44.0074 200.565 39.0364 200.565 28.7011ZM243.234 17.5745C244.954 15.7109 248.118 13.2256 251.338 13.2256C254.002 13.2256 255.883 14.6937 255.883 17.4616C255.883 20.1726 253.947 21.9186 251.782 21.9186C249.397 21.9186 248.562 20.9067 247.508 19.1559C247.175 18.5347 246.841 18.4214 246.341 18.4214C245.343 18.4214 244.066 19.1559 243.289 19.8905V42.7975C243.289 43.091 243.054 43.3288 242.766 43.3288H234.985C234.696 43.3288 234.463 43.091 234.463 42.7975V14.5683C234.463 14.3339 234.635 14.1376 234.864 14.1116L242.539 13.2351C242.854 13.1991 243.129 13.4561 243.119 13.7791L243.011 17.5745H243.234Z"/>
    </svg>
  );
}

function App() {
  const [address, setAddress] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('diorama');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 3, message: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedStyleData = STYLES.find(s => s.id === selectedStyle);

  const handleGenerate = async () => {
    if (!address.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const generatedResult = await generateDiorama(address, selectedStyle, setProgress);
      setResult(generatedResult);
    } catch (err) {
      console.error('Generation failed:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setProgress({ step: 0, total: 3, message: '' });
  };

  return (
    <div className="min-h-screen bg-void relative">
      <DotMatrixBg />

      {/* Header */}
      <header className="relative z-10 border-b border-void-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <OpendoorLogo className="h-5 text-white" />
          <a
            href="https://www.opendoor.com/w/request-offer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white font-medium hover:text-accent transition-colors"
          >
            Get your offer →
          </a>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-6 py-12 min-h-[calc(100vh-140px)]">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {result ? (
              // Result View
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Result image with glow effect */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-accent/50 to-coral/50 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative bg-void-100 rounded-2xl p-2 border border-void-300">
                    <img
                      src={result.imageUrl}
                      alt="Generated diorama"
                      className="w-full rounded-xl"
                    />
                    {/* Watermark */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
                      <OpendoorLogo className="h-4 text-white/80" />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const blob = await getWatermarkedBlob(result.imageUrl);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'my-diorama.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error('Failed to download:', err);
                      }
                    }}
                    className="flex-1 py-3 bg-white hover:bg-white/90 rounded-xl text-void font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const blob = await getWatermarkedBlob(result.imageUrl);
                        await navigator.clipboard.write([
                          new ClipboardItem({ 'image/png': blob })
                        ]);
                        alert('Image copied to clipboard!');
                      } catch (err) {
                        console.error('Failed to copy:', err);
                        alert('Unable to copy image. Try downloading instead.');
                      }
                    }}
                    className="flex-1 py-3 bg-void-200 hover:bg-void-300 border border-void-400 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                </div>

                {/* CTA */}
                <a
                  href="https://www.opendoor.com/w/request-offer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-accent hover:bg-accent-bright hover:shadow-glow rounded-xl text-white font-semibold text-center transition-all"
                >
                  See how much you can get for your home →
                </a>

                <button
                  onClick={handleReset}
                  className="w-full py-3 text-white/50 hover:text-white transition-colors text-sm"
                >
                  ← Generate another
                </button>
              </motion.div>
            ) : isGenerating ? (
              // Loading View
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <div className="relative inline-block mb-8">
                  {/* Animated rings */}
                  <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-2 rounded-full border-2 border-accent/50 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  <div className="w-20 h-20 rounded-full border-2 border-accent flex items-center justify-center">
                    <div className="w-3 h-3 bg-accent rounded-full animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-display font-semibold text-white mb-2">
                  {progress.message || 'Initializing...'}
                </h3>
                <p className="text-white/40 text-sm font-mono">
                  STEP {progress.step || 1} OF {progress.total || 3}
                </p>
                <p className="text-white/30 text-xs mt-4">
                  This typically takes 20-40 seconds
                </p>
              </motion.div>
            ) : (
              // Input Form
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Hero text */}
                <div className="text-center space-y-4">
                  <h1 className="text-4xl md:text-5xl font-display font-bold text-white leading-tight">
                    One address.
                    <br />
                    <span className="text-gradient">Infinite imagination.</span>
                  </h1>
                  <p className="text-white/50 text-lg">
                    Transform your home into art with AI
                  </p>
                </div>

                {/* Form card */}
                <div className="bg-void-100/50 backdrop-blur-sm rounded-2xl border border-void-300 p-6 space-y-5">
                  {/* Address input */}
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      Your Address
                    </label>
                    <AddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      placeholder="Start typing your address..."
                      className="input-dark"
                    />
                  </div>

                  {/* Style selector */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white/60">
                        Style
                      </label>
                      <span className="text-sm text-accent font-medium">
                        {selectedStyleData?.name}
                      </span>
                    </div>

                    {/* Thumbnail strip */}
                    <div className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                      {STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`style-thumb flex-shrink-0 ${selectedStyle === style.id ? 'selected' : ''}`}
                        >
                          <img
                            src={style.sample}
                            alt={style.name}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>

                    {/* Preview */}
                    <motion.div
                      key={selectedStyle}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 relative aspect-[4/3] rounded-xl overflow-hidden bg-void-200"
                    >
                      <img
                        src={selectedStyleData?.sample}
                        alt={selectedStyleData?.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 p-4">
                        <p className="text-white font-semibold">{selectedStyleData?.name}</p>
                      </div>
                    </motion.div>
                  </div>

                  {/* Email capture */}
                  <EmailCapture address={address} />

                  {/* Generate button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!address.trim() || isGenerating}
                    className="btn-glow w-full"
                  >
                    {isGenerating ? 'Generating...' : 'Generate My Diorama'}
                  </button>

                  {/* Error */}
                  {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-void-300 py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-white/30 text-xs">
          <span>© {new Date().getFullYear()} Opendoor</span>
          <div className="flex items-center gap-4">
            <a href="https://www.opendoor.com/w/privacy-policy" className="hover:text-white/60 transition-colors">
              Privacy
            </a>
            <a href="https://www.opendoor.com/w/terms" className="hover:text-white/60 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
