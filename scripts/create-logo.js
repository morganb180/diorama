/**
 * Create Opendoor logo PNG for watermarking
 */
import fs from 'fs';
import { createCanvas } from 'canvas';

// Opendoor logo dimensions from viewBox
const LOGO_WIDTH = 256;
const LOGO_HEIGHT = 56;

// Create high-res version (4x)
const SCALE = 4;
const canvas = createCanvas(LOGO_WIDTH * SCALE, LOGO_HEIGHT * SCALE);
const ctx = canvas.getContext('2d');

// Scale up
ctx.scale(SCALE, SCALE);

// Draw white background (for transparent logo on dark backgrounds)
// ctx.fillStyle = 'white';
// ctx.fillRect(0, 0, LOGO_WIDTH, LOGO_HEIGHT);

// Draw logo using simple shapes that approximate the Opendoor wordmark
// Since complex SVG path parsing is problematic, let's create a simpler approach
ctx.fillStyle = '#111827';

// "opendoor" text approximation using basic shapes
// This is the Opendoor wordmark - let's use a font instead

ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('opendoor', LOGO_WIDTH / 2, LOGO_HEIGHT / 2);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./public/opendoor-logo.png', buffer);
console.log('Created ./public/opendoor-logo.png');
