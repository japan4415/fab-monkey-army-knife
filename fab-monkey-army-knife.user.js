// ==UserScript==
// @name         Fab Monkey Army Knife (Sample)
// @namespace    https://github.com/japan4415/fab-monkey-army-knife
// @version      0.2.4
// @description  Improve the Flesh and Blood official site and GEM history UX.
// @match        https://fabtcg.com/*
// @match        https://www.fabtcg.com/*
// @match        https://gem.fabtcg.com/profile/history*
// @icon         https://fabtcg.com/favicon.ico
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife.user.js
// @downloadURL  https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife.user.js
// ==/UserScript==

(() => {
  'use strict';

  const HISTORY_PATH = /^\/profile\/history\/?$/;
  const UI_ID = 'fab-history-csv-export';
  const STATUS_ID = 'fab-history-csv-status';
  const COPY_ID = 'fab-history-csv-copy';
  const HISTORY_COLUMNS = [
    'title',
    'start_time',
    'store',
    'event_type',
    'format',
    'match_record',
  ];
  let historyLoadPromise = null;
  let historyEntries = [];

  if (location.hostname === 'gem.fabtcg.com' && HISTORY_PATH.test(location.pathname)) {
    setupHistoryExport();
  }

  function setupHistoryExport() {
    ensureHistoryUi();
    ensureHistoryLoaded().catch((error) => {
      setStatus(`Load failed: ${error.message}`);
    });
  }

  function ensureHistoryUi() {
    if (document.getElementById(UI_ID)) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = UI_ID;
    wrapper.style.position = 'fixed';
    wrapper.style.right = '16px';
    wrapper.style.top = '16px';
    wrapper.style.zIndex = '99999';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '6px';
    wrapper.style.padding = '10px';
    wrapper.style.background = 'rgba(20, 20, 20, 0.85)';
    wrapper.style.borderRadius = '8px';
    wrapper.style.color = '#fff';
    wrapper.style.fontSize = '12px';
    wrapper.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    wrapper.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';

    const button = document.createElement('button');
    button.id = COPY_ID;
    button.type = 'button';
    button.textContent = 'Copy CSV';
    button.style.cursor = 'pointer';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.padding = '8px 12px';
    button.style.fontSize = '13px';
    button.style.fontWeight = '600';
    button.style.background = '#f1c40f';
    button.style.color = '#111';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Copying...';
      try {
        await ensureHistoryLoaded();
        const csv = buildHistoryCsv();
        await copyToClipboard(csv);
        setStatus(`Copied (${csv.split('\n').length - 1} rows)`);
      } catch (error) {
        setStatus(`Copy failed: ${error.message}`);
      } finally {
        button.disabled = false;
        button.textContent = 'Copy CSV';
      }
    });

    const status = document.createElement('div');
    status.id = STATUS_ID;
    status.textContent = 'Loading history...';

    wrapper.append(button, status);
    document.body.append(wrapper);
  }

  function setStatus(message) {
    const status = document.getElementById(STATUS_ID);
    if (status) {
      status.textContent = message;
    }
  }

  async function ensureHistoryLoaded() {
    if (!historyLoadPromise) {
      historyLoadPromise = loadAllHistoryPages().then((entries) => {
        historyEntries = entries;
        setStatus(`Loaded (${entries.length} rows)`);
        return entries;
      });
    }
    return historyLoadPromise;
  }

  async function loadAllHistoryPages() {
    const totalPages = getTotalPages(document);
    const entries = [];
    const seen = new Set();

    const addEntries = (items) => {
      for (const entry of items) {
        const key = entryKey(entry);
        if (!key || seen.has(key)) {
          continue;
        }
        seen.add(key);
        entries.push(entry);
      }
    };

    setStatus(`Loading 1/${totalPages}...`);
    addEntries(extractEventsFromDocument(document));

    for (let page = 2; page <= totalPages; page += 1) {
      setStatus(`Loading ${page}/${totalPages}...`);
      const doc = await fetchHistoryPage(page);
      addEntries(extractEventsFromDocument(doc));
      await delay(120);
    }

    return entries;
  }

  function entryKey(entry) {
    if (entry.event_id) {
      return `id:${entry.event_id}`;
    }
    return [
      entry.date,
      entry.title,
      entry.start_time,
      entry.store,
    ].filter(Boolean).join('|');
  }

  async function fetchHistoryPage(page) {
    const url = new URL('/profile/history/', location.origin);
    if (page > 1) {
      url.searchParams.set('page', String(page));
    }
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Failed to load page ${page}`);
    }
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function getTotalPages(doc) {
    const links = Array.from(doc.querySelectorAll('.pagination a[href*="page="]'));
    let maxPage = 1;
    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) {
        continue;
      }
      const url = new URL(href, location.origin);
      const page = Number.parseInt(url.searchParams.get('page'), 10);
      if (Number.isFinite(page) && page > maxPage) {
        maxPage = page;
      }
    }
    return maxPage;
  }

  function extractEventsFromDocument(doc) {
    const events = Array.from(doc.querySelectorAll('.events .event'));
    return events.map((event) => {
      const metaItems = Array.from(event.querySelectorAll('.event__meta-item')).map(
        (item) => normalizeText(item.textContent)
      );
      const results = extractResultsFromEvent(event);
      const entry = {
        event_id: normalizeText(event.getAttribute('id')),
        date: normalizeText(event.querySelector('.event__when')?.textContent),
        title: normalizeText(event.querySelector('.event__title')?.textContent),
        start_time: metaItems[0] || '',
        store: metaItems[1] || '',
        event_type: metaItems[2] || '',
        format: metaItems[3] || '',
        match_record: results.match_record,
      };
      return entry;
    }).filter((entry) => entry.title || entry.date);
  }

  function extractResultsFromEvent(event) {
    const details = event.querySelector('.event__extra-details');
    if (!details) {
      return { match_record: '' };
    }
    const tables = Array.from(details.querySelectorAll('table'));
    const matchTable = findMatchTable(tables);
    const matches = parseMatchTable(matchTable);
    const lastMatch = matches[matches.length - 1];
    return {
      match_record: lastMatch ? lastMatch.record : '',
    };
  }

  function findMatchTable(tables) {
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length <= 1) {
        continue;
      }
      const headerCells = rows[0].querySelectorAll('th');
      if (headerCells.length >= 2) {
        return table;
      }
    }
    return null;
  }

  function parseMatchTable(table) {
    if (!table) {
      return [];
    }
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length <= 1) {
      return [];
    }
    const matches = [];
    for (const row of rows.slice(1)) {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) =>
        normalizeText(cell.textContent)
      );
      if (cells.length === 0) {
        continue;
      }
      if (cells.length === 1 && !/\d/.test(cells[0])) {
        continue;
      }
      matches.push({
        round: cells[0] || '',
        opponent: cells[1] || '',
        result: cells[2] || '',
        record: normalizeRecord(cells[3] || ''),
      });
    }
    return matches;
  }

  function buildHistoryCsv() {
    const entries = historyEntries.length
      ? historyEntries
      : extractEventsFromDocument(document);
    const csvRows = [HISTORY_COLUMNS.join(',')];
    for (const entry of entries) {
      const values = HISTORY_COLUMNS.map((key) => csvEscape(entry[key] || ''));
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function csvEscape(value) {
    const text = value ?? '';
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeRecord(text) {
    return normalizeText(text).replace(/\s*-\s*/g, '-');
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
