
import React, { useState, useEffect, useMemo } from 'react';
import { ExamSession, Quiz, Result, PublishedResult } from '../../types';
import { getExamSessions, getResults, getQuizzes, savePublishedResult, deleteExamSession } from '../../services/storage';
import { ShieldAlert, Users, Clock, Search, Send, Trophy, RefreshCw, Trash2, Filter } from 'lucide-react';
import { format, addMinutes } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

const ExamMonitor: React.FC = () => {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [searchCode, setSearchCode] = useState('');

    useEffect(() => {
        refreshData();
        const interval = setInterval(refreshData, 5000); 
        return () => clearInterval(interval);
    }, []);

    const refreshData = async () => {
        const [s, r, q] = await Promise.all([getExamSessions(), getResults(), getQuizzes()]);
        setSessions(s);
        setResults(r);
        setQuizzes(q.filter(item => item.type === 'test'));
    };

    const activeSessions = useMemo(() => {
        return sessions.filter(s => selectedQuizId === 'all' || s.quizId === selectedQuizId);
    }, [sessions, selectedQuizId]);

    const totalViolations = activeSessions.reduce((acc, s) => acc + s.violationCount, 0);

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            if (!quiz) return false;
            const matchQuiz = selectedQuizId === 'all' || r.quizId === selectedQuizId;
            const matchCode = !searchCode || r.studentCode?.toLowerCase().includes(searchCode.toLowerCase());
            return matchQuiz && matchCode;
        }).sort((a, b) => b.score - a.score); // Sắp xếp điểm cao lên đầu cho Bảng vàng
    }, [results, quizzes, selectedQuizId, searchCode]);

    const handlePublish = async () => {
        if (selectedQuizId === 'all') return alert("Vui lòng chọn 1 đề thi cụ thể để công bố!");
        if (filteredResults.length === 0) return alert("Không có kết quả nào để công bố!");
        
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        if (!quiz) return;

        if (!confirm(`Xác nhận CÔNG BỐ BẢNG VÀNG cho ${filteredResults.length} học sinh đang hiển thị? Học sinh sẽ nhận được vinh danh ngay lập tức.`)) return;

        const pub: PublishedResult = {
            id: uuidv4(),
            quizId: selectedQuizId,
            quizTitle: quiz.title,
            publishedAt: new Date().toISOString(),
            studentCodes: filteredResults.map(r => r.studentCode || ''),
            results: filteredResults
        };

        await savePublishedResult(pub);
        alert("🎉 ĐÃ CÔNG BỐ BẢNG VÀNG THÀNH CÔNG!");
    };

    const handleClearSessions = async () => {
        if (!confirm("Dọn dẹp toàn bộ dữ liệu giám sát hiện tại?")) return;
        for (const s of sessions) {
            await deleteExamSession(s.id);
        }
        refreshData();
    };

    return (
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex items-center gap-4 flex-1 w-full">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg"><ShieldAlert size={24}/></div>
                    <div className="flex-1">
                        <h2 className="text-xl font-black uppercase tracking-tight">Kiểm soát đề kiểm tra</h2>
                        <select 
                            className="mt-1 w-full max-w-xs bg-slate-50 border rounded-xl p-2 text-xs font-black uppercase outline-none"
                            value={selectedQuizId}
                            onChange={e => setSelectedQuizId(e.target.value)}
                        >
                            <option value="all">Tất cả đề kiểm tra</option>
                            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={refreshData} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"><RefreshCw size={20}/></button>
                    <button onClick={handleClearSessions} className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all" title="Dọn dẹp phiên thi"><Trash2 size={20}/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border-b-8 border-blue-600 shadow-sm flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Users size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thí sinh đang thi</p>
                        <h3 className="text-3xl font-black text-slate-800">{activeSessions.length} <span className="text-sm text-slate-400 font-bold">HS</span></h3>
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
                    <div className="w-16 h-16 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><Clock size={32}/></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái thi</p>
                        <h3 className="text-sm font-black text-orange-600 uppercase">Đang giám sát...</h3>
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
                                <th className="p-6 text-center">Thời gian vào</th>
                                <th className="p-6 text-center">Tgian kết thúc</th>
                                <th className="p-6 text-center">Vi phạm</th>
                                <th className="p-6 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {activeSessions.map((s, idx) => {
                                const quiz = quizzes.find(q => q.id === s.quizId);
                                const deadline = quiz && quiz.startTime ? addMinutes(new Date(quiz.startTime), quiz.durationMinutes) : null;
                                return (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-6 font-black text-slate-300">{idx + 1}</td>
                                        <td className="p-6">
                                            <p className="font-black text-slate-800 uppercase text-xs">{s.studentName}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">MS: {s.studentCode}</p>
                                        </td>
                                        <td className="p-6 text-center text-xs font-bold text-slate-500">{format(new Date(s.startTime), 'HH:mm:ss')}</td>
                                        <td className="p-6 text-center text-xs font-bold text-orange-600">{deadline ? format(deadline, 'HH:mm:ss') : 'N/A'}</td>
                                        <td className="p-6 text-center">
                                            <span className={`px-4 py-1.5 rounded-xl font-black text-xs ${s.violationCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                                                {s.violationCount} / 3
                                            </span>
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className="text-[9px] font-black uppercase text-emerald-600 flex items-center justify-center gap-1">
                                                <RefreshCw size={10} className="animate-spin"/> Đang thi
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
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
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lọc học sinh để vinh danh lên màn hình Dashboard</p>
                        </div>
                    </div>
                    <button 
                        onClick={handlePublish}
                        disabled={filteredResults.length === 0}
                        className="flex items-center gap-3 px-10 py-5 bg-yellow-500 text-slate-900 rounded-[2rem] font-black uppercase text-xs hover:bg-white transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                        <Send size={18}/> CÔNG BỐ BẢNG VÀNG
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4 bg-slate-800 p-4 rounded-[2rem] border border-slate-700">
                    <div className="flex-1 flex items-center gap-3 bg-slate-900 px-6 py-4 rounded-2xl border border-slate-700 focus-within:border-yellow-500 transition-all">
                        <Search size={18} className="text-slate-500"/>
                        <input className="bg-transparent text-white outline-none w-full font-bold text-sm" placeholder="Tìm theo MAHS (để lọc theo lớp)..." value={searchCode} onChange={e => setSearchCode(e.target.value)} />
                    </div>
                    <div className="px-6 py-4 bg-slate-900 rounded-2xl border border-slate-700 flex items-center gap-2">
                        <Filter size={16} className="text-slate-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Tìm thấy: <span className="text-yellow-500">{filteredResults.length}</span> thí sinh</span>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filteredResults.map((r, idx) => (
                                <tr key={r.id} className="hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-6 font-black text-slate-600">{idx + 1}</td>
                                    <td className="p-6 font-black text-yellow-500 uppercase text-xs">{r.studentCode}</td>
                                    <td className="p-6 font-black text-white uppercase text-xs">{r.studentName}</td>
                                    <td className="p-6 text-center">
                                        <span className={`text-lg font-black ${r.score >= 8 ? 'text-emerald-400' : 'text-blue-400'}`}>
                                            {r.score.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="p-6 text-center text-[10px] font-bold text-slate-500">{format(new Date(r.submittedAt), 'HH:mm dd/MM')}</td>
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
