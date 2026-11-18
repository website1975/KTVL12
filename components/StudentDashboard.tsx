import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Quiz, Result, PublishedResult, Chapter, LiveReviewSession } from '../types';
import {
  getQuizzesMetadata,
  getResultsForStudent,
  getPublishedResultsForStudent,
  getQuizById,
  getResultById,
  getStudentActiveSessions,
  deleteExamSession,
  getChapters,
  getCurrentAcademicYear,
} from '../services/storage';
import {
  downloadQuizForOffline,
  getOfflineQuizzes,
  getOfflineQuizById,
  deleteOfflineQuiz,
} from '../services/offlineStorage';
import { useOfflineSync } from '../services/offlineSyncManager';
import {
  getActiveLiveReviewForStudent,
  getLiveReviewedQuizIds,
  subscribeActiveLiveReviewUpdates,
} from '../services/liveReviewService';
import LiveReviewStudentTaker from './LiveReviewStudentTaker';
import OfflineManagerModal from './OfflineManagerModal';
import QuizTaker from './QuizTaker';
import QuickPractice from './QuickPractice';
import ResultDetailModal from './admin/ResultDetailModal';
import QuizPreviewModal from './admin/QuizPreviewModal';
import QuizProgressIndicator, { countCompletedQuestions } from './QuizProgressIndicator';
import StudentLeaderboard from './StudentLeaderboard';
import StudentAnalyticsPanel from './StudentAnalyticsPanel';
import {
  Clock,
  Trophy,
  Eye,
  Medal,
  History,
  ChevronRight,
  Award,
  X,
  Loader2,
  RefreshCw,
  Zap,
  ShieldAlert,
  Calendar,
  Lock,
  FileText,
  CheckCircle2,
  Download,
  Wifi,
  WifiOff,
  CloudCheck,
  HardDrive,
  Trash2,
  AlertTriangle,
  Radio,
  RotateCcw,
  BarChart3,
  Filter,
} from 'lucide-react';
import { format, isBefore, isAfter, addMinutes, differenceInMinutes } from 'date-fns';

interface StudentDashboardProps {
  user: User;
  targetQuizId?: string | null;
}

type StudentMenuKey =
  | 'exams'
  | 'practice'
  | 'overview'
  | 'history'
  | 'leaderboard'
  | 'honors'
  | 'offline';

export default function StudentDashboard({ user, targetQuizId }: StudentDashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const gradeFilter = user.grade || '10';
  const currentAcademicYear = getCurrentAcademicYear();
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(
    user.academicYear || currentAcademicYear
  );
  const [chapterFilter, setChapterFilter] = useState('all');

  // Menu 2-panel: Chỉ kích hoạt & render panel đang chọn để tối ưu băng thông
  const [activeMenu, setActiveMenu] = useState<StudentMenuKey>('exams');
  const [examSubTab, setExamSubTab] = useState<'all' | 'open' | 'upcoming' | 'uncompleted'>('all');

  // Lazy-loaded Honors state (chỉ tải từ Cloud khi học sinh mở mục Vinh danh)
  const [publishedResults, setPublishedResults] = useState<PublishedResult[]>([]);
  const [honorsLoaded, setHonorsLoaded] = useState(false);
  const [isLoadingHonors, setIsLoadingHonors] = useState(false);

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activePracticeQuiz, setActivePracticeQuiz] = useState<Quiz | null>(null);
  const [selectedResult, setSelectedResult] = useState<{ result: Result; quiz: Quiz } | null>(null);
  const [viewingHonorees, setViewingHonorees] = useState<PublishedResult | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [leaderboardQuizId, setLeaderboardQuizId] = useState<string>('');
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState<number>(0);

  // Live Review Session
  const [activeLiveSession, setActiveLiveSession] = useState<LiveReviewSession | null>(null);
  const [liveReviewSessionCheck, setLiveReviewSessionCheck] = useState<LiveReviewSession | null>(null);
  const [liveReviewedQuizIds, setLiveReviewedQuizIds] = useState<string[]>(() =>
    getLiveReviewedQuizIds()
  );

  // Offline Sync Hook
  const {
    isOnline,
    isSyncing,
    pendingCount,
    downloadedCount,
    syncFeedback,
    manualSync,
  } = useOfflineSync(user.id);

  const [downloadedQuizzes, setDownloadedQuizzes] = useState<Quiz[]>([]);
  const [downloadedQuizIds, setDownloadedQuizIds] = useState<Set<string>>(new Set());
  const [downloadingQuizId, setDownloadingQuizId] = useState<string | null>(null);
  const [downloadStatusText, setDownloadStatusText] = useState<string>('');
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);

  const loadDownloadedQuizzes = useCallback(async () => {
    try {
      const list = await getOfflineQuizzes(user.id);
      setDownloadedQuizzes(list.map((item) => item.quiz));
      setDownloadedQuizIds(new Set(list.map((item) => item.quizId)));
    } catch (err) {
      console.error('Lỗi nạp danh sách đề thi ngoại tuyến:', err);
    }
  }, [user.id]);

  useEffect(() => {
    loadDownloadedQuizzes();
  }, [loadDownloadedQuizzes, downloadedCount]);

  const lastLiveCheckRef = React.useRef<number>(0);

  const checkLiveReview = useCallback(
    async (force: boolean = false) => {
      if (activeLiveSession) return;
      const nowMs = Date.now();
      if (!force && nowMs - lastLiveCheckRef.current < 5000) return;
      lastLiveCheckRef.current = nowMs;
      try {
        const session = await getActiveLiveReviewForStudent(user);
        setLiveReviewSessionCheck((prev) => {
          if (!prev && !session) return null;
          if (
            prev &&
            session &&
            prev.id === session.id &&
            prev.updatedAt === session.updatedAt &&
            prev.currentQuestionIndex === session.currentQuestionIndex &&
            prev.status === session.status
          ) {
            return prev;
          }
          return session;
        });
        setLiveReviewedQuizIds(getLiveReviewedQuizIds());
      } catch (e) {}
    },
    [user.id, user.classId, user.className, activeLiveSession]
  );

  // Kiểm tra phiên sửa bài trực tiếp (chỉ chạy 1 lần lúc đăng nhập + Realtime/BroadcastChannel + khi bấm nút Làm mới)
  useEffect(() => {
    let isMounted = true;
    const runCheck = (force = false) => {
      if (!isMounted || activeLiveSession) return;
      checkLiveReview(force);
    };

    runCheck(true);

    const unsubscribeRealtime = subscribeActiveLiveReviewUpdates(() => {
      runCheck(true);
    });

    let liveChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        liveChannel = new BroadcastChannel('eduquiz_live_review_sync');
        liveChannel.onmessage = (e) => {
          if (!isMounted) return;
          if (e.data?.type === 'SESSION_END') {
            setLiveReviewSessionCheck(null);
            setActiveLiveSession(null);
          } else if (e.data?.type === 'SESSION_UPDATE') {
            if (e.data.session?.status === 'ended') {
              setLiveReviewSessionCheck(null);
              setActiveLiveSession(null);
            } else if (!activeLiveSession) {
              runCheck(true);
            }
          }
        };
      }
    } catch (e) {}

    return () => {
      isMounted = false;
      unsubscribeRealtime();
      if (liveChannel) {
        try {
          liveChannel.close();
        } catch (e) {}
      }
    };
  }, [checkLiveReview, activeLiveSession]);

  const handleDownloadQuiz = async (quiz: Quiz, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (downloadingQuizId) return;

    setDownloadingQuizId(quiz.id);
    setDownloadStatusText('Đang nạp dữ liệu câu hỏi & hình ảnh...');

    try {
      const fullQuiz =
        quiz.questions && quiz.questions.length > 0 ? quiz : await getQuizById(quiz.id);
      if (!fullQuiz) {
        alert('Không thể lấy nội dung đề thi để tải về.');
        return;
      }

      setDownloadStatusText('Đang mã hóa hình ảnh & công thức ngoại tuyến...');
      const result = await downloadQuizForOffline(fullQuiz.id, user.id);
      if (result.success) {
        await loadDownloadedQuizzes();
        alert(
          `Đã tải thành công đề "${fullQuiz.title}" về máy (${result.sizeKb.toFixed(1)} KB). Bạn có thể làm bài hoàn toàn ngoại tuyến!`
        );
      } else {
        alert(`Lỗi khi tải đề thi: ${result.message || 'Vui lòng kiểm tra kết nối mạng.'}`);
      }
    } catch (err: any) {
      alert(`Không thể tải đề thi: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setDownloadingQuizId(null);
      setDownloadStatusText('');
    }
  };

  const handleDeleteOfflineQuiz = async (quizId: string) => {
    await deleteOfflineQuiz(quizId, user.id);
    await loadDownloadedQuizzes();
  };

  // Tải Bảng vàng vinh danh theo yêu cầu khi học sinh chọn menu Vinh danh
  const loadHonors = useCallback(
    async (forceRefresh = false) => {
      setIsLoadingHonors(true);
      try {
        const myPubs = await getPublishedResultsForStudent(user.studentCode, forceRefresh);
        setPublishedResults(myPubs || []);
        setHonorsLoaded(true);
      } catch (err) {
        console.warn('Lỗi tải bảng vinh danh:', err);
      } finally {
        setIsLoadingHonors(false);
      }
    },
    [user.studentCode]
  );

  useEffect(() => {
    if (activeMenu === 'honors' && !honorsLoaded) {
      loadHonors(false);
    }
  }, [activeMenu, honorsLoaded, loadHonors]);

  // Nạp dữ liệu cốt lõi nhẹ băng thông (đề thi metadata, kết quả của riêng HS, danh mục chương)
  const refreshData = useCallback(
    async (isSilent = false, forceRefresh = false) => {
      if (!isSilent) setIsLoading(true);
      try {
        const [allQuizzes, userResults, allChapters] = await Promise.all([
          getQuizzesMetadata('all', forceRefresh),
          getResultsForStudent(user.id, user.studentCode, forceRefresh),
          getChapters(forceRefresh),
        ]);

        setChapters(allChapters);
        const gradeChapters = (allChapters || []).filter(
          (c: Chapter) => gradeFilter === 'all' || String(c.grade) === String(gradeFilter)
        );
        if (gradeChapters.length > 0) {
          setChapterFilter((prev) => {
            if (prev === 'all') return 'all';
            const belongs = gradeChapters.some((c) => c.name === prev);
            return belongs ? prev : 'all';
          });
        }
        setQuizzes(allQuizzes.filter((q) => q.isPublished));

        const seenIds = new Set<string>();
        const uniqueResults: Result[] = [];
        const sortedRaw = (userResults as Result[]).sort(
          (a: Result, b: Result) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        for (const r of sortedRaw) {
          if (!r || !r.id || seenIds.has(r.id)) continue;
          seenIds.add(r.id);

          const isDuplicate = uniqueResults.some(
            (prev) =>
              prev.quizId === r.quizId &&
              Math.abs(new Date(prev.submittedAt).getTime() - new Date(r.submittedAt).getTime()) <
                15000 &&
              Math.abs(prev.score - r.score) < 0.001
          );

          if (!isDuplicate) {
            uniqueResults.push(r);
          }
        }
        setResults(uniqueResults);

        // Nếu học sinh đã mở menu Vinh danh hoặc Bảng xếp hạng và yêu cầu làm mới thủ công -> cập nhật đồng bộ
        if (forceRefresh && activeMenu === 'honors') {
          loadHonors(true);
        }
        if (forceRefresh && activeMenu === 'leaderboard') {
          setLeaderboardRefreshKey((prev) => prev + 1);
        }
        if (forceRefresh) {
          checkLiveReview(true);
        }
      } catch (err) {
        console.error('Lỗi đồng bộ dữ liệu StudentDashboard:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [user.id, user.studentCode, gradeFilter, activeMenu, loadHonors, checkLiveReview]
  );

  const [sessionWarning, setSessionWarning] = useState<{
    type: 'different_quiz' | 'same_quiz';
    quizTitle: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  const checkActiveSession = async (quizId: string): Promise<boolean> => {
    setIsCheckingSession(true);
    try {
      const sessions = await getStudentActiveSessions(user.id);
      const activeSessions = sessions.filter((s) => {
        const lastUpdate = new Date(s.lastUpdate);
        return differenceInMinutes(new Date(), lastUpdate) < 10;
      });

      if (activeSessions.length > 0) {
        const otherQuizSession = activeSessions.find((s) => s.quizId !== quizId);
        if (otherQuizSession) {
          return new Promise((resolve) => {
            setSessionWarning({
              type: 'different_quiz',
              quizTitle: otherQuizSession.quizTitle || 'Không rõ',
              onConfirm: async () => {
                try {
                  await deleteExamSession(otherQuizSession.id);
                  setSessionWarning(null);
                  resolve(true);
                } catch (e) {
                  alert('Không thể kết thúc phiên cũ. Vui lòng thử lại.');
                  resolve(false);
                }
              },
              onCancel: () => {
                setSessionWarning(null);
                resolve(false);
              },
            });
          });
        }

        const sameQuizSession = activeSessions.find((s) => s.quizId === quizId);
        if (sameQuizSession) {
          return new Promise((resolve) => {
            setSessionWarning({
              type: 'same_quiz',
              quizTitle: sameQuizSession.quizTitle || 'Đề này',
              onConfirm: async () => {
                try {
                  await deleteExamSession(sameQuizSession.id);
                  setSessionWarning(null);
                  resolve(true);
                } catch (e) {
                  alert('Không thể xóa phiên cũ. Vui lòng thử lại.');
                  resolve(false);
                }
              },
              onCancel: () => {
                setSessionWarning(null);
                resolve(false);
              },
            });
          });
        }
      }
      return true;
    } catch (e) {
      console.error('Lỗi kiểm tra phiên làm bài:', e);
      return true;
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleStartQuiz = async (quiz: Quiz) => {
    const myAttempts = results.filter((r) => r.quizId === quiz.id);
    const maxAttempts = quiz.maxAttempts ?? 2;
    if (myAttempts.length >= maxAttempts) {
      alert(
        `Bạn đã sử dụng hết ${maxAttempts} lần làm bài cho đề thi này. Nút làm bài đã được đóng băng.`
      );
      return;
    }

    setIsLoading(true);
    try {
      let fullQuiz: Quiz | null = null;

      if (!navigator.onLine) {
        fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        if (!fullQuiz) {
          alert(
            'Bạn đang ngoại tuyến và đề thi này chưa được tải về máy. Vui lòng bật mạng để tải đề!'
          );
          setIsLoading(false);
          return;
        }
      } else {
        fullQuiz =
          quiz.questions && quiz.questions.length > 0 ? quiz : await getQuizById(quiz.id);
        if (!fullQuiz) {
          fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        }
      }

      if (!fullQuiz) {
        alert('Không tìm thấy dữ liệu đề thi.');
        return;
      }

      if (navigator.onLine) {
        const canStart = await checkActiveSession(fullQuiz.id);
        if (!canStart) return;
      }

      setActiveQuiz(fullQuiz);
    } catch (e) {
      console.error('Lỗi khởi tạo bài thi:', e);
      const offlineQuiz = await getOfflineQuizById(quiz.id, user.id);
      if (offlineQuiz) {
        setActiveQuiz(offlineQuiz);
      } else {
        alert('Lỗi khi tải câu hỏi bài thi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPractice = async (quiz: Quiz) => {
    const isLiveReviewed = liveReviewedQuizIds.includes(quiz.id);
    if (quiz.type === 'test' && !isLiveReviewed) {
      alert('Đề này là Đề thi chính thức do Giáo viên chỉ định, không mở chế độ luyện tập trước.');
      return;
    }

    setIsLoading(true);
    try {
      let fullQuiz: Quiz | null = null;

      if (!navigator.onLine) {
        fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        if (!fullQuiz) {
          alert('Bạn đang ngoại tuyến và đề luyện tập này chưa được tải về máy.');
          setIsLoading(false);
          return;
        }
      } else {
        fullQuiz =
          quiz.questions && quiz.questions.length > 0 ? quiz : await getQuizById(quiz.id);
        if (!fullQuiz) {
          fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        }
      }

      if (!fullQuiz) {
        alert('Không tìm thấy dữ liệu đề thi.');
        return;
      }

      if (isLiveReviewed) {
        fullQuiz = { ...fullQuiz, type: 'practice' };
      }

      if (navigator.onLine) {
        const canStart = await checkActiveSession(fullQuiz.id);
        if (!canStart) return;
      }

      setActivePracticeQuiz(fullQuiz);
    } catch (e) {
      console.error('Lỗi khởi tạo luyện tập:', e);
      const offlineQuiz = await getOfflineQuizById(quiz.id, user.id);
      if (offlineQuiz) {
        setActivePracticeQuiz(offlineQuiz);
      } else {
        alert('Lỗi khi tải câu hỏi luyện tập.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewResult = async (res: Result) => {
    setIsLoading(true);
    try {
      const [fullQuiz, fullResult] = await Promise.all([
        getQuizById(res.quizId),
        getResultById(res.id),
      ]);
      if (fullQuiz && fullResult) {
        setSelectedResult({ result: fullResult, quiz: fullQuiz });
      } else if (fullQuiz) {
        setSelectedResult({ result: res, quiz: fullQuiz });
      } else {
        alert('Đề thi này đã bị xóa hoặc không tìm thấy dữ liệu.');
      }
    } catch (e) {
      console.error('Lỗi xem chi tiết kết quả:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Tự động mở đề thi từ URL ?quiz=...
  useEffect(() => {
    if (targetQuizId) {
      const checkTargetQuiz = async () => {
        setIsLoading(true);
        try {
          const quiz = await getQuizById(targetQuizId);
          if (quiz && quiz.isPublished) {
            const curNow = new Date();
            const startX = quiz.startTime ? new Date(quiz.startTime) : null;
            const endY = quiz.endTime ? new Date(quiz.endTime) : null;
            const isFlexibleWindow = Boolean(
              startX && endY && endY.getTime() > startX.getTime()
            );

            if (quiz.type === 'test' && startX) {
              if (isFlexibleWindow && endY) {
                if (isBefore(curNow, startX)) {
                  alert(
                    `Đề thi chưa mở. Khung giờ mở đề: ${format(startX, 'HH:mm dd/MM/yyyy')} đến ${format(endY, 'HH:mm dd/MM/yyyy')}.`
                  );
                  return;
                }
                if (isAfter(curNow, endY)) {
                  alert(
                    `Đã hết thời hạn vào làm đề thi này (Hạn chót vào thi: ${format(endY, 'HH:mm dd/MM/yyyy')}).`
                  );
                  return;
                }
              } else {
                const globalDeadline = addMinutes(startX, quiz.durationMinutes);
                if (isBefore(curNow, startX)) {
                  alert(`Đề thi chưa đến giờ. Giờ thi bắt đầu lúc ${format(startX, 'HH:mm dd/MM/yyyy')}.`);
                  return;
                }
                if (isAfter(curNow, globalDeadline)) {
                  alert(`Đề thi đã kết thúc lúc ${format(globalDeadline, 'HH:mm dd/MM/yyyy')}.`);
                  return;
                }
              }
            }

            const canStart = await checkActiveSession(quiz.id);
            if (canStart) {
              setActiveQuiz(quiz);
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          } else {
            alert('Đề thi này không tồn tại hoặc chưa được phát hành.');
          }
        } catch (e) {
          console.error('Lỗi lấy đề thi từ link:', e);
        } finally {
          setIsLoading(false);
        }
      };
      checkTargetQuiz();
    }
  }, [targetQuizId]);

  const assignedQuizzes = useMemo(() => {
    return quizzes.filter((q: Quiz) => {
      const matchGrade =
        !q.grade ||
        q.grade === 'all' ||
        gradeFilter === 'all' ||
        String(q.grade) === String(gradeFilter);
      let isTargetMatch = false;

      if (q.targetType === 'classes') {
        const hasClassIdMatch = Boolean(
          user.classId && q.assignedClassIds && q.assignedClassIds.includes(user.classId)
        );
        const hasClassNameMatch = Boolean(
          user.className && q.assignedClassIds && q.assignedClassIds.includes(user.className)
        );
        const hasAssignedClassesMatch = Boolean(
          q.assignedClasses &&
            q.assignedClasses.some(
              (c) =>
                (user.classId && c.id === user.classId) ||
                (user.className && c.name === user.className)
            )
        );
        isTargetMatch = hasClassIdMatch || hasClassNameMatch || hasAssignedClassesMatch;
      } else {
        isTargetMatch = !q.isUnlisted;
      }

      return matchGrade && q.isPublished && isTargetMatch;
    });
  }, [quizzes, gradeFilter, user.classId, user.className]);

  const completedQuizIds = useMemo(() => new Set(results.map((r) => r.quizId)), [results]);
  const completedAssignedCount = useMemo(
    () => assignedQuizzes.filter((q) => completedQuizIds.has(q.id)).length,
    [assignedQuizzes, completedQuizIds]
  );
  const uncompletedAssignedCount = useMemo(
    () => Math.max(0, assignedQuizzes.length - completedAssignedCount),
    [assignedQuizzes, completedAssignedCount]
  );
  const uncompletedAssignedQuizzes = useMemo(
    () => assignedQuizzes.filter((q) => !completedQuizIds.has(q.id)),
    [assignedQuizzes, completedQuizIds]
  );

  const bestScorePerQuiz = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach((r) => {
      const cur = map.get(r.quizId) ?? 0;
      if (r.score > cur) map.set(r.quizId, r.score);
    });
    return map;
  }, [results]);

  const totalAssignedScore = useMemo(() => {
    let sum = 0;
    assignedQuizzes.forEach((q) => {
      sum += bestScorePerQuiz.get(q.id) ?? 0;
    });
    return sum;
  }, [assignedQuizzes, bestScorePerQuiz]);

  const avgSubmittedScore = useMemo(() => {
    return results.length > 0
      ? results.reduce((acc, r) => acc + r.score, 0) / results.length
      : 0;
  }, [results]);

  const officialAvgScore = useMemo(() => {
    if (assignedQuizzes.length === 0) return avgSubmittedScore;
    return totalAssignedScore / assignedQuizzes.length;
  }, [assignedQuizzes.length, totalAssignedScore, avgSubmittedScore]);

  const stats = useMemo(() => {
    const totalQuizzes = results.length;
    const totalSeconds = results.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
    const effortPoints = totalSeconds / 2700;

    const bonusPoints = results.reduce((acc, r) => {
      const bp = (r as any).bonusPoint;
      if (bp !== undefined && bp !== null) {
        return acc + Number(bp);
      }
      if (r.score >= 8) return acc + 1;
      return acc;
    }, 0);

    return {
      totalQuizzes,
      avgScore: officialAvgScore,
      avgSubmittedScore,
      completedAssignedCount,
      totalAssignedCount: assignedQuizzes.length,
      uncompletedAssignedCount,
      totalSeconds,
      effortPoints,
      bonusPoints,
      accumulatedPoints: effortPoints + bonusPoints,
    };
  }, [
    results,
    officialAvgScore,
    avgSubmittedScore,
    completedAssignedCount,
    assignedQuizzes.length,
    uncompletedAssignedCount,
  ]);

  const overallQuestionsStats = useMemo(() => {
    let totalQuestions = 0;
    let completedQuestions = 0;

    const targetList = assignedQuizzes.length > 0 ? assignedQuizzes : quizzes;
    targetList.forEach((q) => {
      const qTotal = q.questionCount || (q.questions ? q.questions.length : 0);
      totalQuestions += qTotal;
      const qAttempts = results
        .filter((r) => r.quizId === q.id)
        .sort(
          (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );
      if (qAttempts.length > 0) {
        const latest = qAttempts[0];
        const done =
          countCompletedQuestions(latest.userAnswers, qTotal) ||
          (latest.score > 0 ? qTotal : 0);
        completedQuestions += done;
      }
    });

    const percentage =
      totalQuestions > 0
        ? Math.min(100, Math.round((completedQuestions / totalQuestions) * 100))
        : 0;
    return {
      completed: completedQuestions,
      total: totalQuestions,
      percentage,
    };
  }, [assignedQuizzes, quizzes, results]);

  const performanceInsights = useMemo(() => {
    if (results.length === 0) {
      return {
        highest: 0,
        latest: 0,
        recentAvg: 0,
        trendDiff: 0,
        passRate: 0,
        distinctionRate: 0,
      };
    }
    const scores = results.map((r) => r.score);
    const highest = Math.max(...scores);
    const sortedDesc = [...results].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    const latest = sortedDesc[0]?.score || 0;

    const recent3 = sortedDesc.slice(0, 3);
    const recentAvg =
      recent3.length > 0
        ? recent3.reduce((acc, r) => acc + r.score, 0) / recent3.length
        : 0;
    const overallAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trendDiff = recentAvg - overallAvg;

    const passCount = results.filter((r) => r.score >= 5).length;
    const distinctionCount = results.filter((r) => r.score >= 8).length;

    return {
      highest,
      latest,
      recentAvg,
      trendDiff,
      passRate: Math.round((passCount / results.length) * 100),
      distinctionRate: Math.round((distinctionCount / results.length) * 100),
    };
  }, [results]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => refreshData(true), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleExitQuiz = (options?: {
    scrollToLeaderboard?: boolean;
    completedQuizId?: string;
  }) => {
    const finishedQuizId = options?.completedQuizId || activeQuiz?.id || null;
    setActiveQuiz(null);
    setActivePracticeQuiz(null);
    if (finishedQuizId) {
      setLeaderboardQuizId(finishedQuizId);
    }
    if (options?.scrollToLeaderboard) {
      setActiveMenu('leaderboard');
    }
    setLeaderboardRefreshKey((prev) => prev + 1);
    setTimeout(() => {
      refreshData(false, true);
    }, 350);
  };

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isQuizExpired = useCallback(
    (q: Quiz, time: Date = currentTime): boolean => {
      const startX = q.startTime ? new Date(q.startTime) : null;
      const endY = q.endTime ? new Date(q.endTime) : null;
      const isFlexibleWindow = Boolean(startX && endY && endY.getTime() > startX.getTime());

      if (startX) {
        if (isFlexibleWindow && endY) {
          return isAfter(time, endY);
        } else {
          const globalDeadline = addMinutes(startX, q.durationMinutes);
          return isAfter(time, globalDeadline);
        }
      }
      if (endY) {
        return isAfter(time, endY);
      }
      return false;
    },
    [currentTime]
  );

  const getQuizStatus = (q: Quiz) => {
    const qOrder = q.orderIndex ?? 1;
    if (qOrder === 0) return { isLocked: false };
    if (!q.category || qOrder <= 1) return { isLocked: false };

    const prerequisites = quizzes
      .filter(
        (prev) =>
          prev.category === q.category &&
          (prev.orderIndex ?? 0) > 0 &&
          (prev.orderIndex ?? 0) < qOrder &&
          !isQuizExpired(prev, currentTime)
      )
      .sort((a, b) => (b.orderIndex ?? 0) - (a.orderIndex ?? 0));

    if (prerequisites.length === 0) return { isLocked: false };

    const prevQuiz = prerequisites[0];
    const bestScore = results
      .filter((r) => r.quizId === prevQuiz.id)
      .reduce((max, r) => Math.max(max, r.score), 0);

    if (bestScore < 5) {
      return { isLocked: true, reason: `Cần đạt >= 5 điểm ở đề "${prevQuiz.title}"` };
    }

    return { isLocked: false };
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q: Quiz) => {
      const matchGrade =
        !q.grade ||
        q.grade === 'all' ||
        gradeFilter === 'all' ||
        String(q.grade) === String(gradeFilter);
      const matchChapter = chapterFilter === 'all' || q.category === chapterFilter;
      const matchYear =
        !academicYearFilter ||
        academicYearFilter === 'all' ||
        (academicYearFilter === 'none'
          ? !q.academicYear
          : q.academicYear === academicYearFilter ||
            (!q.academicYear && academicYearFilter === currentAcademicYear));

      let isTargetMatch = false;
      if (q.targetType === 'classes') {
        const hasClassIdMatch = Boolean(
          user.classId && q.assignedClassIds && q.assignedClassIds.includes(user.classId)
        );
        const hasClassNameMatch = Boolean(
          user.className && q.assignedClassIds && q.assignedClassIds.includes(user.className)
        );
        const hasAssignedClassesMatch = Boolean(
          q.assignedClasses &&
            q.assignedClasses.some(
              (c) =>
                (user.classId && c.id === user.classId) ||
                (user.className && c.name === user.className)
            )
        );
        isTargetMatch = hasClassIdMatch || hasClassNameMatch || hasAssignedClassesMatch;
      } else {
        isTargetMatch = !q.isUnlisted;
      }

      return matchGrade && matchChapter && isTargetMatch && matchYear && q.isPublished;
    });
  }, [
    quizzes,
    gradeFilter,
    chapterFilter,
    academicYearFilter,
    user.classId,
    user.className,
    currentAcademicYear,
  ]);

  const getQuizTiming = useCallback(
    (q: Quiz) => {
      const startX = q.startTime ? new Date(q.startTime) : null;
      const endY = q.endTime ? new Date(q.endTime) : null;
      const isFlexibleWindow = Boolean(startX && endY && endY.getTime() > startX.getTime());

      let isStarted = true;
      let isEnded = false;

      if (startX) {
        if (isFlexibleWindow && endY) {
          isStarted = !isBefore(currentTime, startX);
          isEnded = isAfter(currentTime, endY);
        } else {
          const globalDeadline = addMinutes(startX, q.durationMinutes);
          isStarted = !isBefore(currentTime, startX);
          isEnded = isAfter(currentTime, globalDeadline);
        }
      } else if (endY) {
        isEnded = isAfter(currentTime, endY);
      }

      const isExpired = isQuizExpired(q, currentTime);
      const myAttempts = results
        .filter((r) => r.quizId === q.id)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      const attemptCount = myAttempts.length;
      const maxAttempts = q.maxAttempts ?? (q.type === 'practice' ? 99 : 2);
      const isFrozen = q.type === 'test' && attemptCount >= maxAttempts;
      const bestScore =
        attemptCount > 0 ? Math.max(...myAttempts.map((r) => r.score)) : null;

      return {
        startX,
        endY,
        isFlexibleWindow,
        isStarted,
        isEnded,
        isExpired,
        myAttempts,
        attemptCount,
        maxAttempts,
        isFrozen,
        bestScore,
      };
    },
    [currentTime, results, isQuizExpired]
  );

  const openTestQuizzes = useMemo(() => {
    return filteredQuizzes.filter((q) => {
      if (q.type !== 'test') return false;
      const timing = getQuizTiming(q);
      return !timing.isExpired && timing.isStarted && !timing.isEnded && !timing.isFrozen;
    });
  }, [filteredQuizzes, getQuizTiming]);

  const upcomingTestQuizzes = useMemo(() => {
    return filteredQuizzes.filter((q) => {
      if (q.type !== 'test') return false;
      const timing = getQuizTiming(q);
      return !timing.isExpired && !timing.isStarted && !timing.isEnded;
    });
  }, [filteredQuizzes, getQuizTiming]);

  const practiceQuizzes = useMemo(() => {
    return filteredQuizzes.filter((q) => {
      const isLiveReviewed = liveReviewedQuizIds.includes(q.id);
      if (isLiveReviewed) return true;
      return q.type === 'practice' && !isQuizExpired(q, currentTime);
    });
  }, [filteredQuizzes, currentTime, isQuizExpired, liveReviewedQuizIds]);

  const [resultsFilter, setResultsFilter] = useState<'all' | 'expired' | 'active'>('all');
  const [resultsDisplayCount, setResultsDisplayCount] = useState(15);

  const enrichedResults = useMemo(() => {
    return results.map((r) => {
      const quiz = quizzes.find((q) => q.id === r.quizId);
      const title = quiz?.title || r.quizTitle || (r as any).title || 'Đề thi đã nộp';
      const category = quiz?.category || r.quizCategory || '';
      const rawType =
        quiz?.type ||
        r.quizType ||
        (title.toLowerCase().includes('kiểm tra') || title.toLowerCase().includes('đề')
          ? 'test'
          : 'practice');
      const isExpired = quiz ? isQuizExpired(quiz, currentTime) : true;
      const sameQuizAttempts = results
        .filter((item) => item.quizId === r.quizId)
        .sort(
          (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        );
      const attemptIndex = sameQuizAttempts.findIndex((item) => item.id === r.id);
      const attemptNumber = attemptIndex >= 0 ? attemptIndex + 1 : 1;
      const hasMultipleAttempts = sameQuizAttempts.length > 1;

      return {
        ...r,
        quiz,
        quizTitle: title,
        quizCategory: category,
        quizType: rawType,
        isExpired,
        attemptNumber,
        hasMultipleAttempts,
        maxAttempts: quiz?.maxAttempts ?? (rawType === 'practice' ? 99 : 2),
      };
    });
  }, [results, quizzes, currentTime, isQuizExpired]);

  const filteredResults = useMemo(() => {
    if (resultsFilter === 'expired') {
      return enrichedResults.filter((item) => item.isExpired);
    }
    if (resultsFilter === 'active') {
      return enrichedResults.filter((item) => !item.isExpired);
    }
    return enrichedResults;
  }, [enrichedResults, resultsFilter]);

  const expiredResultsCount = useMemo(
    () => enrichedResults.filter((r) => r.isExpired).length,
    [enrichedResults]
  );
  const activeResultsCount = useMemo(
    () => enrichedResults.filter((r) => !r.isExpired).length,
    [enrichedResults]
  );

  // Cấu hình danh sách menu cho panel bên trái
  const menuItems = useMemo(
    () => [
      {
        key: 'exams' as StudentMenuKey,
        label: 'Đề thi & Kiểm tra',
        description: 'Các bài kiểm tra đang mở, lịch thi sắp tới và đề chưa hoàn thành',
        icon: FileText,
        badge: openTestQuizzes.length + upcomingTestQuizzes.length,
        alertCount: uncompletedAssignedQuizzes.length,
      },
      {
        key: 'practice' as StudentMenuKey,
        label: 'Kho luyện tập',
        description: 'Ôn tập tự do theo chuyên đề và đề đã sửa bài trên lớp',
        icon: Zap,
        badge: practiceQuizzes.length,
      },
      {
        key: 'overview' as StudentMenuKey,
        label: 'Tổng quan & Biểu đồ',
        description: 'Điểm tổng kết, tiến độ học tập và biểu đồ phân tích phong độ',
        icon: BarChart3,
        badgeText: `${stats.avgScore.toFixed(1)}đ`,
      },
      {
        key: 'history' as StudentMenuKey,
        label: 'Lịch sử nộp bài',
        description: 'Danh sách bài đã nộp, điểm số chi tiết và xem lại lời giải',
        icon: History,
        badge: results.length,
      },
      {
        key: 'leaderboard' as StudentMenuKey,
        label: 'Bảng xếp hạng',
        description: 'Theo dõi thứ hạng của bạn so với các thí sinh khác theo từng đề',
        icon: Trophy,
        badgeText: results.length > 0 ? 'Theo đề' : undefined,
      },
      {
        key: 'honors' as StudentMenuKey,
        label: 'Bảng vàng vinh danh',
        description: 'Các thành tích xuất sắc được giáo viên ghi nhận và tuyên dương',
        icon: Award,
        badge: honorsLoaded ? publishedResults.length : undefined,
      },
      {
        key: 'offline' as StudentMenuKey,
        label: 'Kho ngoại tuyến',
        description: 'Làm bài không cần mạng và quản lý đồng bộ kết quả về máy chủ',
        icon: HardDrive,
        badge: downloadedCount,
        alertCount: pendingCount,
      },
    ],
    [
      openTestQuizzes.length,
      upcomingTestQuizzes.length,
      uncompletedAssignedQuizzes.length,
      practiceQuizzes.length,
      stats.avgScore,
      results.length,
      honorsLoaded,
      publishedResults.length,
      downloadedCount,
      pendingCount,
    ]
  );

  const activeMenuConfig = useMemo(
    () => menuItems.find((m) => m.key === activeMenu) || menuItems[0],
    [menuItems, activeMenu]
  );

  // Chế độ làm bài toàn màn hình
  if (activeLiveSession) {
    return (
      <LiveReviewStudentTaker
        session={activeLiveSession}
        student={user}
        onExit={() => {
          setActiveLiveSession(null);
          refreshData(true);
        }}
      />
    );
  }

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={handleExitQuiz} />;
  }

  if (activePracticeQuiz) {
    return <QuickPractice quiz={activePracticeQuiz} student={user} onExit={handleExitQuiz} />;
  }

  const showFilterBox = activeMenu === 'exams' || activeMenu === 'practice';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 pb-16">
      {isCheckingSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[5000] flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="font-bold text-xs text-slate-800">Đang kiểm tra phiên làm bài...</p>
          </div>
        </div>
      )}

      {/* Bố cục 2 panel: Menu điều hướng bên trái + Nội dung kích hoạt bên phải */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* PANEL 1 (TRÁI): HỒ SƠ & MENU ĐIỀU HƯỚNG */}
        <aside className="w-full lg:w-[276px] shrink-0 lg:sticky lg:top-20 space-y-4">
          {/* Thẻ thông tin học sinh */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-base font-black text-slate-900 leading-snug truncate">
                  {user.fullName}
                </h1>
                <button
                  type="button"
                  onClick={() => refreshData(false, true)}
                  title="Làm mới dữ liệu & kiểm tra phát sóng trực tiếp"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">
                Khối {user.grade || '12'}
                {user.className ? ` · Lớp ${user.className}` : ''}
                {user.studentCode ? ` · ${user.studentCode}` : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-xs">
              <div>
                <p className="text-[11px] font-medium text-slate-400">ĐTB Tổng kết</p>
                <p className="text-sm font-black font-mono tabular-nums text-slate-900">
                  {stats.avgScore.toFixed(2)}đ
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Điểm tích lũy</p>
                <p className="text-sm font-black font-mono tabular-nums text-amber-700">
                  {stats.accumulatedPoints.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 ${
                  isOnline ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                <span>{isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}</span>
              </span>
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveMenu('offline')}
                  className="font-mono tabular-nums text-amber-700 hover:underline cursor-pointer"
                >
                  {pendingCount} bài chờ đồng bộ
                </button>
              )}
            </div>
          </div>

          {/* Danh sách Menu */}
          <nav
            aria-label="Menu học sinh"
            className="bg-white rounded-2xl border border-slate-200 p-2"
          >
            {/* Mobile / Tablet horizontal scroll menu */}
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.key;
                return (
                  <button
                    key={`mob_${item.key}`}
                    type="button"
                    onClick={() => setActiveMenu(item.key)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`font-mono tabular-nums text-[11px] ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        ({item.badge})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Desktop vertical sidebar menu */}
            <div className="hidden lg:flex flex-col gap-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveMenu(item.key)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        size={16}
                        className={isActive ? 'text-amber-400 shrink-0' : 'text-slate-400 shrink-0'}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums text-[11px]">
                      {item.alertCount !== undefined && item.alertCount > 0 && (
                        <span
                          className={
                            isActive ? 'text-rose-300 font-bold' : 'text-rose-600 font-bold'
                          }
                          title="Cần chú ý"
                        >
                          !{item.alertCount}
                        </span>
                      )}
                      {item.badge !== undefined ? (
                        <span className={isActive ? 'text-slate-300' : 'text-slate-400'}>
                          {item.badge}
                        </span>
                      ) : item.badgeText ? (
                        <span className={isActive ? 'text-slate-300' : 'text-slate-400'}>
                          {item.badgeText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* PANEL 2 (PHẢI): NỘI DUNG KÍCH HOẠT THEO MENU ĐÃ CHỌN */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Thông báo tiến trình tải đề ngoại tuyến nếu đang tải */}
          {downloadingQuizId && downloadStatusText && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3 text-xs font-bold text-blue-800">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>{downloadStatusText}</span>
            </div>
          )}

          {/* Banner Sửa bài trực tiếp (Live Review) - luôn hiển thị nếu giáo viên đang mở phòng */}
          {liveReviewSessionCheck && (
            <div className="bg-gradient-to-r from-rose-600 via-amber-600 to-rose-700 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0 border border-white/25">
                  <Radio className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-rose-100 font-semibold">
                    <span className="font-black text-white uppercase tracking-wide">
                      Đang phát sóng trực tiếp
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Lớp: {liveReviewSessionCheck.targetClassNames.join(', ')}</span>
                  </div>
                  <h2 className="text-base font-black text-white mt-0.5">
                    {liveReviewSessionCheck.quizTitle}
                  </h2>
                  <p className="text-xs text-rose-100 mt-1">
                    Giáo viên đang mở phiên sửa bài đố vui trực tiếp. Tham gia để trả lời và nhận điểm tức thì.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveLiveSession(liveReviewSessionCheck)}
                className="w-full md:w-auto px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Zap size={15} className="fill-rose-600 text-rose-600" />
                <span>Tham gia ngay</span>
              </button>
            </div>
          )}

          {/* Bộ lọc đề đặt trên đầu Panel 2 để thao tác nhanh */}
          {showFilterBox && (
            <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <Filter size={14} className="text-blue-600 shrink-0" />
                <span className="text-xs font-black text-slate-800 whitespace-nowrap">Bộ lọc đề</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 md:justify-end">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="student-year-filter"
                    className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0"
                  >
                    Niên khóa
                  </label>
                  <select
                    id="student-year-filter"
                    className="flex-1 sm:flex-initial bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[180px]"
                    value={academicYearFilter}
                    onChange={(e) => setAcademicYearFilter(e.target.value)}
                  >
                    <option value="all">Tất cả niên khóa</option>
                    <option value={currentAcademicYear}>
                      Niên khóa {currentAcademicYear} (Hiện hành)
                    </option>
                    {['2027-2028', '2026-2027', '2025-2026', '2024-2025']
                      .filter((y) => y !== currentAcademicYear)
                      .map((yr) => (
                        <option key={yr} value={yr}>
                          Năm học {yr}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <label
                    htmlFor="student-chapter-filter"
                    className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0"
                  >
                    Chương học
                  </label>
                  <select
                    id="student-chapter-filter"
                    className="flex-1 sm:flex-initial bg-slate-50 border border-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[200px] sm:max-w-[280px]"
                    value={chapterFilter}
                    onChange={(e) => setChapterFilter(e.target.value)}
                  >
                    <option value="all">Tất cả chương</option>
                    {chapters
                      .filter(
                        (c: Chapter) =>
                          gradeFilter === 'all' || String(c.grade) === String(gradeFilter)
                      )
                      .map((c: Chapter) => (
                        <option key={c.id} value={c.name}>
                          {c.name || (c as any).title || 'Chương chưa đặt tên'}
                        </option>
                      ))}
                  </select>
                </div>

                {chapterFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setChapterFilter('all')}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Thanh tiêu đề ngữ cảnh của panel đang mở */}
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                {activeMenuConfig.label}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {activeMenuConfig.description}
              </p>
            </div>

            {activeMenu === 'exams' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setExamSubTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    examSubTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({openTestQuizzes.length + upcomingTestQuizzes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExamSubTab('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    examSubTab === 'open'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đang mở ({openTestQuizzes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExamSubTab('upcoming')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    examSubTab === 'upcoming'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sắp làm ({upcomingTestQuizzes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExamSubTab('uncompleted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    examSubTab === 'uncompleted'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chưa nộp ({uncompletedAssignedQuizzes.length})
                </button>
              </div>
            )}

            {activeMenu === 'history' && results.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setResultsFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    resultsFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({enrichedResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultsFilter('expired')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    resultsFilter === 'expired'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã hết hạn ({expiredResultsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setResultsFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    resultsFilter === 'active'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đang mở ({activeResultsCount})
                </button>
              </div>
            )}

            {activeMenu === 'honors' && (
              <button
                type="button"
                onClick={() => loadHonors(true)}
                disabled={isLoadingHonors}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <RefreshCw size={14} className={isLoadingHonors ? 'animate-spin text-blue-600' : ''} />
                <span>Cập nhật vinh danh</span>
              </button>
            )}

            {activeMenu === 'offline' && (
              <button
                type="button"
                onClick={() => setIsOfflineManagerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <HardDrive size={14} className="text-teal-400" />
                <span>Quản lý đồng bộ ({pendingCount})</span>
              </button>
            )}
          </div>

          {/* Loading lần đầu cho các tab phụ thuộc dữ liệu gốc */}
          {isLoading && quizzes.length === 0 && results.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center space-y-3">
              <Loader2 className="animate-spin text-blue-600 mx-auto" size={36} />
              <p className="text-xs font-bold text-slate-500">Đang tải dữ liệu học tập...</p>
            </div>
          ) : (
            <>
              {/* 1. PANEL ĐỀ THI & KIỂM TRA */}
              {activeMenu === 'exams' && (
                <div className="space-y-8">
                  {/* Đề chưa hoàn thành */}
                  {examSubTab === 'uncompleted' && (
                    <div className="space-y-4">
                      {uncompletedAssignedQuizzes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                          {uncompletedAssignedQuizzes.map((q) => {
                            const timing = getQuizTiming(q);
                            const isOpen =
                              !timing.isExpired &&
                              timing.isStarted &&
                              !timing.isEnded &&
                              !timing.isFrozen;
                            const totalQuestions =
                              q.questionCount || (q.questions ? q.questions.length : 0);

                            return (
                              <div
                                key={`uncomp_${q.id}`}
                                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
                                  isOpen ? 'border-amber-300' : 'border-rose-200'
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                    <span className={isOpen ? 'text-emerald-700' : 'text-rose-700'}>
                                      {isOpen ? 'Đang mở · Cần nộp ngay' : 'Chưa nộp (0.00đ)'}
                                    </span>
                                    <span className="font-mono tabular-nums text-slate-500">
                                      {q.durationMinutes} phút · {totalQuestions} câu
                                    </span>
                                  </div>
                                  {q.category && (
                                    <p className="text-[11px] font-semibold text-amber-700 truncate">
                                      {q.category}
                                    </p>
                                  )}
                                  <h3 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                                    {q.title}
                                  </h3>
                                </div>

                                <div className="pt-3 border-t border-slate-100">
                                  {isOpen ? (
                                    <button
                                      type="button"
                                      onClick={() => handleStartQuiz(q)}
                                      className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Zap size={14} />
                                      <span>Vào làm bài ngay</span>
                                    </button>
                                  ) : (
                                    <p className="text-center text-xs font-bold text-rose-700 py-2 bg-rose-50 rounded-xl">
                                      Đã quá hạn thi · Đang tính 0.00đ
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                          <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                          <p className="font-black text-slate-800 text-sm">
                            Bạn đã hoàn thành 100% bài được giao
                          </p>
                          <p className="text-xs text-slate-500">
                            Không có đề thi bắt buộc nào bị bỏ sót.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Đề thi đang mở */}
                  {(examSubTab === 'all' || examSubTab === 'open') && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-black text-slate-800">
                          Đề thi đang mở{' '}
                          <span className="font-mono tabular-nums text-blue-600">
                            ({openTestQuizzes.length})
                          </span>
                        </h3>
                      </div>

                      {openTestQuizzes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                          {openTestQuizzes.map((q) => {
                            const timing = getQuizTiming(q);
                            const latestAttempt = timing.myAttempts[0];
                            const totalQuestions =
                              q.questionCount ||
                              (q.questions ? q.questions.length : latestAttempt?.totalQuestions || 0);
                            const completedQuestions = latestAttempt
                              ? countCompletedQuestions(latestAttempt.userAnswers, totalQuestions) ||
                                (latestAttempt.score > 0 ? totalQuestions : 0)
                              : 0;
                            const isDownloaded = downloadedQuizIds.has(q.id);

                            return (
                              <div
                                key={q.id}
                                className="bg-white rounded-2xl border border-blue-200 p-5 flex flex-col justify-between gap-4 shadow-xs hover:border-blue-400 transition-colors"
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                    <span className="text-blue-700">
                                      {timing.isFlexibleWindow ? 'Đang mở đề' : 'Đang trong giờ thi'}
                                    </span>
                                    <span className="font-mono tabular-nums text-slate-500">
                                      {q.durationMinutes} phút · {totalQuestions} câu
                                    </span>
                                  </div>

                                  {q.category && (
                                    <p className="text-[11px] font-semibold text-slate-500 truncate">
                                      {q.category}
                                    </p>
                                  )}
                                  <h4 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                                    {q.title}
                                  </h4>

                                  {timing.startX && (
                                    <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 space-y-0.5">
                                      {timing.isFlexibleWindow && timing.endY ? (
                                        <>
                                          <div className="flex items-center gap-1.5 font-medium">
                                            <Calendar size={12} className="text-blue-600 shrink-0" />
                                            <span className="font-mono tabular-nums">
                                              {format(timing.startX, 'HH:mm dd/MM')} →{' '}
                                              {format(timing.endY, 'HH:mm dd/MM')}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-400">
                                            Tính đủ {q.durationMinutes} phút từ lúc bắt đầu làm.
                                          </p>
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-1.5 font-medium">
                                          <Calendar size={12} className="text-blue-600 shrink-0" />
                                          <span className="font-mono tabular-nums">
                                            Giờ thi: {format(timing.startX, 'HH:mm - dd/MM/yyyy')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <QuizProgressIndicator
                                    completed={completedQuestions}
                                    total={totalQuestions}
                                    variant="card"
                                  />

                                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1 font-mono tabular-nums">
                                    <span>
                                      Lượt làm:{' '}
                                      <strong className="text-slate-900">
                                        {timing.attemptCount}/{timing.maxAttempts}
                                      </strong>
                                    </span>
                                    <span>
                                      Cao nhất:{' '}
                                      <strong className="text-blue-700">
                                        {timing.bestScore !== null
                                          ? `${timing.bestScore.toFixed(1)}đ`
                                          : '—'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleStartQuiz(q)}
                                      className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Zap size={14} />
                                      <span>
                                        Vào làm bài (Lần {timing.attemptCount + 1}/{timing.maxAttempts})
                                      </span>
                                    </button>
                                    {isOnline && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleDownloadQuiz(q, e)}
                                        disabled={Boolean(downloadingQuizId)}
                                        title={
                                          isDownloaded
                                            ? 'Đã lưu ngoại tuyến (Nhấn để cập nhật bản mới)'
                                            : 'Tải đề về máy để làm ngoại tuyến'
                                        }
                                        className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                                          isDownloaded
                                            ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        {isDownloaded ? (
                                          <CloudCheck size={16} />
                                        ) : (
                                          <Download size={16} />
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {timing.attemptCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = timing.myAttempts[0];
                                        if (res) handleViewResult(res);
                                      }}
                                      className="w-full py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                      <Eye size={13} />
                                      <span>
                                        Xem lại bài đã nộp ({timing.myAttempts[0].score.toFixed(1)}đ)
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-medium text-slate-500">
                          Hiện tại không có đề thi nào đang trong giờ mở. Bạn có thể kiểm tra lịch ở mục Sắp làm hoặc ôn tập ở Kho luyện tập.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Đề thi sắp làm */}
                  {(examSubTab === 'all' || examSubTab === 'upcoming') &&
                    (upcomingTestQuizzes.length > 0 || examSubTab === 'upcoming') && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-black text-slate-800 px-1">
                          Đề thi sắp diễn ra{' '}
                          <span className="font-mono tabular-nums text-amber-700">
                            ({upcomingTestQuizzes.length})
                          </span>
                        </h3>

                        {upcomingTestQuizzes.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {upcomingTestQuizzes.map((q) => {
                              const timing = getQuizTiming(q);
                              const totalQuestions =
                                q.questionCount || (q.questions ? q.questions.length : 0);

                              return (
                                <div
                                  key={q.id}
                                  className="bg-white rounded-2xl border border-amber-200 p-5 flex flex-col justify-between gap-4"
                                >
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                      <span className="text-amber-700">Chờ giờ mở đề</span>
                                      <span className="font-mono tabular-nums text-slate-500">
                                        {q.durationMinutes} phút · {totalQuestions} câu
                                      </span>
                                    </div>
                                    {q.category && (
                                      <p className="text-[11px] font-semibold text-slate-500 truncate">
                                        {q.category}
                                      </p>
                                    )}
                                    <h4 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                                      {q.title}
                                    </h4>
                                    {timing.startX && (
                                      <div className="text-xs text-amber-900 bg-amber-50/70 px-3 py-2.5 rounded-xl border border-amber-200 space-y-0.5">
                                        <div className="flex items-center gap-1.5 font-semibold">
                                          <Calendar size={13} className="text-amber-600 shrink-0" />
                                          <span className="font-mono tabular-nums">
                                            Mở lúc: {format(timing.startX, 'HH:mm - dd/MM/yyyy')}
                                          </span>
                                        </div>
                                        {timing.isFlexibleWindow && timing.endY && (
                                          <p className="text-[11px] text-amber-700 font-mono tabular-nums">
                                            Hạn chót: {format(timing.endY, 'HH:mm dd/MM')}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      disabled={true}
                                      className="w-full py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-bold text-xs cursor-not-allowed flex items-center justify-center gap-1.5"
                                    >
                                      <Clock size={13} />
                                      <span>Chưa đến giờ mở đề</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-medium text-slate-500">
                            Không có lịch thi sắp tới nào trong bộ lọc hiện tại.
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* 2. PANEL KHO LUYỆN TẬP */}
              {activeMenu === 'practice' && (
                <div className="space-y-4">
                  {practiceQuizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {practiceQuizzes.map((q) => {
                        const qRes = results.filter((r) => r.quizId === q.id);
                        const qs =
                          qRes.length > 0
                            ? {
                                count: qRes.length,
                                max: Math.max(...qRes.map((r) => r.score)),
                                latest: qRes[0],
                              }
                            : null;
                        const pTotalQuestions =
                          q.questionCount ||
                          (q.questions ? q.questions.length : qs?.latest?.totalQuestions || 0);
                        const pCompletedQuestions = qs?.latest
                          ? countCompletedQuestions(qs.latest.userAnswers, pTotalQuestions) ||
                            (qs.latest.score > 0 ? pTotalQuestions : 0)
                          : 0;
                        const status = getQuizStatus(q);
                        const isReviewedForPractice = liveReviewedQuizIds.includes(q.id);
                        const isLocked = isReviewedForPractice ? false : status.isLocked;
                        const isDownloaded = downloadedQuizIds.has(q.id);

                        return (
                          <div
                            key={q.id}
                            className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                              isReviewedForPractice
                                ? 'border-rose-300'
                                : 'border-slate-200 hover:border-purple-300'
                            } ${isLocked ? 'opacity-75' : ''}`}
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                <span
                                  className={
                                    isReviewedForPractice ? 'text-rose-700' : 'text-purple-700'
                                  }
                                >
                                  {isReviewedForPractice
                                    ? 'Đề sửa bài · Làm lại'
                                    : 'Ôn tập tự do'}
                                </span>
                                <span className="font-mono tabular-nums text-slate-500">
                                  {q.questionCount || (q.questions ? q.questions.length : 0)} câu ·{' '}
                                  {q.grade === 'all' ? 'Chung' : `Khối ${q.grade}`}
                                </span>
                              </div>

                              {q.category && (
                                <p className="text-[11px] font-semibold text-slate-500 truncate">
                                  {q.category}
                                </p>
                              )}
                              <h4 className="font-black text-slate-900 text-sm leading-snug flex items-start gap-1.5 line-clamp-2">
                                {isLocked && (
                                  <Lock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                )}
                                <span>{q.title}</span>
                              </h4>

                              {!isLocked && (
                                <>
                                  <div className="flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums pt-1">
                                    <span>
                                      Lượt luyện:{' '}
                                      <strong className="text-slate-900">{qs?.count || 0}</strong>
                                    </span>
                                    <span>
                                      Điểm Max:{' '}
                                      <strong className="text-purple-700">
                                        {qs ? `${qs.max.toFixed(1)}đ` : '—'}
                                      </strong>
                                    </span>
                                  </div>
                                  <QuizProgressIndicator
                                    completed={pCompletedQuestions}
                                    total={pTotalQuestions}
                                    variant="card"
                                  />
                                </>
                              )}
                            </div>

                            {isLocked ? (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                                <p className="font-bold text-slate-500">Đang khóa điều kiện</p>
                                <p className="font-medium text-slate-700 mt-0.5">{status.reason}</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => handleStartPractice(q)}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-black text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <Zap size={13} />
                                  <span>{isReviewedForPractice ? 'Ôn tập lại' : 'Luyện tập'}</span>
                                </button>
                                {isReviewedForPractice && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartQuiz(q)}
                                    title="Làm lại đề như một bài thi hoàn chỉnh"
                                    className="flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    <RotateCcw size={13} />
                                    <span>Thi lại</span>
                                  </button>
                                )}
                                {isOnline && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownloadQuiz(q, e)}
                                    disabled={Boolean(downloadingQuizId)}
                                    title={
                                      isDownloaded
                                        ? 'Đã lưu ngoại tuyến'
                                        : 'Tải đề về máy để ôn ngoại tuyến'
                                    }
                                    className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                                      isDownloaded
                                        ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {isDownloaded ? (
                                      <CloudCheck size={16} />
                                    ) : (
                                      <Download size={16} />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                      <Zap size={28} className="text-purple-500 mx-auto" />
                      <p className="text-sm font-black text-slate-800">
                        Chưa có đề luyện tập phù hợp với bộ lọc
                      </p>
                      <p className="text-xs text-slate-500">
                        Thử chọn "Tất cả chương" hoặc thay đổi niên khóa ở thanh bên trái.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. PANEL TỔNG QUAN & BIỂU ĐỒ (Chỉ mount khi chọn menu này) */}
              {activeMenu === 'overview' && (
                <StudentAnalyticsPanel
                  stats={stats}
                  overallQuestionsStats={overallQuestionsStats}
                  performanceInsights={performanceInsights}
                  results={results}
                  quizzes={quizzes}
                  onGoToExams={() => setActiveMenu('exams')}
                />
              )}

              {/* 4. PANEL LỊCH SỬ NỘP BÀI */}
              {activeMenu === 'history' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-5">Đề thi & Trạng thái</th>
                        <th className="py-3.5 px-4 text-center">Phân loại</th>
                        <th className="py-3.5 px-4 text-center">Tiến độ</th>
                        <th className="py-3.5 px-4 text-center">Thời điểm nộp</th>
                        <th className="py-3.5 px-4 text-right">Điểm số</th>
                        <th className="py-3.5 px-5 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredResults.slice(0, resultsDisplayCount).map((r) => {
                        const quiz = r.quiz;
                        const displayTitle = r.quizTitle || quiz?.title || 'Đề thi đã nộp';
                        const displayCategory = r.quizCategory || quiz?.category || '';
                        const displayType = r.quizType || quiz?.type || 'test';
                        const rowTotal = r.totalQuestions || quiz?.questionCount || 0;
                        const rowCompleted =
                          countCompletedQuestions(r.userAnswers, rowTotal) ||
                          (r.score > 0 ? rowTotal : 0);

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-4 px-5 max-w-md">
                              <p className="font-bold text-slate-900 leading-snug">{displayTitle}</p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                                <span
                                  className={
                                    r.isExpired ? 'text-slate-500' : 'text-emerald-700 font-semibold'
                                  }
                                >
                                  {r.isExpired ? 'Đã hết hạn mở' : 'Đang mở'}
                                </span>
                                {r.hasMultipleAttempts && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums text-blue-700 font-semibold">
                                      Lần {r.attemptNumber}/{r.maxAttempts}
                                    </span>
                                  </>
                                )}
                                {displayCategory && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="truncate max-w-[180px]">{displayCategory}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <span
                                className={`text-[11px] font-bold ${
                                  displayType === 'test' ? 'text-blue-700' : 'text-amber-700'
                                }`}
                              >
                                {displayType === 'test' ? 'Kiểm tra' : 'Luyện tập'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <QuizProgressIndicator
                                completed={rowCompleted}
                                total={rowTotal}
                                variant="table"
                              />
                            </td>
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <p className="font-mono tabular-nums font-semibold text-slate-700">
                                {format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}
                              </p>
                              {r.durationSeconds ? (
                                <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                  {Math.floor(r.durationSeconds / 60)}p {r.durationSeconds % 60}s
                                </p>
                              ) : null}
                            </td>
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <span
                                className={`font-mono tabular-nums text-sm font-black ${
                                  r.score >= 8
                                    ? 'text-emerald-700'
                                    : r.score >= 5
                                    ? 'text-blue-700'
                                    : 'text-orange-700'
                                }`}
                              >
                                {r.score.toFixed(2)}đ
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleViewResult(r)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-colors cursor-pointer"
                                  title="Xem lại bài thi đã nộp, đáp án và lời giải"
                                >
                                  <Eye size={13} />
                                  <span>Xem lại</span>
                                  <ChevronRight size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLeaderboardQuizId(r.quizId);
                                    setActiveMenu('leaderboard');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-colors cursor-pointer"
                                  title="Xem thứ hạng của bạn ở đề thi này"
                                >
                                  <Trophy size={13} />
                                  <span>Xếp hạng</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredResults.length === 0 && (
                    <div className="p-12 text-center text-slate-500 text-xs font-medium">
                      {results.length === 0
                        ? 'Bạn chưa thực hiện bài thi nào.'
                        : 'Không có bài làm nào phù hợp với bộ lọc đã chọn.'}
                    </div>
                  )}

                  {filteredResults.length > 15 && (
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500">
                      <span className="font-mono tabular-nums">
                        Đang hiển thị {Math.min(resultsDisplayCount, filteredResults.length)} /{' '}
                        {filteredResults.length} bài
                      </span>
                      <div className="flex items-center gap-2">
                        {filteredResults.length > resultsDisplayCount && (
                          <>
                            <button
                              type="button"
                              onClick={() => setResultsDisplayCount((prev) => prev + 15)}
                              className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Xem thêm (+15)
                            </button>
                            <button
                              type="button"
                              onClick={() => setResultsDisplayCount(filteredResults.length)}
                              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors cursor-pointer"
                            >
                              Xem tất cả ({filteredResults.length})
                            </button>
                          </>
                        )}
                        {resultsDisplayCount > 15 && (
                          <button
                            type="button"
                            onClick={() => setResultsDisplayCount(15)}
                            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            Thu gọn
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. PANEL BẢNG XẾP HẠNG (Chỉ kích hoạt & tải dữ liệu khi học sinh chọn menu này) */}
              {activeMenu === 'leaderboard' && (
                <StudentLeaderboard
                  student={user}
                  results={results}
                  quizzes={quizzes}
                  selectedQuizId={leaderboardQuizId}
                  onSelectQuizId={setLeaderboardQuizId}
                  refreshTrigger={leaderboardRefreshKey}
                  isOnline={isOnline}
                />
              )}

              {/* 6. PANEL BẢNG VÀNG VINH DANH (Chỉ tải dữ liệu khi kích hoạt menu này) */}
              {activeMenu === 'honors' && (
                <div>
                  {isLoadingHonors ? (
                    <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center space-y-3">
                      <Loader2 className="animate-spin text-amber-500 mx-auto" size={32} />
                      <p className="text-xs font-bold text-slate-500">
                        Đang tải danh sách vinh danh...
                      </p>
                    </div>
                  ) : publishedResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {publishedResults.map((pub) => {
                        const userResultInPub =
                          pub.results.find(
                            (r) => r.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()
                          ) || pub.results[0];
                        return (
                          <div
                            key={pub.id}
                            className="bg-slate-900 rounded-2xl p-5 border border-yellow-500/30 flex flex-col justify-between gap-4 text-white"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-yellow-500 text-slate-900 rounded-xl flex items-center justify-center shrink-0">
                                <Award size={20} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-yellow-400 truncate">
                                  {pub.quizTitle}
                                </p>
                                <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                                  Vinh danh ngày {format(new Date(pub.publishedAt), 'dd/MM/yyyy')}
                                </p>
                              </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center space-y-1">
                              <p className="text-[11px] font-semibold text-slate-400">
                                Điểm số vinh danh
                              </p>
                              <p className="text-3xl font-black font-mono tabular-nums text-emerald-400">
                                {(userResultInPub?.score ?? 0).toFixed(1)}đ
                              </p>
                              <p className="text-xs font-semibold text-slate-200">{user.fullName}</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => setViewingHonorees(pub)}
                              className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Award size={14} />
                              <span>Xem chứng nhận vinh danh</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                      <Award size={32} className="text-slate-300 mx-auto" />
                      <p className="text-sm font-black text-slate-800">
                        Chưa có bảng vinh danh cá nhân
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Khi bạn đạt thành tích xuất sắc và được giáo viên tuyên dương, bảng vàng vinh danh của bạn sẽ xuất hiện tại đây.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 7. PANEL KHO NGOẠI TUYẾN */}
              {activeMenu === 'offline' && (
                <div className="space-y-5">
                  {syncFeedback && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-xs font-bold text-blue-800">
                      {syncFeedback}
                    </div>
                  )}

                  {downloadedQuizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {downloadedQuizzes.map((q) => {
                        const totalQuestions =
                          q.questionCount || (q.questions ? q.questions.length : 0);

                        return (
                          <div
                            key={q.id}
                            className="bg-white rounded-2xl border border-teal-300 p-5 flex flex-col justify-between gap-4"
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                <span className="inline-flex items-center gap-1 text-teal-700">
                                  <CloudCheck size={13} />
                                  <span>Sẵn sàng Offline</span>
                                </span>
                                <span className="font-mono tabular-nums text-slate-500">
                                  {q.durationMinutes} phút · {totalQuestions} câu
                                </span>
                              </div>
                              {q.category && (
                                <p className="text-[11px] font-semibold text-slate-500 truncate">
                                  {q.category}
                                </p>
                              )}
                              <h4 className="font-black text-slate-900 text-sm leading-snug line-clamp-2">
                                {q.title}
                              </h4>
                              <p className="text-xs text-teal-800 bg-teal-50/70 px-3 py-2 rounded-xl border border-teal-100">
                                Làm bài không cần Internet; kết quả sẽ tự động đồng bộ khi có mạng.
                              </p>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleStartQuiz(q)}
                                className="w-full py-2.5 rounded-xl font-bold text-xs bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Zap size={14} />
                                <span>Làm bài ngay (Offline)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOfflineQuiz(q.id)}
                                className="w-full py-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                                <span>Xóa khỏi máy</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                      <HardDrive size={30} className="text-teal-500 mx-auto" />
                      <p className="text-sm font-black text-slate-800">
                        Chưa có đề thi nào được lưu ngoại tuyến
                      </p>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Nhấn biểu tượng tải xuống trên thẻ đề thi ở mục Đề thi hoặc Kho luyện tập để lưu về máy làm bài khi mất mạng.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveMenu('exams')}
                        className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Đi tới danh sách đề thi
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Các Modal chi tiết */}
      {selectedResult && (
        <ResultDetailModal
          isOpen={true}
          result={selectedResult.result}
          quiz={selectedResult.quiz}
          onClose={() => setSelectedResult(null)}
        />
      )}
      {previewQuiz && (
        <QuizPreviewModal
          quiz={previewQuiz}
          isAdmin={false}
          onClose={() => setPreviewQuiz(null)}
        />
      )}
      {viewingHonorees && (
        <div className="fixed inset-0 bg-slate-900/90 z-[3000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl border-2 border-yellow-400">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-yellow-500 text-slate-900 rounded-xl">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Bảng Vàng Danh Dự Cá Nhân</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{viewingHonorees.quizTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingHonorees(null)}
                className="p-2 bg-slate-800 rounded-xl hover:bg-red-600 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-5 bg-slate-50 text-center">
              <div className="inline-flex p-4 bg-yellow-100 text-yellow-600 rounded-full">
                <Award size={40} />
              </div>
              <div>
                <p className="text-xs font-bold text-yellow-700 mb-1">
                  Chúc mừng thành tích xuất sắc
                </p>
                <h4 className="text-2xl font-black text-slate-900">{user.fullName}</h4>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  MSHS: {user.studentCode}
                  {user.className ? ` · Lớp ${user.className}` : ''} · Khối {user.grade}
                </p>
              </div>

              <div className="py-4 bg-white rounded-2xl border border-slate-200 max-w-xs mx-auto">
                <p className="text-xs font-semibold text-slate-400">Điểm số vinh danh</p>
                <p className="text-4xl font-black font-mono tabular-nums text-emerald-600 mt-1">
                  {(
                    viewingHonorees.results.find(
                      (r) => r.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()
                    )?.score ??
                    viewingHonorees.results[0]?.score ??
                    0
                  ).toFixed(2)}
                  đ
                </p>
              </div>

              <p className="text-xs font-medium text-slate-500 font-mono tabular-nums">
                Vinh danh vào {format(new Date(viewingHonorees.publishedAt), 'HH:mm dd/MM/yyyy')}
              </p>

              <button
                type="button"
                onClick={() => setViewingHonorees(null)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Warning Modal */}
      {sessionWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div
              className={`p-6 text-white ${
                sessionWarning.type === 'different_quiz' ? 'bg-red-500' : 'bg-amber-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <ShieldAlert className="w-7 h-7" />
                <h3 className="text-lg font-black">
                  {sessionWarning.type === 'different_quiz'
                    ? 'Cảnh báo bảo mật'
                    : 'Thông báo phiên làm bài'}
                </h3>
              </div>
              <p className="text-white/90 text-xs font-bold">
                {sessionWarning.type === 'different_quiz'
                  ? 'Phát hiện nhiều phiên làm bài đồng thời'
                  : 'Phát hiện phiên làm bài trên thiết bị khác'}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 mb-1">Đề thi đang hoạt động:</p>
                <p className="text-slate-800 font-black text-base leading-snug">
                  {sessionWarning.quizTitle}
                </p>
              </div>

              <div className="text-slate-600 text-xs leading-relaxed">
                {sessionWarning.type === 'different_quiz' ? (
                  <p>
                    Hệ thống nhận thấy bạn đang làm bài thi{' '}
                    <span className="font-bold text-slate-900">"{sessionWarning.quizTitle}"</span>.
                    Bạn cần hoàn thành hoặc kết thúc phiên cũ trước khi bắt đầu đề thi mới.
                  </p>
                ) : (
                  <p>
                    Bạn đang có một phiên làm bài cho đề này trên thiết bị hoặc trình duyệt khác.
                    Nếu tiếp tục, dữ liệu chưa nộp ở máy kia{' '}
                    <span className="font-bold text-amber-700">sẽ bị mất</span>. Bạn có muốn bắt đầu
                    lại trên máy này?
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={sessionWarning.onConfirm}
                  className={`w-full py-3 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    sessionWarning.type === 'different_quiz'
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  {sessionWarning.type === 'different_quiz'
                    ? 'Kết thúc đề cũ & Bắt đầu đề mới'
                    : 'Tiếp tục (Bắt đầu mới)'}
                </button>
                <button
                  type="button"
                  onClick={sessionWarning.onCancel}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quản lý Đề thi Ngoại tuyến & Đồng bộ */}
      <OfflineManagerModal
        isOpen={isOfflineManagerOpen}
        onClose={() => setIsOfflineManagerOpen(false)}
        user={user}
        onStartQuiz={(q) => {
          setIsOfflineManagerOpen(false);
          handleStartQuiz(q);
        }}
        onManualSync={manualSync}
        isSyncing={isSyncing}
        isOnline={isOnline}
      />
    </div>
  );
}
