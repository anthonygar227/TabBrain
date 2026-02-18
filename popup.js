// popup.js — Shows 5 most recent tabs and a link to open the dashboard

document.addEventListener('DOMContentLoaded', async () => {
  await initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  const records = await getTabRecords();
  const recent = records
    .filter(r => !r.closedAt)
    .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
    .slice(0, 5);

  const container = document.getElementById('recent-tabs');

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No tabs tracked yet. Browse around and check back!</p>';
  } else {
    recent.forEach(r => {
      const div = document.createElement('div');
      div.className = 'tab-row';
      div.innerHTML = `
        <img src="${faviconUrl(r.url)}" class="favicon" alt="" onerror="if(!this.dataset.retry){this.dataset.retry='1';try{this.src='https://www.google.com/s2/favicons?domain='+new URL('${r.url.replace(/'/g, "\\'")}').hostname+'&sz=64'}catch(e){this.style.display='none'}}">
        <div class="tab-info">
          <span class="tab-title">${truncate(maskEmails(r.title), 40)}</span>
          <span class="tab-reason">${r.aiReason || 'Analyzing...'}</span>
        </div>
        <span class="tab-time">${timeAgo(r.openedAt)}</span>
      `;
      container.appendChild(div);
    });
  }

  document.getElementById('open-dashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});
