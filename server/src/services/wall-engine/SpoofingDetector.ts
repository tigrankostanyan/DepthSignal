// ==========================================
// SPOOFING DETECTION ENGINE
// Detects spoofing patterns in order book walls
// ==========================================

import { DetectedWall, ExchangeId, MarketType, WallSide, OrderBookLevel } from '../../types/index.js';

//  spoofing alert
export interface SpoofingAlert {
  wallId: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  side: WallSide;
  price: number;
  volumeUsd: number;
  pattern: 'RAPID_CANCEL' | 'REAPPEARING' | 'WASH_TRADING' | 'LAYER_STACK';
  confidence: number; // 0-100
  timestamp: number;
  details: string;
}

//  spoofing detector config
export interface SpoofingDetectorConfig {
  minVolumeUsd: number;          // Default 500000
  maxWallAgeSec: number;          // Default 5
  cancelThreshold: number;        // Default 3 (cancellations within window)
  reappearThreshold: number;      // Default 2 (reappearances within window)
  detectionWindowMs: number;      // Default 60000 (1 minute)
  minConfidence: number;          // Default 60
}

//  wall history entry
interface WallHistoryEntry {
  wallId: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: MarketType;
  side: WallSide;
  price: number;
  volumeUsd: number;
  firstSeenAt: number;
  lastSeenAt: number;
  appearances: number;
  cancellations: number;
  wasSpoofed: boolean;
}

//  spoofing detector
export class SpoofingDetector {
  // Instance property
  private static instance: SpoofingDetector;
  // Config property
  private config: SpoofingDetectorConfig;
  // Wall history property
  private wallHistory = new Map<string, WallHistoryEntry>();
  // Spoof alerts property
  private spoofAlerts: SpoofingAlert[] = [];
  // Listeners property
  private listeners: ((alert: SpoofingAlert) => void)[] = [];

  private constructor() {
    this.config = {
      minVolumeUsd: 500000,
      maxWallAgeSec: 5,
      cancelThreshold: 3,
      reappearThreshold: 2,
      detectionWindowMs: 60000,
      minConfidence: 60,
    };
  }

  // Get instance
  public static getInstance(): SpoofingDetector {
    if (!SpoofingDetector.instance) {
      SpoofingDetector.instance = new SpoofingDetector();
    }
    return SpoofingDetector.instance;
  }

  // Set config
  public setConfig(config: Partial<SpoofingDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // On spoof alert
  public onSpoofAlert(listener: (alert: SpoofingAlert) => void): void {
    this.listeners.push(listener);
  }

  // Process wall event
  public processWallEvent(
    wall: DetectedWall,
    event: 'FORMING' | 'CONFIRMED' | 'REMOVED' | 'FILLED'
  ): void {
    const key = this.getWallKey(wall);

    // Skip walls below threshold
    if (wall.volumeUsd < this.config.minVolumeUsd) return;

    if (event === 'FORMING') {
      // New wall appeared
      const existing = this.wallHistory.get(key);
      if (existing) {
        // Wall reappeared
        existing.appearances++;
        existing.lastSeenAt = Date.now();
        // Check for reappearing pattern
        this.checkReappearingPattern(existing);
      } else {
        // New wall entry
        this.wallHistory.set(key, {
          wallId: wall.id,
          symbol: wall.symbol,
          exchange: wall.exchange,
          marketType: wall.marketType,
          side: wall.side,
          price: wall.price,
          volumeUsd: wall.volumeUsd,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
          appearances: 1,
          cancellations: 0,
          wasSpoofed: false,
        });
      }
    }

    if (event === 'REMOVED') {
      const existing = this.wallHistory.get(key);
      if (existing) {
        // Rapid cancellation detection
        const ageMs = Date.now() - existing.firstSeenAt;
        if (ageMs < this.config.maxWallAgeSec * 1000) {
          existing.cancellations++;
          this.checkRapidCancelPattern(existing, ageMs);
        }
        existing.lastSeenAt = Date.now();
      }
    }

    if (event === 'FILLED') {
      // Wall was filled — check if it was legitimate or part of wash trading
      const existing = this.wallHistory.get(key);
      if (existing) {
        this.checkWashTradingPattern(existing);
        // Clean up after fill
        this.cleanupOldEntries();
      }
    }

    // Clean up old history periodically
    this.cleanupOldEntries();
  }

  // Get wall key
  private getWallKey(wall: DetectedWall): string {
    return `${wall.exchange}:${wall.marketType}:${wall.symbol}:${wall.side}:${wall.price.toFixed(4)}`;
  }

  // Check rapid cancel pattern
  private checkRapidCancelPattern(entry: WallHistoryEntry, ageMs: number): void {
    if (entry.wasSpoofed) return;

    const ageSec = ageMs / 1000;
    if (ageSec < this.config.maxWallAgeSec && entry.cancellations >= this.config.cancelThreshold) {
      const confidence = Math.min(85, 50 + (entry.cancellations * 10));
      if (confidence >= this.config.minConfidence) {
        const alert: SpoofingAlert = {
          wallId: entry.wallId,
          symbol: entry.symbol,
          exchange: entry.exchange,
          marketType: entry.marketType,
          side: entry.side,
          price: entry.price,
          volumeUsd: entry.volumeUsd,
          pattern: 'RAPID_CANCEL',
          confidence,
          timestamp: Date.now(),
          details: `Wall canceled ${entry.cancellations} times within ${ageSec.toFixed(1)}s — strong spoofing indicator`,
        };
        this.emitAlert(alert);
        entry.wasSpoofed = true;
      }
    }
  }

  // Check reappearing pattern
  private checkReappearingPattern(entry: WallHistoryEntry): void {
    if (entry.wasSpoofed) return;

    const now = Date.now();
    const windowMs = this.config.detectionWindowMs;

    if (entry.appearances >= this.config.reappearThreshold) {
      // Check if appearances are within the detection window
      const firstAppearance = entry.firstSeenAt;
      if (now - firstAppearance < windowMs) {
        const confidence = Math.min(80, 40 + (entry.appearances * 15));
        if (confidence >= this.config.minConfidence) {
          const alert: SpoofingAlert = {
            wallId: entry.wallId,
            symbol: entry.symbol,
            exchange: entry.exchange,
            marketType: entry.marketType,
            side: entry.side,
            price: entry.price,
            volumeUsd: entry.volumeUsd,
            pattern: 'REAPPEARING',
            confidence,
            timestamp: now,
            details: `Wall reappeared ${entry.appearances} times within ${(windowMs / 1000).toFixed(0)}s — potential spoofing`,
          };
          this.emitAlert(alert);
          entry.wasSpoofed = true;
        }
      }
    }
  }

  // Check wash trading pattern
  private checkWashTradingPattern(entry: WallHistoryEntry): void {
    if (entry.wasSpoofed) return;

    // If a wall was filled and then reappeared shortly after, it's suspicious
    // This is implemented via the reappearing pattern detection after fill events
    // Additional logic can be added for more sophisticated wash trading detection.
  }

  // Check layer stacking
  public checkLayerStacking(
    walls: DetectedWall[],
    exchange: ExchangeId,
    marketType: MarketType,
    symbol: string
  ): void {
    // Group walls by exchange + symbol
    const targetWalls = walls.filter(
      w => w.exchange === exchange && w.marketType === marketType && w.symbol === symbol
    );

    if (targetWalls.length < 3) return;

    // Sort by price
    const sorted = [...targetWalls].sort((a, b) => a.price - b.price);

    // Check for equidistant walls (spoofing pattern: fake depth)
    const distances: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      distances.push(sorted[i].price - sorted[i-1].price);
    }

    // If most distances are within 0.1%, it might be a spoofing layer stack
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const isUniform = distances.every(d => Math.abs(d - avgDist) / avgDist < 0.1);

    if (isUniform && targetWalls.length >= 3) {
      const totalVol = targetWalls.reduce((sum, w) => sum + w.volumeUsd, 0);
      if (totalVol >= this.config.minVolumeUsd * 2) {
        const alert: SpoofingAlert = {
          wallId: `layer_${exchange}_${symbol}_${Date.now()}`,
          symbol,
          exchange,
          marketType,
          side: 'BID', // Could be BID or ASK
          price: sorted[0].price,
          volumeUsd: totalVol,
          pattern: 'LAYER_STACK',
          confidence: 65,
          timestamp: Date.now(),
          details: `Detected ${targetWalls.length} uniformly spaced walls — possible layering spoof`,
        };
        this.emitAlert(alert);
      }
    }
  }

  // Emit alert
  private emitAlert(alert: SpoofingAlert): void {
    // Don't emit duplicate alerts for the same wall within 5 minutes
    const duplicate = this.spoofAlerts.some(
      a => a.wallId === alert.wallId && (Date.now() - a.timestamp) < 5 * 60 * 1000
    );
    if (duplicate) return;

    this.spoofAlerts.push(alert);
    this.listeners.forEach(l => l(alert));
  }

  // Get spoof alerts
  public getSpoofAlerts(limit = 100): SpoofingAlert[] {
    return [...this.spoofAlerts]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Clear old alerts
  public clearOldAlerts(olderThanMs = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    this.spoofAlerts = this.spoofAlerts.filter(a => a.timestamp >= cutoff);
  }

  // Cleanup old entries
  private cleanupOldEntries(): void {
    const cutoff = Date.now() - this.config.detectionWindowMs;
    for (const [key, entry] of this.wallHistory.entries()) {
      if (entry.lastSeenAt < cutoff) {
        this.wallHistory.delete(key);
      }
    }
  }
}