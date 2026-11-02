import { Quiz, Result, User } from '../types';
import { getQuizById, saveResult, addPointsToUser, deleteExamSession, verifyResultExists } from './storage';

export interface OfflineQuiz {
  quizId: string;
  studentId: string;
  downloadedAt: string;
  quiz: Quiz;
  sizeKb: number;
}

export interface OfflinePendingResult {
  id: string; // result.id
  studentId: string;
  quizId: string;
  quizTitle: string;
  result: Result;
  createdAt: string;
  syncAttempts: number;
  lastError?: string;
}

const DB_NAME = 'eduquiz_offline_db';
const DB_VERSION = 1;
const STORE_QUIZZES = 'offline_quizzes';
const STORE_RESULTS = 'offline_pending_results';

// Khởi tạo IndexedDB (với fallback tự động sang LocalStorage nếu trình duyệt chặn IndexedDB)
let dbPromise: Promise<IDBDatabase> | null = null;

const getIDB = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB không được hỗ trợ trên môi trường này"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_QUIZZES)) {
          db.createObjectStore(STORE_QUIZZES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_RESULTS)) {
          db.createObjectStore(STORE_RESULTS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

// Fallback LocalStorage Key prefixes
const LS_QUIZ_PREFIX = 'eduquiz_offline_q_';
const LS_RESULTS_KEY = 'eduquiz_offline_pending_results';

// Helper chuyển ảnh từ URL sang Data URL (Base64) để hiển thị 100% ngoại tuyến
const convertImageUrlToBase64 = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:')) return url;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timeout);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    // Nếu CORS chặn hoặc lỗi mạng, giữ nguyên link gốc
    return url;
  }
};

/**
 * Tải đề thi về máy để làm bài trong trạng thái ngoại tuyến hoàn toàn
 * - Tải đầy đủ câu hỏi, đáp án, lời giải, trọng tâm bài học
 * - Tự động nhúng Base64 cho các ảnh sơ đồ / đồ thị để hiển thị được khi không có mạng
 */
export const downloadQuizForOffline = async (
  quizId: string, 
  studentId: string,
  onProgress?: (statusText: string) => void
): Promise<{ success: boolean; quiz: Quiz; sizeKb: number; message?: string }> => {
  try {
    if (onProgress) onProgress("Đang tải dữ liệu câu hỏi từ máy chủ...");
    const fullQuiz = await getQuizById(quizId);
    if (!fullQuiz || !fullQuiz.questions || fullQuiz.questions.length === 0) {
      throw new Error("Không thể tải chi tiết câu hỏi của đề thi này");
    }

    if (onProgress) onProgress("Đang tối ưu hóa hình ảnh & công thức cho chế độ ngoại tuyến...");
    // Xử lý nén và lưu Base64 cho tất cả ảnh trong câu hỏi để đảm bảo hiển thị offline 100%
    const offlineQuestions = await Promise.all(
      fullQuiz.questions.map(async (q) => {
        let offlineQ = { ...q };
        const imgUrl = q.imageUrl || (q as any).image;
        if (imgUrl && typeof imgUrl === 'string' && !imgUrl.startsWith('data:')) {
          try {
            offlineQ.imageUrl = await convertImageUrlToBase64(imgUrl);
            (offlineQ as any).image = offlineQ.imageUrl;
          } catch (e) {}
        }
        if (Array.isArray(q.options)) {
          offlineQ.options = await Promise.all(
            q.options.map(async (opt) => {
              if (typeof opt === 'string' && (opt.startsWith('http://') || opt.startsWith('https://')) && (opt.includes('.png') || opt.includes('.jpg') || opt.includes('.jpeg') || opt.includes('.svg') || opt.includes('ibb.co'))) {
                try {
                  return await convertImageUrlToBase64(opt);
                } catch (e) {
                  return opt;
                }
              }
              return opt;
            })
          );
        }
        return offlineQ;
      })
    );

    const offlineQuizData: Quiz = {
      ...fullQuiz,
      questions: offlineQuestions,
      questionCount: offlineQuestions.length
    };

    const jsonStr = JSON.stringify(offlineQuizData);
    const sizeKb = Math.round((new Blob([jsonStr]).size / 1024) * 10) / 10;

    const record: OfflineQuiz = {
      quizId,
      studentId,
      downloadedAt: new Date().toISOString(),
      quiz: offlineQuizData,
      sizeKb
    };

    const key = `${studentId}_${quizId}`;

    // Lưu vào IndexedDB
    try {
      const db = await getIDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_QUIZZES, 'readwrite');
        const store = tx.objectStore(STORE_QUIZZES);
        const req = store.put({ key, ...record });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (idbErr) {
      // Fallback LocalStorage
      try {
        localStorage.setItem(`${LS_QUIZ_PREFIX}${key}`, JSON.stringify(record));
      } catch (lsErr) {
        throw new Error("Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt đề thi ngoại tuyến cũ.");
      }
    }

    if (onProgress) onProgress("Hoàn tất tải về!");
    return { success: true, quiz: offlineQuizData, sizeKb };
  } catch (error: any) {
    console.error("Lỗi tải đề thi ngoại tuyến:", error);
    return { success: false, quiz: null as any, sizeKb: 0, message: error.message || "Lỗi tải đề thi" };
  }
};

/**
 * Lấy danh sách tất cả các đề thi đã tải về máy của học sinh này
 */
export const getOfflineQuizzes = async (studentId: string): Promise<OfflineQuiz[]> => {
  const result: OfflineQuiz[] = [];
  try {
    const db = await getIDB();
    const rows = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZZES, 'readonly');
      const store = tx.objectStore(STORE_QUIZZES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    rows.forEach(r => {
      if (r && r.studentId === studentId) {
        result.push(r);
      }
    });
  } catch (e) {
    // Fallback LocalStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${LS_QUIZ_PREFIX}${studentId}_`)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            result.push(parsed);
          }
        }
      }
    } catch (err) {}
  }

  // Sắp xếp đề tải gần nhất lên trước
  return result.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
};

/**
 * Kiểm tra xem một đề thi đã được tải về máy chưa
 */
export const isQuizDownloaded = async (quizId: string, studentId: string): Promise<boolean> => {
  const key = `${studentId}_${quizId}`;
  try {
    const db = await getIDB();
    const exists = await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_QUIZZES, 'readonly');
      const store = tx.objectStore(STORE_QUIZZES);
      const req = store.get(key);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
    if (exists) return true;
  } catch (e) {}

  // Kiểm tra fallback LocalStorage
  return Boolean(localStorage.getItem(`${LS_QUIZ_PREFIX}${key}`));
};

/**
 * Lấy chi tiết đề thi đã lưu ngoại tuyến
 */
export const getOfflineQuizById = async (quizId: string, studentId: string): Promise<Quiz | null> => {
  const key = `${studentId}_${quizId}`;
  try {
    const db = await getIDB();
    const item = await new Promise<any>((resolve) => {
      const tx = db.transaction(STORE_QUIZZES, 'readonly');
      const store = tx.objectStore(STORE_QUIZZES);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (item && item.quiz) return item.quiz as Quiz;
  } catch (e) {}

  // Fallback LocalStorage
  try {
    const raw = localStorage.getItem(`${LS_QUIZ_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.quiz as Quiz;
    }
  } catch (e) {}

  return null;
};

/**
 * Xóa đề thi đã tải ngoại tuyến khỏi máy để giải phóng dung lượng
 */
export const deleteOfflineQuiz = async (quizId: string, studentId: string): Promise<void> => {
  const key = `${studentId}_${quizId}`;
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUIZZES, 'readwrite');
      const store = tx.objectStore(STORE_QUIZZES);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {}

  try {
    localStorage.removeItem(`${LS_QUIZ_PREFIX}${key}`);
  } catch (e) {}
};

/**
 * Lưu kết quả thi làm trong trạng thái ngoại tuyến vào hàng đợi đồng bộ
 */
export const saveOfflinePendingResult = async (result: Result, quizTitle: string): Promise<void> => {
  const pendingRecord: OfflinePendingResult = {
    id: result.id,
    studentId: result.studentId,
    quizId: result.quizId,
    quizTitle: quizTitle || 'Đề thi ngoại tuyến',
    result: { ...result, isOfflineSubmitted: true } as any,
    createdAt: new Date().toISOString(),
    syncAttempts: 0
  };

  // 1. Thử lưu vào IndexedDB
  let savedInIdb = false;
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.put(pendingRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    savedInIdb = true;
  } catch (e) {
    console.warn("Không thể lưu pending result vào IndexedDB, chuyển sang LocalStorage:", e);
  }

  // 2. Đồng thời luôn backup một bản vào LocalStorage để đảm bảo 100% không mất dữ liệu
  try {
    const existingRaw = localStorage.getItem(LS_RESULTS_KEY);
    const list: OfflinePendingResult[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = list.filter(item => item.id !== result.id);
    filtered.push(pendingRecord);
    localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(filtered));
  } catch (lsErr) {
    if (!savedInIdb) {
      console.error("Lỗi nghiêm trọng: Cả IndexedDB và LocalStorage đều không lưu được pending result", lsErr);
    }
  }

  // Thông báo sự kiện cho toàn bộ app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eduquiz:offline_pending_changed'));
  }
};

/**
 * Lấy danh sách kết quả đang chờ đồng bộ lên máy chủ
 */
export const getOfflinePendingResults = async (studentId?: string): Promise<OfflinePendingResult[]> => {
  const map = new Map<string, OfflinePendingResult>();

  // 1. Đọc từ IndexedDB
  try {
    const db = await getIDB();
    const rows = await new Promise<OfflinePendingResult[]>((resolve) => {
      const tx = db.transaction(STORE_RESULTS, 'readonly');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    rows.forEach(r => {
      if (r && r.id) map.set(r.id, r);
    });
  } catch (e) {}

  // 2. Đọc từ LocalStorage gộp vào
  try {
    const raw = localStorage.getItem(LS_RESULTS_KEY);
    if (raw) {
      const list: OfflinePendingResult[] = JSON.parse(raw);
      list.forEach(r => {
        if (r && r.id && !map.has(r.id)) map.set(r.id, r);
      });
    }
  } catch (e) {}

  let all = Array.from(map.values());
  if (studentId) {
    all = all.filter(r => r.studentId === studentId);
  }
  return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

/**
 * Xóa một kết quả khỏi hàng đợi sau khi đã đồng bộ thành công lên máy chủ
 */
export const removeOfflinePendingResult = async (resultId: string): Promise<void> => {
  try {
    const db = await getIDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_RESULTS, 'readwrite');
      const store = tx.objectStore(STORE_RESULTS);
      const req = store.delete(resultId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (e) {}

  try {
    const raw = localStorage.getItem(LS_RESULTS_KEY);
    if (raw) {
      const list: OfflinePendingResult[] = JSON.parse(raw);
      const filtered = list.filter(r => r.id !== resultId);
      localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eduquiz:offline_pending_changed'));
  }
};

/**
 * Tự động đồng bộ tất cả các kết quả làm bài ngoại tuyến lên máy chủ Supabase khi có mạng
 */
export const syncOfflinePendingResults = async (
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; failed: number; errors: string[] }> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0, errors: ["Thiết bị vẫn đang ở trạng thái ngoại tuyến"] };
  }

  const pendingList = await getOfflinePendingResults();
  if (pendingList.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < pendingList.length; i++) {
    const item = pendingList[i];
    try {
      // 1. Kiểm tra xem kết quả này đã vô tình được lưu trên Supabase trước đó chưa (tránh trùng)
      const alreadySaved = await verifyResultExists(item.result.id);
      if (!alreadySaved) {
        await saveResult(item.result);
      }

      // 2. Cộng điểm thưởng / điểm tích lũy cho học sinh
      try {
        await addPointsToUser(item.studentId, item.result.score);
      } catch (e) {}

      // 3. Xóa session thi treo nếu có
      try {
        await deleteExamSession(`sess_${item.studentId}_${item.quizId}`);
      } catch (e) {}

      // 4. Xóa khỏi hàng đợi sau khi đồng bộ thành công 100%
      await removeOfflinePendingResult(item.id);
      syncedCount++;

      if (onProgress) {
        onProgress(syncedCount, pendingList.length);
      }
    } catch (err: any) {
      failedCount++;
      const errMsg = err?.message || 'Lỗi mạng khi đồng bộ';
      errors.push(`Đề "${item.quizTitle}": ${errMsg}`);
      console.warn(`Đồng bộ thất bại cho bài ${item.id}:`, err);
    }
  }

  if (syncedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eduquiz:offline_synced', {
      detail: { syncedCount, total: pendingList.length }
    }));
  }

  return { synced: syncedCount, failed: failedCount, errors };
};

/**
 * Thống kê bộ nhớ ngoại tuyến của học sinh
 */
export const getOfflineStorageStats = async (studentId: string): Promise<{
  downloadedCount: number;
  pendingCount: number;
  totalSizeKb: number;
}> => {
  const quizzes = await getOfflineQuizzes(studentId);
  const pending = await getOfflinePendingResults(studentId);
  const totalSize = quizzes.reduce((sum, q) => sum + (q.sizeKb || 0), 0);
  return {
    downloadedCount: quizzes.length,
    pendingCount: pending.length,
    totalSizeKb: Math.round(totalSize * 10) / 10
  };
};
