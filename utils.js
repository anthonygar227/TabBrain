// utils.js — Shared helpers used by popup and dashboard

// Theme management — defaults to system preference
async function initTheme() {
  const result = await chrome.storage.local.get('theme');
  const saved = result.theme; // 'light', 'dark', or undefined (system)
  let active;
  if (saved) {
    active = saved;
  } else {
    active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', active);
  updateThemeIcon(active);

  // Listen for system changes when no explicit preference is saved
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    const r = await chrome.storage.local.get('theme');
    if (!r.theme) {
      const t = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      updateThemeIcon(t);
    }
  });
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateThemeIcon(next);
  await chrome.storage.local.set({ theme: next });
}

function updateThemeIcon(theme) {
  const sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  const moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.innerHTML = theme === 'dark' ? sunSvg : moonSvg;
  });
}

async function getTabRecords() {
  const result = await chrome.storage.local.get('tabRecords');
  return result.tabRecords || [];
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function faviconUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    // Use Chrome's built-in favicon cache (requires "favicon" permission)
    return `${chrome.runtime.getURL('_favicon/')}?pageUrl=${encodeURIComponent(url.href)}&size=32`;
  } catch {
    return '';
  }
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function maskEmails(str) {
  if (!str) return '';
  return str
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/\s*-\s*-\s*/g, ' - ')
    .trim();
}
