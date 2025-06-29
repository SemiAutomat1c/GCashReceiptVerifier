# GCash Receipt Verification System

A browser-based tool to verify the authenticity of GCash receipts by comparing them against actual GCash transaction history.

## Features

- **Client-side Processing**: All verification happens in your browser. No data is sent to any server.
- **PDF Statement Import**: Automatically extract transaction data from GCash PDF statements.
- **Password Protection Support**: Handles password-protected GCash PDF statements.
- **Spreadsheet Support**: Import receipt submissions from Excel or CSV files.
- **Detailed Verification**: Checks reference numbers, amounts, and dates for discrepancies.
- **Downloadable Results**: Export verification results as an Excel file.

## How It Works

1. **Upload Spreadsheet**: Upload an Excel or CSV file containing receipt submissions. The file must include columns for Reference Number, Amount, and Date.
2. **Upload GCash PDF**: Upload your GCash PDF statement containing your actual transaction history.
3. **Enter PDF Password**: If your PDF is password-protected (as most GCash statements are), enter the password when prompted.
4. **Verify Receipts**: The system automatically compares the receipts against your transaction history.
5. **Review Results**: View color-coded verification results showing which receipts are verified, not found, or have mismatches.
6. **Download Report**: Export the verification results as an Excel file for record-keeping.

## Getting Started

### Option 1: Use the Web Version

1. Visit [https://your-website-url.com](https://your-website-url.com)
2. Follow the on-screen instructions to upload your files and verify receipts

### Option 2: Run Locally

1. Download or clone this repository
2. Open `index.html` in your web browser
3. Upload your spreadsheet and PDF files
4. Enter the PDF password if prompted
5. Click "Verify Receipts" to process the data

## Required File Formats

### Spreadsheet Format
Your spreadsheet should contain the following columns:
- **Reference Number**: The GCash reference number from the receipt
- **Amount**: The transaction amount
- **Date**: The transaction date

Column names can vary (e.g., "Ref No", "Payment", "Transaction Date"), and the system will attempt to identify them automatically.

### PDF Format
Upload the PDF statement you received from GCash. The system will extract transaction data including reference numbers, amounts, and dates.

Most GCash PDF statements are password-protected. You'll need to enter the password provided by GCash when you downloaded the statement. This is typically your mobile number or a portion of it.

## Privacy & Security

- All processing happens in your browser
- No data is uploaded to any server
- Your transaction data never leaves your computer
- The tool works offline after the page is loaded
- PDF passwords are only used locally and never stored or transmitted

## Troubleshooting

If you encounter issues:

1. **PDF Password Issues**: Make sure you're entering the correct password provided by GCash. This is typically your mobile number or a portion of it.
2. **PDF Extraction Problems**: Make sure your PDF is a genuine GCash statement.
3. **Spreadsheet Format Issues**: Ensure your spreadsheet contains the required columns (Reference Number, Amount, Date).
4. **No Results Found**: Check that the reference numbers in your spreadsheet match exactly with those in the GCash statement.

## Disclaimer

This tool is not affiliated with GCash or Globe Fintech Innovations, Inc. It is provided for verification purposes only.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 