import { CONFIG, STYLES, MOCK_DATA } from './config';

// Use relative path when proxied through Vite, or full URL for production
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Check API server health and capabilities
 */
export async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return await response.json();
  } catch (error) {
    console.warn('API server not available, using mock mode');
    return { status: 'mock', hasStreetViewKey: false, hasGoogleAIKey: false };
  }
}

/**
 * Fetch Street View image URL for a given address
 * @param {string} address - The property address
 * @returns {Promise<{url: string, mock: boolean}>}
 */
export async function fetchStreetViewImage(address) {
  if (CONFIG.MOCK_API_CALLS) {
    await simulateDelay(800);
    return {
      url: `https://via.placeholder.com/640x480/e8f4ff/0074e4?text=Street+View`,
      mock: true,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/streetview/image?address=${encodeURIComponent(address)}`);
    return await response.json();
  } catch (error) {
    console.error('Street View fetch error:', error);
    throw error;
  }
}

/**
 * Fetch Street View image as base64 for vision analysis
 * @param {string} address - The property address
 * @returns {Promise<{base64: string, mimeType: string, mock: boolean}>}
 */
export async function fetchStreetViewBase64(address) {
  if (CONFIG.MOCK_API_CALLS) {
    await simulateDelay(800);
    return { base64: null, mimeType: 'image/jpeg', mock: true };
  }

  try {
    const response = await fetch(`${API_BASE}/streetview/fetch?address=${encodeURIComponent(address)}`);
    return await response.json();
  } catch (error) {
    console.error('Street View fetch error:', error);
    throw error;
  }
}

/**
 * Analyze a Street View image using Vision AI
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} mimeType - Image MIME type
 * @returns {Promise<{description: string, mock: boolean}>}
 */
export async function analyzePropertyImage(imageBase64, mimeType = 'image/jpeg') {
  if (CONFIG.MOCK_API_CALLS || !imageBase64) {
    await simulateDelay(1500);
    return {
      description: MOCK_DATA.sampleSemanticDescription,
      mock: true,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Vision analysis error:', error);
    throw error;
  }
}

/**
 * Generate a diorama image using the selected style
 * @param {string} prompt - The full generation prompt
 * @returns {Promise<{imageBase64?: string, imageUrl?: string, mimeType?: string, mock: boolean}>}
 */
export async function generateImage(prompt) {
  if (CONFIG.MOCK_API_CALLS) {
    await simulateDelay(3000);
    return {
      imageUrl: MOCK_DATA.mockImages.diorama,
      mock: true,
    };
  }

  try {
    const response = await fetch(`${API_BASE}/imagen/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, aspectRatio: '1:1' }),
    });

    if (!response.ok) {
      throw new Error(`Image generation error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

/**
 * Complete pipeline: Address → Street View → Vision Analysis → Diorama Generation
 * @param {string} address - The property address
 * @param {string} styleId - ID of the style to use
 * @param {function} onProgress - Callback for progress updates
 * @returns {Promise<{imageUrl: string, semanticDescription: string, prompt: string}>}
 */
export async function generateDiorama(address, styleId, onProgress = () => {}) {
  const style = STYLES[styleId];
  if (!style) {
    throw new Error(`Unknown style: ${styleId}`);
  }

  // Check if we should use the unified API endpoint
  if (!CONFIG.MOCK_API_CALLS) {
    return generateDioramaViaApi(address, styleId, onProgress);
  }

  // Mock mode - simulate the full pipeline
  try {
    // Step 1: Fetch Street View
    onProgress({ step: 1, total: 3, message: 'Capturing street view...' });
    const streetViewResult = await fetchStreetViewImage(address);

    // Step 2: Analyze with Vision AI
    onProgress({ step: 2, total: 3, message: 'Analyzing property features...' });
    const analysisResult = await analyzePropertyImage(null);
    const semanticDescription = analysisResult.description;

    // Step 3: Generate Diorama
    onProgress({ step: 3, total: 3, message: 'Building your diorama...' });
    const prompt = style.prompt(semanticDescription);
    const imageResult = await generateImage(prompt);

    return {
      imageUrl: imageResult.imageUrl || `data:${imageResult.mimeType};base64,${imageResult.imageBase64}`,
      semanticDescription,
      prompt,
      streetViewUrl: streetViewResult.url,
      mock: true,
    };
  } catch (error) {
    console.error('Diorama generation failed:', error);
    throw error;
  }
}

/**
 * Generate diorama using the V2 backend API endpoint (Identity + Reference approach)
 * NOTE: Style prompts are now managed server-side for security.
 *       Only styleId is sent; the server looks up the prompt from its allowlist.
 */
async function generateDioramaViaApi(address, styleId, onProgress) {
  try {
    // Step 1: Start
    onProgress({ step: 1, total: 3, message: 'Capturing street view...' });
    await simulateDelay(500); // Brief pause to show progress

    // Step 2: Processing
    onProgress({ step: 2, total: 3, message: 'Extracting house identity...' });

    // Use V2 endpoint - only send styleId, server handles prompt lookup
    const response = await fetch(`${API_BASE}/generate-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        styleId,
        // NOTE: stylePrompt and useReference are now server-controlled
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Step 3: Generating
    onProgress({ step: 3, total: 3, message: 'Building your diorama...' });

    const result = await response.json();

    // Construct the image URL from base64 if needed
    let imageUrl;
    if (result.generatedImage?.base64) {
      imageUrl = `data:${result.generatedImage.mimeType};base64,${result.generatedImage.base64}`;
    } else if (result.mock) {
      // Use mock image for the selected style
      imageUrl = MOCK_DATA.mockImages[styleId] || MOCK_DATA.mockImages.diorama;
    }

    return {
      imageUrl,
      identity: result.identity,
      streetViewUrl: result.streetViewUrl,
      mock: result.mock,
      model: result.model,
    };
  } catch (error) {
    console.error('API generation failed:', error);
    throw error;
  }
}

/**
 * Utility function to simulate API delay
 */
function simulateDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Download an image from URL or base64
 * @param {string} imageUrl - URL or data URI of the image
 * @param {string} filename - Desired filename
 */
export async function downloadImage(imageUrl, filename = 'diorama.png') {
  try {
    let blob;

    if (imageUrl.startsWith('data:')) {
      // Handle base64 data URI
      const response = await fetch(imageUrl);
      blob = await response.blob();
    } else {
      // Handle regular URL
      const response = await fetch(imageUrl);
      blob = await response.blob();
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: open in new tab
    window.open(imageUrl, '_blank');
  }
}

/**
 * Share image using Web Share API or copy URL to clipboard
 * @param {string} imageUrl - URL of the image to share
 * @param {string} title - Title for sharing
 */
export async function shareImage(imageUrl, title = 'My Home Diorama') {
  const shareData = {
    title,
    text: 'Check out this diorama version of my house! Generated with Opendoor Diorama Generator.',
    url: window.location.href,
  };

  if (navigator.share && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return { success: true, method: 'native' };
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }

  // Fallback: copy current URL to clipboard
  try {
    await navigator.clipboard.writeText(window.location.href);
    return { success: true, method: 'clipboard' };
  } catch (error) {
    console.error('Clipboard copy failed:', error);
    return { success: false, error };
  }
}
