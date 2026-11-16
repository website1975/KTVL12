import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Quiz, Result } from '../types';
import { getResultsMetadata, getStudentClassProfiles, StudentClassProfile } from '../services/storage';
import {
  Trophy,
  Medal,
  Award,
  Users,
  RefreshCw,
  Search,
  Clock,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  WifiOff,
  Loader2,
  Target,
} from 'lucide-react';
import { format } from 'date-fns';

interface StudentLeaderboardProps {
  student: User;
  results: Result[];
  quizzes: Quiz[];
  selectedQuizId: string;
  onSelectQuizId: (quizId: string) => void;
  refreshTrigger?: number;
  isOnline?: boolean;
}

interface LeaderboardEntry {
  studentKey: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId?: string;
  className?: string;
  bestScore: number;
  durationSeconds: number;
  submittedAt: string;
  attemptsCount: number;
  rank: number;
  isCurrentUser: boolean;
}

interface CompletedQuizOption {
  quizId: string;
  quizTitle: string;
  quizType: 'test' | 'practice';
  latestSubmittedAt: string;
  myBestScore: number;
  myAttempts: number;
}

const formatDurationShort = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const normalizeCode = (code?: string): string => {
  if (!code) return '';
  const trimmed = code.trim().toUpperCase();
  return trimmed === 'N/A' ? '' : trimmed;
};

const buildStudentKey = (r: { studentCode?: string; studentId?: string }): string => {
  const code = normalizeCode(r.studentCode);
  if (code) return `code:${code}`;
  return `id:${String(r.studentId || '').trim()}`;
};

export default function StudentLeaderboard({
  student,
  results,
  quizzes,
  selectedQuizId,
  onSelectQuizId,
  refreshTrigger = 0,
  isOnline = true,
}: StudentLeaderboardProps) {
  const [rawQuizResults, setRawQuizResults] = useState<Result[]>([]);
  const [classProfiles, setClassProfiles] = useState<StudentClassProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'class'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRows, setShowAllRows] = useState(false);

  // Danh sách các đề thi mà học sinh đã hoàn thành (sắp xếp theo lần nộp gần nhất)
  const completedQuizOptions = useMemo<CompletedQuizOption[]>(() => {
    const map = new Map<string, CompletedQuizOption>();

    const sortedResults = [...results].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    for (const r of sortedResults) {
      if (!r.quizId) continue;
      const matchedQuiz = quizzes.find((q) => q.id === r.quizId);
      const title = matchedQuiz?.title || r.quizTitle || 'Đề thi đã hoàn thành';
      const type: 'test' | 'practice' =
        (matchedQuiz?.type || r.quizType) === 'practice' ? 'practice' : 'test';

      const existing = map.get(r.quizId);
      if (!existing) {
        map.set(r.quizId, {
          quizId: r.quizId,
          quizTitle: title,
          quizType: type,
          latestSubmittedAt: r.submittedAt,
          myBestScore: r.score,
          myAttempts: 1,
        });
      } else {
        existing.myBestScore = Math.max(existing.myBestScore, r.score);
        existing.myAttempts += 1;
        if (new Date(r.submittedAt).getTime() > new Date(existing.latestSubmittedAt).getTime()) {
          existing.latestSubmittedAt = r.submittedAt;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latestSubmittedAt).getTime() - new Date(a.latestSubmittedAt).getTime()
    );
  }, [results, quizzes]);

  // Tự động chọn đề thi gần nhất nếu chưa chọn hoặc đề hiện tại không nằm trong danh sách
  useEffect(() => {
    if (completedQuizOptions.length === 0) return;
    const exists = completedQuizOptions.some((opt) => opt.quizId === selectedQuizId);
    if (!selectedQuizId || !exists) {
      onSelectQuizId(completedQuizOptions[0].quizId);
    }
  }, [completedQuizOptions, selectedQuizId, onSelectQuizId]);

  const activeQuizOption = useMemo(
    () => completedQuizOptions.find((opt) => opt.quizId === selectedQuizId) || null,
    [completedQuizOptions, selectedQuizId]
  );

  const loadLeaderboardData = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!selectedQuizId) {
        setRawQuizResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const [metaResults, profiles] = await Promise.all([
          getResultsMetadata(selectedQuizId, 1000, forceRefresh),
          getStudentClassProfiles(false),
        ]);
        setRawQuizResults(metaResults);
        setClassProfiles(profiles);
        setLastUpdatedAt(new Date());
      } catch (err) {
        console.warn('Lỗi tải bảng xếp hạng:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedQuizId]
  );

  useEffect(() => {
    if (!selectedQuizId) return;
    const shouldForce = refreshTrigger > 0;
    loadLeaderboardData(shouldForce);
  }, [selectedQuizId, refreshTrigger, loadLeaderboardData]);

  // Tra cứu nhanh thông tin lớp từ profile theo ID hoặc MSHS
  const profileLookup = useMemo(() => {
    const byId = new Map<string, StudentClassProfile>();
    const byCode = new Map<string, StudentClassProfile>();
    for (const p of classProfiles) {
      if (p.id) byId.set(p.id, p);
      const code = normalizeCode(p.studentCode);
      if (code) byCode.set(code, p);
    }
    return { byId, byCode };
  }, [classProfiles]);

  // Tổng hợp thành tích tốt nhất của từng học sinh & tính thứ hạng
  const rankedEntries = useMemo<LeaderboardEntry[]>(() => {
    if (!selectedQuizId) return [];

    // Hợp nhất kết quả từ Cloud + kết quả cục bộ của học sinh hiện tại để đảm bảo hiển thị ngay sau khi nộp
    const localForQuiz = results.filter((r) => r.quizId === selectedQuizId);
    const mergedByResultId = new Map<string, Result>();

    for (const r of rawQuizResults) {
      mergedByResultId.set(r.id, r);
    }
    for (const r of localForQuiz) {
      if (!mergedByResultId.has(r.id)) {
        mergedByResultId.set(r.id, r);
      }
    }

    const myCode = normalizeCode(student.studentCode);
    const grouped = new Map<
      string,
      {
        studentKey: string;
        studentId: string;
        studentName: string;
        studentCode: string;
        classId?: string;
        className?: string;
        best: Result;
        attemptsCount: number;
        isCurrentUser: boolean;
      }
    >();

    for (const r of mergedByResultId.values()) {
      const key = buildStudentKey(r);
      const rCode = normalizeCode(r.studentCode);
      const profile =
        profileLookup.byId.get(r.studentId) ||
        (rCode ? profileLookup.byCode.get(rCode) : undefined);

      const resolvedClassId = r.classId || profile?.classId || '';
      const resolvedClassName = r.className || profile?.className || '';
      const isMe =
        r.studentId === student.id ||
        Boolean(myCode && rCode && myCode === rCode);

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          studentKey: key,
          studentId: r.studentId,
          studentName: r.studentName || 'Học sinh',
          studentCode: r.studentCode && r.studentCode !== 'N/A' ? r.studentCode : '—',
          classId: resolvedClassId || (isMe ? student.classId : undefined),
          className: resolvedClassName || (isMe ? student.className : undefined),
          best: r,
          attemptsCount: 1,
          isCurrentUser: isMe,
        });
      } else {
        existing.attemptsCount += 1;
        existing.isCurrentUser = existing.isCurrentUser || isMe;
        if (!existing.className && resolvedClassName) existing.className = resolvedClassName;
        if (!existing.classId && resolvedClassId) existing.classId = resolvedClassId;

        const currBest = existing.best;
        const isBetterScore = r.score > currBest.score;
        const isTieScoreFaster =
          r.score === currBest.score &&
          (r.durationSeconds || Number.MAX_SAFE_INTEGER) <
            (currBest.durationSeconds || Number.MAX_SAFE_INTEGER);
        const isTieAllEarlier =
          r.score === currBest.score &&
          (r.durationSeconds || 0) === (currBest.durationSeconds || 0) &&
          new Date(r.submittedAt).getTime() < new Date(currBest.submittedAt).getTime();

        if (isBetterScore || isTieScoreFaster || isTieAllEarlier) {
          existing.best = r;
          if (r.studentName) existing.studentName = r.studentName;
        }
      }
    }

    let items = Array.from(grouped.values());

    // Lọc theo phạm vi lớp học nếu người dùng chọn "Cùng lớp"
    if (scopeFilter === 'class' && (student.classId || student.className)) {
      items = items.filter((item) => {
        if (item.isCurrentUser) return true;
        const matchId = Boolean(student.classId && item.classId && item.classId === student.classId);
        const matchName = Boolean(
          student.className &&
            item.className &&
            item.className.trim().toLowerCase() === student.className.trim().toLowerCase()
        );
        return matchId || matchName;
      });
    }

    // Sắp xếp: Điểm cao nhất -> Thời gian nhanh nhất -> Nộp sớm nhất
    items.sort((a, b) => {
      if (b.best.score !== a.best.score) {
        return b.best.score - a.best.score;
      }
      const durA = a.best.durationSeconds > 0 ? a.best.durationSeconds : Number.MAX_SAFE_INTEGER;
      const durB = b.best.durationSeconds > 0 ? b.best.durationSeconds : Number.MAX_SAFE_INTEGER;
      if (durA !== durB) {
        return durA - durB;
      }
      return new Date(a.best.submittedAt).getTime() - new Date(b.best.submittedAt).getTime();
    });

    // Tính thứ hạng chuẩn thi đấu (Competition ranking: 1, 2, 2, 4)
    const finalList: LeaderboardEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let rank = i + 1;
      if (i > 0) {
        const prev = items[i - 1];
        const prevDur = prev.best.durationSeconds > 0 ? prev.best.durationSeconds : Number.MAX_SAFE_INTEGER;
        const currDur = item.best.durationSeconds > 0 ? item.best.durationSeconds : Number.MAX_SAFE_INTEGER;
        if (prev.best.score === item.best.score && prevDur === currDur) {
          rank = finalList[i - 1].rank;
        }
      }

      finalList.push({
        studentKey: item.studentKey,
        studentId: item.studentId,
        studentName: item.studentName,
        studentCode: item.studentCode,
        classId: item.classId,
        className: item.className,
        bestScore: item.best.score,
        durationSeconds: item.best.durationSeconds || 0,
        submittedAt: item.best.submittedAt,
        attemptsCount: item.attemptsCount,
        rank,
        isCurrentUser: item.isCurrentUser,
      });
    }

    return finalList;
  }, [selectedQuizId, rawQuizResults, results, profileLookup, scopeFilter, student]);

  const myEntry = useMemo(
    () => rankedEntries.find((entry) => entry.isCurrentUser) || null,
    [rankedEntries]
  );

  const quizStats = useMemo(() => {
    if (rankedEntries.length === 0) {
      return { topScore: 0, avgScore: 0, totalParticipants: 0 };
    }
    const topScore = rankedEntries[0].bestScore;
    const sum = rankedEntries.reduce((acc, e) => acc + e.bestScore, 0);
    return {
      topScore,
      avgScore: sum / rankedEntries.length,
      totalParticipants: rankedEntries.length,
    };
  }, [rankedEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedEntries;
    return rankedEntries.filter(
      (entry) =>
        entry.studentName.toLowerCase().includes(q) ||
        entry.studentCode.toLowerCase().includes(q) ||
        (entry.className && entry.className.toLowerCase().includes(q))
    );
  }, [rankedEntries, searchQuery]);

  const DEFAULT_VISIBLE = 15;
  const displayedEntries = useMemo(() => {
    if (showAllRows || searchQuery.trim()) return filteredEntries;
    return filteredEntries.slice(0, DEFAULT_VISIBLE);
  }, [filteredEntries, showAllRows, searchQuery]);

  const isMyRowOutsideDefault = useMemo(() => {
    if (!myEntry || showAllRows || searchQuery.trim()) return false;
    return !displayedEntries.some((e) => e.studentKey === myEntry.studentKey);
  }, [myEntry, showAllRows, searchQuery, displayedEntries]);

  const handleJumpToMyRow = () => {
    if (!myEntry) return;
    if (!showAllRows) setShowAllRows(true);
    setTimeout(() => {
      const el = document.getElementById('my-leaderboard-row');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-black text-amber-700">
          <Trophy size={15} className="text-amber-500 shrink-0" />
          <span>#1</span>
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-black text-slate-600">
          <Medal size={15} className="text-slate-400 shrink-0" />
          <span>#2</span>
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums font-black text-orange-700">
          <Award size={15} className="text-orange-500 shrink-0" />
          <span>#3</span>
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums font-bold text-slate-500 text-xs">
        #{rank}
      </span>
    );
  };

  const scoreGapToTop = myEntry ? Math.max(0, quizStats.topScore - myEntry.bestScore) : 0;
  const percentileBetter =
    myEntry && quizStats.totalParticipants > 1
      ? Math.round(
          ((quizStats.totalParticipants - myEntry.rank) / (quizStats.totalParticipants - 1)) * 100
        )
      : myEntry
      ? 100
      : 0;

  return (
    <section
      id="student-leaderboard"
      className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden scroll-mt-6"
    >
      {/* Header & Bộ chọn đề thi */}
      <div className="p-6 sm:p-8 border-b border-slate-100 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
              <Trophy size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                  Bảng Xếp Hạng Kết Quả Thi
                </h2>
                {lastUpdatedAt && (
                  <span className="text-[11px] font-medium text-slate-400 font-mono tabular-nums">
                    · Cập nhật {format(lastUpdatedAt, 'HH:mm')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Xếp hạng theo điểm cao nhất của mỗi học sinh · Ưu tiên thời gian làm bài nhanh hơn khi bằng điểm
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {(student.classId || student.className) && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    scopeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Toàn đề
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('class')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    scopeFilter === 'class'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Lớp {student.className || 'của bạn'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => loadLeaderboardData(true)}
              disabled={isLoading || !selectedQuizId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              title="Cập nhật thứ hạng mới nhất từ máy chủ"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
              <span>Cập nhật</span>
            </button>
          </div>
        </div>

        {/* Bộ chọn đề thi đã làm */}
        {completedQuizOptions.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="leaderboard-quiz-select"
                className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Chọn bài thi / bài luyện tập để xem thứ hạng
              </label>
              <select
                id="leaderboard-quiz-select"
                value={selectedQuizId}
                onChange={(e) => {
                  onSelectQuizId(e.target.value);
                  setSearchQuery('');
                  setShowAllRows(false);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
              >
                {completedQuizOptions.map((opt) => (
                  <option key={opt.quizId} value={opt.quizId}>
                    {opt.quizType === 'practice' ? '[Luyện tập] ' : '[Đề thi] '}
                    {opt.quizTitle} — Điểm cao nhất của bạn: {opt.myBestScore.toFixed(2)}đ
                  </option>
                ))}
              </select>
            </div>

            {rankedEntries.length > 8 && (
              <div className="md:w-64">
                <label
                  htmlFor="leaderboard-search"
                  className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5"
                >
                  Tìm thí sinh
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    id="leaderboard-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tên, MSHS hoặc lớp..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trạng thái chưa có bài thi nào */}
      {completedQuizOptions.length === 0 ? (
        <div className="p-12 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Trophy size={22} />
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase">Chưa có dữ liệu xếp hạng</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Sau khi bạn hoàn thành ít nhất một bài thi hoặc bài luyện tập, bảng xếp hạng vị trí của bạn so với các bạn khác sẽ hiển thị tại đây.
          </p>
        </div>
      ) : (
        <div className="p-6 sm:p-8 space-y-6">
          {!isOnline && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2.5">
              <WifiOff size={16} className="text-amber-600 shrink-0" />
              <span>
                Thiết bị đang ngoại tuyến. Thứ hạng mới nhất của cả lớp sẽ tự động cập nhật khi có kết nối Internet trở lại.
              </span>
            </div>
          )}

          {/* Thẻ tóm tắt vị trí cá nhân */}
          {myEntry && (
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                    Hạng
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-amber-400 leading-tight mt-0.5">
                    #{myEntry.rank}
                  </span>
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium">
                    <span className="font-bold text-white uppercase tracking-tight truncate">
                      {student.fullName}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      Vị trí {myEntry.rank}/{quizStats.totalParticipants} thí sinh
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {activeQuizOption?.quizTitle}
                    {quizStats.totalParticipants > 1 && (
                      <span> · Vượt trên {percentileBetter}% thí sinh tham gia</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Điểm cao nhất
                  </p>
                  <p className="text-lg font-black font-mono tabular-nums text-emerald-400 mt-0.5">
                    {myEntry.bestScore.toFixed(2)}đ
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Thời gian nhanh nhất
                  </p>
                  <p className="text-lg font-black font-mono tabular-nums text-white mt-0.5">
                    {formatDurationShort(myEntry.durationSeconds)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    So với Top 1
                  </p>
                  <p className="text-sm font-bold font-mono tabular-nums text-amber-300 mt-1">
                    {scoreGapToTop === 0 ? 'Đang dẫn đầu' : `-${scoreGapToTop.toFixed(2)}đ`}
                  </p>
                </div>
                <div className="flex items-center justify-start sm:justify-end">
                  <button
                    type="button"
                    onClick={handleJumpToMyRow}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    <Target size={14} className="text-amber-400" />
                    <span>Vị trí của tôi</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Thống kê nhanh toàn bài */}
          {rankedEntries.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  <strong className="font-mono tabular-nums text-slate-800">
                    {quizStats.totalParticipants}
                  </strong>{' '}
                  thí sinh đã nộp
                </span>
                <span>
                  Điểm cao nhất:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {quizStats.topScore.toFixed(2)}đ
                  </strong>
                </span>
                <span>
                  Điểm trung bình:{' '}
                  <strong className="font-mono tabular-nums text-slate-800">
                    {quizStats.avgScore.toFixed(2)}đ
                  </strong>
                </span>
              </div>
              {myEntry && (
                <span className="text-[11px] font-medium text-slate-400 font-mono tabular-nums">
                  Số lượt bạn đã làm: {myEntry.attemptsCount}
                </span>
              )}
            </div>
          )}

          {/* Top 3 nổi bật khi không lọc tìm kiếm */}
          {!searchQuery.trim() && rankedEntries.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rankedEntries.slice(0, 3).map((top) => {
                const isFirst = top.rank === 1;
                const isSecond = top.rank === 2;
                return (
                  <div
                    key={top.studentKey}
                    className={`rounded-2xl border p-4 transition-colors ${
                      top.isCurrentUser
                        ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200'
                        : isFirst
                        ? 'bg-amber-50/50 border-amber-200'
                        : isSecond
                        ? 'bg-slate-50/80 border-slate-200'
                        : 'bg-orange-50/30 border-orange-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {renderRankBadge(top.rank)}
                      <span className="font-mono tabular-nums text-base font-black text-slate-900">
                        {top.bestScore.toFixed(2)}đ
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900 truncate">
                      {top.studentName}
                      {top.isCurrentUser && (
                        <span className="ml-1.5 text-[11px] font-bold text-blue-700">(Bạn)</span>
                      )}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-slate-500 font-medium">
                      <span className="truncate">
                        {top.studentCode}
                        {top.className ? ` · Lớp ${top.className}` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                        <Clock size={11} className="text-slate-400" />
                        {formatDurationShort(top.durationSeconds)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bảng xếp hạng chi tiết */}
          {isLoading && rankedEntries.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-blue-600 mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tổng hợp bảng xếp hạng...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-10 text-center text-xs font-medium text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
              {searchQuery.trim()
                ? `Không tìm thấy thí sinh khớp với "${searchQuery.trim()}".`
                : 'Chưa có bài nộp nào trong phạm vi đã chọn.'}
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 w-24">Hạng</th>
                    <th className="py-3.5 px-4">Học sinh</th>
                    <th className="py-3.5 px-4 text-center hidden sm:table-cell">Lượt làm</th>
                    <th className="py-3.5 px-4 text-right">Thời gian</th>
                    <th className="py-3.5 px-4 text-right">Điểm cao nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {displayedEntries.map((entry) => (
                    <tr
                      key={entry.studentKey}
                      id={entry.isCurrentUser ? 'my-leaderboard-row' : undefined}
                      className={
                        entry.isCurrentUser
                          ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-200 font-semibold'
                          : 'hover:bg-slate-50/70 transition-colors'
                      }
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">{renderRankBadge(entry.rank)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-bold ${
                                entry.isCurrentUser ? 'text-blue-900' : 'text-slate-800'
                              }`}
                            >
                              {entry.studentName}
                            </span>
                            {entry.isCurrentUser && (
                              <span className="text-[11px] font-black text-blue-700">(Bạn)</span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {entry.studentCode}
                            {entry.className ? ` · Lớp ${entry.className}` : ''}
                            {entry.submittedAt
                              ? ` · Nộp ${format(new Date(entry.submittedAt), 'HH:mm dd/MM')}`
                              : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-600 hidden sm:table-cell">
                        {entry.attemptsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDurationShort(entry.durationSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono tabular-nums text-sm font-black ${
                            entry.bestScore >= 8
                              ? 'text-emerald-700'
                              : entry.bestScore >= 5
                              ? 'text-blue-700'
                              : 'text-orange-700'
                          }`}
                        >
                          {entry.bestScore.toFixed(2)}đ
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Nếu học sinh hiện tại nằm ngoài Top 15 mặc định, ghim thêm dòng vị trí của chính họ */}
                  {isMyRowOutsideDefault && myEntry && (
                    <>
                      <tr className="bg-slate-50/60">
                        <td
                          colSpan={5}
                          className="py-1.5 px-4 text-center text-[11px] font-medium text-slate-400"
                        >
                          ··· Vị trí hiện tại của bạn ···
                        </td>
                      </tr>
                      <tr
                        id="my-leaderboard-row"
                        className="bg-blue-50/80 ring-1 ring-inset ring-blue-200 font-semibold"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderRankBadge(myEntry.rank)}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-blue-900">{myEntry.studentName}</span>
                              <span className="text-[11px] font-black text-blue-700">(Bạn)</span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-normal">
                              {myEntry.studentCode}
                              {myEntry.className ? ` · Lớp ${myEntry.className}` : ''}
                              {myEntry.submittedAt
                                ? ` · Nộp ${format(new Date(myEntry.submittedAt), 'HH:mm dd/MM')}`
                                : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums text-slate-600 hidden sm:table-cell">
                          {myEntry.attemptsCount}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {formatDurationShort(myEntry.durationSeconds)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-mono tabular-nums text-sm font-black text-blue-700">
                            {myEntry.bestScore.toFixed(2)}đ
                          </span>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Điều khiển mở rộng / thu gọn danh sách */}
          {!searchQuery.trim() && filteredEntries.length > DEFAULT_VISIBLE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-500 font-medium">
              <span className="font-mono tabular-nums">
                Đang hiển thị {displayedEntries.length} / {filteredEntries.length} thí sinh
              </span>
              <div className="flex items-center gap-2">
                {!showAllRows ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRows(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ChevronDown size={14} />
                    <span>Xem tất cả ({filteredEntries.length})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAllRows(false);
                      const el = document.getElementById('student-leaderboard');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ChevronUp size={14} />
                    <span>Thu gọn về Top {DEFAULT_VISIBLE}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {showAllRows && myEntry && myEntry.rank > 10 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleJumpToMyRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                <ArrowUp size={13} />
                <span>Tới dòng vị trí của bạn (#{myEntry.rank})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
