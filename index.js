const config = require('config');
const fs = require('fs');
const XLSX = require('xlsx');
const googleConfig = config.get('configfile.googleapi-config');
const folderDir = config.get('configfile.directory.path');
const { google } = require('googleapis');
const keys = require(googleConfig.credentials_path)

var transactionList = [];

// Load gclient from local keys file.
const gclient = new google.auth.JWT(keys.client_email, null, keys.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
gclient.authorize(function (error, tokens) {
    if (error) { console.log(error); return; }
    else { console.log('Connected to Google Sheet Service...'); }
});

// Read the folder first, After completed ETL then write to Google Sheet.
fs.readdir(folderDir, (err, files) => {
    files.forEach(file => {
        if (file.startsWith("CC")) {
            if (file.includes("TXN_History")) {
                var workbook = XLSX.readFile(folderDir + "/" + file);
                const temp = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 9 })
                temp.forEach(function (transaction) {
                    if (transaction["Transaction Date"] != undefined) {
                        transactionList.push(convertUOBTransaction(transaction))
                    }
                });
            } else {
                fs.readFileSync(folderDir + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                    var transaction = line.trim();
                    if (transaction.length > 0) {
                        if (file.includes("SCB")) {
                            transactionList.push(convertSCBTransaction(transaction))
                        } else {
                            transactionList.push(convertCitiTransaction(transaction))
                        }
                    };
                })
            }
        } else if (file.startsWith("OCBC")) {
            console.log("This is the OCBC Bank: " + file)
        } else if (file.startsWith("POSB")) {
            console.log("This is the POSB Bank: " + file)
        } else if (file.startsWith("UOB")) {
            console.log("This is the UOB Bank: " + file)
        }
    })

    transactionList.forEach(function (entry) {
        console.log(entry);
    });

    const updateoptions = {
        spreadsheetId: googleConfig.spreadsheetId,
        range: googleConfig.spreadsheetId + "!A1",
        valueInputOption: "USER_ENTERED",
        resource: { values: transactionList }
    };

    let resp = google.spreadsheets.values.update(updateoptions);
    console.log(resp);

})

function convertCitiTransaction(transaction) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(temp[2].replace(/^["'](.+(?=["']$))["']$/, '$1')) * -1;
    obj["Remark"] = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    return obj
}

function convertSCBTransaction(transaction) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var amount = temp[3].replace(/^["'](.+(?=["']$))["']$/, '$1');

    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(amount.split(" ")[1]);
    obj["Remark"] = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    return obj
}

function convertUOBTransaction(transaction) {
    var obj = {};
    var date = transaction["Transaction Date"].split(" ")[1];
    obj["Month"] = getMonthFromString(date)
    obj["Amount"] = parseFloat(transaction["Transaction Amount(Local)"]);
    obj["Remark"] = transaction["Description"];
    return obj
}

function getMonthFromString(mon) {
    return new Date(Date.parse(mon + " 1, 2012")).getMonth() + 1
}