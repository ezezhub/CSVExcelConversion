const config = require('config');
const fs = require('fs');
const XLSX = require('xlsx');
const googleConfig = config.get('configfile.googleapi-config');
const folderDir = config.get('configfile.directory.path');
const { google } = require('googleapis');
const keys = require(googleConfig.credentials_path)

var transactionList = [];



// Read the folder first, After completed ETL then write to Google Sheet.
fs.readdir(folderDir, (err, files) => {
    files.forEach(file => {
        if (file.startsWith("CC")) {
            if (file.includes("TXN_History")) {
                var workbook = XLSX.readFile(folderDir + "/" + file);
                const temp = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 9 })
                temp.forEach(function (transaction) {
                    if (transaction["Transaction Date"] != undefined) {
                        transactionList.push(convertUOBTransaction(transaction, "UOB PRIV"))
                    }
                });
            } else {
                fs.readFileSync(folderDir + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                    var transaction = line.trim();
                    if (transaction.length > 0) {
                        if (file.includes("SCB")) {
                            transactionList.push(convertSCBTransaction(transaction, "SCB MANHATTEN"))
                        } else {
                            if (file.includes("508"))
                                transactionList.push(convertCitiTransaction(transaction, "CITIBANK MILES"))
                            else
                                transactionList.push(convertCitiTransaction(transaction, "CITIBANK CASHBACK"))
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
    var ModifiedTransactionList = [];
    transactionList.forEach(function (entry) {
        temp = [entry["Card"], entry["Month"], entry["Amount"], entry["Remark"]];
        ModifiedTransactionList.push(temp);
    });

    // Load gclient from local keys file.
    const gclient = new google.auth.JWT(keys.client_email, null, keys.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
    gclient.authorize(function (error, tokens) {
        if (error) { console.log(error); return; }
        else {
            console.log('Connected to Google Sheet Service...');
            updateGoogleSheet(gclient, ModifiedTransactionList);
        }
    });

})

function convertCitiTransaction(transaction, card) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(temp[2].replace(/^["'](.+(?=["']$))["']$/, '$1')) * -1;
    obj["Remark"] = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Card"] = card;
    return obj
}

function convertSCBTransaction(transaction, card) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var amount = temp[3].replace(/^["'](.+(?=["']$))["']$/, '$1');

    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(amount.split(" ")[1]);
    obj["Remark"] = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Card"] = card;
    return obj
}

function convertUOBTransaction(transaction, card) {
    var obj = {};
    var date = transaction["Transaction Date"].split(" ")[1];
    obj["Month"] = getMonthFromString(date)
    obj["Amount"] = parseFloat(transaction["Transaction Amount(Local)"]);
    obj["Remark"] = transaction["Description"];
    obj["Card"] = card;
    return obj
}

function getMonthFromString(mon) {
    return new Date(Date.parse(mon + " 1, 2012")).getMonth() + 1
}

async function updateGoogleSheet(client, transactionList) {
    const gSheet = google.sheets({ version: 'v4', auth: client });

    const updateoptions = {
        spreadsheetId: googleConfig.spreadsheetId,
        range: googleConfig.rangeId + "!A1:D1",
        valueInputOption: "RAW",
        resource: { values: transactionList }
    };

    let res = await gSheet.spreadsheets.values.append(updateoptions);
    console.log("Update Completed...")
}