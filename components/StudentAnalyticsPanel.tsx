import React, { useState, useMemo } from 'react';
import { Quiz, Result } from '../types';
import {
  Trophy,
  BookOpen,
  CheckCircle2,
  Clock,
  BarChart3,
  LineChart as LineChartIcon,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface StudentAnalyticsPanelProps {
  stats: {
    totalQuizzes: number;
    avgScore: number;
    avgSubmittedScore: number;
    completedAssignedCount: number;
    totalAssignedCount: number;
    uncompletedAssignedCount: number;
    totalSeconds: number;
    accumulatedPoints: number;
  };
  overallQuestionsStats: {
    completed: number;
    total: number;
    percentage: number;
  };
  performanceInsights: {
    highest: number;
    latest: number;
    recentAvg: number;
    trendDiff: number;
    passRate: number;
    distinctionRate: number;
  };
  results: Result[];
  quizzes: Quiz[];
  onGoToExams?: () => void;
}

const formatStudyTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
};

export default function StudentAnalyticsPanel({
  stats,
  overallQuestionsStats,
  performanceInsights,
  results,
  quizzes,
  onGoToExams,
}: StudentAnalyticsPanelProps) {
  const [chartType, setChartType] = useState<'timeline' | 'distribution'>('timeline');
  const [chartScope, setChartScope] = useState<'all' | 'test' | 'practice'>('all');
  const [chartLimit, setChartLimit] = useState<number>(15);

  const scoreHistoryData = useMemo(() => {
    let sorted = [...results].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    if (chartScope !== 'all') {
      sorted = sorted.filter((r) => {
        const q = quizzes.find((item) => item.id === r.quizId);
        return q ? q.type === chartScope : true;
      });
    }

    if (chartLimit > 0 && sorted.length > chartLimit) {
      sorted = sorted.slice(sorted.length - chartLimit);
    }

    return sorted.map((r, idx) => {
      const q = quizzes.find((item) => item.id === r.quizId);
      const subDate = new Date(r.submittedAt);
      const quizTitle = q?.title || r.quizTitle || 'Bài thi';
      const shortTitle = quizTitle.length > 22 ? quizTitle.slice(0, 20) + '...' : quizTitle;
      const durationMin = Math.max(1, Math.round((r.durationSeconds || 0) / 60));
      return {
        id: r.id,
        attemptNumber: idx + 1,
        quizId: r.quizId,
        quizTitle,
        shortTitle,
        score: Number(r.score.toFixed(2)),
        date: format(subDate, 'dd/MM/yyyy HH:mm'),
        shortDate: format(subDate, 'dd/MM'),
        durationMinutes: durationMin,
        quizType: q?.type || r.quizType || 'test',
        label: `#${idx + 1} (${format(subDate, 'dd/MM')})`,
      };
    });
  }, [results, quizzes, chartScope, chartLimit]);

  const scoreDistributionData = useMemo(() => {
    let filtered = [...results];
    if (chartScope !== 'all') {
      filtered = filtered.filter((r) => {
        const q = quizzes.find((item) => item.id === r.quizId);
        return q ? q.type === chartScope : true;
      });
    }

    const total = filtered.length || 1;
    const groups = [
      { key: 'under5', name: 'Dưới 5.0 (Cần cố gắng)', shortName: '< 5.0', count: 0, color: '#f43f5e' },
      { key: '5to65', name: '5.0 - 6.4 (Trung bình)', shortName: '5.0 - 6.4', count: 0, color: '#f59e0b' },
      { key: '65to8', name: '6.5 - 7.9 (Khá)', shortName: '6.5 - 7.9', count: 0, color: '#3b82f6' },
      { key: '8to10', name: '8.0 - 10.0 (Giỏi)', shortName: '8.0 - 10.0', count: 0, color: '#10b981' },
    ];

    filtered.forEach((r) => {
      if (r.score < 5) groups[0].count++;
      else if (r.score < 6.5) groups[1].count++;
      else if (r.score < 8) groups[2].count++;
      else groups[3].count++;
    });

    return groups.map((g) => ({
      ...g,
      percentage: Math.round((g.count / total) * 100),
    }));
  }, [results, quizzes, chartScope]);

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          className={`bg-white rounded-2xl p-5 border flex items-center gap-4 ${
            stats.uncompletedAssignedCount > 0 ? 'border-amber-300' : 'border-slate-200'
          }`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              stats.avgScore >= 8
                ? 'bg-emerald-50 text-emerald-600'
                : stats.avgScore >= 5
                ? 'bg-blue-50 text-blue-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Trophy size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">ĐTB Tổng kết</p>
            <h3
              className={`text-2xl font-black font-mono tabular-nums ${
                stats.avgScore >= 8
                  ? 'text-emerald-600'
                  : stats.avgScore >= 5
                  ? 'text-blue-600'
                  : 'text-rose-600'
              }`}
            >
              {stats.avgScore.toFixed(2)}
            </h3>
            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              {stats.uncompletedAssignedCount > 0
                ? `${stats.uncompletedAssignedCount} đề chưa nộp (0đ)`
                : 'Hoàn thành đủ bài giao'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">Tiến độ bài giao</p>
            <h3 className="text-2xl font-black font-mono tabular-nums text-slate-900">
              {stats.completedAssignedCount}/{stats.totalAssignedCount}
            </h3>
            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              ĐTB đã nộp:{' '}
              <strong className="font-mono tabular-nums text-indigo-600">
                {stats.avgSubmittedScore.toFixed(2)}đ
              </strong>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500">Tiến độ câu hỏi</p>
              <h3 className="text-xl font-black font-mono tabular-nums text-slate-900">
                {overallQuestionsStats.completed}/{overallQuestionsStats.total}{' '}
                <span className="text-xs font-medium text-slate-400">câu</span>
              </h3>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center text-[11px] font-bold mb-1">
              <span className="text-slate-400">Tỷ lệ hoàn thành</span>
              <span className="font-mono tabular-nums text-emerald-600">
                {overallQuestionsStats.percentage}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${overallQuestionsStats.percentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">Thời gian & Tích lũy</p>
            <h3 className="text-lg font-black text-slate-900 truncate">
              {formatStudyTime(stats.totalSeconds)}
            </h3>
            <p className="text-[11px] font-bold text-amber-700 font-mono tabular-nums mt-0.5">
              Tích lũy: {stats.accumulatedPoints.toFixed(2)} điểm
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Biểu đồ thống kê & Tiến trình điểm số
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Theo dõi xu hướng điểm số qua các lần thi và phân bố kết quả
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setChartType('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartType === 'timeline'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LineChartIcon size={14} />
                <span>Tiến trình điểm</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('distribution')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartType === 'distribution'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 size={14} />
                <span>Phổ điểm</span>
              </button>
            </div>

            <select
              value={chartScope}
              onChange={(e) => setChartScope(e.target.value as 'all' | 'test' | 'practice')}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Tất cả bài ({results.length})</option>
              <option value="test">Chỉ đề kiểm tra</option>
              <option value="practice">Chỉ bài luyện tập</option>
            </select>

            {chartType === 'timeline' && (
              <select
                value={chartLimit}
                onChange={(e) => setChartLimit(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10 bài gần nhất</option>
                <option value={15}>15 bài gần nhất</option>
                <option value={30}>30 bài gần nhất</option>
                <option value={0}>Tất cả lịch sử</option>
              </select>
            )}
          </div>
        </div>

        {/* Insights Row */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Trophy size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">Điểm cao nhất</p>
                <p className="text-base font-black font-mono tabular-nums text-emerald-600">
                  {performanceInsights.highest.toFixed(2)}
                  <span className="text-xs text-slate-400 font-normal"> /10</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">Lần thi gần nhất</p>
                <p className="text-base font-black font-mono tabular-nums text-blue-600">
                  {performanceInsights.latest.toFixed(2)}
                  <span className="text-xs text-slate-400 font-normal"> /10</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  performanceInsights.trendDiff >= 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {performanceInsights.trendDiff >= 0 ? (
                  <TrendingUp size={16} />
                ) : (
                  <TrendingDown size={16} />
                )}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">3 bài gần đây</p>
                <div className="flex items-center gap-1.5 font-mono tabular-nums">
                  <span className="text-base font-black text-slate-900">
                    {performanceInsights.recentAvg.toFixed(2)}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      performanceInsights.trendDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    ({performanceInsights.trendDiff >= 0
                      ? `+${performanceInsights.trendDiff.toFixed(2)}`
                      : performanceInsights.trendDiff.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Target size={16} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500">Tỷ lệ Đạt / Giỏi</p>
                <p className="text-xs font-bold text-slate-800 font-mono tabular-nums mt-0.5">
                  Đạt <span className="text-blue-600">{performanceInsights.passRate}%</span> · Giỏi{' '}
                  <span className="text-emerald-600">{performanceInsights.distinctionRate}%</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Chart Area */}
        <div className="w-full min-h-[300px] flex flex-col justify-center">
          {results.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <LineChartIcon size={24} />
              </div>
              <p className="text-sm font-black text-slate-800">Chưa có dữ liệu bài thi</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hoàn thành ít nhất một bài kiểm tra hoặc luyện tập để xem biểu đồ phân tích tiến trình điểm số của bạn.
              </p>
              {onGoToExams && (
                <button
                  type="button"
                  onClick={onGoToExams}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Xem đề thi đang mở
                </button>
              )}
            </div>
          ) : scoreHistoryData.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">
                Không có bài thi nào phù hợp với bộ lọc đã chọn.
              </p>
              <button
                type="button"
                onClick={() => setChartScope('all')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>
          ) : chartType === 'timeline' ? (
            <div className="w-full h-[320px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreHistoryData} margin={{ top: 20, right: 15, left: -15, bottom: 25 }}>
                  <defs>
                    <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="shortDate"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    dy={8}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white p-4 rounded-2xl shadow-xl border border-slate-700 max-w-xs text-xs z-50">
                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                              <span className="text-[11px] font-bold text-slate-300">
                                {data.quizType === 'practice' ? 'Luyện tập' : 'Đề thi'} · #{data.attemptNumber}
                              </span>
                              <span className="text-slate-400 text-[11px] font-mono tabular-nums">
                                {data.date}
                              </span>
                            </div>
                            <p className="font-bold text-slate-100 text-sm mb-2 line-clamp-2">
                              {data.quizTitle}
                            </p>
                            <div className="grid grid-cols-2 gap-3 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold">Điểm số</p>
                                <p
                                  className={`text-base font-black font-mono tabular-nums ${
                                    data.score >= 8
                                      ? 'text-emerald-400'
                                      : data.score >= 5
                                      ? 'text-blue-400'
                                      : 'text-rose-400'
                                  }`}
                                >
                                  {data.score.toFixed(2)} / 10
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold">Thời gian</p>
                                <p className="text-slate-200 font-bold font-mono tabular-nums text-xs mt-1">
                                  {data.durationMinutes} phút
                                </p>
                              </div>
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
                    strokeDasharray="4 4"
                    label={{ value: 'Giỏi (8.0)', position: 'insideTopRight', fill: '#10b981', fontSize: 10, fontWeight: 700 }}
                  />
                  <ReferenceLine
                    y={5}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: 'Đạt (5.0)', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 10, fontWeight: 700 }}
                  />
                  <ReferenceLine
                    y={Number(stats.avgScore.toFixed(2))}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    label={{ value: `ĐTB (${stats.avgScore.toFixed(2)})`, position: 'insideLeft', fill: '#6366f1', fontSize: 10, fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    name="Điểm số"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fill="url(#scoreAreaGradient)"
                    activeDot={{ r: 7, fill: '#2563eb', stroke: '#fff', strokeWidth: 3 }}
                    dot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="w-full h-[320px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistributionData} margin={{ top: 20, right: 15, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    dy={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs z-50">
                            <p className="font-bold text-slate-300 mb-1">{data.name}</p>
                            <p className="text-sm font-bold text-white font-mono tabular-nums">
                              Số lượng: <span className="text-emerald-400">{data.count}</span> bài ({data.percentage}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" name="Số bài thi" radius={[10, 10, 0, 0]} maxBarSize={64}>
                    {scoreDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-xs font-medium text-slate-600">
                {scoreDistributionData.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
                    <span>
                      {item.name}: <strong className="font-mono tabular-nums">{item.count}</strong> bài ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
