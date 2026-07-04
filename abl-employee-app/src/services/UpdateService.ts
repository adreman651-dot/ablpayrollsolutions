import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

export interface ApkUpdaterPlugin {
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { status: string; progress?: number }) => void
  ): Promise<any>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  minimumVersion: number;
  mandatory: boolean;
  releaseDate: string;
  apkUrl: string;
  releaseNotes: string[];
}

export class UpdateService {
  private static VERSION_URL = 'https://raw.githubusercontent.com/adrian-abl/ABL-PAYROLL/main/ablpayrollsolutions/abl-employee-app/version.json'; // Replace with actual URL if known, but GitHub Releases requires full URL. We'll use the user's repo URL.
  // Actually, we can fetch from the repo or a known URL.
  
  static setVersionUrl(repoOwner: string, repoName: string) {
    this.VERSION_URL = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/ablpayrollsolutions/abl-employee-app/version.json`;
  }

  static async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const response = await fetch(this.VERSION_URL, { cache: 'no-cache' });
      if (!response.ok) return null;
      const data: UpdateInfo = await response.json();
      const currentVersion = await this.getCurrentVersion();
      
      if (this.compareVersion(currentVersion, data.versionName) < 0) {
        return data;
      }
      return null;
    } catch (error) {
      console.error('Update check failed', error);
      return null;
    }
  }

  static async getLatestVersion(): Promise<UpdateInfo | null> {
    try {
      const response = await fetch(this.VERSION_URL, { cache: 'no-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  static async getCurrentVersion(): Promise<string> {
    try {
      const info = await App.getInfo();
      return info.version;
    } catch (e) {
      return "1.0.0";
    }
  }

  static compareVersion(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  static async downloadAndInstall(url: string, onProgress?: (progress: number) => void): Promise<void> {
    const listener = await ApkUpdater.addListener('downloadProgress', (info) => {
      if (info.status === 'downloading' && info.progress !== undefined) {
        if (onProgress) onProgress(info.progress);
      }
    });

    try {
      await ApkUpdater.downloadAndInstall({ url });
    } finally {
      listener.remove();
    }
  }
}
