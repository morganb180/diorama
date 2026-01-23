import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Gallery data - famous homes with their generated styles
const GALLERY_DATA = [
  {
    id: 'white-house',
    name: 'The White House',
    location: 'Washington, DC',
    styles: [
      { id: 'diorama', name: 'Diorama', image: '/gallery/white-house-diorama.png' },
      { id: 'ghibli', name: 'Ghibli', image: '/gallery/white-house-ghibli.png' },
      { id: 'lofi', name: 'Lo-Fi', image: '/gallery/white-house-lofi.png' },
    ],
  },
  {
    id: 'fallingwater',
    name: 'Fallingwater',
    location: 'Mill Run, PA',
    styles: [
      { id: 'diorama', name: 'Diorama', image: '/gallery/fallingwater-diorama.png' },
      { id: 'ghibli', name: 'Ghibli', image: '/gallery/fallingwater-ghibli.png' },
      { id: 'lofi', name: 'Lo-Fi', image: '/gallery/fallingwater-lofi.png' },
    ],
  },
  {
    id: 'gamble-house',
    name: 'The Gamble House',
    location: 'Pasadena, CA',
    styles: [
      { id: 'diorama', name: 'Diorama', image: '/gallery/gamble-house-diorama.png' },
      { id: 'ghibli', name: 'Ghibli', image: '/gallery/gamble-house-ghibli.png' },
      { id: 'lofi', name: 'Lo-Fi', image: '/gallery/gamble-house-lofi.png' },
    ],
  },
  {
    id: 'graceland',
    name: 'Graceland',
    location: 'Memphis, TN',
    styles: [
      { id: 'diorama', name: 'Diorama', image: '/gallery/graceland-diorama.png' },
      { id: 'ghibli', name: 'Ghibli', image: '/gallery/graceland-ghibli.png' },
      { id: 'lofi', name: 'Lo-Fi', image: '/gallery/graceland-lofi.png' },
    ],
  },
];

// Lightbox component for viewing full images
function Lightbox({ image, title, location, onClose }) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </motion.button>

      {/* Image container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative max-w-4xl max-h-[85vh] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image}
          alt={title}
          className="w-full h-full object-contain rounded-2xl shadow-2xl"
        />

        {/* Caption */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 rounded-b-2xl"
        >
          <h3 className="text-white text-xl font-semibold">{title}</h3>
          <p className="text-white/70 text-sm">{location}</p>
        </motion.div>
      </motion.div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-4 text-white/50 text-sm"
      >
        Press ESC or click anywhere to close
      </motion.p>
    </motion.div>
  );
}

export function FamousHomesGallery() {
  const [selectedStyle, setSelectedStyle] = useState('diorama');
  const [lightboxData, setLightboxData] = useState(null);

  const openLightbox = (home, styleData) => {
    setLightboxData({
      image: styleData.image,
      title: home.name,
      location: home.location,
    });
  };

  return (
    <div className="mt-12 mb-8 max-w-md mx-auto px-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          See it in action
        </h2>
        <p className="text-sm text-gray-500">
          Famous homes transformed
        </p>
      </div>

      {/* Style toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setSelectedStyle('diorama')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedStyle === 'diorama'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Diorama
        </button>
        <button
          onClick={() => setSelectedStyle('ghibli')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedStyle === 'ghibli'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Ghibli
        </button>
        <button
          onClick={() => setSelectedStyle('lofi')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedStyle === 'lofi'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Lo-Fi
        </button>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-2 gap-3">
        {GALLERY_DATA.map((home) => {
          const styleData = home.styles.find((s) => s.id === selectedStyle);
          return (
            <motion.button
              key={home.id}
              onClick={() => openLightbox(home, styleData)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative group rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-lg transition-shadow text-left cursor-pointer"
            >
              <img
                src={styleData?.image}
                alt={`${home.name} - ${selectedStyle}`}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <p className="text-white text-sm font-medium">{home.name}</p>
                <p className="text-white/70 text-xs">{home.location}</p>
              </div>

              {/* Hover hint */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ opacity: 1, scale: 1 }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </motion.div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxData && (
          <Lightbox
            image={lightboxData.image}
            title={lightboxData.title}
            location={lightboxData.location}
            onClose={() => setLightboxData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
