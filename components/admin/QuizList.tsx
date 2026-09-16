import React, { useState, useEffect, useMemo } from 'react';
import { Quiz, Result, Grade, Chapter, ClassRoom, QuizFolder } from '../../types';
import { 
  Edit, Trash2, Eye, Users, Filter, FileText, ChevronDown, 
  Link as LinkIcon, EyeOff, ShieldCheck, GraduationCap, Building2, 
  CheckSquare, Square, Zap, Globe, Clock, FileEdit, AlertTriangle, Check,
  FileCode, Loader2, Calendar, Folder, FolderPlus, FolderTree, FolderInput,
  ArrowLeft, ChevronRight, BookOpen, Layers, Sparkles, LayoutGrid, List, Plus,
  CheckCircle2, FolderX, X
} from 'lucide-react';
import QuickAssignModal from './QuickAssignModal';
import FolderModal from './FolderModal';
import FolderMoveModal from './FolderMoveModal';
import { getQuizById, getCurrentAcademicYear } from '../../services/storage';
import { exportQuizToJson, exportQuizzesBatchToJson } from '../../services/quizExport';

export type QuizStatusFilter = 'all' | 'active' | 'draft' | 'expired' | 'classes' | 'all_grade' | 'unlisted';

interface QuizListProps {
    quizzes: Quiz[];
    results: Result[];
    chapters: Chapter[];
    classes?: ClassRoom[];
    folders?: QuizFolder[];
    onEdit: (quiz: Quiz) => void;
    onDelete: (id: string) => void;
    onPreview: (quiz: Quiz) => void;
    onQuickAssignTarget?: (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => Promise<void>;
    onToggleAllowReview?: (quizId: string, currentAllowReview: boolean) => Promise<void> | void;
    onQuickUpdateAcademicYear?: (quizIds: string[], newYear: string) => Promise<void>;
    onSaveFolder?: (folder: QuizFolder) => Promise<void> | void;
    onDeleteFolder?: (id: string) => Promise<void> | void;
    onBatchMoveToFolder?: (quizIds: string[], folderId?: string, folderName?: string, chapterName?: string) => Promise<void>;
    qSearch: string;
    setQSearch: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    qAcademicYearFilter?: string;
    setQAcademicYearFilter?: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    qGradeFilter: Grade | 'all';
    setQGradeFilter: React.Dispatch<React.SetStateAction<Grade | 'all'>> | ((val: Grade | 'all') => void);
    qChapterFilter: string;
    setQChapterFilter: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    qStatusFilter?: QuizStatusFilter;
    setQStatusFilter?: React.Dispatch<React.SetStateAction<QuizStatusFilter>> | ((val: QuizStatusFilter) => void);
    viewMode?: 'folders' | 'flat';
    setViewMode?: React.Dispatch<React.SetStateAction<'folders' | 'flat'>> | ((val: 'folders' | 'flat') => void);
    activeFolderId?: string | null;
    setActiveFolderId?: React.Dispatch<React.SetStateAction<string | null>> | ((val: string | null) => void);
}

const PAGE_SIZE = 16;

export default function QuizList({ 
    quizzes, results, chapters, classes = [], folders = [], onEdit, onDelete, onPreview, 
    onQuickAssignTarget,
    onToggleAllowReview,
    onQuickUpdateAcademicYear,
    onSaveFolder,
    onDeleteFolder,
    onBatchMoveToFolder,
    qSearch, setQSearch, qGradeFilter, setQGradeFilter,
    qChapterFilter, setQChapterFilter,
    qAcademicYearFilter = 'all',
    setQAcademicYearFilter,
    qStatusFilter: propQStatusFilter,
    setQStatusFilter: propSetQStatusFilter,
    viewMode: propViewMode,
    setViewMode: propSetViewMode,
    activeFolderId: propActiveFolderId,
    setActiveFolderId: propSetActiveFolderId
}: QuizListProps) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    
    // Controlled / Uncontrolled fallback for filters
    const [localStatusFilter, setLocalStatusFilter] = useState<QuizStatusFilter>('all');
    const [localViewMode, setLocalViewMode] = useState<'folders' | 'flat'>('folders');
    const [localActiveFolderId, setLocalActiveFolderId] = useState<string | null>(null);

    const qStatusFilter = propQStatusFilter !== undefined ? propQStatusFilter : localStatusFilter;
    const setQStatusFilter = propSetQStatusFilter || setLocalStatusFilter;

    const viewMode = propViewMode !== undefined ? propViewMode : localViewMode;
    const setViewMode = propSetViewMode || setLocalViewMode;

    const activeFolderId = propActiveFolderId !== undefined ? propActiveFolderId : localActiveFolderId;
    const setActiveFolderId = propSetActiveFolderId || setLocalActiveFolderId;

    const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);

    // Folder Modals state
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<QuizFolder | null>(null);
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [moveModalQuizzes, setMoveModalQuizzes] = useState<Quiz[]>([]);
    const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
    const [isDeletingFolder, setIsDeletingFolder] = useState(false);

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

    // Khử trùng lặp đề thi
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

    const relevantChapters = useMemo(() => {
        return chapters.filter(c => qGradeFilter === 'all' || String(c.grade) === String(qGradeFilter));
    }, [chapters, qGradeFilter]);

    // Tự động tìm chương học hiển thị
    const currentChapterDisplayName = useMemo(() => {
        if (qChapterFilter && qChapterFilter !== 'all') {
            return qChapterFilter;
        }
        return 'TẤT CẢ CHƯƠNG';
    }, [qChapterFilter]);

    // Lọc danh sách thư mục hiển thị theo Khối & Chương đang chọn
    const displayedFolders = useMemo(() => {
        return folders.filter(f => {
            const matchGrade = qGradeFilter === 'all' || !f.grade || f.grade === 'all' || String(f.grade) === String(qGradeFilter);
            const matchChapter = qChapterFilter === 'all' || !f.chapterName || (f.chapterName && f.chapterName.trim().toLowerCase() === qChapterFilter.trim().toLowerCase());
            return matchGrade && matchChapter;
        });
    }, [folders, qGradeFilter, qChapterFilter]);

    // Khớp đề thi vào thư mục
    const isQuizInFolder = (q: Quiz, folder: QuizFolder) => {
        // 1. Khớp chính xác theo ID thư mục
        if (q.folderId && q.folderId === folder.id) return true;
        
        // 2. Khớp dự phòng theo Tên thư mục (phải đúng cả Chương học và Khối lớp để không bị kéo nhầm đề từ chương khác)
        if (!q.folderId && folder.name && q.folderName && q.folderName.trim().toLowerCase() === folder.name.trim().toLowerCase()) {
            const matchGrade = !folder.grade || folder.grade === 'all' || !q.grade || q.grade === 'all' || String(folder.grade) === String(q.grade);
            const matchChapter = !folder.chapterName || !q.category || folder.chapterName.trim().toLowerCase() === q.category.trim().toLowerCase();
            return matchGrade && matchChapter;
        }
        return false;
    };

    // Kiểm tra đề thi đã vào thư mục nào chưa
    const isQuizUnassigned = (q: Quiz) => {
        if (!q.folderId && !q.folderName) return true;
        if (q.folderId && !folders.some(f => f.id === q.folderId)) return true;
        if (!q.folderId && q.folderName && !folders.some(f => f.name.trim().toLowerCase() === q.folderName?.trim().toLowerCase())) return true;
        return false;
    };

    // Đếm số đề trong từng thư mục (Đếm chính xác tuyệt đối, khớp với khi mở thư mục)
    const getFolderQuizCount = (folder: QuizFolder) => {
        return uniqueQuizzes.filter(q => isQuizInFolder(q, folder)).length;
    };

    // Số đề chưa phân thư mục
    const unassignedQuizzes = useMemo(() => {
        return uniqueQuizzes.filter(q => {
            const isUnassigned = isQuizUnassigned(q);
            if (!isUnassigned) return false;
            const matchGrade = qGradeFilter === 'all' || !q.grade || q.grade === 'all' || String(q.grade) === String(qGradeFilter);
            const matchChapter = qChapterFilter === 'all' || (q.category && q.category.trim().toLowerCase() === qChapterFilter.trim().toLowerCase());
            return matchGrade && matchChapter;
        });
    }, [uniqueQuizzes, folders, qGradeFilter, qChapterFilter]);

    // Lọc danh sách đề thi tổng thể
    const filtered = useMemo(() => {
        return uniqueQuizzes.filter(q => {
            const matchSearch = !qSearch || q.title.toLowerCase().includes(qSearch.toLowerCase());

            // KHI ĐANG MỞ MỘT THƯ MỤC CỤ THỂ
            if (activeFolderId) {
                if (activeFolderId === 'unassigned') {
                    const isUnassigned = isQuizUnassigned(q);
                    const matchGrade = qGradeFilter === 'all' || !q.grade || q.grade === 'all' || String(q.grade) === String(qGradeFilter);
                    const matchChapter = qChapterFilter === 'all' || (q.category && q.category.trim().toLowerCase() === qChapterFilter.trim().toLowerCase());
                    return isUnassigned && matchGrade && matchChapter && matchSearch;
                } else {
                    const activeF = folders.find(f => f.id === activeFolderId);
                    if (activeF) {
                        const inThisFolder = isQuizInFolder(q, activeF);
                        if (!inThisFolder) return false;
                        // Trong thư mục, chỉ lọc theo từ khóa tìm kiếm để không bị mất đề
                        return matchSearch;
                    } else {
                        return (q.folderId === activeFolderId) && matchSearch;
                    }
                }
            }

            // KHI Ở CHẾ ĐỘ XEM TOÀN BỘ DANH SÁCH (FLAT LIST)
            const matchGrade = qGradeFilter === 'all' || !q.grade || q.grade === 'all' || String(q.grade) === String(qGradeFilter);
            const matchYear = !qAcademicYearFilter || qAcademicYearFilter === 'all' || 
              (qAcademicYearFilter === 'none' ? !q.academicYear : (q.academicYear === qAcademicYearFilter || (!q.academicYear && qAcademicYearFilter === currentAcademicYear)));
            const matchChapter = qChapterFilter === 'all' || (q.category && q.category.trim().toLowerCase() === qChapterFilter.trim().toLowerCase());

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
    }, [uniqueQuizzes, qGradeFilter, qAcademicYearFilter, qChapterFilter, qSearch, qStatusFilter, activeFolderId, folders]);

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

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [qSearch, qGradeFilter, qChapterFilter, qStatusFilter, activeFolderId]);

    const visibleQuizzes = filtered.slice(0, visibleCount);

    const activeFolder = useMemo(() => {
        if (!activeFolderId) return null;
        if (activeFolderId === 'unassigned') {
            return {
                id: 'unassigned',
                name: 'Đề thi chưa phân thư mục',
                chapterName: currentChapterDisplayName,
                grade: qGradeFilter,
                color: 'slate',
                description: 'Các đề thi thuộc chương học này chưa được xếp vào thư mục cụ thể.'
            } as QuizFolder;
        }
        return folders.find(f => f.id === activeFolderId) || null;
    }, [activeFolderId, folders, currentChapterDisplayName, qGradeFilter]);

    const copyQuizLink = (quizId: string) => {
        const url = `${window.location.origin}/?quiz=${quizId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Đã sao chép đường dẫn đề thi ẩn!\nGiáo viên hãy gửi link này cho nhóm học sinh chỉ định.');
        });
    };

    const toggleSelectQuiz = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedQuizIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllVisible = () => {
        const visibleIds = visibleQuizzes.map(q => q.id);
        const allSelected = visibleIds.every(id => selectedQuizIds.includes(id));
        if (allSelected) {
            setSelectedQuizIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedQuizIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const openQuickAssignSingle = (quiz: Quiz, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setAssignModalQuizzes([quiz]);
        setIsAssignModalOpen(true);
    };

    const openQuickAssignBatch = () => {
        const selected = quizzes.filter(q => selectedQuizIds.includes(q.id));
        if (selected.length === 0) return;
        setAssignModalQuizzes(selected);
        setIsAssignModalOpen(true);
    };

    const openMoveModalBatch = () => {
        const selected = quizzes.filter(q => selectedQuizIds.includes(q.id));
        if (selected.length === 0) return;
        setMoveModalQuizzes(selected);
        setIsMoveModalOpen(true);
    };

    const openMoveModalSingle = (quiz: Quiz, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setMoveModalQuizzes([quiz]);
        setIsMoveModalOpen(true);
    };

    const handleConfirmMoveToFolder = async (folderId?: string, folderName?: string, chapterName?: string) => {
        if (!onBatchMoveToFolder || moveModalQuizzes.length === 0) return;
        const ids = moveModalQuizzes.map(q => q.id);
        await onBatchMoveToFolder(ids, folderId, folderName, chapterName);
        setSelectedQuizIds([]);
        alert(`Đã di chuyển ${ids.length} đề thi thành công!`);
    };

    const handleSaveQuickAssign = async (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => {
        if (onQuickAssignTarget) {
            await onQuickAssignTarget(quizIds, targetType, assignedClassIds);
            setSelectedQuizIds([]);
        }
    };

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

    const requestDeleteFolder = (folderId: string, folderName: string, count: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setFolderToDelete({ id: folderId, name: folderName, count });
    };

    const handleConfirmDeleteFolder = async () => {
        if (!folderToDelete || !onDeleteFolder) return;
        setIsDeletingFolder(true);
        try {
            await onDeleteFolder(folderToDelete.id);
            if (activeFolderId === folderToDelete.id) {
                setActiveFolderId(null);
            }
            setFolderToDelete(null);
        } catch (err: any) {
            alert("Lỗi khi xóa thư mục: " + (err.message || "Không xác định"));
        } finally {
            setIsDeletingFolder(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Filter Bar & View Mode Toggle */}
            <div className="space-y-4 bg-white p-6 rounded-[2rem] border shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="flex-1 w-full relative">
                        <input 
                            className="w-full p-4 bg-slate-50 border rounded-2xl outline-none text-xs font-bold pl-10" 
                            placeholder="Tìm kiếm tên đề thi..." 
                            value={qSearch} 
                            onChange={e => setQSearch(e.target.value)} 
                        />
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                    </div>

                    {/* View mode toggle button */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
                        <button
                            onClick={() => {
                                setViewMode('folders');
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                viewMode === 'folders'
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Folder size={14} />
                            <span>Xem Thư mục</span>
                        </button>
                        <button
                            onClick={() => {
                                setViewMode('flat');
                                setActiveFolderId(null);
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${
                                viewMode === 'flat'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <List size={14} />
                            <span>Toàn bộ danh sách</span>
                        </button>
                    </div>
                </div>

                {/* Filter Selects */}
                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full">
                    <select 
                        className="flex-1 px-4 py-3 bg-amber-50 border-2 border-amber-300 text-amber-950 font-black rounded-xl text-[10px] uppercase outline-none shadow-sm focus:border-blue-500" 
                        value={qAcademicYearFilter || 'all'} 
                        onChange={e => setQAcademicYearFilter && setQAcademicYearFilter(e.target.value)}
                    >
                        <option value="all">🗄️ TẤT CẢ NIÊN KHÓA ({uniqueQuizzes.length} ĐỀ)</option>
                        <option value={currentAcademicYear}>⭐ NIÊN KHÓA {currentAcademicYear} (HIỆN HÀNH)</option>
                        <option value="2026-2027">📅 NĂM HỌC 2026-2027</option>
                        <option value="2025-2026">📅 NĂM HỌC 2025-2026</option>
                        <option value="2024-2025">📅 NĂM HỌC 2024-2025</option>
                        <option value="2027-2028">📅 NĂM HỌC 2027-2028</option>
                        {availableYears.filter(y => ![currentAcademicYear, '2025-2026', '2024-2025', '2026-2027', '2027-2028'].includes(y)).map(yr => (
                            <option key={yr} value={yr}>📅 NĂM HỌC {yr}</option>
                        ))}
                        <option value="none">⚠️ CHƯA GẮN NĂM</option>
                    </select>
                    <select 
                        className="flex-1 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                        value={qGradeFilter} 
                        onChange={e => { 
                            setQGradeFilter(e.target.value as any); 
                            setQChapterFilter('all'); 
                            setActiveFolderId(null);
                        }}
                    >
                        <option value="all">TẤT CẢ KHỐI</option>
                        <option value="12">KHỐI 12</option>
                        <option value="11">KHỐI 11</option>
                        <option value="10">KHỐI 10</option>
                    </select>
                    <select 
                        className="flex-1 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                        value={qChapterFilter} 
                        onChange={e => {
                            setQChapterFilter(e.target.value);
                            setActiveFolderId(null);
                        }}
                    >
                        <option value="all">TẤT CẢ CHƯƠNG</option>
                        {relevantChapters.map(c => (
                            <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>
                        ))}
                    </select>
                </div>

                {/* Quick Status Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-black uppercase text-slate-400 shrink-0 mr-1">Lọc nhanh:</span>
                    {[
                        { id: 'all', label: `Tất cả (${stats.total})` },
                        { id: 'active', label: `🟢 Đang mở (${stats.activeCount})` },
                        { id: 'draft', label: `⚪ Bản nháp (${stats.draftCount})` },
                        { id: 'expired', label: `🟡 Hết hạn (${stats.expiredCount})` },
                        { id: 'classes', label: `🏫 Theo lớp (${stats.classesCount})` },
                        { id: 'all_grade', label: `🌐 Toàn khối (${stats.allGradeCount})` },
                        { id: 'unlisted', label: `🔒 Link riêng tư` },
                    ].map(chip => (
                        <button
                            key={chip.id}
                            onClick={() => setQStatusFilter(chip.id as QuizStatusFilter)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
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

            {/* ========================================================================= */}
            {/* PHẦN 1: GIAO DIỆN THƯ MỤC TRONG CHƯƠNG (GIỐNG HÌNH YÊU CẦU 100%) */}
            {/* ========================================================================= */}
            {viewMode === 'folders' && !activeFolderId && (
                <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="bg-white border-2 border-amber-100/90 rounded-[2rem] p-6 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200">
                                    <Folder size={22} className="text-amber-600" />
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h3 className="text-sm sm:text-base font-black uppercase text-slate-800 tracking-tight flex items-center gap-2">
                                        <span>{qChapterFilter === 'all' ? 'DANH SÁCH THƯ MỤC:' : 'THƯ MỤC TRONG:'}</span>
                                        <span className="text-amber-700">{currentChapterDisplayName}</span>
                                    </h3>
                                    <span className="px-3 py-1 bg-amber-100/90 text-amber-900 border border-amber-200 text-xs font-black rounded-full shadow-xs">
                                        {displayedFolders.length} thư mục
                                    </span>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    setEditingFolder(null);
                                    setIsFolderModalOpen(true);
                                }}
                                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-xs uppercase rounded-full shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
                            >
                                <span className="text-base font-bold leading-none">+</span>
                                <span>TẠO THƯ MỤC MỚI</span>
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 pt-1">
                            <span className="text-amber-600">💡 Hướng dẫn:</span>
                            <span className="text-slate-600">
                                Nhấp vào thư mục để xem toàn bộ đề thi bên trong. Bạn có thể chọn nhiều đề và bấm <strong>"Chuyển Thư Mục"</strong> để gom nhóm đề thi nhanh chóng.
                            </span>
                        </div>
                    </div>

                    {/* Danh sách Thư mục dạng Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {displayedFolders.map(folder => {
                            const count = getFolderQuizCount(folder);
                            const folderBg = folder.color === 'blue' 
                                ? 'bg-blue-500' 
                                : folder.color === 'emerald' 
                                    ? 'bg-emerald-500' 
                                    : folder.color === 'purple' 
                                        ? 'bg-purple-500' 
                                        : folder.color === 'rose' 
                                            ? 'bg-rose-500' 
                                            : folder.color === 'indigo' 
                                                ? 'bg-indigo-500' 
                                                : folder.color === 'cyan' 
                                                    ? 'bg-cyan-500' 
                                                    : 'bg-amber-500';

                            return (
                                <div
                                    key={folder.id}
                                    onClick={() => setActiveFolderId(folder.id)}
                                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                                >
                                    <div>
                                        {/* Top Icons */}
                                        <div className="flex items-center justify-between">
                                            <div className={`w-10 h-10 rounded-xl ${folderBg} text-white flex items-center justify-center shadow-sm transition-transform group-hover:scale-105`}>
                                                <Folder size={20} />
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => {
                                                        setEditingFolder(folder);
                                                        setIsFolderModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Sửa tên / đổi màu thư mục"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => requestDeleteFolder(folder.id, folder.name, count, e)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Xóa thư mục"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Badges: Khối & Chương */}
                                        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                            {folder.grade && (
                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase rounded">
                                                    {folder.grade === 'all' ? 'Tất cả khối' : `Khối ${folder.grade}`}
                                                </span>
                                            )}
                                            {folder.chapterName && (
                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-bold truncate max-w-[120px] rounded">
                                                    {folder.chapterName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Tên Thư mục */}
                                        <h4 className="text-[14px] font-bold text-slate-800 mt-2 group-hover:text-amber-600 transition-colors leading-snug line-clamp-2 min-h-[2.5rem]">
                                            {folder.name}
                                        </h4>

                                        {folder.description && (
                                            <p className="text-[11px] text-slate-400 font-normal mt-1 line-clamp-2">
                                                {folder.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Footer: Số lượng đề thi & Nút Mở thư mục */}
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
                                        <span className="text-xs font-black text-slate-700">
                                            {count} đề thi
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveFolderId(folder.id);
                                            }}
                                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[10.5px] uppercase rounded-xl shadow-sm flex items-center gap-1 transition-all"
                                        >
                                            <span>MỞ THƯ MỤC</span>
                                            <ChevronRight size={13} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Thư mục đề thi chưa phân loại (nếu có đề chưa gán folder) */}
                        {unassignedQuizzes.length > 0 && (
                            <div
                                onClick={() => setActiveFolderId('unassigned')}
                                className="bg-slate-50 border border-dashed border-slate-300 hover:border-slate-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shadow-xs">
                                        <Layers size={20} />
                                    </div>

                                    <h4 className="text-[14px] font-bold text-slate-700 mt-3 group-hover:text-slate-900 transition-colors leading-snug line-clamp-2 min-h-[2.5rem]">
                                        Đề chưa phân thư mục
                                    </h4>

                                    <p className="text-[11px] text-slate-400 font-normal mt-1 line-clamp-2">
                                        Xem và chọn nhiều đề để chuyển nhanh vào các thư mục.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-3">
                                    <span className="text-xs font-black text-slate-600">
                                        {unassignedQuizzes.length} đề thi
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveFolderId('unassigned');
                                        }}
                                        className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10.5px] uppercase rounded-xl shadow-xs flex items-center gap-1 transition-all"
                                    >
                                        <span>XEM & PHÂN LOẠI</span>
                                        <ChevronRight size={13} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Nút Tạo thư mục nhanh dạng card nếu chưa có thư mục */}
                        {displayedFolders.length === 0 && unassignedQuizzes.length === 0 && (
                            <div
                                onClick={() => {
                                    setEditingFolder(null);
                                    setIsFolderModalOpen(true);
                                }}
                                className="col-span-full py-16 bg-white rounded-[2.5rem] border-2 border-dashed border-amber-200 flex flex-col items-center justify-center text-center p-8 hover:bg-amber-50/40 transition-colors cursor-pointer"
                            >
                                <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-md mb-4">
                                    <FolderPlus size={32} />
                                </div>
                                <h3 className="text-base font-black text-slate-800 uppercase">
                                    Chưa có Thư mục nào phù hợp
                                </h3>
                                <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                                    Tạo các thư mục như "Đề kiểm tra 15p", "Đề ôn tập giữa kỳ", "Đề ôn chương" để gom nhóm và quản lý đề thi ngăn nắp hơn.
                                </p>
                                <button className="px-7 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-all">
                                    <Plus size={16} strokeWidth={3} />
                                    <span>TẠO THƯ MỤC MỚI</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* PHẦN 2: KHI ĐANG MỞ MỘT THƯ MỤC CỤ THỂ HOẶC Ở CHẾ ĐỘ TOÀN BỘ DANH SÁCH */}
            {/* ========================================================================= */}
            {(viewMode === 'flat' || activeFolderId) && (
                <div className="space-y-6">
                    {/* Breadcrumbs Bar khi đang xem chi tiết bên trong 1 Folder */}
                    {activeFolder && (
                        <div className="bg-white p-5 rounded-[2rem] border-2 border-amber-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={() => setActiveFolderId(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-colors"
                                >
                                    <ArrowLeft size={14} strokeWidth={3} />
                                    <span>TẤT CẢ THƯ MỤC</span>
                                </button>

                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <ChevronRight size={14} />
                                    <span className="text-blue-600 flex items-center gap-1">
                                        <BookOpen size={13} /> {activeFolder.chapterName || currentChapterDisplayName}
                                    </span>
                                    <ChevronRight size={14} />
                                    <span className="text-slate-800 font-black flex items-center gap-1">
                                        <Folder size={14} className="text-amber-500" /> {activeFolder.name}
                                    </span>
                                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-black rounded-full text-[10px]">
                                        {filtered.length} đề thi
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {activeFolder.id !== 'unassigned' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditingFolder(activeFolder);
                                                setIsFolderModalOpen(true);
                                            }}
                                            className="px-3.5 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            <Edit size={13} />
                                            <span>Đổi tên / Màu</span>
                                        </button>
                                        <button
                                            onClick={(e) => requestDeleteFolder(activeFolder.id, activeFolder.name, filtered.length, e)}
                                            className="px-3.5 py-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                                            title="Xóa thư mục này"
                                        >
                                            <Trash2 size={13} />
                                            <span>Xóa Thư Mục</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

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
                                        Chuyển nhanh vào Thư mục, gán phòng học hoặc xuất file JSON
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Nút Chuyển nhanh vào Thư mục */}
                                <button
                                    onClick={openMoveModalBatch}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] shadow-sm transition-all"
                                >
                                    <FolderInput size={14} />
                                    <span>Chuyển Thư Mục ({selectedQuizIds.length})</span>
                                </button>

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
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-sm transition-all disabled:opacity-50"
                                    title="Tải về file JSON tổng hợp các đề đã chọn"
                                >
                                    {isBatchExporting ? <Loader2 size={14} className="animate-spin" /> : <FileCode size={14} />}
                                    <span>Xuất JSON ({selectedQuizIds.length})</span>
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
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
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

                    {/* Danh sách đề thi */}
                    {visibleQuizzes.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
                            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                                <FileText size={32} />
                            </div>
                            <h4 className="text-base font-black text-slate-700 uppercase">Chưa có đề thi nào trong danh mục này</h4>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                Bạn có thể tạo đề thi mới hoặc dùng tính năng chuyển thư mục để đưa đề vào đây.
                            </p>
                        </div>
                    ) : (
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
                                            {/* Top bar: Checkbox, Grade, Year, and Action buttons */}
                                            <div className="flex justify-between items-center gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={(e) => toggleSelectQuiz(q.id, e)}
                                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                                            isSelected 
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                                                                : 'border-slate-300 bg-white hover:border-slate-400'
                                                        }`}
                                                        title="Chọn đề"
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

                                                    {/* BỘ CHỌN & SỬA NIÊN KHÓA TRỰC TIẾP */}
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
                                                            title="Đổi niên khóa"
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

                                                {/* Nút sửa đề & chuyển thư mục góc trên phải */}
                                                <div className="flex items-center gap-1">
                                                    {/* Nút chuyển thư mục nhanh */}
                                                    <button
                                                        onClick={(e) => openMoveModalSingle(q, e)}
                                                        className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white rounded-lg border border-amber-200 transition-colors"
                                                        title="Chuyển vào Thư mục khác"
                                                    >
                                                        <FolderInput size={12}/>
                                                    </button>
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

                                            {/* Status & Room & Folder Badges */}
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {/* Folder Badge nếu có */}
                                                {q.folderName && (
                                                    <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1">
                                                        <Folder size={9} className="text-amber-600" />
                                                        {q.folderName}
                                                    </span>
                                                )}

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
                                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 transition-colors"
                                                        title="Gán cho lớp cụ thể"
                                                    >
                                                        <Globe size={9} className="text-slate-400"/>
                                                        Toàn khối
                                                    </button>
                                                )}

                                                <span className={`px-2 py-0.5 rounded-md text-[7.5px] font-black uppercase ${
                                                    q.type === 'practice' 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {q.type === 'practice' ? 'Luyện tập' : 'Bài thi'}
                                                </span>

                                                {!q.isPublished && (
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[7.5px] font-black uppercase">
                                                        Bản nháp
                                                    </span>
                                                )}

                                                {state.isExpired && q.isPublished && (
                                                    <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[7.5px] font-black uppercase shadow-xs">
                                                        Hết hạn
                                                    </span>
                                                )}

                                                {/* Nút BẬT / TẮT Xem Đáp Án */}
                                                {onToggleAllowReview && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onToggleAllowReview(q.id, q.allowReview ?? true);
                                                        }}
                                                        className={`px-2 py-0.5 rounded-md text-[7.5px] font-black uppercase flex items-center gap-1 transition-all border ${
                                                            (q.allowReview ?? true)
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                        }`}
                                                        title={(q.allowReview ?? true) ? "Học sinh ĐƯỢC xem đáp án. Bấm để KHÓA đáp án" : "Đang KHÓA đáp án. Bấm để MỞ cho học sinh xem"}
                                                    >
                                                        {(q.allowReview ?? true) ? <Eye size={9} className="text-emerald-600" /> : <EyeOff size={9} className="text-rose-600" />}
                                                        {(q.allowReview ?? true) ? 'Mở đáp án' : 'Khóa đáp án'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Tiêu đề đề thi */}
                                            <h4 
                                                className="font-black text-slate-800 text-xs sm:text-sm line-clamp-2 uppercase group-hover:text-blue-600 transition-colors cursor-pointer"
                                                onClick={() => onPreview(q)}
                                                title="Nhấp để xem trước đề thi"
                                            >
                                                {q.title}
                                            </h4>

                                            {/* Thông tin câu hỏi, thời gian, lượt nộp */}
                                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 pt-1 border-t border-slate-100">
                                                <span className="flex items-center gap-1">
                                                    <FileText size={10} className="text-slate-400"/>
                                                    {q.questionCount || (q.questions ? q.questions.length : 0)} câu
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} className="text-slate-400"/>
                                                    {q.durationMinutes} phút
                                                </span>
                                                <span className="flex items-center gap-1 text-blue-600 font-black">
                                                    <Users size={10}/>
                                                    {qResults.length} bài
                                                </span>
                                            </div>
                                        </div>

                                        {/* Bottom Action: Xem trước & Xuất JSON */}
                                        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => onPreview(q)}
                                                className="flex-1 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <Eye size={12} />
                                                <span>Xem trước</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleExportSingleQuiz(q, e)}
                                                disabled={exportingQuizId === q.id}
                                                className="p-2 bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-600 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                                                title="Xuất file JSON đề thi"
                                            >
                                                {exportingQuizId === q.id ? <Loader2 size={13} className="animate-spin" /> : <FileCode size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination Button */}
                    {visibleCount < filtered.length && (
                        <div className="text-center pt-4">
                            <button
                                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                                className="px-8 py-3.5 bg-white border-2 border-slate-200 hover:border-slate-400 text-slate-700 font-black text-xs uppercase rounded-2xl shadow-sm transition-all"
                            >
                                Xem thêm {Math.min(PAGE_SIZE, filtered.length - visibleCount)} đề thi tiếp theo...
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal Tạo / Sửa Thư mục */}
            <FolderModal
                isOpen={isFolderModalOpen}
                onClose={() => {
                    setIsFolderModalOpen(false);
                    setEditingFolder(null);
                }}
                onSave={async (folder) => {
                    if (onSaveFolder) {
                        await onSaveFolder(folder);
                    }
                }}
                initialFolder={editingFolder}
                defaultChapterName={qChapterFilter !== 'all' ? qChapterFilter : undefined}
                defaultGrade={qGradeFilter !== 'all' ? qGradeFilter : '12'}
                chapters={relevantChapters}
            />

            {/* Modal Chuyển đề thi vào Thư mục */}
            <FolderMoveModal
                isOpen={isMoveModalOpen}
                onClose={() => {
                    setIsMoveModalOpen(false);
                    setMoveModalQuizzes([]);
                }}
                onConfirm={handleConfirmMoveToFolder}
                quizzes={moveModalQuizzes}
                folders={folders}
                chapters={relevantChapters}
                currentChapterFilter={qChapterFilter !== 'all' ? qChapterFilter : undefined}
                onOpenCreateFolder={() => {
                    setEditingFolder(null);
                    setIsFolderModalOpen(true);
                }}
            />

            {/* Modal Gán phòng thi */}
            <QuickAssignModal
                isOpen={isAssignModalOpen}
                onClose={() => {
                    setIsAssignModalOpen(false);
                    setAssignModalQuizzes([]);
                }}
                onSave={handleSaveQuickAssign}
                targetQuizzes={assignModalQuizzes}
                classes={classes}
            />

            {/* Modal Xác nhận Xóa Thư mục (An toàn dữ liệu, không dùng popup mặc định) */}
            {folderToDelete && (
                <div 
                    className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => {
                        if (!isDeletingFolder) setFolderToDelete(null);
                    }}
                >
                    <div 
                        className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col gap-5 text-center animate-scale-up relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            disabled={isDeletingFolder}
                            onClick={() => setFolderToDelete(null)}
                            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        {/* Top Icon */}
                        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center mx-auto shadow-xs">
                            <FolderX size={32} />
                        </div>

                        {/* Title & Folder Name */}
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase">
                                Xác nhận xóa Thư mục
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Thao tác này sẽ xóa thư mục và hoàn trả đề thi về vị trí an toàn.
                            </p>
                        </div>

                        {/* Folder Info Box */}
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-left">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                    <Folder size={18} />
                                </div>
                                <div className="truncate">
                                    <div className="text-xs font-black text-slate-800 truncate">
                                        {folderToDelete.name}
                                    </div>
                                    <div className="text-[11px] font-semibold text-slate-400">
                                        Đang chứa {folderToDelete.count} đề thi
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Safety Notice */}
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-black text-emerald-900 uppercase text-[11px]">
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                <span>Bảo toàn 100% dữ liệu đề thi</span>
                            </div>
                            <p className="text-emerald-800 leading-relaxed font-medium text-[11.5px]">
                                Toàn bộ <strong>{folderToDelete.count} đề thi</strong> trong thư mục này <u>KHÔNG</u> bị xóa. Chúng sẽ được tự động hoàn trả về mục <strong>"Đề chưa phân thư mục"</strong> của chương.
                            </p>
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isDeletingFolder}
                                onClick={() => setFolderToDelete(null)}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase rounded-xl transition-all cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={isDeletingFolder}
                                onClick={handleConfirmDeleteFolder}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isDeletingFolder ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Đang xóa...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Đồng ý xóa</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
