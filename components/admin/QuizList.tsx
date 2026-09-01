import React, { useState, useEffect, useMemo } from 'react';
import { Quiz, Result, Grade, Chapter, ClassRoom } from '../../types';
import { 
  Edit, Trash2, Eye, Users, Filter, FileText, ChevronDown, 
  Link as LinkIcon, EyeOff, ShieldCheck, GraduationCap, Building2, 
  CheckSquare, Square, Zap, Globe, Clock, FileEdit, AlertTriangle, Check,
  FileCode, Loader2, Calendar
} from 'lucide-react';
import QuickAssignModal from './QuickAssignModal';
import { getQuizById, getCurrentAcademicYear } from '../../services/storage';
import { exportQuizToJson, exportQuizzesBatchToJson } from '../../services/quizExport';

export type QuizStatusFilter = 'all' | 'active' | 'draft' | 'expired' | 'classes' | 'all_grade' | 'unlisted';

interface QuizListProps {
    quizzes: Quiz[];
    results: Result[];
    chapters: Chapter[];
    classes?: ClassRoom[];
    onEdit: (quiz: Quiz) => void;
    onDelete: (id: string) => void;
    onPreview: (quiz: Quiz) => void;
    onQuickAssignTarget?: (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => Promise<void>;
    onToggleAllowReview?: (quizId: string, currentAllowReview: boolean) => Promise<void> | void;
    onQuickUpdateAcademicYear?: (quizIds: string[], newYear: string) => Promise<void>;
    qSearch: string;
    setQSearch: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    qAcademicYearFilter?: string;
    setQAcademicYearFilter?: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    qGradeFilter: Grade | 'all';
    setQGradeFilter: React.Dispatch<React.SetStateAction<Grade | 'all'>> | ((val: Grade | 'all') => void);
    qChapterFilter: string;
    setQChapterFilter: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
}

const PAGE_SIZE = 12;

export default function QuizList({ 
    quizzes, results, chapters, classes = [], onEdit, onDelete, onPreview, 
    onQuickAssignTarget,
    onToggleAllowReview,
    onQuickUpdateAcademicYear,
    qSearch, setQSearch, qGradeFilter, setQGradeFilter,
    qChapterFilter, setQChapterFilter,
    qAcademicYearFilter = 'all',
    setQAcademicYearFilter
}: QuizListProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [qStatusFilter, setQStatusFilter] = useState<QuizStatusFilter>('all');
    const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
    
    // Quick assign modal state
    const [assignModalQuizzes, setAssignModalQuizzes] = useState<Quiz[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    // Export JSON states
    const [exportingQuizId, setExportingQuizId] = useState<string | null>(null);
    const [isBatchExporting, setIsBatchExporting] = useState<boolean>(false);
    const [isUpdatingYear, setIsUpdatingYear] = useState<string | null>(null); // quizId or 'batch'

    // Niên khóa hiện hành theo lịch Việt Nam
    const currentAcademicYear = useMemo(() => getCurrentAcademicYear(), []);

    const handleExportSingleQuiz = async (quiz: Quiz, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExportingQuizId(quiz.id);
        try {
            let fullQuiz = quiz;
            if (!fullQuiz.questions || fullQuiz.questions.length === 0) {
                const fetched = await getQuizById(quiz.id);
                if (fetched) fullQuiz = fetched;
            }
            exportQuizToJson(fullQuiz);
        } catch (err: any) {
            console.error("Lỗi xuất JSON:", err);
            alert("Lỗi khi xuất đề thi dạng JSON: " + (err.message || "Không xác định"));
        } finally {
            setExportingQuizId(null);
        }
    };

    const handleExportBatchQuizzes = async () => {
        const selected = quizzes.filter(q => selectedQuizIds.includes(q.id));
        if (selected.length === 0) return;
        setIsBatchExporting(true);
        try {
            const fullQuizzes: Quiz[] = await Promise.all(
                selected.map(async (q) => {
                    if (q.questions && q.questions.length > 0) return q;
                    const fetched = await getQuizById(q.id);
                    return fetched || q;
                })
            );
            exportQuizzesBatchToJson(fullQuizzes, `danh_sach_${fullQuizzes.length}_de_thi`);
        } catch (err: any) {
            console.error("Lỗi xuất hàng loạt JSON:", err);
            alert("Lỗi khi xuất danh sách đề thi: " + (err.message || "Không xác định"));
        } finally {
            setIsBatchExporting(false);
        }
    };

    // Tính toán trạng thái của từng đề thi
    const getQuizState = (q: Quiz) => {
        const now = new Date();
        const startX = q.startTime ? new Date(q.startTime) : null;
        const endY = q.endTime ? new Date(q.endTime) : null;
        const isFlexibleWindow = Boolean(startX && endY && endY.getTime() > startX.getTime());

        let isStarted = true;
        let isExpired = false;

        if (q.type === 'test') {
            if (startX) {
                if (isFlexibleWindow && endY) {
                    isStarted = now.getTime() >= startX.getTime();
                    isExpired = now.getTime() > endY.getTime();
                } else {
                    const globalEnd = new Date(startX.getTime() + q.durationMinutes * 60000);
                    isStarted = now.getTime() >= startX.getTime();
                    isExpired = now.getTime() > globalEnd.getTime();
                }
            }
        } else {
            isStarted = true;
            isExpired = Boolean(endY && now.getTime() > endY.getTime());
        }

        const isDraft = !q.isPublished;
        const isActive = q.isPublished && isStarted && !isExpired;
        const isClassesOnly = q.targetType === 'classes' && Boolean(q.assignedClassIds && q.assignedClassIds.length > 0);
        const isAllGrade = !q.targetType || q.targetType === 'all' || !q.assignedClassIds || q.assignedClassIds.length === 0;

        return {
            isDraft,
            isExpired,
            isStarted,
            isActive,
            isClassesOnly,
            isAllGrade
        };
    };

    // Đếm số lượng theo từng trạng thái để làm badge/pill thống kê
    // Loại bỏ hoàn toàn các đề thi có id trùng lặp nếu có sự chênh lệch giữa các lần cập nhật cache
    const uniqueQuizzes = useMemo(() => {
        const seen = new Set<string>();
        return quizzes.filter(q => {
            if (!q || !q.id || seen.has(q.id)) return false;
            seen.add(q.id);
            return true;
        });
    }, [quizzes]);

    const availableYears = useMemo(() => {
        const years = new Set<string>();
        uniqueQuizzes.forEach(q => { if (q.academicYear) years.add(q.academicYear); });
        classes.forEach(c => { if (c.academicYear) years.add(c.academicYear); });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [uniqueQuizzes, classes]);

    const stats = useMemo(() => {
        let total = uniqueQuizzes.length;
        let activeCount = 0;
        let draftCount = 0;
        let expiredCount = 0;
        let classesCount = 0;
        let allGradeCount = 0;

        uniqueQuizzes.forEach(q => {
            const state = getQuizState(q);
            if (state.isDraft) draftCount++;
            else if (state.isExpired) expiredCount++;
            else if (state.isActive) activeCount++;

            if (state.isClassesOnly) classesCount++;
            else allGradeCount++;
        });

        return {
            total,
            activeCount,
            draftCount,
            expiredCount,
            classesCount,
            allGradeCount
        };
    }, [uniqueQuizzes]);

    const filtered = useMemo(() => {
        return uniqueQuizzes.filter(q => {
            const matchGrade = qGradeFilter === 'all' || q.grade === qGradeFilter;
            const matchYear = !qAcademicYearFilter || qAcademicYearFilter === 'all' || 
              (qAcademicYearFilter === 'none' ? !q.academicYear : q.academicYear === qAcademicYearFilter);
            const matchChapter = qChapterFilter === 'all' || q.category === qChapterFilter;
            const matchSearch = q.title.toLowerCase().includes(qSearch.toLowerCase());

            const state = getQuizState(q);
            let matchStatus = true;
            if (qStatusFilter === 'active') {
                matchStatus = state.isActive;
            } else if (qStatusFilter === 'draft') {
                matchStatus = state.isDraft;
            } else if (qStatusFilter === 'expired') {
                matchStatus = q.isPublished && state.isExpired;
            } else if (qStatusFilter === 'classes') {
                matchStatus = state.isClassesOnly;
            } else if (qStatusFilter === 'all_grade') {
                matchStatus = state.isAllGrade;
            } else if (qStatusFilter === 'unlisted') {
                matchStatus = q.isPublished && Boolean(q.isUnlisted);
            }

            return matchGrade && matchYear && matchChapter && matchSearch && matchStatus;
        }).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [uniqueQuizzes, qGradeFilter, qAcademicYearFilter, qChapterFilter, qSearch, qStatusFilter]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [qSearch, qGradeFilter, qChapterFilter, qStatusFilter]);

    const visibleQuizzes = filtered.slice(0, visibleCount);
    const relevantChapters = chapters.filter(c => qGradeFilter === 'all' || String(c.grade) === String(qGradeFilter));

    const copyQuizLink = (quizId: string) => {
        const url = `${window.location.origin}/?quiz=${quizId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Đã sao chép đường dẫn đề thi ẩn!\nGiáo viên hãy gửi link này cho nhóm học sinh chỉ định.');
        });
    };

    // Toggle chọn 1 đề thi
    const toggleSelectQuiz = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedQuizIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    // Chọn tất cả đề thi đang hiển thị
    const handleSelectAllVisible = () => {
        const visibleIds = visibleQuizzes.map(q => q.id);
        const allSelected = visibleIds.every(id => selectedQuizIds.includes(id));
        if (allSelected) {
            setSelectedQuizIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedQuizIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    // Mở modal gán nhanh cho 1 đề
    const openQuickAssignSingle = (quiz: Quiz, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAssignModalQuizzes([quiz]);
        setIsAssignModalOpen(true);
    };

    // Mở modal gán nhanh cho các đề đã chọn
    const openQuickAssignBatch = () => {
        const selected = quizzes.filter(q => selectedQuizIds.includes(q.id));
        if (selected.length === 0) return;
        setAssignModalQuizzes(selected);
        setIsAssignModalOpen(true);
    };

    const handleSaveQuickAssign = async (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => {
        if (onQuickAssignTarget) {
            await onQuickAssignTarget(quizIds, targetType, assignedClassIds);
            setSelectedQuizIds([]);
        }
    };

    // Helper chuyển đổi năm học
    const handleUpdateYearForQuiz = async (quizId: string, newYear: string, e?: React.ChangeEvent<HTMLSelectElement>) => {
        if (e) e.stopPropagation();
        if (!onQuickUpdateAcademicYear) return;
        setIsUpdatingYear(quizId);
        try {
            await onQuickUpdateAcademicYear([quizId], newYear);
        } finally {
            setIsUpdatingYear(null);
        }
    };

    const handleBatchUpdateYear = async (newYear: string) => {
        if (!onQuickUpdateAcademicYear || selectedQuizIds.length === 0 || !newYear) return;
        setIsUpdatingYear('batch');
        try {
            await onQuickUpdateAcademicYear(selectedQuizIds, newYear);
            alert(`Đã đổi niên khóa ${newYear} cho ${selectedQuizIds.length} đề thi thành công!`);
        } finally {
            setIsUpdatingYear(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Filter Bar */}
            <div className="space-y-4 bg-white p-6 rounded-[2rem] border shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-center">
                    <div className="flex-1 w-full relative">
                        <input 
                            className="w-full p-4 bg-slate-50 border rounded-2xl outline-none text-xs font-bold pl-10" 
                            placeholder="Tìm tên đề thi..." 
                            value={qSearch} 
                            onChange={e => setQSearch(e.target.value)} 
                        />
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                    </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto">
                        <select 
                            className="flex-1 lg:w-48 px-4 py-3 bg-amber-50 border-2 border-amber-300 text-amber-950 font-black rounded-xl text-[10px] uppercase outline-none shadow-sm focus:border-blue-500" 
                            value={qAcademicYearFilter || currentAcademicYear} 
                            onChange={e => setQAcademicYearFilter && setQAcademicYearFilter(e.target.value)}
                        >
                            <option value={currentAcademicYear}>⭐ NIÊN KHÓA {currentAcademicYear} (HIỆN HÀNH)</option>
                            <option value="2026-2027">📅 NĂM HỌC 2026-2027</option>
                            <option value="2025-2026">📅 NĂM HỌC 2025-2026</option>
                            <option value="2024-2025">📅 NĂM HỌC 2024-2025</option>
                            <option value="2027-2028">📅 NĂM HỌC 2027-2028</option>
                            {availableYears.filter(y => ![currentAcademicYear, '2025-2026', '2024-2025', '2026-2027', '2027-2028'].includes(y)).map(yr => (
                                <option key={yr} value={yr}>📅 NĂM HỌC {yr}</option>
                            ))}
                            <option value="all">🗄️ TẤT CẢ CÁC NĂM (KHO LƯU TRỮ)</option>
                            <option value="none">⚠️ CHƯA GẮN NĂM</option>
                        </select>
                        <select 
                            className="flex-1 lg:w-32 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                            value={qGradeFilter} 
                            onChange={e => { setQGradeFilter(e.target.value as any); setQChapterFilter('all'); }}
                        >
                            <option value="all">TẤT CẢ KHỐI</option>
                            <option value="12">KHỐI 12</option>
                            <option value="11">KHỐI 11</option>
                            <option value="10">KHỐI 10</option>
                        </select>
                        <select 
                            className="flex-1 lg:w-48 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                            value={qChapterFilter} 
                            onChange={e => setQChapterFilter(e.target.value)}
                        >
                            <option value="all">TẤT CẢ CHƯƠNG</option>
                            {relevantChapters.map(c => (
                                <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>
                            ))}
                        </select>
                        <select 
                            className="flex-1 lg:w-48 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-[10px] font-black uppercase outline-none" 
                            value={qStatusFilter} 
                            onChange={e => setQStatusFilter(e.target.value as QuizStatusFilter)}
                        >
                            <option value="all">TẤT CẢ TRẠNG THÁI ({stats.total})</option>
                            <option value="active">🟢 ĐANG HOẠT ĐỘNG ({stats.activeCount})</option>
                            <option value="draft">⚪ BẢN NHÁP / ĐÓNG ({stats.draftCount})</option>
                            <option value="expired">🟡 ĐÃ HẾT HẠN ({stats.expiredCount})</option>
                            <option value="classes">🏫 GIAO THEO LỚP ({stats.classesCount})</option>
                            <option value="all_grade">🌐 TOÀN KHỐI ({stats.allGradeCount})</option>
                            <option value="unlisted">🔒 LINK RIÊNG TƯ</option>
                        </select>
                    </div>
                </div>

                {/* Quick Status Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-400 shrink-0 mr-1">Lọc nhanh:</span>
                    {[
                        { id: 'all', label: `Tất cả (${stats.total})`, color: 'slate' },
                        { id: 'active', label: `🟢 Đang mở (${stats.activeCount})`, color: 'emerald' },
                        { id: 'draft', label: `⚪ Bản nháp (${stats.draftCount})`, color: 'slate' },
                        { id: 'expired', label: `🟡 Hết hạn (${stats.expiredCount})`, color: 'amber' },
                        { id: 'classes', label: `🏫 Theo lớp (${stats.classesCount})`, color: 'indigo' },
                        { id: 'all_grade', label: `🌐 Toàn khối (${stats.allGradeCount})`, color: 'blue' },
                    ].map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setQStatusFilter(chip.id as QuizStatusFilter)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap shrink-0 border ${
                                qStatusFilter === chip.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedQuizIds.length > 0 && (
                <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 animate-scale-up">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-700 flex items-center justify-center font-black text-xs">
                            {selectedQuizIds.length}
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-tight">
                                Đã chọn {selectedQuizIds.length} đề thi
                            </h4>
                            <p className="text-[10px] text-indigo-300 font-bold">
                                Chuyển nhanh vào phòng tạm hoặc gán lớp học chỉ định
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Gán nhanh năm học hàng loạt */}
                        <div className="flex items-center bg-indigo-800/90 rounded-xl px-2 py-1 border border-indigo-700">
                            <Calendar size={13} className="text-amber-300 mr-1.5 shrink-0" />
                            <select
                                className="bg-transparent text-white text-[10px] font-black uppercase outline-none cursor-pointer py-1"
                                defaultValue=""
                                disabled={isUpdatingYear === 'batch'}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleBatchUpdateYear(e.target.value);
                                        e.target.value = "";
                                    }
                                }}
                            >
                                <option value="" className="text-slate-800">⚡ ĐỔI NĂM HỌC ({selectedQuizIds.length} ĐỀ)...</option>
                                <option value="2026-2027" className="text-slate-800">2026-2027</option>
                                <option value="2025-2026" className="text-slate-800">2025-2026</option>
                                <option value="2024-2025" className="text-slate-800">2024-2025</option>
                                <option value="2027-2028" className="text-slate-800">2027-2028</option>
                                <option value="2028-2029" className="text-slate-800">2028-2029</option>
                            </select>
                            {isUpdatingYear === 'batch' && <Loader2 size={12} className="animate-spin text-amber-300 ml-1" />}
                        </div>

                        <button
                            onClick={openQuickAssignBatch}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 rounded-xl font-black uppercase text-[10px] shadow-sm transition-all"
                        >
                            <Zap size={14} className="text-amber-500" />
                            <span>Gán Phòng Cho {selectedQuizIds.length} Đề</span>
                        </button>
                        <button
                            onClick={handleExportBatchQuizzes}
                            disabled={isBatchExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] shadow-sm transition-all disabled:opacity-50"
                            title="Tải về file JSON tổng hợp các đề đã chọn"
                        >
                            {isBatchExporting ? <Loader2 size={14} className="animate-spin" /> : <FileCode size={14} />}
                            <span>Xuất JSON ({selectedQuizIds.length} Đề)</span>
                        </button>
                        <button
                            onClick={() => setSelectedQuizIds([])}
                            className="px-3 py-2 bg-indigo-800/80 hover:bg-indigo-800 text-indigo-200 rounded-xl font-black uppercase text-[10px] transition-all"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                </div>
            )}

            {/* Select All Bar */}
            {filtered.length > 0 && (
                <div className="flex justify-between items-center px-2">
                    <button
                        onClick={handleSelectAllVisible}
                        className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        {visibleQuizzes.every(q => selectedQuizIds.includes(q.id)) ? (
                            <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                            <Square size={16} className="text-slate-400" />
                        )}
                        <span>Chọn tất cả {visibleQuizzes.length} đề trên trang</span>
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Hiển thị {visibleQuizzes.length} / {filtered.length} đề thi
                    </span>
                </div>
            )}

            {/* Quiz Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleQuizzes.map(q => {
                    const isSelected = selectedQuizIds.includes(q.id);
                    const state = getQuizState(q);
                    
                    let cardStyle = "";
                    if (!q.isPublished) {
                        cardStyle = "bg-slate-50 border-dashed border-slate-300 opacity-85";
                    } else if (state.isExpired) {
                        cardStyle = "bg-amber-50/30 border-b-amber-500 border-amber-200 shadow-sm";
                    } else if (q.isUnlisted) {
                        cardStyle = "bg-indigo-50/30 border-b-indigo-500 border-indigo-100 shadow-sm";
                    } else {
                        cardStyle = "bg-white shadow-sm border-b-blue-600 border-slate-200/80";
                    }

                    const qResults = results.filter(r => r.quizId === q.id);

                    return (
                        <div 
                            key={q.id} 
                            className={`rounded-[1.75rem] p-4 sm:p-5 border transition-all flex flex-col justify-between group relative overflow-hidden border-b-4 hover:shadow-lg hover:-translate-y-0.5 ${cardStyle} ${
                                isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 bg-indigo-50/20' : ''
                            }`}
                        >
                            <div className="space-y-2.5">
                                {/* Top bar: Checkbox, Grade, Year, and Edit button (Clean, compact) */}
                                <div className="flex justify-between items-center gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={(e) => toggleSelectQuiz(q.id, e)}
                                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                                isSelected 
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                            }`}
                                            title="Chọn đề để gán phòng hàng loạt"
                                        >
                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                        </button>

                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tight ${
                                            q.isPublished 
                                                ? (state.isExpired ? 'bg-amber-600 text-white' : (q.isUnlisted ? 'bg-indigo-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-100')) 
                                                : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            KHỐI {q.grade}
                                        </span>

                                        {/* BỘ CHỌN & SỬA NIÊN KHÓA TRỰC TIẾP TRÊN CARD ĐỀ THI */}
                                        <div className="relative inline-flex items-center">
                                            <select
                                                value={q.academicYear || currentAcademicYear}
                                                disabled={isUpdatingYear === q.id}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => handleUpdateYearForQuiz(q.id, e.target.value, e)}
                                                className={`px-2 py-0.5 pr-3.5 rounded-lg text-[8px] font-black uppercase cursor-pointer border tracking-tight outline-none transition-all appearance-none ${
                                                    q.academicYear === currentAcademicYear
                                                        ? 'bg-amber-100/90 text-amber-950 border-amber-300 hover:bg-amber-200 font-black'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                }`}
                                                title="Nhấp để đổi nhanh niên khóa cho đề thi này (Lưu Cloud tức thì)"
                                            >
                                                <option value="2026-2027">2026-2027</option>
                                                <option value="2025-2026">2025-2026</option>
                                                <option value="2024-2025">2024-2025</option>
                                                <option value="2027-2028">2027-2028</option>
                                                <option value="2028-2029">2028-2029</option>
                                                {availableYears.filter(y => !['2026-2027', '2025-2026', '2024-2025', '2027-2028', '2028-2029'].includes(y)).map(yr => (
                                                    <option key={yr} value={yr}>{yr}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={7} className="absolute right-1 text-slate-500 pointer-events-none" />
                                            {isUpdatingYear === q.id && (
                                                <Loader2 size={9} className="animate-spin text-amber-600 absolute -right-3" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Nút sửa đề góc trên phải */}
                                    <div className="flex items-center gap-1">
                                        {q.isUnlisted && (
                                            <button onClick={() => copyQuizLink(q.id)} className="p-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors" title="Copy Link Riêng Tư">
                                                <LinkIcon size={12}/>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => onEdit(q)} 
                                            className="p-1.5 bg-slate-50 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg border border-slate-200 shadow-xs transition-colors" 
                                            title="Sửa đề thi"
                                        >
                                            <Edit size={12.5}/>
                                        </button>
                                        <button 
                                            onClick={() => onDelete(q.id)} 
                                            className="p-1.5 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-lg border border-red-100 shadow-xs transition-colors" 
                                            title="Xóa đề thi"
                                        >
                                            <Trash2 size={12.5}/>
                                        </button>
                                    </div>
                                </div>

                                {/* Status & Room Badges */}
                                <div className="flex items-center gap-1 flex-wrap">
                                    {/* Room / Target Badge */}
                                    {q.targetType === 'classes' && q.assignedClassIds && q.assignedClassIds.length > 0 ? (
                                        <button
                                            onClick={(e) => openQuickAssignSingle(q, e)}
                                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 shadow-xs transition-colors"
                                            title="Nhấp để đổi phòng/lớp"
                                        >
                                            <GraduationCap size={10} className="text-indigo-600"/>
                                            {(() => {
                                                const assignedNames = q.assignedClassIds.map(id => {
                                                    const found = classes?.find(c => c.id === id);
                                                    return found ? `${found.name}` : id;
                                                });
                                                if (assignedNames.length === 1) return `Lớp ${assignedNames[0]}`;
                                                return `${assignedNames.length} Phòng`;
                                            })()}
                                            <Zap size={8} className="text-amber-500 ml-0.5" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={(e) => openQuickAssignSingle(q, e)}
                                            className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 shadow-xs transition-colors"
                                            title="Đang mở toàn khối. Nhấp để gán vào phòng/lớp riêng"
                                        >
                                            <Globe size={10}/> Toàn Khối
                                        </button>
                                    )}

                                    {/* Published / Active Status Badge */}
                                    {q.type === 'practice' ? (
                                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 shadow-xs">
                                            <Zap size={8}/> Luyện tập
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-300 text-blue-800 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 shadow-xs">
                                            <FileText size={8}/> Làm bài ({q.maxAttempts ?? 2} lần)
                                        </span>
                                    )}

                                    {/* Quick toggle Mở / Khóa đáp án cho đề thi */}
                                    {q.type === 'test' && onToggleAllowReview && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleAllowReview(q.id, q.allowReview ?? false);
                                            }}
                                            className={`px-2 py-0.5 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 shadow-xs transition-colors ${q.allowReview ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'}`}
                                            title={q.allowReview ? "Học sinh ĐƯỢC XEM đáp án & lời giải chi tiết. Nhấp để KHÓA LẠI." : "Đang KHÓA ĐÁP ÁN: Học sinh chỉ thấy điểm tổng. Nhấp để MỞ ĐÁP ÁN."}
                                        >
                                            {q.allowReview ? <Eye size={9} className="text-amber-700"/> : <EyeOff size={9} className="text-slate-500"/>}
                                            {q.allowReview ? 'Mở đáp án' : 'Khóa đáp án'}
                                        </button>
                                    )}

                                    {q.isPublished ? (
                                        state.isExpired ? (
                                            <span className="px-1.5 py-0.5 bg-white border border-amber-200 text-amber-600 rounded-md text-[7.5px] font-black uppercase flex items-center gap-0.5 shadow-xs">
                                                HẾT HẠN
                                            </span>
                                        ) : (
                                            <span className={`px-1.5 py-0.5 bg-white border ${state.isActive ? 'border-emerald-200 text-emerald-600' : 'border-amber-200 text-amber-600'} rounded-md text-[7.5px] font-black uppercase flex items-center gap-0.5 shadow-xs`}>
                                                {state.isActive ? 'ĐANG MỞ' : 'CHƯA ĐẾN GIỜ'}
                                            </span>
                                        )
                                    ) : (
                                        <span className="px-1.5 py-0.5 bg-white border border-slate-300 text-slate-500 rounded-md text-[7.5px] font-black uppercase flex items-center gap-0.5 shadow-xs">
                                            BẢN NHÁP
                                        </span>
                                    )}

                                    {q.isPublished && q.isUnlisted && (
                                        <span className="px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-600 rounded-md text-[7.5px] font-black uppercase flex items-center gap-0.5 shadow-xs">
                                            <EyeOff size={9}/> RIÊNG TƯ
                                        </span>
                                    )}

                                    {q.isMonitored && (
                                        <span className="p-0.5 bg-red-50 text-red-500 rounded" title="Có giám sát">
                                            <ShieldCheck size={9}/>
                                        </span>
                                    )}
                                </div>

                                <div>
                                    {q.category && (
                                        <span className="text-[7px] font-bold uppercase truncate text-slate-400 block mb-0.5">
                                            {q.category}
                                        </span>
                                    )}
                                    <h3 className={`font-black text-xs uppercase line-clamp-2 min-h-[32px] leading-tight transition-colors ${q.isPublished ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {q.title}
                                    </h3>
                                </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2.5">
                                {/* Thống kê: Số câu & Lượt thi */}
                                <div className="grid grid-cols-2 gap-1.5 text-center">
                                    <div className="bg-slate-50 py-1.5 px-1 rounded-xl border border-slate-100">
                                        <p className="text-[7px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1"><FileText size={8} className="text-blue-500"/> SỐ CÂU</p>
                                        <p className="text-[11px] font-black text-slate-800 mt-0.5">{q.questionCount || (q.questions ? q.questions.length : 0)} CÂU</p>
                                    </div>
                                    <div className="bg-slate-50 py-1.5 px-1 rounded-xl border border-slate-100">
                                        <p className="text-[7px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1"><Users size={8} className="text-indigo-500"/> LƯỢT THI</p>
                                        <p className="text-[11px] font-black text-slate-800 mt-0.5">{qResults.length} LƯỢT</p>
                                    </div>
                                </div>

                                {/* Hàng nút hành động dưới cùng: XEM & XUẤT + JSON + GÁN PHÒNG */}
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => onPreview(q)} 
                                        className={`flex-1 py-2.5 px-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 whitespace-nowrap ${q.isPublished 
                                            ? (q.isUnlisted ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-blue-600 text-white hover:bg-blue-700') 
                                            : 'bg-slate-800 text-white hover:bg-black'}`}
                                        title="Xem chi tiết & Xuất Word / JSON"
                                    >
                                        <Eye size={13}/>
                                        <span>XEM & XUẤT</span>
                                    </button>
                                    
                                    {/* Nút JSON */}
                                    <button
                                        onClick={(e) => handleExportSingleQuiz(q, e)}
                                        disabled={exportingQuizId === q.id}
                                        className="py-2.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[8.5px] font-black uppercase flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 shrink-0 disabled:opacity-50"
                                        title="Tải nhanh file JSON đề thi"
                                    >
                                        {exportingQuizId === q.id ? <Loader2 size={11} className="animate-spin text-amber-600" /> : <FileCode size={11} className="text-amber-600" />}
                                        <span>JSON</span>
                                    </button>

                                    {/* Nút Gán phòng / lớp */}
                                    <button
                                        onClick={(e) => openQuickAssignSingle(q, e)}
                                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-200 text-[8.5px] font-black uppercase flex items-center justify-center shadow-xs transition-all shrink-0 active:scale-95"
                                        title="Gán phòng/lớp nhanh cho đề thi này"
                                    >
                                        <Building2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {visibleCount < filtered.length && (
                <div className="py-10 text-center">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                        className="inline-flex items-center gap-2 px-10 py-4 bg-white border-2 border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-xl"
                    >
                        <ChevronDown size={16}/> Tải thêm đề thi (Còn {filtered.length - visibleCount})
                    </button>
                </div>
            )}
            
            {filtered.length === 0 && (
                <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] italic tracking-widest">
                    Không tìm thấy đề thi nào phù hợp với bộ lọc
                </div>
            )}

            {/* Quick Assign Modal */}
            {isAssignModalOpen && (
                <QuickAssignModal
                    isOpen={isAssignModalOpen}
                    onClose={() => {
                        setIsAssignModalOpen(false);
                        setAssignModalQuizzes([]);
                    }}
                    targetQuizzes={assignModalQuizzes}
                    classes={classes}
                    onSave={handleSaveQuickAssign}
                />
            )}
        </div>
    );
}
