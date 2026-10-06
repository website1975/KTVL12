import React, { useState, useMemo } from 'react';
import { X, UserCog, BookOpen, Trophy, Clock, Eye, AlertCircle, CheckCircle2, BarChart3, LineChart as LineChartIcon, BarChart2 } from 'lucide-react';
import { User, Result, Quiz } from '../../types';
import { format, isAfter } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';

interface StudentDetailModalProps {
    student: User | null;
    results: Result[];
    quizzes: Quiz[];
    onClose: () => void;
    onViewResult: (res: Result) => void | Promise<void>;
}

export default function StudentDetailModal({ student, results, quizzes, onClose, onViewResult }: StudentDetailModalProps) {
    if (!student) return null;

    const [chartType, setChartType] = useState<'timeline' | 'distribution'>('timeline');

    const studentResults = useMemo(() => {
        return results.filter(r => 
            r.studentId === student.id || 
            (student.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === student.studentCode.trim().toUpperCase())
        ).sort((a,b) => isAfter(new Date(b.submittedAt), new Date(a.submittedAt)) ? 1 : -1);
    }, [results, student]);

    // Đề thi được phân cho học sinh này
    const assignedQuizzes = useMemo(() => {
        return quizzes.filter(q => {
            const matchGrade = q.grade === student.grade || q.grade === 'all';
            if (!matchGrade) return false;
            if (q.targetType === 'classes') {
                return student.classId && q.assignedClassIds && q.assignedClassIds.includes(student.classId);
            }
            return true;
        });
    }, [quizzes, student]);

    const completedQuizIds = useMemo(() => new Set(studentResults.map(r => r.quizId)), [studentResults]);
    const completedAssignedQuizzes = useMemo(() => assignedQuizzes.filter(q => completedQuizIds.has(q.id)), [assignedQuizzes, completedQuizIds]);
    const uncompletedAssignedQuizzes = useMemo(() => assignedQuizzes.filter(q => !completedQuizIds.has(q.id)), [assignedQuizzes, completedQuizIds]);

    // Điểm cao nhất của từng đề đã nộp
    const quizScoreMap = useMemo(() => {
        const map = new Map<string, number>();
        studentResults.forEach(r => {
            const cur = map.get(r.quizId) ?? 0;
            if (r.score > cur) map.set(r.quizId, r.score);
        });
        return map;
    }, [studentResults]);

    const totalSubmittedScore = useMemo(() => {
        return Array.from(quizScoreMap.values()).reduce((a, b) => a + b, 0);
    }, [quizScoreMap]);

    const avgSubmittedScore = useMemo(() => {
        return quizScoreMap.size > 0 ? (totalSubmittedScore / quizScoreMap.size) : 0;
    }, [quizScoreMap, totalSubmittedScore]);

    // ĐTB TỔNG KẾT (Tính 0đ cho các đề được giao nhưng chưa làm)
    const officialAvgScore = useMemo(() => {
        return assignedQuizzes.length > 0 
            ? totalSubmittedScore / assignedQuizzes.length 
            : avgSubmittedScore;
    }, [assignedQuizzes.length, totalSubmittedScore, avgSubmittedScore]);

    // Dữ liệu biểu đồ Recharts (Bao gồm các bài chưa làm = 0.00đ)
    const { timelineData, distributionData } = useMemo(() => {
        const studentResultsMap = new Map<string, Result[]>();
        studentResults.forEach(r => {
            const list = studentResultsMap.get(r.quizId) || [];
            list.push(r);
            studentResultsMap.set(r.quizId, list);
        });

        const timeline: any[] = [];

        // Duyệt đề được giao
        assignedQuizzes.forEach(q => {
            const subs = studentResultsMap.get(q.id);
            if (subs && subs.length > 0) {
                const bestSub = [...subs].sort((a, b) => b.score - a.score)[0];
                const subDate = new Date(bestSub.submittedAt);
                timeline.push({
                    id: bestSub.id,
                    quizId: q.id,
                    quizTitle: q.title,
                    shortTitle: q.title.length > 18 ? q.title.slice(0, 16) + '...' : q.title,
                    score: Number(bestSub.score.toFixed(2)),
                    isSubmitted: true,
                    date: format(subDate, 'dd/MM/yyyy HH:mm'),
                    shortDate: format(subDate, 'dd/MM'),
                    durationMinutes: Math.max(1, Math.round((bestSub.durationSeconds || 0) / 60)),
                    timestamp: subDate.getTime(),
                    status: 'Đã nộp'
                });
            } else {
                const createDate = q.createdAt ? new Date(q.createdAt) : new Date();
                timeline.push({
                    id: `uncompleted-${q.id}`,
                    quizId: q.id,
                    quizTitle: q.title,
                    shortTitle: q.title.length > 18 ? q.title.slice(0, 16) + '...' : q.title,
                    score: 0.00,
                    isSubmitted: false,
                    date: q.createdAt ? format(new Date(q.createdAt), 'dd/MM/yyyy') : 'Chưa làm',
                    shortDate: q.createdAt ? format(new Date(q.createdAt), 'dd/MM') : '0đ',
                    durationMinutes: 0,
                    timestamp: createDate.getTime(),
                    status: 'Chưa làm (0.00đ)'
                });
            }
        });

        // Bổ sung các bài nộp ngoài danh sách giao
        studentResults.forEach(r => {
            if (!assignedQuizzes.some(q => q.id === r.quizId) && !timeline.some(item => item.quizId === r.quizId)) {
                const q = quizzes.find(item => item.id === r.quizId);
                const subDate = new Date(r.submittedAt);
                timeline.push({
                    id: r.id,
                    quizId: r.quizId,
                    quizTitle: q?.title || 'Đề tự do',
                    shortTitle: (q?.title || 'Đề tự do').slice(0, 16),
                    score: Number(r.score.toFixed(2)),
                    isSubmitted: true,
                    date: format(subDate, 'dd/MM/yyyy HH:mm'),
                    shortDate: format(subDate, 'dd/MM'),
                    durationMinutes: Math.max(1, Math.round((r.durationSeconds || 0) / 60)),
                    timestamp: subDate.getTime(),
                    status: 'Đã nộp'
                });
            }
        });

        timeline.sort((a, b) => a.timestamp - b.timestamp);

        const totalItems = timeline.length || 1;
        const distGroups = [
            { key: 'zero', name: '0.00đ (Bỏ thi / Chưa làm)', shortName: '0.0đ (Bỏ thi)', count: 0, color: '#f43f5e' },
            { key: 'under5', name: '< 5.0đ (Chưa đạt)', shortName: '< 5.0đ', count: 0, color: '#fb7185' },
            { key: '5to65', name: '5.0 - 6.4đ (Trung bình)', shortName: '5.0 - 6.4đ', count: 0, color: '#f59e0b' },
            { key: '65to8', name: '6.5 - 7.9đ (Khá)', shortName: '6.5 - 7.9đ', count: 0, color: '#3b82f6' },
            { key: '8to10', name: '8.0 - 10.0đ (Giỏi / Xuất sắc)', shortName: '8.0 - 10.0đ', count: 0, color: '#10b981' }
        ];

        timeline.forEach(item => {
            if (!item.isSubmitted || item.score === 0) distGroups[0].count++;
            else if (item.score < 5) distGroups[1].count++;
            else if (item.score < 6.5) distGroups[2].count++;
            else if (item.score < 8) distGroups[3].count++;
            else distGroups[4].count++;
        });

        const distribution = distGroups.map(g => ({
            ...g,
            percentage: timeline.length > 0 ? Math.round((g.count / totalItems) * 100) : 0
        }));

        return { timelineData: timeline, distributionData: distribution };
    }, [assignedQuizzes, studentResults, quizzes]);

    return (
        <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><UserCog size={32}/></div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">{student.fullName}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                MAHS: {student.studentCode || 'N/A'} {student.className ? `• Lớp ${student.className}` : ''} • Khối {student.grade}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 sm:p-10 bg-slate-50 space-y-6">
                    {/* Thống kê 4 thẻ */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-[2rem] p-5 border shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><BookOpen size={22}/></div>
                            <div>
                                <p className="text-slate-400 text-[9px] font-black uppercase">Đã nộp / Giao</p>
                                <h4 className="text-base font-black text-slate-800">
                                    {completedAssignedQuizzes.length}/{assignedQuizzes.length} đề
                                </h4>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-5 border shadow-sm flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${officialAvgScore >= 8 ? 'bg-emerald-50 text-emerald-600' : officialAvgScore >= 5 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                                <Trophy size={22}/>
                            </div>
                            <div>
                                <p className="text-slate-400 text-[9px] font-black uppercase">ĐTB Tổng kết</p>
                                <h4 className={`text-xl font-black ${officialAvgScore >= 8 ? 'text-emerald-600' : officialAvgScore >= 5 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {officialAvgScore.toFixed(2)}đ
                                </h4>
                                <span className="text-[8px] text-slate-400 font-bold block">(0đ bài chưa nộp)</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-5 border shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><CheckCircle2 size={22}/></div>
                            <div>
                                <p className="text-slate-400 text-[9px] font-black uppercase">ĐTB Bài đã làm</p>
                                <h4 className="text-xl font-black text-indigo-600">{avgSubmittedScore > 0 ? `${avgSubmittedScore.toFixed(2)}đ` : '-'}</h4>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-5 border shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><Clock size={22}/></div>
                            <div>
                                <p className="text-slate-400 text-[9px] font-black uppercase">Tỷ lệ nộp</p>
                                <h4 className="text-xl font-black text-orange-600">
                                    {assignedQuizzes.length > 0 ? `${Math.round((completedAssignedQuizzes.length / assignedQuizzes.length) * 100)}%` : '100%'}
                                </h4>
                            </div>
                        </div>
                    </div>

                    {/* Biểu đồ Recharts thống kê tiến trình điểm số & phổ điểm */}
                    <div className="bg-white p-5 rounded-[2rem] border shadow-sm space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-600 text-white rounded-xl">
                                    <BarChart3 size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black uppercase text-slate-800 text-xs sm:text-sm">
                                        Biểu Đồ Tiến Trình Điểm Số & Phổ Điểm (Gồm 0đ bài chưa nộp)
                                    </h4>
                                    <p className="text-[10px] text-slate-400 font-bold">
                                        Đã nộp {completedAssignedQuizzes.length}/{assignedQuizzes.length} đề • {uncompletedAssignedQuizzes.length} đề chưa nộp (tính 0.00đ)
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button
                                    onClick={() => setChartType('timeline')}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        chartType === 'timeline'
                                            ? 'bg-white text-blue-600 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <LineChartIcon size={12} />
                                    <span>Tiến trình điểm</span>
                                </button>
                                <button
                                    onClick={() => setChartType('distribution')}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                        chartType === 'distribution'
                                            ? 'bg-white text-indigo-600 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <BarChart2 size={12} />
                                    <span>Phổ điểm</span>
                                </button>
                            </div>
                        </div>

                        {timelineData.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                Chưa có dữ liệu đề thi được giao
                            </div>
                        ) : chartType === 'timeline' ? (
                            <div className="w-full h-56 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={timelineData}
                                        margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
                                    >
                                        <defs>
                                            <linearGradient id="studentDetailAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="shortDate"
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            tickLine={false}
                                            dy={5}
                                        />
                                        <YAxis
                                            domain={[0, 10]}
                                            ticks={[0, 2, 4, 6, 8, 10]}
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-700 max-w-xs text-xs z-50">
                                                            <div className="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-800">
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    data.isSubmitted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                                                }`}>
                                                                    {data.status}
                                                                </span>
                                                                <span className="text-slate-400 text-[9px]">{data.date}</span>
                                                            </div>
                                                            <p className="font-bold text-slate-100 text-xs mb-1.5 line-clamp-2">{data.quizTitle}</p>
                                                            <div className="flex items-center justify-between bg-slate-800/80 p-2 rounded-lg">
                                                                <div>
                                                                    <p className="text-[8px] uppercase text-slate-400 font-bold">Điểm số</p>
                                                                    <p className={`text-sm font-black ${
                                                                        data.score >= 8 ? 'text-emerald-400' : data.score >= 5 ? 'text-blue-400' : 'text-rose-400'
                                                                    }`}>
                                                                        {data.score.toFixed(2)} / 10
                                                                    </p>
                                                                </div>
                                                                {data.isSubmitted && (
                                                                    <div className="text-right">
                                                                        <p className="text-[8px] uppercase text-slate-400 font-bold">Thời gian</p>
                                                                        <p className="text-slate-300 font-bold text-xs">{data.durationMinutes}p</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <ReferenceLine
                                            y={8}
                                            stroke="#10b981"
                                            strokeDasharray="3 3"
                                            label={{ value: 'Giỏi (8.0)', position: 'insideTopRight', fill: '#10b981', fontSize: 9, fontWeight: 700 }}
                                        />
                                        <ReferenceLine
                                            y={5}
                                            stroke="#f59e0b"
                                            strokeDasharray="3 3"
                                            label={{ value: 'Đạt (5.0)', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 9, fontWeight: 700 }}
                                        />
                                        <ReferenceLine
                                            y={Number(officialAvgScore.toFixed(2))}
                                            stroke="#6366f1"
                                            strokeWidth={1.5}
                                            label={{ value: `ĐTB (${officialAvgScore.toFixed(2)})`, position: 'insideLeft', fill: '#6366f1', fontSize: 9, fontWeight: 700 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="score"
                                            name="Điểm số"
                                            stroke="#2563eb"
                                            strokeWidth={2.5}
                                            fill="url(#studentDetailAreaGrad)"
                                            activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                                            dot={(props: any) => {
                                                const { cx, cy, payload } = props;
                                                const isZero = !payload.isSubmitted || payload.score === 0;
                                                const isGood = payload.score >= 8;
                                                const fillColor = isZero ? '#f43f5e' : isGood ? '#10b981' : '#2563eb';
                                                return (
                                                    <circle
                                                        key={`dot-st-${payload.id}`}
                                                        cx={cx}
                                                        cy={cy}
                                                        r={isZero ? 4.5 : 3.5}
                                                        fill={fillColor}
                                                        stroke="#ffffff"
                                                        strokeWidth={1.5}
                                                    />
                                                );
                                            }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="w-full h-56 pt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={distributionData}
                                        margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="shortName"
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            tickLine={false}
                                            dy={5}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            stroke="#94a3b8"
                                            fontSize={10}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700 text-xs z-50">
                                                            <p className="font-bold text-slate-200 text-[11px] mb-1">{data.name}</p>
                                                            <p className="font-bold text-white">
                                                                Số lượng: <span className="text-emerald-400 font-black">{data.count}</span> đề ({data.percentage}%)
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="count" name="Số đề" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                            {distributionData.map((entry, index) => (
                                                <Cell key={`cell-st-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Bảng danh sách đề thi đã làm & đề chưa nộp */}
                    <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                        <div className="p-5 border-b bg-slate-50/50 flex items-center justify-between">
                            <h4 className="font-black uppercase text-xs text-slate-700">Chi tiết tất cả bài kiểm tra & đề thi được giao</h4>
                            <span className="text-[10px] font-bold text-slate-400">
                                {studentResults.length} lần nộp • {uncompletedAssignedQuizzes.length} đề chưa nộp (tính 0đ)
                            </span>
                        </div>
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="bg-white border-b text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                    <th className="p-4 pl-6">Đề thi</th>
                                    <th className="p-4 text-center">Trạng thái</th>
                                    <th className="p-4 text-center">Điểm số</th>
                                    <th className="p-4 text-center">Ngày nộp</th>
                                    <th className="p-4 text-center pr-6">Xem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Các bài đã nộp */}
                                {studentResults.map(r => {
                                    const q = quizzes.find(item => item.id === r.quizId);
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="p-4 pl-6 font-bold text-slate-800">
                                                {q?.title || 'Đề thi đã xóa'}
                                                {q?.category && <span className="block text-[10px] text-slate-400 font-normal">{q.category}</span>}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[9px] font-black uppercase">
                                                    Đã nộp
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-black text-blue-600 text-sm">
                                                {r.score.toFixed(2)}đ
                                            </td>
                                            <td className="p-4 text-center text-slate-400 text-[10px]">
                                                {format(new Date(r.submittedAt), 'dd/MM/yyyy HH:mm')}
                                            </td>
                                            <td className="p-4 text-center pr-6">
                                                <button onClick={() => onViewResult(r)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                                                    <Eye size={14}/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Các bài được giao nhưng chưa làm */}
                                {uncompletedAssignedQuizzes.map(q => (
                                    <tr key={q.id} className="bg-rose-50/30 hover:bg-rose-50/50">
                                        <td className="p-4 pl-6 font-bold text-rose-950">
                                            {q.title}
                                            {q.category && <span className="block text-[10px] text-rose-400 font-normal">{q.category}</span>}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-md text-[9px] font-black uppercase">
                                                Bỏ thi / Chưa nộp
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-black text-rose-600 text-sm">
                                            0.00đ
                                        </td>
                                        <td className="p-4 text-center text-rose-400 text-[10px] italic">
                                            Chưa làm bài
                                        </td>
                                        <td className="p-4 text-center pr-6 text-slate-300">
                                            -
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
