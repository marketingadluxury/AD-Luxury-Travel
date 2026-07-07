const { JWT } = require('google-auth-library');
require('dotenv').config();

async function run() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const client = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  // First, find the folder 'AD Luxury Travel'
  const res = await client.request({
    url: 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent("name = 'AD Luxury Travel'")
  });
  console.log('Found folders:', res.data.files);
}
run().catch(console.error);
