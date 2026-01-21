
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExamSession, Quiz, Result, PublishedResult } from '../../types';
import { getExamSessions, getResults, getQuizzes, savePublishedResult, deleteExamSession } from '../../services/storage';
import { ShieldAlert, Users, Clock, Search, Send, Trophy, RefreshCw, Trash2, Filter, CheckSquare, Square, XCircle, WifiOff, Wifi, Eraser } from 'lucide-react';
import { format, addMinutes, differenceInSeconds } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const ExamMonitor: React.FC = () => {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [searchCode, setSearchCode] = useState('');
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [now, setNow] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Lưu danh sách các ID đang trong quá trình xóa để tránh bị fetch đè lại
    const deletingIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        refreshData();
        const interval = setInterval(() => {
            refreshData(true); // âm thầm làm mới
            setNow(new Date());
        }, 5000); 
        return () => clearInterval(interval);
    }, []);

    const refreshData = async (silent = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            const [s, r, q] = await Promise.all([getExamSessions(), getResults(), getQuizzes()]);
            
            // Lọc bỏ những phiên đang bị xóa (tránh hiện tượng nhảy lại)
            const validSessions = s.filter(session => !deletingIdsRef.current.has(session.id));
            
            setSessions(validSessions);
            setResults(r);
            setQuizzes(q.filter(item => item.type === 'test' || item.type === 'practice'));
        } catch (error) {
            console.error("Lỗi cập nhật giám sát:", error);
        } finally {
            if (!silent) setIsRefreshing(false);
        }
    };

    const activeSessions = useMemo(() => {
        return sessions
            .filter(s => selectedQuizId === 'all' || s.quizId === selectedQuizId)
            .sort((a, b) => {
                // Sắp xếp cố định để danh sách không bị nhảy vị trí
                const timeA = new Date(a.startTime || 0).getTime();
                const timeB = new Date(b.startTime || 0).getTime();
                return timeB - timeA; // Mới nhất lên đầu
            });
    }, [sessions, selectedQuizId]);

    const totalViolations = activeSessions.reduce((acc, s) => acc + s.violationCount, 0);

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            if (!quiz) return false;
            const matchQuiz = selectedQuizId === 'all' || r.quizId === selectedQuizId;
            const matchCode = !searchCode || r.studentCode?.toLowerCase().includes(searchCode.toLowerCase());
            return matchQuiz && matchCode;
        }).sort((a, b) => b.score - a.score);
    }, [results, quizzes, selectedQuizId, searchCode]);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedResultIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedResultIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedResultIds.size === filteredResults.length) {
            setSelectedResultIds(new Set());
        } else {
            setSelectedResultIds(new Set(filteredResults.map(r => r.id)));
        }
    };

    const handlePublish = async () => {
        if (selectedQuizId === 'all') return alert("Vui lòng chọn 1 đề thi cụ thể để công bố!");
        if (selectedResultIds.size === 0) return alert("Vui lòng tích chọn ít nhất một học sinh để vinh danh!");
        
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        if (!quiz) return;

        const resultsToPublish = filteredResults.filter(r => selectedResultIds.has(r.id));

        if (!confirm(`Xác nhận CÔNG BỐ BẢNG VÀNG cho ${resultsToPublish.length} học sinh đã chọn?`)) return;

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

    const handleClearSessions = async () => {
        if (!confirm("Dọn dẹp TOÀN BỘ dữ liệu giám sát hiện tại?")) return;
        setIsRefreshing(true);
        for (const s of sessions) {
            await deleteExamSession(s.id);
        }
        await refreshData();
    };

    const handleClearOffline = async () => {
        const offlineSessions = sessions.filter(s => {
            const lastUpdateDate = s.lastUpdate ? new Date(s.lastUpdate) : new Date();
            return differenceInSeconds(now, lastUpdateDate) > 60;
        });

        if (offlineSessions.length === 0) return alert("Không có phiên thi nào đang ngoại tuyến.");
        if (!confirm(`Xóa ${offlineSessions.length} phiên thi đã mất kết nối?`)) return;

        setIsRefreshing(true);
        for (const s of offlineSessions) {
            deletingIdsRef.current.add(s.id);
            await deleteExamSession(s.id);
        }
        await refreshData();
        // Sau khi refresh xong, xóa khỏi blacklist
        setTimeout(() => {
            offlineSessions.forEach(s => deletingIdsRef.current.delete(s.id));
        }, 2000);
    };

    const handleRemoveOneSession = async (id: string, name: string) => {
        if (!confirm(`Xóa phiên thi của học sinh ${name}?`)) return;
        
        // Thêm vào blacklist tạm thời để tránh bị refresh đè lại
        deletingIdsRef.current.add(id);
        
        // Cập nhật UI ngay lập tức để người dùng thấy mất luôn (Optimistic UI)
        setSessions(prev => prev.filter(s => s.id !== id));
        
        try {
            await deleteExamSession(id);
            // Đợi một chút để DB thực sự xóa xong rồi mới cho phép fetch lại dòng này
            setTimeout(() => {
                deletingIdsRef.current.delete(id);
            }, 5000);
        } catch (error) {
            alert("Lỗi khi xóa phiên thi.");
            deletingIdsRef.current.delete(id);
            refreshData();
        }
    };

    return (
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex items-center gap-4 flex-1 w-full">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg">
                        <ShieldAlert size={24} className={isRefreshing ? 'animate-pulse' : ''}/>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black uppercase tracking-tight">Giám sát làm bài</h2>
                        <div className="flex items-center gap-4 mt-1">
                            <select 
                                className="w-full max-w-xs bg-slate-50 border rounded-xl p-2 text-[10px] font-black uppercase outline-none"
                                value={selectedQuizId}
                                onChange={e => { setSelectedQuizId(e.target.value); setSelectedResultIds(new Set()); }}
                            >
                                <option value="all">Tất cả đề đang mở</option>
                                {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                            </select>
                            {isRefreshing && <RefreshCw size={14} className="animate-spin text-blue-500"/>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleClearOffline} 
                        className="flex items-center gap-2 px-5 py-3 bg-orange-50 text-orange-600 rounded-2xl hover:bg-orange-600 hover:text-white transition-all text-[10px] font-black uppercase border border-orange-100"
                        title="Xóa các máy đã thoát"
                    >
                        <Eraser size={18}/> Dọn Offline
                    </button>
                    <button onClick={() => refreshData()} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all" title="Làm mới"><RefreshCw size={20}/></button>
                    <button onClick={handleClearSessions} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all" title="Dọn dẹp tất cả"><Trash2 size={20}/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-blue-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Users size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thí sinh đang Online</p>
                        <h3 className="text-3xl font-black text-slate-800">{activeSessions.filter(s => differenceInSeconds(now, new Date(s.lastUpdate)) <= 60).length} <span className="text-sm text-slate-400 font-bold">HS</span></h3>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-red-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0"><ShieldAlert size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng cảnh báo</p>
                        <h3 className="text-3xl font-black text-red-600">{totalViolations} <span className="text-sm text-slate-400 font-bold">Lần</span></h3>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-orange-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><WifiOff size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Máy đã thoát/treo</p>
                        <h3 className="text-3xl font-black text-orange-600">{activeSessions.filter(s => differenceInSeconds(now, new Date(s.lastUpdate)) > 60).length} <span className="text-sm text-slate-400 font-bold">Máy</span></h3>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center gap-3 px-6">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Giám sát trực tiếp (Real-time)</h4>
                </div>
                <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="p-6">STT</th>
                                <th className="p-6">Học sinh</th>
                                <th className="p-6 text-center">Bắt đầu lúc</th>
                                <th className="p-6 text-center">Vi phạm</th>
                                <th className="p-6 text-center">Kết nối</th>
                                <th className="p-6 text-center">Trạng thái</th>
                                <th className="p-6 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {activeSessions.map((s, idx) => {
                                const lastUpdateDate = s.lastUpdate ? new Date(s.lastUpdate) : new Date();
                                const diffSeconds = differenceInSeconds(now, lastUpdateDate);
                                const isOffline = diffSeconds > 60;

                                return (
                                    <tr key={s.id} className={`hover:bg-slate-50 transition-all group ${isOffline ? 'bg-slate-50/50' : ''}`}>
                                        <td className="p-6 font-black text-slate-300">{idx + 1}</td>
                                        <td className="p-6">
                                            <p className={`font-black uppercase text-xs ${isOffline ? 'text-slate-400' : 'text-slate-800'}`}>{s.studentName}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">MS: {s.studentCode}</p>
                                        </td>
                                        <td className="p-6 text-center text-xs font-bold text-slate-500">
                                            {s.startTime ? format(new Date(s.startTime), 'HH:mm:ss') : 'N/A'}
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`px-4 py-1.5 rounded-xl font-black text-xs ${s.violationCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                {s.violationCount} / 3
                                            </span>
                                        </td>
                                        <td className="p-6 text-center">
                                            {isOffline ? (
                                                <div className="flex flex-col items-center gap-1 text-red-400">
                                                    <WifiOff size={16}/>
                                                    <span className="text-[8px] font-black uppercase whitespace-nowrap">OFF {Math.floor(diffSeconds/60)}p</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-emerald-500">
                                                    <Wifi size={16} className="animate-pulse"/>
                                                    <span className="text-[8px] font-black uppercase">Online</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`text-[9px] font-black uppercase flex items-center justify-center gap-1 ${isOffline ? 'text-slate-300' : 'text-emerald-600'}`}>
                                                {!isOffline && <RefreshCw size={10} className="animate-spin"/>} {isOffline ? 'Đã thoát' : 'Đang thi'}
                                            </span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <button 
                                                onClick={() => handleRemoveOneSession(s.id, s.studentName)}
                                                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Xóa phiên thi này"
                                            >
                                                <XCircle size={20}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {activeSessions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-[10px] font-black text-slate-300 uppercase italic">Không có thí sinh nào đang làm bài</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500 text-slate-900 rounded-2xl shadow-lg shadow-yellow-500/20"><Trophy size={24}/></div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Công bố kết quả - Bảng Vàng</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Tích chọn học sinh tiêu biểu để vinh danh</p>
                        </div>
                    </div>
                    <button 
                        onClick={handlePublish}
                        disabled={selectedResultIds.size === 0}
                        className="flex items-center gap-3 px-10 py-5 bg-yellow-500 text-slate-900 rounded-[2rem] font-black uppercase text-xs hover:bg-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                        <Send size={18}/> CÔNG BỐ CHO {selectedResultIds.size} EM ĐÃ CHỌN
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 bg-slate-800 p-4 rounded-[2rem] border border-slate-700">
                    <div className="flex-1 flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-700 focus-within:border-yellow-500 transition-all">
                        <Search size={18} className="text-slate-500"/>
                        <input className="bg-transparent text-white outline-none w-full font-bold text-sm uppercase" placeholder="Lọc theo MAHS (để chọn theo lớp)..." value={searchCode} onChange={e => setSearchCode(e.target.value)} />
                    </div>
                    <div className="px-6 py-4 bg-slate-900 rounded-2xl border border-slate-700 flex items-center gap-4">
                        <button onClick={toggleSelectAll} className="flex items-center gap-2 text-[10px] font-black text-yellow-500 uppercase">
                            {selectedResultIds.size === filteredResults.length && filteredResults.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                            Chọn tất cả
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-800 border-b border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                <th className="p-6">STT</th>
                                <th className="p-6">Mã số</th>
                                <th className="p-6">Học sinh</th>
                                <th className="p-6 text-center">Điểm số</th>
                                <th className="p-6 text-center">Thời gian nộp</th>
                                <th className="p-6 text-center">Chọn lọc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredResults.map((r, idx) => (
                                <tr key={r.id} onClick={() => toggleSelect(r.id)} className={`hover:bg-slate-800/50 transition-colors group cursor-pointer ${selectedResultIds.has(r.id) ? 'bg-yellow-500/5' : ''}`}>
                                    <td className="p-6 font-black text-slate-600">{idx + 1}</td>
                                    <td className="p-6 font-black text-yellow-500 uppercase text-xs">{r.studentCode}</td>
                                    <td className="p-6 font-black text-white uppercase text-xs">{r.studentName}</td>
                                    <td className="p-6 text-center">
                                        <span className={`text-lg font-black ${r.score >= 8 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                            {r.score.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center text-[10px] font-bold text-slate-500">{format(new Date(r.submittedAt), 'HH:mm dd/MM')}</td>
                                    <td className="p-6 text-center">
                                        <div className={`mx-auto w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedResultIds.has(r.id) ? 'bg-yellow-500 border-yellow-500 text-slate-900' : 'border-slate-700 text-transparent'}`}>
                                            <CheckSquare size={14}/>
                                        </div>
                                    </td>
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
