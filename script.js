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
        
        if (!element) {
            return; 
        }

        const type = (Element_Type || '').toLowerCase();

        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(type)) {
            const cleanText = Content_Body.replace(/^#+\s/, ''); 
            element.innerText = cleanText;
            
        } else if (type === 'table') {
            element.innerHTML = parseMarkdownTable(Content_Body);
            
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

    // 5. Fire post-render scripts (Glossary Index Generation & UX)
    buildGlossaryIndex();
}

/**
 * 4. Helper Function: Markdown Table Parser (Upgraded output for new styles)
 */
function parseMarkdownTable(mdText) {
    const rows = mdText.trim().split('\n');
    if (rows.length < 2) return ''; 

    // Wrap in the new Draft E styling structure
    let tableHtml = '<div class="glossary-table-wrap">\n<table class="glossary-table">\n';

    rows.forEach((row, index) => {
        if (row.trim().match(/^[|\s:\-]+$/)) return; // Skip separator lines

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

/**
 * 6. Dynamic Glossary Index Generator & UX Initializer
 */
function buildGlossaryIndex() {
    const glossarySection = document.getElementById('glossary');
    const indexActions = document.querySelector('.glossary-index-actions');
    if (!glossarySection || !indexActions) return;

    // Scan the glossary section for populated h2 and h3 elements
    const headers = glossarySection.querySelectorAll('h2, h3');

    headers.forEach(header => {
        const text = header.innerText.trim();
        // Skip elements that were never populated or are strictly titles for the UI (like "Glossary Index")
        if (!text || text === "Glossary" || text === "Glossary Index") return;

        // Verify ID exists (the original HTML guarantees this, but safety first)
        if (!header.id) {
            header.id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }

        // Create the pill button
        const btn = document.createElement('a');
        btn.className = 'glossary-index-btn';
        btn.href = '#' + header.id;
        btn.innerText = text;

        indexActions.appendChild(btn);
    });

    // Initialize Sticky Glossary UX (Brought over from Draft E)
    initGlossaryUX();
}

function initGlossaryUX() {
    const glossarySection = document.getElementById('glossary');
    const indexCard = document.getElementById('glossary-index');
    const toggleBtn = document.getElementById('glossaryIndexToggle');
    if (!glossarySection || !indexCard || !toggleBtn) return;

    // Show the top-nav toggle only while the Glossary section is in view
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            document.body.classList.toggle('in-glossary', entry.isIntersecting);
        });
    }, { threshold: 0.05 });
    sectionObserver.observe(glossarySection);

    // Helper: Top nav height calculation
    const getStickyOffsetPx = () => {
        const cs = getComputedStyle(document.documentElement);
        const topNavH = parseFloat(cs.getPropertyValue('--topnav-height')) || 0;
        const gap = parseFloat(cs.getPropertyValue('--sticky-gap')) || 0;
        return topNavH + gap;
    };

    // Set CSS variable for exact offset matching dynamically
    const nav = document.querySelector('.top-nav');
    const applyNavOffset = () => {
        if(nav) {
            const h = nav.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--topnav-height', `${Math.ceil(h)}px`);
        }
    };
    applyNavOffset();
    window.addEventListener('resize', applyNavOffset, { passive: true });

    // Detect when the index is physically stuck vs scrolled
    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            const offset = getStickyOffsetPx();
            const top = indexCard.getBoundingClientRect().top;
            const isStuck = top <= (offset + 1);
            indexCard.classList.toggle('is-compact', isStuck);
            ticking = false;
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll(); // Kickoff initial

    // Manage Top-Nav Expand/Collapse Toggling
    const syncToggleUI = () => {
        const expanded = !indexCard.classList.contains('is-collapsed');
        toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggleBtn.innerHTML = expanded ? 'Index <span class="chev">▾</span>' : 'Index <span class="chev">▸</span>';
    };

    toggleBtn.addEventListener('click', () => {
        indexCard.classList.toggle('is-collapsed');
        syncToggleUI();
    });

    syncToggleUI();
}
