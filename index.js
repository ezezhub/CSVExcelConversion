const config = require('config');
const fs = require('fs');
const readline = require('readline');


const googleConfig = config.get('googleapi-config');

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(googleConfig);
});
