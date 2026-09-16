import React, { useState, useEffect, useMemo } from 'react';
import { QuizFolder, Chapter, Quiz } from '../../types';
import { Folder, FolderInput, X, Check, BookOpen, Layers, Plus, ChevronDown } from 'lucide-react';

interface FolderMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (folderId: string | undefined, folderName: string | undefined, chapterName?: string) => Promise<void>;
  quizzes: Quiz[];
  folders: QuizFolder[];
  chapters: Chapter[];
  currentChapterFilter?: string;
  onOpenCreateFolder?: (chapterName?: string) => void;
}

export default function FolderMoveModal({
  isOpen,
  onClose,
  onConfirm,
  quizzes,
  folders,
  chapters,
  currentChapterFilter,
  onOpenCreateFolder
}: FolderMoveModalProps) {
  // Xác định chương học đang làm việc
  const detectedInitialChapter = useMemo(() => {
    if (currentChapterFilter && currentChapterFilter !== 'all') {
      return currentChapterFilter;
    }
    if (quizzes.length > 0 && quizzes[0]?.category) {
      return quizzes[0].category;
    }
    if (chapters.length > 0) {
      return chapters[0].name;
    }
    return '';
  }, [currentChapterFilter, quizzes, chapters]);

  const [activeChapter, setActiveChapter] = useState<string>(detectedInitialChapter);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cập nhật lại khi modal mở lên hoặc danh sách đề thay đổi
  useEffect(() => {
    if (isOpen) {
      const initChapter = detectedInitialChapter;
      setActiveChapter(initChapter);
      
      // Nếu tất cả các đề đang chọn đều chung 1 folder thì default chọn folder đó
      if (quizzes.length === 1 && quizzes[0].folderId) {
        setSelectedFolderId(quizzes[0].folderId);
      } else {
        setSelectedFolderId('none');
      }
    }
  }, [isOpen, detectedInitialChapter, quizzes]);

  if (!isOpen || quizzes.length === 0) return null;

  // Lọc danh sách thư mục con thuộc đúng chương đang chọn
  const chapterFolders = folders.filter(
    f => f.chapterName === activeChapter || 
         (f.chapterId && chapters.find(c => c.name === activeChapter)?.id === f.chapterId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedFolderId === 'none') {
        // Chuyển về thư mục gốc của chương đang chọn
        await onConfirm(undefined, undefined, activeChapter || undefined);
      } else {
        const found = folders.find(f => f.id === selectedFolderId);
        if (found) {
          await onConfirm(found.id, found.name, found.chapterName || activeChapter);
        }
      }
      onClose();
    } catch (err: any) {
      alert('Lỗi khi chuyển thư mục: ' + (err.message || 'Không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <FolderInput size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Phân loại & Chuyển vào Thư mục
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Đang chọn: <span className="font-bold text-amber-600">{quizzes.length} đề thi</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Bộ chọn Chương học */}
          <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen size={13} className="text-blue-600" /> Chương học đích
              </span>
              <span className="text-[9px] font-bold text-slate-400">
                (Đổi chương nếu muốn chuyển sang chương khác)
              </span>
            </label>
            <div className="relative">
              <select
                value={activeChapter}
                onChange={(e) => {
                  setActiveChapter(e.target.value);
                  setSelectedFolderId('none');
                }}
                className="w-full bg-white border-2 border-slate-200 hover:border-blue-400 focus:border-blue-600 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 outline-none transition-all appearance-none cursor-pointer pr-10"
              >
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.name}>
                    {ch.name}
                  </option>
                ))}
                {!chapters.some(c => c.name === activeChapter) && activeChapter && (
                  <option value={activeChapter}>{activeChapter}</option>
                )}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="text-[11px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                <span>Chọn nơi lưu trữ trong chương:</span>
              </div>
              {onOpenCreateFolder && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCreateFolder(activeChapter);
                  }}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 flex items-center gap-1 uppercase transition-colors"
                >
                  <Plus size={13} /> Tạo folder con mới
                </button>
              )}
            </div>

            {/* TÙY CHỌN 1: THƯ MỤC GỐC CỦA CHƯƠNG ĐANG THAO TÁC */}
            <label
              className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedFolderId === 'none'
                  ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-2 ring-amber-400/30 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="folderSelection"
                value="none"
                checked={selectedFolderId === 'none'}
                onChange={() => setSelectedFolderId('none')}
                className="hidden"
              />
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 transition-colors ${
                selectedFolderId === 'none' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : 'bg-slate-100 text-slate-600'
              }`}>
                <Layers size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black truncate">
                  Thư mục gốc: {activeChapter || 'Chương học'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  Lưu đề thi tại mức gốc của chương <strong className="text-slate-700 font-bold">"{activeChapter || 'hiện tại'}"</strong> mà không xếp vào thư mục con
                </div>
              </div>
              {selectedFolderId === 'none' && (
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Check size={14} />
                </div>
              )}
            </label>

            {/* TÙY CHỌN 2: DANH SÁCH THƯ MỤC CON CỦA CHƯƠNG ĐANG CHỌN */}
            <div className="pt-2 space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-1">
                Các thư mục con ({chapterFolders.length})
              </div>

              {chapterFolders.length === 0 ? (
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-500">
                    Chương "{activeChapter}" chưa có thư mục con nào
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Bạn có thể chọn <strong>"Thư mục gốc"</strong> ở trên hoặc tạo thêm thư mục con mới.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chapterFolders.map(f => {
                    const isSelected = selectedFolderId === f.id;
                    const folderColorClass = f.color === 'blue' ? 'bg-blue-500' :
                                           f.color === 'emerald' ? 'bg-emerald-500' :
                                           f.color === 'purple' ? 'bg-purple-500' :
                                           f.color === 'rose' ? 'bg-rose-500' :
                                           f.color === 'cyan' ? 'bg-cyan-500' :
                                           f.color === 'indigo' ? 'bg-indigo-500' :
                                           'bg-amber-500';
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-3.5 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-black ring-2 ring-amber-400/30 shadow-sm'
                            : 'border-slate-100 hover:border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="folderSelection"
                          value={f.id}
                          checked={isSelected}
                          onChange={() => setSelectedFolderId(f.id)}
                          className="hidden"
                        />
                        <div className={`w-9 h-9 rounded-xl ${folderColorClass} text-white flex items-center justify-center shadow-sm shrink-0`}>
                          <Folder size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{f.name}</div>
                          {f.description ? (
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{f.description}</div>
                          ) : (
                            <div className="text-[10px] text-slate-400 mt-0.5">Thư mục con trong chương</div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                            <Check size={14} />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Đang chuyển...' : 'Xác nhận chuyển'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
