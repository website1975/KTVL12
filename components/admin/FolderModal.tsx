import React, { useState, useEffect } from 'react';
import { QuizFolder, Chapter, Grade } from '../../types';
import { Folder, FolderPlus, X, Check, BookOpen, Palette, Tag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folder: QuizFolder) => Promise<void> | void;
  initialFolder?: QuizFolder | null;
  defaultChapterName?: string;
  defaultGrade?: Grade;
  chapters: Chapter[];
}

const FOLDER_COLORS = [
  { id: 'amber', label: 'Vàng cam', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-400', ring: 'ring-amber-400' },
  { id: 'blue', label: 'Xanh dương', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-400', ring: 'ring-blue-400' },
  { id: 'emerald', label: 'Xanh ngọc', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-400', ring: 'ring-emerald-400' },
  { id: 'purple', label: 'Tím hoa cà', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-400', ring: 'ring-purple-400' },
  { id: 'rose', label: 'Đỏ hồng', bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-400', ring: 'ring-rose-400' },
  { id: 'indigo', label: 'Chàm Indigo', bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-400', ring: 'ring-indigo-400' },
  { id: 'cyan', label: 'Xanh lục lam', bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-400', ring: 'ring-cyan-400' }
];

const SUGGESTED_NAMES = [
  'Đề củng cố Bài học',
  'Đề ôn chương',
  'Đề tổng hợp kiến thức',
  'Đề kiểm tra định kỳ',
  'Đề nâng cao - Vận dụng cao',
  'Đề thi thử học kỳ'
];

export default function FolderModal({
  isOpen,
  onClose,
  onSave,
  initialFolder,
  defaultChapterName,
  defaultGrade = '12',
  chapters
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [chapterName, setChapterName] = useState('');
  const [color, setColor] = useState('amber');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialFolder) {
        setName(initialFolder.name);
        setGrade(initialFolder.grade || '12');
        setChapterName(initialFolder.chapterName || '');
        setColor(initialFolder.color || 'amber');
        setDescription(initialFolder.description || '');
      } else {
        setName('');
        setGrade(defaultGrade);
        setChapterName(defaultChapterName || (chapters[0]?.name || ''));
        setColor('amber');
        setDescription('');
      }
    }
  }, [isOpen, initialFolder, defaultChapterName, defaultGrade, chapters]);

  if (!isOpen) return null;

  const relevantChapters = chapters.filter(c => grade === 'all' || String(c.grade) === String(grade));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Vui lòng nhập tên thư mục!');
      return;
    }
    if (!chapterName.trim()) {
      alert('Vui lòng chọn hoặc nhập tên chương học cho thư mục này!');
      return;
    }

    setIsSaving(true);
    try {
      const selectedChapter = chapters.find(c => c.name === chapterName);
      const folderData: QuizFolder = {
        id: initialFolder?.id || uuidv4(),
        name: name.trim(),
        chapterId: selectedChapter?.id,
        chapterName: chapterName.trim(),
        grade,
        color,
        description: description.trim(),
        createdAt: initialFolder?.createdAt || new Date().toISOString()
      };
      await onSave(folderData);
      onClose();
    } catch (err: any) {
      alert('Lỗi lưu thư mục: ' + (err.message || 'Không xác định'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <FolderPlus size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {initialFolder ? 'Chỉnh sửa Thư mục đề thi' : 'Tạo Thư mục đề thi mới'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Phân loại và gom nhóm các đề thi trong từng Chương học
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Tên Thư mục */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Folder size={14} className="text-amber-500" /> Tên Thư mục đề thi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Đề củng cố Bài học, Đề ôn chương, Đề tổng hợp..."
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-amber-500 outline-none transition-all"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {/* Gợi ý tên nhanh */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTED_NAMES.map(sug => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setName(sug)}
                  className="text-[10px] font-bold px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Chọn Khối & Chương học cha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Khối lớp
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none"
                value={grade}
                onChange={e => {
                  const g = e.target.value as Grade;
                  setGrade(g);
                  const newChapters = chapters.filter(c => g === 'all' || String(c.grade) === String(g));
                  if (newChapters.length > 0 && !newChapters.some(c => c.name === chapterName)) {
                    setChapterName(newChapters[0].name);
                  }
                }}
              >
                <option value="12">Khối 12</option>
                <option value="11">Khối 11</option>
                <option value="10">Khối 10</option>
                <option value="all">Dùng chung tất cả</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <BookOpen size={14} className="text-blue-500" /> Thuộc Chương học <span className="text-rose-500">*</span>
              </label>
              <select
                required
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:border-amber-500 outline-none"
                value={chapterName}
                onChange={e => setChapterName(e.target.value)}
              >
                <option value="">-- Chọn chương học --</option>
                {relevantChapters.map(ch => (
                  <option key={ch.id} value={ch.name}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Màu sắc đại diện */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Palette size={14} className="text-purple-500" /> Màu sắc đại diện thư mục
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {FOLDER_COLORS.map(c => {
                const isSelected = color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? `border-slate-800 bg-slate-50 ring-2 ${c.ring}`
                        : 'border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl ${c.bg} flex items-center justify-center text-white shadow-sm`}>
                      {isSelected ? <Check size={14} /> : <Folder size={14} />}
                    </div>
                    <span className="text-[9px] font-black text-slate-600 truncate w-full text-center">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ghi chú mô tả thêm */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag size={14} className="text-slate-400" /> Ghi chú thư mục (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="VD: Tập hợp các đề rèn luyện 15 phút sau mỗi bài giảng..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:bg-white focus:border-amber-500 outline-none"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2"
            >
              {isSaving ? 'Đang lưu...' : initialFolder ? 'Lưu thay đổi' : 'Tạo thư mục'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
