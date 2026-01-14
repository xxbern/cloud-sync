
import React, { useState, useEffect, useCallback } from 'react';
import { StorageProvider, SyncConfig, AppState, SyncLog, SyncData } from './types';
import Layout from './components/Layout';
import { getBookmarks, getExtensions, getHistory, saveConfigToLocal, loadConfigFromLocal } from './services/chromeAdapter';
import { getProvider } from './services/cloudStorage';
import { analyzeBrowsingTrends } from './services/gemini';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, setState] = useState<AppState>({
    config: {
      provider: StorageProvider.GIST,
      syncBookmarks: true,
      syncExtensions: true,
      syncHistory: true,
      autoSyncInterval: 60,
    },
    logs: [],
    isSyncing: false,
    lastSyncTime: null,
  });

  const [insights, setInsights] = useState<{ summary: string; recommendations: string[] } | null>(null);

  useEffect(() => {
    const init = async () => {
      const saved = await loadConfigFromLocal();
      if (saved) {
        setState(prev => ({ ...prev, config: { ...prev.config, ...saved } }));
      } else {
        // 如果没有保存的配置，引导用户去设置页面
        setActiveTab('settings');
        addLog('Welcome! Please configure your sync settings first.', 'info');
      }
    };
    init();
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newLog: SyncLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setState(prev => ({ ...prev, logs: [newLog, ...prev.logs].slice(0, 50) }));
  }, []);

  const performUpload = async () => {
    if (state.isSyncing) return;
    
    // 基础校验
    if (state.config.provider === StorageProvider.GIST && !state.config.gistToken) {
      addLog('Error: Gist Token is missing. Go to Settings.', 'error');
      setActiveTab('settings');
      return;
    }
    if (state.config.provider === StorageProvider.WEBDAV && !state.config.webdavUrl) {
      addLog('Error: WebDAV URL is missing. Go to Settings.', 'error');
      setActiveTab('settings');
      return;
    }

    setState(prev => ({ ...prev, isSyncing: true }));
    addLog('Initiating manual upload...', 'info');

    try {
      const bookmarks = state.config.syncBookmarks ? await getBookmarks() : [];
      const extensions = state.config.syncExtensions ? await getExtensions() : [];
      const history = state.config.syncHistory ? await getHistory() : [];

      const syncData: SyncData = {
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
        bookmarks,
        extensions,
        history,
      };

      const provider = getProvider(state.config.provider);
      const result = await provider.upload(state.config, syncData);

      if (state.config.provider === StorageProvider.GIST && result && result !== state.config.gistId) {
        const updatedConfig = { ...state.config, gistId: result as string };
        setState(prev => ({ ...prev, config: updatedConfig }));
        await saveConfigToLocal(updatedConfig);
      }

      setState(prev => ({ ...prev, lastSyncTime: new Date().toLocaleString() }));
      addLog('Upload successful!', 'success');

      if (history.length > 0) {
        analyzeBrowsingTrends(history).then(res => res && setInsights(res));
      }
    } catch (error: any) {
      addLog(`Upload failed: ${error.message}`, 'error');
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const performDownload = async () => {
    if (state.isSyncing) return;
    setState(prev => ({ ...prev, isSyncing: true }));
    addLog('Initiating manual download...', 'info');

    try {
      const provider = getProvider(state.config.provider);
      const data = await provider.download(state.config);
      
      addLog(`Download successful! Last Update: ${new Date(data.lastUpdated).toLocaleString()}`, 'success');
      addLog('Ready to restore. (Auto-restore skipped for safety).', 'info');
    } catch (error: any) {
      addLog(`Download failed: ${error.message}`, 'error');
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const handleConfigChange = async (newConfig: Partial<SyncConfig>) => {
    const updated = { ...state.config, ...newConfig };
    setState(prev => ({ ...prev, config: updated }));
    await saveConfigToLocal(updated);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
              <p className="text-slate-500">Manage your browser synchronization</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={performDownload}
                disabled={state.isSyncing}
                className={`px-6 py-3 rounded-xl font-bold border-2 transition-all ${
                  state.isSyncing 
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed' 
                    : 'border-blue-600 text-blue-600 hover:bg-blue-50 active:scale-95'
                }`}
              >
                Restore
              </button>
              <button
                onClick={performUpload}
                disabled={state.isSyncing}
                className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
                  state.isSyncing 
                    ? 'bg-slate-300 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'
                }`}
              >
                {state.isSyncing ? 'Processing...' : 'Sync Now'}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">📡</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Status</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">{state.isSyncing ? 'In Progress' : 'Idle'}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">☁️</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Storage</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">{state.config.provider}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">📅</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Last Sync</h3>
              <p className="text-xl font-bold text-slate-800 mt-1 truncate">{state.lastSyncTime || 'None'}</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
             <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 tracking-widest">Operation Log</h3>
             <div className="space-y-3 font-mono text-[10px] max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {state.logs.length === 0 ? (
                  <p className="text-slate-600 italic">No logs yet...</p>
                ) : (
                  state.logs.map((log, i) => (
                    <div key={i} className={`flex gap-3 ${
                      log.type === 'error' ? 'text-rose-400' : 
                      log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      <span className="opacity-40">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8 p-4">
          <header>
            <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
            <p className="text-slate-500">Enter your credentials below to enable cloud sync.</p>
          </header>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Storage Provider</label>
              <div className="flex gap-4">
                {[StorageProvider.GIST, StorageProvider.WEBDAV].map(p => (
                  <button
                    key={p}
                    onClick={() => handleConfigChange({ provider: p })}
                    className={`flex-1 py-3 rounded-xl border-2 transition-all font-bold ${
                      state.config.provider === p 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {state.config.provider === StorageProvider.GIST ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">GitHub Token</label>
                  <input
                    type="password"
                    value={state.config.gistToken || ''}
                    onChange={(e) => handleConfigChange({ gistToken: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    placeholder="ghp_..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Gist ID (Optional)</label>
                  <input
                    type="text"
                    value={state.config.gistId || ''}
                    onChange={(e) => handleConfigChange({ gistId: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    placeholder="Existing ID or leave blank"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">WebDAV URL</label>
                  <input
                    type="text"
                    value={state.config.webdavUrl || ''}
                    onChange={(e) => handleConfigChange({ webdavUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Username"
                    value={state.config.webdavUser || ''}
                    onChange={(e) => handleConfigChange({ webdavUser: e.target.value })}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={state.config.webdavPass || ''}
                    onChange={(e) => handleConfigChange({ webdavPass: e.target.value })}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800">Sync Scope</h3>
            <div className="flex gap-4">
              {['Bookmarks', 'Extensions', 'History'].map(label => {
                const key = `sync${label}` as keyof SyncConfig;
                const active = !!state.config[key];
                return (
                  <button
                    key={label}
                    onClick={() => handleConfigChange({ [key]: !active })}
                    className={`flex-1 py-2 rounded-lg border transition-all text-xs font-bold ${
                      active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'history' && <HistoryView />}
      {activeTab === 'extensions' && <ExtensionsView />}
    </Layout>
  );
};

const HistoryView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { getHistory(50).then(setItems); }, []);
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Local History</h2>
      <div className="bg-white rounded-xl shadow-sm border divide-y overflow-hidden max-h-96 overflow-y-auto">
        {items.map((item, i) => (
          <div key={i} className="p-3 text-xs truncate">
            <div className="font-bold text-slate-700">{item.title || 'Untitled'}</div>
            <div className="text-blue-500 opacity-70">{item.url}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExtensionsView: React.FC = () => {
  const [exts, setExts] = useState<any[]>([]);
  useEffect(() => { getExtensions().then(setExts); }, []);
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Installed Extensions</h2>
      <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
        {exts.map((ext, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border flex justify-between items-center">
            <div className="text-xs font-bold truncate pr-4">{ext.name}</div>
            <div className={`text-[10px] px-2 py-0.5 rounded ${ext.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
              {ext.enabled ? 'ON' : 'OFF'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
