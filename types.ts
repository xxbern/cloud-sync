
export enum StorageProvider {
  GIST = 'GIST',
  WEBDAV = 'WEBDAV'
}

export interface SyncConfig {
  provider: StorageProvider;
  gistToken?: string;
  gistId?: string;
  webdavUrl?: string;
  webdavUser?: string;
  webdavPass?: string;
  syncBookmarks: boolean;
  syncExtensions: boolean;
  syncHistory: boolean;
  autoSyncInterval: number; // minutes
}

export interface SyncData {
  lastUpdated: string;
  version: string;
  bookmarks: any[];
  extensions: any[];
  history: any[];
}

export interface SyncLog {
  timestamp: string;
  type: 'info' | 'error' | 'success';
  message: string;
}

export interface AppState {
  config: SyncConfig;
  logs: SyncLog[];
  isSyncing: boolean;
  lastSyncTime: string | null;
}

/**
 * Strategy interface for cloud storage providers
 */
export interface ICloudProvider {
  upload(config: SyncConfig, data: SyncData): Promise<string | void>;
  download(config: SyncConfig): Promise<SyncData>;
}
