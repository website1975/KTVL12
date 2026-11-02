import React, { useState } from 'react';
import { X, ExternalLink, RefreshCw, Loader2, BookOpen, AlertCircle } from 'lucide-react';

interface LessonViewerModalProps {
  isOpen: boolean;
  lessonUrl: string;
  lessonTitle?: string;
  onClose: () => void;
}

export default function LessonViewerModal({
  isOpen,
  lessonUrl,
  lessonTitle = 'Bài học SGK liên quan',
  onClose
}: LessonViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (!isOpen || !lessonUrl) return null;

  const handleReload = () => {
    setIsLoading(true);
    setLoadError(false);
    setReloadKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(lessonUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[3500] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-inner">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider text-blue-100">
                  HỆ THỐNG HỌC TẬP
                </span>
                <span className="text-[10px] text-blue-200 truncate hidden sm:inline">
                  {lessonUrl}
                </span>
              </div>
              <h3 className="text-base font-black truncate tracking-tight text-white mt-0.5">
                {lessonTitle}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReload}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-bold flex items-center gap-1.5"
              title="Tải lại trang bài học"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden md:inline text-[11px]">Tải lại</span>
            </button>

            <button
              onClick={handleOpenExternal}
              className="px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="Mở toàn màn hình trong tab mới"
            >
              <ExternalLink size={15} />
              <span className="hidden sm:inline text-[11px]">Mở tab mới</span>
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-black/20 hover:bg-red-600 text-white transition-all ml-1"
              title="Đóng cửa sổ"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative bg-slate-50 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
                <Loader2 size={30} className="animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-slate-700 uppercase tracking-tight">
                  Đang tải bài học...
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đang kết nối đến hệ thống học tập
                </p>
              </div>
            </div>
          )}

          {loadError ? (
            <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <AlertCircle size={32} />
              </div>
              <h4 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                Không thể tải trực tiếp trong khung
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                Trang web này có thể chặn hiển thị nhúng bảo mật hoặc mạng kết nối chậm. Bạn có thể mở bài học trực tiếp ở tab mới.
              </p>
              <button
                onClick={handleOpenExternal}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg shadow-blue-500/30"
              >
                <ExternalLink size={16} /> Mở bài học ở tab mới
              </button>
            </div>
          ) : (
            <iframe
              key={reloadKey}
              src={lessonUrl}
              className="w-full h-full border-0"
              title={lessonTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError(true);
              }}
            />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
          <span className="font-medium text-slate-600 truncate">
            💡 Gợi ý: Học sinh có thể đọc toàn bộ ví dụ, lý thuyết mở rộng và thí nghiệm mô phỏng tại đây.
          </span>
          <button
            onClick={handleOpenExternal}
            className="text-blue-600 hover:underline font-bold shrink-0 ml-3 flex items-center gap-1"
          >
            Mở bài học gốc <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
