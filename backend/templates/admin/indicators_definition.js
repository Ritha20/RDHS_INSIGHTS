// ── State Variables ─────────────────────────────
let activeTab = 'overview';
let geojsonCached = null;
let minLonCached = null, maxLonCached = null, minLatCached = null, maxLatCached = null;

// Overview State
let activeOverviewKPI = 0;
let overviewProvinceValues = {}; // code -> value
let overviewNationalValue = 0;
let overviewUnit = 'Percentage';

// Chapters State
let activeChapterSlug = 'household';
let activeIndicatorId = 'electricity';
let chaptersParams = {};
let selectedChaptersProvince = null; // code or null
let chaptersProvinceValues = {}; // code -> value
let chaptersDistrictValues = {}; // name -> value
let chaptersNationalValue = 0;
let chaptersUnit = 'Percentage';
let chaptersIndicatorName = 'Electricity Access';

// Compare State
let selectedCompareIndicators = []; // Array of { id, indicatorName, path, params, color, provData, national, unit }
let activeCompareChapterSlug = 'household';
let activeCompareIndicatorId = 'electricity';
let compareParams = {};
let compareMode = 'province'; // 'province' or 'indicator'

// Table Sorting & Pagination State
let tableRows = []; // Array of { rank, name, type, province, value, vsNational }
let currentSortCol = 'rank';
let currentSortDir = 'asc';
let tableSearchQuery = '';
let tablePage = 0;
const TABLE_ROWS_PER_PAGE = 15;
let isTableGrouped = false;
let tableCollapsedProvinces = new Set();
let showTableFilters = false;

// Report Builder Modal State
let selectedReportIndicators = new Set(); // Set of "chapterSlug::indicatorId"
let selectedReportProvinces = new Set(['Kigali City', 'Southern Province', 'Western Province', 'Northern Province', 'Eastern Province']);
let reportFormat = 'pdf'; // 'pdf' or 'word'
let activeReportTab = 'content';
let expandedReportChapters = new Set();

// ── Static Configurations ───────────────────────
// NOTE: DISTRICT_PROVINCE, PROVINCES, PROVINCE_NAMES, NISR_SCALE, INDICATOR_COLORS
// and the CHAPTERS catalog now live in the shared 'admin/indicators_data.js'
// partial, which is included BEFORE this file. Do not re-declare them here.

const OVERVIEW_KPI_QUERIES = [
    {
        path: '/chapter3/fertility-rate',
        params: { rate_type: 'observed' },
        title: 'Total Fertility Rate',
        unit: 'Children per woman',
    },
    {
        path: '/chapter5/delivery-assistance',
        params: { provider: 'skilled' },
        title: 'Skilled Birth Attendance',
        unit: 'Percentage',
    },
    {
        path: '/chapter7/stunting',
        params: { severity: 'any' },
        title: 'Child Stunting',
        unit: 'Percentage',
    },
    {
        path: '/chapter4/contraception-use',
        params: { method: 'modern', marital_status: 'married' },
        title: 'Modern Contraceptive Use',
        unit: 'Percentage',
    },
    {
        path: '/chapter9/hiv-testing',
        params: { gender: 'female', timing: 'ever' },
        title: 'HIV Testing (Women)',
        unit: 'Percentage',
    }
];

// CHAPTERS catalog moved to 'admin/indicators_data.js' (included before this file).

// ── Initialization ─────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    // 1. Render scale gradients
    ['overview-legend-bar', 'chapters-legend-bar'].forEach(id => {
        const bar = document.getElementById(id);
        if (bar) {
            bar.innerHTML = '';
            NISR_SCALE.forEach(c => {
                const div = document.createElement('div');
                div.className = 'legend-step';
                div.style.background = c;
                bar.appendChild(div);
            });
        }
    });

    // 2. Fetch GeoJSON and boot Overview tab
    fetchGeoJSONAndRender();
    renderChapterCards();
    loadOverviewKPIs();

    // 3. Compare Initializers
    renderCompareSelectors();

    // Set default selected report indicator if any
    const firstInd = CHAPTERS[0].indicators[0];
    selectedReportIndicators.add(`${CHAPTERS[0].slug}::${firstInd.id}`);
    expandedReportChapters.add(CHAPTERS[0].slug);

    // 4. Open report builder modal if query param is set
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('report') === '1') {
        setTimeout(() => {
            openReportBuilderModal();
        }, 100);
    }
});

// ── Tab Switching ───────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));

    const btn = document.getElementById(`tab-btn-${tabId}`);
    const panel = document.getElementById(`tab-content-${tabId}`);
    if (btn) btn.classList.add('active');
    if (panel) panel.classList.add('active');

    activeTab = tabId;

    // Trigger chart redraw to handle resizing
    setTimeout(() => {
        if (window.charts) {
            Object.values(window.charts).forEach(c => {
                if (c && typeof c.resize === 'function') c.resize();
            });
        }
    }, 40);
}

// ── Fetch GeoJSON ───────────────────────────────
function fetchGeoJSONAndRender() {
    fetch('/admin-panel/geojson/')
        .then(res => res.json())
        .then(geojson => {
            geojsonCached = geojson;
            // Calculate boundaries once
            calculateBoundaries(geojson);
            
            // Draw maps
            drawMapSvg('overview-map-svg', geojson, null, handleOverviewMapHover, handleOverviewMapLeave);
            drawMapSvg('chapters-map-svg', geojson, handleChaptersMapClick, handleChaptersMapHover, handleChaptersMapLeave);
            
            // Load content
            loadOverviewValues();
            loadChaptersValues();
        })
        .catch(err => console.error("Error loading GeoJSON boundaries:", err));
}

function calculateBoundaries(geojson) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    geojson.features.forEach(f => {
        const scan = ring => ring.forEach(([lon, lat]) => {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        });
        if (f.geometry.type === 'Polygon') {
            f.geometry.coordinates.forEach(scan);
        } else if (f.geometry.type === 'MultiPolygon') {
            f.geometry.coordinates.forEach(p => p.forEach(scan));
        }
    });
    minLonCached = minLon;
    maxLonCached = maxLon;
    minLatCached = minLat;
    maxLatCached = maxLat;
}

// ── Generic SVG Drawing ─────────────────────────
function drawMapSvg(svgId, geojson, onClick, onMouseEnter, onMouseLeave) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';

    const W = 500;
    const H = 440;

    function ringToPath(ring) {
        return ring.map(([lon, lat], i) => {
            const x = ((lon - minLonCached) / (maxLonCached - minLonCached)) * W;
            const y = ((maxLatCached - lat) / (maxLatCached - minLatCached)) * H;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        }).join(' ') + ' Z';
    }

    geojson.features.forEach(f => {
        const districtName = f.properties.shapeName;
        const provCode = DISTRICT_PROVINCE[districtName] || 0;

        let dAttr = '';
        if (f.geometry.type === 'Polygon') {
            dAttr = ringToPath(f.geometry.coordinates[0]);
        } else if (f.geometry.type === 'MultiPolygon') {
            dAttr = f.geometry.coordinates.map(p => ringToPath(p[0])).join(' ');
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", dAttr);
        path.setAttribute("fill", "#E2E8F0");
        path.setAttribute("stroke", "#FFFFFF");
        path.setAttribute("stroke-width", "0.7px");
        path.setAttribute("data-district", districtName);
        path.setAttribute("data-province", provCode);

        if (onClick) {
            path.addEventListener("click", () => onClick(provCode, districtName));
        }
        if (onMouseEnter) {
            path.addEventListener("mouseenter", (e) => onMouseEnter(e, districtName, provCode));
        }
        if (onMouseLeave) {
            path.addEventListener("mouseleave", () => onMouseLeave(districtName, provCode));
        }

        svg.appendChild(path);
    });
}

// ── Chart.js Helper ─────────────────────────────
function renderChartInstance(canvasId, labels, values, unit, national, onClick = null, selectedCode = null, customColors = null) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (window.charts && window.charts[canvasId]) {
        window.charts[canvasId].destroy();
    }

    const defaultColors = customColors || ['#1B3C74', '#0099D4', '#2A509A', '#4AB8E0', '#0D2550'];

    const plugins = [];
    if (national !== null && national !== undefined) {
        plugins.push({
            id: 'natLine',
            afterDraw: (chart) => {
                const {ctx, chartArea: {left, right}, scales: {y}} = chart;
                const yVal = y.getPixelForValue(national);
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = '#EF4444';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.moveTo(left, yVal);
                ctx.lineTo(right, yVal);
                ctx.stroke();

                ctx.fillStyle = '#EF4444';
                ctx.font = 'bold 10px Inter';
                ctx.textAlign = 'right';
                ctx.fillText(`Nat: ${national.toFixed(1)}${unit === 'Percentage' ? '%' : ''}`, right - 6, yVal - 4);
                ctx.restore();
            }
        });
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: labels.map((l, i) => {
                    const code = labels.length === 5 ? (i + 1) : null;
                    if (selectedCode !== null && selectedCode !== undefined && code === selectedCode) {
                        return '#0D2550'; // highlight selected
                    }
                    return defaultColors[i % defaultColors.length];
                }),
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 12, weight: 'bold', family: 'Inter' },
                    bodyFont: { size: 12, family: 'Inter' },
                    padding: 8,
                    callbacks: {
                        label: (c) => `Value: ${c.parsed.y.toFixed(1)}${unit === 'Percentage' ? '%' : ''}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, family: 'Inter', weight: '500' }, color: '#374151' }
                },
                y: {
                    grid: { color: '#F1F5F9' },
                    ticks: {
                        font: { size: 10, family: 'Inter' },
                        color: '#64748B',
                        callback: (v) => v + (unit === 'Percentage' ? '%' : '')
                    },
                    border: { display: false }
                }
            },
            onClick: (e, elements) => {
                if (elements.length > 0 && onClick) {
                    onClick(elements[0].index);
                }
            }
        },
        plugins: plugins
    });

    if (!window.charts) window.charts = {};
    window.charts[canvasId] = chart;
}

// ── Color Utilities ─────────────────────────────
function getColorScaleValue(value, allValues, scale = NISR_SCALE) {
    if (value === null || value === undefined) return '#CBD5E1';
    const valid = allValues.filter(v => v !== null && v !== undefined);
    if (valid.length === 0) return scale[0];
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const pct = (value - min) / range;
    
    if (pct < 0.2) return scale[0];
    if (pct < 0.4) return scale[1];
    if (pct < 0.6) return scale[2];
    if (pct < 0.8) return scale[3];
    return scale[4];
}

function fmtNum(v) {
    if (v === null || v === undefined) return '—';
    return Number(v).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatValue(v, unit) {
    if (v === null || v === undefined) return '—';
    return unit === 'Percentage' ? `${Number(v).toFixed(1)}%` : `${Number(v).toFixed(2)}`;
}

// ─────────────────────────────────────────────────
// OVERVIEW TAB LOGIC
// ─────────────────────────────────────────────────
function loadOverviewKPIs() {
    OVERVIEW_KPI_QUERIES.forEach((kpi, idx) => {
        const url = new URL(`/api${kpi.path}`, window.location.origin);
        Object.entries(kpi.params).forEach(([key, val]) => url.searchParams.set(key, val));

        fetch(url)
            .then(r => r.json())
            .then(data => {
                const val = data.national.value;
                const el = document.getElementById(`kpi-val-${idx}`);
                if (el && val !== null && val !== undefined) {
                    el.innerText = kpi.unit === 'Percentage' ? `${val.toFixed(1)}%` : `${val.toFixed(2)}`;
                }
            })
            .catch(err => console.error("Error prefetching KPI cards:", err));
    });
}

function selectOverviewKPI(idx) {
    activeOverviewKPI = parseInt(idx);
    
    // Update KPI Card active highlights
    document.querySelectorAll('#tab-content-overview .kpi-card').forEach((card, i) => {
        if (i === activeOverviewKPI) card.classList.add('active');
        else card.classList.remove('active');
    });

    // Sync dropdown selector
    const drop = document.getElementById('overview-indicator-dropdown');
    if (drop) drop.value = idx;

    loadOverviewValues();
}

function loadOverviewValues() {
    if (!geojsonCached) return;
    const spinner = document.getElementById('overview-spinner');
    if (spinner) spinner.classList.add('active');

    const kpi = OVERVIEW_KPI_QUERIES[activeOverviewKPI];
    const url = new URL(`/api${kpi.path}`, window.location.origin);
    Object.entries(kpi.params).forEach(([key, val]) => url.searchParams.set(key, val));

    fetch(url)
        .then(res => res.json())
        .then(data => {
            overviewUnit = data.unit;
            overviewNationalValue = data.national.value;
            
            // Map values
            overviewProvinceValues = {};
            if (data.provinces) {
                data.provinces.forEach(p => {
                    overviewProvinceValues[p.province_id] = p.value;
                });
            }

            // Update UI elements
            document.getElementById('overview-display-indicator').innerText = data.indicator || kpi.title;
            document.getElementById('overview-national-badge').innerText = `National Average: ${formatValue(overviewNationalValue, overviewUnit)}`;

            // Color Overview Map
            const allVals = Object.values(overviewProvinceValues);
            document.querySelectorAll('#overview-map-svg path').forEach(path => {
                const pCode = parseInt(path.getAttribute('data-province'));
                const val = overviewProvinceValues[pCode];
                path.setAttribute('fill', getColorScaleValue(val, allVals));
            });

            // Draw Overview Chart
            const labels = PROVINCES.map(p => p.name);
            const chartVals = PROVINCES.map(p => overviewProvinceValues[p.code]);
            renderChartInstance(
                'overview-chart-canvas', 
                labels, 
                chartVals, 
                overviewUnit, 
                overviewNationalValue, 
                (idx) => {
                    // Click handler
                }
            );

            if (spinner) spinner.classList.remove('active');
        })
        .catch(err => {
            console.error("Error loading overview values:", err);
            if (spinner) spinner.classList.remove('active');
        });
}

function handleOverviewMapHover(event, districtName, provCode) {
    const val = overviewProvinceValues[provCode];
    
    // Highlight SVG map
    document.querySelectorAll('#overview-map-svg path').forEach(path => {
        if (parseInt(path.getAttribute('data-province')) === provCode) {
            path.style.filter = "brightness(1.15)";
        } else {
            path.style.opacity = "0.55";
        }
    });

    // Highlight Chart bars
    if (window.charts && window.charts['overview-chart-canvas']) {
        const chart = window.charts['overview-chart-canvas'];
        chart.setActiveElements([{ datasetIndex: 0, index: provCode - 1 }]);
        chart.update();
    }

    // Tooltip
    const tooltip = document.getElementById('overview-map-tooltip');
    if (tooltip) {
        document.getElementById('overview-tooltip-title').innerHTML = `District: ${districtName}<br><strong>${PROVINCE_NAMES[provCode]}</strong>`;
        document.getElementById('overview-tooltip-value').innerText = formatValue(val, overviewUnit);
        tooltip.style.display = 'block';

        const container = document.querySelector('#tab-content-overview .map-container').getBoundingClientRect();
        const x = event.clientX - container.left;
        const y = event.clientY - container.top;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y - 65}px`;
    }
}

function handleOverviewMapLeave() {
    document.querySelectorAll('#overview-map-svg path').forEach(path => {
        path.style.filter = "none";
        path.style.opacity = "1";
    });

    if (window.charts && window.charts['overview-chart-canvas']) {
        const chart = window.charts['overview-chart-canvas'];
        chart.setActiveElements([]);
        chart.update();
    }

    const tooltip = document.getElementById('overview-map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// ─────────────────────────────────────────────────
// CHAPTERS TAB LOGIC
// ─────────────────────────────────────────────────
function renderChapterCards() {
    const grid = document.getElementById('chapters-card-grid');
    if (!grid) return;
    grid.innerHTML = '';

    CHAPTERS.forEach(ch => {
        const card = document.createElement('div');
        card.className = `chapter-card ${ch.slug === activeChapterSlug ? 'active' : ''}`;
        card.onclick = () => selectChapter(ch.slug);
        card.innerHTML = `
            <span class="emoji">${ch.emoji}</span>
            <span class="title">${ch.title}</span>
        `;
        grid.appendChild(card);
    });
}

function selectChapter(slug) {
    activeChapterSlug = slug;
    
    // Highlight chapter cards
    document.querySelectorAll('#chapters-card-grid .chapter-card').forEach((card, i) => {
        if (CHAPTERS[i].slug === slug) card.classList.add('active');
        else card.classList.remove('active');
    });

    // Reset indicator selection to first item of this chapter
    const ch = CHAPTERS.find(c => c.slug === slug);
    if (ch && ch.indicators.length > 0) {
        activeIndicatorId = ch.indicators[0].id;
    }
    chaptersParams = {};
    selectedChaptersProvince = null; // reset drill down

    renderChaptersFilters();
    loadChaptersValues();
}

function renderChaptersFilters() {
    const container = document.getElementById('chapters-filters-container');
    if (!container) return;
    container.innerHTML = '';

    const ch = CHAPTERS.find(c => c.slug === activeChapterSlug);
    if (!ch) return;

    const ind = ch.indicators.find(i => i.id === activeIndicatorId);
    if (!ind) return;

    // 1. Indicator selector
    const g1 = document.createElement('div');
    g1.className = 'filter-group';
    g1.style.minWidth = '220px';
    g1.innerHTML = `
        <label>Indicator</label>
        <select onchange="selectChaptersIndicator(this.value)">
            ${ch.indicators.map(i => `<option value="${i.id}" ${i.id === activeIndicatorId ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select>
    `;
    container.appendChild(g1);

    // 2. Dynamic parameter selectors
    if (ind.dynamicParams) {
        ind.dynamicParams.forEach(p => {
            const currentVal = chaptersParams[p.key] || p.default;
            const g = document.createElement('div');
            g.className = 'filter-group';
            g.style.minWidth = '160px';
            g.innerHTML = `
                <label>${p.label}</label>
                <select onchange="changeChaptersParameter('${p.key}', this.value)">
                    ${p.options.map(o => `<option value="${o.value}" ${o.value === currentVal ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
            `;
            container.appendChild(g);
        });
    }
}

function selectChaptersIndicator(id) {
    activeIndicatorId = id;
    chaptersParams = {};
    selectedChaptersProvince = null; // Reset drilldown
    
    renderChaptersFilters();
    loadChaptersValues();
}

function changeChaptersParameter(key, val) {
    chaptersParams[key] = val;
    selectedChaptersProvince = null; // Reset drilldown
    
    loadChaptersValues();
}

function loadChaptersValues() {
    if (!geojsonCached) return;
    const spinner = document.getElementById('chapters-spinner');
    if (spinner) spinner.classList.add('active');

    const ch = CHAPTERS.find(c => c.slug === activeChapterSlug);
    const ind = ch.indicators.find(i => i.id === activeIndicatorId);

    const mergedParams = { ...(ind.fixedParams || {}) };
    if (ind.dynamicParams) {
        ind.dynamicParams.forEach(p => {
            mergedParams[p.key] = chaptersParams[p.key] || p.default;
        });
    }

    const url = new URL(`/api${ind.path}`, window.location.origin);
    Object.entries(mergedParams).forEach(([k, v]) => url.searchParams.set(k, v));

    fetch(url)
        .then(res => res.json())
        .then(data => {
            chaptersUnit = data.unit;
            chaptersNationalValue = data.national.value;
            chaptersIndicatorName = data.indicator || ind.name;

            // Map values
            chaptersProvinceValues = {};
            if (data.provinces) {
                data.provinces.forEach(p => {
                    chaptersProvinceValues[p.province_id] = p.value;
                });
            }

            chaptersDistrictValues = {};
            if (data.districts) {
                data.districts.forEach(d => {
                    chaptersDistrictValues[d.district_name] = d.value;
                });
            }

            // Compile rows for Data Table (All values)
            tableRows = [];
            
            // Add National
            if (chaptersNationalValue !== null) {
                tableRows.push({
                    name: 'National',
                    value: chaptersNationalValue,
                    type: 'national',
                    province: '',
                    vsNational: 0
                });
            }

            // Add Provinces
            PROVINCES.forEach(p => {
                const val = chaptersProvinceValues[p.code];
                tableRows.push({
                    name: p.name,
                    value: val,
                    type: 'province',
                    province: '',
                    vsNational: (val !== null && chaptersNationalValue !== null) ? (val - chaptersNationalValue) : null
                });
            });

            // Add Districts
            if (data.districts) {
                data.districts.forEach(d => {
                    const val = d.value;
                    const provCode = DISTRICT_PROVINCE[d.district_name];
                    const provName = PROVINCE_NAMES[provCode] || '';
                    tableRows.push({
                        name: d.district_name,
                        value: val,
                        type: 'district',
                        province: provName,
                        vsNational: (val !== null && chaptersNationalValue !== null) ? (val - chaptersNationalValue) : null
                    });
                });
            }

            // Recalculate ranks in tableRows based on values
            const rankable = tableRows.filter(r => r.type !== 'national' && r.value !== null);
            rankable.sort((a, b) => b.value - a.value);
            const rankMap = new Map();
            rankable.forEach((r, idx) => rankMap.set(r.name, idx + 1));
            tableRows.forEach(r => {
                r.rank = rankMap.get(r.name) || null;
            });

            // Refresh Map and Charts (supporting selected province drilldown)
            refreshChaptersVisualizations();
            
            // Render table page 0
            tablePage = 0;
            renderDataTable();

            if (spinner) spinner.classList.remove('active');
        })
        .catch(err => {
            console.error("Error loading chapter indicator data:", err);
            if (spinner) spinner.classList.remove('active');
        });
}

function refreshChaptersVisualizations() {
    if (!geojsonCached) return;

    // Update headers
    document.getElementById('chapters-display-indicator').innerText = chaptersIndicatorName;
    document.getElementById('chapters-national-badge').innerText = `National Average: ${formatValue(chaptersNationalValue, chaptersUnit)}`;

    const isProvinceSelected = selectedChaptersProvince !== null;
    
    // 1. Color map paths
    const allProvVals = Object.values(chaptersProvinceValues);
    const allDistVals = Object.values(chaptersDistrictValues).filter(v => v !== null);
    
    document.querySelectorAll('#chapters-map-svg path').forEach(path => {
        const provCode = parseInt(path.getAttribute('data-province'));
        const distName = path.getAttribute('data-district');

        if (isProvinceSelected) {
            // Province selected: color selected province's districts, grey out others
            if (provCode === selectedChaptersProvince) {
                const val = chaptersDistrictValues[distName];
                path.setAttribute('fill', getColorScaleValue(val, allDistVals));
                path.style.opacity = "1";
            } else {
                path.setAttribute('fill', '#E2E8F0');
                path.style.opacity = "0.4";
            }
        } else {
            // No province selected: color all districts by their province's value
            const val = chaptersProvinceValues[provCode];
            path.setAttribute('fill', getColorScaleValue(val, allProvVals));
            path.style.opacity = "1";
        }
    });

    // 2. Render Vertical Chart
    if (isProvinceSelected) {
        // District comparison for selected province
        document.getElementById('chapters-chart-title').innerText = `${PROVINCE_NAMES[selectedChaptersProvince]} District Comparison`;
        document.getElementById('chapters-chart-instruction').innerHTML = `<i class="fas fa-info-circle" style="color:var(--primary);"></i> Showing districts for ${PROVINCE_NAMES[selectedChaptersProvince]}. Click again to deselect province.`;
        
        // Find districts in selected province
        const dists = Object.keys(DISTRICT_PROVINCE).filter(k => DISTRICT_PROVINCE[k] === selectedChaptersProvince).sort();
        const labels = dists;
        const vals = dists.map(name => chaptersDistrictValues[name] !== undefined ? chaptersDistrictValues[name] : null);

        renderChartInstance(
            'chapters-chart-canvas',
            labels,
            vals,
            chaptersUnit,
            chaptersNationalValue,
            (idx) => {
                // Clicking district bar: no action or trigger tooltip
            }
        );
    } else {
        // Province comparison
        document.getElementById('chapters-chart-title').innerText = "Province Comparison";
        document.getElementById('chapters-chart-instruction').innerHTML = `<i class="fas fa-info-circle" style="color:var(--primary);"></i> Click a province on map/bar chart to view its <b>district breakdown</b>.`;

        const labels = PROVINCES.map(p => p.name);
        const vals = PROVINCES.map(p => chaptersProvinceValues[p.code]);

        renderChartInstance(
            'chapters-chart-canvas',
            labels,
            vals,
            chaptersUnit,
            chaptersNationalValue,
            (idx) => {
                // Click a province bar to drill down!
                const pCode = idx + 1; // Kigali=1, Southern=2, etc.
                toggleChaptersProvinceSelection(pCode);
            }
        );
    }
}

function toggleChaptersProvinceSelection(provCode) {
    if (selectedChaptersProvince === provCode) {
        selectedChaptersProvince = null; // deselect
    } else {
        selectedChaptersProvince = provCode;
    }
    
    // Sync header indicator on data table
    const tableDrilldown = document.getElementById('table-drilldown-info');
    if (selectedChaptersProvince) {
        tableDrilldown.innerHTML = `Showing districts in <b>${PROVINCE_NAMES[selectedChaptersProvince]}</b>. Click deselect to reset.`;
    } else {
        tableDrilldown.innerText = "Showing All Provinces. Click a province to view districts.";
    }

    refreshChaptersVisualizations();
    tablePage = 0;
    renderDataTable();
}

function handleChaptersMapClick(provCode, districtName) {
    toggleChaptersProvinceSelection(provCode);
}

function handleChaptersMapHover(event, districtName, provCode) {
    const isProvinceSelected = selectedChaptersProvince !== null;
    let title = '';
    let val = null;

    if (isProvinceSelected) {
        // District tooltip
        if (provCode === selectedChaptersProvince) {
            val = chaptersDistrictValues[districtName];
            title = `District: ${districtName}<br><strong>${PROVINCE_NAMES[provCode]}</strong>`;
            
            // Highlight hovered district
            document.querySelectorAll('#chapters-map-svg path').forEach(path => {
                if (path.getAttribute('data-district') === districtName) {
                    path.style.filter = "brightness(1.15)";
                }
            });
        }
    } else {
        // Province tooltip
        val = chaptersProvinceValues[provCode];
        title = `Province: ${PROVINCE_NAMES[provCode]}<br><span style="font-weight:400; font-size:0.7rem;">Hovering over ${districtName}</span>`;

        // Highlight all paths in this province
        document.querySelectorAll('#chapters-map-svg path').forEach(path => {
            if (parseInt(path.getAttribute('data-province')) === provCode) {
                path.style.filter = "brightness(1.15)";
            } else {
                path.style.opacity = "0.55";
            }
        });

        // Highlight Chart bar
        if (window.charts && window.charts['chapters-chart-canvas']) {
            const chart = window.charts['chapters-chart-canvas'];
            chart.setActiveElements([{ datasetIndex: 0, index: provCode - 1 }]);
            chart.update();
        }
    }

    // Tooltip display
    const tooltip = document.getElementById('chapters-map-tooltip');
    if (tooltip && (val !== null || isProvinceSelected)) {
        document.getElementById('chapters-tooltip-title').innerHTML = title;
        document.getElementById('chapters-tooltip-value').innerText = formatValue(val, chaptersUnit);
        tooltip.style.display = 'block';

        const container = document.querySelector('#tab-content-chapters .map-container').getBoundingClientRect();
        const x = event.clientX - container.left;
        const y = event.clientY - container.top;
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y - 65}px`;
    }
}

function handleChaptersMapLeave(districtName, provCode) {
    document.querySelectorAll('#chapters-map-svg path').forEach(path => {
        path.style.filter = "none";
        path.style.opacity = selectedChaptersProvince !== null && parseInt(path.getAttribute('data-province')) !== selectedChaptersProvince ? "0.4" : "1";
    });

    if (window.charts && window.charts['chapters-chart-canvas'] && selectedChaptersProvince === null) {
        const chart = window.charts['chapters-chart-canvas'];
        chart.setActiveElements([]);
        chart.update();
    }

    const tooltip = document.getElementById('chapters-map-tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// ── DATA TABLE IMPLEMENTATION ─────────────────
function toggleTableFilters() {
    showTableFilters = !showTableFilters;
    const panel = document.getElementById('table-filters-panel');
    const btn = document.getElementById('table-filters-toggle-btn');
    if (showTableFilters) {
        panel.style.display = 'block';
        btn.classList.add('active');
    } else {
        panel.style.display = 'none';
        btn.classList.remove('active');
    }
}

function toggleTableGrouping() {
    isTableGrouped = !isTableGrouped;
    const btn = document.getElementById('table-group-btn');
    if (isTableGrouped) {
        btn.classList.add('active');
        // Hide pagination as grouped renders headers
        document.getElementById('table-pagination').style.display = 'none';
    } else {
        btn.classList.remove('active');
        document.getElementById('table-pagination').style.display = 'flex';
    }
    tablePage = 0;
    renderDataTable();
}

function onTableSearch(query) {
    tableSearchQuery = query.toLowerCase();
    tablePage = 0;
    renderDataTable();
}

function onTableFiltersChanged() {
    // Show filter badge if anything is filtered
    const chkNat = document.getElementById('chk-type-national').checked;
    const chkProv = document.getElementById('chk-type-province').checked;
    const chkDist = document.getElementById('chk-type-district').checked;
    const provVal = document.getElementById('select-table-province').value;

    const isFiltered = !chkNat || !chkProv || !chkDist || provVal !== 'all';
    document.getElementById('table-filter-badge').style.display = isFiltered ? 'inline-block' : 'none';

    tablePage = 0;
    renderDataTable();
}

function sortTable(colName) {
    if (currentSortCol === colName) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortCol = colName;
        currentSortDir = 'asc';
    }
    tablePage = 0;
    renderDataTable();
}

function changeTablePage(direction) {
    tablePage += direction;
    renderDataTable();
}

function getProcessedTableRows() {
    // 1. Drilldown filtering based on map selection
    let rows = [...tableRows];
    if (selectedChaptersProvince !== null) {
        // Map province drilldown active: show national and districts for selected province ONLY
        rows = rows.filter(r => r.type === 'national' || (r.type === 'district' && DISTRICT_PROVINCE[r.name] === selectedChaptersProvince));
    }

    // 2. Apply Toolbar Type filters
    const chkNat = document.getElementById('chk-type-national').checked;
    const chkProv = document.getElementById('chk-type-province').checked;
    const chkDist = document.getElementById('chk-type-district').checked;

    rows = rows.filter(r => {
        if (r.type === 'national' && !chkNat) return false;
        if (r.type === 'province' && !chkProv) return false;
        if (r.type === 'district' && !chkDist) return false;
        return true;
    });

    // 3. Apply Toolbar Province dropdown filter
    const selectProvVal = document.getElementById('select-table-province').value;
    if (selectProvVal !== 'all') {
        rows = rows.filter(r => r.type === 'national' || r.type === 'province' || r.province === selectProvVal);
    }

    // 4. Apply Search Query
    if (tableSearchQuery) {
        rows = rows.filter(r => {
            return r.name.toLowerCase().includes(tableSearchQuery) || 
                   (r.province && r.province.toLowerCase().includes(tableSearchQuery));
        });
    }

    // 5. Apply Sorting (unless grouped)
    if (!isTableGrouped) {
        const dir = currentSortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            let valA = a[currentSortCol];
            let valB = b[currentSortCol];

            if (currentSortCol === 'rank') {
                valA = a.rank === null ? Infinity : a.rank;
                valB = b.rank === null ? Infinity : b.rank;
            } else if (currentSortCol === 'value' || currentSortCol === 'vsNational') {
                valA = a[currentSortCol] === null ? -Infinity : a[currentSortCol];
                valB = b[currentSortCol] === null ? -Infinity : b[currentSortCol];
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
                return dir * valA.localeCompare(valB);
            }

            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
    }

    return rows;
}

function renderDataTable() {
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer-summary');
    if (!tbody) return;

    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    const rows = getProcessedTableRows();
    const totalCount = rows.length;

    // Update pagination controls
    const totalPages = Math.ceil(totalCount / TABLE_ROWS_PER_PAGE);
    document.getElementById('table-row-count').innerText = `${totalCount} rows`;
    document.getElementById('table-page-info').innerText = `${tablePage + 1} / ${Math.max(1, totalPages)}`;
    document.getElementById('btn-prev-page').disabled = tablePage <= 0;
    document.getElementById('btn-next-page').disabled = tablePage >= totalPages - 1 || totalPages === 0;

    // Render Sort Icons
    ['rank', 'name', 'type', 'province', 'value', 'vsNational'].forEach(col => {
        const el = document.getElementById(`sort-icon-${col}`);
        if (!el) return;
        if (col === currentSortCol) {
            el.innerHTML = currentSortDir === 'asc' ? '<i class="fas fa-chevron-up ms-1 text-primary"></i>' : '<i class="fas fa-chevron-down ms-1 text-primary"></i>';
        } else {
            el.innerHTML = '<i class="fas fa-sort ms-1 opacity-25"></i>';
        }
    });

    const isPercent = chaptersUnit === 'Percentage';

    // Badge styling helper
    function getBadgeClass(type) {
        if (type === 'national') return 'badge-red';
        if (type === 'province') return 'badge-blue';
        return 'badge-gray';
    }

    if (isTableGrouped) {
        // Render Grouped by Province
        const grouped = { 'National': [] };
        PROVINCES.forEach(p => { grouped[p.name] = [] });

        rows.forEach(r => {
            if (r.type === 'national') {
                grouped['National'].push(r);
            } else if (r.type === 'province') {
                grouped[r.name].unshift(r); // place province summary row at start
            } else if (r.type === 'district') {
                const pName = r.province || 'Other';
                if (!grouped[pName]) grouped[pName] = [];
                grouped[pName].push(r);
            }
        });

        Object.entries(grouped).forEach(([groupName, groupRows]) => {
            if (groupRows.length === 0) return;

            const isCollapsed = tableCollapsedProvinces.has(groupName);

            // Group header row
            const headerRow = document.createElement('tr');
            headerRow.style.background = '#f8fafc';
            headerRow.style.cursor = 'pointer';
            headerRow.onclick = () => {
                if (isCollapsed) tableCollapsedProvinces.delete(groupName);
                else tableCollapsedProvinces.add(groupName);
                renderDataTable();
            };

            headerRow.innerHTML = `
                <td colspan="6" style="padding: 10px 14px; font-weight: 700; color:#475569;">
                    <i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} me-2 text-slate-400"></i>
                    ${groupName}
                    <span class="text-xs text-muted font-normal ms-2">(${groupRows.length} item${groupRows.length !== 1 ? 's' : ''})</span>
                </td>
            `;
            tbody.appendChild(headerRow);

            if (!isCollapsed) {
                groupRows.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="padding-left: 20px;">${row.rank ? `<span class="font-mono">${row.rank}</span>` : '—'}</td>
                        <td style="font-weight: 500;">${row.name}</td>
                        <td><span class="badge ${getBadgeClass(row.type)}">${row.type}</span></td>
                        <td class="hidden-md text-muted">${row.province || '—'}</td>
                        <td style="text-align: right; font-weight: 600;">${formatValue(row.value, chaptersUnit)}</td>
                        <td style="text-align: right; font-weight: 500;" class="hidden-lg ${row.vsNational > 0 ? 'text-green-600' : row.vsNational < 0 ? 'text-red-600' : 'text-slate-400'}">
                            ${row.vsNational !== null && row.vsNational !== 0 ? `${row.vsNational > 0 ? '+' : ''}${row.vsNational.toFixed(1)}${isPercent ? '%' : ''}` : '—'}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        });

    } else {
        // Render Standard Paginated Rows
        const pagedRows = rows.slice(tablePage * TABLE_ROWS_PER_PAGE, (tablePage + 1) * TABLE_ROWS_PER_PAGE);
        if (pagedRows.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="6" class="text-center py-5 text-muted">No data matches your filters.</td>`;
            tbody.appendChild(tr);
            return;
        }

        pagedRows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.rank ? `<span class="font-mono">${row.rank}</span>` : '—'}</td>
                <td style="font-weight: 500;">${row.name}</td>
                <td><span class="badge ${getBadgeClass(row.type)}">${row.type}</span></td>
                <td class="hidden-md text-muted">${row.province || '—'}</td>
                <td style="text-align: right; font-weight: 600;">${formatValue(row.value, chaptersUnit)}</td>
                <td style="text-align: right; font-weight: 500;" class="hidden-lg ${row.vsNational > 0 ? 'text-green-600' : row.vsNational < 0 ? 'text-red-600' : 'text-slate-400'}">
                    ${row.vsNational !== null && row.vsNational !== 0 ? `${row.vsNational > 0 ? '+' : ''}${row.vsNational.toFixed(1)}${isPercent ? '%' : ''}` : '—'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render Summary statistics footer
    const validVals = rows.filter(r => r.type !== 'national' && r.value !== null).map(r => r.value);
    if (validVals.length > 0) {
        const sorted = [...validVals].sort((a,b) => a-b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const mean = validVals.reduce((acc, v) => acc + v, 0) / validVals.length;
        const median = sorted.length % 2 === 0 ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2 : sorted[Math.floor(sorted.length/2)];

        tfoot.innerHTML = `
            <tr style="border-top: 2px solid var(--border-color); font-weight: 600;">
                <td colspan="4" style="padding: 12px 14px;">
                    <span class="text-xs uppercase tracking-wide text-muted font-bold">Summary Metrics (${validVals.length} regions)</span>
                </td>
                <td style="text-align: right; padding: 12px 14px; font-size: 0.76rem;" colspan="2">
                    <div class="d-flex flex-column align-items-end gap-1">
                        <span>Min: <b>${formatValue(min, chaptersUnit)}</b></span>
                        <span>Max: <b>${formatValue(max, chaptersUnit)}</b></span>
                        <span>Mean: <b>${formatValue(mean, chaptersUnit)}</b></span>
                        <span>Median: <b>${formatValue(median, chaptersUnit)}</b></span>
                    </div>
                </td>
            </tr>
        `;
    }
}

function exportTableToCSV() {
    const rows = getProcessedTableRows();
    const isPercent = chaptersUnit === 'Percentage';
    
    const header = ['Region', 'Type', 'Province', `${chaptersIndicatorName} ${isPercent ? '(%)' : `(${chaptersUnit})`}`, 'vs National'];
    const csvContent = [
        header.join(','),
        ...rows.map(r => {
            const vsNat = r.vsNational !== null ? r.vsNational.toFixed(2) : '';
            const val = r.value !== null ? r.value.toFixed(2) : '';
            return [
                `"${r.name}"`,
                r.type,
                `"${r.province || ''}"`,
                val,
                vsNat
            ].join(',');
        }),
        [],
        ['Source: Rwanda DHS 2019-20'],
        [`Exported: ${new Date().toLocaleDateString()}`]
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${chaptersIndicatorName.toLowerCase().replace(/\s+/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ─────────────────────────────────────────────────
// COMPARE TAB LOGIC
// ─────────────────────────────────────────────────
function renderCompareSelectors() {
    const chSelect = document.getElementById('compare-select-chapter');
    const indSelect = document.getElementById('compare-select-indicator');
    if (!chSelect || !indSelect) return;

    chSelect.innerHTML = CHAPTERS.map(c => `<option value="${c.slug}">${c.title}</option>`).join('');
    
    // Trigger chapter change to load indicators
    onCompareChapterChange(CHAPTERS[0].slug);
}

function onCompareChapterChange(slug) {
    activeCompareChapterSlug = slug;
    const indSelect = document.getElementById('compare-select-indicator');
    if (!indSelect) return;

    const ch = CHAPTERS.find(c => c.slug === slug);
    indSelect.innerHTML = ch.indicators.map(i => `<option value="${i.id}">${i.name}</option>`).join('');

    onCompareIndicatorChange(ch.indicators[0].id);
}

function onCompareIndicatorChange(id) {
    activeCompareIndicatorId = id;
    compareParams = {};

    const ch = CHAPTERS.find(c => c.slug === activeCompareChapterSlug);
    const ind = ch.indicators.find(i => i.id === id);

    const wrap = document.getElementById('compare-dynamic-params-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (ind.dynamicParams) {
        ind.dynamicParams.forEach(p => {
            const g = document.createElement('div');
            g.className = 'filter-group';
            g.style.minWidth = '130px';
            g.innerHTML = `
                <label>${p.label}</label>
                <select onchange="changeCompareParameter('${p.key}', this.value)">
                    ${p.options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
            `;
            wrap.appendChild(g);
        });
    }
}

function changeCompareParameter(key, val) {
    compareParams[key] = val;
}

function addIndicatorToCompare() {
    const ch = CHAPTERS.find(c => c.slug === activeCompareChapterSlug);
    const ind = ch.indicators.find(i => i.id === activeCompareIndicatorId);
    if (!ind) return;

    // Build unique identifier key
    const mergedParams = { ...(ind.fixedParams || {}) };
    if (ind.dynamicParams) {
        ind.dynamicParams.forEach(p => {
            mergedParams[p.key] = compareParams[p.key] || p.default;
        });
    }
    const id = `${activeCompareChapterSlug}::${activeCompareIndicatorId}::${JSON.stringify(mergedParams)}`;

    // Check if already exists
    if (selectedCompareIndicators.find(c => c.id === id)) {
        return;
    }

    const spinner = document.getElementById('chapters-spinner');
    if (spinner) spinner.classList.add('active');

    // Fetch values from API
    const url = new URL(`/api${ind.path}`, window.location.origin);
    Object.entries(mergedParams).forEach(([k, v]) => url.searchParams.set(k, v));

    fetch(url)
        .then(res => res.json())
        .then(data => {
            const provValues = {};
            if (data.provinces) {
                data.provinces.forEach(p => {
                    provValues[p.province_id] = p.value;
                });
            }

            const color = INDICATOR_COLORS[selectedCompareIndicators.length % INDICATOR_COLORS.length];

            selectedCompareIndicators.push({
                id: id,
                indicatorName: data.indicator || ind.name,
                chapterTitle: ch.title,
                path: ind.path,
                params: mergedParams,
                color: color,
                provData: PROVINCES.map(p => ({
                    code: p.code,
                    name: p.name,
                    value: provValues[p.code] !== undefined ? provValues[p.code] : null
                })),
                national: data.national.value,
                unit: data.unit
            });

            renderCompareUI();
            if (spinner) spinner.classList.remove('active');
        })
        .catch(err => {
            console.error("Error adding comparison indicator:", err);
            if (spinner) spinner.classList.remove('active');
        });
}

function removeComparisonIndicator(id) {
    selectedCompareIndicators = selectedCompareIndicators.filter(c => c.id !== id);
    renderCompareUI();
}

function setCompareMode(mode) {
    compareMode = mode;
    document.getElementById('compare-mode-province').classList.toggle('active', mode === 'province');
    document.getElementById('compare-mode-indicator').classList.toggle('active', mode === 'indicator');
    
    renderGroupedCompareChart();
}

function renderCompareUI() {
    const chips = document.getElementById('compare-chips-container');
    if (!chips) return;
    chips.innerHTML = '';

    if (selectedCompareIndicators.length === 0) {
        document.getElementById('compare-grouped-chart-card').style.display = 'none';
        document.getElementById('compare-table-card').style.display = 'none';
        document.getElementById('compare-individual-grid').innerHTML = `
            <div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-5 text-center text-slate-400" style="padding: 60px 20px;">
                <i class="fas fa-chart-bar mb-3 opacity-30" style="font-size: 2.2rem;"></i>
                <p class="font-medium" style="margin-bottom: 2px;">No indicators selected</p>
                <p class="text-xs text-muted" style="margin: 0;">Add one or more indicators above to start side-by-side comparison</p>
            </div>
        `;
        return;
    }

    // 1. Render chips
    selectedCompareIndicators.forEach(ind => {
        const chip = document.createElement('div');
        chip.className = 'compare-chip';
        chip.innerHTML = `
            <span class="dot" style="background:${ind.color};"></span>
            <span class="font-medium text-slate-700">${ind.indicatorName}</span>
            <span class="text-slate-400 text-xs" style="margin-left: 2px;">(${ind.unit === 'Percentage' ? '%' : ind.unit})</span>
            <button class="close-btn ms-1" onclick="removeComparisonIndicator('${ind.id}')"><i class="fas fa-times-circle"></i></button>
        `;
        chips.appendChild(chip);
    });

    // 2. Render Grouped Chart (if > 1 indicator)
    if (selectedCompareIndicators.length > 1) {
        document.getElementById('compare-grouped-chart-card').style.display = 'block';
        renderGroupedCompareChart();
    } else {
        document.getElementById('compare-grouped-chart-card').style.display = 'none';
    }

    // 3. Render Individual Grids
    renderCompareIndividualGrids();

    // 4. Render Compare Table
    document.getElementById('compare-table-card').style.display = 'block';
    renderCompareSummaryTable();
}

function renderGroupedCompareChart() {
    const canvasId = 'compare-grouped-chart-canvas';
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (window.charts && window.charts[canvasId]) {
        window.charts[canvasId].destroy();
    }

    let labels = [];
    let datasets = [];

    if (compareMode === 'province') {
        // Group by Province (Provinces on x-axis, indicators grouped side-by-side)
        labels = PROVINCES.map(p => p.name);
        datasets = selectedCompareIndicators.map(ind => ({
            label: ind.indicatorName,
            data: PROVINCES.map(p => {
                const entry = ind.provData.find(pd => pd.code === p.code);
                return entry ? entry.value : 0;
            }),
            backgroundColor: ind.color,
            borderRadius: 4,
            maxBarThickness: 30
        }));
    } else {
        // Group by Indicator (Indicators on x-axis, provinces grouped side-by-side)
        labels = selectedCompareIndicators.map(ind => ind.indicatorName);
        datasets = PROVINCES.map((p, idx) => ({
            label: p.name,
            data: selectedCompareIndicators.map(ind => {
                const entry = ind.provData.find(pd => pd.code === p.code);
                return entry ? entry.value : 0;
            }),
            backgroundColor: ['#1B3C74', '#0099D4', '#2A509A', '#4AB8E0', '#0D2550'][idx % 5],
            borderRadius: 4,
            maxBarThickness: 30
        }));
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 10, family: 'Inter', weight: '500' }, color: '#374151', padding: 10 }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 12, weight: 'bold', family: 'Inter' },
                    bodyFont: { size: 12, family: 'Inter' },
                    padding: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, family: 'Inter', weight: '500' }, color: '#374151' }
                },
                y: {
                    grid: { color: '#F1F5F9' },
                    ticks: { font: { size: 10, family: 'Inter' }, color: '#64748B' },
                    border: { display: false }
                }
            }
        }
    });

    if (!window.charts) window.charts = {};
    window.charts[canvasId] = chart;
}

function renderCompareIndividualGrids() {
    const grid = document.getElementById('compare-individual-grid');
    if (!grid) return;
    grid.innerHTML = '';

    selectedCompareIndicators.forEach((ind, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header" style="justify-content: space-between;">
                <div class="d-flex align-items-center gap-2">
                    <span style="width:12px; height:12px; border-radius:50%; background:${ind.color}; display:inline-block;"></span>
                    <h3 class="card-title">${ind.indicatorName}</h3>
                </div>
                ${ind.national !== null ? `<span class="badge badge-red" style="font-weight:700;">National: ${formatValue(ind.national, ind.unit)}</span>` : ''}
            </div>
            <div class="grid-2">
                <div>
                    <p class="mb-2 text-xs font-semibold text-center text-muted uppercase tracking-wide">Rwanda Provinces Map</p>
                    <div class="map-container">
                        <svg id="compare-map-${index}" viewBox="0 0 500 440" class="map-svg" style="width:100%; max-height:280px;"></svg>
                    </div>
                </div>
                <div>
                    <p class="mb-2 text-xs font-semibold text-center text-muted uppercase tracking-wide">Province Comparison</p>
                    <div style="height: 250px; position: relative; padding: 10px 0;">
                        <canvas id="compare-canvas-${index}"></canvas>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);

        // Draw individual map
        if (geojsonCached) {
            drawMapSvg(`compare-map-${index}`, geojsonCached, null, null, null);
            
            // Color map paths based on this indicator values
            const allVals = ind.provData.map(d => d.value);
            document.querySelectorAll(`#compare-map-${index} path`).forEach(path => {
                const provCode = parseInt(path.getAttribute('data-province'));
                const valEntry = ind.provData.find(d => d.code === provCode);
                const val = valEntry ? valEntry.value : null;
                path.setAttribute('fill', getColorScaleValue(val, allVals));
            });
        }

        // Draw individual chart
        const labels = PROVINCES.map(p => p.name);
        const chartVals = PROVINCES.map(p => {
            const entry = ind.provData.find(pd => pd.code === p.code);
            return entry ? entry.value : null;
        });

        renderChartInstance(
            `compare-canvas-${index}`,
            labels,
            chartVals,
            ind.unit,
            ind.national,
            null,
            null,
            [ind.color] // single custom color for this indicator chart
        );
    });
}

function renderCompareSummaryTable() {
    const tableHeader = document.getElementById('compare-table-header-row');
    const tableBody = document.getElementById('compare-table-body-rows');
    if (!tableHeader || !tableBody) return;

    // 1. Clear dynamic parts
    tableHeader.innerHTML = '<th style="padding: 10px;">Province</th>';
    tableBody.innerHTML = '';

    // 2. Add dynamic header columns
    selectedCompareIndicators.forEach(ind => {
        const th = document.createElement('th');
        th.style.padding = '10px';
        th.style.textAlign = 'right';
        th.style.whiteSpace = 'nowrap';
        th.innerHTML = `
            <span class="inline-flex align-items-center gap-1.5">
                <span style="width:8px; height:8px; border-radius:50%; background:${ind.color}; display:inline-block;"></span>
                ${ind.indicatorName}
            </span>
        `;
        tableHeader.appendChild(th);
    });

    // 3. Add National row
    const nationalRow = document.createElement('tr');
    nationalRow.style.background = '#fef2f2';
    nationalRow.style.fontWeight = '600';
    nationalRow.innerHTML = `<td style="padding: 10px; color: #b91c1c;">National</td>`;
    selectedCompareIndicators.forEach(ind => {
        const td = document.createElement('td');
        td.style.padding = '10px';
        td.style.textAlign = 'right';
        td.style.color = '#b91c1c';
        td.innerText = formatValue(ind.national, ind.unit);
        nationalRow.appendChild(td);
    });
    tableBody.appendChild(nationalRow);

    // 4. Add Province rows
    PROVINCES.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="padding: 10px; font-weight:500;">${p.name}</td>`;
        selectedCompareIndicators.forEach(ind => {
            const entry = ind.provData.find(pd => pd.code === p.code);
            const val = entry ? entry.value : null;
            const td = document.createElement('td');
            td.style.padding = '10px';
            td.style.textAlign = 'right';
            td.innerText = formatValue(val, ind.unit);
            tr.appendChild(td);
        });
        tableBody.appendChild(tr);
    });
}

// ─────────────────────────────────────────────────
// REPORT BUILDER STATE & MODAL EVENTS
// ─────────────────────────────────────────────────
function openReportBuilderModal() {
    const modal = document.getElementById('report-builder-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    activeReportTab = 'content';
    switchReportTab('content');

    // Render Indicators Checklist
    renderReportIndicatorsChecklist();
    // Render Provinces Checklist
    renderReportProvincesChecklist();

    updateReportSummaryText();
}

function closeReportBuilderModal() {
    const modal = document.getElementById('report-builder-modal');
    if (modal) modal.style.display = 'none';
}

function switchReportTab(tabId) {
    document.querySelectorAll('.report-tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('#report-builder-modal .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottom = 'none';
    });

    const panel = document.getElementById(`report-tab-content-${tabId}`);
    const btn = document.getElementById(`report-tab-btn-${tabId}`);
    if (panel) panel.classList.add('active');
    if (btn) {
        btn.classList.add('active');
        btn.style.borderBottom = '2px solid var(--primary)';
    }

    activeReportTab = tabId;
}

function renderReportIndicatorsChecklist() {
    const container = document.getElementById('report-indicators-checklist');
    if (!container) return;
    container.innerHTML = '';

    CHAPTERS.forEach(ch => {
        const isExpanded = expandedReportChapters.has(ch.slug);
        const chapterKeys = ch.indicators.map(i => `${ch.slug}::${i.id}`);
        const selectedCount = chapterKeys.filter(k => selectedReportIndicators.has(k)).length;
        const allSelected = selectedCount === chapterKeys.length;

        const wrapper = document.createElement('div');
        wrapper.className = 'border rounded-lg mb-1 overflow-hidden';

        // Header Row
        const header = document.createElement('div');
        header.className = 'report-chapter-header';
        header.innerHTML = `
            <input type="checkbox" ${allSelected ? 'checked' : ''} style="width:15px; height:15px; cursor:pointer;" onclick="toggleReportChapterCheckbox(event, '${ch.slug}')">
            <div style="flex-grow:1; display:flex; align-items:center; gap:8px;" onclick="toggleReportChapterCollapse('${ch.slug}')">
                <i class="fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-muted" style="font-size:0.75rem;"></i>
                <span class="font-semibold text-sm m-0" style="color:var(--text-main); font-size:0.82rem;">${ch.emoji} ${ch.title}</span>
                ${selectedCount > 0 ? `<span class="badge badge-blue ms-2" style="font-size:0.65rem;">${selectedCount}/${chapterKeys.length}</span>` : ''}
            </div>
        `;
        wrapper.appendChild(header);

        // Body Indicators Row
        if (isExpanded) {
            const body = document.createElement('div');
            body.className = 'report-chapter-indicators';

            ch.indicators.forEach(ind => {
                const key = `${ch.slug}::${ind.id}`;
                const row = document.createElement('div');
                row.className = 'report-indicator-row';
                row.innerHTML = `
                    <input type="checkbox" ${selectedReportIndicators.has(key) ? 'checked' : ''} style="width:14px; height:14px; margin-top:2px; cursor:pointer;" onclick="toggleReportIndicatorCheckbox(event, '${key}')">
                    <div style="flex-grow:1;" onclick="toggleReportIndicatorCheckbox(null, '${key}')">
                        <p class="text-sm font-semibold" style="font-size:0.78rem; color:#334155; margin-bottom:1px;">${ind.name}</p>
                        <p class="text-xs text-muted" style="font-size:0.68rem; margin:0;">${ind.description}</p>
                    </div>
                `;
                body.appendChild(row);
            });

            wrapper.appendChild(body);
        }

        container.appendChild(wrapper);
    });
}

function toggleReportChapterCollapse(slug) {
    if (expandedReportChapters.has(slug)) {
        expandedReportChapters.delete(slug);
    } else {
        expandedReportChapters.add(slug);
    }
    renderReportIndicatorsChecklist();
}

function toggleReportChapterCheckbox(event, slug) {
    if (event) event.stopPropagation();

    const ch = CHAPTERS.find(c => c.slug === slug);
    if (!ch) return;

    const chapterKeys = ch.indicators.map(i => `${slug}::${i.id}`);
    const allSelected = chapterKeys.every(k => selectedReportIndicators.has(k));

    if (allSelected) {
        chapterKeys.forEach(k => selectedReportIndicators.delete(k));
    } else {
        chapterKeys.forEach(k => selectedReportIndicators.add(k));
    }

    renderReportIndicatorsChecklist();
    updateReportSummaryText();
}

function toggleReportIndicatorCheckbox(event, key) {
    if (event) event.stopPropagation();

    if (selectedReportIndicators.has(key)) {
        selectedReportIndicators.delete(key);
    } else {
        selectedReportIndicators.add(key);
    }

    renderReportIndicatorsChecklist();
    updateReportSummaryText();
}

function renderReportProvincesChecklist() {
    const container = document.getElementById('report-provinces-checklist');
    if (!container) return;
    container.innerHTML = '';

    const list = ['Kigali City', 'Southern Province', 'Western Province', 'Northern Province', 'Eastern Province'];
    list.forEach(provName => {
        const isChecked = selectedReportProvinces.has(provName);
        const div = document.createElement('label');
        div.className = 'd-flex align-items-center gap-2 p-2 rounded border cursor-pointer hover:bg-light';
        div.style.fontSize = '0.82rem';
        div.style.margin = '0';
        div.innerHTML = `
            <input type="checkbox" ${isChecked ? 'checked' : ''} style="width:15px; height:15px; cursor:pointer;" onchange="toggleReportProvinceCheckbox('${provName}')">
            <span>${provName}</span>
        `;
        container.appendChild(div);
    });
}

function toggleReportProvinceCheckbox(provName) {
    if (selectedReportProvinces.has(provName)) {
        selectedReportProvinces.delete(provName);
    } else {
        selectedReportProvinces.add(provName);
    }

    renderReportProvincesChecklist();
    updateReportSummaryText();
}

function toggleAllReportProvinces() {
    const list = ['Kigali City', 'Southern Province', 'Western Province', 'Northern Province', 'Eastern Province'];
    const btn = document.getElementById('report-prov-toggle-all-btn');

    if (selectedReportProvinces.size === 5) {
        selectedReportProvinces.clear();
        btn.innerText = 'Select All';
    } else {
        list.forEach(p => selectedReportProvinces.add(p));
        btn.innerText = 'Deselect All';
    }

    renderReportProvincesChecklist();
    updateReportSummaryText();
}

function updateReportSummaryText() {
    const indCount = selectedReportIndicators.size;
    const provCount = selectedReportProvinces.size;
    const inclNat = document.getElementById('report-incl-national').checked;
    
    let regionText = `${provCount} province${provCount !== 1 ? 's' : ''}`;
    if (inclNat) {
        regionText = `National + ${regionText}`;
    }

    document.getElementById('report-selection-summary').innerText = `${indCount} indicator${indCount !== 1 ? 's' : ''} · ${regionText}`;
}

function setReportFormat(format) {
    reportFormat = format;
    
    // Toggle active state classes
    document.getElementById('report-format-pdf-btn').classList.toggle('active', format === 'pdf');
    document.getElementById('report-format-word-btn').classList.toggle('active', format === 'word');
    
    // Update active styles for icons
    document.querySelector('#report-format-pdf-btn i').className = `fas fa-print ${format === 'pdf' ? 'text-primary' : 'text-muted'} mb-2`;
    document.querySelector('#report-format-word-btn i').className = `fas fa-file-word ${format === 'word' ? 'text-primary' : 'text-muted'} mb-2`;

    // Update submit button text and icon
    const submitBtn = document.getElementById('report-submit-btn');
    if (format === 'pdf') {
        submitBtn.innerHTML = '<i class="fas fa-print me-1"></i> Print / Save PDF';
    } else {
        submitBtn.innerHTML = '<i class="fas fa-download me-1"></i> Download Word';
    }
}

// ── REPORT GENERATION ────────────────────────────
async function generateReport() {
    if (selectedReportIndicators.size === 0) {
        alert("Please select at least one indicator to include in the report.");
        return;
    }

    // Show spinner overlay in modal
    const spinner = document.getElementById('chapters-spinner');
    if (spinner) spinner.classList.add('active');

    const inclNational = document.getElementById('report-incl-national').checked;
    const inclDistricts = document.getElementById('report-incl-districts').checked;

    // Convert Set to list of { indicatorConfig, chapterConfig }
    const selectedList = [];
    CHAPTERS.forEach(ch => {
        ch.indicators.forEach(ind => {
            const key = `${ch.slug}::${ind.id}`;
            if (selectedReportIndicators.has(key)) {
                selectedList.push({ indicator: ind, chapter: ch });
            }
        });
    });

    try {
        // Fetch all selected indicators data in parallel
        const fetchPromises = selectedList.map(async ({ indicator, chapter }) => {
            const params = { ...(indicator.fixedParams || {}) };
            if (indicator.dynamicParams) {
                indicator.dynamicParams.forEach(p => {
                    params[p.key] = p.default;
                });
            }
            
            const url = new URL(`/api${indicator.path}`, window.location.origin);
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
            
            const res = await fetch(url);
            if (!res.ok) throw new Error(`API fetch error for ${indicator.name}`);
            const data = await res.json();
            
            return {
                data,
                indicator,
                chapter
            };
        });

        const reportResults = await Promise.all(fetchPromises);

        // Build HTML Content
        const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        
        let reportHTML = `
            <h1>DHS Rwanda Analytics Report</h1>
            <p class="meta">Demographic and Health Survey 2019–20 · National Institute of Statistics of Rwanda (NISR)</p>
            <p class="meta">Report compiled on: ${now}</p>
            <hr style="border:none;border-top:1px solid #cbd5e1;margin:12pt 0">
        `;

        reportResults.forEach(({ data, indicator, chapter }) => {
            const isPercent = data.unit === 'Percentage';
            
            // Filter geography values
            const rows = [];
            
            // 1. National
            if (inclNational && data.national && data.national.value !== null) {
                rows.push({ name: 'National', type: 'national', value: data.national.value });
            }

            // 2. Selected Provinces
            if (data.provinces) {
                data.provinces.forEach(p => {
                    if (selectedReportProvinces.has(p.province_name)) {
                        rows.push({ name: p.province_name, type: 'province', value: p.value });
                    }
                });
            }

            // 3. Districts (if checked)
            if (inclDistricts && data.districts) {
                data.districts.forEach(d => {
                    const pCode = DISTRICT_PROVINCE[d.district_name];
                    const pName = PROVINCE_NAMES[pCode];
                    if (selectedReportProvinces.has(pName)) {
                        rows.push({ name: `${d.district_name} District`, type: 'district', value: d.value, parent: pName });
                    }
                });
            }

            reportHTML += `
                <div class="section">
                    <h2>${chapter.title} — ${data.indicator || indicator.name}</h2>
                    <div class="highlight"><strong>Description:</strong> ${indicator.description}</div>
                    <p class="meta">Unit: ${data.unit} · Source: ${data.data_source}</p>
                    
                    ${rows.length > 0 ? `
                        <h3>Data Breakdown</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Region</th>
                                    <th>Type</th>
                                    <th style="text-align:right;">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => `
                                    <tr>
                                        <td><strong>${r.name}</strong> ${r.parent ? `<span style="color:#64748b; font-size:8.5pt;">(${r.parent})</span>` : ''}</td>
                                        <td class="${r.type}-badge">${r.type}</td>
                                        <td style="text-align:right; font-weight:bold;">${formatValue(r.value, data.unit)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p class="meta">No regional breakdowns selected.</p>'}
                </div>
                <div style="page-break-after:always;"></div>
            `;
        });

        reportHTML += `
            <hr style="border:none;border-top:1px solid #cbd5e1;margin:12pt 0">
            <p class="meta" style="text-align:center;">Data Source: Rwanda Demographic and Health Survey 2019–20</p>
            <p class="meta" style="text-align:center;">Report produced dynamically by National Institute of Statistics of Rwanda (NISR)</p>
        `;

        if (spinner) spinner.classList.remove('active');
        closeReportBuilderModal();

        // Trigger PDF / Word Driver
        if (reportFormat === 'pdf') {
            triggerPDFPrint(reportHTML);
        } else {
            triggerWordDocDownload(reportHTML, 'DHS_Rwanda_Analytics_Report');
        }

    } catch (e) {
        console.error("Failed to generate report:", e);
        alert("An error occurred during report generation. Please try again.");
        if (spinner) spinner.classList.remove('active');
    }
}

// ── Export Drivers ──────────────────────────────
function triggerPDFPrint(html) {
    const iframe = document.getElementById('report-print-iframe');
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>DHS Rwanda Analytics Report</title>
            <style>
                @media print {
                    body { margin: 1.5cm; font-family: 'Inter', sans-serif; font-size: 10pt; color: #1e293b; }
                    h1 { font-family: 'Outfit', sans-serif; font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-bottom: 20px; }
                    h2 { font-family: 'Outfit', sans-serif; font-size: 14pt; color: #1e3a8a; margin-top: 24px; margin-bottom: 8px; }
                    h3 { font-family: 'Outfit', sans-serif; font-size: 11pt; color: #475569; margin-top: 14px; margin-bottom: 6px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 9pt; }
                    th { background: #f8fafc; color: #1e3a8a; padding: 6px 10px; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; }
                    td { padding: 6px 10px; border: 1px solid #e2e8f0; }
                    tr:nth-child(even) td { background: #f8fafc; }
                    .national-badge { color: #dc2626; font-weight: bold; text-transform: uppercase; font-size: 8pt; }
                    .province-badge { color: #2563eb; font-weight: bold; text-transform: uppercase; font-size: 8pt; }
                    .district-badge { color: #475569; font-weight: bold; text-transform: uppercase; font-size: 8pt; }
                    .meta { color: #64748b; font-size: 8pt; margin: 4px 0; }
                    .section { page-break-inside: avoid; margin-bottom: 30px; }
                    .highlight { background: #f0fdf4; padding: 8px 12px; border-left: 4px solid #10b981; margin: 8px 0; border-radius: 4px; font-size: 9.5pt; }
                }
            </style>
        </head>
        <body>
            ${html}
            <script>
                window.onload = function() {
                    window.print();
                }
            <\/script>
        </body>
        </html>
    `);
    doc.close();
}

function triggerWordDocDownload(html, filename) {
    const doc = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
        <meta charset="utf-8">
        <title>DHS Rwanda Analytics Report</title>
        <style>
            body { font-family: Calibri, sans-serif; font-size: 11pt; color: #1e293b; margin: 2cm; }
            h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6pt; }
            h2 { font-size: 14pt; color: #1e3a8a; margin-top: 18pt; }
            h3 { font-size: 11pt; color: #475569; margin-top: 12pt; }
            table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }
            th { background: #f8fafc; color: #1e3a8a; padding: 6pt 8pt; text-align: left; border: 1px solid #cbd5e1; font-weight: bold; }
            td { padding: 5pt 8pt; border: 1px solid #e2e8f0; }
            tr:nth-child(even) td { background: #f8fafc; }
            .national-badge { color: #dc2626; font-weight: bold; }
            .province-badge { color: #2563eb; }
            .district-badge { color: #475569; }
            .meta { color: #64748b; font-size: 9pt; }
            .section { page-break-inside: avoid; }
            .highlight { background: #f8fafc; padding: 8pt; border-left: 3px solid #10b981; margin: 6pt 0; }
        </style>
        </head>
        <body>
            ${html}
        </body>
        </html>
    `;

    const blob = new Blob([doc], { type: 'application/vnd.ms-word' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
