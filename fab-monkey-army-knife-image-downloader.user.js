// ==UserScript==
// @name         Fab Monkey Army Knife - Image Downloader
// @namespace    https://github.com/japan4415/fab-monkey-army-knife
// @version      0.1.4
// @description  Copy card front/back image URLs from Card Vault.
// @match        https://cardvault.fabtcg.com/*
// @icon         https://fabtcg.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @connect      cardvault.fabtcg.com
// @connect      legendstory-production-s3-public.s3.amazonaws.com
// @run-at       document-idle
// @updateURL    https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-image-downloader.user.js
// @downloadURL  https://github.com/japan4415/fab-monkey-army-knife/raw/main/fab-monkey-army-knife-image-downloader.user.js
// ==/UserScript==

(() => {
  'use strict';

  const CARDVAULT_PATH = /^\/card\//;
  const UI_ID = 'fab-cardvault-image-export';
  const STATUS_ID = 'fab-cardvault-image-status';
  const FRONT_COPY_ID = 'fab-cardvault-image-front-copy';
  const BACK_COPY_ID = 'fab-cardvault-image-back-copy';
  const FRONT_PNG_DOWNLOAD_ID = 'fab-cardvault-image-front-png-download';
  const BACK_PNG_DOWNLOAD_ID = 'fab-cardvault-image-back-png-download';
  const ROUTE_POLL_MS = 300;
  let lastUrl = location.href;
  let routePollId = null;
  let imageObserver = null;
  let imageObserverTimeoutId = null;

  setupRouteWatcher();
  init();

  function init() {
    cleanupImageObserver();
    if (!CARDVAULT_PATH.test(location.pathname)) {
      removeCardImageUi();
      return;
    }
    ensureCardImageUi();
    setStatus('Waiting for images...');
    if (!updateStatusIfReady()) {
      observeCardImages();
    }
  }

  function setupRouteWatcher() {
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

  function ensureCardImageUi() {
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

    const frontButton = document.createElement('button');
    frontButton.id = FRONT_COPY_ID;
    frontButton.type = 'button';
    frontButton.textContent = 'Copy Front URL';
    styleActionButton(frontButton);
    frontButton.addEventListener('click', () => copyCardImageUrl('front', frontButton));

    const backButton = document.createElement('button');
    backButton.id = BACK_COPY_ID;
    backButton.type = 'button';
    backButton.textContent = 'Copy Back URL';
    styleActionButton(backButton);
    backButton.addEventListener('click', () => copyCardImageUrl('back', backButton));

    const frontDownloadButton = document.createElement('button');
    frontDownloadButton.id = FRONT_PNG_DOWNLOAD_ID;
    frontDownloadButton.type = 'button';
    frontDownloadButton.textContent = 'Download Front PNG';
    styleActionButton(frontDownloadButton);
    frontDownloadButton.addEventListener('click', () => downloadCardPng('front', frontDownloadButton));

    const backDownloadButton = document.createElement('button');
    backDownloadButton.id = BACK_PNG_DOWNLOAD_ID;
    backDownloadButton.type = 'button';
    backDownloadButton.textContent = 'Download Back PNG';
    styleActionButton(backDownloadButton);
    backDownloadButton.addEventListener('click', () => downloadCardPng('back', backDownloadButton));

    const status = document.createElement('div');
    status.id = STATUS_ID;
    status.textContent = 'Preparing...';

    wrapper.append(frontButton, backButton, frontDownloadButton, backDownloadButton, status);
    document.body.append(wrapper);
  }

  function removeCardImageUi() {
    const wrapper = document.getElementById(UI_ID);
    if (wrapper) {
      wrapper.remove();
    }
  }

  function styleActionButton(button) {
    button.style.cursor = 'pointer';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.padding = '8px 12px';
    button.style.fontSize = '13px';
    button.style.fontWeight = '600';
    button.style.background = '#f1c40f';
    button.style.color = '#111';
  }

  function setStatus(message) {
    const status = document.getElementById(STATUS_ID);
    if (status) {
      status.textContent = message;
    }
  }

  function updateStatusIfReady() {
    const urls = findCardImageUrls();
    if (urls.front || urls.back) {
      setStatus('Ready.');
      return true;
    }
    return false;
  }

  function observeCardImages() {
    cleanupImageObserver();
    const observer = new MutationObserver(() => {
      if (updateStatusIfReady()) {
        observer.disconnect();
        imageObserver = null;
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'data-src', 'data-srcset'],
    });
    imageObserver = observer;
    imageObserverTimeoutId = setTimeout(() => {
      cleanupImageObserver();
      if (!updateStatusIfReady()) {
        setStatus('Images not found.');
      }
    }, 5000);
  }

  function cleanupImageObserver() {
    if (imageObserver) {
      imageObserver.disconnect();
      imageObserver = null;
    }
    if (imageObserverTimeoutId) {
      clearTimeout(imageObserverTimeoutId);
      imageObserverTimeoutId = null;
    }
  }

  async function copyCardImageUrl(side, button) {
    const label = side === 'front' ? 'Front' : 'Back';
    button.disabled = true;
    button.textContent = `Copying ${label}...`;
    try {
      const urls = findCardImageUrls();
      const url = side === 'front' ? urls.front : urls.back;
      if (!url) {
        throw new Error(`${label} image not found`);
      }
      await copyToClipboard(url);
      setStatus(`Copied ${label} URL`);
    } catch (error) {
      setStatus(`Copy failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = `Copy ${label} URL`;
    }
  }

  async function downloadCardPng(side, button) {
    const label = side === 'front' ? 'Front' : 'Back';
    button.disabled = true;
    button.textContent = `Downloading ${label}...`;
    try {
      const urls = findCardImageUrls();
      const url = side === 'front' ? urls.front : urls.back;
      if (!url) {
        throw new Error(`${label} image not found`);
      }
      const filename = buildPngFilename(url);
      await downloadPngFromUrl(url, filename);
      setStatus(`Downloaded ${label} PNG`);
    } catch (error) {
      setStatus(`Download failed: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = `Download ${label} PNG`;
    }
  }

  function findCardImageUrls() {
    const images = Array.from(document.querySelectorAll('img'));
    const frontImage = images.find((img) => isFrontCardImage(img));
    const backImage = images.find((img) => isBackCardImage(img));
    return {
      front: resolveUrl(getImageSource(frontImage)),
      back: resolveUrl(getImageSource(backImage)),
    };
  }

  function buildPngFilename(url) {
    try {
      const { pathname } = new URL(url, location.origin);
      const last = pathname.split('/').filter(Boolean).pop() || 'card';
      return `${last.replace(/\.[^.]+$/, '')}.png`;
    } catch (error) {
      return 'card.png';
    }
  }

  async function downloadPngFromUrl(url, filename) {
    const blob = await fetchImageBlob(url);
    const mime = blob.type || '';
    if (mime === 'video/webm' || /\.webm($|\?)/i.test(url)) {
      const pngBlob = await webmBlobToPng(blob);
      triggerDownload(pngBlob, filename);
      return;
    }
    const pngBlob = await imageBlobToPng(blob);
    triggerDownload(pngBlob, filename);
  }

  async function fetchImageBlob(url) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status})`);
      }
      return await response.blob();
    } catch (error) {
      if (typeof GM_xmlhttpRequest !== 'function') {
        throw new Error('Fetch blocked. Enable Tampermonkey permissions.');
      }
      return gmFetchBlob(url);
    }
  }

  function gmFetchBlob(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        onload: (response) => {
          if (response.status >= 200 && response.status < 300 && response.response) {
            resolve(response.response);
            return;
          }
          reject(new Error(`GM fetch failed (${response.status})`));
        },
        onerror: () => reject(new Error('GM fetch failed')),
        ontimeout: () => reject(new Error('GM fetch timeout')),
      });
    });
  }

  function triggerDownload(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  function imageBlobToPng(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((png) => {
            if (!png) {
              reject(new Error('Failed to convert image'));
              return;
            }
            resolve(png);
          }, 'image/png');
        } catch (error) {
          reject(error);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      img.src = objectUrl;
    });
  }

  function webmBlobToPng(blob) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(blob);

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.remove();
      };

      video.onloadeddata = () => {
        try {
          video.currentTime = 0;
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 1;
          canvas.height = video.videoHeight || 1;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((png) => {
            if (!png) {
              cleanup();
              reject(new Error('Failed to convert webm'));
              return;
            }
            cleanup();
            resolve(png);
          }, 'image/png');
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to decode webm'));
      };

      video.src = objectUrl;
      video.load();
    });
  }

  function isFrontCardImage(img) {
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const src = getImageSource(img);
    return alt.includes('card front') || /\/media\/cards\//.test(src);
  }

  function isBackCardImage(img) {
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    const src = getImageSource(img);
    return alt.includes('card back') || /card_back/.test(src);
  }

  function getImageSource(img) {
    if (!img) {
      return '';
    }
    return (
      img.currentSrc ||
      img.src ||
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      ''
    );
  }

  function resolveUrl(value) {
    if (!value) {
      return '';
    }
    try {
      return new URL(value, location.origin).toString();
    } catch (error) {
      return value;
    }
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
})();
