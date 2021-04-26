const config = require('config');
const fs = require('fs');
const readline = require('readline');

const googleConfig = config.get('configfile.googleapi-config');
const folderDir = config.get('configfile.directory.path');

var transactionList = [];

// Read the folder first, After completed ETL then write to google sheet.
fs.readdir(folderDir, (err, files) => {
    files.forEach(file => {
        console.log(file);
        if (file.startsWith("CC")) {
            console.log("This is the credit card : " + file)
        } else if (file.startsWith("OCBC")) {
            console.log("This is the OCBC Bank: " + file)
        } else if (file.startsWith("POSB")) {
            console.log("This is the POSB Bank: " + file)
        } else if (file.startsWith("UOB")) {
            console.log("This is the UOB Bank: " + file)
        }
    })
})
// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(googleConfig);
});


