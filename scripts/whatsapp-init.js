const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const express = require('express');

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           AZENITH WHATSAPP STATION READY                   ║');
console.log('║                                                            ║');
console.log('║   STATION READY: SCAN THE QR CODE BELOW                    ║');
console.log('║                                                            ║');
console.log('║   Open WhatsApp on your phone → Settings → Devices         ║');
console.log('║   → Link a Device → Scan the QR code below                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Chrome installed on D: drive
const chromePath = 'D:\\puppeteer\\chrome\\win64-147.0.7727.50\\chrome-win64\\chrome.exe';

if (!fs.existsSync(chromePath)) {
  console.error('❌ Chrome not found at:', chromePath);
  console.log('   Please install Chrome first');
  process.exit(1);
}

console.log('✓ Chrome found at:', chromePath);
console.log('');

// Create WhatsApp client
const client = new Client({
  puppeteer: {
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  },
  qrMaxRetries: 3
});

// Express API Server
const app = express();
const API_PORT = 3001;

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS headers for cross-origin requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = client.info ? 'connected' : 'connecting';
  res.json({ 
    status, 
    connected: !!client.info,
    timestamp: new Date().toISOString()
  });
});

// Send message endpoint
app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phone, message' 
      });
    }
    
    // Check if client is ready
    if (!client.info) {
      return res.status(503).json({ 
        success: false, 
        error: 'WhatsApp client not ready. Please wait for authentication.' 
      });
    }
    
    // Format phone number (ensure it has country code, no +)
    const formattedPhone = phone.replace(/\D/g, '');
    const chatId = `${formattedPhone}@c.us`;
    
    console.log(`📤 Sending message to +${formattedPhone}...`);
    
    // Send message
    const result = await client.sendMessage(chatId, message);
    
    console.log(`✅ Message sent to +${formattedPhone}`);
    console.log(`   Message ID: ${result.id._serialized}`);
    
    res.json({ 
      success: true, 
      messageId: result.id._serialized,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Start API server
app.listen(API_PORT, () => {
  console.log(`📡 WhatsApp API Server running at http://localhost:${API_PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - POST http://localhost:${API_PORT}/send-message`);
  console.log(`   - GET  http://localhost:${API_PORT}/health`);
  console.log('');
});

client.on('qr', (qr) => {
  console.log('\n📱 QR CODE GENERATED - SCAN NOW:\n');
  qrcode.generate(qr, { small: false });
  console.log('\n⏳ Waiting for authentication...');
});

client.on('authenticated', () => {
  console.log('\n✅ AUTHENTICATED - WhatsApp linked successfully!');
});

client.on('ready', () => {
  console.log('🚀 WHATSAPP CLIENT READY');
  console.log('   Session is active and ready to send notifications\n');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
  console.log('⚠️ Disconnected:', reason);
  console.log('   Restart the script to reconnect\n');
});

client.initialize();
