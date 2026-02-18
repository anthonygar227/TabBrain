// content.js — Injected into every page to extract content on demand

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const metaTag = document.querySelector('meta[name="description"]');
    const bodyText = document.body ? document.body.innerText : '';

    sendResponse({
      title: document.title || '',
      url: window.location.href,
      metaDescription: metaTag ? (metaTag.getAttribute('content') || '') : '',
      snippet: bodyText.substring(0, 500).replace(/\s+/g, ' ').trim()
    });
  }
  return true;
});
