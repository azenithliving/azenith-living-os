const nodemailer = require('nodemailer');

// Gmail credentials
const GMAIL_USER = 'azenithliving@gmail.com';
const GMAIL_APP_PASSWORD = 'mmnz nwhk itgo ayac';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// Test email
async function sendTestEmail() {
  try {
    console.log('Testing Gmail SMTP connection...');
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    
    // Send test email
    const info = await transporter.sendMail({
      from: `"Azenith Test" <${GMAIL_USER}>`,
      to: 'azenithliving@gmail.com',
      subject: '✅ AZENITH OS: Email System Test',
      text: 'This is a test email from the Azenith Progress & Payment Notification System.\n\nIf you received this, the email integration is working correctly.',
    });
    
    console.log('✅ Test email sent successfully!');
    console.log('   Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
  }
}

sendTestEmail();
