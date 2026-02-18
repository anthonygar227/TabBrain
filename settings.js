// settings.js — API key management

initTheme();
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

document.getElementById('save-key').addEventListener('click', async () => {
  const key = document.getElementById('api-key').value.trim();
  if (!key) {
    document.getElementById('status').textContent = 'Please enter a key.';
    return;
  }
  await chrome.storage.local.set({ groqApiKey: key });
  document.getElementById('status').textContent = 'Key saved!';
  setTimeout(() => {
    document.getElementById('status').textContent = '';
  }, 2000);
});

document.getElementById('clear-data').addEventListener('click', async () => {
  const confirmed = confirm(
    'This will permanently delete all tracked tabs, saved tabs, and your API key. Are you sure?'
  );
  if (!confirmed) return;
  await chrome.storage.local.remove(['tabRecords', 'groqApiKey']);
  document.getElementById('api-key').value = '';
  document.getElementById('status').textContent = 'All data cleared.';
  setTimeout(() => {
    document.getElementById('status').textContent = '';
  }, 2000);
});

// Load existing key on open
(async () => {
  const result = await chrome.storage.local.get('groqApiKey');
  if (result.groqApiKey) {
    document.getElementById('api-key').value = result.groqApiKey;
  }
})();
