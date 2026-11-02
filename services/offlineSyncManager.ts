import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  syncOfflinePendingResults, 
  getOfflinePendingResults, 
  getOfflineStorageStats,
  OfflinePendingResult
} from './offlineStorage';

class OfflineSyncManager {
  private isSyncing = false;
  private intervalId: any = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      window.addEventListener('eduquiz:offline_pending_changed', this.notifyListeners);

      // Định kỳ kiểm tra đồng bộ ngầm mỗi 25 giây nếu thiết bị đang trực tuyến
      this.intervalId = setInterval(() => {
        if (navigator.onLine && !this.isSyncing) {
          this.triggerAutoSync();
        }
      }, 25000);

      // Thử đồng bộ ngay khi app khởi động (nếu có mạng)
      if (navigator.onLine) {
        setTimeout(() => this.triggerAutoSync(), 3000);
      }
    }
  }

  private handleOnline = () => {
    console.log("🌐 Thiết bị đã kết nối mạng trở lại! Đang bắt đầu tự động đồng bộ kết quả thi...");
    this.notifyListeners();
    this.triggerAutoSync();
  };

  private handleOffline = () => {
    console.log("📶 Thiết bị chuyển sang trạng thái ngoại tuyến.");
    this.notifyListeners();
  };

  public subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };

  private notifyListeners = () => {
    this.listeners.forEach(cb => {
      try { cb(); } catch (e) {}
    });
  };

  public triggerAutoSync = async (): Promise<{ synced: number; failed: number; errors: string[] }> => {
    if (this.isSyncing || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { synced: 0, failed: 0, errors: [] };
    }

    try {
      this.isSyncing = true;
      this.notifyListeners();
      const res = await syncOfflinePendingResults();
      if (res.synced > 0) {
        console.log(`✅ Đã tự động đồng bộ thành công ${res.synced} bài thi ngoại tuyến lên máy chủ!`);
      }
      return res;
    } catch (e: any) {
      console.warn("Lỗi auto sync:", e);
      return { synced: 0, failed: 0, errors: [e?.message || 'Lỗi'] };
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  };

  public getIsSyncing = () => this.isSyncing;
}

export const offlineSyncManager = new OfflineSyncManager();

/**
 * Hook React giúp các component (StudentDashboard, QuizTaker, Header)
 * theo dõi trạng thái mạng, số bài chờ đồng bộ, và kích hoạt đồng bộ thủ công
 */
export function useOfflineSync(studentId?: string) {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(() => offlineSyncManager.getIsSyncing());
  const [pendingResults, setPendingResults] = useState<OfflinePendingResult[]>([]);
  const [stats, setStats] = useState<{ downloadedCount: number; pendingCount: number; totalSizeKb: number }>({
    downloadedCount: 0,
    pendingCount: 0,
    totalSizeKb: 0
  });
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    if (!studentId) return;
    try {
      const pending = await getOfflinePendingResults(studentId);
      const s = await getOfflineStorageStats(studentId);
      setPendingResults(pending);
      setStats(s);
    } catch (e) {}
  }, [studentId]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = offlineSyncManager.subscribe(() => {
      setIsSyncing(offlineSyncManager.getIsSyncing());
      refreshStats();
    });

    // Lắng nghe sự kiện đồng bộ thành công để hiển thị toast
    const handleSyncedEvent = (e: any) => {
      const detail = e.detail;
      if (detail && detail.syncedCount > 0) {
        setSyncFeedback(`Đã tự động đồng bộ thành công ${detail.syncedCount} bài thi lên máy chủ!`);
        setTimeout(() => setSyncFeedback(null), 6000);
      }
    };
    window.addEventListener('eduquiz:offline_synced', handleSyncedEvent);

    refreshStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('eduquiz:offline_synced', handleSyncedEvent);
      unsubscribe();
    };
  }, [refreshStats]);

  const manualSync = useCallback(async () => {
    if (!navigator.onLine) {
      alert("Thiết bị đang không có kết nối Internet. Vui lòng bật Wifi hoặc 4G rồi thử lại.");
      return { synced: 0, failed: 0 };
    }
    const res = await offlineSyncManager.triggerAutoSync();
    await refreshStats();
    if (res.synced > 0) {
      setSyncFeedback(`Đã đồng bộ thành công ${res.synced} bài thi lên hệ thống!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } else if (res.failed > 0) {
      alert(`Đồng bộ thất bại: ${res.errors.join(', ')}`);
    } else {
      setSyncFeedback("Tất cả bài thi đã được đồng bộ mới nhất.");
      setTimeout(() => setSyncFeedback(null), 3000);
    }
    return res;
  }, [refreshStats]);

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingResults.length,
    pendingResults,
    downloadedCount: stats.downloadedCount,
    totalSizeKb: stats.totalSizeKb,
    syncFeedback,
    clearSyncFeedback: () => setSyncFeedback(null),
    refreshStats,
    manualSync
  };
}
