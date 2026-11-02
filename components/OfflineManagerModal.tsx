import React, { useState, useEffect } from 'react';
import { Quiz, User } from '../types';
import { 
  getOfflineQuizzes, 
  deleteOfflineQuiz, 
  getOfflinePendingResults, 
  removeOfflinePendingResult,
  OfflineQuiz, 
  OfflinePendingResult 
} from '../services/offlineStorage';
import { 
  CloudOff, CloudCheck, Wifi, WifiOff, RefreshCw, Trash2, Play, 
  Clock, CheckCircle2, AlertTriangle, FileText, HardDrive, X, Sparkles, Send
} from 'lucide-react';
import { format } from 'date-fns';

interface OfflineManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onStartQuiz: (quiz: Quiz) => void;
  onManualSync: () => Promise<any>;
  isSyncing: boolean;
  isOnline: boolean;
}

export default function OfflineManagerModal({
  isOpen,
  onClose,
  user,
  onStartQuiz,
  onManualSync,
  isSyncing,
  isOnline
}: OfflineManagerModalProps) {
  const [offlineQuizzes, setOfflineQuizzes] = useState<OfflineQuiz[]>([]);
  const [pendingResults, setPendingResults] = useState<OfflinePendingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'quizzes' | 'pending'>('quizzes');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [quizzes, pending] = await Promise.all([
        getOfflineQuizzes(user.id),
        getOfflinePendingResults(user.id)
      ]);
      setOfflineQuizzes(quizzes);
      setPendingResults(pending);
    } catch (e) {
      console.error("Lỗi nạp dữ liệu offline:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, user.id]);

  if (!isOpen) return null;

  const totalSizeKb = offlineQuizzes.reduce((sum, q) => sum + (q.sizeKb || 0), 0);

  const handleDeleteQuiz = async (quizId: string, title: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa đề "${title}" khỏi bộ nhớ ngoại tuyến?`)) {
      await deleteOfflineQuiz(quizId, user.id);
      loadData();
    }
  };

  const handleClearAllQuizzes = async () => {
    if (confirm("Bạn có chắc chắn muốn xóa TẤT CẢ các đề thi ngoại tuyến đã lưu trên máy?")) {
      for (const q of offlineQuizzes) {
        await deleteOfflineQuiz(q.quizId, user.id);
      }
      loadData();
    }
  };

  const handleSyncClick = async () => {
    await onManualSync();
    loadData();
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 sm:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
              isOnline ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {isOnline ? <Wifi size={24} /> : <WifiOff size={24} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black uppercase tracking-tight">Trung Tâm Ngoại Tuyến & Đồng Bộ</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1 ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Quản lý các đề thi đã tải về máy và hàng đợi đồng bộ điểm số
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-colors relative z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Storage Quick Stats Bar */}
        <div className="p-4 sm:px-8 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-blue-600" />
              <span className="text-slate-500 font-medium">Dung lượng máy:</span>
              <strong className="text-slate-800 font-black">
                {totalSizeKb > 1024 ? `${(totalSizeKb / 1024).toFixed(1)} MB` : `${totalSizeKb.toFixed(1)} KB`}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <FileText size={16} className="text-purple-600" />
              <span className="text-slate-500 font-medium">Đề đã tải:</span>
              <strong className="text-purple-700 font-black">{offlineQuizzes.length} đề</strong>
            </div>

            {pendingResults.length > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-slate-500 font-medium">Chờ đồng bộ:</span>
                <strong className="text-amber-600 font-black">{pendingResults.length} bài</strong>
              </div>
            )}
          </div>

          {isOnline && pendingResults.length > 0 && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Đang đồng bộ...' : `Đồng bộ ngay (${pendingResults.length})`}
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="px-6 sm:px-8 pt-4 flex items-center gap-2 border-b border-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`pb-3 px-3 text-xs font-black uppercase transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'quizzes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <CloudCheck size={14} />
            <span>Đề thi đã tải về máy ({offlineQuizzes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-3 text-xs font-black uppercase transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Send size={14} />
            <span>Kết quả chờ đồng bộ ({pendingResults.length})</span>
            {pendingResults.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 custom-scrollbar">
          {activeTab === 'quizzes' ? (
            <>
              {offlineQuizzes.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-500 mx-auto flex items-center justify-center">
                    <CloudOff size={32} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 uppercase">Chưa có đề thi nào được tải về máy</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                    Bạn có thể nhấn nút "Tải về máy" ở bất kỳ đề thi nào ngoài bảng điều khiển để làm bài khi không có kết nối mạng.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Danh sách {offlineQuizzes.length} đề thi sẵn sàng làm bài offline:
                    </span>
                    <button
                      onClick={handleClearAllQuizzes}
                      className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Xóa tất cả
                    </button>
                  </div>

                  {offlineQuizzes.map((item) => {
                    const q = item.quiz;
                    return (
                      <div
                        key={item.quizId}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:border-blue-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black uppercase flex items-center gap-1">
                              <CheckCircle2 size={10} /> Đã tải về máy
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">
                              {q.durationMinutes} phút • {q.questions?.length || q.questionCount || 0} câu
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              • {item.sizeKb.toFixed(1)} KB
                            </span>
                          </div>
                          <h4 className="text-sm font-black text-slate-800 uppercase leading-snug truncate">
                            {q.title}
                          </h4>
                          <p className="text-[9px] text-slate-400 font-medium">
                            Tải về lúc: {format(new Date(item.downloadedAt), 'HH:mm - dd/MM/yyyy')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              onClose();
                              onStartQuiz(q);
                            }}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            <Play size={12} /> Làm bài ngay
                          </button>
                          <button
                            onClick={() => handleDeleteQuiz(item.quizId, q.title)}
                            title="Xóa đề này khỏi bộ nhớ ngoại tuyến"
                            className="p-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors border border-slate-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {pendingResults.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                    <CloudCheck size={32} />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 uppercase">Tất cả bài thi đã được đồng bộ 100%</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                    Không có bài thi nào đang chờ đồng bộ. Mọi kết quả nộp bài khi có mạng đều đã được lưu an toàn trên máy chủ.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>Các bài thi này được nộp khi mất mạng và sẽ được tự động đồng bộ ngay khi thiết bị kết nối lại.</span>
                    </div>
                  </div>

                  {pendingResults.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-4 border border-amber-200 shadow-sm flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[8px] font-black uppercase flex items-center gap-1">
                            <Clock size={10} /> Chờ đồng bộ
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Nộp lúc: {format(new Date(item.createdAt), 'HH:mm dd/MM/yyyy')}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 uppercase truncate">
                          {item.quizTitle}
                        </h4>
                        <div className="text-[10px] text-slate-600 font-medium">
                          Điểm số: <strong className="text-emerald-600 font-black">{item.result.score.toFixed(2)}đ</strong>
                          {' • '}Thời gian làm: {Math.floor((item.result.durationSeconds || 0) / 60)} phút
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-emerald-600 block">
                          {item.result.score.toFixed(1)}đ
                        </span>
                        <span className="text-[8px] font-black uppercase text-slate-400">Đã chốt điểm</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
          <p className="text-[10px] text-slate-500 font-medium hidden sm:block">
            ⚡ Hệ thống tự động đồng bộ ngầm khi thiết bị có mạng (Wifi/4G)
          </p>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all ml-auto"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
}
