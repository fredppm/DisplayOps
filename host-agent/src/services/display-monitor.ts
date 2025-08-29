import { EventEmitter } from 'events';
import { screen, Display } from 'electron';

export interface DisplayInfo {
  id: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  isPrimary: boolean;
  label?: string;
}

export interface DisplayChangeEvent {
  type: 'added' | 'removed' | 'metrics_changed' | 'polling_detected';
  displays: DisplayInfo[];
  changedDisplay?: DisplayInfo;
  timestamp: Date;
}

export class DisplayMonitor extends EventEmitter {
  private currentDisplays: Map<number, DisplayInfo> = new Map();
  private isMonitoring: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    super();
    // Don't update displays in constructor - wait for Electron app to be ready
  }

  public initialize(): void {
    if (this.isInitialized) return;
    
    console.log('🖥️ Initializing display monitoring');
    this.updateDisplays(); // Initial display detection after app is ready
    this.isInitialized = true;
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    if (!this.isInitialized) {
      this.initialize();
    }

    console.log('🖥️ Starting display monitoring...');
    this.isMonitoring = true;

    // Listen for display events
    screen.on('display-added', this.handleDisplayAdded.bind(this));
    screen.on('display-removed', this.handleDisplayRemoved.bind(this));
    screen.on('display-metrics-changed', this.handleDisplayMetricsChanged.bind(this));

    // Start periodic polling to catch display changes that Electron might miss
    this.startPolling();

    console.log(`📺 Monitoring ${this.currentDisplays.size} displays`);
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🔴 Stopping display monitoring...');
    this.isMonitoring = false;

    // Remove listeners
    screen.removeAllListeners('display-added');
    screen.removeAllListeners('display-removed');
    screen.removeAllListeners('display-metrics-changed');

    // Stop polling
    this.stopPolling();
  }

  private pollingInterval: NodeJS.Timeout | null = null;

  private startPolling(): void {
    // Poll every 5 seconds to catch display changes
    this.pollingInterval = setInterval(() => {
      this.checkForDisplayChanges();
    }, 5000);
    
    console.log('🔄 Started display polling (5s interval)');
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🔄 Stopped display polling');
    }
  }

  private checkForDisplayChanges(): void {
    try {
      const currentDisplayCount = this.currentDisplays.size;
      const systemDisplays = screen.getAllDisplays();
      
      if (systemDisplays.length !== currentDisplayCount) {
        console.log(`🔄 Display count changed: ${currentDisplayCount} -> ${systemDisplays.length}`);
        
        // Update displays and emit change event
        this.updateDisplays();
        
        const changeEvent: DisplayChangeEvent = {
          type: 'polling_detected',
          displays: this.getDisplays(),
          changedDisplay: undefined,
          timestamp: new Date()
        };
        
        this.emit('display-change', changeEvent);
      }
    } catch (error) {
      console.error('Error in display polling:', error);
    }
  }

  public getDisplays(): DisplayInfo[] {
    return Array.from(this.currentDisplays.values());
  }

  public getDisplayCount(): number {
    return this.currentDisplays.size;
  }

  public getDisplayById(id: number): DisplayInfo | undefined {
    return this.currentDisplays.get(id);
  }

  public getPrimaryDisplay(): DisplayInfo | undefined {
    return Array.from(this.currentDisplays.values()).find(d => d.isPrimary);
  }

  private handleDisplayAdded(event: any, display: Display): void {
    console.log('📺 Display added:', display.id);
    const displayInfo = this.convertDisplay(display);
    
    this.currentDisplays.set(display.id, displayInfo);
    
    const changeEvent: DisplayChangeEvent = {
      type: 'added',
      displays: this.getDisplays(),
      changedDisplay: displayInfo,
      timestamp: new Date()
    };

    this.emit('display-change', changeEvent);
    this.emit('display-added', changeEvent);

    console.log(`✅ Display added: ${display.bounds.width}x${display.bounds.height} at (${display.bounds.x}, ${display.bounds.y})`);
  }

  private handleDisplayRemoved(event: any, display: Display): void {
    console.log('📺 Display removed:', display.id);
    const displayInfo = this.currentDisplays.get(display.id);
    
    this.currentDisplays.delete(display.id);
    
    const changeEvent: DisplayChangeEvent = {
      type: 'removed',
      displays: this.getDisplays(),
      changedDisplay: displayInfo,
      timestamp: new Date()
    };

    this.emit('display-change', changeEvent);
    this.emit('display-removed', changeEvent);

    console.log(`❌ Display removed: ID ${display.id}`);
  }

  private handleDisplayMetricsChanged(event: any, display: Display): void {
    console.log('📺 Display metrics changed:', display.id);
    const displayInfo = this.convertDisplay(display);
    
    this.currentDisplays.set(display.id, displayInfo);
    
    const changeEvent: DisplayChangeEvent = {
      type: 'metrics_changed',
      displays: this.getDisplays(),
      changedDisplay: displayInfo,
      timestamp: new Date()
    };

    this.emit('display-change', changeEvent);
    this.emit('display-metrics-changed', changeEvent);

    console.log(`🔄 Display metrics changed: ${display.bounds.width}x${display.bounds.height}`);
  }

  public updateDisplays(): void {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    this.currentDisplays.clear();
    
    displays.forEach(display => {
      const displayInfo = this.convertDisplay(display, primaryDisplay.id === display.id);
      this.currentDisplays.set(display.id, displayInfo);
    });

    console.log(`🖥️ Updated display list: ${displays.length} displays detected`);
  }

  private convertDisplay(display: Display, isPrimary?: boolean): DisplayInfo {
    const primaryDisplay = screen.getPrimaryDisplay();
    
    return {
      id: display.id,
      bounds: {
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height
      },
      workArea: {
        x: display.workArea.x,
        y: display.workArea.y,
        width: display.workArea.width,
        height: display.workArea.height
      },
      scaleFactor: display.scaleFactor,
      isPrimary: isPrimary ?? (primaryDisplay.id === display.id),
      label: `Display ${display.id} (${display.bounds.width}x${display.bounds.height})`
    };
  }

  public getDisplayStats(): {
    totalDisplays: number;
    primaryDisplay?: DisplayInfo;
    totalResolution: { width: number; height: number };
    averageScaleFactor: number;
  } {
    const displays = this.getDisplays();
    const primaryDisplay = this.getPrimaryDisplay();
    
    const totalWidth = displays.reduce((sum, d) => sum + d.bounds.width, 0);
    const totalHeight = Math.max(...displays.map(d => d.bounds.height));
    const avgScale = displays.reduce((sum, d) => sum + d.scaleFactor, 0) / displays.length;

    return {
      totalDisplays: displays.length,
      primaryDisplay,
      totalResolution: { width: totalWidth, height: totalHeight },
      averageScaleFactor: avgScale
    };
  }

  public cleanup(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}
