/**
 * script.js
 * Asynchronously fetches CSV data from a published Google Sheet,
 * parses it, and dynamically populates the HTML document based on Unique_IDs.
 */

// 1. Fetch Logic: Placeholder for the Google Sheets CSV "Publish to Web" link
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQr6wegUTldLyoaq7qifjk7u3mAW0ixZkpCrSsqu5-WAr53OY-WcGHH1d9grbU7lUCmQ8HElBoh5FRj/pub?output=csv";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch data. HTTP Status: ${response.status}`);
        }
        
        const csvString = await response.text();
        
        // Parse the CSV string into structured data
        const dataObjects = parseCSV(csvString);
        
        // Map the parsed data onto the DOM elements
        populateDOM(dataObjects);
        
    } catch (error) {
        console.error("Error initializing dynamic content:", error);
    }
});

/**
 * 2. CSV Parsing Logic
 * Parses a standard CSV string into an array of objects. 
 * Correctly handles commas and newlines contained within double-quoted strings.
 * * @param {string} csvText - The raw CSV string
 * @returns {Array<Object>} - Array of objects keyed by the CSV header row
 */
function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let currentStr = '';
    let insideQuotes = false;

    // Character-by-character parsing to safely handle quoted multiline strings
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            currentStr += '"'; // Handle escaped quotes ("")
            i++; 
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            row.push(currentStr);
            currentStr = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; // Skip \n in \r\n
            row.push(currentStr);
            if (row.length > 0 || currentStr !== '') rows.push(row);
            row = [];
            currentStr = '';
        } else {
            currentStr += char;
        }
    }
    
    // Push the very last element and row if the file doesn't end with a newline
    if (row.length > 0 || currentStr !== '') {
        row.push(currentStr);
        rows.push(row);
    }

    if (rows.length < 2) return [];

    // Extract headers and trim whitespace
    const headers = rows[0].map(h => h.trim());
    const dataObjects = [];

    // Map rows to objects
    for (let i = 1; i < rows.length; i++) {
        // Skip empty rows
        if (rows[i].length === 1 && rows[i][0].trim() === '') continue; 
        
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = rows[i][j] ? rows[i][j].trim() : '';
        }
        dataObjects.push(obj);
    }

    return dataObjects;
}

/**
 * 3 & 4. Data-to-DOM Mapping and Error Handling
 * Loops through parsed data, finds corresponding DOM elements, and injects content.
 * * @param {Array<Object>} data - Array of row objects from the CSV
 */
function populateDOM(data) {
    data.forEach(item => {
        const { Unique_ID, Element_Type, Content_Body } = item;
        if (!Unique_ID) return; // Skip if no ID is present

        const element = document.getElementById(Unique_ID);
        
        // 4. Error Handling: Log warning if ID doesn't exist and continue
        if (!element) {
            console.warn(`Warning: Element with ID '${Unique_ID}' not found in the DOM. Skipping.`);
            return; 
        }

        const type = (Element_Type || '').toLowerCase();

        // 3. Conditional Rendering Logic
        if (['h1', 'h2', 'h3', 'p'].includes(type)) {
            // Stripping out leading markdown heading hashes (e.g., "## ") for clean insertion
            const cleanText = Content_Body.replace(/^#+\s/, ''); 
            element.innerText = cleanText;
            
        } else if (type === 'table') {
            element.innerHTML = parseMarkdownTable(Content_Body);
            
        } else if (type === 'ul' || type === 'ol') {
            element.innerHTML = ''; // Clear fallback content
            // Split by newline and filter out empty strings
            const listItems = Content_Body.split('\n').filter(line => line.trim() !== '');
            
            listItems.forEach(liText => {
                const li = document.createElement('li');
                // Strip potential markdown list characters like "-", "*", or "1. " from the string
                li.innerText = liText.replace(/^[-*+]\s|^\d+\.\s/, '');
                element.appendChild(li);
            });
        }
    });
}

/**
 * Helper Function: Markdown Table Parser
 * Converts markdown-style text tables into a clean HTML <table> structure.
 * * @param {string} mdText - The markdown table string
 * @returns {string} - The resulting HTML table string
 */
function parseMarkdownTable(mdText) {
    const rows = mdText.trim().split('\n');
    if (rows.length < 2) return ''; // Requires at least a header and separator

    let tableHtml = '<table class="dynamic-data-table">\n';

    rows.forEach((row, index) => {
        // Skip the alignment/separator row entirely (e.g., |:---|:---|)
        if (row.trim().match(/^[|\s:\-]+$/)) return;

        // Strip the leading and trailing pipes
        let cleanRow = row.trim();
        if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1);
        if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);

        const columns = cleanRow.split('|').map(col => col.trim());
        let rowHtml = '  <tr>\n';

        columns.forEach(col => {
            if (index === 0) {
                rowHtml += `    <th>${col}</th>\n`;
            } else {
                rowHtml += `    <td>${col}</td>\n`;
            }
        });
        rowHtml += '  </tr>\n';

        // Wrap the first row in <thead> and subsequent rows in <tbody>
        if (index === 0) {
            tableHtml += '  <thead>\n' + rowHtml + '  </thead>\n  <tbody>\n';
        } else {
            tableHtml += rowHtml;
        }
    });

    tableHtml += '  </tbody>\n</table>';
    return tableHtml;
}
