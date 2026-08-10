const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// Security: API Key authentication
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const internalApiKey = process.env.INTERNAL_API_KEY || '8f3d6c1b-a2e5-4d7c-9b8a-1c5e4d2b3a9f';
  
  if (apiKey === internalApiKey) {
    next();
  } else {
    const remoteAddress = req.socket.remoteAddress;
    console.warn(`[Security] Blocked unauthorized access attempt from ${remoteAddress}`);
    res.status(403).json({ error: 'Access denied. Invalid API Key.' });
  }
});

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let status = 'DISCONNECTED';
let qrCode = null;
let client = null;

function createClient() {
  console.log('[Service] Creating new WhatsApp client instance...');
  
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'zenith-service',
      dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  });

  client.on('qr', (qr) => {
    qrCode = qr;
    status = 'QR_READY';
    io.emit('status', { status, qr });
    console.log('[Service] NEW QR Received');
  });

  client.on('ready', () => {
    qrCode = null;
    status = 'READY';
    io.emit('status', { status });
    console.log('[Service] WhatsApp Client is READY');
  });

  client.on('authenticated', () => {
    console.log('[Service] Authenticated successfully');
  });

  client.on('auth_failure', (msg) => {
    console.error('[Service] Authentication failure:', msg);
    status = 'DISCONNECTED';
    io.emit('status', { status });
  });

  client.on('disconnected', (reason) => {
    console.log('[Service] WhatsApp Disconnected:', reason);
    status = 'DISCONNECTED';
    qrCode = null;
    io.emit('status', { status });
    
    // Attempt to cleanup and prep for re-init
    try {
      client.destroy();
    } catch (e) {}
    createClient(); 
  });

  return client;
}

// Initial client creation
createClient();

app.get('/health', (req, res) => {
  res.json({ status, connected: status === 'READY', qr: qrCode, timestamp: new Date().toISOString() });
});

app.post('/initialize', async (req, res) => {
  console.log(`[Service] Initialize request received. Current status: ${status}`);
  
  if (status === 'READY' || status === 'INITIALIZING' || status === 'QR_READY') {
    return res.json({ success: true, message: 'Client already active or initializing', status });
  }

  try {
    status = 'INITIALIZING';
    io.emit('status', { status });
    
    // If client exists but was disconnected, we might need to recreate it
    if (!client) createClient();
    
    client.initialize().catch(err => {
      console.error('[Service] Async Init Error:', err.message);
      status = 'DISCONNECTED';
      io.emit('status', { status });
    });

    res.json({ success: true, message: 'Initialization started' });
  } catch (error) {
    console.error('[Service] Sync Init Error:', error.message);
    status = 'DISCONNECTED';
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/send-message', async (req, res) => {
  const { phone, message } = req.body;
  if (status !== 'READY') return res.status(400).json({ error: 'WhatsApp client is not ready' });
  
  try {
    // Basic number formatting check
    const target = phone.includes('@c.us') ? phone : `${phone}@c.us`;
    await client.sendMessage(target, message);
    console.log(`[Service] Message sent to ${target}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Service] Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🚀 ZENITH STANDALONE WHATSAPP SERVICE`);
  console.log(`📍 Running on: http://127.0.0.1:${PORT}`);
  console.log(`🔒 Security: Localhost access only`);
  console.log(`=================================================\n`);
});
