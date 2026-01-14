
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
      
      addLog(`Download successful! Version: ${data.version}, Last Cloud Update: ${new Date(data.lastUpdated).toLocaleString()}`, 'success');
      addLog(`Data fetched: ${data.bookmarks?.length || 0} bookmarks, ${data.extensions?.length || 0} extensions, ${data.history?.length || 0} history items.`, 'info');
      
      // In a real extension, you'd trigger a restoration flow here.
      addLog('Ready to restore. (Auto-restore skipped for safety in this demo).', 'info');
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
                Restore (Download)
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
                {state.isSyncing ? 'Processing...' : 'Sync Now (Upload)'}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">📡</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Status</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">
                {state.isSyncing ? 'In Progress' : 'Idle'}
              </p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">☁️</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Storage</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">{state.config.provider}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-2xl mb-2 block">📅</span>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Last Activity</h3>
              <p className="text-xl font-bold text-slate-800 mt-1">{state.lastSyncTime || 'No history'}</p>
            </div>
          </div>

          {insights && (
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
               <h3 className="text-lg font-bold mb-3 flex items-center gap-2">✨ Gemini AI Insights</h3>
               <p className="text-indigo-100 leading-relaxed mb-4">{insights.summary}</p>
               <div className="flex flex-wrap gap-2">
                 {insights.recommendations.map((rec, i) => (
                   <span key={i} className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-md">{rec}</span>
                 ))}
               </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
             <h3 className="text-slate-400 text-sm font-bold uppercase mb-4 tracking-widest">Real-time Activity Log</h3>
             <div className="space-y-3 font-mono text-xs max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {state.logs.length === 0 ? (
                  <p className="text-slate-600 italic">Logs will appear here during sync...</p>
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
        <div className="space-y-8">
          <header>
            <h2 className="text-2xl font-bold text-slate-800">Sync Configuration</h2>
            <p className="text-slate-500">Manage your cloud credentials and targets</p>
          </header>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Select Provider</label>
              <div className="flex gap-4">
                {[StorageProvider.GIST, StorageProvider.WEBDAV].map(p => (
                  <button
                    key={p}
                    onClick={() => handleConfigChange({ provider: p })}
                    className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${
                      state.config.provider === p 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {p === 'GIST' ? 'GitHub Gist' : 'WebDAV'}
                  </button>
                ))}
              </div>
            </div>

            {state.config.provider === StorageProvider.GIST ? (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Personal Access Token</label>
                  <input
                    type="password"
                    value={state.config.gistToken || ''}
                    onChange={(e) => handleConfigChange({ gistToken: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ghp_..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Existing Gist ID (Optional)</label>
                  <input
                    type="text"
                    value={state.config.gistId || ''}
                    onChange={(e) => handleConfigChange({ gistId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Leave empty to create new"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">WebDAV Endpoint URL</label>
                  <input
                    type="text"
                    value={state.config.webdavUrl || ''}
                    onChange={(e) => handleConfigChange({ webdavUrl: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="https://your-dav-server.com/remote.php/dav/"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Username</label>
                    <input
                      type="text"
                      value={state.config.webdavUser || ''}
                      onChange={(e) => handleConfigChange({ webdavUser: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Password / App Token</label>
                    <input
                      type="password"
                      value={state.config.webdavPass || ''}
                      onChange={(e) => handleConfigChange({ webdavPass: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <h3 className="font-bold text-slate-800">Items to Synchronize</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'syncBookmarks', label: 'Bookmarks', icon: '🔖' },
                { key: 'syncExtensions', label: 'Extensions', icon: '🧩' },
                { key: 'syncHistory', label: 'History', icon: '🕒' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleConfigChange({ [opt.key]: !state.config[opt.key as keyof SyncConfig] })}
                  className={`flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                    state.config[opt.key as keyof SyncConfig]
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-100 text-slate-400 bg-slate-50'
                  }`}
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <span className="font-bold">{opt.label}</span>
                  <span className="text-xs">{state.config[opt.key as keyof SyncConfig] ? 'Enabled' : 'Disabled'}</span>
                </button>
              ))}
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
  useEffect(() => { getHistory(100).then(setItems); }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Browsing History</h2>
        <p className="text-slate-500">Snapshot of local history records</p>
      </header>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
        {items.map((item, i) => (
          <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
            <h4 className="font-medium text-slate-800 truncate">{item.title || 'Untitled'}</h4>
            <p className="text-xs text-blue-500 truncate mt-1">{item.url}</p>
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
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Local Extensions</h2>
        <p className="text-slate-500">Detected installed browser extensions</p>
      </header>
      <div className="grid grid-cols-2 gap-4">
        {exts.map((ext, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">🧩</div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-800 truncate">{ext.name}</h4>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tight">ID: {ext.id}</p>
              <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                ext.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {ext.enabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
