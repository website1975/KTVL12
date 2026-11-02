import React from 'react';
import { CheckCircle2, Clock, HelpCircle, Sparkles } from 'lucide-react';

interface QuizProgressIndicatorProps {
  completed: number;
  total: number;
  variant?: 'card' | 'table' | 'banner' | 'pill';
  showLabel?: boolean;
  className?: string;
}

/**
 * Đếm số lượng câu hỏi học sinh đã thực sự hoàn thành / trả lời trong một bài thi
 */
export const countCompletedQuestions = (userAnswers?: Record<string, any>, totalQuestions?: number): number => {
  if (!userAnswers || typeof userAnswers !== 'object') {
    return 0;
  }
  let count = 0;
  for (const [_, ans] of Object.entries(userAnswers)) {
    if (ans === null || ans === undefined) continue;
    if (typeof ans === 'string') {
      if (ans.trim() !== '') count++;
    } else if (typeof ans === 'number' || typeof ans === 'boolean') {
      count++;
    } else if (typeof ans === 'object') {
      // Group-TF: object containing subQuestion answers like { 0: 'True', 1: 'False' }
      const hasSub = Object.values(ans).some(
        v => v !== null && v !== undefined && String(v).trim() !== ''
      );
      if (hasSub) count++;
    }
  }
  if (totalQuestions && totalQuestions > 0 && count > totalQuestions) {
    return totalQuestions;
  }
  return count;
};

export default function QuizProgressIndicator({
  completed,
  total,
  variant = 'card',
  showLabel = true,
  className = ''
}: QuizProgressIndicatorProps) {
  const safeTotal = Math.max(0, total);
  const safeCompleted = Math.min(safeTotal, Math.max(0, completed));
  const percentage = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;
  const isAllDone = safeTotal > 0 && safeCompleted === safeTotal;

  // Màu sắc theo mức độ hoàn thành
  const getProgressColor = () => {
    if (safeTotal === 0 || safeCompleted === 0) return 'bg-slate-300';
    if (isAllDone) return 'bg-gradient-to-r from-emerald-500 to-teal-500';
    if (percentage >= 75) return 'bg-gradient-to-r from-blue-500 to-indigo-600';
    if (percentage >= 40) return 'bg-gradient-to-r from-amber-400 to-orange-500';
    return 'bg-gradient-to-r from-rose-400 to-red-500';
  };

  const getTextColor = () => {
    if (safeTotal === 0 || safeCompleted === 0) return 'text-slate-400';
    if (isAllDone) return 'text-emerald-700';
    if (percentage >= 75) return 'text-blue-700';
    if (percentage >= 40) return 'text-amber-700';
    return 'text-rose-700';
  };

  const getBadgeBg = () => {
    if (safeTotal === 0 || safeCompleted === 0) return 'bg-slate-100 text-slate-500 border-slate-200';
    if (isAllDone) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (percentage >= 75) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (percentage >= 40) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  // 1. Dạng Table (Dùng trong dòng bảng lịch sử nộp bài)
  if (variant === 'table') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1.5 min-w-[130px] ${className}`}>
        <div className="flex items-center justify-between w-full px-1 text-[11px] font-black">
          <span className="text-slate-700">
            {safeCompleted}/{safeTotal} câu
          </span>
          <span className={`text-[10px] font-extrabold ${getTextColor()}`}>
            {percentage}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
          {isAllDone ? (
            <span className="text-emerald-600 flex items-center gap-0.5">
              <CheckCircle2 size={10} /> Đã làm hết
            </span>
          ) : safeCompleted === 0 ? (
            <span>Chưa trả lời</span>
          ) : (
            <span>Còn {safeTotal - safeCompleted} câu</span>
          )}
        </div>
      </div>
    );
  }

  // 2. Dạng Pill (Huy hiệu nhỏ gọn)
  if (variant === 'pill') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[9px] font-black uppercase ${getBadgeBg()} ${className}`}>
        {isAllDone && <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />}
        <span>{safeCompleted}/{safeTotal} câu ({percentage}%)</span>
      </div>
    );
  }

  // 3. Dạng Banner (Dùng ở phần thống kê tổng hợp)
  if (variant === 'banner') {
    return (
      <div className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col gap-2.5 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black">
              📊
            </span>
            <span className="font-black text-slate-700 uppercase tracking-tight text-[11px]">
              Tiến độ làm câu hỏi
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${getBadgeBg()}`}>
            {safeCompleted}/{safeTotal} câu ({percentage}%)
          </span>
        </div>

        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
          <span>{safeCompleted === 0 ? 'Chưa bắt đầu làm bài' : `Đã hoàn thành ${safeCompleted} câu hỏi`}</span>
          <span>{safeTotal - safeCompleted > 0 ? `Còn ${safeTotal - safeCompleted} câu` : '✓ Trọn vẹn 100%'}</span>
        </div>
      </div>
    );
  }

  // 4. Dạng Card (Mặc định - Dành cho các thẻ Quiz card trên Dashboard)
  return (
    <div className={`w-full bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 flex flex-col gap-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-[9px] font-black uppercase">
          <span className="text-slate-500 tracking-tight flex items-center gap-1">
            {isAllDone ? (
              <CheckCircle2 size={11} className="text-emerald-600" />
            ) : (
              <Clock size={11} className="text-slate-400" />
            )}
            Tiến độ hoàn thành:
          </span>
          <span className={getTextColor()}>
            {safeCompleted}/{safeTotal} câu ({percentage}%)
          </span>
        </div>
      )}

      {/* Progress Track & Bar */}
      <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-xs ${getProgressColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[8px] font-bold text-slate-400">
        <span>
          {safeCompleted === 0
            ? 'Chưa làm câu nào'
            : isAllDone
            ? '✓ Hoàn thành trọn vẹn'
            : `Đã làm ${percentage}% đề thi`}
        </span>
        {safeTotal > safeCompleted && safeCompleted > 0 && (
          <span className="text-amber-600 font-black">
            Còn {safeTotal - safeCompleted} câu
          </span>
        )}
      </div>
    </div>
  );
}
