const crypto = require('crypto');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await supabase.from('clients').select('doku_client_id, doku_secret_key').eq('doku_client_id', 'BRN-0292-1760887481419').single();
  
  console.log('=== CREDENTIALS ===');
  console.log('Client ID:', data.doku_client_id);
  console.log('Secret Key length:', data.doku_secret_key?.length || 0);
  console.log('Secret Key empty?', !data.doku_secret_key || data.doku_secret_key.trim() === '');
  console.log('Secret Key preview:', (data.doku_secret_key || '').substring(0, 8) + '...');
  
  if (!data.doku_secret_key || data.doku_secret_key.trim() === '') {
    console.error('❌ SECRET KEY IS EMPTY! Cannot proceed.');
    process.exit(1);
  }

  const requestId = uuidv4();
  const targetPath = '/checkout/v1/payment';
  
  const now = new Date();
  const wibOffset = 7 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (wibOffset * 60000));
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${wib.getFullYear()}-${pad(wib.getMonth()+1)}-${pad(wib.getDate())}T${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())}+07:00`;

  const requestBody = {
    order: {
      invoice_number: 'TEST-' + Date.now(),
      amount: 500
    },
    payment: {
      payment_due_date: 30
    },
    customer: {
      name: 'Test Customer',
      email: 'test@example.com'
    }
  };

  const bodyStr = JSON.stringify(requestBody);
  const digest = crypto.createHash('sha256').update(bodyStr).digest('base64');
  
  const componentSignature = 
    `Client-Id:${data.doku_client_id}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${timestamp}\n` +
    `Request-Target:${targetPath}\n` +
    `Digest:${digest}`;
  
  const hmac = crypto.createHmac('sha256', data.doku_secret_key).update(componentSignature).digest('base64');
  const signature = `HMACSHA256=${hmac}`;

  console.log('\n=== REQUEST DETAILS ===');
  console.log('URL: https://api.doku.com' + targetPath);
  console.log('Timestamp:', timestamp);
  console.log('Signature:', signature);
  console.log('Body:', bodyStr);
  console.log('\n=== COMPONENT SIGNATURE ===');
  console.log(componentSignature);

  try {
    const r = await axios.post('https://api.doku.com' + targetPath, requestBody, {
      headers: {
        'Client-Id': data.doku_client_id,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': signature,
        'Content-Type': 'application/json'
      }
    });
    console.log('\n✅ SUCCESS:', JSON.stringify(r.data, null, 2));
  } catch(e) {
    console.log('\n❌ ERROR status:', e.response?.status);
    console.log('❌ ERROR body:', JSON.stringify(e.response?.data, null, 2));
  }
})();
