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
    // Intercept IDs arrays - configured to catch both exact requested names and existing HTML equivalents
    const donutChartIds = ['gender_table', 'age_table', 'education_table', 'gender_all_participants_table', 'age_distribution_table', 'education_level_table'];
    const barChartIds = ['race_table', 'primary_table', 'race_all_participants_table', 'primary_diagnoses_adults_table'];

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
            
            if (Unique_ID === 'enrollment_by_county_table') {
                element.innerHTML = parseBarChart(Content_Body);
            } else if (Unique_ID === 'number_of_enrollments_table') {
                element.innerHTML = parseProgList(Content_Body);
            } else if (donutChartIds.includes(Unique_ID)) {
                renderDonutChart(element, Unique_ID, Content_Body);
            } else if (barChartIds.includes(Unique_ID)) {
                element.innerHTML = parseHorizontalBarChart(Content_Body);
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
 * Custom UI Parser: 3-Column Chart Data Extractor
 */
function parseChartData(mdText) {
    const rows = mdText.trim().split('\n').filter(r => !r.match(/^[|\s:\-]+$/));
    if (rows.length < 2) return [];
    
    const data = [];
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
        let cleanRow = rows[i].trim().replace(/^\||\|$/g, '');
        const cols = cleanRow.split('|').map(c => c.trim());
        
        if (cols.length >= 3) {
            const label = cols[0];
            const numRaw = cols[1].replace(/[^\d.-]/g, ''); // Strip text/commas
            const value = parseInt(numRaw, 10);
            const percent = cols[2];
            
            if (!isNaN(value)) {
                data.push({ label, value, percent });
            }
        }
    }
    return data;
}

/**
 * Custom UI Renderer: Chart.js Donut Charts
 */
function renderDonutChart(element, id, mdText) {
    const chartData = parseChartData(mdText);
    if (!chartData.length) return;

    const canvasId = `canvas-${id}`;
    let html = `<div class="chart-container" style="width:130px;height:130px;margin:0 auto;"><canvas id="${canvasId}"></canvas></div>`;
    html += `<div class="chart-legend" style="margin-top:16px;">`;

    const colors = ['#244876', '#359fa5', '#e96626', '#e2e8f0', '#b0c4de', '#5bbcc2', '#3a6299', '#1a3355'];
    
    const labels = [];
    const dataPoints = [];
    const bgColors = [];

    chartData.forEach((item, index) => {
        // Exclude totals/means from chart visualization
        if (item.label.toLowerCase() === 'total' || item.label.toLowerCase().includes('mean')) return;

        const color = colors[index % colors.length];
        labels.push(item.label);
        dataPoints.push(item.value);
        bgColors.push(color);

        html += `<div class="legend-item"><div class="legend-dot" style="background:${color};"></div>${item.label} — ${item.value} (${item.percent})</div>`;
    });

    html += `</div>`;
    element.innerHTML = html;

    // Safely initialize Chart after DOM insertion
    setTimeout(() => {
        const ctx = document.getElementById(canvasId);
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataPoints,
                        backgroundColor: bgColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '62%',
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }
    }, 50);
}

/**
 * Custom UI Parser: Horizontal CSS Bars (3-Column Variant)
 */
function parseHorizontalBarChart(mdText) {
    const chartData = parseChartData(mdText);
    if (!chartData.length) return '';

    const colors = ['var(--navy)', 'var(--teal)', 'var(--mid-gray)', 'var(--orange-light)', 'var(--orange)', 'var(--teal-light)', '#7baac4'];
    let html = '<div style="padding-top:6px;">\n';

    // Filter out generic totals
    const validData = chartData.filter(item => item.label.toLowerCase() !== 'total' && !item.label.toLowerCase().includes('mean'));

    // Sort descending by numeric value
    validData.sort((a, b) => b.value - a.value);

    validData.forEach((item, index) => {
        const color = colors[index % colors.length];
        
        // Extract percentage digit to set CSS width limit
        let pctNum = parseFloat(item.percent.replace(/[^\d.-]/g, ''));
        if (isNaN(pctNum)) pctNum = 0;
        let visualWidth = pctNum > 100 ? 100 : pctNum;

        html += `
        <div class="bar-row">
            <div class="bar-label">${item.label}</div>
            <div class="bar-track" style="overflow: visible;">
                <div class="bar-fill" style="width:${visualWidth}%;background:${color}; position: relative;">
                    <span class="bar-value" style="position: absolute; left: 100%; margin-left: 8px; color: var(--navy); top: 50%; transform: translateY(-50%); white-space: nowrap;">${item.value} (${item.percent})</span>
                </div>
            </div>
        </div>\n`;
    });
    
    html += '</div>';
    return html;
}

/**
 * Custom UI Parser: CSS Horizontal Bar Chart (2-Column from Phase 1)
 */
function parseBarChart(mdText) {
    const rows = mdText.trim().split('\n').filter(r => !r.match(/^[|\s:\-]+$/));
    if (rows.length < 2) return '';
    
    const data = [];
    let total = 0;
    
    for (let i = 1; i < rows.length; i++) {
        let cleanRow = rows[i].trim().replace(/^\||\|$/g, '');
        const cols = cleanRow.split('|').map(c => c.trim());
        if (cols.length >= 2) {
            const label = cols[0];
            const value = parseFloat(cols[1].replace(/,/g, ''));
            if (!isNaN(value) && label.toLowerCase() !== 'total' && !label.toLowerCase().includes('total number')) {
                data.push({ label, value });
                total += value;
            }
        }
    }
    
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
    for (let i = 1; i < rows.length; i++) {
        let cleanRow = rows[i].trim().replace(/^\||\|$/g, '');
        const cols = cleanRow.split('|').map(c => c.trim());
        if (cols.length >= 2) {
            const label = cols[0];
            const value = cols[1];
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
