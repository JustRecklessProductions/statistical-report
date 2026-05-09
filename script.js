/**
 * script.js
 * Asynchronously fetches CSV data from a published Google Sheet,
 * parses it, and dynamically populates the HTML document based on Unique_IDs.
 */

// 1. Fetch Logic
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQr6wegUTldLyoaq7qifjk7u3mAW0ixZkpCrSsqu5-WAr53OY-WcGHH1d9grbU7lUCmQ8HElBoh5FRj/pub?output=csv";

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch data. HTTP Status: ${response.status}`);
        }
        
        const csvString = await response.text();
        const dataObjects = parseCSV(csvString);
        populateDOM(dataObjects);
        
    } catch (error) {
        console.error("Error initializing dynamic content:", error);
    }
});

/**
 * 2. CSV Parsing Logic
 */
function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let currentStr = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"' && insideQuotes && nextChar === '"') {
            currentStr += '"'; 
            i++; 
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            row.push(currentStr);
            currentStr = '';
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; 
            row.push(currentStr);
            if (row.length > 0 || currentStr !== '') rows.push(row);
            row = [];
            currentStr = '';
        } else {
            currentStr += char;
        }
    }
    
    if (row.length > 0 || currentStr !== '') {
        row.push(currentStr);
        rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());
    const dataObjects = [];

    for (let i = 1; i < rows.length; i++) {
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
 * 3. Data-to-DOM Mapping
 */
function populateDOM(data) {
    data.forEach(item => {
        const { Unique_ID, Element_Type, Content_Body } = item;
        if (!Unique_ID) return;

        const element = document.getElementById(Unique_ID);
        if (!element) return; 

        const type = (Element_Type || '').toLowerCase();

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(type)) {
            const cleanText = Content_Body.replace(/^#+\s/, ''); 
            element.innerText = cleanText;
            
        } else if (type === 'table') {
            // Check for specific IDs that require Custom UI components instead of standard tables
            if (Unique_ID === 'enrollment_by_county_table') {
                element.innerHTML = parseBarChart(Content_Body);
            } else if (Unique_ID === 'number_of_enrollments_table') {
                element.innerHTML = parseProgList(Content_Body);
            } else {
                element.innerHTML = parseMarkdownTable(Content_Body);
            }
            
        } else if (type === 'ul' || type === 'ol') {
            element.innerHTML = ''; 
            const listItems = Content_Body.split('\n').filter(line => line.trim() !== '');
            
            listItems.forEach(liText => {
                const li = document.createElement('li');
                li.innerText = liText.replace(/^[-*+]\s|^\d+\.\s/, '');
                element.appendChild(li);
            });
        } else if (type === 'a') {
            if(Content_Body.match(/\.(jpeg|jpg|gif|png)$/i)) {
                element.innerHTML = `<img src="${Content_Body}" alt="Logo" style="max-width: 250px;">`;
            } else {
                element.href = Content_Body;
            }
        }
    });
}

/**
 * Custom UI Parser: CSS Horizontal Bar Chart
 */
function parseBarChart(mdText) {
    const rows = mdText.trim().split('\n').filter(r => !r.match(/^[|\s:\-]+$/));
    if (rows.length < 2) return '';
    
    const data = [];
    let total = 0;
    
    // Extract data skipping the header row
    for (let i = 1; i < rows.length; i++) {
        let cleanRow = rows[i].trim().replace(/^\||\|$/g, '');
        const cols = cleanRow.split('|').map(c => c.trim());
        if (cols.length >= 2) {
            const label = cols[0];
            const value = parseFloat(cols[1].replace(/,/g, ''));
            // Exclude totals row from being graphed
            if (!isNaN(value) && label.toLowerCase() !== 'total' && !label.toLowerCase().includes('total number')) {
                data.push({ label, value });
                total += value;
            }
        }
    }
    
    // Sort visually descending
    data.sort((a, b) => b.value - a.value);
    const colors = ['var(--orange)', 'var(--teal)', 'var(--orange-light)', 'var(--teal-light)', '#3faae4', 'var(--mid-gray)'];
    
    let html = '<div style="padding-top:4px;">\n';
    data.forEach((item, index) => {
        const pct = total > 0 ? (item.value / total * 100).toFixed(1) : 0;
        const color = colors[index % colors.length];
        html += `
        <div class="bar-row">
            <div class="bar-label">${item.label}</div>
            <div class="bar-track" style="overflow: visible;">
                <div class="bar-fill" style="width:${pct}%;background:${color}; position: relative;">
                    <span class="bar-value" style="position: absolute; left: 100%; margin-left: 8px; color: var(--navy); top: 50%; transform: translateY(-50%); white-space: nowrap;">${item.value}</span>
                </div>
            </div>
        </div>\n`;
    });
    html += '</div>';
    return html;
}

/**
 * Custom UI Parser: Program Row List
 */
function parseProgList(mdText) {
    const rows = mdText.trim().split('\n').filter(r => !r.match(/^[|\s:\-]+$/));
    if (rows.length < 2) return '';
    
    let html = '';
    // Process rows skipping the header
    for (let i = 1; i < rows.length; i++) {
        let cleanRow = rows[i].trim().replace(/^\||\|$/g, '');
        const cols = cleanRow.split('|').map(c => c.trim());
        if (cols.length >= 2) {
            const label = cols[0];
            const value = cols[1];
            // Skip header or total rows just in case
            if (label.toLowerCase() !== 'total' && !label.toLowerCase().includes('total number')) {
                html += `<div class="prog-row"><span class="prog-name">${label}</span><span class="prog-num">${value}</span></div>\n`;
            }
        }
    }
    return html;
}

/**
 * Helper Function: Standard Markdown Table Parser
 */
function parseMarkdownTable(mdText) {
    const rows = mdText.trim().split('\n');
    if (rows.length < 2) return ''; 

    // Draft E's standard Table styling
    let tableHtml = '<div class="glossary-table-wrap">\n<table class="glossary-table">\n';

    rows.forEach((row, index) => {
        if (row.trim().match(/^[|\s:\-]+$/)) return;

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

        if (index === 0) {
            tableHtml += '  <thead>\n' + rowHtml + '  </thead>\n  <tbody>\n';
        } else {
            tableHtml += rowHtml;
        }
    });

    tableHtml += '  </tbody>\n</table>\n</div>';
    return tableHtml;
}
