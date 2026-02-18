// background.js — Service worker: tab events, AI calls, storage

// =====================
// Storage helpers
// =====================

async function getTabRecords() {
  const result = await chrome.storage.local.get('tabRecords');
  return result.tabRecords || [];
}

async function saveTabRecord(record) {
  const records = await getTabRecords();
  const idx = records.findIndex(r => r.tabId === record.tabId);
  if (idx >= 0) {
    records[idx] = record;
  } else {
    records.push(record);
  }
  await chrome.storage.local.set({ tabRecords: records });
}

// =====================
// AI Integration
// =====================

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const aiQueue = [];
let aiProcessing = false;

async function getApiKey() {
  const result = await chrome.storage.local.get('groqApiKey');
  return result.groqApiKey || null;
}

function buildPrompt(record) {
  return `You are a browser tab analyst. Given the following tab info, respond with ONLY valid JSON (no markdown, no explanation):

Title: ${record.title}
URL: ${record.url}
Description: ${record.metaDescription}
Page snippet: ${record.snippet}

Return JSON with exactly these fields:
{
  "reason": "<a short phrase explaining WHY the user likely opened this tab, e.g. 'Debugging a Python error', 'Shopping for headphones'>",
  "category": "<one of: Research, Shopping, Social Media, Entertainment, Work, Learning, News, Communication, Finance, Development, Other>"
}`;
}

async function callGroqApi(record) {
  const apiKey = await getApiKey();
  if (!apiKey) return fallbackCategorize(record);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are a concise browser tab analyst. Respond only with valid JSON.' },
          { role: 'user', content: buildPrompt(record) }
        ],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      console.warn('Groq API error:', response.status);
      return fallbackCategorize(record);
    }

    const data = await response.json();
    const text = data.choices[0].message.content.trim();
    const parsed = JSON.parse(text);
    return { reason: parsed.reason, category: parsed.category };
  } catch (err) {
    console.warn('AI call failed, using fallback:', err);
    return fallbackCategorize(record);
  }
}

// Keyword-based fallback when API is unavailable
function fallbackCategorize(record) {
  const text = (record.title + ' ' + record.url + ' ' + record.snippet).toLowerCase();

  const rules = [
    { keywords: ['github', 'stackoverflow', 'error', 'bug', 'debug', 'code', 'api', 'docs', 'npm', 'pypi'], category: 'Development' },
    { keywords: ['youtube', 'netflix', 'twitch', 'spotify', 'video', 'watch', 'stream'], category: 'Entertainment' },
    { keywords: ['amazon', 'ebay', 'shop', 'buy', 'price', 'cart', 'product', 'deal'], category: 'Shopping' },
    { keywords: ['twitter', 'reddit', 'facebook', 'instagram', 'linkedin', 'tiktok'], category: 'Social Media' },
    { keywords: ['news', 'cnn', 'bbc', 'nytimes', 'reuters', 'breaking'], category: 'News' },
    { keywords: ['course', 'tutorial', 'learn', 'lecture', 'education', 'udemy', 'coursera', 'khan'], category: 'Learning' },
    { keywords: ['gmail', 'outlook', 'slack', 'discord', 'mail', 'chat', 'message'], category: 'Communication' },
    { keywords: ['bank', 'finance', 'invest', 'stock', 'crypto', 'payment'], category: 'Finance' },
    { keywords: ['arxiv', 'paper', 'journal', 'research', 'study', 'wikipedia', 'scholar'], category: 'Research' },
    { keywords: ['docs', 'google doc', 'notion', 'trello', 'jira', 'confluence', 'drive'], category: 'Work' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return { reason: `Browsing ${rule.category.toLowerCase()} content`, category: rule.category };
    }
  }
  return { reason: 'General browsing', category: 'Other' };
}

// Queue processor — one tab at a time, 500ms gap
async function processAiQueue() {
  if (aiProcessing || aiQueue.length === 0) return;
  aiProcessing = true;

  while (aiQueue.length > 0) {
    const tabId = aiQueue.shift();
    const records = await getTabRecords();
    const record = records.find(r => r.tabId === tabId && !r.aiProcessed);
    if (!record) continue;

    const result = await callGroqApi(record);
    record.aiReason = result.reason;
    record.aiCategory = result.category;
    record.aiProcessed = true;
    await chrome.storage.local.set({ tabRecords: records });

    // Rate limit: 500ms between calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  aiProcessing = false;
}

function enqueueForAi(tabId) {
  if (!aiQueue.includes(tabId)) {
    aiQueue.push(tabId);
    processAiQueue();
  }
}

// =====================
// Badge
// =====================

async function updateBadge() {
  const records = await getTabRecords();
  const activeCount = records.filter(r => !r.closedAt).length;
  chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0071E3' });
}

// =====================
// Tab event listeners
// =====================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return;

  try {
    const content = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });

    const record = {
      tabId,
      url: content.url || tab.url,
      title: content.title || tab.title || '',
      metaDescription: content.metaDescription || '',
      snippet: content.snippet || '',
      openedAt: new Date().toISOString(),
      aiReason: null,
      aiCategory: null,
      aiProcessed: false,
      savedForLater: false
    };

    await saveTabRecord(record);
    enqueueForAi(tabId);
  } catch (err) {
    // Content script not injected — store what we have from tabs API
    const record = {
      tabId,
      url: tab.url,
      title: tab.title || '',
      metaDescription: '',
      snippet: '',
      openedAt: new Date().toISOString(),
      aiReason: null,
      aiCategory: null,
      aiProcessed: false,
      savedForLater: false
    };
    await saveTabRecord(record);
    enqueueForAi(tabId);
  }

  await updateBadge();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const records = await getTabRecords();
  const idx = records.findIndex(r => r.tabId === tabId);
  if (idx === -1) return;

  if (records[idx].savedForLater) {
    // Keep saved tabs but mark them closed
    records[idx].closedAt = new Date().toISOString();
  } else {
    // Remove non-saved tabs entirely — dashboard is a live snapshot
    records.splice(idx, 1);
  }
  await chrome.storage.local.set({ tabRecords: records });
  await updateBadge();
});

// =====================
// On install — capture existing tabs
// =====================

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) continue;
    const record = {
      tabId: tab.id,
      url: tab.url,
      title: tab.title || '',
      metaDescription: '',
      snippet: '',
      openedAt: new Date().toISOString(),
      aiReason: null,
      aiCategory: null,
      aiProcessed: false,
      savedForLater: false
    };
    await saveTabRecord(record);
    enqueueForAi(tab.id);
  }
  await updateBadge();
});

// On service worker startup: reconcile storage against actual open tabs
(async () => {
  const records = await getTabRecords();
  const openTabs = await chrome.tabs.query({});
  const openTabIds = new Set(openTabs.map(t => t.id));

  // Remove records for tabs that are no longer open (unless saved)
  const reconciled = records.filter(r => {
    if (r.savedForLater) return true;
    return openTabIds.has(r.tabId);
  });

  if (reconciled.length !== records.length) {
    await chrome.storage.local.set({ tabRecords: reconciled });
  }

  // Re-queue unprocessed tabs for AI
  for (const record of reconciled) {
    if (!record.aiProcessed && !record.closedAt) {
      enqueueForAi(record.tabId);
    }
  }
})();

// =====================
// Storage cleanup — prune closed tabs older than 30 days
// =====================

async function pruneOldRecords() {
  const records = await getTabRecords();
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  // Only saved+closed tabs accumulate — prune ones older than 30 days
  const pruned = records.filter(r =>
    !r.closedAt || new Date(r.closedAt).getTime() > thirtyDaysAgo
  );
  if (pruned.length !== records.length) {
    await chrome.storage.local.set({ tabRecords: pruned });
  }
}

chrome.alarms.create('pruneRecords', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pruneRecords') pruneOldRecords();
});

// =====================
// Keyboard shortcut
// =====================

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-dashboard') {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});
