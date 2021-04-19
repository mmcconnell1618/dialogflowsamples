// Copyright 2021 Google LLC. This software is provided as-is, without warranty or representation for any use or purpose. Your use of it is subject to your agreements with Google.

'use strict';

require('@google-cloud/trace-agent').start();
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { WebhookClient } = require('dialogflow-fulfillment');
const { Suggestion, Payload } = require('dialogflow-fulfillment');
const moment = require('moment')
const jwt = require('jsonwebtoken');
const { dialogflow, Table, Image, BasicCard, Suggestions } = require('actions-on-google');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
// const app= dialogflow({debug:true});
admin.initializeApp(functions.config().firebase);
admin.firestore().settings({ timestampsInSnapshots: true })
const db = admin.firestore();


const express = require('express');
const bodyParser = require('body-parser')

const app = express();

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const dialogflowv2beta1 = require('dialogflow').v2beta1;


/*
 * 
 * BEGIN FIRESTORE FUNCTIONS
 *
 */
// get Customer ID
async function getFirestoreCustomerId(agent) {
    let userEmail = "xyz@abc.com"
    console.log("Entered getFirestoreCustomerId")
    console.log("getFirestoreCustomerId.agent.originalRequest")
    console.log(JSON.stringify(agent.originalRequest))
    if (Object.prototype.hasOwnProperty.call(agent.originalRequest, 'payload')) {
        console.log("getFirestoreCustomerId.agent.originalRequest has payload")
        if (Object.prototype.hasOwnProperty.call(agent.originalRequest.payload, 'user')) {
            console.log("getFirestoreCustomerId.agent.originalRequest.payload has user")
            if (Object.prototype.hasOwnProperty.call(agent.originalRequest.payload.user, 'idToken')) {
                console.log("getFirestoreCustomerId.agent.originalRequest.payload.user has idToken")
                let decodedToken = jwt.decode(agent.originalRequest.payload.user.idToken)
                userEmail = decodedToken.email
            }
        } else if (Object.prototype.hasOwnProperty.call(agent.originalRequest.payload, 'userId')) {
            console.log("getFirestoreCustomerId.agent.originalRequest.payload has userId")
            userEmail = agent.originalRequest.payload.userId
        }
    }

    console.log("getFirestoreCustomerId.userEmail = " + userEmail)
    if (userEmail !== null) {
        let customersRef = await db.collection('customers');
        let query = await customersRef.where("email", "==", userEmail).get().then(snapshot => {
            return snapshot.docs[0].data().custID; // => returns first document
        });
        return query;
    } else {
        return null;
    }
}

/*
 * Get Customer Given Name
 */
async function getGivenName(agent) {
    let userEmail = agent.originalRequest.payload.userId ? agent.originalRequest.payload.userId : null;

    if (userEmail === null) {
        let decodedToken = jwt.decode(agent.originalRequest.payload.user.idToken)
        userEmail = decodedToken.email
    }

    if (userEmail !== null) {
        let customersRef = await db.collection('customers');
        let query = await customersRef.where("email", "==", userEmail).get().then(snapshot => {
            return snapshot.docs[0].data().givenname; // => returns first document
        });
        return query;
    } else {
        return null;
    }
}

/* 
 * Get Merchants
 * returns: an array of merchants for a category, name, or ID
 * NOTE: if you are specifying an ID which returns a single merchant, you will still get an array in return.
 */
async function getMerchants(merchantCategory, merchantName, merchantId, merchantCity, merchantState) {
    let merchants = []

    // get All merchants
    if ((merchantCategory == "all") && (merchantName == "all") && (merchantCity === null) && (merchantState === null)) {
        console.log("getMerchants Getting All Merchants")
        await db.collection("merchants")
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    merchants.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting documents: ", error);
            });
    } else if ((merchantCategory == "all") && (merchantName == "all") && ((merchantCity !== null) || (merchantState !== null))) {
        // else if the user only specified a location
        console.log("getMerchants.merchantCity = " + merchantCity)
        console.log("getMerchants.merchantState = " + merchantState)
        if ((merchantCity !== null) && (merchantState !== null)) {
            // if both a city and state are specified
            await db.collection("merchants")
                .where("city", "==", merchantCity)
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity !== null) && (merchantState === null)) {
            // if only a city is specified
            await db.collection("merchants")
                .where("city", "==", merchantCity)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity === null) && (merchantState !== null)) {
            // if only a state is specified
            await db.collection("merchants")
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else {
            // it's a problem if we get here
            console.error("Error: Unknown Problem in getMerchants")
        }
    } else if ((merchantCategory !== null) && (merchantCategory !== "all")) {
        // else if the user specified a merchant category
        let lowercaseCategory = merchantCategory.toString().toLowerCase()
        console.log("getMerchants.merchantCategory = " + lowercaseCategory)
        console.log("getMerchants.merchantCity = " + merchantCity)
        console.log("getMerchants.merchantState = " + merchantState)
        if ((merchantCity !== null) && (merchantState !== null)) {
            // if both a city and state are specified
            await db.collection("merchants")
                .where("category1", "==", lowercaseCategory)
                .where("city", "==", merchantCity)
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity !== null) && (merchantState === null)) {
            // if only a city is specified
            await db.collection("merchants")
                .where("category1", "==", lowercaseCategory)
                .where("city", "==", merchantCity)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity === null) && (merchantState !== null)) {
            // if only a state is specified
            await db.collection("merchants")
                .where("category1", "==", lowercaseCategory)
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else {
            // no city, no state, just category
            await db.collection("merchants")
                .where("category1", "==", lowercaseCategory)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        }
    } else if ((merchantName !== null) && (merchantName !== "all")) {
        // else if the user specified a merchant name
        let lowercaseName = merchantName.toString().toLowerCase()
        console.log("getMerchants.merchantName = " + lowercaseName)
        console.log("getMerchants.merchantCity = " + merchantCity)
        console.log("getMerchants.merchantState = " + merchantState)
        if ((merchantCity !== null) && (merchantState !== null)) {
            // if both a city and state are specified
            await db.collection("merchants")
                .where("name", "==", lowercaseName)
                .where("city", "==", merchantCity)
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity !== null) && (merchantState === null)) {
            // if only a city is specified
            await db.collection("merchants")
                .where("name", "==", lowercaseName)
                .where("city", "==", merchantCity)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else if ((merchantCity === null) && (merchantState !== null)) {
            // if only a state is specified
            await db.collection("merchants")
                .where("name", "==", lowercaseName)
                .where("state", "==", merchantState)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        } else {
            // no city, no state, just name
            await db.collection("merchants")
                .where("name", "==", lowercaseName)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        merchants.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });
        }
    } else if (merchantId !== null) {
        // else the user specified a merchant ID, which will return a single merchant
        console.log("getMerchants.merchantId = " + merchantId)
        await db.collection("merchants").where("merchID", "==", merchantId)
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    merchants.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting documents: ", error);
            });
    }
    return merchants;
}

/*
 * Get Accounts
 * Get all accounts for a given customer ID
 * @param customerID the customer ID for which to fetch all accounts
 */
async function getAccounts(customerID) {
    let accounts = []
    if (customerID !== null) {
        await db.collection("accounts").where("custID", "==", customerID)
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    accounts.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting documents: ", error);
            });
    } else {
        return null;
    }
    return accounts;
}

/*
 * getCustomerAddress
 * Get String Address for a given customer
 * @param customerID the customer ID for which to fetch all accounts
 * @return string address of the customer for the given ID, if no customer in the database then return null
 */
async function getCustomerAddress(customerID) {
    console.log("Entering getCustomerAddress for customerID " + customerID)
    let customers = []

    if (customerID !== null) {
        await db.collection("customers").where("custID", "==", customerID)
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    customers.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting customers: ", error);
            });
    } else {
        console.log("getCustomerAddress CustomerID was null")
        return null;
    }

    if ((customers !== null) && (customers.length > 0)) {
        return customers[0].street + ', ' + customers[0].city + ', ' + customers[0].state + ', ' + customers[0].zip
    } else {
        console.log("getCustomerAddress failed to get any customers for given ID")
        return null
    }
}

/* 
 * Get Accounts by Type
 * Returns accounts for a given CustomerID and Account Type
 * If no customer ID is specified, return NULL
 * INPUT: customerID (string), accountType (string)
 * OUTPUT: Accounts[]
 */
async function getAccountsByType(customerID, accountType) {
    let accounts = []
    console.log("Entered getAccountsByType")
    if (customerID !== null) {
        console.log("getAccountsByType.customerId !== null")
        console.log("getAccountsByType.customerId = " + customerID)
        console.log("getAccountsByType.accountType.toLowerCase() = " + accountType.toLowerCase())
        await db.collection("accounts")
            .where("custID", "==", customerID)
            .where("type", "==", accountType.toLowerCase())
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    accounts.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting documents: ", error);
            });
    } else {
        return null;
    }
    return accounts;
}

/*
 * Get Offers
 * For a given customer ID and list of merchants, get any offers
 */
async function getOffers(merchants, customerId) {
    console.log("entered getOffers")
    console.log("getOffers.merchants.length = " + merchants.length)
    console.log("getOffers.customerId = " + customerId)
    let offers = []

    for (var i = 0; i < merchants.length; i++) {
        await db.collection('offers')
            .where("merchID", "==", merchants[i].merchID)
            .where("custID", "==", customerId)
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    offers.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting offers: ", error);
            });

    }

    return offers;
}

/*
 * clearFirestoreTempTxnCollection
 * Empty out a firestore collection to clean up between runs
*/
async function clearFirestoreTempTxnCollection(accounts, collectionName) {
    console.log("Entering clearFirestoreTempTxnCollection for collection: " + collectionName)
    const oldCollectionRef = db.collection(collectionName);
    const batchSize = 10;
    for (const account of accounts) {
        let oldCollectionQuery = oldCollectionRef.where("acctID", '==', account.acctID).orderBy('__name__').limit(batchSize);

        return new Promise((resolve, reject) => {
            deleteQueryBatch(oldCollectionQuery, resolve).catch(reject);
        });
    }
}

/*
 * clearFirestoreTempCustCollection
 * Empty out a firestore collection to clean up between runs
*/
async function clearFirestoreTempCustCollection(custID) {
    console.log("Entering clearFirestoreTempCustCollection for custID: " + custID)
    const collectionRef = db.collection('cust_new_address');
    const batchSize = 10;
    let oldCollectionQuery = collectionRef.where("custID", '==', custID).orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(oldCollectionQuery, resolve).catch(reject);
    });
}

/*
 * deleteQueryBatch
 * Helper function to delete all docs for a given FS query
*/
async function deleteQueryBatch(query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}

/*
 * storePotentialFraudulentTransactions
 * Take transactions and put them in a temp collection in firestore for modification
 */
async function storePotentialFraudulentTransactions(transactions) {
    console.log("Entered storePotentialFraudulentTransactions")
    console.log("storePotentialFraudulentTransactions.transactions.length = " + transactions.length)
    for (const transaction of transactions) {
        //console.log(transaction)
        await db.collection('potential_fraud')
            .doc(transaction["txnID"].toString()).set(transaction)
    }
}

/*
 * getPotentialFraudulentTransactions
 * get Potential Fraudulent Transactions from the potential_fraud collection by account ID
 */
async function getPotentialFraudulentTransactions(accounts) {
    console.log("Entered getPotentialFraudulentTransactions")
    console.log("getPotentialFraudulentTransactions.accounts.length = " + accounts.length)
    let transactions = []

    for (var i = 0; i < accounts.length; i++) {
        await db.collection("potential_fraud")
            .where("acctID", "==", accounts[i].acctID)
            .orderBy('timestamp', 'desc')
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    transactions.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting transactions: ", error);
            });
    }

    return transactions;
}

/*
 * setNewCustomerAddress
 * Take a custID and new address and put them in a temp collection in firestore for this interaction
 */
async function setNewCustomerAddress(custID, newStreet, newCity, newState, newZip) {
    console.log("Entered storeNewCustomerAddress")
    console.log("storeNewCustomerAddress.custID = " + custID)
    console.log("storeNewCustomerAddress.newStreet = " + newStreet)
    console.log("storeNewCustomerAddress.newCity = " + newCity)
    console.log("storeNewCustomerAddress.newState = " + newState)
    console.log("storeNewCustomerAddress.newZip = " + newZip)


    //console.log(transaction)
    await db.collection('cust_new_address')
        .doc(custID.toString()).set({
            "street": newStreet,
            "city": newCity,
            "state": newState,
            "zip": newZip
        })
}

// List last transaction
async function listFirestoreLastTransactions(accounts) {
    let transactions = []

    for (var i = 0; i < accounts.length; i++) {
        await db.collection("transactions")
            .where("acctID", "==", accounts[i].acctID)
            .orderBy('timestamp', 'desc')
            .get()
            .then(function (querySnapshot) {
                querySnapshot.forEach(function (doc) {
                    transactions.push(doc.data())
                });
                return;
            })
            .catch(function (error) {
                console.log("Error getting transactions: ", error);
            });
    }

    return transactions;
}

/*
 * getFraudulentTxnByTransactionId
 * get an array of transactions by the transaction ID
 * @param transactionId the Transaction ID to look up
*/
async function getFraudulentTxnByTransactionId(transactionId) {
    let transactions = []

    await db.collection("potential_fraud")
        .where("txnID", "==", transactionId)
        .get()
        .then(function (querySnapshot) {
            querySnapshot.forEach(function (doc) {
                transactions.push(doc.data())
            });
            return;
        })
        .catch(function (error) {
            console.log("Error getting transactions: ", error);
        });

    return transactions;
}

/*
 * confirmFraudulentTransaction
 * Remove a transaction from the potential_fraud collection and add it to the dispute collection
*/
async function confirmFraudulentTransaction(transaction) {
    console.log('confirmFraudulentTransaction: ' + transaction[0]["txnID"])

    await db.collection('dispute')
        .doc(transaction[0]["txnID"].toString()).set(transaction[0])

    await db.collection("potential_fraud").doc(transaction[0]["txnID"].toString()).delete()

    return;
}

/*
 * listFirestoreTransactions
 * Fetch all of the firestore transactions based on the provided parameters
 * 
 * @param method
 * @param accounts
 * @param merchants
 * @param startDate
 * @param endDate
 */
async function listFirestoreTransactions(method, accounts, merchants, startDate, endDate) {
    let transactions = []
    console.log("Entered listFirestoreTransactions")
    console.log("listFirestoreTransactions.startDate ", startDate)
    console.log("listFirestoreTransactions.endDate ", endDate)

    if (method === "date" &
        accounts !== null &
        merchants !== null &
        startDate !== null &
        endDate !== null) {
        console.log("listFirestoreTransactions.method = date")
        console.log("listFirestoreTransactions.method = date.merchants.length = " + merchants.length)
        console.log("listFirestoreTransactions.method = date.accounts.length = " + accounts.length)
        for (var i = 0; i < merchants.length; i++) {
            for (var j = 0; j < accounts.length; j++) {
                await db.collection("transactions")
                    .where("merchID", "==", merchants[i].merchID)
                    .where("acctID", "==", accounts[j].acctID)
                    .where('timestamp', '>=', new Date(startDate))
                    .where('timestamp', '<=', new Date(endDate))
                    .orderBy('timestamp', 'desc')
                    .get()
                    .then(function (querySnapshot) {
                        querySnapshot.forEach(function (doc) {
                            transactions.push(doc.data())
                        });
                        return;
                    })
                    .catch(function (error) {
                        console.log("Error getting documents: ", error);
                    });
            }

        }
    } else if (method === "namedaccount") {
        console.log("listFirestoreTransactions.method = namedaccount")
        console.log("listFirestoreTransactions.method = namedaccount.accounts.length = " + accounts.length)
        for (var k = 0; k < accounts.length; k++) {
            console.log("listFirestoreTransactions.method = namedaccount.account[" + k + "].accountId = " + accounts[k].acctID)
            await db.collection("transactions")
                .where("acctID", "==", accounts[k].acctID)
                .get()
                .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        transactions.push(doc.data())
                    });
                    return;
                })
                .catch(function (error) {
                    console.log("Error getting documents: ", error);
                });

        }
    }
    return transactions;
}

/*
 * 
 * END FIRESTORE FUNCTIONS
 *
*/

/*
 * 
 * BEGIN HELPER FUNCTIONS
 *
*/

/*
 * fixFutureDate
 * Corrects any dates that are set in next year
 * @param potentialFutureDate a date of unknown year
 * @return correctedDate a date with a year NLT this year 
*/
function fixFutureDate(potentialFutureDate) {
    console.log("Entering fixFutureDate")
    let correctedDate = potentialFutureDate

    //moment library seems to want to put everything on UTC
    //fix that since our dates are -5
    if (moment(correctedDate).utcOffset() === 0) {
        console.log("setting UTC offset to -5")
        correctedDate = moment(correctedDate).utcOffset(-5)
    }

    //if, after moving to local time, the year is still 2021
    //then fix it
    if (moment(correctedDate).year() === 2021) {
        correctedDate = moment(correctedDate).subtract(1, 'years');
    }
    console.log("fixFutureDate.correctedDate = " + moment(correctedDate).unix())
    return correctedDate
}

/*
 * countWords
 * Counts words in a string
 */
function countWords(str) {
    return str.trim().split(/\s+/).length;
}

/*
 * uppercaseMonths
 * Capitalize month names
 */
function uppercaseMonths(str) {
    if (str.toLowerCase() === "january" ||
        str.toLowerCase() === "february" ||
        str.toLowerCase() === "march" ||
        str.toLowerCase() === "april" ||
        str.toLowerCase() === "may" ||
        str.toLowerCase() === "june" ||
        str.toLowerCase() === "july" ||
        str.toLowerCase() === "august" ||
        str.toLowerCase() === "september" ||
        str.toLowerCase() === "october" ||
        str.toLowerCase() === "november" ||
        str.toLowerCase() === "december") {
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
    } else {
        return str.toLowerCase
    }
}

/*
 * getPrettyMerchantName
 * Returns the merchant name from a merchant object with better capitalization
 * @param merchant the merchant object
 * @return the string with nicer capitalization
*/
function getPrettyMerchantName(merchant) {
    return merchant.name.replace(/(^\w|\s\w)/g, m => m.toUpperCase())
}

async function sortTransactions(unsortedTransactions) {
    return unsortedTransactions.sort((a, b) => {
        return moment(b.timestamp["_seconds"]).diff(a.timestamp["_seconds"]);
    });
}

/*
 * buildDFMessengerDisputeResponse
 * Build the pretty cards for each transaction with the ability to dispute any of them
 * @param transactions an array of transaction objects which are suspect
 * @return array of data to attach to the conversation in DF Messenger
*/
async function buildDFMessengerDisputeResponse(transactions) {
    console.log("Entered buildDFMessengerDisputeResponse")
    console.log("buildDFMessengerDisputeResponse.transactions.length = " + transactions.length)
    let returnArray = []
    if (transactions.length == 0) {
        console.log("buildDFMessengerDisputeResponse . Empty transactions list!")
    } else {
        for (const transaction of transactions) {
            //console.log(transaction)
            // For each transaction, format the timestamp more nicely for display
            let transactionTimestamp = transaction.timestamp["_seconds"]
            const formattedTimestamp = moment.unix(transactionTimestamp).format('LL');
            let txnAmt = transaction.amount
            // Get the merchant object for this transactions merchantID
            let merchant = await getMerchants(null, null, transaction.merchID, null, null)
            let merchantName = getPrettyMerchantName(merchant[0])
            let merchantCategory = merchant[0].category1
            merchantCategory = merchantCategory.split(' ').filter(s => s).join('')
            returnArray.push(
                [
                    {
                        'type': 'list',
                        'title': "$" + txnAmt + ' | ' + merchantName + ' | ' + formattedTimestamp,
                        'subtitle': 'Click To Dispute',
                        "event": {
                            "name": "dispute-event",
                            "link": "",
                            "languageCode": "",
                            "parameters": { "txnID": transaction.txnID }
                        }
                    }
                ]
            )
        }
        returnArray.push(
            [
                {
                    "type": "chips",
                    "options": [
                        {
                            "text": "All set, let's proceed to replace the card.",
                        }
                    ]
                }
            ]
        )
    }
    return returnArray
}

/*
 * 
 * END HELPER FUNCTIONS
 *
*/

/*
 * 
 * BEGIN FULFILLMENT FUNCTIONS
 *
*/

/*
 * Welcome Function
 */
async function welcome(agent) {
    console.log("Entered welcome fulfillment")
    let conv = agent.conv()
    let givenName = await getGivenName(agent);
    let customerID = await getFirestoreCustomerId(agent);
    console.log("welcome.givenName = " + givenName)
    console.log("welcome.customerID = " + customerID)
    let accounts = await getAccounts(customerID);
    let transactions = await listFirestoreLastTransactions(accounts);
    let returnArray = [];
    const sortedTransactions = await sortTransactions(transactions)

    let transactionTimestamp = sortedTransactions[0].timestamp["_seconds"]
    const formattedTimestamp = moment.unix(transactionTimestamp).format('LL');
    let merchant = await getMerchants(null, null, sortedTransactions[0].merchID, null, null)
    let merchantName = getPrettyMerchantName(merchant[0])
    let merchantCategory = merchant[0].category1
    console.log("welcome.merchantName = " + merchantName)
    console.log("welcome.merchantCategory = " + merchantCategory)

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        console.log("welcome from Google Assistant!")

        merchantCategory = merchantCategory.split(' ').filter(s => s).join('')
        conv.ask(`Welcome back ${givenName}!`)
        conv.ask(`Do you need help with your last transaction, which was for $${sortedTransactions[0].amount} on ${formattedTimestamp} at ${merchantName}?`)
        conv.ask(new Suggestions(["Yes", "No"]))

        agent.add(conv)

    } else {
        merchantCategory = merchantCategory.split(' ').filter(s => s).join('')
        returnArray.push(
            [{
                'type': 'info',
                'title': `$${sortedTransactions[0].amount}`,
                'subtitle': merchantName + ' | ' + formattedTimestamp,
                "image": {
                    "src": {
                        "rawUrl": `https://ruicosta.blog/wp-content/uploads/2020/08/${merchantCategory}.png`
                    }
                },
            },
            {
                "type": "chips",
                "options": [
                    {
                        "text": "No"
                    },
                    {
                        "text": "Yes"
                    }
                ]
            }]
        )

        //let cardLists = await getTransactionLists(returnArray)
        agent.add(`Welcome back ${givenName}! Do you need help with the following transaction?`);
        agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: returnArray },
            { sendAsMessage: true, rawPayload: true }));
    }

}

/*
 * fallback intent
 *
*/
function fallback(agent) {
    console.log("Entered fallback fulfillment")
    let conv = agent.conv()

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        console.log("fallbackresponse.GoogleAssistant")

        conv.ask("I'm sorry, I didn't get that.")

        agent.add(conv)
    } else {
        agent.add(`I didn't understand`);
        agent.add(new Suggestion("Quick Reply"));
        return agent.add(new Suggestion("Suggestion"));
    }
}

/*
 * reviewLastTxn
 * //TODO give the user some things to do with the last transaction
 */
async function reviewLastTxn(agent) {
    console.log('Entered reviewLastTxn fulfillment')
    let conv = agent.conv()

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask("I would love to tell you more details about this transaction, but my creator didn't build that yet.");
        agent.add(conv)
    } else {
        agent.add("This would be more detail about the transaction, but we haven't built that yet");
        agent.add("What else can I help you with today?")
    }
}


/*
 * noReviewLastTxn
 * This is triggered when the customer says "no" to whether they are inquiring about the most recent txn
*/
function noReviewLastTxn(agent) {
    let conv = agent.conv()

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask("Ok, then how can I help? Some of the things that I can do are:");
        conv.ask(new Suggestions(["Account balances", "Last 10 Checking Transactions", "Pay Card", "Lost Card"]))
        agent.add(conv)
    } else {
        agent.add(`Ok, then how can I help? Some of the things I can do are:`);
        let SUGGESTIONS = [
            [
                {
                    "type": "chips",
                    "options": [
                        {
                            "text": "Show me my account balances."
                        },
                        {
                            "text": "How much have I spent on coffee so far this year?"
                        },
                        {
                            "text": "Show me the last 5 transactions on my checking account."
                        },
                        {
                            "text": "I need to pay my credit card."
                        },
                        {
                            "text": "I lost my card."
                        }
                    ]
                }
            ]
        ]
        return agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: SUGGESTIONS },
            { sendAsMessage: true, rawPayload: true }));
    }
}


/*
 * List Transactions
 * 
 */
async function listTransactions(agent) {
    console.log("Entering listTransactions fulfillment")
    let conv = agent.conv()
    let accountType = agent.parameters.account_type ? agent.parameters.account_type : null;
    let listNumber = agent.parameters.number ? agent.parameters.number : null;
    let datePeriod = agent.parameters["date-period"] ? agent.parameters["date-period"] : null;
    console.log("listTransactions.accountType = " + accountType)
    console.log("listTransactions.listNumber = " + listNumber)
    console.log("listTransactions.datePeriod = " + datePeriod)
    let customerID = await getFirestoreCustomerId(agent);
    let accounts = await getAccountsByType(customerID, accountType);
    console.log("listTransactions.accounts.lenth = " + accounts.length)
    let transactions = await listFirestoreTransactions("namedaccount", accounts);
    console.log("got " + transactions.length + " transactions from listFirestoreTransactions(namedaccount, accounts)")

    let returnArray = [];

    if ((transactions !== null) && (transactions.length > 0)) {
        // If transactions were returned, then sort them by timestamp
        const sortedTransactions = await sortTransactions(transactions)

        for (var i = 0; i < listNumber; i++) {
            // For each transaction, format the timestamp more nicely for display
            let transactionTimestamp = sortedTransactions[i].timestamp["_seconds"]
            const formattedTimestamp = moment.unix(transactionTimestamp).format('LL');
            let txnAmt = sortedTransactions[i].amount
            // Get the merchant object for this transactions merchantID
            let merchant = await getMerchants(null, null, sortedTransactions[i].merchID, null, null)
            let merchantName = getPrettyMerchantName(merchant[0])
            let merchantCategory = merchant[0].category1
            console.log("listTransactions.merchantName = " + merchantName)
            console.log("listTransactions.merchantCategory = " + merchantCategory)
            console.log("listTransactions.txnAmt = " + txnAmt)

            if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
                console.log("listTransactions building return array for ACTIONS ON GOOGLE")
                returnArray.push(
                    [merchantName, "$" + txnAmt.toFixed(2).toString(), formattedTimestamp]
                )
            } else {
                console.log("listTransactions building return array for generic agent")
                merchantCategory = merchantCategory.split(' ').filter(s => s).join('')
                returnArray.push(
                    [{
                        'type': 'info',
                        'title': "$" + txnAmt.toFixed(2).toString(),
                        'subtitle': merchantName + ' | ' + formattedTimestamp,
                        "image": {
                            "src": {
                                "rawUrl": `https://ruicosta.blog/wp-content/uploads/2020/08/${merchantCategory}.png`
                            }
                        },
                    }]
                )
            }
        }

        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            conv.ask('Here are your transactions');
            conv.ask(new Table({
                dividers: true,
                columns: ['Merchant', 'Amount', 'Date'],
                rows: returnArray,
            }));

            agent.add(conv);
        } else {

            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: returnArray },
                { sendAsMessage: true, rawPayload: true }));
        }
    } else {
        // If there were no transactions returned for the account requested  
        agent.add("I'm sorry, I don't see any transactions for an account of that type.")
    }
}

/*
 * Get Accounts Snapshot
 * Get the balance and credit limit (if applicable) for all accounts for a given customer
 */
async function getAccountsSnapshot(agent) {
    console.log("Entering getAccountsSnapshot fulfillment")
    let conv = agent.conv()
    let customerID = await getFirestoreCustomerId(agent);
    let accounts = await getAccounts(customerID);

    let returnArray = [];

    for (const account of accounts) {
        // Capitalize the account type
        let acctType = account.type.replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        let acctBal = account.balance;
        let acctLimit = account.limit;
        if (account.limit === null || account.limit == "") {
            acctLimit = "N/A"
        }
        console.log("getAccountsSnapshot.acctType = " + acctType)
        console.log("getAccountsSnapshot.acctBal = " + acctBal)
        console.log("getAccountsSnapshot.acctLimit = " + acctLimit)

        // If we are coming from ACTIONS_ON_GOOGLE, build a table, else build a rich response card
        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            returnArray.push(
                [acctType, acctBal, acctLimit]
            )
        } else {
            returnArray.push(
                [{
                    'type': 'info',
                    'title': acctType,
                    'subtitle': "Balance: $" + acctBal + ". Limit: $" + acctLimit
                }])
        }
    }

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask('Here are your accounts');
        conv.ask(new Table({
            dividers: true,
            columns: ['Account', 'Balance', 'Limit'],
            rows: returnArray
        }));

        agent.add(conv);
    } else {
        agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: returnArray },
            { sendAsMessage: true, rawPayload: true }));
        agent.add("Is there anything else I can help you with today?")
    }
}

/*
 * checkSpend
 * Gets the aggregate spend for a given merchant name or category
 */
async function checkSpend(agent) {
    console.log("Entered checkSpend fulfillment")
    let conv = agent.conv()

    let OFFER_CARD = [
        [
            {
                "type": "info",
                "title": "Special Offer",
                "subtitle": "Info item subtitle",
                "image": {
                    "src": {
                        "rawUrl": "https://ruicosta.blog/wp-content/uploads/2020/08/offer.png"
                    }
                },
                "actionLink": "https://example.com"
            }
        ]
    ];

    console.log("checkSpend.agent.context")
    console.log(JSON.stringify(agent.context))

    let merchantCategory = null
    let merchantName = null

    // if there are neither specified in this request, then we need to populate with whatever is in the context from the last request
    if ((!Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_category'))
        && (!Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_name'))) {
        console.log("checkSpend populating merchant category and merchant name from context")
        merchantCategory = agent.context.get('check-spend-followup').parameters["merchant_category"] ? agent.context.get('check-spend-followup').parameters["merchant_category"] : null
        merchantName = agent.context.get('check-spend-followup').parameters["merchant_name"] ? agent.context.get('check-spend-followup').parameters["merchant_name"] : null
    } else if ((Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_category')) && (!Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_name'))) {
        // If parameters has a category, but no merchant name
        console.log("checkSpend.agent.context has a merchant category but no merchant name")
        merchantCategory = agent.parameters.merchant_category
    } else if ((!Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_category')) && (Object.prototype.hasOwnProperty.call(agent.parameters, 'merchant_name'))) {
        // If parameters has a name, but no merchant category
        console.log("checkSpend.agent.context has a merchant name but no merchant category")
        merchantName = agent.parameters.merchant_name
    } else {
        // If both are specified, grab them
        console.log("checkSpend.agent.context has both a merchant name and a merchant category")
        merchantName = agent.parameters.merchant_name
        merchantCategory = agent.parameters.merchant_category
    }
    console.log('checkSpend.merchantName = ' + merchantName)
    console.log('checkSpend.merchantCategory = ' + merchantCategory)

    let geoCity = agent.parameters["geo-city"] ? agent.parameters["geo-city"] : null;
    if (geoCity === null) {
        geoCity = agent.context.get('check-spend-followup').parameters["geo-city"] ? agent.context.get('check-spend-followup').parameters["geo-city"] : null
    }
    console.log("checkSpend.geoCity = " + geoCity)

    let geoState = agent.parameters["geo-state"] ? agent.parameters["geo-state"] : null;
    if (geoState === null) {
        geoState = agent.context.get('check-spend-followup').parameters["geo-state"] ? agent.context.get('check-spend-followup').parameters["geo-state"] : null
    }
    console.log("checkSpend.geoState = " + geoState)

    let datePeriod = agent.parameters["date-period"] ? agent.parameters["date-period"] : null;
    if (datePeriod === null) {
        datePeriod = agent.context.get('check-spend-followup').parameters["date-period"] ? agent.context.get('check-spend-followup').parameters["date-period"] : null
    }
    console.log("checkSpend.datePeriod = " + JSON.stringify(datePeriod))

    let datePeriodOriginal = agent.parameters["date-period.original"] ? agent.parameters["date-period.original"] : null;
    if (datePeriodOriginal === null) {
        datePeriodOriginal = agent.context.get('check-spend-followup').parameters["date-period.original"] ? agent.context.get('check-spend-followup').parameters["date-period.original"] : null
    }
    console.log("checkSpend.datePeriodOriginal = " + datePeriodOriginal)

    let customerID = await getFirestoreCustomerId(agent);
    console.log("checkSpend.customerID = " + customerID)

    let accounts = await getAccounts(customerID);
    console.log("checkSpend.accounts.length = " + accounts.length)

    let merchants = await getMerchants(merchantCategory, merchantName, null, geoCity, geoState)
    console.log("checkSpend.merchants.length = " + merchants.length)

    let offers = await getOffers(merchants, customerID)
    if ((offers !== null) && (offers.length > 0)) {
        console.log("checkSpend.offers.length = " + offers.length)
    } else {
        if (offers === null) {
            console.log("checkSpend.offers === null")
        } else {
            console.log("checkSpend.offers.length == 0")
        }
    }

    // Catch the situation if someone has said "yesterday" which becomes "this month"
    // and turn it into a proper datePeriod
    if (datePeriod == "yesterday") {
        console.log("checkSpend.datePeriod == yesterday")
        // set it to the right date period (today - 1)
        // example date-period from DF:
        // { "endDate": "2021-05-31T23:59:59-04:00", "startDate": "2021-05-01T00:00:00-04:00" }
        let startDate = moment().subtract(1, 'day')
        let endDate = moment()
        // initialize a new, empty datePeriod
        datePeriod = { "startDate": "", "endDate": "" }
        datePeriod.startDate = startDate
        datePeriod.endDate = endDate
        console.log("checkSpend.datePeriod.startDate = " + datePeriod.startDate)
        console.log("checkSpend.datePeriod.endDate = " + datePeriod.endDate)
        datePeriodOriginal = "yesterday"
    }

    // Clean up any dates that are set in the future
    let startDate = fixFutureDate(datePeriod.startDate)
    let endDate = fixFutureDate(datePeriod.endDate)
    let correctedDatePeriod = { "startDate": startDate, "endDate": endDate }

    // Now get the transactions using all of these parameters
    let transactions = await listFirestoreTransactions("date", accounts, merchants, startDate, endDate);
    console.log('checkSpend ', JSON.stringify(transactions))
    let sum = transactions.reduce(function (sum, d) {
        return sum + d.amount;
    }, 0);
    console.log('checkSpend.sum = ' + sum)

    // Set the context for follow - up questions
    if (merchantCategory != null)
        agent.context.set({
            'name': 'check-spend-followup',
            'lifespan': 5,
            'parameters': {
                'merchant_name': merchantName,
                'merchant_category': merchantCategory,
                'date-period': correctedDatePeriod,
                'geo-city': geoCity,
                'geo-state': geoState,
                'date-period.original': datePeriodOriginal
            }
        });

    console.log("checkSpend setting agent context")
    console.log(JSON.stringify(agent.context))
    console.log("checkSpend getting agent context (check-spend-followup)")
    console.log(JSON.stringify(agent.context.get('check-spend-followup')))

    // Prepare the output for the customer
    // If the customer hasn't spent anything
    if (transactions.length == 0) {
        console.log('checkSpend.transactions.length == 0')

        let noTxnString = "I could not find any transactions"
        if ((merchantCategory !== null) && (merchantCategory !== "all")) {
            noTxnString += " for " + merchantCategory
        } else if (merchantName !== null) {
            noTxnString += " at " + merchantName
        }

        if ((geoCity !== null) && (geoState !== null)) {
            noTxnString += " in " + geoCity + ", " + geoState
        } else if ((geoCity === null) && (geoState !== null)) {
            noTxnString += " in " + geoState
        } else if ((geoCity !== null) && (geoState === null)) {
            noTxnString += " in " + geoCity
        }


        if ( countWords(datePeriodOriginal) > 1 ) {
            noTxnString += " " + datePeriodOriginal + "."
        } else {
            noTxnString += " in " + uppercaseMonths(datePeriodOriginal) + "."
        }

        // vary response based on Google Assistant or other
        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            conv.ask(noTxnString)
        } else {
            agent.add(noTxnString)
        }
    }
    // If the customer hasn't spent anything, but has an offers for the merchant
    if ((transactions.length == 0) && (offers !== null) && (offers.length > 0)) {
        console.log('checkSpend.transactions.length == 0 && offers exist')
        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            //conv.ask("However, you're in luck! There's a special offer waiting for you.")
        } else {
            agent.add("However, you're in luck! There's a special offer waiting for you.")
        }
    }
    // If there is an offer
    if ((offers !== null) && (offers.length > 0)) {
        console.log('checkSpend.offers !== null && offers.length > 0')
        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            conv.ask(`We have a Special Offer for you. ${offers[0].offerText}`);
            // conv.ask(new BasicCard({
            //     "title": "Special Offer",
            //     "text": offers[0].offerText,
            //     "image": new Image({
            //         url: 'https://ruicosta.blog/wp-content/uploads/2020/08/offer.png',
            //         alt: 'Google Assistant logo'
            //     }),
            //     "buttons": {
            //         title: "Claim offer!",
            //         openUrlAction: offers[0].clickthroughURL
            //     }
            // }));
        } else {
            OFFER_CARD[0][0].subtitle = offers[0].offerText;
            OFFER_CARD[0][0].actionLink = offers[0].clickthroughURL;
            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: OFFER_CARD },
                { sendAsMessage: true, rawPayload: true }));
        }
    }
    // If the customer has spent something
    if (transactions.length > 0) {
        console.log('checkSpend.transactions.length > 0')

        let spendSummaryString = "You spent a total of $" + sum.toFixed(2).toString()
        if ((merchantCategory !== null) && (merchantCategory !== "all")) {
            spendSummaryString += " on " + merchantCategory
        } else if (merchantName !== null) {
            spendSummaryString += " at " + merchantName
        }

        if ((geoCity !== null) && (geoState !== null)) {
            spendSummaryString += " in " + geoCity + ", " + geoState
        } else if ((geoCity === null) && (geoState !== null)) {
            spendSummaryString += " in " + geoState
        } else if ((geoCity !== null) && (geoState === null)) {
            spendSummaryString += " in " + geoCity
        }

        if ( countWords(datePeriodOriginal) > 1 ) {
            spendSummaryString += " " + datePeriodOriginal + "."
        } else {
            spendSummaryString += " in " + uppercaseMonths(datePeriodOriginal) + "."
        }

        // vary response based on Google Assistant or other
        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            conv.ask(spendSummaryString)
        } else {
            agent.add(spendSummaryString)
        }
    }
    // If the user is here from GA, send the conv back with the check spend responses
    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        agent.add(conv)
    }
}

/*
 * noReviewTransactions
 * Skip reviewing transactions and get to replacing the card
 */
async function noReviewTransactions(agent) {
    console.log('Entering noReviewTransactions fulfillment')
    let conv = agent.conv()

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask(new Suggestions("Alright, let's get a new card sent out"))
        agent.add(conv);
    } else {

        let SUGGESTIONS = [[{
            "type": "chips",
            "options": [
                {
                    "text": "Alright, let's get a new card sent out."
                }
            ]
        }]]
        agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: SUGGESTIONS },
            { sendAsMessage: true, rawPayload: true }));
    }
}

/*
 * reviewTransactions
 * Pull the last transactions for the given account since the given date
 * Make a copy of the transactions to a new Firestore collection to avoid mucking with the data
 */
async function reviewTransactions(agent) {
    console.log('Entering reviewTransactions fulfillment')
    let conv = agent.conv()

    let lostDate = agent.context.get('review-transactions').parameters['date-time']

    // Fix if the user specifies a relative date and then the param includes startDate and endDate
    if ((lostDate.date_time !== undefined) && (lostDate.date_time !== null)) {
        console.log("lostDate has a date_time!")
        lostDate = lostDate.date_time
    } else if ((lostDate.startDate !== undefined) && (lostDate.startDate !== null)) {
        console.log("lostDate has a startDate!")
        lostDate = lostDate.startDate
    }
    console.log("reviewTransactions.lostDate = " + lostDate)

    // fix any year 2021 dates
    let startDate = fixFutureDate(lostDate)

    let endDate = moment()
    let accountType = agent.context.get('review-transactions').parameters['account_type']
    console.log('reviewTransactions.startDate = ' + startDate)
    console.log('reviewTransactions.endDate = ' + endDate)
    console.log('reviewTransactions.accountType = ' + accountType)

    // get Customer ID
    let customerID = await getFirestoreCustomerId(agent);
    console.log('reviewTransactions.customerID = ' + customerID)

    // Get ALL merchants
    let merchants = await getMerchants("all", "all", null, null, null)
    console.log('reviewTransactions.merchants.length = ' + merchants.length)

    // fetch the account object for the card that was lost
    let accounts = await getAccountsByType(customerID, accountType)
    console.log('reviewTransactions.accounts.length = ' + accounts.length)

    // clear out old 'potential fraud' for this account before we get started
    await clearFirestoreTempTxnCollection(accounts, 'potential_fraud')
    await clearFirestoreTempTxnCollection(accounts, 'dispute')

    // get the transactions since the lostDate
    let transactions = []
    transactions = await listFirestoreTransactions("date", accounts, merchants, startDate, endDate)
    console.log('reviewTransactions.transactions.length = ' + transactions.length)

    // Add transactions to a collection for modification during the fraud review process
    await storePotentialFraudulentTransactions(transactions)
    let potentiallyFraudulentTransactions = await getPotentialFraudulentTransactions(accounts)

    //TODO: Build a nice review for Google Assistant
    // PERHAPS use a browsing carousel?
    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask("Here we would show a list of transactions")
        conv.ask("But we didn't build that yet")
        conv.add(new Suggestions("All set. Please send me a new card."))
        agent.add(conv);
    } else {

        let returnArray = await buildDFMessengerDisputeResponse(potentiallyFraudulentTransactions)
        console.log('reviewTransactions.returnArray.length = ' + returnArray.length)
        if ((returnArray !== null) && (returnArray.length > 0)) {
            //let cardLists = await getTransactionLists(returnArray)
            agent.add(`Please click on a transaction below to dispute the charge.`);
            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: returnArray },
                { sendAsMessage: true, rawPayload: true }));
        } else {
            agent.add("I don't see any transactions since that date, so we will proceed to replace the card.")

            let SUGGESTIONS = [[{
                "type": "chips",
                "options": [
                    {
                        "text": "All set. Please send me a new card"
                    }
                ]
            }]]
            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: SUGGESTIONS },
                { sendAsMessage: true, rawPayload: true }));
        }
    }
}

async function disputeTransactions(agent) {
    console.log('Entering disputeTransactions fulfillment')
    let conv = agent.conv()

    console.log("agent.parameters")
    console.log(JSON.stringify(agent.parameters))
    // console.log('running disputeTransactions')
    let transaction = await getFraudulentTxnByTransactionId(agent.parameters.txnID)
    await confirmFraudulentTransaction(transaction)

    let accountType = agent.context.get('review-transactions').parameters['account_type']
    // // get Customer ID
    let customerID = await getFirestoreCustomerId(agent);
    // fetch the account object for the card that was lost
    let accounts = await getAccountsByType(customerID, accountType)
    let potentiallyFraudulentTransactions = await getPotentialFraudulentTransactions(accounts)


    //TODO: Dispute Transactions via Google Assistant
    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask('Review Transactions');

    } else {

        let returnArray = await buildDFMessengerDisputeResponse(potentiallyFraudulentTransactions)
        console.log('disputeTransactions.returnArray.length = ' + returnArray.length)
        if ((returnArray !== null) && (returnArray.length > 0)) {
            //let cardLists = await getTransactionLists(returnArray)
            agent.add("Ok, I will dispute that charge, are there any other charges form the list that are not yours?");
            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: returnArray },
                { sendAsMessage: true, rawPayload: true }));
        } else {
            agent.add("I don't see any more transactions since that date, so we will proceed to replace the card.")

            let SUGGESTIONS = [[{
                "type": "chips",
                "options": [
                    {
                        "text": "Ok, please send me a new card"
                    }
                ]
            }]]
            agent.add(new Payload(agent.UNSPECIFIED,
                { richContent: SUGGESTIONS },
                { sendAsMessage: true, rawPayload: true }));
        }
    }
}

/*
 * payCreditCard
 * Fulfillment action for when a user wants to pay a credit card
 * Get the balance of the credit card and the account the user wants to pay from
 */
async function payCreditCard(agent) {
    console.log('Entering disputeTransactions fulfillment')
    let conv = agent.conv()

    console.log("agent.context")
    console.log(JSON.stringify(agent.context))

    let customerID = await getFirestoreCustomerId(agent);
    let payToCardAcctType = agent.parameters.account_type ? agent.parameters.account_type : null;
    let payFromAcctType = agent.parameters.account_type1 ? agent.parameters.account_type1 : null;

    let payToAcct = await getAccountsByType(customerID, payToCardAcctType)
    let payFromAcct = await getAccountsByType(customerID, payFromAcctType)

    let toBalance = payToAcct[0].balance
    let fromBalance = payFromAcct[0].balance

    agent.context.set({
        'name': 'cardpaymentbalancecontext',
        'lifespan': 5,
        'parameters': {
            'toBalance': toBalance,
            'toAcctType': payToCardAcctType,
            'fromBalance': fromBalance,
            'fromAcctType': payFromAcctType
        }
    });

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask(`I can help you with paying your ${payToCardAcctType}.`)
        conv.ask(`The minimum payment is $75, and you currently have a balance of $${toBalance}. How much would you like to pay?`)
        agent.add(conv)
    } else {
        agent.add(`I can help you with paying your ${payToCardAcctType}.`)
        agent.add(`The minimum payment is $75, and you currently have a balance of $${toBalance}.`)
        agent.add(`Your ${payFromAcctType} has a balance of $${fromBalance}.`)
        agent.add("How much would you like to pay?")

        let SUGGESTIONS = [[{
            "type": "chips",
            "options": [
                {
                    "text": "$75.00"
                },
                {
                    "text": `$${toBalance}`
                }
            ]
        }]]
        agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: SUGGESTIONS },
            { sendAsMessage: true, rawPayload: true }));
    }
}

/*
 * validatePaymentAmount
 * Check that a user has entered a valid payment amount
 * If so, display new balances
 * If not, re-trigger question of how much to pay
 */
async function validatePaymentAmount(agent) {
    console.log('Entering validatePaymentAmount fulfillment')
    let conv = agent.conv()

    //console.log("console.log(agent.context)")
    //console.log(JSON.stringify(agent.context))

    console.log("agent.context.get('cardpaymentbalancecontext')")
    console.log(JSON.stringify(agent.context.get('cardpaymentbalancecontext')))

    let toBalance = agent.context.get('cardpaymentbalancecontext').parameters.toBalance
    let toAcctType = agent.context.get('cardpaymentbalancecontext').parameters.toAcctType
    let fromBalance = agent.context.get('cardpaymentbalancecontext').parameters.fromBalance
    let fromAcctType = agent.context.get('cardpaymentbalancecontext').parameters.fromAcctType
    let paymentAmount = agent.parameters["unit-currency"].amount
    console.log("validatePaymentAmount.toBalance = " + toBalance)
    console.log("validatePaymentAmount.toAcctType = " + toAcctType)
    console.log("validatePaymentAmount.fromBalance = " + fromBalance)
    console.log("validatePaymentAmount.fromAcctType = " + fromAcctType)
    console.log("validatePaymentAmount.paymentAmount = " + paymentAmount)

    // Check for invalid payment conditions, e.g. if they try to pay more than they have in the source account
    // TODO fix this checking - it doesn't seem that we can get the parameters back in the parent intent if we try to go back up to that level
    if (paymentAmount > fromBalance) {
        console.log("validatePaymentAmount.paymentAmount > fromBalance")
        agent.add(`I'm sorry, that's more than you have available in ${fromAcctType}.`)
        agent.parameters.set({
            'account_type': toAcctType,
            'account_type1': fromAcctType
        });
        agent.setFollowupEvent('cardPaymentEvent')
    } else {
        let newToBalance = (toBalance - paymentAmount).toFixed(2)
        let newFromBalance = (fromBalance - paymentAmount).toFixed(2)
        console.log("validatePaymentAmount.newToBalance = " + newToBalance)
        console.log("validatePaymentAmount.newFromBalance = " + newFromBalance)

        if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
            conv.ask(`Ok, you've paid $${paymentAmount} on your ${toAcctType}.`)
            conv.ask(`Your new balance on your ${toAcctType} is $${newToBalance}.`)
            conv.ask(`That was deducted from your ${fromAcctType}, which now has a balance of $${newFromBalance}.`)
            conv.ask("Is there anything else I can do for you?")
            agent.add(conv)

        } else {
            agent.add(`Ok, you've paid $${paymentAmount} on your ${toAcctType}.`)
            agent.add(`Your new balance on your ${toAcctType} is $${newToBalance}.`)
            agent.add(`That was deducted from your ${fromAcctType}, which now has a balance of $${newFromBalance}.`)
            agent.add("Is there anything else I can do for you?")
        }
    }
}


/*
 * replaceCard
 * Fulfillment for when a user needs a new card
*/
async function replaceCard(agent) {
    console.log('Entering replaceCard fulfillment')
    let conv = agent.conv()

    // get Customer ID
    let customerID = await getFirestoreCustomerId(agent);

    let customerAddress = await getCustomerAddress(customerID);
    console.log("replaceCard.customerAddress = " + customerAddress)

    let accountType = agent.parameters.account_type ? agent.parameters.account_type : null;
    if (accountType === null) {
        accountType = agent.context.get('review-transactions').parameters['account_type']
    }
    console.log("replaceCard.accountType = " + accountType)

    // Clear out any temp storage of updated addresses for this customer
    await clearFirestoreTempCustCollection(customerID)

    agent.context.set({
        'name': 'customerAddressContext',
        'lifespan': 5,
        'parameters': {
            'mailingAddress': customerAddress
        }
    });
    console.log("replaceCard.setting custom agent parameters!! ")
    console.log("replaceCard.agent.parameters")
    console.log(JSON.stringify(agent.parameters))

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask(`I can help with replacing your ${accountType} card. 
        I see it's the card ending in 5677.  
        Can you confirm that the replacement card 
        is going to: 
        ${customerAddress}?`)

        conv.ask(new Suggestions(["Yes.", "No, I need it sent somewhere else."]))
        agent.add(conv)
    } else {
        agent.add(`I can help with replacing your ${accountType} card. 
        I see it's the card ending in 5677.  
        Can you confirm that the replacement card 
        is going to: 
        ${customerAddress}?`)

        let SUGGESTIONS = [[{
            "type": "chips",
            "options": [
                {
                    "text": "Yes."
                },
                {
                    "text": "No, I need it sent somewhere else."
                }
            ]
        }]]
        agent.add(new Payload(agent.UNSPECIFIED,
            { richContent: SUGGESTIONS },
            { sendAsMessage: true, rawPayload: true }));
    }
}


/*
 * updateAddress
 * Take a new address if a customer needs a card sent somewhere new
 * Store it in a firestore collection for later reference
 */
async function updateAddress(agent) {
    console.log('Entering updateAddress fulfillment')
    let conv = agent.conv()

    // get Customer ID
    let customerID = await getFirestoreCustomerId(agent);

    let newStreet = agent.parameters["address"] ? agent.parameters["address"] : null;
    let newCity = agent.parameters["geo-city"] ? agent.parameters["geo-city"] : null;
    let newState = agent.parameters["geo-state"] ? agent.parameters["geo-state"] : null;
    let newZip = agent.parameters["zip-code"] ? agent.parameters["zip-code"] : null;

    if (newStreet === null || newCity === null || newState === null || newZip === null) {
        console.log("updateAddress some part of the address is null!")
        return;
    } else {
        await setNewCustomerAddress(customerID, newStreet, newCity, newState, newZip)
    }

    let printableNewAddress = newStreet + ', ' + newCity + ', ' + newState + ", " + newZip
    // console.log("updateAddress.printableNewAddress = " + printableNewAddress)

    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        conv.ask(`Ok, your new card will be sent to:
        ${printableNewAddress}`)
        conv.ask("It should arrive in 3-5 business days.")
        conv.ask("Is there anything else I can do for you?")
        agent.add(conv)
    } else {
        agent.add(`Ok, your new card will be sent to:
        ${printableNewAddress}`)
        agent.add("It should arrive in 3-5 business days.")
        agent.add("Is there anything else I can do for you?")
    }
}

// exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
app.use('/', (request, response) => {
    if (request.body.queryResult.fulfillmentMessages) {
        request.body.queryResult.fulfillmentMessages =
            request.body.queryResult.fulfillmentMessages.map(m => {
                if (!m.platform) {
                    // Set the platform to UNSPECIFIED instead of null.
                    m.platform = 'PLATFORM_UNSPECIFIED';
                }
                return m;
            });
    }
    const agent = new WebhookClient({ request, response });
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Default Welcome Intent - yes', reviewLastTxn);
    intentMap.set('Default Welcome Intent - no', noReviewLastTxn);
    intentMap.set('Default Fallback Intent', fallback);

    intentMap.set('list-transactions', listTransactions);
    intentMap.set('get.accounts-snapshot', getAccountsSnapshot);

    intentMap.set('check-spend', checkSpend);
    intentMap.set('check-spend.merchant-name', checkSpend);
    intentMap.set('check-spend.merchant-category', checkSpend);
    intentMap.set('check-spend.period', checkSpend);
    intentMap.set('check-spend.location', checkSpend);

    intentMap.set('payment.credit-card', payCreditCard);
    intentMap.set('payment.credit-card.amount', validatePaymentAmount)

    intentMap.set('lost-card.no', noReviewTransactions);
    intentMap.set('lost-card.yes', reviewTransactions);
    intentMap.set('dispute-review-transactions', disputeTransactions);
    intentMap.set('replacement.card', replaceCard);
    intentMap.set('replacement.card.no.newAddress', updateAddress);

    agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});

