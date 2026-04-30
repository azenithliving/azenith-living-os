const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
});

client.connect()
  .then(() => {
    console.log('Successfully connected!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err.message);
    process.exit(1);
  });
