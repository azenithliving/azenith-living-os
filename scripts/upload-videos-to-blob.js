const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

const videosDir = path.join(__dirname, '..', 'public', 'videos');
const outputFile = path.join(__dirname, '..', 'video-urls.json');

async function uploadVideos() {
  const files = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));
  const results = {};

  for (const file of files) {
    const filePath = path.join(videosDir, file);
    const content = fs.readFileSync(filePath);
    
    console.log(`Uploading ${file} (${(content.length / 1024 / 1024).toFixed(2)} MB)...`);
    
    try {
      const blob = await put(`videos/${file}`, content, {
        access: 'public',
        contentType: 'video/mp4',
      });
      
      results[file] = blob.url;
      console.log(`✅ Uploaded: ${blob.url}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${file}:`, err.message);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 URLs saved to video-urls.json`);
  console.log('\n--- Video URLs ---');
  console.log(JSON.stringify(results, null, 2));
}

uploadVideos().catch(console.error);
