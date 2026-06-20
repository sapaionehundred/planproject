// Google Sheets JSONP URL
const SHEET_JSONP_URL = 'https://docs.google.com/spreadsheets/d/12jbB6ldyutVliwGTTGId_veZutX6nZF1ePOJpS4HqzY/gviz/tq?tqx=out:json';

// Global Chart Instances to destroy before recreating
let charts = {};

// DOM Elements
const elements = {
    loading: document.getElementById('loadingOverlay'),
    lastUpdate: document.getElementById('lastUpdate'),
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    tableBody: document.getElementById('tableBody'),
    
    // KPIs
    kpiTotalProjects: document.getElementById('kpiTotalProjects'),
    kpiTotalBudget: document.getElementById('kpiTotalBudget'),
    kpiUsedBudget: document.getElementById('kpiUsedBudget'),
    kpiRemainingBudget: document.getElementById('kpiRemainingBudget')
};

// State
let projectData = [];

// Format numbers as currency
const formatMoney = (amount) => {
    return new Intl.NumberFormat('th-TH').format(amount || 0);
};

// Format Date
const formatDate = () => {
    const now = new Date();
    return now.toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute:'2-digit', second:'2-digit'
    });
};

// Determine Status Badge CSS Class
const getStatusClass = (status) => {
    if (!status) return 'status-todo';
    if (status.includes('ดำเนินการแล้ว') || status.includes('เสร็จ')) return 'status-done';
    if (status.includes('อยู่ระหว่าง')) return 'status-progress';
    return 'status-todo'; // ยังไม่ดำเนินการ
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.font.family = "'Inter', 'Noto Sans Thai', sans-serif";
    Chart.defaults.color = '#94a3b8';
    
    setupGoogleVisualizationCallback();
    loadData();
    
    elements.refreshBtn.addEventListener('click', loadData);
    elements.searchInput.addEventListener('input', (e) => renderTable(e.target.value));
});

// Setup JSONP Callback
function setupGoogleVisualizationCallback() {
    window.google = {
        visualization: {
            Query: {
                setResponse: function(response) {
                    elements.loading.classList.remove('active');
                    if (response.status === 'error') {
                        console.error('Error in response:', response.errors);
                        alert("เกิดข้อผิดพลาด: " + response.errors[0].message);
                        return;
                    }
                    processJSONPData(response.table);
                    elements.lastUpdate.innerHTML = `<i class='bx bx-time-five'></i> อัปเดตล่าสุด: ${formatDate()}`;
                }
            }
        }
    };
}

// Fetch Data via JSONP
function loadData() {
    elements.loading.classList.add('active');
    
    // Remove old script if exists
    const oldScript = document.getElementById('jsonp-script');
    if (oldScript) {
        oldScript.remove();
    }
    
    // Add cache buster
    const urlWithCacheBuster = `${SHEET_JSONP_URL}&_t=${new Date().getTime()}`;
    
    const script = document.createElement('script');
    script.id = 'jsonp-script';
    script.src = urlWithCacheBuster;
    script.onerror = function() {
        elements.loading.classList.remove('active');
        alert("ไม่สามารถเชื่อมต่อกับ Google Sheets ได้ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
    };
    
    document.body.appendChild(script);
}

// Process JSONP Data
function processJSONPData(table) {
    const cols = table.cols.map(c => c ? c.label : '');
    
    projectData = table.rows.map(row => {
        const getVal = (index) => {
            if (!row.c[index]) return null;
            return row.c[index].v;
        };
        
        return {
            id: getVal(0) || '-',
            name: getVal(1) || 'ไม่มีชื่อ',
            owner: getVal(2) || '-',
            group: getVal(3) || 'ไม่ระบุ',
            budget: parseFloat(getVal(4)) || 0,
            used: parseFloat(getVal(5)) || 0,
            remaining: parseFloat(getVal(6)) || 0,
            progress: parseFloat(getVal(7)) || 0,
            status: getVal(8) || 'ไม่ระบุ'
        };
    });
    
    updateKPIs();
    renderCharts();
    renderTable();
}

function updateKPIs() {
    const totalProjects = projectData.length;
    const totalBudget = projectData.reduce((sum, item) => sum + item.budget, 0);
    const totalUsed = projectData.reduce((sum, item) => sum + item.used, 0);
    const totalRemaining = projectData.reduce((sum, item) => sum + item.remaining, 0);
    
    elements.kpiTotalProjects.textContent = formatMoney(totalProjects);
    elements.kpiTotalBudget.textContent = formatMoney(totalBudget);
    elements.kpiUsedBudget.textContent = formatMoney(totalUsed);
    elements.kpiRemainingBudget.textContent = formatMoney(totalRemaining);
}

function renderCharts() {
    // 1. Budget by Group (Bar Chart)
    const groups = {};
    projectData.forEach(p => {
        if (!groups[p.group]) groups[p.group] = 0;
        groups[p.group] += p.budget;
    });
    
    createChart('budgetByGroupChart', 'bar', {
        labels: Object.keys(groups),
        datasets: [{
            label: 'งบประมาณรวม',
            data: Object.values(groups),
            backgroundColor: 'rgba(76, 201, 240, 0.7)',
            borderColor: '#4cc9f0',
            borderWidth: 1,
            borderRadius: 4
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    });
    
    // 2. Status (Doughnut Chart)
    const statuses = {};
    projectData.forEach(p => {
        if (!statuses[p.status]) statuses[p.status] = 0;
        statuses[p.status]++;
    });
    
    createChart('statusChart', 'doughnut', {
        labels: Object.keys(statuses),
        datasets: [{
            data: Object.values(statuses),
            backgroundColor: ['#4cc9f0', '#f7b731', '#fc5c65', '#b5179e'],
            borderWidth: 0
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#f8fafc' } }
        },
        cutout: '70%'
    });
    
    // 3. Progress and Budget (Combo Chart)
    const projectNames = projectData.map(p => p.name.length > 15 ? p.name.substring(0,15)+'...' : p.name);
    const progressData = projectData.map(p => p.progress);
    const budgetData = projectData.map(p => p.budget);
    
    createChart('progressChart', 'bar', {
        labels: projectNames,
        datasets: [
            {
                type: 'line',
                label: 'ความคืบหน้า (%)',
                data: progressData,
                borderColor: '#f72585',
                backgroundColor: '#f72585',
                borderWidth: 2,
                yAxisID: 'y1',
                tension: 0.4
            },
            {
                type: 'bar',
                label: 'งบประมาณ (บาท)',
                data: budgetData,
                backgroundColor: 'rgba(67, 97, 238, 0.5)',
                borderColor: '#4361ee',
                borderWidth: 1,
                borderRadius: 4,
                yAxisID: 'y'
            }
        ]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: { type: 'linear', display: true, position: 'left' },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, max: 100 }
        }
    });
}

function createChart(id, type, data, options) {
    const ctx = document.getElementById(id).getContext('2d');
    
    if (charts[id]) {
        charts[id].destroy();
    }
    
    charts[id] = new Chart(ctx, {
        type: type,
        data: data,
        options: options
    });
}

function renderTable(filterQuery = '') {
    elements.tableBody.innerHTML = '';
    
    const query = filterQuery.toLowerCase();
    const filteredData = projectData.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.owner.toLowerCase().includes(query) ||
        p.group.toLowerCase().includes(query)
    );
    
    if (filteredData.length === 0) {
        elements.tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">ไม่พบข้อมูลโครงการที่ค้นหา</td></tr>`;
        return;
    }
    
    filteredData.forEach(p => {
        const tr = document.createElement('tr');
        
        const statusClass = getStatusClass(p.status);
        
        tr.innerHTML = `
            <td>${p.id}</td>
            <td style="font-weight: 500; color: #f8fafc;">${p.name}</td>
            <td>${p.owner}</td>
            <td>${p.group}</td>
            <td class="number-col">${formatMoney(p.budget)}</td>
            <td class="number-col" style="color: #4cc9f0;">${formatMoney(p.used)}</td>
            <td class="number-col" style="color: #f72585;">${formatMoney(p.remaining)}</td>
            <td>
                <div>${p.progress.toFixed(2)}%</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${p.progress}%"></div>
                </div>
            </td>
            <td><span class="status-badge ${statusClass}">${p.status}</span></td>
        `;
        
        elements.tableBody.appendChild(tr);
    });
}
