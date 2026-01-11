
import React from 'react';
import { Result, Quiz, Grade, Chapter } from '../../types';
import { Search, BarChart3, Eraser, Trash2, List, Eye, User, FileText, Filter } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';

interface ResultsBoardProps {
    results: Result[];
    quizzes: Quiz[];
    chapters: Chapter[];
    rGradeFilter: Grade | 'all';
    setRGradeFilter: (val: Grade | 'all') => void;
    rChapterFilter: string;
    setRChapterFilter: (val: string) => void;
    rQuizFilter: string;
    setRQuizFilter: (val: string) => void;
    onClearCache: () => void;
    onViewHistory: (studentName: string, studentCode: string, quizTitle: string, history: Result[]) => void;
    onDeleteResult: (history: Result[]) => void;
}

const ResultsBoard: React.FC<ResultsBoardProps> = ({ 
    results, quizzes, chapters, rGradeFilter, setRGradeFilter, 
    rChapterFilter, setRChapterFilter, rQuizFilter, setRQuizFilter,
    onClearCache, onViewHistory, onDeleteResult
}) => {
    // Logic gộp kết quả: Mỗi học sinh + Mỗi đề = 1 dòng (hiển thị điểm cao nhất và số lần làm)
    const groupedResults = React.useMemo(() => {
        const filtered = results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            const matchGrade = rGradeFilter === 'all' || (quiz && quiz.grade === rGradeFilter);
            const matchChapter = rChapterFilter === 'all' || (quiz && quiz.category === rChapterFilter);
            const matchQuiz = rQuizFilter === 'all' || r.quizId === rQuizFilter;
            return matchGrade && matchChapter && matchQuiz;
        });

        const groups: Record<string, { latest: Result, history: Result[] }> = {};
        filtered.forEach(r => {
            const key = r.studentCode ? `${r.studentCode}_${r.quizId}` : `${r.studentId}_${r.quizId}`;
            if (!groups[key]) {
                groups[key] = { latest: r, history: [r] };
            } else {
                groups[key].history.push(r);
                if (isAfter(parseISO(r.submittedAt), parseISO(groups[key].latest.submittedAt))) {
                    groups[key].latest = r;
                }
            }
        });
        return Object.values(groups).sort((a, b) => isAfter(parseISO(b.latest.submittedAt), parseISO(a.latest.submittedAt)) ? 1 : -1);
    }, [results, quizzes, rGradeFilter, rChapterFilter, rQuizFilter]);

    const relevantChapters = chapters.filter(c => rGradeFilter === 'all' || c.grade === rGradeFilter);
    const relevantQuizzes = quizzes.filter(q => 
        (rGradeFilter === 'all' || q.grade === rGradeFilter) &&
        (rChapterFilter === 'all' || q.category === rChapterFilter)
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Thanh lọc kết quả */}
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><BarChart3 size={20}/></div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Bảng điểm tổng hợp</h3>
                    </div>
                    <button 
                        onClick={onClearCache} 
                        className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase"
                    >
                        <Eraser size={14}/> Dọn dẹp cache
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Bảng hiển thị */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                            <th className="p-6">Học sinh / Mã số</th>
                            <th className="p-6">Đề thi</th>
                            <th className="p-6 text-center">Lượt làm</th>
                            <th className="p-6 text-center">Điểm cao nhất</th>
                            <th className="p-6 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {groupedResults.map((group, gIdx) => {
                            const quiz = quizzes.find(item => item.id === group.latest.quizId);
                            const maxScore = Math.max(...group.history.map(h => h.score));
                            
                            return (
                                <tr key={gIdx} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all"><User size={18}/></div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-sm leading-tight">{group.latest.studentName}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">MAHS: {group.latest.studentCode || 'N/A'}</p>
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
                                        <span className={`text-lg font-black ${maxScore >= 8 ? 'text-emerald-600' : maxScore >= 5 ? 'text-blue-600' : 'text-orange-500'}`}>
                                            {maxScore.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => onViewHistory(group.latest.studentName, group.latest.studentCode || 'N/A', quiz?.title || 'Đề thi', group.history)} 
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase shadow-sm"
                                            >
                                                <Eye size={14}/> Chi tiết
                                            </button>
                                            <button 
                                                onClick={() => onDeleteResult(group.history)} 
                                                className="p-3 text-slate-300 hover:text-red-500 transition-colors"
                                                title="Xóa toàn bộ lịch sử này"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {groupedResults.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-20 text-center">
                                    <BarChart3 size={48} className="mx-auto text-slate-200 mb-4"/>
                                    <p className="font-black text-slate-300 uppercase tracking-widest">Chưa có dữ liệu điểm số</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResultsBoard;
