import React from 'react';
import { 
  X, DatabaseZap, Zap, RefreshCw, CheckCircle2, 
  AlertCircle, Sparkles, Layers, Flag, ArrowRight, Loader2, ShieldCheck
} from 'lucide-react';
import { Quiz } from '../../types';

interface SyncBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSync: (forceAll: boolean) => void;
  isSyncing: boolean;
  quizzes: Quiz[];
}

export default function SyncBankModal({
  isOpen,
  onClose,
  onSync,
  isSyncing,
  quizzes
}: SyncBankModalProps) {
  if (!isOpen) return null;

  // Đếm số lượng đề thi chưa đồng bộ / có gắn cờ (chưa gắn cờ isSyncedToBank = true)
  const pendingCount = quizzes.filter(q => !q.isSyncedToBank).length;
  const totalCount = quizzes.length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[4500] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="bg-[#0f172a] text-white px-6 py-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <DatabaseZap size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white">
                  CẬP NHẬT CÂU HỎI TỪ ĐỀ THI
                </h3>
                <span className="bg-blue-900/70 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  2 LỰA CHỌN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Đồng bộ và khử trùng lặp câu hỏi từ các đề thi vào Ngân hàng câu hỏi
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Đóng cửa sổ"
          >
            <X size={22} />
          </button>
        </div>

        {/* THÔNG TIN TỔNG QUAN */}
        <div className="bg-slate-100/80 px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-slate-500" />
            <span>Tổng số đề thi: <strong className="text-slate-900">{totalCount} đề</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Đang chờ quét (mới / sửa): <strong className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">{pendingCount} đề</strong></span>
          </div>
        </div>

        {/* NỘI DUNG CHỌN PHƯƠNG THỨC */}
        <div className="p-6 space-y-4 overflow-y-auto">
          
          {/* LỰA CHỌN 1: QUÉT ĐỀ CÓ CỜ (MỚI / SỬA) */}
          <div 
            onClick={() => !isSyncing && onSync(false)}
            className={`group relative p-5 rounded-3xl border-2 transition-all cursor-pointer ${
              isSyncing 
                ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50' 
                : 'border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Lựa chọn 1: Quét các đề có gắn cờ (Tạo mới & Đã sửa)
                    </h4>
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Khuyên dùng • Siêu nhanh
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Chỉ quét qua các đề thi vừa được thêm mới hoặc vừa chỉnh sửa câu hỏi gần đây (<code className="text-blue-700 font-bold bg-blue-100/70 px-1 py-0.5 rounded">isSyncedToBank = false</code>).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-blue-100/80 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Tự động khử trùng lặp và bổ sung lời giải, mức độ vào Ngân hàng</span>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 group-hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-md shadow-blue-500/20 transition-all shrink-0 active:scale-95"
              >
                {isSyncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                <span>QUÉT ĐỀ CÓ CỜ</span>
              </button>
            </div>
          </div>

          {/* LỰA CHỌN 2: QUÉT TOÀN BỘ TẤT CẢ ĐỀ THI */}
          <div 
            onClick={() => !isSyncing && onSync(true)}
            className={`group relative p-5 rounded-3xl border-2 transition-all cursor-pointer ${
              isSyncing 
                ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50' 
                : 'border-purple-200 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50 hover:shadow-lg hover:-translate-y-0.5'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Lựa chọn 2: Quét toàn bộ tất cả đề thi (Quét lại từ đầu)
                    </h4>
                    <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      Toàn diện • 100% Đề
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                    Quét duyệt qua toàn bộ {totalCount} đề thi trong cơ sở dữ liệu (bất kể cờ đồng bộ), rà soát khử trùng lặp và làm giàu thông tin cho tất cả câu hỏi.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-purple-100/80 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                <Sparkles size={14} className="text-purple-600 shrink-0" />
                <span>Dùng khi phòng trường hợp gắn cờ bị sót hoặc muốn làm mới toàn diện</span>
              </div>
              <button
                type="button"
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 group-hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase shadow-md shadow-purple-500/20 transition-all shrink-0 active:scale-95"
              >
                {isSyncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>QUÉT HẾT TẤT CẢ</span>
              </button>
            </div>
          </div>

          {/* TRẠNG THÁI ĐANG THỰC THI */}
          {isSyncing && (
            <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-3 text-xs font-bold animate-pulse">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span>Đang quét dữ liệu từ máy chủ và cập nhật vào Ngân hàng câu hỏi, vui lòng chờ trong giây lát...</span>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase border border-slate-300 transition-all active:scale-95 disabled:opacity-50"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
}
