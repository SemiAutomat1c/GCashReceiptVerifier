/**
 * GCash Receipt Verification System - Client-side verification script
 */

// Global variables
let spreadsheetData = null;
let pdfData = null;
let verificationResults = null;
let currentPdfFile = null;

// DOM elements
const spreadsheetFileInput = document.getElementById('spreadsheetFile');
const pdfFileInput = document.getElementById('pdfFile');
const spreadsheetUpload = document.getElementById('spreadsheetUpload');
const pdfUpload = document.getElementById('pdfUpload');
const spreadsheetInfo = document.getElementById('spreadsheetInfo');
const pdfInfo = document.getElementById('pdfInfo');
const verifyBtn = document.getElementById('verifyBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsTable = document.getElementById('resultsTable');
const downloadBtn = document.getElementById('downloadBtn');
const pdfPasswordContainer = document.getElementById('pdfPasswordContainer');
const pdfPasswordInput = document.getElementById('pdfPassword');
const submitPdfPasswordBtn = document.getElementById('submitPdfPassword');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');

  // Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Set up event listeners
  spreadsheetFileInput.addEventListener('change', handleSpreadsheetUpload);
  pdfFileInput.addEventListener('change', handlePdfFileSelected);
  verifyBtn.addEventListener('click', verifyReceipts);
  downloadBtn.addEventListener('click', downloadResults);
  submitPdfPasswordBtn.addEventListener('click', handlePdfPasswordSubmit);
  
  // Handle Enter key in password field
  pdfPasswordInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handlePdfPasswordSubmit();
    }
  });
  
  // Set up drag and drop
  setupDragAndDrop();
});

/**
 * Set up drag and drop functionality
 */
function setupDragAndDrop() {
  const spreadsheetDropZone = document.getElementById('spreadsheetUpload');
  const pdfDropZone = document.getElementById('pdfUpload');
  
  // Helper function to handle drag and drop
  function setupDropZone(dropZone, fileInput) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      fileInput.files = dt.files;
      
      // Trigger change event
      const event = new Event('change', { bubbles: true });
      fileInput.dispatchEvent(event);
    }, false);
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    function highlight() {
      dropZone.classList.add('active');
    }
    
    function unhighlight() {
      dropZone.classList.remove('active');
    }
  }
  
  // Set up both drop zones
  setupDropZone(spreadsheetDropZone, spreadsheetFileInput);
  setupDropZone(pdfDropZone, pdfFileInput);
}

/**
 * Handle spreadsheet file upload
 */
async function handleSpreadsheetUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    showLoading('Reading spreadsheet data...');
    
    // Check file type
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      throw new Error('Please upload a valid Excel or CSV file');
    }
    
    // Read the file
    const data = await readSpreadsheetFile(file);
    
    // Standardize reference numbers in the spreadsheet
    if (data && data.length > 0) {
      const firstRow = data[0];
      const refNumberKey = findColumnKey(firstRow, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
      
      if (refNumberKey) {
        console.log("Found reference number column:", refNumberKey);
        
        // Standardize all reference numbers in the spreadsheet
        data.forEach(row => {
          if (row[refNumberKey]) {
            row[refNumberKey] = standardizeReferenceNumber(row[refNumberKey]);
          }
        });
        
        console.log("Reference numbers in spreadsheet after standardization:", data.map(row => row[refNumberKey]));
      }
    }
    
    spreadsheetData = data;
    
    // Log the spreadsheet data for debugging
    console.log("Loaded spreadsheet data:", spreadsheetData);
    
    // Display column names for debugging
    if (spreadsheetData && spreadsheetData.length > 0) {
      const firstRow = spreadsheetData[0];
      console.log("Spreadsheet columns:", Object.keys(firstRow));
      
      // Try to identify reference number column
      const refNumberKey = findColumnKey(firstRow, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
      if (refNumberKey) {
        console.log("Found reference number column:", refNumberKey);
        console.log("Reference numbers in spreadsheet:", spreadsheetData.map(row => row[refNumberKey]));
      } else {
        console.log("Could not identify reference number column");
      }
    }
    
    // Display info about the uploaded file
    const receiptCount = data.length;
    spreadsheetInfo.innerHTML = `
      <div class="alert alert-success">
        <strong>File loaded:</strong> ${file.name}<br>
        <strong>Receipts found:</strong> ${receiptCount}<br>
        <button type="button" class="btn btn-sm btn-info mt-2" onclick="showSpreadsheetData()">
          Show Detected Transactions
        </button>
      </div>
    `;
    
    // Enable verify button if both files are uploaded
    checkEnableVerifyButton();
  } catch (error) {
    spreadsheetInfo.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    console.error('Error processing spreadsheet:', error);
  } finally {
    hideLoading();
  }
}

/**
 * Handle PDF file selection
 */
async function handlePdfFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    showLoading('Reading PDF data...');
    
    // Check file type
    if (!file.name.match(/\.pdf$/i)) {
      throw new Error('Please upload a valid PDF file');
    }
    
    // Store the file for later use (in case we need to re-read with password)
    currentPdfFile = file;
    
    try {
      // Try to extract text without password first
      const text = await extractPdfText(file);
      await processPdfData(text);
      
    } catch (error) {
      if (error.message.includes('password')) {
        // If PDF is password protected, wait for password input
        pdfInfo.innerHTML = `
          <div class="alert alert-warning">
            <strong>Password Required:</strong> Please enter the PDF password.
          </div>
        `;
        pdfPasswordContainer.style.display = 'block';
      } else {
        throw error;
      }
    }
  } catch (error) {
    pdfInfo.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    console.error('Error processing PDF:', error);
  } finally {
    hideLoading();
  }
}

/**
 * Handle PDF password submission
 */
async function handlePdfPasswordSubmit() {
  const password = pdfPasswordInput.value;
  
  if (!currentPdfFile || !password) return;
  
  try {
    showLoading('Reading password-protected PDF...');
    
    // Extract text from PDF with password
    const text = await extractPdfText(currentPdfFile, password);
    await processPdfData(text);
    
    // Hide password input
    pdfPasswordContainer.style.display = 'none';
  } catch (error) {
    pdfInfo.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    console.error('Error processing password-protected PDF:', error);
  } finally {
    hideLoading();
  }
}

/**
 * Show spreadsheet data in a modal for debugging
 */
function showSpreadsheetData() {
  if (!spreadsheetData || spreadsheetData.length === 0) {
    alert('No spreadsheet data available');
    return;
  }
  
  // Get column names from the first row
  const firstRow = spreadsheetData[0];
  const columns = Object.keys(firstRow);
  
  // Find key columns
  const refNumberKey = findColumnKey(firstRow, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
  const amountKey = findColumnKey(firstRow, ['Amount', 'Total', 'Value', 'Payment', 'Transaction Amount']);
  
  // Specifically look for "Date of Transaction" first, then fall back to other date columns
  let dateKey = null;
  const dateOfTransactionKeys = ['Date of Transaction'];
  for (const key of columns) {
    if (dateOfTransactionKeys.some(possibleKey => key.toLowerCase() === possibleKey.toLowerCase())) {
      dateKey = key;
      break;
    }
  }
  
  // If "Date of Transaction" not found, fall back to other date columns
  if (!dateKey) {
    dateKey = findColumnKey(firstRow, ['Date', 'Transaction Date', 'Payment Date', 'Timestamp']);
  }
  
  // Function to convert Excel numeric dates to readable format
  function formatDisplayDate(dateValue) {
    if (!dateValue) return '';
    
    const dateStr = dateValue.toString();
    
    // Handle Excel numeric date format (number of days since 1/1/1900)
    if (/^\d+(\.\d+)?$/.test(dateStr) && !dateStr.includes('/') && !dateStr.includes('-')) {
      // Convert Excel date number to JavaScript date
      const excelDateValue = parseFloat(dateStr);
      if (excelDateValue > 1000) { // Sanity check to ensure it's an Excel date
        // Excel's epoch starts on 1/1/1900, but Excel incorrectly treats 1900 as a leap year
        // So we need to adjust for dates after 2/28/1900
        const dateObj = new Date((excelDateValue - 1) * 86400000);
        
        // Check if the year is incorrect (showing as 2095 instead of 2025)
        let year = dateObj.getFullYear();
        if (year >= 2090 && year < 2100) {
          // Adjust the year (2095 should be 2025)
          year = year - 70; // Adjust by 70 years
        }
        
        // Format the date with the corrected year
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // If it's already in a date format, use formatDate function
    return formatDate(dateStr);
  }
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal fade" id="spreadsheetModal" tabindex="-1" aria-labelledby="spreadsheetModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="spreadsheetModalLabel">Spreadsheet Data</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <strong>Detected columns:</strong><br>
              ${refNumberKey ? `Reference Number: <strong>${refNumberKey}</strong><br>` : ''}
              ${amountKey ? `Amount: <strong>${amountKey}</strong><br>` : ''}
              ${dateKey ? `Date: <strong>${dateKey}</strong>` : ''}
            </div>
            <div class="table-responsive">
              <table class="table table-striped table-bordered">
                <thead>
                  <tr>
                    ${dateKey ? `<th>${dateKey}</th>` : ''}
                    ${refNumberKey ? `<th>${refNumberKey}</th>` : ''}
                    ${amountKey ? `<th>${amountKey}</th>` : ''}
                    ${columns.filter(col => col !== dateKey && col !== refNumberKey && col !== amountKey).map(col => `<th>${col}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${spreadsheetData.map(row => `
                    <tr>
                      ${dateKey ? `<td>${formatDisplayDate(row[dateKey])}</td>` : ''}
                      ${refNumberKey ? `<td>${row[refNumberKey] || ''}</td>` : ''}
                      ${amountKey ? `<td>${row[amountKey] || ''}</td>` : ''}
                      ${columns.filter(col => col !== dateKey && col !== refNumberKey && col !== amountKey).map(col => `<td>${row[col] || ''}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to document
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('spreadsheetModal'));
  modal.show();
  
  // Remove modal from DOM when hidden
  document.getElementById('spreadsheetModal').addEventListener('hidden.bs.modal', function() {
    document.body.removeChild(modalContainer);
  });
}

/**
 * Show detected transactions in a modal for debugging
 */
function showDetectedTransactions() {
  if (!pdfData || pdfData.length === 0) {
    alert('No transaction data available');
    return;
  }
  
  // Create modal HTML
  const modalHtml = `
    <div class="modal fade" id="transactionsModal" tabindex="-1" aria-labelledby="transactionsModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="transactionsModalLabel">Detected Transactions from PDF</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <strong>Total transactions found:</strong> ${pdfData.length}
            </div>
            <div class="table-responsive">
              <table class="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference Number</th>
                    <th>Amount</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  ${pdfData.map(t => `
                    <tr>
                      <td>${t.date}</td>
                      <td>${t.referenceNumber}</td>
                      <td>${t.amount}</td>
                      <td>${t.type || 'Unknown'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ${spreadsheetData ? `
              <div class="mt-3">
                <h6>Reference Numbers in Your Spreadsheet:</h6>
                <div class="alert alert-secondary">
                  <ul style="max-height: 200px; overflow-y: auto;">
                    ${spreadsheetData.map(row => {
                      const refKey = findColumnKey(row, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
                      return refKey ? `<li>${row[refKey]}</li>` : '';
                    }).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to document
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('transactionsModal'));
  modal.show();
  
  // Remove modal from DOM when hidden
  document.getElementById('transactionsModal').addEventListener('hidden.bs.modal', function() {
    document.body.removeChild(modalContainer);
  });
}

/**
 * Read spreadsheet file and parse data
 */
async function readSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Validate data structure
        if (jsonData.length === 0) {
          reject(new Error('No data found in spreadsheet'));
          return;
        }
        
        // Check for required columns
        const firstRow = jsonData[0];
        const hasRequiredColumns = checkForRequiredColumns(firstRow);
        
        if (!hasRequiredColumns) {
          reject(new Error('Spreadsheet missing required columns: Reference Number, Amount, and Date'));
          return;
        }
        
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Check if the spreadsheet has the required columns
 */
function checkForRequiredColumns(row) {
  // Look for variations of column names
  const refNumberVariations = ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber'];
  const amountVariations = ['Amount', 'Total', 'Value', 'Payment'];
  const dateVariations = ['Date', 'Transaction Date', 'Payment Date', 'Timestamp'];
  
  const hasRefNumber = refNumberVariations.some(name => 
    Object.keys(row).some(key => key.toLowerCase().includes(name.toLowerCase())));
  
  const hasAmount = amountVariations.some(name => 
    Object.keys(row).some(key => key.toLowerCase().includes(name.toLowerCase())));
  
  const hasDate = dateVariations.some(name => 
    Object.keys(row).some(key => key.toLowerCase().includes(name.toLowerCase())));
  
  return hasRefNumber && hasAmount && hasDate;
}

/**
 * Extract text from PDF file
 */
async function extractPdfText(file, password = '') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        
        // Load PDF.js if not already loaded
        if (!window.pdfjsLib) {
          reject(new Error('PDF.js library not loaded'));
          return;
        }
        
        // Set up PDF.js options with password
        const loadingTask = pdfjsLib.getDocument({
          data: typedArray,
          password: password
        });
        
        try {
          const pdf = await loadingTask.promise;
          console.log(`PDF loaded successfully. Number of pages: ${pdf.numPages}`);
          
          let fullText = '';
          
          // Extract text from each page
          for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Processing page ${i}/${pdf.numPages}`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Process text items to preserve table structure
            const pageText = processTextItems(textContent.items);
            fullText += pageText + '\n';
          }
          
          console.log("Full extracted text:", fullText);
          resolve(fullText);
        } catch (error) {
          // Check if it's a password error
          if (error.name === 'PasswordException') {
            reject(new Error('No password given'));
          } else {
            reject(error);
          }
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read the file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Process PDF text items to preserve table structure
 */
function processTextItems(items) {
  // Sort items by vertical position (y) and then by horizontal position (x)
  items.sort((a, b) => {
    if (Math.abs(a.transform[5] - b.transform[5]) < 3) {
      // If y positions are close, sort by x position
      return a.transform[4] - b.transform[4];
    }
    // Otherwise sort by y position (reversed because PDF coordinates start from bottom)
    return b.transform[5] - a.transform[5];
  });
  
  let lines = [];
  let currentLine = [];
  let currentY = null;
  
  // Group items into lines based on y position
  for (const item of items) {
    const y = Math.round(item.transform[5]);
    
    if (currentY === null) {
      currentY = y;
    }
    
    if (Math.abs(y - currentY) > 3) {
      // New line
      if (currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [];
      }
      currentY = y;
    }
    
    currentLine.push(item);
  }
  
  // Add the last line if it exists
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  // Convert lines to text
  const textLines = lines.map(line => {
    // Sort items in line by x position
    line.sort((a, b) => a.transform[4] - b.transform[4]);
    
    // Convert to text, preserving spacing
    let lineText = '';
    let lastX = 0;
    
    for (const item of line) {
      const x = Math.round(item.transform[4]);
      const spacing = x - lastX;
      
      // Add extra spaces to preserve table structure
      if (spacing > 10 && lineText !== '') {
        const spacesToAdd = Math.floor(spacing / 10);
        lineText += ' '.repeat(spacesToAdd);
      }
      
      lineText += item.str;
      lastX = x + (item.width || 0);
    }
    
    return lineText;
  });
  
  return textLines.join('\n');
}

/**
 * Process PDF data and extract transactions
 */
async function processPdfData(text) {
  try {
    console.log('Processing PDF data...');
    
    // Extract transactions from the PDF text
    const transactions = extractTransactionsFromPdfText(text);
    
    if (transactions.length === 0) {
      throw new Error('No transactions found in the PDF. Please check the format.');
    }
    
    console.log(`Found ${transactions.length} transactions in PDF`);
    
    // Standardize reference numbers in all transactions
    transactions.forEach(transaction => {
      if (transaction.referenceNumber) {
        transaction.referenceNumber = standardizeReferenceNumber(transaction.referenceNumber);
      }
    });
    
    // Store the transactions for verification
    pdfData = transactions;
    
    // Display info about the extracted data
    pdfInfo.innerHTML = `
      <div class="alert alert-success">
        <strong>Transactions found:</strong> ${transactions.length}<br>
        <button type="button" class="btn btn-sm btn-info mt-2" onclick="showDetectedTransactions()">
          Show Detected Transactions
        </button>
      </div>
    `;
    
    // Enable verify button if both files are uploaded
    checkEnableVerifyButton();
    
    return transactions;
  } catch (error) {
    console.error('Error processing PDF data:', error);
    pdfInfo.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error:</strong> ${error.message}
      </div>
    `;
    throw error;
  }
}

/**
 * Extract transactions from PDF text
 */
function extractTransactionsFromPdfText(pdfText) {
  const transactions = [];
  const lines = pdfText.split('\n');
  
  console.log("PDF Text extracted:", pdfText);
  console.log("Number of lines:", lines.length);
  
  // Try to detect if this is a GCash statement by looking for headers
  const isGCashStatement = pdfText.includes('GCash Transaction History') || 
                          pdfText.includes('Date and Time') || 
                          pdfText.includes('Reference No.') ||
                          pdfText.includes('STARTING BALANCE');
  
  if (isGCashStatement) {
    console.log("Detected GCash statement format");
    
    // Try the raw extraction first - most reliable for table data
    const rawTransactions = extractRawTransactions(lines);
    if (rawTransactions.length > 0) {
      console.log("Successfully extracted transactions using raw extraction");
      return rawTransactions;
    }
    
    // Try the exact GCash format parser
    const exactFormatTransactions = extractExactGCashFormat(lines);
    if (exactFormatTransactions.length > 0) {
      console.log("Successfully extracted transactions using exact format parser");
      return exactFormatTransactions;
    }
    
    // If that fails, try the general GCash parser
    return extractGCashTransactions(lines);
  }
  
  // Regular expressions for matching transaction data
  const refNumberRegex = /\b\d{10,}\b/; // 10+ digit number
  const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/; // MM/DD/YYYY or YYYY-MM-DD
  const amountRegex = /\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/; // Money format
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Look for lines with transaction data patterns
    const refMatch = line.match(refNumberRegex);
    const dateMatch = line.match(dateRegex);
    
    if (refMatch && dateMatch) {
      // Extract reference number and date
      const referenceNumber = refMatch[0];
      const date = dateMatch[0];
      
      // Look for amount
      const amountMatches = line.match(amountRegex);
      let amount = '';
      
      if (amountMatches && amountMatches.length > 0) {
        // Get the last match that's not the reference number
        for (let j = amountMatches.length - 1; j >= 0; j--) {
          if (amountMatches[j] !== referenceNumber) {
            amount = amountMatches[j].replace(/,/g, '');
            break;
          }
        }
      }
      
      // Only add if we have the essential data
      if (referenceNumber && date && amount) {
        transactions.push({
          date: formatDate(date),
          referenceNumber: referenceNumber,
          amount: parseFloat(amount)
        });
      }
    }
  }
  
  return transactions;
}

/**
 * Extract transactions directly from raw PDF text looking for patterns
 */
function extractRawTransactions(lines) {
  const transactions = [];
  console.log("Attempting raw transaction extraction");
  
  // First, find the header row
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if ((line.includes('Date and Time') || line.includes('Date')) && 
        line.includes('Reference No.') && 
        (line.includes('Debit') || line.includes('Credit'))) {
      headerIndex = i;
      console.log("Found header row at line", i, ":", line);
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log("Could not find header row");
    return [];
  }
  
  // Look for transaction rows after the header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip balance and total rows
    if (line.includes('STARTING BALANCE') || 
        line.includes('ENDING BALANCE') || 
        line.includes('Total Debit') || 
        line.includes('Total Credit')) {
      console.log("Skipping non-transaction line:", line);
      continue;
    }
    
    // Check if this looks like a transaction row (has date and reference number)
    const dateMatch = line.match(/\b\d{4}-\d{2}-\d{2}\b/);
    
    // Look specifically for GCash reference numbers (13-16 digits)
    // Not phone numbers which are typically 11 digits (09XXXXXXXXX)
    const refMatch = line.match(/\b(\d{13,16})\b/);
    
    if (dateMatch && refMatch) {
      console.log("Found transaction line:", line);
      
      const date = dateMatch[0];
      const referenceNumber = refMatch[1];
      console.log("Found reference number:", referenceNumber);
      
      // Extract amount - look for decimal numbers
      const amountPattern = /\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
      const amountMatches = line.match(amountPattern);
      
      if (amountMatches && amountMatches.length > 0) {
        // Determine if it's debit or credit
        // In GCash format, typically the debit column comes before credit
        let amount = 0;
        let isDebit = false;
        
        // Try to determine if it's debit or credit based on the column position
        // and the description
        if (amountMatches.length >= 2) {
          // If we have multiple amounts, try to determine which is debit/credit
          const firstAmount = parseFloat(amountMatches[0].replace(/,/g, ''));
          const secondAmount = parseFloat(amountMatches[1].replace(/,/g, ''));
          
          if (firstAmount > 0 && line.includes('Debit')) {
            amount = firstAmount;
            isDebit = true;
          } else if (secondAmount > 0 && line.includes('Credit')) {
            amount = secondAmount;
            isDebit = false;
          } else {
            // If can't determine from columns, use description
            amount = firstAmount > 0 ? firstAmount : secondAmount;
            isDebit = line.toLowerCase().includes('transfer to');
          }
        } else {
          // Just one amount
          amount = parseFloat(amountMatches[0].replace(/,/g, ''));
          isDebit = line.toLowerCase().includes('transfer to');
        }
        
        // Only add if we have the essential data
        if (referenceNumber && date && amount > 0) {
          const transaction = {
            date: formatDate(date),
            referenceNumber: referenceNumber,
            amount: amount,
            type: isDebit ? 'Debit' : 'Credit'
          };
          
          console.log("Added transaction (raw format):", transaction);
          transactions.push(transaction);
        } else {
          console.log("Missing essential data:", { referenceNumber, date, amount });
        }
      }
    }
  }
  
  return transactions;
}

/**
 * Extract transactions from GCash statement with exact format
 * Example: 2025-06-23 11:57 AM    Transfer from 09974808864 to 09217323157    1029953804654    700.00    1510.71
 */
function extractExactGCashFormat(lines) {
  const transactions = [];
  let headerFound = false;
  
  console.log("Trying exact GCash format parser");
  console.log("Raw lines:", lines);
  
  // Find the header row first
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`Checking line ${i}: "${line}"`);
    
    if ((line.includes('Date') || line.includes('Date and Time')) && 
        line.includes('Reference') && 
        (line.includes('Debit') || line.includes('Credit'))) {
      headerFound = true;
      headerIndex = i;
      console.log("Found header format at line", i, ":", line);
      break;
    }
  }
  
  if (!headerFound) {
    console.log("Could not find header row in exact format");
    return [];
  }
  
  // Process transaction lines
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip balance and total rows
    if (line.includes('STARTING BALANCE') || 
        line.includes('ENDING BALANCE') || 
        line.includes('Total Debit') || 
        line.includes('Total Credit')) {
      console.log("Skipping non-transaction line:", line);
      continue;
    }
    
    // Check if line has a date pattern (YYYY-MM-DD)
    if (line.match(/\b\d{4}-\d{2}-\d{2}\b/)) {
      console.log("Processing transaction line:", line);
      
      // Extract reference number - specifically looking for 13-16 digit numbers
      // which are typical for GCash reference numbers, not phone numbers (11 digits)
      const refMatch = line.match(/\b(\d{13,16})\b/);
      
      if (!refMatch) {
        console.log("No reference number found in line");
        continue;
      }
      
      const referenceNumber = refMatch[1];
      console.log("Found reference number:", referenceNumber);
      
      // Extract date
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) {
        console.log("No date found in line");
        continue;
      }
      
      const date = dateMatch[1];
      
      // Extract amount - look for decimal numbers
      const amountPattern = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
      const amountMatches = [...line.matchAll(amountPattern)].map(m => m[0]);
      
      if (!amountMatches || amountMatches.length === 0) {
        console.log("No amount found in line");
        continue;
      }
      
      // Find amounts that are not the reference number
      const amounts = amountMatches.filter(a => a !== referenceNumber);
      if (amounts.length === 0) {
        console.log("No valid amount found");
        continue;
      }
      
      console.log("Found amounts:", amounts);
      
      // Determine if it's debit or credit
      let amount = 0;
      let isDebit = false;
      
      // In GCash format, typically there are 3 amounts: debit, credit, and balance
      // If there's only one amount before balance, check if it's in debit or credit column
      if (amounts.length >= 3) {
        // Format is likely: [debit amount] [credit amount] [balance]
        const debitAmount = parseFloat(amounts[0].replace(/,/g, ''));
        const creditAmount = parseFloat(amounts[1].replace(/,/g, ''));
        
        if (debitAmount > 0) {
          amount = debitAmount;
          isDebit = true;
        } else {
          amount = creditAmount;
          isDebit = false;
        }
      } else if (amounts.length === 2) {
        // Format is likely: [transaction amount] [balance]
        // Determine if it's debit or credit based on description
        amount = parseFloat(amounts[0].replace(/,/g, ''));
        isDebit = line.toLowerCase().includes('transfer to');
      } else {
        // Just one amount - use it
        amount = parseFloat(amounts[0].replace(/,/g, ''));
      }
      
      // Only add if we have the essential data
      if (referenceNumber && date && amount > 0) {
        transactions.push({
          date: formatDate(date),
          referenceNumber: referenceNumber,
          amount: amount,
          type: isDebit ? 'Debit' : 'Credit'
        });
        
        console.log("Added transaction (exact format):", { 
          date: formatDate(date), 
          referenceNumber: referenceNumber, 
          amount: amount, 
          type: isDebit ? 'Debit' : 'Credit'
        });
      } else {
        console.log("Missing essential data:", { referenceNumber, date, amount });
      }
    }
  }
  
  return transactions;
}

/**
 * Extract transactions specifically from GCash statement format
 */
function extractGCashTransactions(lines) {
  const transactions = [];
  let inTransactionTable = false;
  let dateIndex = -1;
  let descriptionIndex = -1;
  let referenceIndex = -1;
  let debitIndex = -1;
  let creditIndex = -1;
  
  // Print all lines for debugging
  console.log("All lines from PDF:", lines);
  
  // First, find the header row to determine column positions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`Line ${i}: "${line}"`);
    
    if (line.includes('Date and Time') && 
        line.includes('Reference No.') && 
        (line.includes('Debit') || line.includes('Credit'))) {
      
      inTransactionTable = true;
      console.log("Found header row at line", i);
      
      // Try to determine column positions
      const parts = line.split(/\s{2,}|\t/).filter(part => part.trim() !== '');
      console.log("Header parts:", parts);
      
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j].trim().toLowerCase();
        if (part.includes('date')) dateIndex = j;
        if (part.includes('description')) descriptionIndex = j;
        if (part.includes('reference')) referenceIndex = j;
        if (part.includes('debit')) debitIndex = j;
        if (part.includes('credit')) creditIndex = j;
      }
      
      console.log("Found header row with indices:", { dateIndex, descriptionIndex, referenceIndex, debitIndex, creditIndex });
      continue;
    }
    
    // Skip until we find the header row
    if (!inTransactionTable) continue;
    
    // Skip balance rows and total rows
    if (line.includes('STARTING BALANCE') || 
        line.includes('ENDING BALANCE') || 
        line.includes('Total Debit') || 
        line.includes('Total Credit')) {
      console.log("Skipping balance/total line:", line);
      continue;
    }
    
    // Try to extract transaction data - look for date patterns
    if (line.match(/\d{4}-\d{2}-\d{2}/) || line.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
      console.log("Found potential transaction line:", line);
      
      // Special handling for the exact GCash format shown in the example
      // Example: 2025-06-23 11:57 AM    Transfer from 09974808864 to 09217323157    1029953804654    700.00    1510.71
      
      // Extract date
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (!dateMatch) continue;
      
      const date = dateMatch[1];
      
      // Look specifically for GCash reference numbers (13-16 digits)
      // Not phone numbers which are typically 11 digits (09XXXXXXXXX)
      const refMatch = line.match(/\b(\d{13,16})\b/);
      if (!refMatch) {
        console.log("No reference number found in line");
        continue;
      }
      
      const referenceNumber = refMatch[1];
      console.log("Found reference number:", referenceNumber);
      
      // Extract amount
      const amountPattern = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
      const amountMatches = [...line.matchAll(amountPattern)].map(m => m[0]);
      
      if (!amountMatches || amountMatches.length === 0) continue;
      
      // Determine if it's debit or credit
      let amount = 0;
      let type = '';
      
      if (amountMatches.length >= 2) {
        // If we have multiple amounts, the last one is usually the balance
        // Try to determine which is debit or credit based on the description
        if (line.toLowerCase().includes('transfer to')) {
          amount = parseFloat(amountMatches[0].replace(/,/g, ''));
          type = 'Debit';
        } else {
          amount = parseFloat(amountMatches[0].replace(/,/g, ''));
          type = 'Credit';
        }
      } else {
        amount = parseFloat(amountMatches[0].replace(/,/g, ''));
        type = line.toLowerCase().includes('transfer to') ? 'Debit' : 'Credit';
      }
      
      // Only add if we have the essential data
      if (referenceNumber && date && amount > 0) {
        transactions.push({
          date: formatDate(date),
          referenceNumber: referenceNumber,
          amount: amount,
          type: type
        });
        
        console.log("Added transaction (GCash format):", { 
          date: formatDate(date), 
          referenceNumber: referenceNumber, 
          amount: amount, 
          type: type
        });
      }
    } else if (referenceIndex >= 0) {
      // Try to extract data using column positions
      const parts = line.split(/\s{2,}|\t/).filter(part => part.trim() !== '');
      console.log("Line parts:", parts);
      
      if (parts.length > referenceIndex) {
        // Extract reference number from the reference column
        const refPart = parts[referenceIndex].trim();
        // Look specifically for GCash reference numbers (13-16 digits)
        const refMatch = refPart.match(/\b(\d{13,16})\b/);
        
        if (refMatch) {
          const referenceNumber = refMatch[1];
          console.log("Found reference number in column:", referenceNumber);
          
          // Extract date
          let date = '';
          if (dateIndex >= 0 && dateIndex < parts.length) {
            const datePart = parts[dateIndex].trim();
            const dateMatch = datePart.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
              date = dateMatch[1];
            }
          }
          
          // Extract amount
          let amount = 0;
          let type = '';
          
          if (debitIndex >= 0 && debitIndex < parts.length && parts[debitIndex].trim()) {
            const debitPart = parts[debitIndex].trim();
            const debitMatch = debitPart.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
            if (debitMatch) {
              amount = parseFloat(debitMatch[1].replace(/,/g, ''));
              type = 'Debit';
            }
          }
          
          if (amount === 0 && creditIndex >= 0 && creditIndex < parts.length && parts[creditIndex].trim()) {
            const creditPart = parts[creditIndex].trim();
            const creditMatch = creditPart.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
            if (creditMatch) {
              amount = parseFloat(creditMatch[1].replace(/,/g, ''));
              type = 'Credit';
            }
          }
          
          // Only add if we have the essential data
          if (referenceNumber && date && amount > 0) {
            transactions.push({
              date: formatDate(date),
              referenceNumber: referenceNumber,
              amount: amount,
              type: type
            });
            
            console.log("Added transaction (column format):", { 
              date: formatDate(date), 
              referenceNumber: referenceNumber, 
              amount: amount, 
              type: type
            });
          }
        }
      }
    }
  }
  
  return transactions;
}

/**
 * Format date to YYYY-MM-DD format
 */
function formatDate(dateStr) {
  // If already in YYYY-MM-DD format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.split(' ')[0]; // Remove time part if present
  }
  
  // Handle MM/DD/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    let year, month, day;
    
    // Determine which part is the year
    if (parts[2].length === 4) {
      // MM/DD/YYYY
      month = parts[0].padStart(2, '0');
      day = parts[1].padStart(2, '0');
      year = parts[2];
    } else if (parts[0].length === 4) {
      // YYYY/MM/DD
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    } else {
      // DD/MM/YYYY (assuming this format if year is last)
      day = parts[0].padStart(2, '0');
      month = parts[1].padStart(2, '0');
      year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    }
    
    return `${year}-${month}-${day}`;
  }
  
  // If we can't parse it, return as is
  return dateStr;
}

/**
 * Check if both files are uploaded to enable the verify button
 */
function checkEnableVerifyButton() {
  if (spreadsheetData && pdfData) {
    verifyBtn.disabled = false;
  }
}

/**
 * Verify all receipts against transaction data
 */
async function verifyReceipts() {
  if (!spreadsheetData || spreadsheetData.length === 0 || !pdfData || pdfData.length === 0) {
    alert('Please upload both spreadsheet and PDF files first.');
    return;
  }
  
  try {
    showLoading('Verifying receipts...');
    
    // Find duplicate reference numbers in the spreadsheet
    const duplicates = findDuplicateReceipts(spreadsheetData);
    
    // Verify each receipt
    verificationResults = spreadsheetData.map(receipt => {
      // Check if this receipt is a duplicate
      const refNumberKey = findColumnKey(receipt, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
      const isDuplicate = refNumberKey && duplicates.has(standardizeReferenceNumber(receipt[refNumberKey]));
      
      // Get the verification result
      const verificationResult = verifyReceipt(receipt);
      
      // If it's a duplicate and has another issue, stack the statuses
      if (isDuplicate && verificationResult.status !== 'Not Found') {
        return {
          ...verificationResult,
          status: `Duplicate, ${verificationResult.status}`,
          notes: `This reference number appears multiple times in your spreadsheet. ${verificationResult.notes}`
        };
      } else if (isDuplicate) {
        return {
          ...receipt,
          status: 'Duplicate',
          notes: 'This reference number appears multiple times in your spreadsheet'
        };
      }
      
      // Return the normal verification result
      return verificationResult;
    });
    
    // Display results
    displayResults();
    
    // Show results container
    resultsContainer.style.display = 'block';
  } catch (error) {
    alert(`Error verifying receipts: ${error.message}`);
    console.error('Error verifying receipts:', error);
  } finally {
    hideLoading();
  }
}

/**
 * Find duplicate reference numbers in the spreadsheet data
 * @param {Array} data - Spreadsheet data array
 * @returns {Set} - Set of duplicate reference numbers
 */
function findDuplicateReceipts(data) {
  const refNumbers = new Map();
  const duplicates = new Set();
  
  // Process each receipt
  for (const receipt of data) {
    // Find the reference number column
    const refNumberKey = findColumnKey(receipt, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
    
    if (refNumberKey && receipt[refNumberKey]) {
      const refNumber = standardizeReferenceNumber(receipt[refNumberKey]);
      
      // Check if we've seen this reference number before
      if (refNumbers.has(refNumber)) {
        duplicates.add(refNumber);
        console.log(`Found duplicate reference number: ${refNumber}`);
      } else {
        refNumbers.set(refNumber, true);
      }
    }
  }
  
  return duplicates;
}

/**
 * Verify a single receipt against transaction data
 */
function verifyReceipt(receipt) {
  // Find column names for reference number, amount, and date
  const refNumberKey = findColumnKey(receipt, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
  const amountKey = findColumnKey(receipt, ['Amount', 'Total', 'Value', 'Payment', 'Transaction Amount']);
  
  // Specifically look for "Date of Transaction" first, then fall back to other date columns
  let dateKey = null;
  const dateOfTransactionKeys = ['Date of Transaction'];
  for (const key of Object.keys(receipt)) {
    if (dateOfTransactionKeys.some(possibleKey => key.toLowerCase() === possibleKey.toLowerCase())) {
      dateKey = key;
      break;
    }
  }
  
  // If "Date of Transaction" not found, fall back to other date columns
  if (!dateKey) {
    dateKey = findColumnKey(receipt, ['Date', 'Transaction Date', 'Payment Date', 'Timestamp']);
  }
  
  if (!refNumberKey || !amountKey || !dateKey) {
    console.log("Could not identify required fields in spreadsheet:", receipt);
    return {
      ...receipt,
      status: 'Error',
      notes: 'Could not identify required fields in spreadsheet'
    };
  }
  
  // Extract and clean receipt data
  const refNumber = standardizeReferenceNumber(receipt[refNumberKey]);
  const amount = parseFloat(receipt[amountKey].toString().replace(/[^\d.-]/g, ''));
  const dateValue = receipt[dateKey].toString();
  const date = formatDate(dateValue);
  
  console.log("Verifying receipt:", { refNumber, amount, date, originalDate: dateValue, dateColumn: dateKey });
  console.log("Available transactions:", pdfData);
  
  // Log all reference numbers for comparison
  console.log("Receipt reference number:", refNumber);
  console.log("PDF reference numbers:", pdfData.map(t => t.referenceNumber));
  
  // ONLY use exact matching - no partial matches
  const matchingTransaction = pdfData.find(t => {
    const pdfRefNumber = t.referenceNumber;
    const exactMatch = pdfRefNumber === refNumber;
    
    // Detailed debugging
    console.log(`Comparing: PDF ref "${pdfRefNumber}" (${typeof pdfRefNumber}, length: ${pdfRefNumber.length}) vs Receipt ref "${refNumber}" (${typeof refNumber}, length: ${refNumber.length})`);
    console.log(`  Exact match? ${exactMatch}`);
    console.log(`  Character-by-character comparison:`);
    
    // Compare each character to identify where the mismatch is
    if (pdfRefNumber.length === refNumber.length && !exactMatch) {
      for (let i = 0; i < pdfRefNumber.length; i++) {
        if (pdfRefNumber[i] !== refNumber[i]) {
          console.log(`  Mismatch at position ${i}: PDF has "${pdfRefNumber[i]}" but receipt has "${refNumber[i]}"`);
        }
      }
    }
    
    if (exactMatch) console.log("Found exact match for", refNumber);
    return exactMatch;
  });
  
  // If no matching transaction found
  if (!matchingTransaction) {
    console.log("No match found for reference number:", refNumber);
    return {
      ...receipt,
      status: 'Not Found',
      notes: 'No matching reference number found in GCash records'
    };
  }
  
  console.log("Found matching transaction:", matchingTransaction);
  
  // Check if amount matches (with a small tolerance for rounding differences)
  const transactionAmount = matchingTransaction.amount;
  
  if (Math.abs(amount - transactionAmount) > 0.01) {
    return {
      ...receipt,
      status: 'Amount Mismatch',
      notes: `Receipt shows ${amount} but transaction record shows ${transactionAmount}`
    };
  }
  
  // Check if date matches (with some flexibility)
  let receiptDate;
  
  // Handle Excel numeric date format (number of days since 1/1/1900)
  if (/^\d+(\.\d+)?$/.test(dateValue) && !dateValue.includes('/') && !dateValue.includes('-')) {
    // Convert Excel date number to JavaScript date
    const excelDateValue = parseFloat(dateValue);
    if (excelDateValue > 1000) { // Sanity check to ensure it's an Excel date
      // Excel's epoch starts on 1/1/1900, but Excel incorrectly treats 1900 as a leap year
      // So we need to adjust for dates after 2/28/1900
      const dateObj = new Date((excelDateValue - 1) * 86400000);
      
      // Check if the year is incorrect (showing as 2095 instead of 2025)
      let year = dateObj.getFullYear();
      if (year >= 2090 && year < 2100) {
        // Adjust the year (2095 should be 2025)
        year = year - 70; // Adjust by 70 years
        
        // Create a new date with the corrected year
        receiptDate = new Date(year, dateObj.getMonth(), dateObj.getDate());
      } else {
        receiptDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      }
      
      console.log("Converted Excel date:", dateValue, "to", receiptDate.toISOString());
    } else {
      // If it's not a valid Excel date, try normal date parsing
      receiptDate = new Date(date);
    }
  } else {
    // Normal date string
    receiptDate = new Date(date);
  }
  
  // For transaction date, ensure we're working with the date part only
  let transactionDate;
  try {
    // First try to parse as is
    transactionDate = new Date(matchingTransaction.date);
    
    // If the transaction date is invalid, try to extract just the date part
    if (isNaN(transactionDate.getTime())) {
      const dateParts = matchingTransaction.date.split(/[\/\-]/);
      if (dateParts.length === 3) {
        // Try to parse as YYYY-MM-DD
        transactionDate = new Date(`${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`);
      }
    }
  } catch (e) {
    console.log("Error parsing transaction date:", e);
    transactionDate = new Date(); // Fallback to current date
  }
  
  console.log("Comparing dates:", receiptDate.toISOString(), "vs", transactionDate.toISOString());
  
  // Check if either date is invalid
  if (isNaN(receiptDate.getTime()) || isNaN(transactionDate.getTime())) {
    console.log("Invalid date detected:", { 
      receiptDate: receiptDate.toString(), 
      transactionDate: transactionDate.toString() 
    });
    
    // Try string comparison as fallback
    const receiptDateStr = dateValue.split(' ')[0]; // Get just the date part
    const transactionDateStr = matchingTransaction.date.split(' ')[0]; // Get just the date part
    
    console.log("Falling back to string comparison:", receiptDateStr, "vs", transactionDateStr);
    
    if (receiptDateStr !== transactionDateStr) {
      return {
        ...receipt,
        status: 'Date Mismatch',
        notes: `Receipt date (${receiptDateStr}) doesn't match transaction date (${transactionDateStr})`
      };
    }
  } else {
    // Allow for 24-hour difference to account for timezone issues
    const timeDiff = Math.abs(receiptDate - transactionDate) / (1000 * 60 * 60 * 24);
    console.log("Time difference in days:", timeDiff);
    
    // Compare only the date part (ignore time)
    const receiptDateOnly = new Date(receiptDate.getFullYear(), receiptDate.getMonth(), receiptDate.getDate());
    const transactionDateOnly = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
    const dateDiff = Math.abs(receiptDateOnly - transactionDateOnly) / (1000 * 60 * 60 * 24);
    console.log("Date-only difference in days:", dateDiff);
    
    // If the dates are more than 1 day apart
    if (dateDiff > 1) {
      return {
        ...receipt,
        status: 'Date Mismatch',
        notes: `Receipt date (${receiptDate.toDateString()}) doesn't match transaction date (${transactionDate.toDateString()})`
      };
    }
  }
  
  // If we got here, the receipt appears valid
  return {
    ...receipt,
    status: 'Verified',
    notes: 'All details match GCash records',
    matchedTransaction: matchingTransaction
  };
}

/**
 * Find a column key in the receipt data based on possible variations
 */
function findColumnKey(receipt, possibleKeys) {
  for (const key of Object.keys(receipt)) {
    for (const possibleKey of possibleKeys) {
      if (key.toLowerCase().includes(possibleKey.toLowerCase())) {
        return key;
      }
    }
  }
  return null;
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
  // Handle stacked statuses by checking if status contains specific keywords
  if (status.includes('Duplicate') && (status.includes('Amount Mismatch') || status.includes('Date Mismatch'))) {
    return 'status-duplicate-mismatch'; // Special class for duplicate + mismatch
  } else if (status.includes('Duplicate')) {
    return 'status-duplicate';
  } else if (status.includes('Not Found')) {
    return 'status-not-found';
  } else if (status.includes('Amount Mismatch') || status.includes('Date Mismatch')) {
    return 'status-mismatch';
  } else if (status.includes('Verified')) {
    return 'status-verified';
  } else {
    return '';
  }
}

/**
 * Display verification results in the table
 */
function displayResults() {
  // Clear previous results
  resultsTable.innerHTML = '';
  
  // Count results by status
  const statusCounts = {
    'Verified': 0,
    'Not Found': 0,
    'Amount Mismatch': 0,
    'Date Mismatch': 0,
    'Duplicate': 0,
    'Error': 0
  };
  
  // Function to convert Excel numeric dates to readable format
  function formatDisplayDate(dateValue) {
    if (!dateValue) return '';
    
    const dateStr = dateValue.toString();
    
    // Handle Excel numeric date format (number of days since 1/1/1900)
    if (/^\d+(\.\d+)?$/.test(dateStr) && !dateStr.includes('/') && !dateStr.includes('-')) {
      // Convert Excel date number to JavaScript date
      const excelDateValue = parseFloat(dateStr);
      if (excelDateValue > 1000) { // Sanity check to ensure it's an Excel date
        // Excel's epoch starts on 1/1/1900, but Excel incorrectly treats 1900 as a leap year
        // So we need to adjust for dates after 2/28/1900
        const dateObj = new Date((excelDateValue - 1) * 86400000);
        
        // Check if the year is incorrect (showing as 2095 instead of 2025)
        let year = dateObj.getFullYear();
        if (year >= 2090 && year < 2100) {
          // Adjust the year (2095 should be 2025)
          year = year - 70; // Adjust by 70 years
        }
        
        // Format the date with the corrected year
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // If it's already in a date format, use formatDate function
    return formatDate(dateStr);
  }
  
  // Add each result to the table
  verificationResults.forEach(result => {
    // Find column names for reference number, amount, and date
    const refNumberKey = findColumnKey(result, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
    const amountKey = findColumnKey(result, ['Amount', 'Total', 'Value', 'Payment', 'Transaction Amount']);
    
    // Specifically look for "Date of Transaction" first, then fall back to other date columns
    let dateKey = null;
    const dateOfTransactionKeys = ['Date of Transaction'];
    for (const key of Object.keys(result)) {
      if (dateOfTransactionKeys.some(possibleKey => key.toLowerCase() === possibleKey.toLowerCase())) {
        dateKey = key;
        break;
      }
    }
    
    // If "Date of Transaction" not found, fall back to other date columns
    if (!dateKey) {
      dateKey = findColumnKey(result, ['Date', 'Transaction Date', 'Payment Date', 'Timestamp']);
    }
    
    // Extract data
    const refNumber = result[refNumberKey] || '';
    const amount = result[amountKey] || '';
    const dateValue = result[dateKey] || '';
    const formattedDate = formatDisplayDate(dateValue);
    const status = result.status || 'Unknown';
    const notes = result.notes || '';
    
    // Update status counts - handle stacked statuses
    if (status.includes('Duplicate')) {
      statusCounts['Duplicate']++;
    }
    if (status.includes('Not Found')) {
      statusCounts['Not Found']++;
    }
    if (status.includes('Amount Mismatch')) {
      statusCounts['Amount Mismatch']++;
    }
    if (status.includes('Date Mismatch')) {
      statusCounts['Date Mismatch']++;
    }
    if (status.includes('Verified')) {
      statusCounts['Verified']++;
    }
    if (status.includes('Error')) {
      statusCounts['Error']++;
    }
    
    // Create row
    const row = document.createElement('tr');
    
    // Add status class based on the status
    if (status.includes('Duplicate') && (status.includes('Amount Mismatch') || status.includes('Date Mismatch'))) {
      row.classList.add('table-info'); // Use info color but with a border or indicator for mismatch
      row.style.borderLeft = '5px solid #ffc107'; // Add a warning-colored left border
    } else if (status.includes('Duplicate')) {
      row.classList.add('table-info');
    } else if (status.includes('Not Found')) {
      row.classList.add('table-danger');
    } else if (status.includes('Amount Mismatch') || status.includes('Date Mismatch')) {
      row.classList.add('table-warning');
    } else if (status === 'Verified') {
      row.classList.add('table-success');
    }
    
    // Add cells
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${refNumber}</td>
      <td>${amount}</td>
      <td class="${getStatusClass(status)}">${status}</td>
      <td>${notes}</td>
    `;
    
    // Add to table
    resultsTable.appendChild(row);
  });
  
  // Add summary above the table
  const summaryDiv = document.createElement('div');
  summaryDiv.className = 'alert alert-info mb-3';
  summaryDiv.innerHTML = `
    <strong>Summary:</strong> 
    ${statusCounts.Verified} verified, 
    ${statusCounts['Not Found']} not found, 
    ${statusCounts['Amount Mismatch'] + statusCounts['Date Mismatch']} mismatches,
    ${statusCounts.Duplicate} duplicates,
    ${statusCounts.Error} errors
  `;
  
  resultsContainer.insertBefore(summaryDiv, resultsContainer.firstChild);
}

/**
 * Download verification results as CSV
 */
function downloadResults() {
  if (!verificationResults || verificationResults.length === 0) {
    alert('No results to download');
    return;
  }
  
  try {
    // Function to convert Excel numeric dates to readable format
    function formatDisplayDate(dateValue) {
      if (!dateValue) return '';
      
      const dateStr = dateValue.toString();
      
      // Handle Excel numeric date format (number of days since 1/1/1900)
      if (/^\d+(\.\d+)?$/.test(dateStr) && !dateStr.includes('/') && !dateStr.includes('-')) {
        // Convert Excel date number to JavaScript date
        const excelDateValue = parseFloat(dateStr);
        if (excelDateValue > 1000) { // Sanity check to ensure it's an Excel date
          // Excel's epoch starts on 1/1/1900, but Excel incorrectly treats 1900 as a leap year
          // So we need to adjust for dates after 2/28/1900
          const dateObj = new Date((excelDateValue - 1) * 86400000);
          
          // Check if the year is incorrect (showing as 2095 instead of 2025)
          let year = dateObj.getFullYear();
          if (year >= 2090 && year < 2100) {
            // Adjust the year (2095 should be 2025)
            year = year - 70; // Adjust by 70 years
          }
          
          // Format the date with the corrected year
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      // If it's already in a date format, use formatDate function
      return formatDate(dateStr);
    }
    
    // Count results by status
    const verified = verificationResults.filter(r => r.status === 'Verified').length;
    const notFound = verificationResults.filter(r => r.status === 'Not Found').length;
    const amountMismatch = verificationResults.filter(r => r.status === 'Amount Mismatch').length;
    const dateMismatch = verificationResults.filter(r => r.status === 'Date Mismatch').length;
    const duplicates = verificationResults.filter(r => r.status === 'Duplicate').length;
    const total = verificationResults.length;
    
    // Create CSV content
    let csvContent = 'Date,Reference Number,Amount,Status,Notes\n';
    
    // Add summary
    csvContent += `Summary,,,,\n`;
    csvContent += `Total,${total},,,\n`;
    csvContent += `Verified,${verified},,,\n`;
    csvContent += `Not Found,${notFound},,,\n`;
    csvContent += `Amount Mismatch,${amountMismatch},,,\n`;
    csvContent += `Date Mismatch,${dateMismatch},,,\n`;
    csvContent += `Duplicates,${duplicates},,,\n`;
    csvContent += `\n`;
    
    // Add results
    verificationResults.forEach(result => {
      // Find column keys
      const refNumberKey = findColumnKey(result, ['Reference Number', 'Ref Number', 'Ref No', 'Reference', 'RefNumber', 'Transaction Reference Number']);
      const amountKey = findColumnKey(result, ['Amount', 'Total', 'Value', 'Payment', 'Transaction Amount']);
      
      // Specifically look for "Date of Transaction" first, then fall back to other date columns
      let dateKey = null;
      const dateOfTransactionKeys = ['Date of Transaction'];
      for (const key of Object.keys(result)) {
        if (dateOfTransactionKeys.some(possibleKey => key.toLowerCase() === possibleKey.toLowerCase())) {
          dateKey = key;
          break;
        }
      }
      
      // If "Date of Transaction" not found, fall back to other date columns
      if (!dateKey) {
        dateKey = findColumnKey(result, ['Date', 'Transaction Date', 'Payment Date', 'Timestamp']);
      }
      
      // Extract data
      const refNumber = result[refNumberKey] || '';
      const amount = result[amountKey] || '';
      const dateValue = result[dateKey] || '';
      const formattedDate = formatDisplayDate(dateValue);
      const status = result.status || '';
      const notes = result.notes || '';
      
      // Add to CSV
      csvContent += `"${formattedDate}","${refNumber}","${amount}","${status}","${notes}"\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'verification_results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert(`Error downloading results: ${error.message}`);
    console.error('Error downloading results:', error);
  }
}

/**
 * Show loading overlay
 */
function showLoading(message) {
  loadingMessage.textContent = message || 'Processing...';
  loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  loadingOverlay.style.display = 'none';
}

/**
 * Standardize reference number format
 * This helps ensure consistent formatting between PDF and spreadsheet
 */
function standardizeReferenceNumber(refNumber) {
  if (!refNumber) return '';
  
  // Convert to string if it's not already
  refNumber = refNumber.toString();
  
  // Trim whitespace
  refNumber = refNumber.trim();
  
  // Remove all non-digit characters
  refNumber = refNumber.replace(/[^0-9]/g, '');
  
  console.log("Standardized reference number:", refNumber);
  
  return refNumber;
}