import { autoUpdater } from 'electron-updater';
import { dialog, shell, Notification, BrowserWindow } from 'electron';
import log from 'electron-log';

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  progress?: number;
  version?: string;
  error?: string;
}

export class AutoUpdaterService {
  private updateAvailable = false;
  private updateDownloaded = false;
  private downloadProgress = 0;
  private updateInfo: any = null;
  private autoRestartTimer: NodeJS.Timeout | null = null;

  // Callbacks for UI updates
  private onUpdateStatusChange?: (status: UpdateStatus) => void;

  constructor() {
    this.setupAutoUpdater();
  }

  public setStatusChangeCallback(callback: (status: UpdateStatus) => void): void {
    this.onUpdateStatusChange = callback;
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater for fully automatic silent updates
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true; // Auto-download updates
    autoUpdater.autoInstallOnAppQuit = true; // Install when app quits
    
    // Force silent installation (no wizard, no dialogs)
    (autoUpdater as any).allowDowngrade = false;
    (autoUpdater as any).allowPrerelease = false;

    // Configure update server - always use displayops.vtex.com
    const updateServerUrl = process.env.UPDATE_SERVER_URL || 'https://displayops.vtex.com/api/updates/host';
    const releaseChannel = process.env.RELEASE_CHANNEL || 'stable';
    
    log.info('Using DisplayOps update server:', updateServerUrl);
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateServerUrl,
      useMultipleRangeRequest: false,
      channel: releaseChannel
    });

    // Events
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.notifyStatusChange({
        state: 'checking'
      });
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available, downloading automatically:', info);
      this.updateAvailable = true;
      this.updateInfo = info;
      this.notifyStatusChange({
        state: 'available',
        version: info.version
      });
      this.showUpdateAvailableNotification(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateAvailable = false;
      this.notifyStatusChange({
        state: 'idle'
      });
    });

    autoUpdater.on('error', (err) => {
      log.error('Auto-updater error:', err);
      this.notifyStatusChange({
        state: 'error',
        error: err.message
      });
      this.showErrorNotification(err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      this.downloadProgress = percent;
      log.info(`Download progress: ${percent}%`);
      this.notifyStatusChange({
        state: 'downloading',
        progress: percent,
        version: this.updateInfo?.version
      });
      this.showDownloadProgress(percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded, will install silently and restart:', info);
      this.updateDownloaded = true;
      this.updateInfo = info;
      this.notifyStatusChange({
        state: 'downloaded',
        version: info.version,
        progress: 100
      });
      
      // Show brief notification that update is ready
      this.showUpdateReadyNotification(info);
      
      // Silently quit and install after 5 seconds (no user interaction needed)
      this.autoRestartTimer = setTimeout(() => {
        log.info('Auto-installing update without user interaction...');
        this.installUpdate();
      }, 5000);
    });
  }

  public checkForUpdates(): void {
    if (process.env.NODE_ENV === 'development') {
      log.info('Auto-update disabled in development');
      return;
    }

    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.error('Check for updates failed:', err);
    });
  }

  public async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      throw new Error('No update available');
    }

    try {
      await autoUpdater.downloadUpdate();
      log.info('Update download started');
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  public installUpdate(): void {
    if (!this.updateDownloaded) {
      throw new Error('No update downloaded');
    }

    // Clear any pending auto-restart timer
    if (this.autoRestartTimer) {
      clearTimeout(this.autoRestartTimer);
      this.autoRestartTimer = null;
    }

    log.info('Installing update silently and restarting...');
    // isSilent=true, isForceRunAfter=true for completely automatic installation
    autoUpdater.quitAndInstall(true, true);
  }

  private showUpdateAvailableNotification(info: any): void {
    const notification = new Notification({
      title: '🔄 Atualizando DisplayOps',
      body: `Versão ${info.version} sendo baixada automaticamente em segundo plano...`,
      icon: this.getIconPath(),
      timeoutType: 'default',
      silent: true
    });

    notification.show();
  }

  private showUpdateReadyNotification(info: any): void {
    const notification = new Notification({
      title: '✅ Atualização Pronta',
      body: `Versão ${info.version} será instalada em 5 segundos. O aplicativo reiniciará automaticamente.`,
      icon: this.getIconPath(),
      timeoutType: 'default',
      silent: true
    });

    notification.show();
  }

  private showErrorNotification(error: Error): void {
    const notification = new Notification({
      title: 'Update Error',
      body: 'Failed to check for updates. Click for details.',
      icon: this.getIconPath()
    });

    notification.on('click', () => {
      dialog.showErrorBox('Auto-Update Error', 
        `Failed to check for updates:\n\n${error.message}\n\nCheck your internet connection and try again.`
      );
    });

    notification.show();
  }

  private showDownloadProgress(percent: number): void {
    // Log progress (silent - no notifications to avoid interruptions)
    log.info(`Download progress: ${percent}%`);
    
    // Only show notification at 100% (very brief)
    if (percent === 100) {
      const notification = new Notification({
        title: '✅ Download Completo',
        body: `Atualização baixada. Instalação em breve...`,
        icon: this.getIconPath(),
        silent: true,
        timeoutType: 'default'
      });
      notification.show();
      // Auto-close notification after 2 seconds
      setTimeout(() => notification.close(), 2000);
    }
  }

  private notifyStatusChange(status: UpdateStatus): void {
    if (this.onUpdateStatusChange) {
      this.onUpdateStatusChange(status);
    }
  }

  private async showUpdateDialog(info: any): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `DisplayOps Host Agent ${info.version}`,
      detail: `A new version is available.\n\nCurrent: ${process.env.npm_package_version || 'Unknown'}\nNew: ${info.version}\n\nWould you like to download it now?`,
      buttons: ['Download Now', 'View Release Notes', 'Later'],
      defaultId: 0,
      cancelId: 2
    });

    switch (result.response) {
      case 0: // Download Now
        try {
          await this.downloadUpdate();
        } catch (error) {
          dialog.showErrorBox('Download Failed', `Failed to download update: ${error}`);
        }
        break;
      case 1: // View Release Notes
        if (info.releaseNotes) {
          shell.openExternal(`https://github.com/displayops-team/office-tv/releases/tag/host-v${info.version}`);
        }
        break;
      case 2: // Later
        break;
    }
  }

  private async showRestartDialog(info: any): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'Update Downloaded',
      detail: `Version ${info.version} has been downloaded and is ready to install.\n\nThe application will restart to complete the update.`,
      buttons: ['Restart Now', 'Restart Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 0) {
      this.installUpdate();
    }
  }

  private getIconPath(): string {
    const path = require('path');
    const { app } = require('electron');

    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'assets', 'icon.png');
    } else {
      return path.join(__dirname, '..', 'assets', 'icon.png');
    }
  }

  // Public methods for manual control
  public get hasUpdateAvailable(): boolean {
    return this.updateAvailable;
  }

  public get hasUpdateDownloaded(): boolean {
    return this.updateDownloaded;
  }

  public async manualCheckForUpdates(): Promise<void> {
    try {
      log.info('Manual update check initiated');
      
      // If update already downloaded, show install dialog
      if (this.updateDownloaded && this.updateInfo) {
        await this.showUpdateDialog(this.updateInfo);
        return;
      }
      
      // If update is being downloaded, show progress
      if (this.updateAvailable && this.downloadProgress > 0) {
        dialog.showMessageBox({
          type: 'info',
          title: '⬇️ Download in Progress',
          message: `Downloading version ${this.updateInfo?.version}`,
          detail: `Current progress: ${this.downloadProgress}%\n\nThe update will be ready to install once the download completes.`,
          buttons: ['OK']
        });
        return;
      }
      
      const result = await autoUpdater.checkForUpdates();
      
      // If no updates found, show message
      if (!result || result.updateInfo.version === autoUpdater.currentVersion.version) {
        dialog.showMessageBox({
          type: 'info',
          title: '✅ Up to Date',
          message: 'You are running the latest version.',
          detail: `Current version: ${autoUpdater.currentVersion.version}`,
          buttons: ['OK']
        });
      }
    } catch (error: any) {
      log.error('Manual update check failed:', error);
      dialog.showErrorBox('Update Check Failed', 
        `Failed to check for updates:\n\n${error.message || error}\n\nPlease check your internet connection and try again.`
      );
    }
  }

  // Get current update status for UI
  public getUpdateStatus(): UpdateStatus {
    if (this.updateDownloaded) {
      return {
        state: 'downloaded',
        progress: 100,
        version: this.updateInfo?.version
      };
    }
    
    if (this.updateAvailable && this.downloadProgress > 0) {
      return {
        state: 'downloading',
        progress: this.downloadProgress,
        version: this.updateInfo?.version
      };
    }
    
    if (this.updateAvailable) {
      return {
        state: 'available',
        version: this.updateInfo?.version
      };
    }
    
    return { state: 'idle' };
  }
}