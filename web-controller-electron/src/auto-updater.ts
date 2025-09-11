import { autoUpdater } from 'electron-updater';
import { dialog, shell, Notification } from 'electron';
import log from 'electron-log';

export class AutoUpdaterService {
  private updateAvailable = false;
  private updateDownloaded = false;

  constructor() {
    this.setupAutoUpdater();
  }

  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true; // Auto-download updates
    autoUpdater.autoInstallOnAppQuit = true;

    // Configure update server - always use displayops.vtex.com
    const updateServerUrl = process.env.UPDATE_SERVER_URL || 'https://displayops.vtex.com/api/updates/controller';
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
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available, downloading automatically:', info);
      this.updateAvailable = true;
      this.showUpdateAvailableNotification(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available:', info);
      this.updateAvailable = false;
    });

    autoUpdater.on('error', (err) => {
      log.error('Auto-updater error:', err);
      this.showErrorNotification(err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      log.info(`Download progress: ${percent}%`);
      this.showDownloadProgress(percent);
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded, restarting automatically:', info);
      this.updateDownloaded = true;
      this.showUpdateReadyNotification(info);
      
      // Auto-restart after 3 seconds
      setTimeout(() => {
        this.installUpdate();
      }, 3000);
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

    autoUpdater.quitAndInstall();
  }

  private showUpdateAvailableNotification(info: any): void {
    const notification = new Notification({
      title: 'DisplayOps Controller Update',
      body: `Version ${info.version} is being downloaded automatically...`,
      icon: this.getIconPath()
    });

    notification.show();
  }

  private showUpdateReadyNotification(info: any): void {
    const notification = new Notification({
      title: 'Update Ready',
      body: `Version ${info.version} downloaded. Restarting in 3 seconds...`,
      icon: this.getIconPath()
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
    // This could be enhanced with a progress window
    log.info(`Download progress: ${percent}%`);
  }

  private async showUpdateDialog(info: any): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `DisplayOps Controller ${info.version}`,
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
          shell.openExternal(`https://github.com/yourusername/yourrepo/releases/tag/v${info.version}`);
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
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        dialog.showMessageBox({
          type: 'info',
          title: 'No Updates',
          message: 'You are running the latest version.',
          buttons: ['OK']
        });
      }
    } catch (error) {
      dialog.showErrorBox('Update Check Failed', 
        `Failed to check for updates: ${error}`
      );
    }
  }
}