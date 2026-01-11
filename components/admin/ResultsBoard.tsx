
import React from 'react';
import { Result, Quiz, Grade, Chapter } from '../../types';
import { Search, BarChart3, Eraser, Trash2, List, Eye } from 'lucide-react';
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
    onViewHistory: (studentName: string, quizTitle: string, history: Result[]) => void;
    onDeleteResult: (history: Result[]) => void;
}

const ResultsBoard: React.FC<ResultsBoardProps> = ({ 
    results, quizzes, chapters, rGradeFilter, setRGradeFilter, 
    rChapterFilter, setRChapterFilter, rQuizFilter, setRQuizFilter,
    onClearCache, onViewHistory, onDeleteResult
}) => {
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

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black uppercase flex items-center gap-3"><BarChart3 className="text-blue-600"/> Bảng điểm</h3>
                    <button onClick={onClearCache} className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Eraser size={14}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase" value={rGradeFilter} onChange={e => setRGradeFilter(e.target.value as any)}><option value="all">Tất cả Khối</option><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase" value={rChapterFilter} onChange={e => setRChapterFilter(e.target.value)}><option value="all">Tất cả Chương</option>{chapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase" value={rQuizFilter} onChange={e => setRQuizFilter(e.target.value)}><option value="all">Tất cả Đề thi</option>{quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select>
                </div>
            </div>
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Đề thi</th><th className="p-6 text-center">Lượt làm</th><th className="p-6 text-center">Điểm cao nhất</th><th className="p-6 text-center">Lịch sử</th><th className="p-6 text-center">Xóa</th></tr></thead>
                    <tbody className="divide-y">
                        {groupedResults.map((group, gIdx) => (
                            <tr key={gIdx} className="hover:bg-slate-50">
                                <td className="p-6 font-bold text-slate-800 uppercase">{group.latest.studentName}</td>
                                <td className="p-6 text-sm text-slate-500 uppercase">{quizzes.find(item => item.id === group.latest.quizId)?.title || 'Đề đã xóa'}</td>
                                <td className="p-6 text-center font-black text-blue-600">{group.history.length}</td>
                                <td className="p-6 text-center font-black text-emerald-600">{Math.max(...group.history.map(h => h.score)).toFixed(2)}</td>
                                <td className="p-6 text-center"><button onClick={() => onViewHistory(group.latest.studentName, 'Chi tiết', group.history)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><List size={16}/></button></td>
                                <td className="p-6 text-center"><button onClick={() => onDeleteResult(group.history)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ResultsBoard;
