const { Client } = require('whatsapp-web.js');
const fs = require('fs');

// Phone number to send test message to (with country code, no +)
const TEST_PHONE_NUMBER = process.argv[2] || '201000000000'; // Replace with your number

// Chrome path
const chromePath = 'D:\\puppeteer\\chrome\\win64-147.0.7727.50\\chrome-win64\\chrome.exe';

if (!fs.existsSync(chromePath)) {
  console.error('❌ Chrome not found at:', chromePath);
  process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     AZENITH WHATSAPP TEST - SYSTEM LINK VERIFICATION       ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const client = new Client({
  puppeteer: {
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  }
});

client.on('ready', async () => {
  console.log('🚀 Client ready - sending test message...\n');
  
  const chatId = `${TEST_PHONE_NUMBER}@c.us`;
  const message = '✅ AZENITH OS: System Link Established Successfully.';
  
  try {
    await client.sendMessage(chatId, message);
    console.log('✅ Test message sent successfully!');
    console.log(`   To: +${TEST_PHONE_NUMBER}`);
    console.log(`   Message: ${message}`);
    console.log('\n📱 Check your phone for the message.\n');
    
    // Exit after 3 seconds
    setTimeout(() => {
      console.log('👋 Closing test session...');
      client.destroy();
      process.exit(0);
    }, 3000);
    
  } catch (err) {
    console.error('❌ Failed to send message:', err);
    process.exit(1);
  }
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  process.exit(1);
});

client.initialize();
