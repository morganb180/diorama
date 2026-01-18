import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, OpendoorLogo } from './components/Header';
import { Footer } from './components/Footer';
import { FamousHomesGallery } from './components/FamousHomesGallery';
import { StyleSelectorV2 } from './components/StyleSelectorV2';
import { AddressAutocomplete } from './components/AddressAutocomplete';
import { EmailCapture } from './components/EmailCapture';
import { generateDiorama } from './utils/api';
import { STYLES } from './utils/config';
import { getWatermarkedBlob } from './utils/watermark';

function App() {
  const [address, setAddress] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('diorama');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: 0, total: 3, message: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {result ? (
            // Result View
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {/* Image with watermark */}
              <div className="relative mb-4">
                <img
                  src={result.imageUrl}
                  alt="Generated diorama"
                  className="w-full rounded-xl"
                />
                {/* Opendoor watermark */}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-gray-900">
                  <OpendoorLogo className="h-4 w-auto" />
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{result.semanticDescription}</p>

              {/* Download and Share buttons */}
              <div className="flex gap-2 mb-4">
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
                      // Fallback to direct download without watermark
                      const a = document.createElement('a');
                      a.href = result.imageUrl;
                      a.download = 'my-diorama.png';
                      a.click();
                    }
                  }}
                  className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium text-center flex items-center justify-center gap-2 transition-colors"
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
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
              </div>

              {/* CTA to Opendoor */}
              <a
                href="https://www.opendoor.com/w/request-offer"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white font-semibold text-center transition-all"
              >
                See how much you can get for your home →
              </a>

              {/* Generate another link */}
              <button
                onClick={handleReset}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Generate another diorama
              </button>
            </div>
          ) : isGenerating ? (
            // Loading View
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {progress.message || 'Starting...'}
              </h3>
              <p className="text-sm text-gray-500">
                Step {progress.step || 1} of {progress.total || 3}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                This typically takes 20-40 seconds
              </p>
            </div>
          ) : (
            // Input Form
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  One address. Infinite imagination.
                </h1>
                <p className="text-gray-600">
                  Transform your home into art. Just enter your address.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                {/* Address Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Your Address
                  </label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    placeholder="Start typing your address..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Style Selector */}
                <StyleSelectorV2
                  selectedStyle={selectedStyle}
                  onStyleChange={setSelectedStyle}
                />

                {/* Email Capture */}
                <EmailCapture address={address} />

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!address.trim() || isGenerating}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                    address.trim() && !isGenerating
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isGenerating ? 'Generating...' : 'Generate My Diorama'}
                </button>

                {/* Error */}
                {error && (
                  <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm">
                    {error}
                  </div>
                )}
              </div>

              {/* Famous Homes Gallery */}
              <FamousHomesGallery />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
