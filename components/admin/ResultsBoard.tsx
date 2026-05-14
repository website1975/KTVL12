
import React, { useState, useEffect } from 'react';
import { Result, Quiz, Grade, Chapter, User as UserType } from '../../types';
import { Search, BarChart3, Eraser, Trash2, List, Eye, User, FileText, Filter, ShieldAlert, Sparkles, Loader2, CheckCircle2, AlertCircle, ChevronDown, RefreshCw, Clock, Medal } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { updateResultCode, deleteResult } from '../../services/storage';

interface ResultsBoardProps {
    results: Result[];
    quizzes: Quiz[];
    users: UserType[]; 
    chapters: Chapter[];
    rGradeFilter: Grade | 'all';
    setRGradeFilter: (val: Grade | 'all') => void;
    rChapterFilter: string;
    setRChapterFilter: (val: string) => void;
    rQuizFilter: string;
    setRQuizFilter: (val: string) => void;
    rSearch: string;
    setRSearch: (val: string) => void;
    onClearCache: () => void;
    onRefresh: () => void;
    onViewHistory: (studentName: string, studentCode: string, quizTitle: string, history: Result[]) => void;
    onDeleteResult: (history: Result[]) => void;
    onImportCsv: (e: React.ChangeEvent<HTMLInputElement>) => void;
    totalCount: number;
    onLoadMore: () => void;
    isMoreLoading: boolean;
}

const PAGE_SIZE = 20;

export default function ResultsBoard({ 
    results, quizzes, users, chapters, rGradeFilter, setRGradeFilter, 
    rChapterFilter, setRChapterFilter, rQuizFilter, setRQuizFilter,
    rSearch, setRSearch,
    onClearCache, onRefresh, onViewHistory, onDeleteResult, onImportCsv,
    totalCount, onLoadMore, isMoreLoading
}: ResultsBoardProps) {
    const [isFixing, setIsFixing] = useState(false);
    const [fixReport, setFixReport] = useState<{updated: number, deleted: number} | null>(null);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    const getEffectiveStudentCode = (res: Result) => {
        if (res.studentCode && res.studentCode !== 'N/A') return res.studentCode;
        const user = users.find(u => u.id === res.studentId);
        return user?.studentCode || 'N/A';
    };

    const handleAutoFix = async () => {
        if (!confirm('Hệ thống sẽ đối soát ID học sinh để cập nhật MAHS bị thiếu. Tiếp tục?')) return;
        setIsFixing(true);
        let updatedCount = 0;
        const naResults = results.filter(r => !r.studentCode || r.studentCode === 'N/A');
        for (const res of naResults) {
            const user = users.find(u => u.id === res.studentId);
            if (user && user.studentCode && user.studentCode !== 'N/A') {
                await updateResultCode(res.id, user.studentCode);
                updatedCount++;
            }
        }
        setFixReport({ updated: updatedCount, deleted: 0 });
        setIsFixing(false);
        setTimeout(() => window.location.reload(), 2000);
    };

    const handleDeleteRemainingNA = async () => {
        const naResults = results.filter(r => !r.studentCode || r.studentCode === 'N/A');
        if (naResults.length === 0) return alert("Không còn bản ghi N/A nào!");
        if (!confirm(`Xóa vĩnh viễn ${naResults.length} bản ghi rác không thể truy vết?`)) return;
        setIsFixing(true);
        for (const res of naResults) { await deleteResult(res.id); }
        setFixReport({ updated: 0, deleted: naResults.length });
        setIsFixing(false);
        setTimeout(() => window.location.reload(), 2000);
    };

    const groupedResults = React.useMemo(() => {
        const lowerSearch = rSearch.toLowerCase();
        const filtered = results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            const studentCode = getEffectiveStudentCode(r);
            const studentName = (r.studentName || '').toLowerCase();
            
            const matchSearch = !rSearch || 
                studentName.includes(lowerSearch) || 
                studentCode.toLowerCase().includes(lowerSearch);

            const matchGrade = rGradeFilter === 'all' || (quiz && quiz.grade === rGradeFilter);
            const matchChapter = rChapterFilter === 'all' || (quiz && quiz.category === rChapterFilter);
            const matchQuiz = rQuizFilter === 'all' || r.quizId === rQuizFilter;
            
            return matchSearch && matchGrade && matchChapter && matchQuiz;
        });

        const groups: Record<string, { key: string, latest: Result, history: Result[], effectiveCode: string }> = {};
        filtered.forEach(r => {
            const code = getEffectiveStudentCode(r);
            const key = `${code}_${r.quizId}`;
            if (!groups[key]) {
                groups[key] = { key, latest: r, history: [r], effectiveCode: code };
            } else {
                groups[key].history.push(r);
                if (isAfter(new Date(r.submittedAt), new Date(groups[key].latest.submittedAt))) {
                    groups[key].latest = r;
                }
            }
        });
        
        const sortedGroups = Object.values(groups).sort((a, b) => 
            new Date(b.latest.submittedAt).getTime() - new Date(a.latest.submittedAt).getTime()
        );

        return sortedGroups;
    }, [results, quizzes, users, rGradeFilter, rChapterFilter, rQuizFilter, rSearch]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedGroups(groupedResults.map(g => g.key));
        } else {
            setSelectedGroups([]);
        }
    };

    const handleToggleGroup = (key: string) => {
        setSelectedGroups(prev => 
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleBulkDelete = () => {
        const resultsToDelete = groupedResults
            .filter(g => selectedGroups.includes(g.key))
            .flatMap(g => g.history);
        
        if (resultsToDelete.length === 0) return;
        if (confirm(`Bạn có chắc muốn xóa tất cả ${resultsToDelete.length} bản ghi của ${selectedGroups.length} nhóm kết quả đã chọn?`)) {
            onDeleteResult(resultsToDelete);
            setSelectedGroups([]);
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}p`;
        if (m > 0) return `${m}p ${s}s`;
        return `${s}s`;
    };

    const naCount = results.filter(r => !r.studentCode || r.studentCode === 'N/A').length;
    const relevantChapters = chapters.filter(c => rGradeFilter === 'all' || c.grade === rGradeFilter);
    const relevantQuizzes = quizzes.filter(q => 
        (rGradeFilter === 'all' || q.grade === rGradeFilter) &&
        (rChapterFilter === 'all' || q.category === rChapterFilter)
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {naCount > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 p-8 rounded-[3rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-orange-500 text-white rounded-[1.5rem] shadow-lg"><ShieldAlert size={28}/></div>
                        <div>
                            <h4 className="text-orange-900 font-black uppercase text-sm">Phát hiện {naCount} bản ghi chưa có MAHS</h4>
                            <p className="text-orange-700 text-[10px] font-bold uppercase tracking-tight mt-1 leading-tight">Có thể đây là dữ liệu cũ hoặc từ tài khoản đã bị xóa.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button disabled={isFixing} onClick={handleAutoFix} className="flex items-center gap-2 px-6 py-4 bg-white text-orange-600 border border-orange-200 rounded-2xl hover:bg-orange-600 hover:text-white transition-all text-[10px] font-black uppercase shadow-sm">
                            {isFixing ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} Tự động sửa lỗi
                        </button>
                        <button disabled={isFixing} onClick={handleDeleteRemainingNA} className="flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all text-[10px] font-black uppercase shadow-xl">
                            <Trash2 size={14}/> Xóa dữ liệu rác
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><BarChart3 size={20}/></div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Bảng điểm tổng hợp</h3>
                            <div className="flex gap-4 mt-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Cloud: {results.length} bản ghi</span>
                                <span className="text-[9px] font-black text-blue-500 uppercase">Hiển thị: {groupedResults.length} dòng</span>
                                {selectedGroups.length > 0 && (
                                    <span className="text-[9px] font-black text-red-500 uppercase">Đã chọn: {selectedGroups.length} nhóm</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {selectedGroups.length > 0 && (
                            <button onClick={handleBulkDelete} className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl hover:bg-black transition-all text-[10px] font-black uppercase shadow-xl">
                                <Trash2 size={14}/> Xóa Đã Chọn ({selectedGroups.length})
                            </button>
                        )}
                        <button onClick={onRefresh} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-900 hover:text-white transition-all text-[10px] font-black uppercase">
                            <RefreshCw size={14}/> Làm mới Cloud
                        </button>
                        <button onClick={() => document.getElementById('import-results-csv')?.click()} className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase">
                            <FileText size={14}/> Nạp CSV
                            <input id="import-results-csv" type="file" accept=".csv" className="hidden" onChange={onImportCsv}/>
                        </button>
                        <button onClick={onClearCache} className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase">
                            <Eraser size={14}/> Xóa sạch Cache
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Search size={10}/> Tìm học sinh</label>
                        <input 
                            type="text" 
                            placeholder="Tên hoặc MAHS..." 
                            className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black outline-none focus:border-blue-400"
                            value={rSearch}
                            onChange={e => setRSearch(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Filter size={10}/> Khối lớp</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-400" value={rGradeFilter} onChange={e => { setRGradeFilter(e.target.value as any); setRChapterFilter('all'); setRQuizFilter('all'); }}>
                            <option value="all">Tất cả Khối</option>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Filter size={10}/> Chương học</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-400" value={rChapterFilter} onChange={e => { setRChapterFilter(e.target.value); setRQuizFilter('all'); }}>
                            <option value="all">Tất cả Chương</option>
                            {relevantChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Filter size={10}/> Đề thi</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none focus:border-blue-400" value={rQuizFilter} onChange={e => setRQuizFilter(e.target.value)}>
                            <option value="all">Tất cả Đề thi</option>
                            {relevantQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                            <th className="p-6 w-12">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={groupedResults.length > 0 && selectedGroups.length === groupedResults.length}
                                    onChange={e => handleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="p-6">Học sinh / Mã số</th>
                            <th className="p-6">Đề thi</th>
                            <th className="p-6 text-center">Lượt làm</th>
                            <th className="p-6 text-center">Rèn luyện</th>
                            <th className="p-6 text-center">Tích lũy</th>
                            <th className="p-6 text-center">Điểm cao nhất</th>
                            <th className="p-6 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {groupedResults.map((group, gIdx) => {
                            const quiz = quizzes.find(item => item.id === group.latest.quizId);
                            const maxScore = Math.max(...group.history.map(h => h.score));
                            const totalTime = group.history.reduce((sum, h) => sum + (h.durationSeconds || 0), 0);
                            const totalAccumulated = group.history.reduce((sum, h) => sum + (h.score + (h.bonusPoint || 0)), 0);
                            const isNA = group.effectiveCode === 'N/A';
                            const isSelected = selectedGroups.includes(group.key);
                            return (
                                <tr key={gIdx} className={`hover:bg-slate-50 transition-colors group ${isNA ? 'bg-orange-50/20' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-6">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={isSelected}
                                            onChange={() => handleToggleGroup(group.key)}
                                        />
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 ${isNA ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-600'} rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all`}><User size={18}/></div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-sm leading-tight">{group.latest.studentName}</p>
                                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isNA ? 'text-orange-500' : 'text-slate-400'}`}>MAHS: {group.effectiveCode}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-slate-300"/>
                                            <p className="text-sm font-bold text-slate-600 uppercase leading-snug max-w-[200px] truncate">{quiz?.title || 'Đề đã xóa'}</p>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-500">{group.history.length} lần</span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[11px] font-black text-slate-600 flex items-center gap-1"><Clock size={10}/> {formatDuration(totalTime)}</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[11px] font-black text-emerald-600 flex items-center gap-1"><Medal size={10}/> {totalAccumulated.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`text-lg font-black ${maxScore >= 8 ? 'text-emerald-600' : maxScore >= 5 ? 'text-blue-600' : 'text-orange-500'}`}>
                                            {maxScore.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => onViewHistory(group.latest.studentName, group.effectiveCode, quiz?.title || 'Đề thi', group.history)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase shadow-sm"><Eye size={14}/> Chi tiết</button>
                                            <button onClick={() => onDeleteResult(group.history)} className="p-3 text-slate-300 hover:text-red-500 transition-colors" title="Xóa toàn bộ lịch sử này"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {results.length < totalCount && (
                    <div className="p-8 text-center bg-slate-50/50">
                        <button 
                            onClick={onLoadMore}
                            disabled={isMoreLoading}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm disabled:opacity-50"
                        >
                            {isMoreLoading ? <Loader2 className="animate-spin" size={14}/> : <ChevronDown size={14}/>} 
                            Tải thêm dữ liệu từ Cloud (Tổng: {totalCount}, Đã tải: {results.length})
                        </button>
                    </div>
                )}
                {groupedResults.length === 0 && (
                    <div className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest italic">Chưa có dữ liệu điểm số nào phù hợp</div>
                )}
            </div>
        </div>
    );
}
