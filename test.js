const puppeteer = require('puppeteer');
const xlsx = require('xlsx');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config(); // Load environment variables

// Read API keys from environment variables
const CAPTCHA_API_KEY = process.env.CAPTCHA_API_KEY;
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY; // This is for identifying the reCAPTCHA on the page
const RECAPTCHA_SERVER_KEY = process.env.RECAPTCHA_SERVER_KEY; // Not used in this case, just for reference

// Custom delay function to simulate human typing speed with a random delay (1-2 seconds)
async function delay(minTime = 3000, maxTime = 5000) {
    const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise(resolve => setTimeout(resolve, randomDelay));
}

// Function to generate a random 10-character unique ID
function generateUniqueID() {
    // Define the characters allowed in the ID
    const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$@_';
    let id = ''; // Initialize an empty string to store the ID

    // Loop 10 times to generate a 10-character ID
    for (let i = 0; i < 10; i++) {
        // Pick a random character from the characters string
        id += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Return the generated unique ID
    return id;
}

// Main function to run the program
function main() {
    // Generate a unique ID by calling the generateUniqueID function
    const uniqueID = generateUniqueID();

    // Display the unique ID in the console
    console.log('Generated Unique ID:', uniqueID);
}

// Call the main function to execute the program
main();


// Function to solve CAPTCHA using 2Captcha API
async function solveCaptcha(page) {
    const siteKey = await page.$eval('.g-recaptcha', el => el.getAttribute('data-sitekey'));
    console.log('Site Key:', siteKey);

    const requestUrl = `http://2captcha.com/in.php?key=${CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${page.url()}`;
    const response = await axios.get(requestUrl);

    if (!response.data.includes('OK|')) {
        throw new Error('Failed to submit CAPTCHA request: ' + response.data);
    }

    console.log('response', response.data);

    const captchaId = response.data.split('|')[1];
    console.log('CAPTCHA ID:', captchaId);

    let captchaSolution;

    // Poll for the CAPTCHA solution
    while (true) {
        const resultUrl = `http://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${captchaId}`;
        const resultResponse = await axios.get(resultUrl);

        if (resultResponse.data === 'CAPCHA_NOT_READY') {
            console.log('CAPTCHA not ready yet, waiting...');
            await delay(6000, 8000); // Wait 5-7 seconds
            continue;
        }

        if (resultResponse.data.includes('OK|')) {
            captchaSolution = resultResponse.data.split('|')[1];
            console.log('CAPTCHA Solved:', captchaSolution);
            break;
        } else {
            throw new Error('Failed to retrieve CAPTCHA solution: ' + resultResponse.data);
        }
    }

    // Inject CAPTCHA solution and trigger the necessary event
    await page.evaluate((captchaSolution) => {
        console.log("Injecting CAPTCHA Solution...");
        const recaptchaResponseField = document.querySelector('textarea[name="g-recaptcha-response"]');
        recaptchaResponseField.value = captchaSolution;
        // Trigger the change event to notify the frontend
        const event = new Event('change', { bubbles: true });
        recaptchaResponseField.dispatchEvent(event);
    }, captchaSolution);

    // Wait for the iframe containing the CAPTCHA to load and click the checkbox
    const iframeElement = await page.waitForSelector('.g-recaptcha iframe');
    const iframe = await iframeElement.contentFrame();
    await iframe.click('.recaptcha-checkbox');
    console.log('Captcha checkbox clicked automatically.');

    return captchaSolution;
}

// Function to handle the manual resume upload (no change needed)
async function uploadResumeManually(page) {
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
        throw new Error('File input field not found');
    }

    console.log('Waiting for the user to manually upload the resume...');
    // Wait for the file input to be populated (user has uploaded the file)
    await page.waitForFunction('document.querySelector("input[type=\'file\']").files.length > 0', { timeout: 0 });
    console.log('File uploaded manually by the user!');
}

// Function to simulate typing each character of a text field one by one
async function typeCharacterByCharacter(page, selector, text) {
    for (let i = 0; i < text.length; i++) {
        await page.type(selector, text[i], { delay: 400 }); // Type each character with a small delay
    }
}

// Function to handle processing each row of the Excel file
async function processRow(browser, row) {
    const page = await browser.newPage();
    const startTime = Date.now(); // Track start time of this row

    try {
        await page.goto('https://login-c-chi-52.vercel.app/', { waitUntil: 'domcontentloaded' });

        const [regdNo, name, email, branch, gender, account, number] = row;

        // Start filling the form with the data
        await typeCharacterByCharacter(page, '#regd_no', regdNo); // Registration Number
        console.log('Filling Registration Number:', regdNo);
        await delay(3000, 5000); // Random delay between 1-2 seconds

        await typeCharacterByCharacter(page, '#name', name); // Name
        console.log('Filling Name:', name);
        await delay(3000, 5000); // Random delay between 1-2 seconds

        await typeCharacterByCharacter(page, '#email', email); // Email
        console.log('Filling Email:', email);
        await delay(6000, 8000); // Random delay between 1-2 seconds

        await page.select('#branch', branch); // Branch
        console.log('Selecting Branch:', branch);
        await delay(4000, 7000); // Random delay between 1-2 seconds

        // Gender selection (Male or Female)
        if (gender === 'Male') {
            await page.click('input[name="gender"][value="male"]');
            console.log('Selecting Male gender');
        } else if (gender === 'Female') {
            await page.click('input[name="gender"][value="female"]');
            console.log('Selecting Female gender');
        }

        await delay(4000, 5000); // Random delay between 1-2 seconds

        // Bank account selection and handling input
        if (account.toLowerCase() === "yes") {
            await page.click('input[name="bank_account"][value="yes"]');
            console.log("Selected Yes for Bank Account");

            await page.waitForSelector("#account_number", { visible: true });
            await typeCharacterByCharacter(page, "#account_number", number);
            console.log("Filling IBAN Number:", number);
        } else {
            await page.click('input[name="bank_account"][value="no"]');
            console.log("Selected No for Bank Account");

            await page.waitForSelector("#wallet_number", { visible: true });
            await typeCharacterByCharacter(page, "#wallet_number", number);
            console.log("Filling Binance Account Number:", number);
        }

        await delay(4000, 5000); // Random delay between 1-2 seconds

        // Wait for user to manually upload the resume
        await uploadResumeManually(page);

        // No need to manually click CAPTCHA now, the API will handle it

        // Solve CAPTCHA
        const captchaSolution = await solveCaptcha(page);
        await page.evaluate((captchaSolution) => {
            console.log("Injecting CAPTCHA Solution...");
            document.querySelector('textarea[name="g-recaptcha-response"]').value = captchaSolution;
        }, captchaSolution);

        console.log('CAPTCHA Solved and injected', captchaSolution);

        // Wait for the CAPTCHA checkbox to be visible before clicking it
        await page.waitForSelector('.recaptcha-checkbox', { visible: true }); // Removed timeout
        await page.click('.recaptcha-checkbox'); // Click the checkbox to confirm CAPTCHA
        console.log('Captcha checkbox clicked automatically.');

        // Submit the form
        await page.click('input[type="submit"]');
        console.log('Form Submitted');
        await page.waitForNavigation({ waitUntil: 'load' });
        console.log('Form Submitted Successfully!');

        // Generate and return a random ID
        const randomId = generateUniqueID();
        console.log('Generated Unique ID:', randomId); // Added log to explicitly print the ID

        const endTime = Date.now(); // Track end time of this row
        console.log(`Time taken for this row: ${(endTime - startTime) / 1000} seconds`);

        return randomId;
    } catch (err) {
        console.error('Error processing row:', row, err);
        return null;
    }
}

// Function to handle writing generated IDs to Excel file at the end
function saveIDToExcel(uniqueID) {
    const filePath = path.join(__dirname, 'loginfile.xlsx');
    if (fs.existsSync(filePath)) {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Find the next empty row under column "H"
        let row = 2; // Start from row 2 (assuming row 1 is headers)
        while (sheet[`H${row}`]) {
            row++;
        }

        // Add the unique ID to the "ID" column (H)
        sheet[`H${row}`] = { v: uniqueID };

        // Write the updated workbook back to the file
        xlsx.writeFile(workbook, filePath);
        console.log('Unique ID saved to Excel file:', uniqueID);
    } else {
        console.log('Excel file not found!');
    }
}

// Main function to read data from Excel and process each row
async function fillForm() {
    const browser = await puppeteer.launch({ headless: false });
    const overallStartTime = Date.now(); // Start timer for overall execution

    try {
        // Read the data from Excel file
        const workbook = xlsx.readFile(path.join(__dirname, 'loginfile.xlsx'));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // Ensure there's data beyond the headers
        if (data.length < 2) {
            console.error('No data found in Excel file.');
            return;
        }

        // Add "ID" header if it doesn't exist
        if (!data[0].includes('ID')) {
            data[0].push('ID');
        }

        // Process each row and collect random IDs
        for (let i = 1; i < data.length; i++) {
            console.log(`Processing row ${i}:`, data[i]);
            const randomId = await processRow(browser, data[i]);
            if (randomId !== null) {
                data[i][7] = randomId; // Add the unique ID to the 8th column (H)
            }
        }

        // Write the updated data with IDs to a new Excel file
        const updatedSheet = xlsx.utils.aoa_to_sheet(data);
        const updatedWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(updatedWorkbook, updatedSheet, 'Sheet1');
        xlsx.writeFile(updatedWorkbook, path.join(__dirname, 'loginfile_with_IDs.xlsx'));

        console.log('Updated Excel file written successfully!');
    } catch (err) {
        console.error('Error in fillForm:', err);
    } finally {
        const overallEndTime = Date.now(); // Track overall execution time
        console.log(`Overall execution time: ${(overallEndTime - overallStartTime) / 1000} seconds`);
        await browser.close();
    }
}

// Run the fillForm function
fillForm();
