// 1. Fetch Logic: Pointing to your live Google Sheet
const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQr6wegUTldLyoaq7qifjk7u3mAW0ixZkpCrSsqu5-WAr53OY-WcGHH1d9grbU7lUCmQ8HElBoh5FRj/pub?output=csv";

const colors = ['#244876', '#e96626', '#359fa5', '#b0c4de', '#5bbcc2', '#3a6299', '#1a3355', '#e2e8f0'];
const kineticIds = ['number_of_individuals_supported', 'number_of_one', 'number_of_two', 'number_of_three', 'number_of_four', 'number_of_new_enrollments_from_outside_tasks'];

/**
 * 2. Original Bulletproof CSV Parser 
 * (Properly handles newlines inside markdown cells and allows missing columns)
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
        } else if (char === '\n' && !insideQuotes) {
            row.push(currentStr);
            rows.push(row);
            row = [];
            currentStr = '';
        } else if (char !== '\r') {
            currentStr += char;
        }
    }
    row.push(currentStr);
    if (row.length > 0) rows.push(row);

    const groupedData = {};
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 3) continue; // Only require ID, Type, and Content

        const id = r[0] ? r[0].trim() : '';
        const type = r[1] ? r[1].trim() : '';
        const content = r[2] ? r[2].trim() : '';
        const section = r[3] && r[3].trim() !== '' ? r[3].trim() : 'General'; // Default to General if blank

        if (!id) continue;

        if (!groupedData[section]) {
            groupedData[section] = [];
        }
        groupedData[section].push({ id, type, content });
    }
    return groupedData;
}

// Markdown to Styled HTML Table
function parseMarkdownTable(mdText) {
    const lines = mdText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 3) return ''; 

    let tableHtml = '<div class="glossary-table-wrap"><table class="glossary-table">';
    const headers = lines[0].split('|').map(h => h.trim()).filter(h => h !== '');
    
    tableHtml += '<thead><tr>';
    headers.forEach(h => tableHtml += `<th>${h}</th>`);
    tableHtml += '</tr></thead><tbody>';
    
    for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c !== '');
        if (cells.length > 0) {
            tableHtml += '<tr>';
            cells.forEach(c => tableHtml += `<td>${c}</td>`);
            tableHtml += '</tr>';
        }
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
}

// Helper to extract chart data from Markdown
function parseChartData(mdText) {
    const lines = mdText.split('\n').filter(line => line.trim() !== '');
    const labels = [];
    const data = [];
    const percentages = [];
    
    for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].split('|').map(p => p.trim()).filter(p => p !== '');
        if (parts.length >= 3) {
            labels.push(parts[0]);
            data.push(parseInt(parts[1].replace(/,/g, ''), 10));
            percentages.push(parts[2]);
        }
    }
    return { labels, data, percentages };
}

function populateHTML(data) {
    for (const section in data) {
        data[section].forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                // Initialize Kinetic Numbers dynamically
                if (kineticIds.includes(item.id)) {
                    const text = item.content.trim();
                    el.setAttribute('data-target-text', text);
                    const matches = text.match(/^([^0-9]*)([0-9,.]+)([^0-9]*)$/);
                    if (matches) {
                        el.setAttribute('data-prefix', matches[1]);
                        el.setAttribute('data-num', matches[2].replace(/,/g, ''));
                        el.setAttribute('data-suffix', matches[3]);
                        el.innerText = `${matches[1]}0${matches[3]}`; 
                        el.classList.add('kinetic-num');
                    } else {
                        el.innerHTML = item.content;
                    }
                }
                else if (item.type === 'a') {
                    if(item.content.match(/\.(jpeg|jpg|gif|png)$/i)) {
                        el.innerHTML = `<img src="${item.content}" alt="Logo" style="max-height: 200px; display: block; margin: 0 auto 24px auto;">`;
                    } else {
                        el.href = item.content;
                    }
                } 
                // Render Donut Charts
                else if (item.id === 'gender_all_participants_table' || item.id === 'age_distribution_table' || item.id === 'education_level_table') {
                    const chartData = parseChartData(item.content);
                    let legendHtml = '';
                    chartData.labels.forEach((label, idx) => {
                        const color = colors[idx % colors.length];
                        legendHtml += `<div class="legend-item"><div class="legend-dot" style="background:${color};"></div>${label} — ${chartData.data[idx]} (${chartData.percentages[idx]})</div>`;
                    });
                    
                    el.innerHTML = `
                        <div class="chart-container" style="width:130px;height:130px;margin:0 auto;">
                            <canvas id="canvas-${item.id}"></canvas>
                        </div>
                        <div class="chart-legend" style="margin-top:16px;">
                            ${legendHtml}
                        </div>
                    `;
                    
                    const ctx = document.getElementById(`canvas-${item.id}`).getContext('2d');
                    new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: chartData.labels,
                            datasets: [{ 
                                data: chartData.data, 
                                backgroundColor: chartData.labels.map((_, i) => colors[i % colors.length]), 
                                borderColor: '#ffffff', 
                                borderWidth: 4 
                            }]
                        },
                        options: { cutout: '62%', responsive: true }
                    });
                }
                // Render Horizontal Bar Charts
                else if (item.id === 'race_all_participants_table' || item.id === 'primary_diagnoses_adults_table') {
                    const chartData = parseChartData(item.content);
                    let html = '<div style="padding-top:6px;">';
                    chartData.labels.forEach((label, idx) => {
                        const color = colors[idx % colors.length];
                        const width = chartData.percentages[idx] || '0%';
                        const valueText = `${chartData.data[idx]} (${chartData.percentages[idx]})`;
                        html += `
                        <div class="bar-row">
                            <div class="bar-label">${label}</div>
                            <div class="bar-track" style="overflow: visible;">
                                <div class="bar-fill kinetic-bar" data-width="${width}" style="width:0%; background:${color}; position: relative;">
                                    <span class="bar-value" style="position: absolute; left: 100%; margin-left: 8px; color: var(--navy); top: 50%; transform: translateY(-50%); white-space: nowrap;">${valueText}</span>
                                </div>
                            </div>
                        </div>`;
                    });
                    html += '</div>';
                    el.innerHTML = html;
                }
                // Custom UI: Enrollment by County
                else if (item.id === 'enrollment_by_county_table') {
                    const lines = item.content.split('\n').filter(l => l.trim().startsWith('|'));
                    let html = '<div style="padding-top:4px;">';
                    const dataParts = [];
                    for (let i = 2; i < lines.length; i++) {
                        const parts = lines[i].split('|').map(p => p.trim()).filter(p => p !== '');
                        if (parts.length >= 2) {
                            dataParts.push({ label: parts[0], value: parseInt(parts[1].replace(/,/g, ''), 10) || 0 });
                        }
                    }
                    const total = dataParts.reduce((sum, d) => sum + d.value, 0) || 1;
                    
                    dataParts.forEach((dataItem, idx) => {
                        const color = colors[idx % colors.length];
                        const width = ((dataItem.value / total) * 100).toFixed(1) + '%';
                        html += `
                        <div class="bar-row">
                            <div class="bar-label">${dataItem.label}</div>
                            <div class="bar-track" style="overflow: visible;">
                                <div class="bar-fill kinetic-bar" data-width="${width}" style="width:0%; background:${color}; position: relative;">
                                    <span class="bar-value" style="position: absolute; left: 100%; margin-left: 8px; color: var(--navy); top: 50%; transform: translateY(-50%); white-space: nowrap;">${dataItem.value}</span>
                                </div>
                            </div>
                        </div>`;
                    });
                    html += '</div>';
                    el.innerHTML = html;
                }
                // Custom UI: Top Programs
                else if (item.id === 'number_of_enrollments_table') {
                    const lines = item.content.split('\n').filter(l => l.trim().startsWith('|'));
                    let html = '';
                    for (let i = 2; i < lines.length; i++) {
                        const parts = lines[i].split('|').map(p => p.trim()).filter(p => p !== '');
                        if (parts.length >= 2) {
                            html += `<div class="prog-row"><span class="prog-name">${parts[0]}</span><span class="prog-num">${parts[1]}</span></div>`;
                        }
                    }
                    el.innerHTML = html;
                } 
                else if (item.type === 'table') {
                    el.innerHTML = parseMarkdownTable(item.content);
                } 
                else {
                    el.innerHTML = item.content;
                }
            }
        });
    }

    // Trigger Kinetic animations dynamically post-render
    setTimeout(() => {
        document.querySelectorAll('.kinetic-bar').forEach(bar => {
            bar.style.width = bar.getAttribute('data-width');
            bar.classList.remove('kinetic-bar');
        });
        if (typeof animateNumber === 'function') {
            document.querySelectorAll('.kinetic-num').forEach(num => {
                animateNumber(num);
                num.classList.remove('kinetic-num');
            });
        }
    }, 100);
}

// Initialization - Fetching from your live Google Sheet
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch data. HTTP Status: ${response.status}`);
        }
        
        const csvString = await response.text();
        const groupedData = parseCSV(csvString);
        populateHTML(groupedData);
        
    } catch (error) {
        console.error("Error initializing dynamic content:", error);
    }
});
