(function () {
    'use strict';

    const SOURCE_PATH = '../改动记事本.md';
    const DIAGNOSTIC_LIMIT = 100;
    const diagnostics = [];
    let diagnosticsEnabled = false;
    let parsedDocument = null;
    let loadingPromise = null;

    function record(level, event, context) {
        const entry = {
            at: new Date().toISOString(),
            module: 'website:changelog',
            level,
            event,
            context: context || {}
        };
        diagnostics.push(entry);
        if (diagnostics.length > DIAGNOSTIC_LIMIT) diagnostics.shift();
        if (level === 'error') console.error('[website:changelog]', event, entry.context);
        else if (diagnosticsEnabled) console.info('[website:changelog]', event, entry.context);
        return entry;
    }

    function diagnosticCopies(entries) {
        return entries.map(entry => ({
            at:entry.at,
            module:entry.module,
            level:entry.level,
            event:entry.event,
            context:Object.assign({}, entry.context)
        }));
    }

    const openButton = document.getElementById('changelog-open');
    const dialog = document.getElementById('changelog-dialog');
    const closeButton = document.getElementById('changelog-close');
    const refreshButton = document.getElementById('changelog-refresh');
    const searchInput = document.getElementById('changelog-search');
    const status = document.getElementById('changelog-status');
    const content = document.getElementById('changelog-content');

    if (!openButton || !dialog || !closeButton || !refreshButton || !searchInput || !status || !content) {
        record('error', 'ui-elements-missing', {});
        return;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderInline(value) {
        return String(value || '').split(/(`[^`]*`)/g).map(part => {
            if (part.startsWith('`') && part.endsWith('`')) {
                return '<code>' + escapeHtml(part.slice(1, -1)) + '</code>';
            }
            return escapeHtml(part).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        }).join('');
    }

    function parseDocument(markdown) {
        const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        const intro = [];
        const releases = [];
        let current = null;
        let title = '改动记录';
        for (const line of lines) {
            const pageTitle = line.match(/^#\s+(.+)$/);
            const releaseTitle = line.match(/^##\s+(.+)$/);
            if (pageTitle && !current && releases.length === 0) {
                title = pageTitle[1].trim();
                continue;
            }
            if (releaseTitle) {
                current = { title:releaseTitle[1].trim(), lines:[] };
                releases.push(current);
                continue;
            }
            (current ? current.lines : intro).push(line);
        }
        return { title, intro, releases };
    }

    function renderBlocks(lines) {
        const html = [];
        let listOpen = false;
        const closeList = () => {
            if (!listOpen) return;
            html.push('</ul>');
            listOpen = false;
        };
        for (const original of lines) {
            const line = String(original || '');
            if (!line.trim()) { closeList(); continue; }
            if (/^---+$/.test(line.trim())) { closeList(); html.push('<hr>'); continue; }
            const heading = line.match(/^###\s+(.+)$/);
            if (heading) { closeList(); html.push('<h3>' + renderInline(heading[1]) + '</h3>'); continue; }
            const bullet = line.match(/^\s*-\s+(.+)$/);
            if (bullet) {
                if (!listOpen) { html.push('<ul>'); listOpen = true; }
                html.push('<li>' + renderInline(bullet[1]) + '</li>');
                continue;
            }
            closeList();
            const quote = line.match(/^>\s?(.*)$/);
            if (quote) html.push('<blockquote>' + renderInline(quote[1]) + '</blockquote>');
            else html.push('<p>' + renderInline(line) + '</p>');
        }
        closeList();
        return html.join('');
    }

    function renderCurrentFilter() {
        if (!parsedDocument) return;
        const query = searchInput.value.trim().toLocaleLowerCase('zh-CN');
        const visible = query
            ? parsedDocument.releases.filter(item => (item.title + '\n' + item.lines.join('\n')).toLocaleLowerCase('zh-CN').includes(query))
            : parsedDocument.releases;
        const pieces = [];
        if (!query && parsedDocument.intro.some(line => line.trim())) {
            pieces.push('<section class="changelog-intro">' + renderBlocks(parsedDocument.intro) + '</section>');
        }
        for (const release of visible) {
            pieces.push('<article class="release-entry"><h2>' + renderInline(release.title) + '</h2>' + renderBlocks(release.lines) + '</article>');
        }
        if (!visible.length) pieces.push('<div class="changelog-empty">没有找到匹配的改动记录。</div>');
        content.innerHTML = pieces.join('');
        status.classList.remove('is-error');
        status.textContent = query
            ? '找到 ' + visible.length + ' / ' + parsedDocument.releases.length + ' 组记录'
            : '共 ' + parsedDocument.releases.length + ' 组记录 · 来源：改动记事本.md';
        if (diagnosticsEnabled) record('debug', 'filter-rendered', { queryLength:query.length, visible:visible.length, total:parsedDocument.releases.length });
    }

    async function loadRecords() {
        if (loadingPromise) {
            if (diagnosticsEnabled) record('debug', 'load-reused', {});
            return loadingPromise;
        }
        status.classList.remove('is-error');
        status.textContent = '正在同步改动记事本…';
        refreshButton.disabled = true;
        const source = new URL(SOURCE_PATH, window.location.href);
        source.searchParams.set('_changelog', String(Date.now()));
        const startedAt = performance.now();
        loadingPromise = fetch(source.href, { cache:'no-store' }).then(async response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const markdown = await response.text();
            const parsed = parseDocument(markdown);
            if (!parsed.releases.length) throw new Error('没有识别到版本记录');
            parsedDocument = parsed;
            renderCurrentFilter();
            record('info', 'load-success', {
                source:source.pathname,
                bytes:markdown.length,
                releases:parsed.releases.length,
                durationMs:Math.round(performance.now() - startedAt)
            });
            return parsed;
        }).catch(error => {
            parsedDocument = null;
            status.classList.add('is-error');
            status.textContent = '改动记录加载失败';
            content.innerHTML = '<div class="changelog-load-error">请确认网站从项目根目录启动。<br><a href="' + escapeHtml(SOURCE_PATH) + '" target="_blank" rel="noopener">直接打开原始改动记事本</a></div>';
            record('error', 'load-failed', {
                source:source.pathname,
                message:String(error && error.message || error),
                durationMs:Math.round(performance.now() - startedAt)
            });
            return null;
        }).finally(() => {
            refreshButton.disabled = false;
            loadingPromise = null;
        });
        return loadingPromise;
    }

    function getHostState() {
        try { return window.__debug && window.__debug.getState ? window.__debug.getState() : 'unknown'; } catch (_) { return 'unknown'; }
    }

    function isEligibleWebMenu() {
        return !window.__wxMiniGame
            && !document.body.classList.contains('android-app')
            && getHostState() === 'menu';
    }

    function openDialog() {
        if (!isEligibleWebMenu()) {
            record('warn', 'dialog-open-blocked', {
                state:getHostState(),
                android:document.body.classList.contains('android-app'),
                wechat:!!window.__wxMiniGame
            });
            syncEntryVisibility();
            return false;
        }
        dialog.hidden = false;
        document.body.classList.add('changelog-visible');
        openButton.hidden = true;
        openButton.setAttribute('aria-expanded', 'true');
        record('info', 'dialog-open', { cached:!!parsedDocument });
        if (!parsedDocument) loadRecords();
        setTimeout(() => closeButton.focus(), 0);
        return true;
    }

    function closeDialog(reason) {
        dialog.hidden = true;
        document.body.classList.remove('changelog-visible');
        openButton.setAttribute('aria-expanded', 'false');
        record('info', 'dialog-close', { reason:reason || 'button' });
        syncEntryVisibility();
        if (!openButton.hidden) openButton.focus();
    }

    function syncEntryVisibility() {
        openButton.hidden = !dialog.hidden || !isEligibleWebMenu();
    }

    function stopGameKeyboard(event) {
        event.stopPropagation();
    }

    openButton.addEventListener('click', openDialog);
    openButton.addEventListener('keydown', stopGameKeyboard);
    openButton.addEventListener('keyup', stopGameKeyboard);
    closeButton.addEventListener('click', () => closeDialog('button'));
    refreshButton.addEventListener('click', () => loadRecords());
    searchInput.addEventListener('input', renderCurrentFilter);
    dialog.addEventListener('click', event => {
        if (event.target === dialog) closeDialog('backdrop');
    });
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDialog('escape');
        }
    });
    dialog.addEventListener('keyup', stopGameKeyboard);

    window.__SMART_EGG_CHANGELOG__ = {
        source:SOURCE_PATH,
        refresh:() => loadRecords(),
        getState:() => ({ loaded:!!parsedDocument, releases:parsedDocument ? parsedDocument.releases.length : 0, open:!dialog.hidden }),
        diagnostics:{
            maxEntries:DIAGNOSTIC_LIMIT,
            setEnabled(value) { diagnosticsEnabled = !!value; return diagnosticsEnabled; },
            getEnabled() { return diagnosticsEnabled; },
            list() { return diagnosticCopies(diagnostics); },
            find(event) { return diagnosticCopies(diagnostics.filter(entry => !event || entry.event === event)); }
        }
    };
    syncEntryVisibility();
    window.setInterval(syncEntryVisibility, 350);
    record('info', 'module-ready', { source:SOURCE_PATH, retention:DIAGNOSTIC_LIMIT, verbose:false });
}());
