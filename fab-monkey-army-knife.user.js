// ==UserScript==
// @name         Fab Monkey Army Knife (Sample)
// @namespace    https://github.com/japan4415/fab-monkey-army-knife
// @version      0.2.0
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
  let historyLoadPromise = null;

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
    wrapper.style.bottom = '16px';
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
      historyLoadPromise = loadAllHistory().finally(() => {
        const { count } = getHistoryRows();
      setStatus(`Loaded (${count} rows)`);
    });
  }
    return historyLoadPromise;
  }

  async function loadAllHistory() {
    await waitForInitialRows();
    let idleRounds = 0;
    let previousCount = getHistoryRows().count;
    for (let round = 0; round < 60; round += 1) {
      const clicked = clickLoadMoreButtons();
      await scrollToBottom();
      const grew = await waitForRowGrowth(previousCount, 2000);
      const currentCount = getHistoryRows().count;
      if (currentCount > previousCount) {
        previousCount = currentCount;
        idleRounds = 0;
      } else if (!clicked && !grew) {
        idleRounds += 1;
        if (idleRounds >= 3) {
          break;
        }
      }
    }
  }

  async function waitForInitialRows() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const { count } = getHistoryRows();
      if (count > 0) {
        return;
      }
      await delay(250);
    }
  }

  function clickLoadMoreButtons() {
    const labels = ['Load more', 'Show more', 'More', 'View more'];
    const buttons = Array.from(document.querySelectorAll('button, a'));
    let clicked = false;
    for (const button of buttons) {
      const text = (button.textContent || '').trim();
      if (!text) {
        continue;
      }
      if (labels.some((label) => text.toLowerCase().includes(label.toLowerCase()))) {
        if (!button.disabled) {
          button.click();
          clicked = true;
        }
      }
    }
    return clicked;
  }

  async function scrollToBottom() {
    const scrollTarget = findScrollContainer();
    if (!scrollTarget) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await delay(300);
      return;
    }
    scrollTarget.scrollTo({ top: scrollTarget.scrollHeight, behavior: 'smooth' });
    await delay(300);
  }

  function findScrollContainer() {
    const candidates = Array.from(document.querySelectorAll('*'));
    let best = null;
    let bestScore = 0;
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (!['auto', 'scroll'].includes(style.overflowY)) {
        continue;
      }
      const score = el.scrollHeight - el.clientHeight;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return bestScore > 200 ? best : null;
  }

  async function waitForRowGrowth(previousCount, timeoutMs) {
    const container = getHistoryRows().container || document.body;
    return new Promise((resolve) => {
      let resolved = false;
      const observer = new MutationObserver(() => {
        const current = getHistoryRows().count;
        if (current > previousCount) {
          resolved = true;
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        if (!resolved) {
          observer.disconnect();
          resolve(false);
        }
      }, timeoutMs);
      if (resolved) {
        clearTimeout(timer);
      }
    });
  }

  function getHistoryRows() {
    const table = findBestTable();
    if (table) {
      return {
        type: 'table',
        table,
        container: table.tBodies[0] || table,
        headers: extractTableHeaders(table),
        rows: Array.from((table.tBodies[0] || table).querySelectorAll('tr')),
        count: (table.tBodies[0] || table).querySelectorAll('tr').length,
      };
    }

    const roleGrid = findRoleGrid();
    if (roleGrid) {
      return roleGrid;
    }

    const list = findBestList();
    if (list) {
      return list;
    }

    return { type: 'unknown', rows: [], headers: ['entry'], count: 0, container: document.body };
  }

  function findBestTable() {
    const tables = Array.from(document.querySelectorAll('main table, table'));
    let best = null;
    let bestRows = 0;
    for (const table of tables) {
      const rows = (table.tBodies[0] || table).querySelectorAll('tr').length;
      if (rows > bestRows) {
        best = table;
        bestRows = rows;
      }
    }
    return bestRows > 0 ? best : null;
  }

  function extractTableHeaders(table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((cell) =>
      normalizeText(cell.textContent)
    );
    if (headers.length > 0) {
      return headers;
    }
    const firstRow = (table.tBodies[0] || table).querySelector('tr');
    if (!firstRow) {
      return [];
    }
    return Array.from(firstRow.querySelectorAll('th')).map((cell) =>
      normalizeText(cell.textContent)
    );
  }

  function findRoleGrid() {
    const rows = Array.from(document.querySelectorAll('[role="row"]'));
    const dataRows = rows.filter((row) =>
      row.querySelector('[role="cell"], [role="gridcell"]')
    );
    if (dataRows.length === 0) {
      return null;
    }
    const headerCells = Array.from(
      document.querySelectorAll('[role="columnheader"]')
    ).map((cell) => normalizeText(cell.textContent));
    return {
      type: 'role-grid',
      rows: dataRows,
      headers: headerCells,
      count: dataRows.length,
      container: dataRows[0].parentElement || document.body,
    };
  }

  function findBestList() {
    const selectors = [
      '[data-history-item]',
      '.history-item',
      '.history-row',
      '.transaction-row',
      '.profile-history-item',
      'main li',
    ];
    let best = null;
    let bestCount = 0;
    for (const selector of selectors) {
      const items = Array.from(document.querySelectorAll(selector)).filter(
        (el) => normalizeText(el.textContent).length > 0
      );
      if (items.length > bestCount) {
        best = { selector, items };
        bestCount = items.length;
      }
    }
    if (!best || bestCount === 0) {
      return null;
    }
    return {
      type: 'list',
      rows: best.items,
      headers: ['entry'],
      count: best.items.length,
      container: best.items[0].parentElement || document.body,
    };
  }

  function buildHistoryCsv() {
    const { type, rows, headers } = getHistoryRows();
    const csvRows = [];
    const normalizedHeaders = headers && headers.length > 0 ? headers : null;

    if (normalizedHeaders) {
      csvRows.push(normalizedHeaders.map(csvEscape).join(','));
    }

    for (const row of rows) {
      const values = extractRowValues(type, row, normalizedHeaders);
      csvRows.push(values.map(csvEscape).join(','));
    }
    return csvRows.join('\n');
  }

  function extractRowValues(type, row, headers) {
    if (type === 'table') {
      return Array.from(row.querySelectorAll('th, td')).map((cell) =>
        normalizeText(cell.textContent)
      );
    }
    if (type === 'role-grid') {
      return Array.from(row.querySelectorAll('[role="cell"], [role="gridcell"]')).map(
        (cell) => normalizeText(cell.textContent)
      );
    }

    if (type === 'list' && headers && headers.length > 1) {
      const values = [];
      const labelElements = row.querySelectorAll('[data-label]');
      if (labelElements.length > 0) {
        const map = {};
        for (const el of labelElements) {
          const label = el.getAttribute('data-label');
          if (!label) {
            continue;
          }
          map[label] = normalizeText(el.textContent);
        }
        for (const header of headers) {
          values.push(map[header] || '');
        }
        return values;
      }
    }

    return [normalizeText(row.textContent)];
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
