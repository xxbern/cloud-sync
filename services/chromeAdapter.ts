
/**
 * Since this is running in a browser environment context provided by the platform,
 * we assume 'chrome' global is available when running as an extension.
 * If not, we'll mock it for development purposes.
 */

// Fix: Add a global declaration for 'chrome' to resolve TypeScript compilation errors.
// This object is injected by the Chrome extension environment at runtime.
declare const chrome: any;

const isChromeAvailable = typeof chrome !== 'undefined' && chrome.bookmarks;

export const getBookmarks = async (): Promise<any[]> => {
  if (!isChromeAvailable) return [{ id: 'mock', title: 'Mock Bookmark', url: 'https://google.com' }];
  return new Promise((resolve) => {
    chrome.bookmarks.getTree((tree) => resolve(tree));
  });
};

export const getExtensions = async (): Promise<any[]> => {
  if (!isChromeAvailable) return [{ id: 'mock-ext', name: 'Mock Extension', enabled: true }];
  return new Promise((resolve) => {
    chrome.management.getAll((exts) => resolve(exts.filter(e => e.type === 'extension')));
  });
};

export const getHistory = async (maxResults = 1000): Promise<any[]> => {
  if (!isChromeAvailable) return [{ id: 'mock-hist', title: 'Mock History', url: 'https://github.com' }];
  return new Promise((resolve) => {
    chrome.history.search({ text: '', maxResults, startTime: 0 }, (historyItems) => resolve(historyItems));
  });
};

export const saveConfigToLocal = async (config: any) => {
  if (!isChromeAvailable) {
    localStorage.setItem('cloudsync_config', JSON.stringify(config));
    return;
  }
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ cloudsync_config: config }, () => resolve());
  });
};

export const loadConfigFromLocal = async (): Promise<any | null> => {
  if (!isChromeAvailable) {
    const data = localStorage.getItem('cloudsync_config');
    return data ? JSON.parse(data) : null;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(['cloudsync_config'], (result) => resolve(result.cloudsync_config || null));
  });
};
