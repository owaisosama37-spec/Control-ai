const https = require('https');

https.get('https://api.ipify.org?format=json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const ip = JSON.parse(data).ip;
    console.log('Outbound IP:', ip);
  });
});