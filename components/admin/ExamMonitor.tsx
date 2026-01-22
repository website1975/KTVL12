
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExamSession, Quiz, Result, PublishedResult, Grade, QuizType } from '../../types';
import { getExamSessions, getResults, getQuizzes, savePublishedResult, deleteExamSession } from '../../services/storage';
import { ShieldAlert, Users, Clock, Search, Send, Trophy, RefreshCw, Trash2, Filter, CheckSquare, Square, XCircle, WifiOff, Wifi, Eraser, FileText } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const ExamMonitor: React.FC = () => {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    
    // Bộ lọc giám sát
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
    const [filterType, setFilterType] = useState<QuizType | 'all'>('all');
    
    const [searchCode, setSearchCode] = useState('');
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [now, setNow] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const deletingIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        refreshData();
        const interval = setInterval(() => {
            refreshData(true);
            setNow(new Date());
        }, 5000); 
        return () => clearInterval(interval);
    }, []);

    const refreshData = async (silent = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            const [s, r, q] = await Promise.all([getExamSessions(), getResults(), getQuizzes()]);
            const validSessions = s.filter(session => !deletingIdsRef.current.has(session.id));
            setSessions(validSessions);
            setResults(r);
            setQuizzes(q);
        } catch (error) {
            console.error("Lỗi cập nhật giám sát:", error);
        } finally {
            if (!silent) setIsRefreshing(false);
        }
    };

    const activeSessions = useMemo(() => {
        return sessions
            .filter(s => {
                const quiz = quizzes.find(q => q.id === s.quizId);
                const matchQuiz = selectedQuizId === 'all' || s.quizId === selectedQuizId;
                const matchGrade = filterGrade === 'all' || (quiz && quiz.grade === filterGrade);
                const matchType = filterType === 'all' || (quiz && quiz.type === filterType);
                return matchQuiz && matchGrade && matchType;
            })
            .sort((a, b) => {
                const timeA = new Date(a.startTime || 0).getTime();
                const timeB = new Date(b.startTime || 0).getTime();
                return timeB - timeA;
            });
    }, [sessions, quizzes, selectedQuizId, filterGrade, filterType]);

    const totalViolations = activeSessions.reduce((acc, s) => acc + s.violationCount, 0);

    // Lọc danh sách kết quả để công bộ bảng vàng
    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            if (!quiz) return false;
            const matchQuiz = selectedQuizId === 'all' || r.quizId === selectedQuizId;
            const matchGrade = filterGrade === 'all' || quiz.grade === filterGrade;
            const matchType = filterType === 'all' || quiz.type === filterType;
            const matchCode = !searchCode || r.studentCode?.toLowerCase().includes(searchCode.toLowerCase());
            return matchQuiz && matchGrade && matchType && matchCode;
        }).sort((a, b) => b.score - a.score);
    }, [results, quizzes, selectedQuizId, filterGrade, filterType, searchCode]);

    const handlePublish = async () => {
        if (selectedQuizId === 'all') return alert("Vui lòng chọn 1 đề thi cụ thể để công bố!");
        if (selectedResultIds.size === 0) return alert("Vui lòng tích chọn ít nhất một học sinh!");
        
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        if (!quiz) return;

        const resultsToPublish = filteredResults.filter(r => selectedResultIds.has(r.id));
        if (!confirm(`Xác nhận CÔNG BỐ BẢNG VÀNG cho ${resultsToPublish.length} em?`)) return;

        const pub: PublishedResult = {
            id: uuidv4(),
            quizId: selectedQuizId,
            quizTitle: quiz.title,
            publishedAt: new Date().toISOString(),
            studentCodes: resultsToPublish.map(r => r.studentCode || ''),
            results: resultsToPublish
        };

        await savePublishedResult(pub);
        alert("🎉 ĐÃ CÔNG BỐ BẢNG VÀNG THÀNH CÔNG!");
        setSelectedResultIds(new Set());
    };

    const handleClearOffline = async () => {
        const offlineSessions = sessions.filter(s => {
            const lastUpdateDate = s.lastUpdate ? new Date(s.lastUpdate) : new Date();
            return differenceInSeconds(now, lastUpdateDate) > 60;
        });

        if (offlineSessions.length === 0) return alert("Không có máy nào đang offline.");
        if (!confirm(`Xóa ${offlineSessions.length} máy đã thoát/mất kết nối?`)) return;

        setIsRefreshing(true);
        for (const s of offlineSessions) {
            deletingIdsRef.current.add(s.id);
            await deleteExamSession(s.id);
        }
        await refreshData();
        setTimeout(() => offlineSessions.forEach(s => deletingIdsRef.current.delete(s.id)), 2000);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-32">
            {/* Header & Filters */}
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
                            <ShieldAlert size={24} className={isRefreshing ? 'animate-pulse' : ''}/>
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight">Hệ thống Giám sát thi</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleClearOffline} className="flex items-center gap-2 px-5 py-3 bg-orange-50 text-orange-600 rounded-2xl hover:bg-orange-600 hover:text-white transition-all text-[10px] font-black uppercase border border-orange-100">
                            <Eraser size={16}/> Dọn Offline
                        </button>
                        <button onClick={() => refreshData()} className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"><RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''}/></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Filter size={10}/> Khối lớp</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={filterGrade} onChange={e => setFilterGrade(e.target.value as any)}>
                            <option value="all">Tất cả Khối</option>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><Filter size={10}/> Loại đề</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
                            <option value="all">Tất cả Loại</option>
                            <option value="test">Kiểm tra</option>
                            <option value="practice">Luyện tập</option>
                        </select>
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><FileText size={10}/> Tên đề thi</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                            <option value="all">Tất cả đề đang mở</option>
                            {quizzes.filter(q => (filterGrade === 'all' || q.grade === filterGrade) && (filterType === 'all' || q.type === filterType)).map(q => (
                                <option key={q.id} value={q.id}>{q.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-blue-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Users size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang Online</p>
                        <h3 className="text-3xl font-black text-slate-800">{activeSessions.filter(s => differenceInSeconds(now, new Date(s.lastUpdate)) <= 60).length}</h3>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-red-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0"><ShieldAlert size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng vi phạm</p>
                        <h3 className="text-3xl font-black text-red-600">{totalViolations}</h3>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-orange-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><WifiOff size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Máy đã thoát</p>
                        <h3 className="text-3xl font-black text-orange-600">{activeSessions.filter(s => differenceInSeconds(now, new Date(s.lastUpdate)) > 60).length}</h3>
                    </div>
                </div>
            </div>

            {/* Live Table */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-6">Học sinh</th>
                            <th className="p-6">Tên đề</th>
                            <th className="p-6 text-center">Bắt đầu</th>
                            <th className="p-6 text-center">Vi phạm</th>
                            <th className="p-6 text-center">Kết nối</th>
                            <th className="p-6 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {activeSessions.map((s, idx) => {
                            const quiz = quizzes.find(q => q.id === s.quizId);
                            const lastUpdateDate = s.lastUpdate ? new Date(s.lastUpdate) : new Date();
                            const diffSeconds = differenceInSeconds(now, lastUpdateDate);
                            const isOffline = diffSeconds > 60;
                            return (
                                <tr key={s.id} className={`hover:bg-slate-50 transition-all ${isOffline ? 'bg-slate-50/50' : ''}`}>
                                    <td className="p-6">
                                        <p className={`font-black uppercase text-xs ${isOffline ? 'text-slate-400' : 'text-slate-800'}`}>{s.studentName}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">MS: {s.studentCode}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[150px]">{quiz?.title || 'N/A'}</p>
                                    </td>
                                    <td className="p-6 text-center text-[10px] font-bold text-slate-400">
                                        {s.startTime ? format(new Date(s.startTime), 'HH:mm') : 'N/A'}
                                    </td>
                                    <td className="p-6 text-center">
                                        <span className={`px-3 py-1 rounded-lg font-black text-[10px] ${s.violationCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                            {s.violationCount} / 3
                                        </span>
                                    </td>
                                    <td className="p-6 text-center">
                                        {isOffline ? <WifiOff size={16} className="mx-auto text-red-400"/> : <Wifi size={16} className="mx-auto text-emerald-500 animate-pulse"/>}
                                    </td>
                                    <td className="p-6 text-center">
                                        {/* Fix: Replaced .then(refreshData) with .then(() => refreshData()) to resolve TypeScript parameter mismatch error */}
                                        <button onClick={() => { if(confirm(`Xóa phiên thi của ${s.studentName}?`)) { deletingIdsRef.current.add(s.id); deleteExamSession(s.id).then(() => refreshData()); } }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><XCircle size={18}/></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Vinh danh Bảng Vàng */}
            <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 text-white">
                        <Trophy className="text-yellow-500" size={32}/>
                        <div>
                            <h3 className="text-xl font-black uppercase italic">Công bố Bảng Vàng</h3>
                            <p className="text-slate-400 text-[9px] font-bold uppercase">Tích chọn để vinh danh HS tiêu biểu</p>
                        </div>
                    </div>
                    <button onClick={handlePublish} disabled={selectedResultIds.size === 0} className="px-10 py-5 bg-yellow-500 text-slate-900 rounded-[2rem] font-black uppercase text-xs hover:bg-white transition-all disabled:opacity-50 shadow-xl">
                        CÔNG BỐ CHO {selectedResultIds.size} EM
                    </button>
                </div>
                <div className="bg-slate-800 p-6 rounded-[2rem] overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left">
                        <thead className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-700"><tr className="p-4"><th>STT</th><th>Họ tên</th><th>Điểm</th><th>Chọn</th></tr></thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {filteredResults.map((r, idx) => (
                                <tr key={r.id} onClick={() => { const s = new Set(selectedResultIds); if(s.has(r.id)) s.delete(r.id); else s.add(r.id); setSelectedResultIds(s); }} className="hover:bg-slate-700/50 cursor-pointer text-white">
                                    <td className="py-4 text-slate-500 font-black">{idx + 1}</td>
                                    <td className="py-4 font-black uppercase text-xs">{r.studentName} <span className="block text-[8px] text-slate-500">{r.studentCode}</span></td>
                                    <td className="py-4 text-emerald-400 font-black text-lg">{r.score.toFixed(2)}</td>
                                    <td className="py-4"><div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedResultIds.has(r.id) ? 'bg-yellow-500 border-yellow-500 text-slate-900' : 'border-slate-600'}`}>{selectedResultIds.has(r.id) && <CheckSquare size={12}/>}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExamMonitor;
