
import { StorageProvider, SyncConfig, SyncData, ICloudProvider } from '../types';

export class GistProvider implements ICloudProvider {
  async upload(config: SyncConfig, data: SyncData): Promise<string> {
    if (!config.gistToken) throw new Error('Gist Token is required');

    const headers = {
      'Authorization': `token ${config.gistToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    const payload = {
      description: 'CloudSync Pro - Browser Data',
      public: false,
      files: {
        'sync_data.json': {
          content: JSON.stringify(data, null, 2)
        }
      }
    };

    const method = config.gistId ? 'PATCH' : 'POST';
    const url = config.gistId 
      ? `https://api.github.com/gists/${config.gistId}` 
      : 'https://api.github.com/gists';

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to upload to Gist');
    }

    const result = await response.json();
    return result.id;
  }

  async download(config: SyncConfig): Promise<SyncData> {
    if (!config.gistToken || !config.gistId) throw new Error('Gist Token and ID are required for download');

    const headers = {
      'Authorization': `token ${config.gistToken}`,
      'Accept': 'application/vnd.github.v3+json',
    };

    const response = await fetch(`https://api.github.com/gists/${config.gistId}`, { headers });
    if (!response.ok) throw new Error('Failed to download from Gist');

    const result = await response.json();
    const file = result.files['sync_data.json'];
    if (!file || !file.content) throw new Error('Sync data file not found in Gist');

    return JSON.parse(file.content);
  }
}

export class WebDAVProvider implements ICloudProvider {
  private getUrl(config: SyncConfig): string {
    const fileName = 'cloudsync_pro_backup.json';
    return config.webdavUrl!.endsWith('/') 
      ? `${config.webdavUrl}${fileName}` 
      : `${config.webdavUrl}/${fileName}`;
  }

  private getHeaders(config: SyncConfig) {
    const auth = btoa(`${config.webdavUser}:${config.webdavPass}`);
    return {
      'Authorization': `Basic ${auth}`,
    };
  }

  async upload(config: SyncConfig, data: SyncData): Promise<void> {
    if (!config.webdavUrl) throw new Error('WebDAV URL is required');

    const response = await fetch(this.getUrl(config), {
      method: 'PUT',
      headers: {
        ...this.getHeaders(config),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error(`WebDAV Upload Failed: ${response.statusText}`);
  }

  async download(config: SyncConfig): Promise<SyncData> {
    if (!config.webdavUrl) throw new Error('WebDAV URL is required');

    const response = await fetch(this.getUrl(config), {
      method: 'GET',
      headers: this.getHeaders(config),
    });

    if (!response.ok) throw new Error(`WebDAV Download Failed: ${response.statusText}`);
    return await response.json();
  }
}

export const getProvider = (type: StorageProvider): ICloudProvider => {
  switch (type) {
    case StorageProvider.GIST: return new GistProvider();
    case StorageProvider.WEBDAV: return new WebDAVProvider();
    default: throw new Error('Provider not implemented');
  }
};
