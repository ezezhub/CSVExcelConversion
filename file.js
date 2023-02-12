const config = require('config');
const fs = require('fs');
const XLSX = require('xlsx');
const natural = require('natural');
const converter = require('json-2-csv')

const folderDir = config.get('configfile.directory-config');

var transactionList = [];

// Read the folder first, After completed ETL then write to Google Sheet.
fs.readdir(folderDir.path, (err, files) => {


    var classifier = classiferTraining(folderDir.model)

    files.forEach(file => {
        if (file.startsWith("CC_TXN_History")) { // UOB CC
            var workbook = XLSX.readFile(folderDir.path + "/" + file);
            const temp = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 9 })
            temp.forEach(function (transaction) {
                if (transaction["Transaction Date"] != undefined) {
                    transactionList.push(convertUOBTransaction(transaction, "UOB PRIV", classifier))
                }
            });
        } else if (file.startsWith("ACCT_")) { // CITIBANK CC 
            fs.readFileSync(folderDir.path + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                var transaction = line.trim();
                if (transaction.length > 0) {
                    if (file.includes("508"))
                        transactionList.push(convertCitiTransaction(transaction, "CITIBANK MILES", classifier))
                    else
                        transactionList.push(convertCitiTransaction(transaction, "CITIBANK CASHBACK", classifier))
                };
            })

        } else if (file.startsWith("CardTransactions")) { // SCB CC
            transactionRow = 4
            count = 0;
            endOfTransaction = false
            fs.readFileSync(folderDir.path + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                if (endOfTransaction == false) { // CHECK FOR THE END OF TRANSACTION
                    var transaction = line.trim();
                    if (count > transactionRow) { //CHECK FOR THE START OF TRANSACTION
                        if (transaction.length > 0) {
                            if (transaction.includes("Current Balance")) {
                                endOfTransaction = true;
                            } else {
                                transactionList.push(convertSCBTransaction(transaction, "SCB MANHATTEN", classifier))
                            }
                        };
                    } else {
                        count++
                    }
                }
            })
        } else if (file.startsWith("ACC_TXN_History_")) { // UOB BANK ACC
            var workbook = XLSX.readFile(folderDir.path + "/" + file);
            const temp = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 7 })
            temp.forEach(function (transaction) {
                if (transaction["Transaction Date"] != undefined) {
                    transactionList.push(convertUOBBankTransaction(transaction, "UOB BANK", classifier))
                }
            });
        } else if (file.startsWith("TransactionHistory_")) { // OCBC BANK ACC
            transactionRow = 5
            count = 0;
            templist = [];
            fs.readFileSync(folderDir.path + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                var transaction = line.trim();
                if (count > transactionRow) { //CHECK FOR THE START OF TRANSACTION
                    if (transaction.length > 0) {
                        templist.push(transaction)
                    };
                } else {
                    count++
                }
            })
            for (var i = 0; i < templist.length; i += 2) {
                transactionList.push(convertOCBCBankTransaction(templist[i], templist[i + 1], "OCBC BANK", classifier))
            }

        } else { // POSB BANK ACC
            accountNumber = ""
            transactionRow = 20
            count = 0;
            endOfTransaction = false
            fs.readFileSync(folderDir.path + "/" + file, 'utf-8').split(/\r?\n/).forEach(function (line) {
                var transaction = line.trim();
                if (count > transactionRow) { //CHECK FOR THE START OF TRANSACTION
                    if (transaction.length > 0) {
                        if (accountNumber.includes("POSB")) {
                            transactionList.push(convertPOSBBankTransaction(transaction, accountNumber, classifier))
                        } else {
                            transactionList.push(convertDBSBankTransaction(transaction, accountNumber, classifier))
                        }

                    };
                } else {
                    if (count == 11) {
                        accountNumber = transaction.split(",")[1]
                    }
                    count++
                }

            })

        }
    })
    var ModifiedTransactionList = [];
    converter.json2csv(transactionList, (err, csv) => {
        if (err) {
            throw err
        }

        // print CSV string
        console.log(csv)
    })
    transactionList.forEach(function (entry) {
        temp = [entry["Card"], entry["Month"], entry["Amount"], entry["Remark"], entry["TYPE"].replace(/^["'](.+(?=["']$))["']$/, '$1')];
        ModifiedTransactionList.push(temp);
    });

    // Load gclient from local keys file.
    //const gclient = new google.auth.JWT(keys.client_email, null, keys.private_key, ['https://www.googleapis.com/auth/spreadsheets']);
    //gclient.authorize(function (error, tokens) {
    //    if (error) { console.log(error); return; }
    //    else {
    //        console.log('Connected to Google Sheet Service...');
    //        updateGoogleSheet(gclient, ModifiedTransactionList);
    //    }
    //});

})



// Train the NLP using pre-defined Model.
function classiferTraining(path) {
    var classifier = new natural.BayesClassifier();
    fs.readFileSync(path, 'utf-8').split(/\r?\n/).forEach(function (line) {
        var training = line.trim().split(",");
        classifier.addDocument(training[0], training[1]);
    })
    classifier.train();
    return classifier;
}

function convertCitiTransaction(transaction, card, classifier) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var remark = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(temp[2].replace(/^["'](.+(?=["']$))["']$/, '$1')) * -1;
    obj["Remark"] = remark
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(remark);
    return obj
}

function convertSCBTransaction(transaction, card, classifier) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var amount = temp[3].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var remark = temp[1].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(date.split("/")[1])
    obj["Amount"] = parseFloat(amount.split(" ")[1]);
    obj["Remark"] = remark
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(remark);
    return obj
}

function convertOCBCBankTransaction(transaction, t2, card, classifier) {
    var temp = transaction.split(",")
    var temp2 = t2.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var withdraw = temp[3].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var deposit = temp[4].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var remark = temp[2].replace(/^["'](.+(?=["']$))["']$/, '$1') + " " + temp2[2].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(date.split("/")[1])
    obj["Balance"] = 0
    obj["Withdraw"] = withdraw == "" ? 0 : parseFloat(withdraw);
    obj["Deposit"] = deposit == "" ? 0 : parseFloat(deposit);
    obj["Remark"] = remark
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(remark);
    return obj
}

function convertDBSBankTransaction(transaction, card, classifier) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var withdraw = temp[5].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var deposit = temp[4].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var remark = temp[6].replace(/^["'](.+(?=["']$))["']$/, '$1') + " " + temp[7].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(getMonthFromString(date.split(" ")[1]))
    obj["Balance"] = 0
    obj["Withdraw"] = withdraw == " " ? 0 : parseFloat(withdraw);
    obj["Deposit"] = deposit == " " ? 0 : parseFloat(deposit);
    obj["Remark"] = remark
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(remark);
    return obj
}

function convertPOSBBankTransaction(transaction, card, classifier) {
    var temp = transaction.split(",")
    var obj = {};
    var date = temp[0].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var withdraw = temp[2].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var deposit = temp[3].replace(/^["'](.+(?=["']$))["']$/, '$1');
    var remark = temp[4].replace(/^["'](.+(?=["']$))["']$/, '$1') + " " + temp[5].replace(/^["'](.+(?=["']$))["']$/, '$1');
    obj["Month"] = parseInt(getMonthFromString(date.split(" ")[1]))
    obj["Balance"] = 0
    obj["Withdraw"] = withdraw == " " ? 0 : parseFloat(withdraw);
    obj["Deposit"] = deposit == " " ? 0 : parseFloat(deposit);
    obj["Remark"] = remark
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(remark);
    return obj
}

function convertUOBTransaction(transaction, card, classifier) {
    var obj = {};
    var date = transaction["Transaction Date"].split(" ")[1];
    obj["Month"] = getMonthFromString(date)
    obj["Amount"] = parseFloat(transaction["Transaction Amount(Local)"]);
    obj["Remark"] = transaction["Description"];
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(transaction["Description"]);
    return obj
}

function convertUOBBankTransaction(transaction, card, classifier) {
    var obj = {};
    var date = transaction["Transaction Date"].split(" ")[1];
    obj["Month"] = getMonthFromString(date)
    obj["Balance"] = parseFloat(transaction["Available Balance"]);
    obj["Withdraw"] = parseFloat(transaction["Withdrawal"]);
    obj["Deposit"] = parseFloat(transaction["Deposit"]);
    obj["Remark"] = transaction["Transaction Description"];
    obj["Card"] = card;
    obj["TYPE"] = classifier.classify(transaction["Transaction Description"]);
    return obj
}


function getMonthFromString(mon) {
    return new Date(Date.parse(mon + " 1, 2012")).getMonth() + 1
}

async function updateGoogleSheet(client, transactionList) {
    const gSheet = google.sheets({ version: 'v4', auth: client });

    const updateoptions = {
        spreadsheetId: sheetconfig.spreadsheetId,
        range: sheetconfig.rangeId + "!A1:D1",
        valueInputOption: "RAW",
        resource: { values: transactionList }
    };

    let res = await gSheet.spreadsheets.values.append(updateoptions);
    console.log("Update Completed...")
}