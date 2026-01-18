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
 * Get Street View metadata for an address
 * Returns pano_id, location, and availability status
 */
app.get('/api/streetview/metadata', async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      status: 'MOCK',
      location: { lat: 33.6, lng: -117.7 },
      pano_id: 'mock_pano_id',
    });
  }

  try {
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
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

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
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
      location: address,
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

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      base64: null,
      mock: true,
      message: 'Street View API key not configured',
    });
  }

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=${size}&key=${GOOGLE_MAPS_API_KEY}`;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
 */
app.post('/api/imagen/generate', async (req, res) => {
  const { prompt, aspectRatio = '1:1' } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!GOOGLE_AI_API_KEY) {
    // Return mock image for testing
    return res.json({
      imageUrl: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      mock: true,
    });
  }

  try {
    // Use Imagen 3 via the Generative AI API
    // Note: Imagen 3 access requires specific API enablement
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            safetyFilterLevel: 'block_only_high',
            personGeneration: 'dont_allow',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imagen API error:', errorText);

      // Fallback to Gemini image generation if Imagen not available
      return await generateWithGemini(prompt, res);
    }

    const data = await response.json();

    if (data.predictions && data.predictions[0]) {
      const imageData = data.predictions[0].bytesBase64Encoded;
      res.json({
        imageBase64: imageData,
        mimeType: 'image/png',
        mock: false,
      });
    } else {
      throw new Error('No image generated');
    }
  } catch (error) {
    console.error('Imagen generation error:', error);

    // Try Gemini as fallback
    try {
      return await generateWithGemini(prompt, res);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  }
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
      model: 'gemini-2.0-flash-exp',
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
          model: 'gemini-2.0-flash-exp',
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

  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.json({
      base64: null,
      mock: true,
      message: 'Maps API key not configured',
    });
  }

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=${zoom}&size=${size}&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
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
 */
app.post('/api/generate', async (req, res) => {
  const { address, stylePrompt } = req.body;

  if (!address || !stylePrompt) {
    return res.status(400).json({ error: 'Address and stylePrompt are required' });
  }

  try {
    // Step 1: Fetch Street View and Aerial View images in parallel
    let streetViewBase64 = null;
    let aerialViewBase64 = null;
    let streetViewUrl = null;
    let aerialViewUrl = null;

    if (GOOGLE_MAPS_API_KEY) {
      // Fetch street view
      const svResponse = await fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`);
      if (svResponse.ok) {
        const svBuffer = await svResponse.buffer();
        streetViewBase64 = svBuffer.toString('base64');
        streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`;
      }

      // Try to fetch aerial view (may fail if Maps Static API not enabled)
      try {
        const avResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`);
        if (avResponse.ok) {
          const avBuffer = await avResponse.buffer();
          aerialViewBase64 = avBuffer.toString('base64');
          aerialViewUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;
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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // === STREET VIEW PROMPT - Focus on what's visible from the street ===
      const streetViewPrompt = `You are a real estate architecture expert analyzing a STREET VIEW image of a residential property. Describe ONLY what you can see from this front-facing perspective.

Use spatial directions as if FACING THE HOUSE FROM THE STREET (left/right means viewer's left/right).

ARCHITECTURAL STYLE & FACADE:
- Style name (Mediterranean, Craftsman, Colonial, Ranch, Contemporary, Spanish Revival, etc.)
- Number of stories and height variations between sections
- Exterior wall color (be EXTREMELY SPECIFIC: warm beige, cream, ivory, taupe, terracotta, sage green - NEVER generic "white" or "tan")
- Trim color, accent colors, any contrasting elements

ROOF (visible portions):
- Shape (gable, hip, flat, combination, mansard)
- Material and color (terracotta clay tile, concrete tile, gray asphalt shingle, wood shake, etc.)
- Visible dormers, eaves, exposed rafters, decorative brackets

WINDOWS:
- Style (arched top, rectangular, bay window, picture window)
- Grid pattern (divided lite, single pane, colonial grids)
- Frame color (white, black, bronze, natural wood)
- Approximate count and arrangement on facade
- Any shutters (color and style)

FRONT DOOR & ENTRY:
- Door style and color
- Entry features (covered porch, portico, columns, steps)
- Position on facade (centered, offset left, offset right)

GARAGE:
- Position relative to house (attached left, attached right, front-facing, set back)
- Number of garage doors
- Door style and color
- Windows on garage doors (yes/no, style if present)

DRIVEWAY & WALKWAYS:
- Driveway approach direction (from left, from right, from center)
- Material and color (light gray concrete, tan pavers, brick, stamped concrete)
- Walkway to front door (material, path)
- Any entry pillars, columns, or gates (describe position)

FRONT YARD LANDSCAPING:
- Lawn condition and coverage
- Trees with EXACT positions (e.g., "tall palm tree at front-left corner", "mature oak front-right of driveway")
- Hedges and shrubs with positions (e.g., "low boxwood hedge along foundation", "tall hedges along left property line")
- Flower beds, decorative rocks, or garden features
- Fencing visible (type, color, position: "white vinyl fence along left side")

OUTPUT: Write 4-5 detailed sentences describing the front facade, starting with architectural style, then systematically covering each visible element with precise spatial positions.`;

      // === AERIAL VIEW PROMPT - Focus on what's visible from above ===
      const aerialViewPrompt = `You are a real estate architecture expert analyzing an AERIAL/SATELLITE image of a residential property. Describe ONLY what you can see from this bird's-eye perspective.

Use spatial directions as if FACING THE HOUSE FROM THE STREET (top of image = backyard, bottom = street, left/right = viewer's left/right when facing house).

ROOF (from above):
- Complete roof shape and complexity (L-shaped, U-shaped, simple rectangle, etc.)
- Roof color from above
- Any skylights, solar panels, chimneys (with positions)
- Multiple roof sections or height levels

LOT SHAPE & DIMENSIONS:
- Overall lot shape (rectangular, corner lot, pie-shaped, irregular)
- Approximate lot proportions (wide/narrow, deep/shallow)
- House position on lot (centered, offset toward front/back/left/right)

DRIVEWAY LAYOUT:
- Full driveway path from street to garage
- Driveway shape (straight, curved, circular, Y-shaped)
- Parking areas or widened sections
- Position relative to house (along left side, along right side, center approach)

BACKYARD FEATURES:
- Pool: EXACT shape (rectangular, kidney, freeform, L-shaped) and EXACT position (back-center, back-left corner, back-right corner, along left side)
- Pool deck/patio material and extent
- Covered patio or pergola structures (position and size)
- Outdoor kitchen, fire pit, or built-in features

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

OUTPUT: Write 4-5 detailed sentences describing the property from above, focusing on lot layout, backyard features, pool position, and landscaping with precise spatial positions.`;

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
- Include pool shape AND exact position from aerial view
- Include tree positions from BOTH views
- Use consistent spatial language (left/right when facing house from street, front/back)

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const visionPrompt = `You are a real estate architecture expert. Analyze this Street View image with EXTREME PRECISION for an AI image generator. Describe from the perspective of someone FACING THE HOUSE from the street.

Describe EXACTLY with SPATIAL POSITIONS:
- Exterior wall color (be specific: beige, tan, cream - NOT generic "white" unless truly white)
- Architectural style (Craftsman, Spanish Colonial, Mediterranean, Ranch, etc.)
- Roof color and style, exposed rafters/eaves if present
- Garage: door count, window style (arched, rectangular), position (left/right/center when facing house)
- Fencing with location (e.g., "white fence along left side", "block wall on right")
- Driveway position (e.g., "driveway on the left leading to garage")
- Pillars, columns, porches with positions
- Trees with positions (e.g., "large palm tree front right", "row of hedges along left")
- Any visible pool or backyard features with position (e.g., "pool visible in back left")

Output ONE detailed paragraph (3-4 sentences). USE SPATIAL LANGUAGE: left/right (when facing house from street), front/back. ACCURACY AND POSITIONING ARE CRITICAL - the AI must recreate THIS EXACT house with correct element placement.`;

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
            model: 'gemini-2.0-flash-exp',
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
 *
 * This approach:
 * 1. Extracts house "identity" (key recognizable features)
 * 2. For most styles: passes identity + reference images for detail anchoring
 * 3. For color-transformation styles: passes identity only for creative freedom
 * 4. Uses Gemini 2.5 Flash Image (Nano Banana) for generation
 */
app.post('/api/generate-v2', generationLimiter, async (req, res) => {
  const { address, styleId, stylePrompt, useReference = true } = req.body;

  if (!address || !stylePrompt) {
    return res.status(400).json({ error: 'Address and stylePrompt are required' });
  }

  // Normalize address for cache key
  const cacheKey = address.toLowerCase().trim();

  try {
    // Step 1: Fetch Street View and Aerial View images (with caching)
    let streetViewBase64 = streetViewCache.get(cacheKey);
    let aerialViewBase64 = aerialViewCache.get(cacheKey);

    if (GOOGLE_MAPS_API_KEY && (!streetViewBase64 || !aerialViewBase64)) {
      const fetchPromises = [];

      if (!streetViewBase64) {
        fetchPromises.push(
          fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`)
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
          fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`)
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

    if (!identity && genAI) {
      const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const identityPrompt = `Extract this house's IDENTITY - the features that make it instantly recognizable.

=== HOUSE IDENTITY CARD ===

**COLORS**:
- Walls: [exact shade + hex approximation]
- Roof: [exact shade + hex approximation]
- Trim/accents: [colors]
- Garage doors: [color]

**ARCHITECTURE**:
- Style: [name]
- Stories: [count]
- Roof type: [shape]

**SIGNATURE FEATURES** (the 4-5 things that make THIS house unique):
1. [most distinctive]
2. [second]
3. [third]
4. [fourth]
5. [fifth if applicable]

**FROM AERIAL** (if aerial image provided):
- Pool: [yes/no, shape, position]
- Notable backyard features: [description]

**ONE-SENTENCE IDENTITY**:
[A single sentence capturing this house's essence that would make the owner say "that's MY house!"]`;

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

Generate now.`
        : `${stylePrompt}

=== HOUSE IDENTITY (follow this EXACTLY) ===
${identity}
=== END IDENTITY ===

Create this house based on the identity description above. Every architectural feature must match. The owner must immediately recognize their home.

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
            model: 'gemini-2.0-flash-exp',
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

    res.json({
      success: true,
      identity,
      generatedImage,
      mock,
      model: 'gemini-2.5-flash-image',
    });
  } catch (error) {
    console.error('V2 Generation pipeline error:', error);
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🏠 Diorama Generator API Server`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Street View: ${GOOGLE_MAPS_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Google AI: ${GOOGLE_AI_API_KEY ? '✅ Configured' : '❌ Not configured'}\n`);
});
