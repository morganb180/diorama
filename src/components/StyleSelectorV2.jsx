import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

// All styles with metadata
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

export function StyleSelectorV2({ selectedStyle, onStyleChange }) {
  const scrollRef = useRef(null);
  const selectedData = STYLES.find(s => s.id === selectedStyle);

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Style
        </label>
        <span className="text-sm text-gray-500">
          {selectedData?.name}
        </span>
      </div>

      {/* Thumbnail strip */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto py-1 -mx-1 px-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {STYLES.map((style) => {
          const isSelected = selectedStyle === style.id;
          return (
            <motion.button
              key={style.id}
              onClick={() => onStyleChange(style.id)}
              whileTap={{ scale: 0.95 }}
              className="relative flex-shrink-0 group"
            >
              {/* Thumbnail */}
              <div
                className={`
                  w-16 h-16 rounded-xl overflow-hidden transition-all duration-200
                  ${isSelected
                    ? 'ring-2 ring-blue-500 ring-offset-2'
                    : 'ring-1 ring-gray-200 hover:ring-gray-300'
                  }
                `}
              >
                <img
                  src={style.sample}
                  alt={style.name}
                  className={`
                    w-full h-full object-cover transition-transform duration-200
                    ${isSelected ? 'scale-105' : 'group-hover:scale-105'}
                  `}
                />
              </div>

              {/* Selection dot */}
              {isSelected && (
                <motion.div
                  layoutId="selection-indicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Preview of selected style */}
      <motion.div
        key={selectedStyle}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 1 }}
        className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100"
      >
        <img
          src={selectedData?.sample}
          alt={selectedData?.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white font-medium">{selectedData?.name}</p>
        </div>
      </motion.div>
    </div>
  );
}
