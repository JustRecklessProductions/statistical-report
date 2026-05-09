// Your live Google Apps Script API URL
const scriptURL = 'https://script.google.com/macros/s/AKfycbzw41F0HGgJ5pTnTkiV3l5J6fu8CLO2mEPXPM7BZgxGF27qcKOuoSyvNvX6Fh7FDpzzNg/exec';

document.addEventListener('DOMContentLoaded', () => {
  
  // THE ENGINE: Builds tables dynamically from your 2D Google Sheets arrays
  function buildDynamicTable(dataArray, containerId) {
    const container = document.getElementById(containerId);
    
    // Safety check: If the div doesn't exist on the page or data is missing, skip it
    if (!container || !dataArray || dataArray.length < 2) return;
    
    container.innerHTML = ''; 
    
    // --- 1. Handle Custom Title Row (Row 1 in your Sheet) ---
    const titleRow = dataArray[0];
    if (titleRow && titleRow[0]) {
        const titleElement = document.createElement('h3'); 
        titleElement.textContent = titleRow[0] + (titleRow[1] ? ` (${titleRow[1]})` : '');
        titleElement.className = 'dynamic-table-title';
        container.appendChild(titleElement);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive-wrapper';
    
    const table = document.createElement('table');
    table.className = 'sheet-table';
    
    // --- 2. Build Headers (Row 2 in your Sheet) ---
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = dataArray[1]; 
    
    if (headers) {
        headers.forEach(headerText => {
            if (headerText === "") return;
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
    }

    // --- 3. Build Body (Row 3 and below in your Sheet) ---
    const tbody = document.createElement('tbody');
    
    for (let i = 2; i < dataArray.length; i++) {
        const rowData = dataArray[i];
        
        // Skip entirely empty rows or rows labeled "Total"
        if (!rowData || rowData[0] === "" || String(rowData[0]).toLowerCase() === "total") continue;

        const row = document.createElement('tr');
        
        for (let j = 0; j < headers.length; j++) {
            if (headers[j] === "") continue; 
            const td = document.createElement('td');
            td.textContent = rowData[j] || "";
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
  }

  // DATA FETCH: Call your API and process the JSON
  fetch(scriptURL)
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      // Process Text Blocks (Using marked.js for markdown parsing)
      if (data.textBlocks && typeof marked !== 'undefined') {
        const tbContainer = document.getElementById('text-blocks-container');
        if(tbContainer) tbContainer.innerHTML = marked.parse(data.textBlocks);
      }
      if (data.keyOutcomes && typeof marked !== 'undefined') {
        const koContainer = document.getElementById('key-outcomes-container');
        if(koContainer) koContainer.innerHTML = marked.parse(data.keyOutcomes);
      }

      // Process All Tables Dynamically
      buildDynamicTable(data.genderTable, 'gender-table-container');
      buildDynamicTable(data.educationTable, 'education-table-container');
      buildDynamicTable(data.ageDistributionTable, 'age-distribution-table-container');
      buildDynamicTable(data.raceTable, 'race-table-container');
      
      // Add additional tables here as you add more tabs to your Google Apps Script
      // Example: buildDynamicTable(data.lodgeActivityTable, 'lodge-activity-table-container');
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      const mainContainer = document.querySelector('.section-container');
      if(mainContainer) {
          mainContainer.innerHTML += '<p style="color:red;">Error loading data. Please check the console.</p>';
      }
    });
});
