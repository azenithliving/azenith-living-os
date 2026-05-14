import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

console.log('--- WHATSAPP DIAGNOSTIC TOOL ---');
console.log('[1/3] Initializing client...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'debug-session',
        dataPath: './debug-auth'
    }),
    puppeteer: {
        headless: true, // Try true first, if it fails we can try false
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('[SUCCESS] QR Code received!');
    qrcode.generate(qr, { small: true });
    console.log('Scan the code above with your phone.');
});

client.on('ready', () => {
    console.log('[SUCCESS] Client is ready and authenticated!');
    process.exit(0);
});

client.on('auth_failure', (msg) => {
    console.error('[FAILURE] Authentication failure:', msg);
});

console.log('[2/3] Attempting to launch browser...');

client.initialize().then(() => {
    console.log('[3/3] Client initialization promise resolved. Waiting for QR...');
}).catch(err => {
    console.error('[CRITICAL ERROR] Failed to initialize WhatsApp client:');
    console.error(err);
    console.log('\n--- DIAGNOSIS TIPS ---');
    if (err.message.includes('executable')) {
        console.log('Tip: It seems Chromium is missing. Try running: npm install puppeteer');
    }
    process.exit(1);
});

// Set a timeout to kill the process if nothing happens
setTimeout(() => {
    console.log('\n[TIMEOUT] 60 seconds passed with no response. Check if a browser process is hung in Task Manager.');
    // process.exit(1);
}, 60000);
