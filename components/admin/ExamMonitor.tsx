
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
    
    // Bộ lọc giám sát tổng thể
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
    const [filterType, setFilterType] = useState<QuizType | 'all'>('all');
    
    // Bộ lọc vinh danh (Bảng Vàng)
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
                if (!quiz || !quiz.isPublished) return false;
                
                const matchQuiz = selectedQuizId === 'all' || s.quizId === selectedQuizId;
                const matchGrade = filterGrade === 'all' || quiz.grade === filterGrade;
                const matchType = filterType === 'all' || quiz.type === filterType;
                return matchQuiz && matchGrade && matchType;
            })
            .sort((a, b) => {
                const timeA = new Date(a.startTime || 0).getTime();
                const timeB = new Date(b.startTime || 0).getTime();
                return timeB - timeA;
            });
    }, [sessions, quizzes, selectedQuizId, filterGrade, filterType]);

    // Xử lý danh sách kết quả cho Bảng Vàng: Lấy ĐIỂM CAO NHẤT của mỗi học sinh
    const bestResultsForBoard = useMemo(() => {
        if (selectedQuizId === 'all') return [];

        const quizResults = results.filter(r => r.quizId === selectedQuizId);
        
        // Group theo studentCode để lấy điểm cao nhất
        const grouped: Record<string, Result> = {};
        quizResults.forEach(r => {
            const code = r.studentCode?.toUpperCase() || `ID_${r.studentId}`;
            if (!grouped[code] || r.score > grouped[code].score) {
                grouped[code] = r;
            }
        });

        const list = Object.values(grouped);

        // Lọc theo tìm kiếm MAHS (dùng để lọc lớp nhanh)
        return list.filter(r => 
            !searchCode || r.studentCode?.toUpperCase().includes(searchCode.toUpperCase())
        ).sort((a, b) => b.score - a.score);
    }, [results, selectedQuizId, searchCode]);

    const handleSelectAllVisible = () => {
        if (selectedResultIds.size === bestResultsForBoard.length) {
            setSelectedResultIds(new Set());
        } else {
            setSelectedResultIds(new Set(bestResultsForBoard.map(r => r.id)));
        }
    };

    const handlePublish = async () => {
        if (selectedQuizId === 'all') return alert("Vui lòng chọn 1 đề thi cụ thể để công bố!");
        if (selectedResultIds.size === 0) return alert("Vui lòng tích chọn ít nhất một học sinh!");
        
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        if (!quiz) return;

        const resultsToPublish = bestResultsForBoard.filter(r => selectedResultIds.has(r.id));
        if (!confirm(`Xác nhận CÔNG BỐ BẢNG VÀNG cho ${resultsToPublish.length} em đang chọn?`)) return;

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
                        <h2 className="text-xl font-black uppercase tracking-tight">Giám sát & Vinh danh</h2>
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
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-2 flex items-center gap-1"><FileText size={10}/> Chọn đề vinh danh</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none border-blue-100" value={selectedQuizId} onChange={e => { setSelectedQuizId(e.target.value); setSelectedResultIds(new Set()); }}>
                            <option value="all">Chọn 1 đề cụ thể để hiện Bảng Vàng</option>
                            {quizzes.filter(q => q.isPublished && (filterGrade === 'all' || q.grade === filterGrade) && (filterType === 'all' || q.type === filterType)).map(q => (
                                <option key={q.id} value={q.id}>{q.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Live Monitor Table */}
            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                <div className="p-6 border-b bg-slate-50 flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <h3 className="text-[11px] font-black uppercase text-slate-500">Đang trong phòng thi ({activeSessions.filter(s => differenceInSeconds(now, new Date(s.lastUpdate)) <= 60).length})</h3>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-white border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <th className="p-6">Học sinh</th>
                            <th className="p-6">Tên đề</th>
                            <th className="p-6 text-center">Bắt đầu</th>
                            <th className="p-6 text-center">Vi phạm</th>
                            <th className="p-6 text-center">Kết nối</th>
                            <th className="p-6 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {activeSessions.map((s) => {
                            const quiz = quizzes.find(q => q.id === s.quizId);
                            const lastUpdateDate = s.lastUpdate ? new Date(s.lastUpdate) : new Date();
                            const isOffline = differenceInSeconds(now, lastUpdateDate) > 60;
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
                                        <button onClick={() => { if(confirm(`Xóa phiên thi của ${s.studentName}?`)) { deletingIdsRef.current.add(s.id); deleteExamSession(s.id).then(() => refreshData()); } }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><XCircle size={18}/></button>
                                    </td>
                                </tr>
                            );
                        })}
                        {activeSessions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-[10px] font-black text-slate-300 uppercase italic">Không có phiên thi nào đang hoạt động</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Vinh danh Bảng Vàng - NÂNG CẤP BỘ LỌC LỚP */}
            <div className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl space-y-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                    <div className="flex items-center gap-6 text-white">
                        <div className="w-16 h-16 bg-yellow-500 text-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-xl animate-bounce-slow"><Trophy size={32}/></div>
                        <div>
                            <h3 className="text-2xl font-black uppercase italic tracking-tight">Công bố Bảng Vàng</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Vinh danh sự nỗ lực của các em</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        <div className="flex-1 min-w-[200px] relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-yellow-500 transition-colors" size={18}/>
                            <input 
                                className="w-full bg-slate-800 text-white pl-12 pr-4 py-4 rounded-2xl text-xs font-black uppercase outline-none border-2 border-transparent focus:border-yellow-500/50 transition-all" 
                                placeholder="Lọc MAHS (Lớp)..." 
                                value={searchCode} 
                                onChange={e => { setSearchCode(e.target.value); setSelectedResultIds(new Set()); }}
                            />
                            {searchCode && <button onClick={() => setSearchCode('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><XCircle size={14}/></button>}
                        </div>
                        <button 
                            onClick={handlePublish} 
                            disabled={selectedResultIds.size === 0} 
                            className="px-10 py-4 bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-[11px] hover:bg-white hover:scale-105 transition-all disabled:opacity-30 shadow-xl shadow-yellow-500/20"
                        >
                            CÔNG BỐ ({selectedResultIds.size})
                        </button>
                    </div>
                </div>

                {selectedQuizId === 'all' ? (
                    <div className="bg-slate-800/50 p-20 rounded-[2.5rem] border-2 border-dashed border-slate-700 text-center">
                        <FileText className="mx-auto text-slate-700 mb-4" size={48}/>
                        <p className="text-slate-500 font-black uppercase text-xs tracking-[0.2em]">Vui lòng chọn 1 đề thi cụ thể ở bộ lọc phía trên để hiện danh sách điểm</p>
                    </div>
                ) : (
                    <div className="bg-slate-800/80 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/5 overflow-hidden">
                        <div className="flex justify-between items-center mb-6 px-4">
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={handleSelectAllVisible}
                                    className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-yellow-500 transition-colors"
                                >
                                    {selectedResultIds.size === bestResultsForBoard.length && bestResultsForBoard.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    Chọn tất cả kết quả đang lọc
                                </button>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Tìm thấy {bestResultsForBoard.length} thí sinh</span>
                            </div>
                            <div className="text-[9px] text-yellow-500 font-black uppercase italic">* Chỉ hiển thị điểm cao nhất của mỗi em</div>
                        </div>
                        
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            <table className="w-full text-left">
                                <thead className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-700 sticky top-0 bg-slate-800 z-10"><tr className="p-4"><th className="pb-4 pl-4">Thứ hạng</th><th className="pb-4">Học sinh</th><th className="pb-4 text-center">Điểm số</th><th className="pb-4 text-center">Chọn</th></tr></thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {bestResultsForBoard.map((r, idx) => {
                                        const isSelected = selectedResultIds.has(r.id);
                                        return (
                                            <tr 
                                                key={r.id} 
                                                onClick={() => { const s = new Set(selectedResultIds); if(isSelected) s.delete(r.id); else s.add(r.id); setSelectedResultIds(s); }} 
                                                className={`hover:bg-yellow-500/5 cursor-pointer transition-all group ${isSelected ? 'bg-yellow-500/10' : ''}`}
                                            >
                                                <td className="py-5 pl-4">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-yellow-500 text-slate-900 shadow-lg' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-orange-800' : 'text-slate-500'}`}>
                                                        {idx + 1}
                                                    </div>
                                                </td>
                                                <td className="py-5">
                                                    <p className="font-black uppercase text-xs text-white group-hover:text-yellow-500 transition-colors">{r.studentName}</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">MS: {r.studentCode}</p>
                                                </td>
                                                <td className="py-5 text-center">
                                                    <span className={`text-xl font-black ${r.score >= 8 ? 'text-emerald-400' : r.score >= 5 ? 'text-blue-400' : 'text-slate-400'}`}>
                                                        {r.score.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="py-5 text-center">
                                                    <div className={`w-6 h-6 rounded-lg border-2 mx-auto flex items-center justify-center transition-all ${isSelected ? 'bg-yellow-500 border-yellow-500 text-slate-900' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                                        {isSelected && <CheckSquare size={14}/>}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {bestResultsForBoard.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-20 text-center text-[10px] font-black text-slate-600 uppercase italic tracking-widest">Không có dữ liệu cho bộ lọc này</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExamMonitor;
