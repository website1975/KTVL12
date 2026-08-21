import React, { useState, useMemo } from 'react';
import { Quiz, ClassRoom, Grade } from '../../types';
import { X, GraduationCap, Globe, Check, Loader2, Search, AlertCircle, Building2 } from 'lucide-react';

interface QuickAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetQuizzes: Quiz[];
  classes: ClassRoom[];
  onSave: (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => Promise<void>;
}

export default function QuickAssignModal({
  isOpen,
  onClose,
  targetQuizzes,
  classes,
  onSave
}: QuickAssignModalProps) {
  if (!isOpen || targetQuizzes.length === 0) return null;

  const isSingle = targetQuizzes.length === 1;
  const singleQuiz = isSingle ? targetQuizzes[0] : null;

  // Khởi tạo targetType và assignedClassIds
  const [targetType, setTargetType] = useState<'all' | 'classes'>(() => {
    if (singleQuiz) {
      return singleQuiz.targetType === 'classes' ? 'classes' : 'all';
    }
    return 'classes'; // Khi gán hàng loạt đề cũ, thường người dùng muốn gom vào phòng tạm/lớp
  });

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(() => {
    if (singleQuiz && singleQuiz.assignedClassIds) {
      return [...singleQuiz.assignedClassIds];
    }
    return [];
  });

  const [classSearch, setClassSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>(() => {
    if (singleQuiz) return singleQuiz.grade;
    return 'all';
  });
  const [isSaving, setIsSaving] = useState(false);

  // Lọc danh sách lớp học
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const matchGrade = gradeFilter === 'all' || cls.grade === gradeFilter || cls.grade === 'all';
      const matchSearch = cls.name.toLowerCase().includes(classSearch.toLowerCase()) || 
                          (cls.academicYear && cls.academicYear.toLowerCase().includes(classSearch.toLowerCase())) ||
                          (cls.description && cls.description.toLowerCase().includes(classSearch.toLowerCase()));
      return matchGrade && matchSearch;
    });
  }, [classes, gradeFilter, classSearch]);

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredClasses.map(c => c.id);
    setSelectedClassIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  const handleClearSelection = () => {
    setSelectedClassIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType === 'classes' && selectedClassIds.length === 0) {
      alert("Vui lòng chọn ít nhất 1 phòng/lớp học, hoặc chọn 'Mở toàn khối'!");
      return;
    }

    setIsSaving(true);
    try {
      const quizIds = targetQuizzes.map(q => q.id);
      await onSave(quizIds, targetType, targetType === 'classes' ? selectedClassIds : []);
      onClose();
    } catch (err: any) {
      alert("Lỗi khi gán phòng/lớp: " + (err.message || "Không xác định"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-3xl border shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">
                {isSingle ? 'Gán Phòng / Lớp Học Cho Đề Thi' : `Gán Phòng / Lớp Cho ${targetQuizzes.length} Đề Thi`}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                {isSingle ? `Đề: ${singleQuiz?.title}` : 'Đã chọn nhiều đề thi để phân quyền nhanh'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Target Type Selector */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block">1. Phạm vi mở đề thi</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                  targetType === 'all'
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  targetType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Globe size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 mb-0.5">Mở toàn khối</h4>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">
                    Tất cả học sinh cùng khối đều có thể nhìn thấy và làm đề thi này.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('classes')}
                className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                  targetType === 'classes'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  targetType === 'classes' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Building2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 mb-0.5">Chỉ định Phòng / Lớp</h4>
                  <p className="text-[10px] font-bold text-slate-500 leading-tight">
                    Chỉ học sinh trong các phòng/lớp được tick chọn mới thấy đề này (các lớp khác sẽ không thấy).
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Class Selection List */}
          {targetType === 'classes' && (
            <div className="space-y-4 animate-fade-in pt-2 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <label className="text-[10px] font-black uppercase text-slate-400">
                  2. Chọn Phòng / Lớp ({selectedClassIds.length} lớp đã chọn)
                </label>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase"
                  >
                    Chọn tất cả
                  </button>
                  {selectedClassIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[9px] font-black uppercase"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>
              </div>

              {/* Filters for classes */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={classSearch}
                    onChange={e => setClassSearch(e.target.value)}
                    placeholder="Tìm tên phòng / lớp (VD: Phòng tạm, 12A1)..."
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <select
                  value={gradeFilter}
                  onChange={e => setGradeFilter(e.target.value as any)}
                  className="px-3 py-2.5 bg-slate-50 border rounded-xl text-[10px] font-black uppercase outline-none"
                >
                  <option value="all">TẤT CẢ KHỐI</option>
                  <option value="12">KHỐI 12</option>
                  <option value="11">KHỐI 11</option>
                  <option value="10">KHỐI 10</option>
                </select>
              </div>

              {/* Classes List */}
              {classes.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-black uppercase text-slate-500">Chưa có lớp / phòng học nào trong hệ thống</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-1">
                    Vui lòng vào tab "Lớp học" để tạo các phòng học (ví dụ: "Phòng Tạm", "Lớp 12A1") trước khi phân quyền.
                  </p>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-black uppercase text-[10px]">
                  Không tìm thấy lớp nào phù hợp với bộ lọc
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                  {filteredClasses.map(cls => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <div
                        key={cls.id}
                        onClick={() => toggleClass(cls.id)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-black uppercase text-slate-800 truncate">
                              {cls.name}
                            </h5>
                            <p className="text-[9px] font-bold text-slate-400 uppercase truncate">
                              Khối {cls.grade} {cls.academicYear ? `• ${cls.academicYear}` : ''}
                            </p>
                          </div>
                        </div>
                        {cls.description && (
                          <span className="text-[8px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md truncate max-w-[80px]">
                            {cls.description}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving || (targetType === 'classes' && selectedClassIds.length === 0)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{isSingle ? 'Lưu Phân Quyền' : `Gán Cho ${targetQuizzes.length} Đề Thi`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
