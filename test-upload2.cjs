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

  const res = await client.request({
    url: 'https://www.googleapis.com/drive/v3/files/1hSxuISjv1HLLVTGAdtSxNr21e7UTDHfy?fields=owners'
  });
  console.log('Folder owners:', res.data);
}
run().catch(console.error);
