const config = require('config');
const fs = require('fs');

const googleConfig = config.get('configfile.googleapi-config');
const folderDir = config.get('configfile.directory-config');

const { google } = require('googleapis');
const keys = require(googleConfig.credentials_path)
const sheetconfig = require(googleConfig.spreadsheet)

var transactionList = [];

// Read the folder first, After completed ETL then write to Google Sheet.
fs.readdir(folderDir.path, (err, files) => {

    files.forEach(file => {
        if (file.startsWith("OCBC")) {
            fs.readFileSync(folderDir.path + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                var transaction = line.trim();
                if (transaction.includes("INTEREST")) {
                    var temp = transaction.split(",")
                    var obj = {};
                    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
                    var remark = temp[2]
                    obj["Date"] = date;
                    obj["Remark"] = remark;
                    obj["Amount"] = parseFloat(temp[4].replace(/^["'](.+(?=["']$))["']$/, '$1'));
                    transactionList.push(obj);
                };
            })
        }
    })

    var ModifiedTransactionList = [];
    transactionList.forEach(function (entry) {
        temp = [entry["Date"], entry["Amount"], entry["Remark"]];
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

async function updateGoogleSheet(client, transactionList) {
    const gSheet = google.sheets({ version: 'v4', auth: client });

    const updateoptions = {
        spreadsheetId: sheetconfig.spreadsheetId,
        range: "Interest" + "!A1:C1",
        valueInputOption: "RAW",
        resource: { values: transactionList }
    };

    let res = await gSheet.spreadsheets.values.append(updateoptions);
    console.log("Update Completed...")
}