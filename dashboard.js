// dashboard.js — Full dashboard: grouped tabs, search, save/close actions

let allRecords = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  allRecords = await getTabRecords();
  renderDashboard(allRecords);

  // Search
  document.getElementById('search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      renderDashboard(allRecords);
      return;
    }
    const filtered = allRecords.filter(r =>
      (r.title && r.title.toLowerCase().includes(query)) ||
      (r.url && r.url.toLowerCase().includes(query)) ||
      (r.aiReason && r.aiReason.toLowerCase().includes(query)) ||
      (r.aiCategory && r.aiCategory.toLowerCase().includes(query))
    );
    renderDashboard(filtered);
  });

  // Settings button
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });

  // Live updates from storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.tabRecords) {
      allRecords = changes.tabRecords.newValue || [];
      const query = document.getElementById('search').value.toLowerCase();
      const filtered = query
        ? allRecords.filter(r =>
            (r.title || '').toLowerCase().includes(query) ||
            (r.url || '').toLowerCase().includes(query) ||
            (r.aiReason || '').toLowerCase().includes(query) ||
            (r.aiCategory || '').toLowerCase().includes(query)
          )
        : allRecords;
      renderDashboard(filtered);
    }
  });
});

function renderDashboard(records) {
  const groupsContainer = document.getElementById('tab-groups');
  const emptyState = document.getElementById('empty-state');
  const noResults = document.getElementById('no-results');
  const savedSection = document.getElementById('saved-section');
  const savedContainer = document.getElementById('saved-tabs');

  groupsContainer.innerHTML = '';
  emptyState.style.display = 'none';
  noResults.style.display = 'none';

  // Separate saved-for-later and active tabs
  const saved = records.filter(r => r.savedForLater);
  const active = records.filter(r => !r.savedForLater && !r.closedAt);

  // Show empty state if nothing at all
  if (allRecords.length === 0) {
    emptyState.style.display = 'block';
    savedSection.style.display = 'none';
    return;
  }

  // Show no-results state for empty search
  if (active.length === 0 && saved.length === 0 && document.getElementById('search').value) {
    noResults.style.display = 'block';
    savedSection.style.display = 'none';
    return;
  }

  // Group active tabs by category
  const groups = {};
  active.forEach(r => {
    const cat = r.aiCategory || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(r);
  });

  // Sort categories by count descending
  const sortedCategories = Object.keys(groups).sort(
    (a, b) => groups[b].length - groups[a].length
  );

  sortedCategories.forEach(category => {
    const tabs = groups[category].sort(
      (a, b) => new Date(b.openedAt) - new Date(a.openedAt)
    );

    const groupEl = document.createElement('div');
    groupEl.className = 'category-group';
    groupEl.innerHTML = `
      <div class="category-header">
        <span class="category-name">${category}</span>
        <span class="category-count">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>
        <button class="action-close-all" data-category="${category}">Close All</button>
      </div>
      <div class="tab-grid">
        ${tabs.map(r => renderTabCard(r, false)).join('')}
      </div>
    `;
    groupsContainer.appendChild(groupEl);
  });

  // Saved section
  if (saved.length > 0) {
    savedSection.style.display = 'block';
    savedContainer.innerHTML = saved.map(r => renderTabCard(r, true)).join('');
  } else {
    savedSection.style.display = 'none';
  }

  attachCardListeners();
}

function renderTabCard(record, isSaved) {
  const escapedUrl = record.url ? record.url.replace(/"/g, '&quot;') : '';
  return `
    <div class="tab-card" data-tab-id="${record.tabId}" data-url="${escapedUrl}">
      <img src="${faviconUrl(record.url)}" class="favicon" alt="" onerror="if(!this.dataset.retry){this.dataset.retry='1';try{this.src='https://www.google.com/s2/favicons?domain='+new URL('${escapedUrl}').hostname+'&sz=64'}catch(e){this.style.display='none'}}">
      <div class="tab-details">
        <span class="tab-card-title">${truncate(maskEmails(record.title), 60)}</span>
        <span class="tab-card-reason">${record.aiReason || 'Analyzing...'}</span>
      </div>
      <span class="tab-card-time">${timeAgo(record.openedAt)}</span>
      <div class="tab-actions">
        ${isSaved
          ? '<button class="action-unsave">Remove</button><button class="action-reopen">Open</button>'
          : '<button class="action-save">Save</button><button class="action-close">Close</button>'
        }
      </div>
    </div>
  `;
}

function attachCardListeners() {
  // Save for later
  document.querySelectorAll('.action-save').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.tab-card');
      const tabId = parseInt(card.dataset.tabId);
      const records = await getTabRecords();
      const record = records.find(r => r.tabId === tabId);
      if (record) {
        record.savedForLater = true;
        await chrome.storage.local.set({ tabRecords: records });
      }
    });
  });

  // Close tab
  document.querySelectorAll('.action-close').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.tab-card');
      const tabId = parseInt(card.dataset.tabId);
      try { await chrome.tabs.remove(tabId); } catch {}
      // Remove record from storage — dashboard is a live snapshot
      const records = await getTabRecords();
      const remaining = records.filter(r => r.tabId !== tabId);
      await chrome.storage.local.set({ tabRecords: remaining });
    });
  });

  // Reopen tab
  document.querySelectorAll('.action-reopen').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.tab-card');
      const url = card.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });

  // Close all tabs in a category
  document.querySelectorAll('.action-close-all').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const category = e.target.dataset.category;
      const records = await getTabRecords();
      const categoryTabs = records.filter(
        r => (r.aiCategory || 'Uncategorized') === category && !r.closedAt && !r.savedForLater
      );
      if (categoryTabs.length === 0) return;

      const confirmed = confirm(
        `Close all ${categoryTabs.length} tab${categoryTabs.length !== 1 ? 's' : ''} in "${category}"?`
      );
      if (!confirmed) return;

      const tabIdsToClose = new Set(categoryTabs.map(r => r.tabId));
      for (const tabId of tabIdsToClose) {
        try { await chrome.tabs.remove(tabId); } catch {}
      }
      // Remove closed records from storage
      const remaining = records.filter(r => !tabIdsToClose.has(r.tabId));
      await chrome.storage.local.set({ tabRecords: remaining });
    });
  });

  // Unsave (remove from saved)
  document.querySelectorAll('.action-unsave').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.tab-card');
      const tabId = parseInt(card.dataset.tabId);
      const records = await getTabRecords();
      const record = records.find(r => r.tabId === tabId);
      if (record) {
        record.savedForLater = false;
        await chrome.storage.local.set({ tabRecords: records });
      }
    });
  });
}
