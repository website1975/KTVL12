
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExamSession, Quiz, Result, PublishedResult, Grade, QuizType } from '../../types';
import { getExamSessions, getResults, getQuizzes, savePublishedResult, deleteExamSession, getPublishedResults, deletePublishedResult, clearAllSessions, isDatabaseConnected } from '../../services/storage';
import { ShieldAlert, RefreshCw, Filter, CheckSquare, Square, XCircle, WifiOff, Wifi, Eraser, FileText, Medal, History, Trophy, Search, Trash2, Database } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const ExamMonitor: React.FC = () => {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [publishedHistory, setPublishedHistory] = useState<PublishedResult[]>([]);
    
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
    
    const [searchCode, setSearchCode] = useState('');
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [now, setNow] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dbStatus = isDatabaseConnected();

    useEffect(() => {
        refreshData();
        const interval = setInterval(() => {
            refreshData(true);
            setNow(new Date());
        }, 15000); // Tăng lên 15s để giảm tải tối đa
        return () => clearInterval(interval);
    }, [selectedQuizId]); // Refresh khi đổi đề

    const refreshData = async (silent = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            // Tối ưu: Chỉ fetch kết quả và session của đề đang chọn
            const [s, r, q, p] = await Promise.all([
                getExamSessions(selectedQuizId), 
                getResults(selectedQuizId), 
                getQuizzes(),
                getPublishedResults()
            ]);
            setSessions(s);
            setResults(r);
            setQuizzes(q);
            setPublishedHistory(p.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
        } catch (error) {
            console.error("Lỗi giám sát:", error);
        } finally {
            if (!silent) setIsRefreshing(false);
        }
    };

    const handleHardReset = async () => {
        if (!confirm("CẢNH BÁO: Xóa sạch toàn bộ phiên thi ảo để giải cứu database?")) return;
        setIsRefreshing(true);
        await clearAllSessions();
        refreshData();
    };

    const activeSessions = useMemo(() => {
        return sessions.filter(s => {
            const quiz = quizzes.find(q => q.id === s.quizId);
            if (!quiz) return false;
            return filterGrade === 'all' || quiz.grade === filterGrade;
        });
    }, [sessions, quizzes, filterGrade]);

    const bestResultsForBoard = useMemo(() => {
        if (selectedQuizId === 'all') return [];
        const grouped: Record<string, Result> = {};
        results.forEach(r => {
            const code = r.studentCode?.toUpperCase() || `ID_${r.studentId}`;
            if (!grouped[code] || r.score > grouped[code].score) grouped[code] = r;
        });
        return Object.values(grouped).filter(r => !searchCode || r.studentCode?.toUpperCase().includes(searchCode.toUpperCase())).sort((a, b) => b.score - a.score);
    }, [results, selectedQuizId, searchCode]);

    const handlePublish = async () => {
        if (selectedQuizId === 'all') return;
        const resultsToPublish = bestResultsForBoard.filter(r => selectedResultIds.has(r.id));
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        const pub: PublishedResult = {
            id: uuidv4(), quizId: selectedQuizId, quizTitle: quiz?.title || '',
            publishedAt: new Date().toISOString(),
            studentCodes: resultsToPublish.map(r => r.studentCode || ''),
            results: resultsToPublish
        };
        await savePublishedResult(pub);
        setSelectedResultIds(new Set());
        refreshData();
    };

    return (
        <div className="space-y-8 pb-32">
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg"><ShieldAlert size={24}/></div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight leading-none">Kiểm soát phòng thi</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <div className={`w-2 h-2 rounded-full ${dbStatus ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                <span className="text-[10px] font-black uppercase text-slate-400">Database: {dbStatus ? 'Ổn định' : 'Mất kết nối'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleHardReset} className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase border border-red-100">
                            Giải cứu treo
                        </button>
                        <button onClick={() => refreshData()} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''}/></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Khối lớp</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black outline-none" value={filterGrade} onChange={e => setFilterGrade(e.target.value as any)}>
                            <option value="all">Tất cả</option>
                            <option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option>
                        </select>
                    </div>
                    <div className="col-span-1 md:col-span-3 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Lọc theo đề đang thi</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black outline-none" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                            <option value="all">Xem tất cả (Nặng database)</option>
                            {quizzes.filter(q => q.isPublished).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                <div className="p-6 border-b bg-slate-50 flex items-center gap-3">
                    <h3 className="text-[11px] font-black uppercase text-slate-500">Đang trực tuyến ({activeSessions.length})</h3>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white border-b text-[10px] font-black uppercase text-slate-400"><th className="p-6">Thí sinh</th><th className="p-6 text-center">Vi phạm</th><th className="p-6 text-center">Kết nối</th><th className="p-6 text-center">Xóa</th></tr>
                    </thead>
                    <tbody className="divide-y">
                        {activeSessions.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-all">
                                <td className="p-6"><p className="font-black uppercase text-xs">{s.studentName}</p><p className="text-[9px] text-slate-400 uppercase">MS: {s.studentCode}</p></td>
                                <td className="p-6 text-center"><span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black">{s.violationCount}/3</span></td>
                                <td className="p-6 text-center">{differenceInSeconds(now, new Date(s.lastUpdate)) > 60 ? <WifiOff size={16} className="mx-auto text-red-400"/> : <Wifi size={16} className="mx-auto text-emerald-500"/>}</td>
                                <td className="p-6 text-center"><button onClick={() => deleteExamSession(s.id).then(() => refreshData())} className="text-slate-300 hover:text-red-500"><XCircle size={18}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedQuizId !== 'all' && (
                <div className="bg-slate-900 p-8 rounded-[3.5rem] shadow-2xl space-y-8">
                    <div className="flex justify-between items-center text-white">
                        <div className="flex items-center gap-4">
                            <Trophy size={24} className="text-yellow-500"/>
                            <h3 className="text-xl font-black uppercase italic">Bảng Vàng Vinh Danh</h3>
                        </div>
                        <button onClick={handlePublish} disabled={selectedResultIds.size === 0} className="px-8 py-3 bg-yellow-500 text-slate-900 rounded-2xl font-black text-[11px] uppercase disabled:opacity-30">CÔNG BỐ ({selectedResultIds.size})</button>
                    </div>
                    <div className="bg-slate-800/50 p-6 rounded-[2rem] overflow-x-auto">
                        <table className="w-full text-left text-white">
                            <thead><tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700"><th className="p-4">Hạng</th><th className="p-4">Tên</th><th className="p-4 text-center">Điểm</th><th className="p-4 text-center">Chọn</th></tr></thead>
                            <tbody className="divide-y divide-slate-700">
                                {bestResultsForBoard.map((r, idx) => {
                                    const isSelected = selectedResultIds.has(r.id);
                                    return (
                                        <tr key={r.id} onClick={() => { const s = new Set(selectedResultIds); isSelected ? s.delete(r.id) : s.add(r.id); setSelectedResultIds(s); }} className="cursor-pointer hover:bg-white/5">
                                            <td className="p-4 text-xs font-black">{idx + 1}</td>
                                            <td className="p-4 text-xs font-bold uppercase">{r.studentName}</td>
                                            <td className="p-4 text-center text-xl font-black text-yellow-500">{r.score.toFixed(2)}</td>
                                            <td className="p-4 text-center">{isSelected ? <CheckSquare className="mx-auto text-yellow-500" /> : <Square className="mx-auto text-slate-600" />}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamMonitor;
