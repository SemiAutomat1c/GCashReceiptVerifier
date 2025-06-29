/**
 * GCash Receipt Verification System
 * 
 * This system compares submitted GCash receipts against actual GCash transaction data
 * to identify fake or altered receipts.
 */

// Configuration
const config = {
  spreadsheetId: '', // Add your Google Sheet ID here
  receiptSheetName: 'Form Responses', // The sheet containing form submissions
  transactionSheetName: 'GCash Transactions', // The sheet containing actual GCash transactions
  verificationSheetName: 'Verification Results', // The sheet where verification results will be stored
};

/**
 * Main function to run the verification process
 */
function verifyAllReceipts() {
  console.log('Starting receipt verification process...');
  
  // Get data from sheets
  const receiptData = getReceiptData();
  const transactionData = getTransactionData();
  
  // Verify each receipt
  const results = [];
  for (let i = 0; i < receiptData.length; i++) {
    const receipt = receiptData[i];
    const result = verifyReceipt(receipt, transactionData);
    results.push(result);
  }
  
  // Save results
  saveVerificationResults(results);
  
  console.log(`Verification complete. ${results.length} receipts processed.`);
}

/**
 * Get receipt data from form submissions
 */
function getReceiptData() {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName(config.receiptSheetName);
  
  if (!sheet) {
    console.error(`Sheet "${config.receiptSheetName}" not found.`);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const emailIndex = headers.indexOf('Email Address');
  const nameIndex = headers.indexOf('Your Name');
  const batchIndex = headers.indexOf('Batch ID');
  const dateIndex = headers.indexOf('Transaction Date');
  const refNumberIndex = headers.indexOf('Reference Number');
  const amountIndex = headers.indexOf('Amount');
  const imageIndex = headers.indexOf('Receipt Image');
  
  // Extract receipt data
  const receipts = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    receipts.push({
      rowIndex: i + 1,
      timestamp: row[0], // Submission timestamp
      email: emailIndex >= 0 ? row[emailIndex] : '',
      name: nameIndex >= 0 ? row[nameIndex] : '',
      batchId: batchIndex >= 0 ? row[batchIndex] : '',
      date: dateIndex >= 0 ? row[dateIndex] : '',
      referenceNumber: refNumberIndex >= 0 ? row[refNumberIndex] : '',
      amount: amountIndex >= 0 ? row[amountIndex] : '',
      imageUrl: imageIndex >= 0 ? row[imageIndex] : '',
      verified: false,
      status: 'Pending',
      notes: '',
    });
  }
  
  return receipts;
}

/**
 * Get transaction data from GCash transaction sheet
 */
function getTransactionData() {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.getSheetByName(config.transactionSheetName);
  
  if (!sheet) {
    console.error(`Sheet "${config.transactionSheetName}" not found. Creating it...`);
    createTransactionSheet();
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices
  const dateIndex = headers.indexOf('Date');
  const refNumberIndex = headers.indexOf('Reference Number');
  const amountIndex = headers.indexOf('Amount');
  const typeIndex = headers.indexOf('Transaction Type');
  const recipientIndex = headers.indexOf('Recipient');
  
  // Extract transaction data
  const transactions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    transactions.push({
      date: dateIndex >= 0 ? row[dateIndex] : '',
      referenceNumber: refNumberIndex >= 0 ? row[refNumberIndex] : '',
      amount: amountIndex >= 0 ? row[amountIndex] : '',
      type: typeIndex >= 0 ? row[typeIndex] : '',
      recipient: recipientIndex >= 0 ? row[recipientIndex] : '',
    });
  }
  
  return transactions;
}

/**
 * Create the transaction sheet if it doesn't exist
 */
function createTransactionSheet() {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ss.insertSheet(config.transactionSheetName);
  
  // Add headers
  sheet.appendRow([
    'Date', 
    'Reference Number', 
    'Amount', 
    'Transaction Type', 
    'Recipient', 
    'Notes'
  ]);
  
  // Format the sheet
  sheet.getRange('A1:F1').setFontWeight('bold');
  sheet.setFrozenRows(1);
  
  // Add instructions
  sheet.getRange('A2:F2').merge();
  sheet.getRange('A2').setValue('Import your GCash transaction history here. You can copy-paste from your GCash app or exported statement.');
  
  console.log(`Created "${config.transactionSheetName}" sheet.`);
}

/**
 * Create the verification results sheet if it doesn't exist
 */
function createVerificationSheet() {
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet = ss.getSheetByName(config.verificationSheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(config.verificationSheetName);
    
    // Add headers
    sheet.appendRow([
      'Timestamp',
      'Email',
      'Name',
      'Batch ID',
      'Date',
      'Reference Number',
      'Amount',
      'Image URL',
      'Verification Status',
      'Notes',
      'Verified By',
      'Verified At'
    ]);
    
    // Format the sheet
    sheet.getRange('A1:L1').setFontWeight('bold');
    sheet.setFrozenRows(1);
    
    console.log(`Created "${config.verificationSheetName}" sheet.`);
  }
  
  return sheet;
}

/**
 * Verify a single receipt against transaction data
 */
function verifyReceipt(receipt, transactions) {
  // Clean the reference number (remove spaces, etc.)
  const cleanRefNumber = receipt.referenceNumber.toString().trim().replace(/\s+/g, '');
  
  // Try to find a matching transaction
  const matchingTransaction = transactions.find(t => {
    const transactionRefNumber = t.referenceNumber.toString().trim().replace(/\s+/g, '');
    return transactionRefNumber === cleanRefNumber;
  });
  
  // Prepare the result
  const result = {
    ...receipt,
    verified: false,
    status: 'Unverified',
    notes: '',
    verifiedBy: '',
    verifiedAt: ''
  };
  
  // If no matching transaction found
  if (!matchingTransaction) {
    result.status = 'Not Found';
    result.notes = 'No matching transaction found in GCash records.';
    return result;
  }
  
  // Check if amount matches
  const receiptAmount = parseFloat(receipt.amount.toString().replace(/[^\d.-]/g, ''));
  const transactionAmount = parseFloat(matchingTransaction.amount.toString().replace(/[^\d.-]/g, ''));
  
  if (Math.abs(receiptAmount - transactionAmount) > 0.01) {
    result.status = 'Amount Mismatch';
    result.notes = `Receipt shows ${receiptAmount} but transaction record shows ${transactionAmount}`;
    return result;
  }
  
  // Check if date matches (with some flexibility)
  const receiptDate = new Date(receipt.date);
  const transactionDate = new Date(matchingTransaction.date);
  
  // Allow for 24-hour difference to account for timezone issues and date format differences
  const timeDiff = Math.abs(receiptDate - transactionDate) / (1000 * 60 * 60 * 24);
  
  if (timeDiff > 1) {
    result.status = 'Date Mismatch';
    result.notes = `Receipt date (${receiptDate.toDateString()}) doesn't match transaction date (${transactionDate.toDateString()})`;
    return result;
  }
  
  // If we got here, the receipt appears valid
  result.verified = true;
  result.status = 'Verified';
  result.notes = 'All details match GCash records.';
  result.verifiedBy = 'System';
  result.verifiedAt = new Date().toISOString();
  
  return result;
}

/**
 * Save verification results to the verification sheet
 */
function saveVerificationResults(results) {
  const sheet = createVerificationSheet();
  
  // Prepare the data rows
  const dataRows = results.map(r => [
    r.timestamp,
    r.email,
    r.name,
    r.batchId,
    r.date,
    r.referenceNumber,
    r.amount,
    r.imageUrl,
    r.status,
    r.notes,
    r.verifiedBy,
    r.verifiedAt
  ]);
  
  // Clear existing data (except headers)
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
  }
  
  // Add new data
  if (dataRows.length > 0) {
    sheet.getRange(2, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
  }
  
  // Apply conditional formatting for status column
  const statusColumn = 9; // Column I
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    // Remove existing conditional formatting rules
    const rules = sheet.getConditionalFormatRules();
    sheet.clearConditionalFormatRules();
    
    // Add new rules
    let range = sheet.getRange(2, statusColumn, lastRow - 1, 1);
    
    // Verified = Green
    let rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Verified')
      .setBackground('#b7e1cd')
      .setRanges([range])
      .build();
    rules.push(rule);
    
    // Not Found = Red
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Not Found')
      .setBackground('#f4c7c3')
      .setRanges([range])
      .build();
    rules.push(rule);
    
    // Amount Mismatch = Orange
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Amount Mismatch')
      .setBackground('#fce8b2')
      .setRanges([range])
      .build();
    rules.push(rule);
    
    // Date Mismatch = Yellow
    rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Date Mismatch')
      .setBackground('#fff2cc')
      .setRanges([range])
      .build();
    rules.push(rule);
    
    sheet.setConditionalFormatRules(rules);
  }
  
  console.log(`Saved ${results.length} verification results to sheet.`);
}

/**
 * Create a menu in the Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('GCash Verification')
    .addItem('Verify All Receipts', 'verifyAllReceipts')
    .addItem('Create Transaction Sheet', 'createTransactionSheet')
    .addItem('Create Verification Sheet', 'createVerificationSheet')
    .addToUi();
}

/**
 * Import GCash transactions from CSV
 */
function importTransactionsFromCsv() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.prompt(
    'Import GCash Transactions',
    'Paste your CSV data below (make sure columns match Date, Reference Number, Amount, Type, Recipient):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() == ui.Button.OK) {
    const csvData = response.getResponseText();
    const rows = csvData.split('\n');
    
    const ss = SpreadsheetApp.openById(config.spreadsheetId);
    let sheet = ss.getSheetByName(config.transactionSheetName);
    
    if (!sheet) {
      sheet = createTransactionSheet();
    }
    
    // Clear existing data (except headers)
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
    }
    
    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].split(',');
      if (row.length >= 3) { // Ensure we have at least date, ref number, and amount
        sheet.appendRow([
          row[0].trim(), // Date
          row[1].trim(), // Reference Number
          row[2].trim(), // Amount
          row.length > 3 ? row[3].trim() : '', // Transaction Type (if available)
          row.length > 4 ? row[4].trim() : '', // Recipient (if available)
          '' // Notes
        ]);
      }
    }
    
    ui.alert('Import Complete', `Imported ${rows.length} transactions.`, ui.ButtonSet.OK);
  }
} 