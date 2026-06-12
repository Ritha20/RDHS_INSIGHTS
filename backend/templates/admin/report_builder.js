// ════════════════════════════════════════════════════════════════════
//  REPORT BUILDER WORKSPACE
//  Google-Docs-style report designer with a live indicator library,
//  drag-and-drop canvas, a context-sensitive properties panel, and
//  PDF / Word / PowerPoint export.
//
//  Depends on the shared catalog defined in admin/indicators_data.js
//  (CHAPTERS, PROVINCES, PROVINCE_NAMES, DISTRICT_PROVINCE, NISR_SCALE).
//  NOTE: this file is rendered through Django's template engine, so it must
//  never contain Django's open-tag token sequences (double-brace or
//  brace-percent), or template parsing will fail.
// ════════════════════════════════════════════════════════════════════

// ── Workspace State ─────────────────────────────────────────────────
const rbState = {
    title: 'Untitled DHS Report',
    subtitle: 'Demographic and Health Survey 2019–20 · NISR',
    blocks: [],
    selectedId: null,
    draftId: null,       // id of the currently open draft (null = unsaved)
};

// ── Draft Library ────────────────────────────────────────────────────
const RB_DRAFTS_KEY = 'rdhs_rb_drafts';

function rbGetDrafts() {
    try { return JSON.parse(localStorage.getItem(RB_DRAFTS_KEY)) || []; }
    catch (e) { return []; }
}
function rbSetDrafts(arr) { localStorage.setItem(RB_DRAFTS_KEY, JSON.stringify(arr)); }

function rbOpenDraftLibrary() {
    const drafts = rbGetDrafts();
    const list   = document.getElementById('rb-drafts-list');

    if (!drafts.length) {
        list.innerHTML =
            '<div class="rb-drafts-empty">'
            + '<i class="fas fa-folder-open"></i>'
            + '<p>No saved drafts yet.</p>'
            + '<p style="font-size:0.78rem;color:#94a3b8;">Click <strong>Save Draft</strong> to save your current work.</p>'
            + '</div>';
    } else {
        list.innerHTML = drafts.map(function(d) {
            var date    = new Date(d.updatedAt || d.createdAt);
            var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            var isActive = d.id === rbState.draftId;
            return '<div class="rb-draft-item' + (isActive ? ' active' : '') + '">'
                + '<div class="rb-draft-info">'
                +   '<div class="rb-draft-title">' + rbEsc(d.title || 'Untitled Report') + '</div>'
                +   '<div class="rb-draft-meta">' + (d.blocks ? d.blocks.length : 0) + ' blocks &nbsp;·&nbsp; Last saved ' + dateStr + '</div>'
                + '</div>'
                + '<div class="rb-draft-actions">'
                +   (isActive
                        ? '<span class="rb-draft-badge">Active</span>'
                        : '<button class="btn btn-primary btn-sm" onclick="rbLoadDraftById(\'' + d.id + '\')">Open</button>')
                +   '<button class="btn btn-ghost btn-sm rb-draft-del" title="Delete" onclick="rbDeleteDraft(\'' + d.id + '\')"><i class="fas fa-trash"></i></button>'
                + '</div>'
                + '</div>';
        }).join('');
    }

    document.getElementById('rb-drafts-modal').style.display = 'flex';
}

function rbCloseDraftLibrary() {
    document.getElementById('rb-drafts-modal').style.display = 'none';
}

function rbLoadDraftById(id) {
    var drafts = rbGetDrafts();
    var draft  = drafts.find(function(d) { return d.id === id; });
    if (!draft) return;

    rbState.title      = draft.title    || 'Untitled DHS Report';
    rbState.subtitle   = draft.subtitle || '';
    rbState.blocks     = draft.blocks   || [];
    rbState.draftId    = draft.id;
    rbState.selectedId = null;

    var titleEl = document.getElementById('rb-doc-title');
    if (titleEl) titleEl.value = rbState.title;

    rbRenderDoc();
    rbRenderProps();
    rbCloseDraftLibrary();

    var status = document.getElementById('rb-doc-status');
    if (status) {
        status.textContent = '✓ Draft loaded';
        status.style.color = '#16a34a';
        setTimeout(function() { status.style.color = ''; rbUpdateStatus(); }, 2000);
    }
}

function rbDeleteDraft(id) {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    rbSetDrafts(rbGetDrafts().filter(function(d) { return d.id !== id; }));
    if (rbState.draftId === id) rbState.draftId = null;
    rbOpenDraftLibrary();
}

function rbToggleProps() {
    var panel = document.getElementById('rb-props-panel');
    var icon  = document.getElementById('rb-props-toggle-icon');
    var btn   = document.getElementById('rb-props-toggle-btn');
    var collapsed = panel.classList.toggle('collapsed');
    localStorage.setItem('rdhs_rb_props_collapsed', collapsed ? '1' : '0');
    if (icon) icon.className = collapsed ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
    if (btn)  btn.title      = collapsed ? 'Expand panel' : 'Collapse panel';
}

function rbToggleLibrary() {
    var lib  = document.getElementById('rb-library');
    var icon = document.getElementById('rb-lib-toggle-icon');
    var btn  = document.getElementById('rb-lib-toggle-btn');
    var collapsed = lib.classList.toggle('collapsed');
    localStorage.setItem('rdhs_rb_lib_collapsed', collapsed ? '1' : '0');
    if (icon) icon.className = collapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
    if (btn)  btn.title      = collapsed ? 'Expand panel' : 'Collapse panel';
}

function rbNewReport() {
    if (!confirm('Start a new report? Unsaved changes will be lost.')) return;
    rbState.title      = 'Untitled DHS Report';
    rbState.subtitle   = 'Demographic and Health Survey 2019–20 · NISR';
    rbState.blocks     = [];
    rbState.draftId    = null;
    rbState.selectedId = null;
    var h = rbNewText('h1'); h.html = 'DHS Rwanda Analytics Report';
    var p = rbNewText('p');  p.html = 'Drag indicators from the left to embed live visualizations, then add narrative text around them.';
    rbState.blocks.push(h, p);
    var titleEl = document.getElementById('rb-doc-title');
    if (titleEl) titleEl.value = rbState.title;
    rbRenderDoc();
    rbRenderProps();
    rbCloseDraftLibrary();
}

const rbGeo = { json: null, minLon: 0, maxLon: 0, minLat: 0, maxLat: 0, loaded: false };

let rbDrag = null;          // pending drag descriptor { kind:'new'|'move', ... }
let rbActiveTextBlockId = null;  // id of the text block the cursor was last in
let rbUidCounter = 0;
function rbUid() { return 'b' + (++rbUidCounter) + Date.now().toString(36); }

const RB_VIZ_TYPES = [
    { id: 'kpi',   label: 'KPI',   icon: 'fa-gauge-high' },
    { id: 'bar',   label: 'Chart', icon: 'fa-chart-column' },
    { id: 'table', label: 'Table', icon: 'fa-table' },
    { id: 'map',   label: 'Map',   icon: 'fa-map' },
];

const RB_ELEMENTS = [
    { key: 'h1',        label: 'Heading',    icon: 'fa-heading',      make: () => rbNewText('h1') },
    { key: 'p',         label: 'Text',       icon: 'fa-paragraph',    make: () => rbNewText('p') },
    { key: 'ul',        label: 'List',       icon: 'fa-list-ul',      make: () => rbNewText('ul') },
    { key: 'table',     label: 'Table',      icon: 'fa-table-cells',  make: () => rbNewTable() },
    { key: 'image',     label: 'Image',      icon: 'fa-image',        make: () => rbNewImage() },
    { key: 'pagebreak', label: 'Page Break', icon: 'fa-scissors',     make: () => rbNewPageBreak() },
];

// ── Block factories ─────────────────────────────────────────────────
function rbNewText(style) {
    const placeholders = { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', p: 'Type a paragraph…', ul: 'List item' };
    return { id: rbUid(), type: 'text', style: style, html: '', align: 'left', placeholder: placeholders[style] || 'Text…' };
}
function rbNewTable() {
    return { id: rbUid(), type: 'table', rows: 3, cols: 3,
        cells: [['Column A', 'Column B', 'Column C'], ['', '', ''], ['', '', '']] };
}
function rbNewImage() { return { id: rbUid(), type: 'image', src: '', caption: '', width: 80 }; }
function rbNewPageBreak() { return { id: rbUid(), type: 'pagebreak' }; }

function rbFindIndicator(chapterSlug, indicatorId) {
    const ch = CHAPTERS.find(c => c.slug === chapterSlug);
    if (!ch) return null;
    return ch.indicators.find(i => i.id === indicatorId) || null;
}
function rbNewIndicator(chapterSlug, indicatorId) {
    const ind = rbFindIndicator(chapterSlug, indicatorId);
    if (!ind) return null;
    const params = {};
    if (ind.dynamicParams) ind.dynamicParams.forEach(p => { params[p.key] = p.default; });
    return {
        id: rbUid(), type: 'indicator',
        chapterSlug: chapterSlug, indicatorId: indicatorId,
        title: ind.name,
        viz: 'bar',
        params: params,
        inclNational: true,
        inclDistricts: false,
        provinces: PROVINCES.map(p => p.code),
        size: 'full',
        data: null, dataSig: null, loading: false,
    };
}

// ── Init ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Restore saved draft, or seed with starter content for first-time visitors
    if (!rbLoadDraft()) {
        const h = rbNewText('h1'); h.html = 'DHS Rwanda Analytics Report';
        const p = rbNewText('p'); p.html = 'Drag indicators from the left to embed live visualizations, then add narrative text around them.';
        rbState.blocks.push(h, p);
    }

    // Restore library panel collapsed state
    if (localStorage.getItem('rdhs_rb_lib_collapsed') === '1') {
        var lib  = document.getElementById('rb-library');
        var icon = document.getElementById('rb-lib-toggle-icon');
        var btn  = document.getElementById('rb-lib-toggle-btn');
        if (lib)  lib.classList.add('collapsed');
        if (icon) icon.className = 'fas fa-chevron-right';
        if (btn)  btn.title      = 'Expand panel';
    }

    // Restore properties panel collapsed state
    if (localStorage.getItem('rdhs_rb_props_collapsed') === '1') {
        var props     = document.getElementById('rb-props-panel');
        var propsIcon = document.getElementById('rb-props-toggle-icon');
        var propsBtn  = document.getElementById('rb-props-toggle-btn');
        if (props)     props.classList.add('collapsed');
        if (propsIcon) propsIcon.className = 'fas fa-chevron-left';
        if (propsBtn)  propsBtn.title      = 'Expand panel';
    }

    rbBuildLibrary();
    rbRenderDoc();
    rbRenderProps();
    rbFetchGeoJSON();
    rbWireCanvasDnD();

    // Close menus on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.rb-add-menu-wrap')) rbCloseMenu('rb-add-menu');
        if (!e.target.closest('#rb-export-wrap')) rbCloseMenu('rb-export-menu');
        if (!e.target.closest('.rb-color-wrap')) rbCloseMenu('rb-color-pop');
    });

    // Keep the ribbon's bold/italic/etc. state in sync with the cursor
    document.addEventListener('selectionchange', () => {
        const ae = document.activeElement;
        if (ae && ae.classList && ae.classList.contains('rb-text')) rbUpdateToolbarState();
    });

    rbUpdateToolbarState();
});

// ── LEFT: Indicator Library ─────────────────────────────────────────
function rbBuildLibrary() {
    // Content element tiles
    const eg = document.getElementById('rb-elements-grid');
    eg.innerHTML = RB_ELEMENTS.map(el => `
        <div class="rb-element-tile" draggable="true"
             ondragstart="rbDragStartElement(event,'${el.key}')" ondragend="rbDragEnd()">
            <i class="fas ${el.icon}"></i><span>${el.label}</span>
        </div>`).join('');

    // Chapters
    const list = document.getElementById('rb-chapters-list');
    list.innerHTML = CHAPTERS.map((ch, idx) => `
        <div class="rb-chapter ${idx === 0 ? 'open' : ''}" data-slug="${ch.slug}">
            <div class="rb-chapter-head" onclick="rbToggleChapter('${ch.slug}')">
                <span class="emoji">${ch.emoji}</span>
                <span>${ch.title}</span>
                <span class="count">${ch.indicators.length}</span>
                <i class="fas fa-chevron-right chevron"></i>
            </div>
            <div class="rb-chapter-items">
                ${ch.indicators.map(ind => `
                    <div class="rb-indicator" draggable="true"
                         data-name="${ind.name.toLowerCase()}" data-chapter="${ch.title.toLowerCase()}"
                         ondragstart="rbDragStartIndicator(event,'${ch.slug}','${ind.id}')" ondragend="rbDragEnd()"
                         ondblclick="rbInsertBlock(rbNewIndicator('${ch.slug}','${ind.id}'))"
                         title="Drag onto the page, or double-click to insert">
                        <span class="rb-ind-icon"><i class="fas fa-chart-column"></i></span>
                        <span>${ind.name}</span>
                        <i class="fas fa-grip-vertical grip"></i>
                    </div>`).join('')}
            </div>
        </div>`).join('');
}

function rbToggleChapter(slug) {
    const el = document.querySelector(`.rb-chapter[data-slug="${slug}"]`);
    if (el) el.classList.toggle('open');
}

function rbFilterLibrary(q) {
    q = (q || '').trim().toLowerCase();
    document.querySelectorAll('.rb-chapter').forEach(chEl => {
        let visible = 0;
        chEl.querySelectorAll('.rb-indicator').forEach(ind => {
            const match = !q || ind.dataset.name.includes(q) || ind.dataset.chapter.includes(q);
            ind.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        chEl.style.display = visible || !q ? '' : 'none';
        if (q && visible) chEl.classList.add('open');
    });
}

// ── Drag-and-drop ───────────────────────────────────────────────────
function rbDragStartElement(e, key) {
    const el = RB_ELEMENTS.find(x => x.key === key);
    rbDrag = { kind: 'new', make: el.make };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', key);
}
function rbDragStartIndicator(e, slug, id) {
    rbDrag = { kind: 'new', make: () => rbNewIndicator(slug, id) };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', slug + '::' + id);
}
function rbDragStartBlock(e, id) {
    rbDrag = { kind: 'move', id: id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
}
function rbDragEnd() { rbDrag = null; rbClearDropLine(); }

function rbWireCanvasDnD() {
    const scroll = document.getElementById('rb-canvas-scroll');
    scroll.addEventListener('dragover', (e) => {
        if (!rbDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = rbDrag.kind === 'move' ? 'move' : 'copy';
        rbShowDropLine(rbComputeDropIndex(e.clientY));
    });
    scroll.addEventListener('drop', (e) => {
        if (!rbDrag) return;
        e.preventDefault();
        const index = rbComputeDropIndex(e.clientY);
        rbHandleDrop(index);
        rbClearDropLine();
    });
    scroll.addEventListener('dragleave', (e) => {
        if (e.target === scroll) rbClearDropLine();
    });
}

function rbBlockEls() { return Array.from(document.querySelectorAll('#rb-doc .rb-block')); }

function rbComputeDropIndex(clientY) {
    const els = rbBlockEls();
    for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return i;
    }
    return els.length;
}

function rbShowDropLine(index) {
    rbClearDropLine();
    const line = document.createElement('div');
    line.className = 'rb-drop-line';
    line.id = 'rb-drop-line';
    const els = rbBlockEls();
    if (index >= els.length) {
        const last = els[els.length - 1];
        if (last) last.parentNode.appendChild(line);
        else document.getElementById('rb-doc').appendChild(line);
    } else {
        els[index].parentNode.insertBefore(line, els[index]);
    }
}
function rbClearDropLine() {
    const l = document.getElementById('rb-drop-line');
    if (l) l.remove();
}

function rbHandleDrop(index) {
    if (rbDrag.kind === 'new') {
        const block = rbDrag.make();
        if (!block) return;
        rbState.blocks.splice(index, 0, block);
        rbDrag = null;
        rbRenderDoc();
        rbSelect(block.id);
    } else if (rbDrag.kind === 'move') {
        const from = rbState.blocks.findIndex(b => b.id === rbDrag.id);
        if (from === -1) return;
        const [moved] = rbState.blocks.splice(from, 1);
        let to = index;
        if (from < index) to = index - 1;
        rbState.blocks.splice(to, 0, moved);
        rbDrag = null;
        rbRenderDoc();
        rbSelect(moved.id);
    }
}

// Insert at end (used by the Insert menu & double-click)
function rbInsertBlock(block) {
    if (!block) return;
    let index = rbState.blocks.length;
    if (rbState.selectedId) {
        const si = rbState.blocks.findIndex(b => b.id === rbState.selectedId);
        if (si !== -1) index = si + 1;
    }
    rbState.blocks.splice(index, 0, block);
    rbCloseMenu('rb-add-menu');
    rbRenderDoc();
    rbSelect(block.id);
}

// ── Document rendering ──────────────────────────────────────────────
function rbRenderDoc() {
    const doc = document.getElementById('rb-doc');
    doc.innerHTML = '';

    if (rbState.blocks.length === 0) {
        doc.innerHTML = `
            <div class="rb-page"><div class="rb-page-label">Page 1</div>
                <div class="rb-empty-doc">
                    <i class="fas fa-file-lines"></i>
                    <div style="font-weight:600;color:#64748B;">Your report is empty</div>
                    <div style="font-size:0.8rem;margin-top:6px;">Drag an indicator or content element from the left sidebar to begin.</div>
                </div>
            </div>`;
        rbUpdateStatus();
        return;
    }

    let pageNum = 1;
    let page = rbNewPageEl(pageNum);
    doc.appendChild(page);

    rbState.blocks.forEach(block => {
        if (block.type === 'pagebreak') {
            page.appendChild(rbWrapBlock(block, rbRenderPageBreak()));
            pageNum++;
            page = rbNewPageEl(pageNum);
            doc.appendChild(page);
            return;
        }
        page.appendChild(rbWrapBlock(block, rbRenderBlockBody(block)));
    });

    // Re-apply selection highlight & render any indicator visuals
    rbApplySelectionHighlight();
    rbState.blocks.forEach(block => {
        if (block.type === 'indicator') rbRenderIndicatorViz(block);
    });
    rbUpdateStatus();
    rbUpdateToolbarState();
}

function rbNewPageEl(num) {
    const page = document.createElement('div');
    page.className = 'rb-page';
    page.innerHTML = `<div class="rb-page-label">Page ${num}</div>`;
    return page;
}

function rbWrapBlock(block, bodyEl) {
    const wrap = document.createElement('div');
    wrap.className = 'rb-block' + (block.size === 'half' ? ' size-half' : '');
    wrap.dataset.id = block.id;
    wrap.onclick = (e) => { if (!e.target.closest('.rb-block-tools')) rbSelect(block.id); };

    const tools = document.createElement('div');
    tools.className = 'rb-block-tools';
    tools.innerHTML = `
        <button class="grip" title="Drag to reorder" draggable="true"
                ondragstart="rbDragStartBlock(event,'${block.id}')" ondragend="rbDragEnd()">
            <i class="fas fa-up-down-left-right"></i></button>
        <button title="Delete" onclick="rbDeleteBlock('${block.id}')"><i class="fas fa-trash"></i></button>`;
    wrap.appendChild(tools);
    wrap.appendChild(bodyEl);
    return wrap;
}

function rbRenderBlockBody(block) {
    const c = document.createElement('div');
    switch (block.type) {
        case 'text': {
            const tag = block.style === 'ul' ? 'ul' : (['h1', 'h2', 'h3'].includes(block.style) ? block.style : 'div');
            const cls = 'rb-text ' + (['h1', 'h2', 'h3'].includes(block.style) ? block.style : '');
            const el = document.createElement(tag);
            el.className = cls;
            el.contentEditable = 'true';
            el.style.textAlign = block.align || 'left';
            el.setAttribute('data-placeholder', block.placeholder || '');
            if (block.style === 'ul' && !block.html) el.innerHTML = '<li>List item</li>';
            else el.innerHTML = block.html || '';
            el.addEventListener('input', () => { block.html = el.innerHTML; rbUpdateStatus(); });
            el.addEventListener('focus', () => { rbActiveTextBlockId = block.id; rbSelect(block.id); rbUpdateToolbarState(); });
            el.addEventListener('keyup', rbUpdateToolbarState);
            c.appendChild(el);
            break;
        }
        case 'image': {
            if (block.src) {
                c.innerHTML = `<img src="${rbEsc(block.src)}" style="width:${block.width}%;border-radius:6px;display:block;margin:0 auto;"
                    onerror="this.replaceWith(rbImgError())">
                    ${block.caption ? `<div style="text-align:center;font-size:0.76rem;color:#64748B;margin-top:6px;">${rbEsc(block.caption)}</div>` : ''}`;
            } else {
                c.innerHTML = `<div style="border:2px dashed #CBD5E1;border-radius:10px;padding:34px;text-align:center;color:#94A3B8;">
                    <i class="fas fa-image" style="font-size:1.6rem;display:block;margin-bottom:8px;"></i>
                    Set an image URL in the Properties panel →</div>`;
            }
            break;
        }
        case 'table': {
            c.appendChild(rbRenderEditableTable(block));
            break;
        }
        case 'indicator': {
            const ind = rbFindIndicator(block.chapterSlug, block.indicatorId);
            c.innerHTML = `
                <div class="rb-ind-block-head">
                    <div class="rb-ind-title">${rbEsc(block.title)}</div>
                    <span class="rb-ind-badge">${block.viz}</span>
                </div>
                <div class="rb-ind-desc">${ind ? rbEsc(ind.description) : ''}</div>
                <div class="rb-ind-viz" id="rb-viz-${block.id}">
                    <div class="rb-ind-loading"><span class="rb-mini-spinner"></span> Loading data…</div>
                </div>`;
            break;
        }
    }
    return c;
}

function rbRenderPageBreak() {
    const c = document.createElement('div');
    c.innerHTML = `<div class="rb-pagebreak-marker"><i class="fas fa-scissors"></i> Page Break</div>`;
    return c;
}

function rbImgError() {
    const d = document.createElement('div');
    d.style.cssText = 'border:2px dashed #FCA5A5;border-radius:10px;padding:24px;text-align:center;color:#EF4444;font-size:0.8rem;';
    d.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Image could not be loaded';
    return d;
}

function rbRenderEditableTable(block) {
    const t = document.createElement('table');
    t.className = 'rb-editable-table';
    for (let r = 0; r < block.rows; r++) {
        const tr = document.createElement('tr');
        for (let col = 0; col < block.cols; col++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            if (r === 0) td.style.cssText = 'background:#F8FAFC;font-weight:700;';
            td.textContent = (block.cells[r] && block.cells[r][col]) || '';
            td.addEventListener('input', () => {
                if (!block.cells[r]) block.cells[r] = [];
                block.cells[r][col] = td.textContent;
            });
            tr.appendChild(td);
        }
        t.appendChild(tr);
    }
    return t;
}

function rbDeleteBlock(id) {
    rbState.blocks = rbState.blocks.filter(b => b.id !== id);
    if (rbState.selectedId === id) rbState.selectedId = null;
    rbRenderDoc();
    rbRenderProps();
}

function rbUpdateStatus() {
    const n = rbState.blocks.filter(b => b.type === 'indicator').length;
    const pages = 1 + rbState.blocks.filter(b => b.type === 'pagebreak').length;
    document.getElementById('rb-doc-status').textContent =
        `${rbState.blocks.length} blocks · ${n} indicators · ${pages} page${pages > 1 ? 's' : ''}`;
}

// ── Selection ───────────────────────────────────────────────────────
function rbSelect(id) {
    rbState.selectedId = id;
    const b = rbState.blocks.find(x => x.id === id);
    if (b && b.type === 'text') rbActiveTextBlockId = id;
    rbApplySelectionHighlight();
    rbRenderProps();
    rbUpdateToolbarState();
}
function rbApplySelectionHighlight() {
    document.querySelectorAll('#rb-doc .rb-block').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === rbState.selectedId);
    });
}

// ── Indicator data fetching & visualization ─────────────────────────
function rbIndicatorURL(block) {
    const ind = rbFindIndicator(block.chapterSlug, block.indicatorId);
    const merged = Object.assign({}, ind.fixedParams || {}, block.params || {});
    const url = new URL('/api' + ind.path, window.location.origin);
    Object.entries(merged).forEach(([k, v]) => url.searchParams.set(k, v));
    return { url: url, sig: ind.path + '?' + url.searchParams.toString() };
}

function rbRenderIndicatorViz(block) {
    const container = document.getElementById('rb-viz-' + block.id);
    if (!container) return;

    const { url, sig } = rbIndicatorURL(block);
    if (!block.data || block.dataSig !== sig) {
        container.innerHTML = `<div class="rb-ind-loading"><span class="rb-mini-spinner"></span> Loading data…</div>`;
        if (block.loading && block.dataSig === sig) return;
        block.loading = true;
        const reqSig = sig;
        fetch(url)
            .then(r => r.json())
            .then(data => {
                block.data = data;
                block.dataSig = reqSig;
                block.loading = false;
                rbDrawViz(block);
            })
            .catch(err => {
                block.loading = false;
                console.error('Report Builder fetch error:', err);
                const c = document.getElementById('rb-viz-' + block.id);
                if (c) c.innerHTML = `<div class="rb-ind-loading" style="color:#EF4444;"><i class="fas fa-triangle-exclamation"></i> Unable to load data for this indicator.</div>`;
            });
        return;
    }
    rbDrawViz(block);
}

function rbProvVal(block, code) {
    if (!block.data || !block.data.provinces) return null;
    const p = block.data.provinces.find(x => x.province_id === code);
    return p ? p.value : null;
}
function rbNationalVal(block) {
    return block.data && block.data.national ? block.data.national.value : null;
}
function rbUnit(block) { return block.data ? block.data.unit : 'Percentage'; }

function rbDrawViz(block) {
    const container = document.getElementById('rb-viz-' + block.id);
    if (!container || !block.data) return;

    if (block.viz === 'kpi') { container.innerHTML = rbVizKPI(block); return; }
    if (block.viz === 'table') { container.innerHTML = rbVizTable(block); return; }
    if (block.viz === 'bar') {
        container.innerHTML = `<div style="height:300px;position:relative;"><canvas id="rb-chart-${block.id}"></canvas></div>`;
        rbDrawBar(block);
        return;
    }
    if (block.viz === 'map') {
        container.innerHTML = `
            <div style="display:flex;justify-content:center;">
                <svg id="rb-map-${block.id}" viewBox="0 0 500 440" class="rb-map-svg" style="width:100%;max-width:460px;max-height:340px;"></svg>
            </div>
            <div class="rb-legend">${NISR_SCALE.map(c => `<div style="background:${c}"></div>`).join('')}</div>
            <div style="display:flex;justify-content:space-between;font-size:0.66rem;color:#94A3B8;font-weight:600;margin-top:3px;">
                <span>LOW</span><span>HIGH</span></div>`;
        rbDrawMap(block);
        return;
    }
}

function rbVizKPI(block) {
    const unit = rbUnit(block);
    const cards = [];
    if (block.inclNational) {
        cards.push(`<div class="rb-kpi"><div class="lab">National</div><div class="val">${rbFmt(rbNationalVal(block), unit)}</div></div>`);
    }
    PROVINCES.filter(p => block.provinces.includes(p.code)).forEach(p => {
        cards.push(`<div class="rb-kpi"><div class="lab">${p.name}</div><div class="val">${rbFmt(rbProvVal(block, p.code), unit)}</div></div>`);
    });
    return `<div class="rb-kpi-row">${cards.join('')}</div>`;
}

function rbVizTable(block) {
    const unit = rbUnit(block);
    const nat = rbNationalVal(block);
    const rows = [];
    if (block.inclNational && nat !== null) {
        rows.push(`<tr><td><b>National</b></td><td>National</td><td class="num"><b>${rbFmt(nat, unit)}</b></td><td class="num">—</td></tr>`);
    }
    PROVINCES.filter(p => block.provinces.includes(p.code)).forEach(p => {
        const v = rbProvVal(block, p.code);
        rows.push(`<tr><td>${p.name}</td><td>Province</td><td class="num">${rbFmt(v, unit)}</td><td class="num">${rbDelta(v, nat, unit)}</td></tr>`);
    });
    if (block.inclDistricts && block.data.districts) {
        block.data.districts
            .filter(d => block.provinces.includes(DISTRICT_PROVINCE[d.district_name]))
            .forEach(d => {
                rows.push(`<tr><td style="padding-left:22px;">${d.district_name}</td><td>District</td><td class="num">${rbFmt(d.value, unit)}</td><td class="num">${rbDelta(d.value, nat, unit)}</td></tr>`);
            });
    }
    return `<table class="rb-data-table">
        <thead><tr><th>Region</th><th>Type</th><th class="num">Value</th><th class="num">vs National</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table>`;
}

function rbDrawBar(block) {
    const canvas = document.getElementById('rb-chart-' + block.id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (!window.rbCharts) window.rbCharts = {};
    if (window.rbCharts[block.id]) window.rbCharts[block.id].destroy();

    const unit = rbUnit(block);
    const provs = PROVINCES.filter(p => block.provinces.includes(p.code));
    const labels = provs.map(p => p.name);
    const values = provs.map(p => rbProvVal(block, p.code));
    const national = block.inclNational ? rbNationalVal(block) : null;
    const colors = ['#1B3C74', '#0099D4', '#2D6AAE', '#00756A', '#E07B39', '#6B4E9B'];

    const plugins = [];
    if (national !== null && national !== undefined) {
        plugins.push({
            id: 'nat' + block.id,
            afterDraw: (chart) => {
                const ctx = chart.ctx, area = chart.chartArea, y = chart.scales.y;
                const yv = y.getPixelForValue(national);
                ctx.save();
                ctx.beginPath(); ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
                ctx.moveTo(area.left, yv); ctx.lineTo(area.right, yv); ctx.stroke();
                ctx.fillStyle = '#EF4444'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'right';
                ctx.fillText('Nat: ' + national.toFixed(1) + (unit === 'Percentage' ? '%' : ''), area.right - 6, yv - 4);
                ctx.restore();
            }
        });
    }

    window.rbCharts[block.id] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ data: values,
            backgroundColor: labels.map((l, i) => colors[i % colors.length]),
            borderRadius: 6, maxBarThickness: 48 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => 'Value: ' + c.parsed.y.toFixed(1) + (unit === 'Percentage' ? '%' : '') } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#374151' } },
                y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 10 }, color: '#64748B',
                    callback: (v) => v + (unit === 'Percentage' ? '%' : '') } }
            }
        },
        plugins: plugins
    });
}

function rbDrawMap(block) {
    const svg = document.getElementById('rb-map-' + block.id);
    if (!svg) return;
    if (!rbGeo.loaded) {
        svg.innerHTML = '<text x="250" y="220" text-anchor="middle" fill="#94A3B8" font-size="13">Loading map…</text>';
        return;
    }
    svg.innerHTML = '';
    const W = 500, H = 440;
    const sel = block.provinces;
    const vals = PROVINCES.filter(p => sel.includes(p.code)).map(p => rbProvVal(block, p.code)).filter(v => v !== null);

    const ring = (r) => r.map(([lon, lat], i) =>
        `${i === 0 ? 'M' : 'L'}${(((lon - rbGeo.minLon) / (rbGeo.maxLon - rbGeo.minLon)) * W).toFixed(2)},${(((rbGeo.maxLat - lat) / (rbGeo.maxLat - rbGeo.minLat)) * H).toFixed(2)}`
    ).join(' ') + ' Z';

    rbGeo.json.features.forEach(f => {
        const dist = f.properties.shapeName;
        const provCode = DISTRICT_PROVINCE[dist] || 0;
        let d = '';
        if (f.geometry.type === 'Polygon') d = ring(f.geometry.coordinates[0]);
        else if (f.geometry.type === 'MultiPolygon') d = f.geometry.coordinates.map(p => ring(p[0])).join(' ');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        if (sel.includes(provCode)) {
            path.setAttribute('fill', rbColor(rbProvVal(block, provCode), vals));
            path.setAttribute('opacity', '1');
        } else {
            path.setAttribute('fill', '#E2E8F0');
            path.setAttribute('opacity', '0.45');
        }
        svg.appendChild(path);
    });
}

// ── GeoJSON ─────────────────────────────────────────────────────────
function rbFetchGeoJSON() {
    fetch('/admin-panel/geojson/')
        .then(r => r.json())
        .then(geojson => {
            rbGeo.json = geojson;
            let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
            const scan = ring => ring.forEach(([lon, lat]) => {
                if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
                if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
            });
            geojson.features.forEach(f => {
                if (f.geometry.type === 'Polygon') f.geometry.coordinates.forEach(scan);
                else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(p => p.forEach(scan));
            });
            rbGeo.minLon = minLon; rbGeo.maxLon = maxLon; rbGeo.minLat = minLat; rbGeo.maxLat = maxLat;
            rbGeo.loaded = true;
            // Redraw any map blocks now that geometry is available
            rbState.blocks.forEach(b => { if (b.type === 'indicator' && b.viz === 'map') rbDrawMap(b); });
        })
        .catch(err => console.error('Report Builder: geojson load failed', err));
}

// ── RIGHT: Properties panel ─────────────────────────────────────────
function rbRenderProps() {
    const body = document.getElementById('rb-props-body');
    const sub = document.getElementById('rb-props-sub');
    const block = rbState.blocks.find(b => b.id === rbState.selectedId);

    if (!block) {
        sub.textContent = 'Document settings';
        body.innerHTML = rbDocProps();
        return;
    }
    sub.textContent = 'Editing: ' + block.type;
    if (block.type === 'indicator') body.innerHTML = rbIndicatorProps(block);
    else if (block.type === 'text') body.innerHTML = rbTextProps(block);
    else if (block.type === 'table') body.innerHTML = rbTableProps(block);
    else if (block.type === 'image') body.innerHTML = rbImageProps(block);
    else if (block.type === 'pagebreak') body.innerHTML = rbPageBreakProps(block);
}

function rbDocProps() {
    return `
        <div class="rb-prop-group">
            <label>Report Title</label>
            <input type="text" value="${rbEsc(rbState.title)}" oninput="rbState.title=this.value; document.getElementById('rb-doc-title').value=this.value;">
        </div>
        <div class="rb-prop-group">
            <label>Subtitle / Source line</label>
            <input type="text" value="${rbEsc(rbState.subtitle)}" oninput="rbState.subtitle=this.value;">
        </div>
        <div class="rb-prop-empty" style="padding-top:20px;">
            <i class="fas fa-hand-pointer"></i>
            Select any block on the page to configure its content, data and layout.
        </div>`;
}

function rbIndicatorProps(block) {
    const ind = rbFindIndicator(block.chapterSlug, block.indicatorId);
    let html = `
        <div class="rb-prop-group">
            <label>Indicator Title</label>
            <input type="text" value="${rbEsc(block.title)}" oninput="rbUpdateBlock('${block.id}','title',this.value,true)">
        </div>
        <div class="rb-prop-group">
            <label>Visualization</label>
            <div class="rb-seg">
                ${RB_VIZ_TYPES.map(v => `<button class="${block.viz === v.id ? 'active' : ''}" onclick="rbSetViz('${block.id}','${v.id}')"><i class="fas ${v.icon}" style="margin-right:4px;"></i>${v.label}</button>`).join('')}
            </div>
        </div>`;

    if (ind && ind.dynamicParams && ind.dynamicParams.length) {
        html += `<div class="rb-prop-group"><label>Data Options</label>`;
        ind.dynamicParams.forEach(p => {
            const cur = block.params[p.key] || p.default;
            html += `<div style="margin-bottom:8px;">
                <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:3px;">${p.label}</div>
                <select onchange="rbSetParam('${block.id}','${p.key}',this.value)">
                    ${p.options.map(o => `<option value="${o.value}" ${o.value === cur ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select></div>`;
        });
        html += `</div>`;
    }

    html += `
        <div class="rb-prop-group">
            <label>Geography</label>
            <label class="rb-check"><input type="checkbox" ${block.inclNational ? 'checked' : ''} onchange="rbUpdateBlock('${block.id}','inclNational',this.checked,false); rbRefreshViz('${block.id}')"> Include National</label>
            <label class="rb-check"><input type="checkbox" ${block.inclDistricts ? 'checked' : ''} onchange="rbUpdateBlock('${block.id}','inclDistricts',this.checked,false); rbRefreshViz('${block.id}')"> Include Districts (table)</label>
            <div style="font-size:0.72rem;color:var(--text-muted);margin:8px 0 4px;">Provinces</div>
            <div class="rb-prov-list">
                ${PROVINCES.map(p => `<label class="rb-check"><input type="checkbox" ${block.provinces.includes(p.code) ? 'checked' : ''} onchange="rbToggleProvince('${block.id}',${p.code},this.checked)"> ${p.name}</label>`).join('')}
            </div>
        </div>
        <div class="rb-prop-group">
            <label>Size</label>
            <div class="rb-seg">
                <button class="${block.size === 'full' ? 'active' : ''}" onclick="rbSetSize('${block.id}','full')">Full width</button>
                <button class="${block.size === 'half' ? 'active' : ''}" onclick="rbSetSize('${block.id}','half')">Half width</button>
            </div>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="rbDeleteBlock('${block.id}')">
            <i class="fas fa-trash"></i> Delete Block</button>`;
    return html;
}

function rbTextProps(block) {
    const styles = [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['p', 'Text'], ['ul', 'List']];
    const aligns = [['left', 'fa-align-left'], ['center', 'fa-align-center'], ['right', 'fa-align-right']];
    return `
        <div class="rb-prop-group">
            <label>Text Style</label>
            <div class="rb-seg">
                ${styles.map(s => `<button class="${block.style === s[0] ? 'active' : ''}" onclick="rbSetTextStyle('${block.id}','${s[0]}')">${s[1]}</button>`).join('')}
            </div>
        </div>
        <div class="rb-prop-group">
            <label>Alignment</label>
            <div class="rb-seg">
                ${aligns.map(a => `<button class="${(block.align || 'left') === a[0] ? 'active' : ''}" onclick="rbSetAlign('${block.id}','${a[0]}')"><i class="fas ${a[1]}"></i></button>`).join('')}
            </div>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="rbDeleteBlock('${block.id}')">
            <i class="fas fa-trash"></i> Delete Block</button>`;
}

function rbTableProps(block) {
    return `
        <div class="rb-prop-group">
            <label>Rows</label>
            <div class="rb-prop-row">
                <button class="btn btn-ghost btn-sm" onclick="rbResizeTable('${block.id}','rows',-1)">−</button>
                <span style="flex:1;text-align:center;align-self:center;font-weight:700;">${block.rows}</span>
                <button class="btn btn-ghost btn-sm" onclick="rbResizeTable('${block.id}','rows',1)">+</button>
            </div>
        </div>
        <div class="rb-prop-group">
            <label>Columns</label>
            <div class="rb-prop-row">
                <button class="btn btn-ghost btn-sm" onclick="rbResizeTable('${block.id}','cols',-1)">−</button>
                <span style="flex:1;text-align:center;align-self:center;font-weight:700;">${block.cols}</span>
                <button class="btn btn-ghost btn-sm" onclick="rbResizeTable('${block.id}','cols',1)">+</button>
            </div>
        </div>
        <p style="font-size:0.74rem;color:var(--text-muted);">Click any cell on the page to edit its text. The first row is styled as a header.</p>
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="rbDeleteBlock('${block.id}')">
            <i class="fas fa-trash"></i> Delete Block</button>`;
}

function rbImageProps(block) {
    return `
        <div class="rb-prop-group">
            <label>Image URL</label>
            <input type="text" value="${rbEsc(block.src)}" placeholder="https://…" oninput="rbUpdateBlock('${block.id}','src',this.value,true)">
        </div>
        <div class="rb-prop-group">
            <label>Caption</label>
            <input type="text" value="${rbEsc(block.caption)}" oninput="rbUpdateBlock('${block.id}','caption',this.value,true)">
        </div>
        <div class="rb-prop-group">
            <label>Width — ${block.width}%</label>
            <input type="range" min="20" max="100" value="${block.width}" oninput="rbUpdateBlock('${block.id}','width',parseInt(this.value),true)">
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="rbDeleteBlock('${block.id}')">
            <i class="fas fa-trash"></i> Delete Block</button>`;
}

function rbPageBreakProps(block) {
    return `
        <div class="rb-prop-empty"><i class="fas fa-scissors"></i>
            A page break forces the following content onto a new page when printed or exported.</div>
        <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;color:var(--danger);border-color:rgba(239,68,68,0.3);" onclick="rbDeleteBlock('${block.id}')">
            <i class="fas fa-trash"></i> Delete Page Break</button>`;
}

// ── Property change handlers ────────────────────────────────────────
function rbBlock(id) { return rbState.blocks.find(b => b.id === id); }

function rbUpdateBlock(id, key, val, rerender) {
    const b = rbBlock(id); if (!b) return;
    b[key] = val;
    if (rerender) { rbRenderDoc(); rbApplySelectionHighlight(); }
}
function rbSetViz(id, viz) { const b = rbBlock(id); if (!b) return; b.viz = viz; rbRenderDoc(); rbRenderProps(); }
function rbSetSize(id, size) { const b = rbBlock(id); if (!b) return; b.size = size; rbRenderDoc(); rbRenderProps(); }
function rbSetParam(id, key, val) {
    const b = rbBlock(id); if (!b) return;
    b.params[key] = val;
    rbRenderIndicatorViz(b);  // triggers refetch (signature changed)
}
function rbRefreshViz(id) { const b = rbBlock(id); if (b) rbDrawViz(b); }
function rbToggleProvince(id, code, on) {
    const b = rbBlock(id); if (!b) return;
    if (on) { if (!b.provinces.includes(code)) b.provinces.push(code); }
    else { b.provinces = b.provinces.filter(c => c !== code); }
    rbDrawViz(b);
}
function rbSetTextStyle(id, style) {
    const b = rbBlock(id); if (!b) return;
    b.style = style;
    if (style === 'ul' && (!b.html || !b.html.includes('<li'))) b.html = '<li>' + (b.html || 'List item') + '</li>';
    rbRenderDoc(); rbRenderProps();
}
function rbSetAlign(id, align) { const b = rbBlock(id); if (!b) return; b.align = align; rbRenderDoc(); rbRenderProps(); }
function rbResizeTable(id, dim, delta) {
    const b = rbBlock(id); if (!b) return;
    if (dim === 'rows') b.rows = Math.max(1, Math.min(20, b.rows + delta));
    else b.cols = Math.max(1, Math.min(8, b.cols + delta));
    // Ensure cell matrix matches
    for (let r = 0; r < b.rows; r++) { if (!b.cells[r]) b.cells[r] = []; for (let col = 0; col < b.cols; col++) if (b.cells[r][col] === undefined) b.cells[r][col] = ''; }
    rbRenderDoc(); rbRenderProps();
}

// ── Menus ───────────────────────────────────────────────────────────
function rbToggleAddMenu(e) { e.stopPropagation(); document.getElementById('rb-add-menu').classList.toggle('open'); }
function rbToggleExportMenu(e) { e.stopPropagation(); document.getElementById('rb-export-menu').classList.toggle('open'); }
function rbCloseMenu(id) { const m = document.getElementById(id); if (m) m.classList.remove('open'); }

// ── Formatting ribbon (Google-Docs / Word style rich text) ──────────
// Inline tools operate on the cursor's current selection inside the active
// text block. Buttons use onmousedown=preventDefault so the editable keeps
// its selection/focus when clicked.
function rbActiveTextEl() {
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('rb-text')) return ae;
    if (rbActiveTextBlockId) {
        return document.querySelector('#rb-doc .rb-block[data-id="' + rbActiveTextBlockId + '"] .rb-text');
    }
    return null;
}

function rbCmd(cmd, val) {
    const el = rbActiveTextEl();
    if (!el) return;
    el.focus();
    try { document.execCommand(cmd, false, val || null); } catch (e) {}
    const b = rbBlock(rbActiveTextBlockId);
    if (b) b.html = el.innerHTML;
    rbUpdateToolbarState();
}

function rbApplyColor(color) {
    rbCmd('foreColor', color);
    const a = document.querySelector('.rb-color-a');
    if (a) a.style.borderBottomColor = color;
    rbCloseMenu('rb-color-pop');
}
function rbToggleColorPop(e) {
    e.stopPropagation();
    const pop = document.getElementById('rb-color-pop');
    if (pop) pop.classList.toggle('open');
}

function rbSetActiveBlockStyle(style) {
    if (!style) return;
    const id = rbActiveTextBlockId;
    const b = rbBlock(id);
    if (!b || b.type !== 'text') return;
    rbSetTextStyle(id, style);
    setTimeout(() => {
        const el = document.querySelector('#rb-doc .rb-block[data-id="' + id + '"] .rb-text');
        if (el) el.focus();
    }, 0);
}

function rbSetActiveAlign(dir) {
    const id = rbActiveTextBlockId;
    const b = rbBlock(id);
    if (!b || b.type !== 'text') return;
    b.align = dir;
    const el = document.querySelector('#rb-doc .rb-block[data-id="' + id + '"] .rb-text');
    if (el) { el.style.textAlign = dir; el.focus(); }
    rbUpdateToolbarState();
}

function rbUpdateToolbarState() {
    const el = rbActiveTextEl();
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
        const btn = document.querySelector('.rb-rb-btn[data-cmd="' + cmd + '"]');
        if (!btn) return;
        let on = false;
        try { on = el && document.queryCommandState(cmd); } catch (e) {}
        btn.classList.toggle('active', !!on);
    });
    const b = rbBlock(rbActiveTextBlockId);
    const isText = b && b.type === 'text';
    const sel = document.getElementById('rb-style-select');
    if (sel) sel.value = isText ? b.style : '';
    document.querySelectorAll('.rb-rb-btn[data-align]').forEach(btn => {
        const a = isText ? (b.align || 'left') : null;
        btn.classList.toggle('active', a === btn.getAttribute('data-align'));
    });
}

// ── Formatting helpers ──────────────────────────────────────────────
function rbFmt(v, unit) {
    if (v === null || v === undefined) return '—';
    return unit === 'Percentage' ? Number(v).toFixed(1) + '%' : Number(v).toFixed(2);
}
function rbDelta(v, nat, unit) {
    if (v === null || v === undefined || nat === null || nat === undefined) return '—';
    const d = v - nat;
    const sign = d >= 0 ? '+' : '';
    const txt = sign + (unit === 'Percentage' ? d.toFixed(1) + 'pp' : d.toFixed(2));
    return `<span style="color:${d >= 0 ? '#16A34A' : '#DC2626'};font-weight:600;">${txt}</span>`;
}
function rbColor(value, allValues) {
    if (value === null || value === undefined) return '#CBD5E1';
    const valid = allValues.filter(v => v !== null && v !== undefined);
    if (!valid.length) return NISR_SCALE[0];
    const min = Math.min(...valid), max = Math.max(...valid);
    const pct = (value - min) / ((max - min) || 1);
    if (pct < 0.2) return NISR_SCALE[0];
    if (pct < 0.4) return NISR_SCALE[1];
    if (pct < 0.6) return NISR_SCALE[2];
    if (pct < 0.8) return NISR_SCALE[3];
    return NISR_SCALE[4];
}
function rbEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════════════
//  EXPORT  (PDF / Word / PowerPoint) & PREVIEW
// ════════════════════════════════════════════════════════════════════
function rbExportStyles() {
    return `
        body{font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1f2937;margin:0;padding:0;font-size:12pt;line-height:1.55;}
        .rb-doc-page{padding:36pt 42pt;}
        h1{font-family:'Outfit','Inter',sans-serif;font-size:22pt;margin:0 0 6pt;color:#1B3C74;}
        h2{font-family:'Outfit','Inter',sans-serif;font-size:16pt;margin:14pt 0 6pt;color:#1B3C74;}
        h3{font-family:'Outfit','Inter',sans-serif;font-size:13pt;margin:12pt 0 5pt;}
        p,ul{margin:0 0 8pt;} li{margin-bottom:3pt;}
        .meta{color:#64748B;font-size:9.5pt;margin:0 0 2pt;}
        .ind{margin:14pt 0;}
        .ind-title{font-family:'Outfit','Inter',sans-serif;font-weight:700;font-size:13pt;color:#1B3C74;margin-bottom:2pt;}
        .ind-desc{color:#64748B;font-size:9.5pt;margin-bottom:6pt;}
        table.data{border-collapse:collapse;width:100%;font-size:10pt;}
        table.data th{background:#1B3C74;color:#fff;text-align:left;padding:5pt 8pt;}
        table.data td{border:1px solid #E2E8F0;padding:4pt 8pt;}
        table.data td.num{text-align:right;}
        table.grid{border-collapse:collapse;width:100%;font-size:10.5pt;}
        table.grid td{border:1px solid #CBD5E1;padding:5pt 8pt;}
        .kpis{display:flex;flex-wrap:wrap;gap:10pt;}
        .kpi{border:1px solid #CBD5E1;border-radius:6pt;padding:8pt 12pt;min-width:90pt;}
        .kpi .lab{font-size:8pt;text-transform:uppercase;color:#64748B;font-weight:700;}
        .kpi .val{font-family:'Outfit','Inter',sans-serif;font-size:17pt;font-weight:800;color:#1B3C74;}
        img{max-width:100%;}
        hr{border:none;border-top:1px solid #cbd5e1;margin:10pt 0;}
        .pb{page-break-after:always;}
    `;
}

function rbBuildExportBody() {
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    let html = `<div class="rb-doc-page">
        <h1>${rbEsc(rbState.title)}</h1>
        <p class="meta">${rbEsc(rbState.subtitle)}</p>
        <p class="meta">Compiled on ${now}</p>
        <hr>`;

    rbState.blocks.forEach(block => {
        if (block.type === 'pagebreak') { html += `</div><div class="pb"></div><div class="rb-doc-page">`; return; }
        if (block.type === 'text') {
            const content = block.html || '';
            if (block.style === 'h1') html += `<h1 style="text-align:${block.align}">${content}</h1>`;
            else if (block.style === 'h2') html += `<h2 style="text-align:${block.align}">${content}</h2>`;
            else if (block.style === 'h3') html += `<h3 style="text-align:${block.align}">${content}</h3>`;
            else if (block.style === 'ul') html += `<ul style="text-align:${block.align}">${content}</ul>`;
            else html += `<p style="text-align:${block.align}">${content}</p>`;
            return;
        }
        if (block.type === 'image') {
            if (block.src) html += `<div style="text-align:center;margin:10pt 0;"><img src="${rbEsc(block.src)}" style="width:${block.width}%"/>${block.caption ? `<div class="meta">${rbEsc(block.caption)}</div>` : ''}</div>`;
            return;
        }
        if (block.type === 'table') {
            html += `<table class="grid"><tbody>`;
            for (let r = 0; r < block.rows; r++) {
                html += '<tr>';
                for (let col = 0; col < block.cols; col++) {
                    const cell = rbEsc((block.cells[r] && block.cells[r][col]) || '');
                    html += r === 0 ? `<td style="background:#F1F5F9;font-weight:700;">${cell}</td>` : `<td>${cell}</td>`;
                }
                html += '</tr>';
            }
            html += `</tbody></table>`;
            return;
        }
        if (block.type === 'indicator') html += rbExportIndicator(block);
    });

    html += `</div>`;
    return html;
}

function rbExportIndicator(block) {
    const ind = rbFindIndicator(block.chapterSlug, block.indicatorId);
    let viz = '';

    if (!block.data) {
        viz = `<p class="meta">Data for this indicator was still loading at export time.</p>`;
    } else if (block.viz === 'bar') {
        const canvas = document.getElementById('rb-chart-' + block.id);
        viz = canvas ? `<img src="${canvas.toDataURL('image/png')}" style="width:90%;max-width:560pt;"/>` : '';
    } else if (block.viz === 'map') {
        const svg = document.getElementById('rb-map-' + block.id);
        if (svg) {
            const s = new XMLSerializer().serializeToString(svg);
            const enc = window.btoa(unescape(encodeURIComponent(s)));
            viz = `<img src="data:image/svg+xml;base64,${enc}" style="width:55%;max-width:360pt;"/>`;
        }
    } else if (block.viz === 'kpi') {
        viz = rbExportKPIs(block);
    } else if (block.viz === 'table') {
        viz = rbExportTable(block);
    }

    return `<div class="ind">
        <div class="ind-title">${rbEsc(block.title)}</div>
        ${ind ? `<div class="ind-desc">${rbEsc(ind.description)}</div>` : ''}
        ${viz}
    </div>`;
}

function rbExportKPIs(block) {
    const unit = rbUnit(block);
    let cards = '';
    if (block.inclNational) cards += `<div class="kpi"><div class="lab">National</div><div class="val">${rbFmt(rbNationalVal(block), unit)}</div></div>`;
    PROVINCES.filter(p => block.provinces.includes(p.code)).forEach(p => {
        cards += `<div class="kpi"><div class="lab">${p.name}</div><div class="val">${rbFmt(rbProvVal(block, p.code), unit)}</div></div>`;
    });
    return `<div class="kpis">${cards}</div>`;
}

function rbExportTable(block) {
    const unit = rbUnit(block);
    const nat = rbNationalVal(block);
    let rows = '';
    if (block.inclNational && nat !== null) rows += `<tr><td><b>National</b></td><td class="num"><b>${rbFmt(nat, unit)}</b></td></tr>`;
    PROVINCES.filter(p => block.provinces.includes(p.code)).forEach(p => {
        rows += `<tr><td>${p.name}</td><td class="num">${rbFmt(rbProvVal(block, p.code), unit)}</td></tr>`;
    });
    if (block.inclDistricts && block.data.districts) {
        block.data.districts.filter(d => block.provinces.includes(DISTRICT_PROVINCE[d.district_name]))
            .forEach(d => { rows += `<tr><td style="padding-left:16pt;">${d.district_name}</td><td class="num">${rbFmt(d.value, unit)}</td></tr>`; });
    }
    return `<table class="data"><thead><tr><th>Region</th><th class="num">Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function rbFullExportHTML() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${rbEsc(rbState.title)}</title>
        <style>${rbExportStyles()}</style></head><body>${rbBuildExportBody()}</body></html>`;
}

function rbExport(fmt) {
    rbCloseMenu('rb-export-menu');
    if (rbState.blocks.length === 0) { alert('Add some content to the report before exporting.'); return; }

    if (fmt === 'pdf') {
        const iframe = document.getElementById('rb-print-iframe');
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(rbFullExportHTML());
        doc.close();
        setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 350);
        return;
    }

    // Word / PowerPoint — Microsoft Office opens these HTML payloads natively
    const isPpt = fmt === 'ppt';
    const mime = isPpt ? 'application/vnd.ms-powerpoint' : 'application/msword';
    const ext = isPpt ? 'ppt' : 'doc';
    const head = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>${rbEsc(rbState.title)}</title><style>${rbExportStyles()}</style></head>`;
    const blob = new Blob(['﻿' + head + '<body>' + rbBuildExportBody() + '</body></html>'], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (rbState.title || 'report').replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.' + ext;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function rbPreview() {
    if (rbState.blocks.length === 0) { alert('Add some content to preview the report.'); return; }
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to preview the report.'); return; }
    w.document.write(rbFullExportHTML());
    w.document.close();
}

function rbSaveDraft() {
    try {
        var drafts  = rbGetDrafts();
        var now     = new Date().toISOString();
        var payload = {
            title:    rbState.title    || 'Untitled Report',
            subtitle: rbState.subtitle || '',
            blocks:   JSON.parse(JSON.stringify(rbState.blocks)),
            updatedAt: now,
        };

        if (rbState.draftId) {
            var idx = drafts.findIndex(function(d) { return d.id === rbState.draftId; });
            if (idx >= 0) {
                payload.id        = rbState.draftId;
                payload.createdAt = drafts[idx].createdAt || now;
                drafts[idx]       = payload;
            } else {
                payload.id = rbState.draftId; payload.createdAt = now;
                drafts.unshift(payload);
            }
        } else {
            payload.id        = 'draft_' + Date.now();
            payload.createdAt = now;
            rbState.draftId   = payload.id;
            drafts.unshift(payload);
        }

        rbSetDrafts(drafts);

        var btn    = document.getElementById('rb-save-btn');
        var status = document.getElementById('rb-doc-status');
        var orig   = btn ? btn.innerHTML : '';
        if (btn)    { btn.innerHTML = '<i class="fas fa-check"></i> Saved!'; btn.disabled = true; }
        if (status) { status.textContent = '✓ Draft saved'; status.style.color = '#16a34a'; }
        setTimeout(function() {
            if (btn)    { btn.innerHTML = orig; btn.disabled = false; }
            if (status) { status.style.color = ''; rbUpdateStatus(); }
        }, 2000);
    } catch (e) {
        alert('Could not save draft: ' + e.message);
    }
}

function rbLoadDraft() {
    try {
        var drafts = rbGetDrafts();
        if (!drafts.length) return false;
        var latest = drafts[0];
        rbState.title    = latest.title    || 'Untitled DHS Report';
        rbState.subtitle = latest.subtitle || '';
        rbState.blocks   = latest.blocks   || [];
        rbState.draftId  = latest.id;
        var titleEl = document.getElementById('rb-doc-title');
        if (titleEl) titleEl.value = rbState.title;
        return true;
    } catch (e) { return false; }
}
