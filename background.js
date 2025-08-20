// Time Tracker – Manifest v3 Background (service worker)

const TICK_MS = 5000; // add 5s per tick while active
let current = { tabId: null, windowFocused: true, state: "active", url: null, domain: null };
let productiveSet = new Set(["leetcode.com", "github.com", "stack Overflow.com", "codesandbox.io", "replit.com", "docs.google.com"]);
let unproductiveSet = new Set(["facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "youtube.com"]);
let backendURL = ""; // optional

// Load user settings
chrome.storage.sync.get(["productive", "unproductive", "backendURL"], (cfg) => {
  if (Array.isArray(cfg.productive)) productiveSet = new Set(cfg.productive);
  if (Array.isArray(cfg.unproductive)) unproductiveSet = new Set(cfg.unproductive);
  if (typeof cfg.backendURL === "string") backendURL = cfg.backendURL.trim();
});

// Helpers
function getDomain(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
}
function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}
async function addTime(domain, ms) {
  if (!domain) return;
  const day = todayKey();
  const key = `time_${day}`;

  const stored = await chrome.storage.local.get(key);
  const map = stored[key] || {}; // { domain: ms }
  map[domain] = (map[domain] || 0) + ms;
  await chrome.storage.local.set({ [key]: map });

  // also keep lastSeen title/url for popup (optional)
  await chrome.storage.local.set({ lastUpdateAt: Date.now() });

  // optional: send to backend every minute
  if (backendURL && ms >= 60000) {
    try {
      await fetch(`${backendURL}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, ms, day })
      });
    } catch (e) {
      // ignore network errors
    }
  }
}
function categoryOf(domain) {
  if (!domain) return "neutral";
  if (productiveSet.has(domain)) return "productive";
  if (unproductiveSet.has(domain)) return "unproductive";
  return "neutral";
}

// Track active tab
async function updateActiveTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url && tab.id) {
      current.tabId = tab.id;
      current.url = tab.url;
      current.domain = getDomain(tab.url);
    } else {
      current.domain = null;
    }
  } catch (e) {
    current.domain = null;
  }
}

// Idle state
chrome.idle.setDetectionInterval(60); // seconds
chrome.idle.onStateChanged.addListener((state) => { current.state = state; });

// Window focus
chrome.windows.onFocusChanged.addListener((winId) => {
  current.windowFocused = (winId !== chrome.windows.WINDOW_ID_NONE);
  updateActiveTabInfo();
});

// Tab changes
chrome.tabs.onActivated.addListener(updateActiveTabInfo);
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tabId === current.tabId && info.status === "complete") updateActiveTabInfo();
});

// Timer tick
setInterval(async () => {
  if (!current.windowFocused) return;
  if (current.state !== "active") return;
  await updateActiveTabInfo();
  if (!current.domain) return;
  await addTime(current.domain, TICK_MS);
}, TICK_MS);

// Respond to popup requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getToday") {
    const key = `time_${todayKey()}`;
    chrome.storage.local.get(key).then((res) => {
      sendResponse({ map: res[key] || {}, sets: {
        productive: Array.from(productiveSet),
        unproductive: Array.from(unproductiveSet)
      }});
    });
    return true; // async
  }
  if (msg.type === "refreshSets") {
    chrome.storage.sync.get(["productive", "unproductive", "backendURL"], (cfg) => {
      if (Array.isArray(cfg.productive)) productiveSet = new Set(cfg.productive);
      if (Array.isArray(cfg.unproductive)) unproductiveSet = new Set(cfg.unproductive);
      if (typeof cfg.backendURL === "string") backendURL = cfg.backendURL.trim();
      sendResponse({ ok: true });
    });
    return true;
  }
});
