const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Image Conversion Script
 * Converts all new images to WebP format and removes originals
 */

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images');
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.bmp'];

// WebP conversion quality (0-100)
const WEBP_QUALITY = 80;

// Delete originals after conversion
const DELETE_ORIGINALS = true;

// Track conversion stats
let stats = {
  converted: 0,
  skipped: 0,
  failed: 0,
  totalSizeBefore: 0,
  totalSizeAfter: 0,
};

/**
 * Get all image files recursively
 */
function getAllImageFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllImageFiles(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

/**
 * Convert a single image to WebP
 */
async function convertToWebP(imagePath) {
  const ext = path.extname(imagePath);
  const webpPath = imagePath.replace(ext, '.webp');

  try {
    // Check if WebP version already exists and is newer
    if (fs.existsSync(webpPath)) {
      const originalStat = fs.statSync(imagePath);
      const webpStat = fs.statSync(webpPath);

      if (webpStat.mtimeMs > originalStat.mtimeMs) {
        stats.skipped++;
        return;
      }
    }

    // Get original file size
    const originalSize = fs.statSync(imagePath).size;
    stats.totalSizeBefore += originalSize;

    // Convert to WebP
    await sharp(imagePath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(webpPath);

    // Get converted file size
    const webpSize = fs.statSync(webpPath).size;
    stats.totalSizeAfter += webpSize;

    const reduction = ((1 - webpSize / originalSize) * 100).toFixed(1);
    const relativePath = path.relative(PUBLIC_DIR, imagePath);
    
    console.log(`✓ Converted: ${relativePath} (${reduction}% smaller)`);
    stats.converted++;

    // Delete original file after conversion
    if (DELETE_ORIGINALS) {
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        console.log(`  ⚠️  Could not delete original: ${err.message}`);
      }
    }
  } catch (error) {
    console.error(`✗ Failed to convert: ${imagePath}`);
    console.error(`  Error: ${error.message}`);
    stats.failed++;
  }
}

/**
 * Main conversion function
 */
async function convertAllImages() {
  console.log('🖼️  Starting image conversion to WebP...\n');
  console.log(`📁 Scanning directory: ${PUBLIC_DIR}\n`);

  const imageFiles = getAllImageFiles(PUBLIC_DIR);

  if (imageFiles.length === 0) {
    console.log('ℹ️  No images found to convert.\n');
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to process...\n`);

  // Convert images in parallel (but limit concurrency to avoid memory issues)
  const batchSize = 5;
  for (let i = 0; i < imageFiles.length; i += batchSize) {
    const batch = imageFiles.slice(i, i + batchSize);
    await Promise.all(batch.map(convertToWebP));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Conversion Summary:');
  console.log('='.repeat(60));
  console.log(`✓ Converted: ${stats.converted}`);
  console.log(`⊘ Skipped:   ${stats.skipped} (already up-to-date)`);
  console.log(`✗ Failed:    ${stats.failed}`);
  
  if (stats.converted > 0) {
    const savedBytes = stats.totalSizeBefore - stats.totalSizeAfter;
    const savedKB = (savedBytes / 1024).toFixed(2);
    const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
    const percentSaved = ((savedBytes / stats.totalSizeBefore) * 100).toFixed(1);
    
    console.log(`💾 Total size reduced: ${savedMB} MB (${savedKB} KB) - ${percentSaved}% smaller`);
  }
  console.log('='.repeat(60));
  console.log('\n✨ Image conversion complete!\n');
}

// Run the conversion
convertAllImages().catch((error) => {
  console.error('❌ Fatal error during image conversion:');
  console.error(error);
  process.exit(1);
});

