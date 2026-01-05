// ==UserScript==
// @name         Fab Monkey Army Knife - Artist Linker
// @namespace    https://github.com/japan4415/fab-monkey-army-knife
// @version      0.1.5
// @description  Add artist search link on Card Vault card pages.
// @match        https://cardvault.fabtcg.com/*
// @icon         https://fabtcg.com/favicon.ico
// @grant        none
// @run-at       document-idle
// @updateURL    https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-artist-linker.user.js
// @downloadURL  https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-artist-linker.user.js
// ==/UserScript==

(() => {
  'use strict';

  const CARDVAULT_PATH = /^\/card(?:\/|$)/;
  const OBSERVER_TIMEOUT_MS = 8000;
  const ROUTE_POLL_MS = 300;
  let activeObserver = null;
  let observerTimeoutId = null;
  let lastUrl = location.href;
  let routePollId = null;

  setupNavigationWatcher();
  init();

  function init() {
    cleanupObserver();
    if (!CARDVAULT_PATH.test(location.pathname)) {
      return;
    }
    if (applyArtistLink()) {
      return;
    }
    observeForArtistLine();
  }

  function observeForArtistLine() {
    cleanupObserver();
    const observer = new MutationObserver(() => {
      if (applyArtistLink()) {
        observer.disconnect();
        activeObserver = null;
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    activeObserver = observer;
    observerTimeoutId = setTimeout(() => {
      cleanupObserver();
    }, OBSERVER_TIMEOUT_MS);
  }

  function cleanupObserver() {
    if (activeObserver) {
      activeObserver.disconnect();
      activeObserver = null;
    }
    if (observerTimeoutId) {
      clearTimeout(observerTimeoutId);
      observerTimeoutId = null;
    }
  }

  function setupNavigationWatcher() {
    if (routePollId) {
      return;
    }
    routePollId = setInterval(() => {
      if (location.href === lastUrl) {
        return;
      }
      lastUrl = location.href;
      init();
    }, ROUTE_POLL_MS);
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        init();
      }
    });
  }

  function applyArtistLink() {
    const target = findArtistTextNode();
    if (!target) {
      return false;
    }
    const parent = target.parentElement;
    if (parent?.querySelector('a')) {
      return true;
    }
    const text = normalizeText(target.nodeValue);
    const match = text.match(/^Art by\s+(.+)$/i);
    if (!match) {
      return false;
    }
    const artistName = match[1].trim();
    if (!artistName) {
      return false;
    }
    const link = document.createElement('a');
    link.href = buildArtistUrl(artistName);
    link.textContent = `Art by ${artistName}`;
    link.style.color = 'inherit';
    link.style.textDecoration = 'underline';
    link.rel = 'noopener';
    link.target = '_blank';

    target.nodeValue = '';
    parent?.append(link);
    return true;
  }

  function findArtistTextNode() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = normalizeText(node.nodeValue);
        if (!text) {
          return NodeFilter.FILTER_REJECT;
        }
        if (/^Art by\s+.+/i.test(text) && text.length <= 80) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      },
    });
    return walker.nextNode();
  }

  function buildArtistUrl(name) {
    const params = new URLSearchParams({
      page: '1',
      artist_name: name,
    });
    return `https://cardvault.fabtcg.com/results?${params.toString()}`;
  }

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }
})();
