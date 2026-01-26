import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for deployments behind reverse proxies (Digital Ocean, Heroku, etc.)
app.set('trust proxy', 1);

// ============================================
// GENERATION LOGGING
// ============================================

const GENERATION_LOG_FILE = path.join(process.cwd(), 'generations.jsonl');

// Cost estimates per generation (in USD)
const COST_ESTIMATES = {
  streetView: 0.007,      // $7 per 1000 requests
  staticMap: 0.002,       // $2 per 1000 requests
  visionAnalysis: 0.003,  // Gemini 2.5 Flash vision (upgraded from 2.0)
  imageGeneration: 0.039, // Gemini 2.5 Flash Image ($30/1M tokens, ~1290 tokens/image)
};
const ESTIMATED_COST_PER_GENERATION = Object.values(COST_ESTIMATES).reduce((a, b) => a + b, 0);

// ============================================
// FAMOUS HOMES FALLBACK (for no Street View coverage)
// ============================================

const FAMOUS_HOMES_FALLBACK = [
  { id: 'home-alone', name: 'Home Alone House', location: 'Winnetka, IL' },
  { id: 'fresh-prince', name: 'Fresh Prince Mansion', location: 'Los Angeles, CA' },
  { id: 'breaking-bad', name: 'Breaking Bad House', location: 'Albuquerque, NM' },
  { id: 'christmas-story', name: 'A Christmas Story House', location: 'Cleveland, OH' },
  { id: 'ferris-bueller', name: 'Ferris Bueller Glass House', location: 'Highland Park, IL' },
  { id: 'eames-house', name: 'Eames House', location: 'Pacific Palisades, CA' },
  { id: 'stahl-house', name: 'Stahl House', location: 'Los Angeles, CA' },
];

function getRandomFamousHomeFallback(styleId) {
  const home = FAMOUS_HOMES_FALLBACK[Math.floor(Math.random() * FAMOUS_HOMES_FALLBACK.length)];
  const filename = `${home.id}-${styleId}.png`;
  // Use non-watermarked images - client adds watermark on display/save
  const filepath = path.join(process.cwd(), 'launch-assets', filename);

  // Check if this style exists for this home, fallback to diorama if not
  if (!fs.existsSync(filepath)) {
    const dioramaPath = path.join(process.cwd(), 'launch-assets', `${home.id}-diorama.png`);
    if (fs.existsSync(dioramaPath)) {
      return {
        home,
        imagePath: dioramaPath,
        style: 'diorama',
      };
    }
    return null;
  }

  return {
    home,
    imagePath: filepath,
    style: styleId,
  };
}

function logGeneration({ address, styleId, success, durationMs, error = null, cached = {} }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    address: address ? address.substring(0, 100) : 'unknown', // Truncate for privacy
    styleId,
    success,
    durationMs,
    error: error ? error.substring(0, 200) : null,
    cached, // { streetView: bool, aerial: bool, identity: bool }
    estimatedCost: success ? ESTIMATED_COST_PER_GENERATION : 0,
  };

  try {
    fs.appendFileSync(GENERATION_LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.error('Failed to log generation:', err.message);
  }
}

function getGenerationStats() {
  try {
    if (!fs.existsSync(GENERATION_LOG_FILE)) {
      return { total: 0, successful: 0, failed: 0, totalCost: 0, byStyle: {}, recentGenerations: [] };
    }

    const lines = fs.readFileSync(GENERATION_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const entries = lines.map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);

    const successful = entries.filter(e => e.success);
    const failed = entries.filter(e => !e.success);
    const totalCost = entries.reduce((sum, e) => sum + (e.estimatedCost || 0), 0);

    const byStyle = {};
    entries.forEach(e => {
      if (!byStyle[e.styleId]) byStyle[e.styleId] = { count: 0, cost: 0 };
      byStyle[e.styleId].count++;
      byStyle[e.styleId].cost += e.estimatedCost || 0;
    });

    return {
      total: entries.length,
      successful: successful.length,
      failed: failed.length,
      totalCost: Math.round(totalCost * 1000) / 1000,
      costPerGeneration: entries.length > 0 ? Math.round((totalCost / entries.length) * 1000) / 1000 : 0,
      byStyle,
      avgDurationMs: successful.length > 0
        ? Math.round(successful.reduce((sum, e) => sum + (e.durationMs || 0), 0) / successful.length)
        : 0,
      recentGenerations: entries.slice(-10).reverse(),
    };
  } catch (err) {
    console.error('Failed to get generation stats:', err.message);
    return { error: err.message };
  }
}

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit - 100 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for generation endpoints - 5 per minute per IP
const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Generation limit reached. Please wait a minute before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// IN-MEMORY CACHE
// ============================================

class SimpleCache {
  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) { // 30 min default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  set(key, value) {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }
}

// Caches for expensive operations
const streetViewCache = new SimpleCache(200, 60 * 60 * 1000); // 1 hour TTL
const aerialViewCache = new SimpleCache(200, 60 * 60 * 1000);
const identityCache = new SimpleCache(200, 60 * 60 * 1000);

// ============================================
// GENERATION QUEUE
// ============================================

class GenerationQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }

  getStatus() {
    return { running: this.running, queued: this.queue.length };
  }
}

const generationQueue = new GenerationQueue(3);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter); // Apply general rate limit to all routes

// Serve static files from the built frontend (production)
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Configuration
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// Validate API keys on startup
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️  GOOGLE_MAPS_API_KEY not set - Street View will use placeholder images');
}
if (!GOOGLE_AI_API_KEY) {
  console.warn('⚠️  GOOGLE_AI_API_KEY not set - Vision and Image generation will use mock data');
}

// Initialize Gemini client
const genAI = GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(GOOGLE_AI_API_KEY) : null;

// ============================================
// STYLE ALLOWLIST (Server-side definitions)
// These cannot be overridden by client requests
// ============================================

const ALLOWED_STYLES = {
  diorama: {
    name: 'Miniature Diorama',
    useReference: true,
    prompt: '45-degree isometric miniature architectural diorama model. Studio photography, warm lighting, clean background. Show the house from an isometric angle revealing front, side, and roof. Make it look like a high-end architectural scale model.',
  },
  simcity: {
    name: 'Retro SimCity',
    useReference: true,
    prompt: '90s SimCity-style 2.5D isometric pixel art sprite. Clean aliased edges, vibrant 16-bit colors, gray-blue solid background. Pixel-perfect retro game aesthetic.',
  },
  lego: {
    name: 'LEGO Architecture',
    useReference: true,
    prompt: 'LEGO Architecture brick-built model. Chunky LEGO bricks with visible studs, smooth ABS plastic sheen, minifigure-scale. White gradient studio background, product photography style.',
  },
  bauhaus: {
    name: 'Bauhaus Poster',
    useReference: false,
    prompt: `TRANSFORM this house into a Bauhaus geometric poster illustration.

MANDATORY BAUHAUS STYLE:
- Reduce the house to PURE GEOMETRIC SHAPES: circles, squares, rectangles, triangles
- FLAT colors only - NO gradients, NO shading, NO 3D effects
- Limited palette: red, blue, yellow, black, white, and cream/tan
- Bold black outlines separating color blocks
- Asymmetric but balanced composition

IMPORTANT:
- DO NOT include any text, words, labels, or typography
- DO NOT include "house identity card" or any descriptions
- ONLY create the geometric illustration of the house
- Think: Kandinsky, Mondrian abstract art style

Create ONLY the geometric artwork - no text whatsoever.`,
  },
  figurine: {
    name: 'Plastic Figurine',
    useReference: true,
    prompt: 'Miniature isometric plastic figurine, like a detailed board game piece or architectural model. Slightly stylized proportions (a bit chunky/cute). Smooth plastic finish, white background, product photography.',
  },
  wesanderson: {
    name: 'Wes Anderson',
    useReference: false,
    prompt: 'Photorealistic Wes Anderson film still. Shot on 35mm film, architecturally sharp and detailed. The house has been repainted and art-directed for the film: walls are now soft peachy-pink, the roof is dusty coral/salmon, trim is cream white. The sky is powder blue, grass is muted sage green. Perfect bilateral symmetry, house dead-center. Soft diffused golden hour lighting. 8K cinematic quality. The Grand Budapest Hotel aesthetic.',
  },
  animalcrossing: {
    name: 'Animal Crossing',
    useReference: true,
    prompt: `Animal Crossing style illustration - a soft, hand-drawn storybook scene. NOT a 3D game screenshot.

Art style requirements:
- Soft, gentle LINE ART with pastel colored outlines (not black)
- Hand-illustrated, watercolor-like quality
- Dreamy, whimsical storybook aesthetic
- Soft pastel color palette with muted tones
- Gentle gradients and soft shading

Scene composition:
- The house as the focal point in middle-ground
- 2-3 CUTE ANTHROPOMORPHIC ANIMAL VILLAGERS in the foreground (foxes, deer, cats, etc. wearing clothes)
- Lush, illustrated trees with soft, fluffy foliage surrounding the scene
- A gentle stream, pond, or river in the foreground
- Stepping stone path leading to the house
- Soft clouds and warm sunny sky
- Butterflies, birds, or falling leaves for atmosphere

The overall feeling should be cozy, peaceful, and magical - like a scene from a beloved children's book or Animal Crossing promotional art.`,
  },
  ghibli: {
    name: 'Studio Ghibli',
    useReference: true,
    prompt: 'Studio Ghibli anime background painting. Reimagine this house in Miyazaki\'s world - warm afternoon sun, hand-painted textures, lush vegetation, puffy clouds. Show it from a slight angle like an establishing shot. Include all the signature features.',
  },
  bobross: {
    name: 'Bob Ross',
    useReference: true,
    prompt: `Bob Ross style oil painting - a naturalistic landscape scene with the house nestled organically in nature.

Painting style:
- Impressionistic oil painting with VISIBLE BRUSH STROKES
- Wet-on-wet technique with soft, blended edges
- Canvas texture visible through the paint
- Rich, warm color palette

Scene composition (IMPORTANT - naturalistic, not staged):
- The house viewed from an angle, partially obscured by trees
- ABUNDANT AUTUMN FOLIAGE - rich oranges, deep reds, golden yellows, rusty browns
- Deciduous trees with detailed fall leaves surrounding and framing the house
- A winding stream or creek flowing through the foreground
- Wildflowers, bushes, and natural ground cover
- Soft afternoon sunlight filtering through the trees
- The house should feel like it BELONGS in this natural setting

Avoid:
- Symmetrical compositions
- The house being too prominent or centered
- Sparse, empty areas
- Overly bright or saturated colors

The painting should feel like a peaceful autumn day - the kind of scene Bob would paint while talking about "happy little trees" and making you feel relaxed.`,
  },
  kinkade: {
    name: 'Thomas Kinkade',
    useReference: true,
    prompt: 'Thomas Kinkade "Painter of Light" style painting. Magical golden hour lighting, warm glowing windows emanating cozy light, lush flowering gardens, romantic idealized atmosphere, soft ethereal glow throughout. Nostalgic, heartwarming, Christmas-card beautiful.',
  },
  ukiyoe: {
    name: 'Ukiyo-e Woodblock',
    useReference: false,
    prompt: `Traditional Japanese ukiyo-e woodblock print in the style of Hokusai and Hiroshige. Create a COMPLETE COMPOSITION, not just the house.

REQUIRED elements:
- The house as the central subject but integrated into a larger scene
- Mount Fuji or mountains visible in the distant background
- Traditional Japanese figures in period clothing (merchants, travelers, or townspeople) in the foreground or middle ground
- Japanese calligraphy/kanji text block on the left or right margin (artist signature style)
- Decorative cartouche with title text
- Stylized waves, clouds, or wind patterns
- Cherry blossoms or pine trees framing the scene

Visual style requirements:
- Flat color areas with BOLD BLACK OUTLINES (no gradients)
- Limited color palette: indigo blue, rust red, ochre yellow, sage green, cream
- Visible wood grain texture throughout
- Bokashi gradient technique on sky
- Multiple visual planes creating depth
- Edo period (1603-1868) aesthetic

This should look like it could hang in a museum next to "The Great Wave."`,
  },
  travelposter: {
    name: 'Vintage Travel Poster',
    useReference: true,
    prompt: 'Vintage 1950s travel poster illustration featuring THIS HOUSE as the main focal point. The house should be prominently displayed in the center/foreground, rendered in bold flat colors and simplified geometric shapes. Art deco influences, optimistic mid-century modern aesthetic, screen-printed texture. Include "Visit [LOCATION]" text at top. Warm sunset palette with teal accents. The house is the star of this tourism poster.',
  },
  richardscarry: {
    name: 'Richard Scarry',
    useReference: true,
    prompt: 'Richard Scarry Busytown children\'s book illustration. Charming hand-drawn style, warm cheerful colors, cross-section cutaway showing interior rooms, tiny anthropomorphic animal residents going about their day, whimsical details everywhere, nostalgic 1970s children\'s book aesthetic.',
  },
  lofi: {
    name: 'Lo-fi Anime',
    useReference: true,
    prompt: 'Lo-fi hip hop anime aesthetic illustration. Warm cozy evening lighting, soft purple and orange sunset tones, gentle rain or cherry blossoms falling, peaceful melancholic mood, anime background art style, study girl YouTube channel aesthetic. Relaxing, nostalgic, slightly dreamy.',
  },
  cottagecore: {
    name: 'Cottagecore',
    useReference: true,
    prompt: 'Dreamy cottagecore fairy tale illustration. Romanticized overgrown garden, climbing roses and wisteria, soft dappled sunlight through trees, vintage pastoral aesthetic, slightly ethereal and magical atmosphere, wildflower meadow, butterflies and songbirds. Pinterest-perfect rural fantasy.',
  },
  hologram: {
    name: 'Hologram',
    useReference: true,
    prompt: 'A futuristic holographic interface displaying this house as a 3D wireframe model. Neon cyan and magenta energy beams outlining the architectural form. Floating data symbols and measurement annotations, transparent glowing layers, luminous edges. Set in a dark high-tech command hub with curved display screens. Sci-fi movie aesthetic, Blade Runner vibes.',
  },
  eightbit: {
    name: '8-Bit NES',
    useReference: true,
    prompt: `TRANSFORM this house into retro 8-bit pixel art. DO NOT create a realistic photo.

MANDATORY STYLE - This MUST look like a Nintendo NES video game from 1985:
- LARGE CHUNKY PIXELS (like Minecraft blocks but 2D)
- ONLY 16-25 colors total, no smooth gradients
- BLACK pixel outlines around everything
- Flat colors with dithering patterns for shading
- Simplified blocky shapes - squares and rectangles only

OUTPUT REQUIREMENTS:
- The house should be recognizable but heavily pixelated
- Sky should be a solid color or simple pixel gradient
- Ground/grass as simple green pixel rows
- NO photorealism - this must look like a retro video game sprite
- Think: buildings from Super Mario Bros, Zelda, or Mega Man

Create an 8-bit pixel art sprite of this house, NOT a photograph.`,
  },
  coloringsheet: {
    name: 'Coloring Sheet',
    useReference: true,
    prompt: `Create a coloring book page of this house for children to color in.

MANDATORY STYLE:
- BLACK OUTLINES ONLY on pure white background
- NO filled colors, NO shading, NO gray tones
- Clean, clear line art suitable for a child to color
- Lines should be thick enough for small hands (2-3px weight)
- Simple, friendly style - not too detailed or complex

COMPOSITION:
- The house as the main subject, clearly outlined
- Include some simple landscaping elements (trees, bushes, flowers as outlines)
- Add a simple sun, clouds, or birds as outline shapes
- Maybe a path leading to the house
- Keep shapes simple and easy to color within

This should look like a page from a children's coloring book - pure black line art on white, ready to be colored in with crayons or markers.`,
  },
  crayon: {
    name: 'Crayon Drawing',
    useReference: true,
    prompt: `A child's crayon drawing of this house, like a middle schooler's art project.

Style requirements:
- Drawn with WAX CRAYONS on white construction paper
- Visible waxy crayon texture with uneven color fill
- Wobbly, imperfect hand-drawn lines (not straight)
- Colors slightly outside the lines
- Heavy crayon pressure in some areas, light in others
- Layered crayon strokes visible

Childlike characteristics:
- Simplified shapes and proportions
- Bright, cheerful primary colors (red, blue, yellow, green, orange)
- Sun with rays in the corner
- Fluffy cloud shapes
- Green grass drawn as a strip at the bottom
- Maybe a stick figure family or pet in the yard
- Flowers as simple circles with stems
- Birds as simple "M" shapes in the sky

The drawing should feel authentic - like something a 10-12 year old would proudly bring home from art class. Charming imperfections, not polished.`,
  },
  openarmy: {
    name: 'Open Army',
    useReference: true,
    prompt: `1980s military action figure playset style, like a GI Joe or Army Men headquarters.

Style requirements:
- Molded plastic toy aesthetic with painted details
- Military color palette: tan, olive drab, gray, brown camo patterns
- The house transformed into a covert ops command center or military base
- Detailed accessories: sandbags, camo netting, radar dish, antenna arrays
- Isometric view showing the full base layout

Toy characteristics:
- Visible plastic texture and seams like injection-molded toys
- Hand-painted details with slight imperfections
- Product photography style on clean white background
- Like a vintage 1980s Hasbro toy catalog photo
- Could include a small soldier figure for scale

Make it look like a collectible military playset that a kid in the 80s would have wanted for Christmas.`,
  },
};

// Helper to validate styleId
function isValidStyleId(styleId) {
  return styleId && typeof styleId === 'string' && ALLOWED_STYLES.hasOwnProperty(styleId);
}

// Helper to sanitize address input
function sanitizeAddress(address) {
  if (!address || typeof address !== 'string') return null;
  // Remove any potentially dangerous characters, allow only address-like content
  // Allow: letters (including accented/Polish), numbers, spaces, commas, periods, hashes, hyphens, apostrophes, slashes, ampersands, parentheses
  const sanitized = address.trim().slice(0, 200); // Limit length
  // Use Unicode property escapes for letters (\p{L}) to support Polish addresses
  if (!/^[\p{L}0-9\s,.\-#'\/&()]+$/u.test(sanitized)) {
    return null;
  }

  // Restrict to US and Poland only (business requirement - only monetizable in US, Poland for team testing)
  const upperAddress = sanitized.toUpperCase();
  const isUS = upperAddress.includes('USA') ||
               upperAddress.includes('UNITED STATES') ||
               /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(upperAddress); // US state + zip pattern
  const isPoland = upperAddress.includes('POLAND') ||
                   upperAddress.includes('POLSKA') ||
                   /\b\d{2}-\d{3}\b/.test(sanitized); // Polish postal code pattern (XX-XXX)

  if (!isUS && !isPoland) {
    return null;
  }

  return sanitized;
}

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasStreetViewKey: !!GOOGLE_MAPS_API_KEY,
    hasGoogleAIKey: !!GOOGLE_AI_API_KEY,
    queue: generationQueue.getStatus(),
    cache: {
      streetView: streetViewCache.cache.size,
      aerialView: aerialViewCache.cache.size,
      identity: identityCache.cache.size,
    },
  });
});

/**
 * Clear all caches (for debugging/fixes)
 */
app.post('/api/clear-cache', (req, res) => {
  streetViewCache.cache.clear();
  aerialViewCache.cache.clear();
  identityCache.cache.clear();
  console.log('All caches cleared');
  res.json({ success: true, message: 'All caches cleared' });
});

/**
 * Get generation statistics
 * Returns counts, costs, and breakdown by style
 */
app.get('/api/stats', (req, res) => {
  const stats = getGenerationStats();
  res.json(stats);
});

/**
 * Get Street View metadata for an address
 * Returns pano_id, location, and availability status
 */
app.get('/api/streetview/metadata', async (req, res) => {
  const { address } = req.query;

  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      status: 'MOCK',
      location: { lat: 33.6, lng: -117.7 },
      pano_id: 'mock_pano_id',
    });
  }

  try {
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(sanitizedAddress || address)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(metadataUrl);
    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error('Street View metadata error:', error);
    res.status(500).json({ error: 'Failed to fetch Street View metadata' });
  }
});

/**
 * Get Street View image URL for an address
 * Returns a signed URL or the image directly
 */
app.get('/api/streetview/image', async (req, res) => {
  const { address, size = '640x480', fov = '90', pitch = '10', heading } = req.query;

  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    // Return a placeholder image URL for mock mode
    return res.json({
      url: `https://via.placeholder.com/640x480/f5f5f5/666?text=Street+View+Mock`,
      mock: true,
    });
  }

  try {
    const params = new URLSearchParams({
      location: sanitizedAddress,
      size,
      fov,
      pitch,
      key: GOOGLE_MAPS_API_KEY,
    });

    if (heading) {
      params.append('heading', heading);
    }

    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;

    res.json({ url: imageUrl, mock: false });
  } catch (error) {
    console.error('Street View image error:', error);
    res.status(500).json({ error: 'Failed to generate Street View URL' });
  }
});

/**
 * Fetch Street View image and return as base64
 * This is useful for passing to vision models
 */
app.get('/api/streetview/fetch', async (req, res) => {
  const { address, size = '640x480' } = req.query;

  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      base64: null,
      mock: true,
      message: 'Street View API key not configured',
    });
  }

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(sanitizedAddress || address)}&size=${size}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Street View fetch failed: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    res.json({
      base64,
      mimeType,
      mock: false,
    });
  } catch (error) {
    console.error('Street View fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch Street View image' });
  }
});

/**
 * Analyze a property image using Gemini Vision
 * Returns a semantic description suitable for image generation
 */
app.post('/api/vision/analyze', async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;

  if (!genAI) {
    // Return mock analysis when API key not available
    return res.json({
      description: 'A grand two-story Mediterranean-style suburban home with a warm-toned stucco exterior and a distinct red clay terracotta tile roof. Features a large, manicured front lawn with a stone-paved curved walkway. Large windows with dark frames and a multi-car garage.',
      mock: true,
    });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Analyze this Street View image of a residential property and generate a detailed semantic description suitable for AI image generation.

Focus on:
1. Architectural style (e.g., Mediterranean, Colonial, Modern, Victorian, Ranch)
2. Exterior materials and colors (stucco, brick, siding, etc.)
3. Roof style and materials (tile, shingle, flat, etc.)
4. Landscaping features (lawn, trees, hedges, flowers)
5. Driveway and walkway materials
6. Notable features (pool, garage, porch, balcony)
7. Window and door styles
8. Overall scale and proportions

Output ONLY a single paragraph (2-4 sentences) describing the property. Be specific about materials, colors, and distinctive features. Do not include any preamble or explanation.`;

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const description = response.text().trim();

    res.json({
      description,
      mock: false,
    });
  } catch (error) {
    console.error('Vision analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze image' });
  }
});

/**
 * Generate a diorama image using Imagen 3
 * DISABLED: This endpoint previously accepted raw prompts which is a security risk.
 * Use /api/generate-v2 with a valid styleId instead.
 */
app.post('/api/imagen/generate', (req, res) => {
  return res.status(410).json({
    error: 'This endpoint has been disabled for security reasons.',
    message: 'Please use /api/generate-v2 with a valid styleId parameter.',
    availableStyles: Object.keys(ALLOWED_STYLES),
  });
});

/**
 * Fallback image generation using Gemini's native capabilities
 */
async function generateWithGemini(prompt, res) {
  if (!genAI) {
    return res.json({
      imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      mock: true,
    });
  }

  try {
    // Try using Gemini 2.0 Flash with image generation
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseModalities: ['image', 'text'],
      },
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check if we got an image in the response
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return res.json({
          imageBase64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
          mock: false,
          model: 'gemini-2.5-flash',
        });
      }
    }

    throw new Error('No image in Gemini response');
  } catch (error) {
    console.error('Gemini image generation error:', error);
    throw error;
  }
}

/**
 * Fetch aerial/satellite view image
 */
app.get('/api/aerialview/fetch', async (req, res) => {
  const { address, size = '640x640', zoom = '19' } = req.query;

  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      base64: null,
      mock: true,
      message: 'Maps API key not configured',
    });
  }

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(sanitizedAddress || address)}&zoom=${zoom}&size=${size}&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Aerial view fetch failed: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';

    res.json({
      base64,
      mimeType,
      mock: false,
    });
  } catch (error) {
    console.error('Aerial view fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch aerial view image' });
  }
});

/**
 * Complete pipeline: Address → Street View + Aerial View → Vision → Image Generation
 * SECURED: Now requires styleId from allowlist instead of raw stylePrompt
 */
app.post('/api/generate', async (req, res) => {
  const { address, styleId } = req.body;

  // Validate styleId against allowlist
  if (!isValidStyleId(styleId)) {
    return res.status(400).json({
      error: 'Invalid or missing styleId',
      availableStyles: Object.keys(ALLOWED_STYLES),
    });
  }

  // Sanitize address
  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  // Get the style prompt from server-side allowlist (cannot be overridden)
  const styleConfig = ALLOWED_STYLES[styleId];
  let stylePrompt = styleConfig.prompt;

  // Extract location from address for location-aware styles (e.g., travel poster)
  const addressParts = sanitizedAddress.split(',').map(p => p.trim());
  let location = 'this destination';
  if (addressParts.length >= 2) {
    const stateZipPart = addressParts[addressParts.length - 2];
    const stateMatch = stateZipPart.match(/^([A-Z]{2})\s*\d{5}/);
    if (stateMatch) {
      const stateNames = {
        AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
        CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
        HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
        KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
        MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
        MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
        NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
        OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
        SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
        VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
        DC: 'Washington DC'
      };
      location = stateNames[stateMatch[1]] || stateMatch[1];
    } else {
      location = addressParts[addressParts.length - 3] || addressParts[0];
    }
  }
  stylePrompt = stylePrompt.replace('[LOCATION]', location);

  try {
    // Step 1: Fetch Street View and Aerial View images in parallel
    let streetViewBase64 = null;
    let aerialViewBase64 = null;
    let streetViewUrl = null;
    let aerialViewUrl = null;

    if (GOOGLE_MAPS_API_KEY) {
      // Fetch street view
      const svResponse = await fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(sanitizedAddress || address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`);
      if (svResponse.ok) {
        const svBuffer = await svResponse.buffer();
        streetViewBase64 = svBuffer.toString('base64');
        streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(sanitizedAddress || address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`;
      }

      // Try to fetch aerial view (may fail if Maps Static API not enabled)
      try {
        const avResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(sanitizedAddress || address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`);
        if (avResponse.ok) {
          const avBuffer = await avResponse.buffer();
          aerialViewBase64 = avBuffer.toString('base64');
          aerialViewUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(sanitizedAddress || address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
        } else {
          console.log('Aerial view not available (Maps Static API may not be enabled), using street view only');
        }
      } catch (avError) {
        console.log('Aerial view fetch failed, continuing with street view only:', avError.message);
      }
    }

    // Step 2: Analyze BOTH images SEPARATELY with dedicated structured prompts
    let semanticDescription = 'A suburban home with typical American architecture.';

    if (genAI && streetViewBase64 && aerialViewBase64) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // === STREET VIEW PROMPT - Focus on what's visible from the street ===
      const streetViewPrompt = `You are a real estate architecture expert analyzing a STREET VIEW image. Extract PRECISE STRUCTURAL DATA - count everything, position everything. NO guessing.

Use spatial directions as if FACING THE HOUSE FROM THE STREET (left/right means viewer's left/right).

STRUCTURE (count and measure):
- Stories: [exact count: 1, 1.5, 2, 2.5, 3]
- Architectural style: [specific name]
- Exterior wall material: [stucco, brick, siding, stone, combination]
- Wall color: [be EXTREMELY SPECIFIC: warm beige #D4C4A8, cream, ivory, taupe - NEVER generic "white" or "tan"]
- Trim color: [specific color]

ROOF (count visible elements):
- Shape: [gable, hip, flat, combination, mansard]
- Number of roof peaks/gables visible: [count]
- Number of dormers: [count and position]
- Eaves style: [exposed rafters, boxed, decorative brackets]
- Material and color: [terracotta tile, concrete tile, asphalt shingle + color]
- Chimneys: [count and position]

WINDOWS (COUNT PRECISELY):
- Total windows visible on front facade: [exact count]
- Ground floor windows: [count] - arrangement: [e.g., "2 left of door, 1 right"]
- Second floor windows: [count] - arrangement: [e.g., "3 evenly spaced"]
- Window style: [arched, rectangular, bay - note which windows]
- Frame color: [white, black, bronze]
- Shutters: [yes/no, count, color]

ENTRYWAY (be exact):
- Door position on facade: [center, left of center, right of center, far left, far right]
- Door type: [single, double, with sidelights, with transom window]
- Door color: [specific color]
- Porch: [none, small covered, portico with columns, full-width porch]
- Columns/pillars: [count, style - round, square, tapered]
- Steps to entry: [count]

GARAGE (count everything):
- Position: [attached left, attached right, front-facing center, setback, detached, not visible]
- Number of garage doors: [1, 2, 3]
- Door style: [paneled, with windows, carriage style]
- Garage door color: [specific color]

DRIVEWAY:
- Position: [approaches from left, right, center]
- Material: [concrete, asphalt, pavers, gravel]
- Shape: [straight, curved, Y-shaped, circular]
- Width: [single car, double car, wide]

LANDSCAPING (positions matter):
- Trees: [count] - positions: [e.g., "1 tall palm front-left, 2 small ornamental front-right"]
- Foundation plantings: [yes/no, description]
- Hedges: [position - e.g., "along left property line"]
- Lawn size: [small, medium, large front yard]

OUTPUT: Write 4-5 detailed sentences with EXACT COUNTS and POSITIONS. Start with: "[count] story [style] with [count] windows..." Be precise - this will be used to recreate the structure exactly.`;

      // === AERIAL VIEW PROMPT - Focus on what's visible from above ===
      const aerialViewPrompt = `You are a real estate architecture expert analyzing an AERIAL/SATELLITE image of a residential property. Describe ONLY what you can see from this bird's-eye perspective.

CRITICAL: Focus ONLY on the TARGET PROPERTY (the one with the house centered in the image). IGNORE all neighboring properties and their features. If you see a pool on an adjacent lot, do NOT mention it - it belongs to the neighbors, not this property.

Use spatial directions as if FACING THE HOUSE FROM THE STREET (top of image = backyard, bottom = street, left/right = viewer's left/right when facing house).

ROOF (from above):
- Complete roof shape and complexity (L-shaped, U-shaped, simple rectangle, etc.)
- Roof color from above
- Any skylights, solar panels, chimneys (with positions)
- Multiple roof sections or height levels

STEP 1 - IDENTIFY PROPERTY BOUNDARIES:
- Locate the lot lines/fences that define THIS property's boundaries
- Note where the property ends and neighbors begin (look for fence lines, hedge rows, or visible lot divisions)
- Identify front yard (between house and street), side yards (left/right of house), and backyard (behind house)

STEP 2 - LOT SHAPE & DIMENSIONS:
- Overall lot shape (rectangular, corner lot, pie-shaped, irregular)
- Approximate lot proportions (wide/narrow, deep/shallow)
- House position on lot (centered, offset toward front/back/left/right)

STEP 3 - DRIVEWAY LAYOUT:
- Full driveway path from street to garage
- Driveway shape (straight, curved, circular, Y-shaped)
- Parking areas or widened sections
- Position relative to house (along left side, along right side, center approach)

STEP 4 - POOL DETECTION (CRITICAL - BE PRECISE):
First, answer: Is there a pool WITHIN this property's boundaries? YES or NO.
- If NO: State "No pool on this property" and move on. Do NOT imagine or add a pool.
- If YES: Describe its EXACT position on the lot (e.g., "pool in backyard, center-left, about 15 feet from back fence"). Pools are typically in backyards or side yards, never in front yards.
- IGNORE any pools visible near lot edges or on neighboring properties - these belong to neighbors.

BACKYARD FEATURES (besides pool):
- Covered patio or pergola structures (position and size)
- Outdoor kitchen, fire pit, or built-in features
- Patio/deck areas and hardscape

BACKYARD LANDSCAPING:
- Lawn areas vs. hardscape ratio
- Trees with EXACT positions (e.g., "large tree back-left corner", "row of trees along back fence", "palm trees along right side")
- Garden beds or planting areas
- Any outbuildings (shed, gazebo, pool house) with positions

FENCING & BOUNDARIES:
- Fence type visible (wood, block wall, wrought iron, vinyl)
- Which sides have fencing
- Any gates or openings

NEIGHBORING CONTEXT:
- Relationship to neighboring properties
- Street orientation

OUTPUT: Write 4-5 detailed sentences describing the property from above. You MUST explicitly state whether this property has a pool (YES with exact location, or NO). If no pool exists on this property, do not mention pools at all. If a pool exists, describe its exact position on the lot - do not relocate it. Ignore any pools on neighboring properties.`;

      // Run BOTH analyses in PARALLEL for speed
      const streetViewPart = {
        inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' },
      };
      const aerialViewPart = {
        inlineData: { data: aerialViewBase64, mimeType: 'image/png' },
      };

      const [streetResult, aerialResult] = await Promise.all([
        model.generateContent([streetViewPrompt, streetViewPart]),
        model.generateContent([aerialViewPrompt, aerialViewPart]),
      ]);

      const streetDescription = (await streetResult.response).text().trim();
      const aerialDescription = (await aerialResult.response).text().trim();

      // === CHECK FOR BLURRED/UNIDENTIFIABLE IMAGERY ===
      const blurIndicators = [
        'impossible to determine',
        'extreme blurring',
        'extremely blurred',
        'cannot identify',
        'cannot be identified',
        'completely obscured',
        'not possible to identify',
        'impossible to extract',
        'impossible to provide',
        'privacy blur',
        'blurred out',
      ];
      const streetDescLower = streetDescription.toLowerCase();
      const isBlurred = blurIndicators.some(indicator => streetDescLower.includes(indicator));

      if (isBlurred) {
        console.log('⚠️ Street View imagery is blurred/obscured - returning famous home fallback');
        const fallback = getRandomFamousHomeFallback(styleId);
        if (fallback) {
          const imageBase64 = fs.readFileSync(fallback.imagePath).toString('base64');
          return res.json({
            success: true,
            generatedImage: { base64: imageBase64, mimeType: 'image/png' },
            message: `This address has privacy-blurred Street View imagery. Here's the ${fallback.home.name} in ${fallback.home.location} instead!`,
            fallbackHome: fallback.home,
            address: parsedAddress,
            style: styleId,
            styleName,
            model: 'fallback',
            blurredAddress: true,
          });
        }
      }

      // === COMBINE both descriptions into a comprehensive prompt ===
      const combinePrompt = `You are creating a SINGLE comprehensive property description for an AI image generator by combining two expert analyses.

STREET VIEW ANALYSIS (front facade details):
${streetDescription}

AERIAL VIEW ANALYSIS (lot layout and backyard):
${aerialDescription}

TASK: Merge these into ONE cohesive, detailed paragraph (6-8 sentences) that includes ALL specific details from BOTH analyses:
- Start with architectural style and facade details from street view
- Include exact colors, materials, window styles, garage position
- Incorporate lot shape, driveway path, and landscaping positions
- Include tree positions from BOTH views
- Use consistent spatial language (left/right when facing house from street, front/back)

POOL RULE (STRICT):
- If the aerial analysis says "No pool on this property" or doesn't mention a pool: DO NOT include a pool. Never imagine or add one.
- If the aerial analysis describes a pool with a specific location: Include it at that EXACT position. Do not move or relocate the pool.
- Pools are only in backyards or side yards, never front yards.

The output must be detailed enough for an AI to recreate THIS EXACT property with precise element placement. Do not omit any specific details from either analysis.`;

      const combineResult = await model.generateContent(combinePrompt);
      semanticDescription = (await combineResult.response).text().trim();

      // Log for debugging
      console.log('\n=== STREET VIEW DESCRIPTION ===');
      console.log(streetDescription);
      console.log('\n=== AERIAL VIEW DESCRIPTION ===');
      console.log(aerialDescription);
      console.log('\n=== COMBINED DESCRIPTION ===');
      console.log(semanticDescription);
      console.log('===============================\n');

    } else if (genAI && streetViewBase64) {
      // Fallback to street view only if aerial not available
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const visionPrompt = `You are a real estate architecture expert. Extract PRECISE STRUCTURAL DATA from this Street View image. COUNT everything, POSITION everything. NO guessing or imagination.

EXTRACT WITH EXACT COUNTS:
- Stories: [1, 1.5, 2, 2.5, or 3]
- Architectural style: [specific name]
- Wall color: [specific shade - beige, cream, tan, NOT generic "white"]
- Roof: [shape, color, number of gables/peaks visible]
- Windows: [total count on front facade, arrangement per floor]
- Entryway: [door position, porch type, column count if any]
- Garage: [position (left/right/center), door count (1/2/3)]
- Driveway: [position, material if visible]
- Trees: [count and positions - e.g., "2 palms front-left, 1 oak front-right"]
- Pool: ONLY if clearly visible in backyard/side yard. If no pool visible, state "no pool". Never in front yards.

OUTPUT: One detailed paragraph (4-5 sentences) starting with exact counts: "[X]-story [style] with [Y] windows..." Include ALL structural elements with positions. This will be used to recreate the exact structure - precision is critical.`;

      const imagePart = {
        inlineData: {
          data: streetViewBase64,
          mimeType: 'image/jpeg',
        },
      };

      const result = await model.generateContent([visionPrompt, imagePart]);
      semanticDescription = (await result.response).text().trim();
    }

    // Step 3: Generate diorama image
    const fullPrompt = stylePrompt.replace('[SEMANTIC_DESCRIPTION]', semanticDescription);

    let generatedImage = null;
    let mock = true;

    if (GOOGLE_AI_API_KEY) {
      // Try Imagen 3 first
      try {
        const imagenResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [{ prompt: fullPrompt }],
              parameters: {
                sampleCount: 1,
                aspectRatio: '1:1',
                safetyFilterLevel: 'block_only_high',
              },
            }),
          }
        );

        if (imagenResponse.ok) {
          const data = await imagenResponse.json();
          if (data.predictions?.[0]?.bytesBase64Encoded) {
            generatedImage = {
              base64: data.predictions[0].bytesBase64Encoded,
              mimeType: 'image/png',
            };
            mock = false;
          }
        }
      } catch (e) {
        console.log('Imagen failed, trying Gemini fallback');
      }

      // Fallback to Gemini 2.0 Flash if Imagen fails
      if (!generatedImage) {
        try {
          const geminiModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseModalities: ['image', 'text'] },
          });

          const result = await geminiModel.generateContent(fullPrompt);
          const response = await result.response;

          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              generatedImage = {
                base64: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/png',
              };
              mock = false;
              break;
            }
          }
        } catch (e) {
          console.log('Gemini image generation also failed');
        }
      }
    }

    res.json({
      success: true,
      streetViewUrl,
      aerialViewUrl,
      semanticDescription,
      prompt: fullPrompt,
      generatedImage,
      mock,
    });
  } catch (error) {
    console.error('Generation pipeline error:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});

/**
 * V2 Generation Pipeline: Identity + Reference Approach
 * SECURED: Now requires styleId from allowlist instead of raw stylePrompt
 *
 * This approach:
 * 1. Extracts house "identity" (key recognizable features)
 * 2. For most styles: passes identity + reference images for detail anchoring
 * 3. For color-transformation styles: passes identity only for creative freedom
 * 4. Uses Gemini 2.5 Flash Image (Nano Banana) for generation
 */
app.post('/api/generate-v2', generationLimiter, async (req, res) => {
  const startTime = Date.now();
  const { address, styleId } = req.body;
  const cachedResources = { streetView: false, aerial: false, identity: false };

  // Validate styleId against allowlist
  if (!isValidStyleId(styleId)) {
    return res.status(400).json({
      error: 'Invalid or missing styleId',
      availableStyles: Object.keys(ALLOWED_STYLES),
    });
  }

  // Sanitize address
  const sanitizedAddress = sanitizeAddress(address);
  if (!sanitizedAddress) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  // Get style config from server-side allowlist (cannot be overridden)
  const styleConfig = ALLOWED_STYLES[styleId];
  let stylePrompt = styleConfig.prompt;
  const useReference = styleConfig.useReference;

  // Extract location (state/country) from address for location-aware styles like travel poster
  // Address format is typically: "123 Main St, City, ST 12345, USA"
  const addressParts = sanitizedAddress.split(',').map(p => p.trim());
  let location = 'this destination';
  if (addressParts.length >= 2) {
    // Try to get state from "ST 12345" part (second to last, before country)
    const stateZipPart = addressParts[addressParts.length - 2];
    const stateMatch = stateZipPart.match(/^([A-Z]{2})\s*\d{5}/);
    if (stateMatch) {
      // Map state abbreviations to full names for nicer poster text
      const stateNames = {
        AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
        CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
        HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
        KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
        MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
        MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
        NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
        OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
        SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
        VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
        DC: 'Washington DC'
      };
      location = stateNames[stateMatch[1]] || stateMatch[1];
    } else {
      // Fallback: use city name
      location = addressParts[addressParts.length - 3] || addressParts[0];
    }
  }
  stylePrompt = stylePrompt.replace('[LOCATION]', location);

  // Normalize address for cache key
  const cacheKey = sanitizedAddress.toLowerCase().trim();

  try {
    // Step 0: Check Street View availability FIRST
    if (GOOGLE_MAPS_API_KEY) {
      const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(sanitizedAddress || address)}&key=${GOOGLE_MAPS_API_KEY}`;
      const metadataRes = await fetch(metadataUrl);
      const metadata = await metadataRes.json();

      if (metadata.status !== 'OK') {
        // No Street View coverage - return fallback famous home
        console.log(`No Street View for "${sanitizedAddress}" - status: ${metadata.status}`);

        const fallback = getRandomFamousHomeFallback(styleId);
        if (fallback) {
          const imageBase64 = fs.readFileSync(fallback.imagePath).toString('base64');
          return res.status(200).json({
            success: true,
            noStreetView: true,
            message: `Google Street View is not available for this address. Here's the ${fallback.home.name} in ${fallback.home.location} instead!`,
            fallbackHome: fallback.home,
            generatedImage: {
              base64: imageBase64,
              mimeType: 'image/png',
            },
            model: 'fallback',
          });
        } else {
          return res.status(400).json({
            error: 'Google Street View is not available for this address.',
            noStreetView: true,
          });
        }
      }
    }

    // Step 1: Fetch Street View and Aerial View images (with caching)
    let streetViewBase64 = streetViewCache.get(cacheKey);
    let aerialViewBase64 = aerialViewCache.get(cacheKey);
    cachedResources.streetView = !!streetViewBase64;
    cachedResources.aerial = !!aerialViewBase64;

    if (GOOGLE_MAPS_API_KEY && (!streetViewBase64 || !aerialViewBase64)) {
      const fetchPromises = [];

      if (!streetViewBase64) {
        fetchPromises.push(
          fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(sanitizedAddress || address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`)
            .then(async (r) => {
              if (r.ok) {
                const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                streetViewCache.set(cacheKey, b64);
                return b64;
              }
              return null;
            })
        );
      }

      if (!aerialViewBase64) {
        fetchPromises.push(
          fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(sanitizedAddress || address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`)
            .then(async (r) => {
              if (r.ok) {
                const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
                aerialViewCache.set(cacheKey, b64);
                return b64;
              }
              return null;
            })
        );
      }

      const results = await Promise.all(fetchPromises);

      // Assign results based on what we fetched
      if (!streetViewBase64) streetViewBase64 = results.shift();
      if (!aerialViewBase64) aerialViewBase64 = results.shift();
    }

    if (!streetViewBase64) {
      return res.status(400).json({ error: 'Could not fetch street view image' });
    }

    // Step 2: Extract House Identity (with caching)
    let identity = identityCache.get(cacheKey);
    cachedResources.identity = !!identity;

    if (!identity && genAI) {
      const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const identityPrompt = `Extract this house's PRECISE STRUCTURAL IDENTITY. Be extremely specific - count everything, note exact positions. NO imagination or assumptions.

=== HOUSE IDENTITY CARD ===

**COLORS** (be precise):
- Walls: [exact shade + hex approximation]
- Roof: [exact shade + hex approximation]
- Trim/accents: [colors]
- Garage doors: [color]
- Front door: [color]

**STRUCTURE** (count and measure):
- Stories: [exact count: 1, 1.5, 2, 2.5, 3]
- Architectural style: [specific name]
- Roof type: [hip, gable, flat, mansard, gambrel, combination - describe each section]
- Number of roof peaks/gables visible from front: [count]
- Chimneys: [count and position]

**WINDOWS** (count precisely):
- Total windows visible on front facade: [count]
- Window arrangement per floor: [e.g., "ground floor: 2 left of door, 1 right; second floor: 3 evenly spaced"]
- Window styles: [arched, rectangular, bay, dormer - note which and where]
- Shutters: [yes/no, color if yes]

**ENTRYWAY**:
- Door position: [center, left of center, right of center, far left, far right]
- Door style: [single, double, with sidelights, with transom]
- Porch type: [none, covered porch, portico, full-width porch, wraparound]
- Columns/pillars: [count, style - round, square, tapered]
- Steps: [count if visible]

**GARAGE**:
- Position: [left side, right side, center, detached, not visible]
- Doors: [count: 1, 2, 3]
- Door style: [paneled, windows on top, carriage style]

**DRIVEWAY**:
- Position: [left side, right side, center, circular]
- Material if visible: [concrete, asphalt, pavers, gravel]
- Shape: [straight, curved, Y-shaped, circular]

**LANDSCAPING** (positions matter):
- Trees: [count and position - e.g., "1 large oak front-left, 2 small trees front-right"]
- Shrubs/hedges: [position - e.g., "foundation plantings across front", "hedges along left side"]
- Lawn areas: [front yard size estimate - small, medium, large]

**FROM AERIAL** (if aerial image provided):
- Pool: [YES with exact position on lot (e.g., "backyard, center-left, kidney-shaped") OR NO - be definitive]
- Patio/deck: [position and approximate size]
- Backyard trees: [count and positions]
- Fencing: [type and which sides]

**DISTINCTIVE FEATURES** (what makes THIS house unique):
1. [most recognizable feature]
2. [second]
3. [third]

**ONE-SENTENCE IDENTITY**:
[A single sentence capturing this house's essence that would make the owner say "that's MY house!"]

CRITICAL: Count everything. Position everything. Do NOT guess or assume - if you can't see it clearly, say "not visible". The goal is ZERO imagination at the structural level.`;

      const imageParts = [{ inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } }];
      if (aerialViewBase64) {
        imageParts.push({ inlineData: { data: aerialViewBase64, mimeType: 'image/png' } });
      }

      const identityResult = await visionModel.generateContent([identityPrompt, ...imageParts]);
      identity = (await identityResult.response).text().trim();

      // Cache the identity for future requests
      identityCache.set(cacheKey, identity);

      console.log('\n=== HOUSE IDENTITY ===');
      console.log(identity);
      console.log('======================\n');
    } else if (!identity) {
      identity = 'A suburban home with typical American architecture.';
    }

    // Step 3: Generate with Gemini 2.5 Flash Image (Nano Banana) - via queue
    const { generatedImage, mock } = await generationQueue.add(async () => {
      let generatedImage = null;
      let mock = true;

      if (genAI) {
        const imageModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash-image',
          generationConfig: { responseModalities: ['image', 'text'] },
        });

      // Build the generation prompt
      const generationPrompt = useReference
        ? `Create a ${stylePrompt}

I'm providing:
1. TWO REFERENCE PHOTOS of the actual house (street view and aerial)
2. The house's IDENTITY CARD with its distinctive features

Use the photos to see the EXACT details. Use the identity card to know what features MUST be captured.

=== HOUSE IDENTITY ===
${identity}
=== END IDENTITY ===

YOUR TASK:
- Study the reference photos carefully
- Create the house in the specified style
- The result must be UNMISTAKABLY this specific house
- All signature features from the identity card must be visible
- The owner should immediately recognize their home

POOL RULE (STRICT):
- If the identity says "no pool" or doesn't mention a pool: DO NOT add a pool under any circumstances.
- If the identity describes a pool: Place it at the EXACT position specified (e.g., "backyard center-left"). Do not move or relocate it.
- Pools are ONLY in backyards or side yards. NEVER place a pool in the front yard.

Generate now.`
        : `${stylePrompt}

=== HOUSE IDENTITY (follow this EXACTLY) ===
${identity}
=== END IDENTITY ===

Create this house based on the identity description above. Every architectural feature must match. The owner must immediately recognize their home.

POOL RULE (STRICT):
- If the identity says "no pool" or doesn't mention a pool: DO NOT add a pool under any circumstances.
- If the identity describes a pool: Place it at the EXACT position specified (e.g., "backyard center-left"). Do not move or relocate it.
- Pools are ONLY in backyards or side yards. NEVER place a pool in the front yard.

Generate now.`;

      try {
        let result;
        if (useReference && streetViewBase64) {
          const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
          const parts = [generationPrompt, svPart];
          if (aerialViewBase64) {
            parts.push({ inlineData: { data: aerialViewBase64, mimeType: 'image/png' } });
          }
          result = await imageModel.generateContent(parts);
        } else {
          result = await imageModel.generateContent(generationPrompt);
        }

        const response = await result.response;
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImage = {
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'image/png',
            };
            mock = false;
            break;
          }
        }
      } catch (genError) {
        console.error('Gemini 2.5 Flash Image generation error:', genError.message);

        // Fallback to older model if 2.5 not available
        try {
          const fallbackModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseModalities: ['image', 'text'] },
          });

          const fallbackResult = await fallbackModel.generateContent(
            useReference && streetViewBase64
              ? [generationPrompt, { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } }]
              : generationPrompt
          );

          const fallbackResponse = await fallbackResult.response;
          for (const part of fallbackResponse.candidates[0].content.parts) {
            if (part.inlineData) {
              generatedImage = {
                base64: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/png',
              };
              mock = false;
              break;
            }
          }
        } catch (fallbackError) {
          console.error('Fallback generation also failed:', fallbackError.message);
        }
      }
      }

      return { generatedImage, mock };
    });

    // Log successful generation
    logGeneration({
      address: sanitizedAddress,
      styleId,
      success: true,
      durationMs: Date.now() - startTime,
      cached: cachedResources,
    });

    res.json({
      success: true,
      identity,
      generatedImage,
      mock,
      model: 'gemini-2.5-flash-image',
    });
  } catch (error) {
    console.error('V2 Generation pipeline error:', error);

    // Log failed generation
    logGeneration({
      address: sanitizedAddress || address,
      styleId,
      success: false,
      durationMs: Date.now() - startTime,
      error: error.message,
      cached: cachedResources,
    });

    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});

/**
 * Email capture endpoint
 * Saves leads to a simple JSON Lines file
 */
const LEADS_FILE = path.join(process.cwd(), 'leads.jsonl');

app.post('/api/capture-email', (req, res) => {
  const { email, address, timestamp } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const lead = {
    email: email.trim().toLowerCase(),
    address: address || '',
    timestamp: timestamp || new Date().toISOString(),
    source: 'diorama-generator',
  };

  // Append to JSONL file (one JSON object per line)
  fs.appendFile(LEADS_FILE, JSON.stringify(lead) + '\n', (err) => {
    if (err) {
      console.error('Failed to save lead:', err);
      return res.status(500).json({ error: 'Failed to save' });
    }
    console.log(`📧 Lead captured: ${email}`);
    res.json({ success: true });
  });
});

// SPA fallback - serve index.html for all non-API routes (must be after API routes)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run: npm run build');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🏠 Diorama Generator API Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Street View: ${GOOGLE_MAPS_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Google AI: ${GOOGLE_AI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Frontend: ${fs.existsSync(distPath) ? '✅ Built' : '⚠️  Not built (run npm run build)'}\n`);
});
