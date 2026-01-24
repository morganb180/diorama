/**
 * Configuration for the Diorama Generator
 *
 * Replace these values with your actual API keys and endpoints
 */

export const CONFIG = {
  // Google Street View API Configuration
  STREET_VIEW_API_KEY: import.meta.env.VITE_STREET_VIEW_API_KEY || 'YOUR_GOOGLE_STREET_VIEW_API_KEY',
  STREET_VIEW_BASE_URL: 'https://maps.googleapis.com/maps/api/streetview',

  // Image Generation API Configuration
  IMAGE_GEN_ENDPOINT: import.meta.env.VITE_IMAGE_GEN_ENDPOINT || 'https://api.example.com/generate',
  IMAGE_GEN_API_KEY: import.meta.env.VITE_IMAGE_GEN_API_KEY || 'YOUR_IMAGE_GEN_API_KEY',

  // Vision Analysis API (Gemini/GPT-4V) Configuration
  VISION_API_ENDPOINT: import.meta.env.VITE_VISION_API_ENDPOINT || 'https://api.example.com/vision',
  VISION_API_KEY: import.meta.env.VITE_VISION_API_KEY || 'YOUR_VISION_API_KEY',

  // Feature Flags
  MOCK_API_CALLS: false, // Set to true to use mock data without real APIs
  ENABLE_ANALYTICS: false,
};

/**
 * Style Definitions with their visual properties and generation prompts
 *
 * V2 Generation approach:
 * - useReference: true = pass reference photos for detail anchoring (most styles)
 * - useReference: false = identity-only for color transformation freedom (e.g., Wes Anderson)
 * - promptV2: concise prompt optimized for identity + reference approach
 */

export const STYLES = {
  // === CORE STYLES ===
  diorama: {
    id: 'diorama',
    name: 'Miniature Diorama',
    shortName: 'Diorama',
    description: '8K ultra-realistic miniature model',
    color: '#D4A574',
    bgColor: 'rgba(212, 165, 116, 0.1)',
    icon: '🏠',
    useReference: true,
    promptV2: '45-degree isometric miniature architectural diorama model. Studio photography, warm lighting, clean background. Show the house from an isometric angle revealing front, side, and roof. Make it look like a high-end architectural scale model.',
  },
  simcity: {
    id: 'simcity',
    name: 'Retro SimCity',
    shortName: 'SimCity',
    description: '90s city-builder game sprite',
    color: '#4ECDC4',
    bgColor: 'rgba(78, 205, 196, 0.1)',
    icon: '🎮',
    useReference: true,
    promptV2: '90s SimCity-style 2.5D isometric pixel art sprite. Clean aliased edges, vibrant 16-bit colors, gray-blue solid background. Pixel-perfect retro game aesthetic.',
  },
  lego: {
    id: 'lego',
    name: 'LEGO Architecture',
    shortName: 'LEGO',
    description: 'Brick-built model kit',
    color: '#E3000B',
    bgColor: 'rgba(227, 0, 11, 0.1)',
    icon: '🧱',
    useReference: true,
    promptV2: 'LEGO Architecture brick-built model. Chunky LEGO bricks with visible studs, smooth ABS plastic sheen, minifigure-scale. White gradient studio background, product photography style.',
  },
  bauhaus: {
    id: 'bauhaus',
    name: 'Bauhaus Poster',
    shortName: 'Bauhaus',
    description: 'Geometric modernist art',
    color: '#1A1A1A',
    bgColor: 'rgba(26, 26, 26, 0.1)',
    icon: '🎨',
    useReference: false, // Needs creative freedom for geometric abstraction
    promptV2: `TRANSFORM this house into a Bauhaus geometric poster illustration.

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
    id: 'figurine',
    name: 'Plastic Figurine',
    shortName: 'Figurine',
    description: 'Miniature plastic model',
    color: '#E07B53',
    bgColor: 'rgba(224, 123, 83, 0.1)',
    icon: '🎬',
    useReference: true,
    promptV2: 'Miniature isometric plastic figurine, like a detailed board game piece or architectural model. Slightly stylized proportions (a bit chunky/cute). Smooth plastic finish, white background, product photography.',
  },
  // === VIRAL-POTENTIAL STYLES ===
  wesanderson: {
    id: 'wesanderson',
    name: 'Wes Anderson',
    shortName: 'Wes',
    description: 'Symmetrical pastel film set',
    color: '#E8B4B8',
    bgColor: 'rgba(232, 180, 184, 0.1)',
    icon: '🎬',
    useReference: false, // Needs freedom to transform colors
    promptV2: 'Photorealistic Wes Anderson film still. Shot on 35mm film, architecturally sharp and detailed. The house has been repainted and art-directed for the film: walls are now soft peachy-pink, the roof is dusty coral/salmon, trim is cream white. The sky is powder blue, grass is muted sage green. Perfect bilateral symmetry, house dead-center. Soft diffused golden hour lighting. 8K cinematic quality. The Grand Budapest Hotel aesthetic.',
  },
  animalcrossing: {
    id: 'animalcrossing',
    name: 'Animal Crossing',
    shortName: 'AC',
    description: 'Cozy Nintendo village home',
    color: '#7DC4A5',
    bgColor: 'rgba(125, 196, 165, 0.1)',
    icon: '🍃',
    useReference: true,
    promptV2: `Animal Crossing style illustration - a soft, hand-drawn storybook scene. NOT a 3D game screenshot.

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
    id: 'ghibli',
    name: 'Studio Ghibli',
    shortName: 'Ghibli',
    description: 'Miyazaki anime background',
    color: '#87CEEB',
    bgColor: 'rgba(135, 206, 235, 0.1)',
    icon: '🌸',
    useReference: true,
    promptV2: 'Studio Ghibli anime background painting. Reimagine this house in Miyazaki\'s world - warm afternoon sun, hand-painted textures, lush vegetation, puffy clouds. Show it from a slight angle like an establishing shot. Include all the signature features.',
  },
  bobross: {
    id: 'bobross',
    name: 'Bob Ross',
    shortName: 'Bob Ross',
    description: 'Happy little house painting',
    color: '#2D5A27',
    bgColor: 'rgba(45, 90, 39, 0.1)',
    icon: '🌲',
    useReference: true,
    promptV2: `Bob Ross style oil painting - a naturalistic landscape scene with the house nestled organically in nature.

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
    id: 'kinkade',
    name: 'Thomas Kinkade',
    shortName: 'Kinkade',
    description: 'Painter of Light cottage',
    color: '#FFB347',
    bgColor: 'rgba(255, 179, 71, 0.1)',
    icon: '✨',
    useReference: true,
    promptV2: 'Thomas Kinkade "Painter of Light" style painting. Magical golden hour lighting, warm glowing windows emanating cozy light, lush flowering gardens, romantic idealized atmosphere, soft ethereal glow throughout. Nostalgic, heartwarming, Christmas-card beautiful.',
  },
  ukiyoe: {
    id: 'ukiyoe',
    name: 'Ukiyo-e Woodblock',
    shortName: 'Ukiyo-e',
    description: 'Japanese woodblock print',
    color: '#1E3A5F',
    bgColor: 'rgba(30, 58, 95, 0.1)',
    icon: '🌊',
    useReference: false, // Needs creative freedom for stylization
    promptV2: `Traditional Japanese ukiyo-e woodblock print in the style of Hokusai and Hiroshige. Create a COMPLETE COMPOSITION, not just the house.

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
    id: 'travelposter',
    name: 'Vintage Travel Poster',
    shortName: 'Travel',
    description: 'Mid-century travel art',
    color: '#E85D04',
    bgColor: 'rgba(232, 93, 4, 0.1)',
    icon: '✈️',
    useReference: false, // Needs creative freedom for stylization
    promptV2: 'Vintage 1950s travel poster illustration. Bold flat colors, simplified geometric shapes, art deco influences, optimistic mid-century modern aesthetic, screen-printed texture, "Visit [LOCATION]" tourism poster style. Warm sunset palette with teal accents.',
  },
  richardscarry: {
    id: 'richardscarry',
    name: 'Richard Scarry',
    shortName: 'Scarry',
    description: 'Busytown children\'s book',
    color: '#FF6B6B',
    bgColor: 'rgba(255, 107, 107, 0.1)',
    icon: '📚',
    useReference: true,
    promptV2: 'Richard Scarry Busytown children\'s book illustration. Charming hand-drawn style, warm cheerful colors, cross-section cutaway showing interior rooms, tiny anthropomorphic animal residents going about their day, whimsical details everywhere, nostalgic 1970s children\'s book aesthetic.',
  },
  lofi: {
    id: 'lofi',
    name: 'Lo-fi Anime',
    shortName: 'Lo-fi',
    description: 'Cozy study beats aesthetic',
    color: '#9B5DE5',
    bgColor: 'rgba(155, 93, 229, 0.1)',
    icon: '🎧',
    useReference: true,
    promptV2: 'Lo-fi hip hop anime aesthetic illustration. Warm cozy evening lighting, soft purple and orange sunset tones, gentle rain or cherry blossoms falling, peaceful melancholic mood, anime background art style, study girl YouTube channel aesthetic. Relaxing, nostalgic, slightly dreamy.',
  },
  cottagecore: {
    id: 'cottagecore',
    name: 'Cottagecore',
    shortName: 'Cottage',
    description: 'Romantic fairy tale cottage',
    color: '#D4A373',
    bgColor: 'rgba(212, 163, 115, 0.1)',
    icon: '🌻',
    useReference: true,
    promptV2: 'Dreamy cottagecore fairy tale illustration. Romanticized overgrown garden, climbing roses and wisteria, soft dappled sunlight through trees, vintage pastoral aesthetic, slightly ethereal and magical atmosphere, wildflower meadow, butterflies and songbirds. Pinterest-perfect rural fantasy.',
  },
  hologram: {
    id: 'hologram',
    name: 'Hologram',
    shortName: 'Holo',
    description: 'Sci-fi holographic interface',
    color: '#00D4FF',
    bgColor: 'rgba(0, 212, 255, 0.1)',
    icon: '🔮',
    useReference: true,
    promptV2: 'A futuristic holographic interface displaying this house as a 3D wireframe model. Neon cyan and magenta energy beams outlining the architectural form. Floating data symbols and measurement annotations, transparent glowing layers, luminous edges. Set in a dark high-tech command hub with curved display screens. Sci-fi movie aesthetic, Blade Runner vibes.',
  },
  eightbit: {
    id: 'eightbit',
    name: '8-Bit NES',
    shortName: '8-Bit',
    description: 'Classic NES video game sprite',
    color: '#92CC41',
    bgColor: 'rgba(146, 204, 65, 0.1)',
    icon: '👾',
    useReference: true,
    promptV2: `TRANSFORM this house into retro 8-bit pixel art. DO NOT create a realistic photo.

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
    id: 'coloringsheet',
    name: 'Coloring Sheet',
    shortName: 'Coloring',
    description: 'Black & white coloring page',
    color: '#333333',
    bgColor: 'rgba(51, 51, 51, 0.1)',
    icon: '✏️',
    useReference: true,
    promptV2: `Create a coloring book page of this house for children to color in.

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
    id: 'crayon',
    name: 'Crayon Drawing',
    shortName: 'Crayon',
    description: 'Kid\'s crayon artwork',
    color: '#FF6B35',
    bgColor: 'rgba(255, 107, 53, 0.1)',
    icon: '🖍️',
    useReference: true,
    promptV2: `A child's crayon drawing of this house, like a middle schooler's art project.

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
    id: 'openarmy',
    name: 'Open Army',
    shortName: 'Open Army',
    description: 'Military playset toy',
    color: '#4A5D23',
    bgColor: 'rgba(74, 93, 35, 0.1)',
    icon: '🎖️',
    useReference: true,
    promptV2: `1980s military action figure playset style, like a GI Joe or Army Men headquarters.

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

/**
 * Vision Analysis Prompt Template
 * Used to extract semantic descriptions from Street View images
 */
export const VISION_ANALYSIS_PROMPT = `
Analyze this Street View image of a residential property and generate a detailed semantic description suitable for AI image generation.

Focus on:
1. Architectural style (e.g., Mediterranean, Colonial, Modern, Victorian, Ranch)
2. Exterior materials and colors (stucco, brick, siding, etc.)
3. Roof style and materials (tile, shingle, flat, etc.)
4. Landscaping features (lawn, trees, hedges, flowers)
5. Driveway and walkway materials
6. Notable features (pool, garage, porch, balcony)
7. Window and door styles
8. Overall scale and proportions

Output Format:
Return a single paragraph (2-4 sentences) describing the property as if you were writing for an architectural rendering prompt. Be specific about materials, colors, and distinctive features.

Example Output:
"A grand two-story Mediterranean-style suburban home with a warm-toned stucco exterior and a distinct red clay terracotta tile roof. Features a large, manicured front lawn with a stone-paved curved walkway. In the rear, a sparkling turquoise swimming pool is surrounded by a stone patio and lush green privacy hedges. Large windows with dark frames and a multi-car garage."
`;

/**
 * Mock Data for Development
 */
export const MOCK_DATA = {
  sampleAddress: '26141 Red Corral Rd, Laguna Hills, CA 92653',
  sampleSemanticDescription: 'A grand two-story Mediterranean-style suburban home with a warm-toned stucco exterior and a distinct red clay terracotta tile roof. Features a large, manicured front lawn with a stone-paved curved walkway. In the rear, a sparkling turquoise swimming pool is surrounded by a stone patio and lush green privacy hedges. Large windows with dark frames and a multi-car garage.',
  mockImages: {
    diorama: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
    simcity: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
    simpsons: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
    lego: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
    bauhaus: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    figurine: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    marker: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80',
    sketch: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
    oilpainting: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80',
    watercolor: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
  },
};
