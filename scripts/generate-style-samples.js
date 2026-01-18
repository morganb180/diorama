/**
 * Generate style samples for the style selector UI
 * Uses Fallingwater as a consistent, visually interesting reference
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Reference property - Fallingwater (architecturally interesting)
const REFERENCE = {
  name: 'Fallingwater',
  address: '1491 Mill Run Rd, Mill Run, PA 15464',
};

// All styles to generate
const STYLES = [
  { id: 'diorama', prompt: '45-degree isometric miniature architectural diorama model. Studio photography, warm lighting, clean background.', useRef: true },
  { id: 'simcity', prompt: '90s SimCity-style 2.5D isometric pixel art sprite. Clean aliased edges, vibrant 16-bit colors.', useRef: true },
  { id: 'lego', prompt: 'LEGO Architecture brick-built model. Chunky LEGO bricks with visible studs, smooth ABS plastic.', useRef: true },
  { id: 'bauhaus', prompt: 'Bauhaus geometric poster art. Primary colors, flat shapes, sharp edges, modernist aesthetic.', useRef: false },
  { id: 'figurine', prompt: 'Miniature isometric plastic figurine, like a board game piece. Smooth plastic finish.', useRef: true },
  { id: 'wesanderson', prompt: 'Photorealistic Wes Anderson film still. Peachy-pink walls, coral roof, powder blue sky. Perfect bilateral symmetry. Grand Budapest Hotel aesthetic.', useRef: false },
  { id: 'animalcrossing', prompt: 'Animal Crossing New Horizons style. Soft rounded edges, cel-shaded, chibi proportions, pastel sky.', useRef: true },
  { id: 'ghibli', prompt: 'Studio Ghibli anime background painting. Warm afternoon sun, hand-painted textures, puffy clouds.', useRef: true },
  { id: 'bobross', prompt: 'Bob Ross "Joy of Painting" style oil painting. Happy little trees, titanium white highlights.', useRef: true },
  { id: 'kinkade', prompt: 'Thomas Kinkade "Painter of Light" style. Magical golden hour, warm glowing windows.', useRef: true },
  { id: 'ukiyoe', prompt: 'Traditional Japanese ukiyo-e woodblock print. Flat colors, bold outlines, Hokusai style.', useRef: false },
  { id: 'travelposter', prompt: 'Vintage 1950s travel poster. Bold flat colors, art deco, "Visit Pennsylvania" style.', useRef: false },
  { id: 'richardscarry', prompt: 'Richard Scarry Busytown children\'s book illustration. Cross-section cutaway, anthropomorphic animals.', useRef: true },
  { id: 'lofi', prompt: 'Lo-fi hip hop anime aesthetic. Warm cozy evening, purple and orange sunset tones.', useRef: true },
  { id: 'cottagecore', prompt: 'Dreamy cottagecore fairy tale. Overgrown garden, roses, dappled sunlight, ethereal.', useRef: true },
];

async function fetchImages() {
  console.log(`📷 Fetching reference images...`);
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(REFERENCE.address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(REFERENCE.address)}&zoom=18&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `Extract this building's key visual identity in 2-3 sentences. Focus on: architectural style, distinctive features, materials, colors, and setting.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateStyleSample(identity, images, style) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = style.useRef
    ? `Create a ${style.prompt}

Reference: ${identity}

Study the reference photos and create this building in the specified style. Generate now.`
    : `Create a ${style.prompt}

Building description: ${identity}

Generate now.`;

  try {
    let result;
    if (style.useRef) {
      const svPart = { inlineData: { data: images.streetView, mimeType: 'image/jpeg' } };
      const avPart = { inlineData: { data: images.aerialView, mimeType: 'image/png' } };
      result = await model.generateContent([prompt, svPart, avPart]);
    } else {
      result = await model.generateContent(prompt);
    }

    const response = await result.response;
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return { success: true, base64: part.inlineData.data };
      }
    }
    return { success: false, error: 'No image' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🎨 STYLE SAMPLES GENERATOR\n');

  const outputDir = './public/style-samples';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const images = await fetchImages();
  console.log('🧬 Extracting identity...');
  const identity = await extractIdentity(images.streetView, images.aerialView);
  console.log(`   "${identity.substring(0, 100)}..."\n`);

  // Skip styles we already have from gallery
  const existingStyles = ['diorama', 'ghibli'];

  for (const style of STYLES) {
    // Check if we already have this from the gallery
    if (existingStyles.includes(style.id)) {
      const existingPath = `./public/gallery/fallingwater-${style.id}.png`;
      if (fs.existsSync(existingPath)) {
        fs.copyFileSync(existingPath, `${outputDir}/${style.id}.png`);
        console.log(`📋 ${style.id}: copied from gallery`);
        continue;
      }
    }

    console.log(`🎨 Generating ${style.id}...`);
    const result = await generateStyleSample(identity, images, style);

    if (result.success) {
      fs.writeFileSync(`${outputDir}/${style.id}.png`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.id} saved`);
    } else {
      console.log(`❌ ${style.id}: ${result.error}`);
    }
  }

  console.log('\n📂 Style samples saved to public/style-samples/');
}

main().catch(console.error);
