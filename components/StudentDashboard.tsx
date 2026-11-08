
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Quiz, Result, PublishedResult, Chapter, Grade } from '../types';
import { getQuizzesMetadata, getResultsForStudent, getPublishedResultsForStudent, getQuizById, getResultById, getStudentActiveSessions, deleteExamSession, getChapters, getCurrentAcademicYear } from '../services/storage';
import { downloadQuizForOffline, getOfflineQuizzes, getOfflineQuizById, deleteOfflineQuiz } from '../services/offlineStorage';
import { useOfflineSync } from '../services/offlineSyncManager';
import OfflineManagerModal from './OfflineManagerModal';
import QuizTaker from './QuizTaker';
import QuickPractice from './QuickPractice';
import ResultDetailModal from './admin/ResultDetailModal';
import QuizPreviewModal from './admin/QuizPreviewModal';
import QuizProgressIndicator, { countCompletedQuestions } from './QuizProgressIndicator';
import { 
  Clock, Trophy, BookOpen, Eye, Medal, History, ChevronRight, Star, Award, Users, X, 
  Loader2, RefreshCw, Zap, ShieldAlert, Calendar, Lock, FileText, CheckCircle2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Activity, Sparkles, Target, BarChart2, LineChart as LineChartIcon, 
  BarChart3, CheckCircle, ArrowUpRight, Download, Wifi, WifiOff, CloudCheck, HardDrive, Trash2,
  AlertTriangle, AlertCircle
} from 'lucide-react';
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
import { format, isBefore, isAfter, addMinutes, differenceInMinutes } from 'date-fns';
import LatexText from './LatexText';

interface StudentDashboardProps {
  user: User;
  targetQuizId?: string | null;
}

export default function StudentDashboard({ user, targetQuizId }: StudentDashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const gradeFilter = user.grade || '10';
  const currentAcademicYear = getCurrentAcademicYear();
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(user.academicYear || currentAcademicYear);
  const [chapterFilter, setChapterFilter] = useState('all');
  const [publishedResults, setPublishedResults] = useState<PublishedResult[]>([]);
  const [quizStatusTab, setQuizStatusTab] = useState<'all' | 'open' | 'upcoming' | 'completed' | 'practice' | 'downloaded' | 'uncompleted'>('all');
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [activePracticeQuiz, setActivePracticeQuiz] = useState<Quiz | null>(null);
  const [selectedResult, setSelectedResult] = useState<{ result: Result, quiz: Quiz } | null>(null);
  const [viewingHonorees, setViewingHonorees] = useState<PublishedResult | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);

  // Hook quản lý trạng thái kết nối & tự động đồng bộ kết quả ngoại tuyến
  const { 
    isOnline, 
    isSyncing, 
    pendingCount, 
    downloadedCount, 
    syncFeedback, 
    manualSync, 
    refreshStats: refreshOfflineStats 
  } = useOfflineSync(user.id);

  const [downloadedQuizzes, setDownloadedQuizzes] = useState<Quiz[]>([]);
  const [downloadedQuizIds, setDownloadedQuizIds] = useState<Set<string>>(new Set());
  const [downloadingQuizId, setDownloadingQuizId] = useState<string | null>(null);
  const [downloadStatusText, setDownloadStatusText] = useState<string>('');
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);

  const loadDownloadedQuizzes = useCallback(async () => {
    try {
      const list = await getOfflineQuizzes(user.id);
      setDownloadedQuizzes(list.map(item => item.quiz));
      setDownloadedQuizIds(new Set(list.map(item => item.quizId)));
    } catch (err) {
      console.error("Lỗi nạp danh sách đề thi ngoại tuyến:", err);
    }
  }, [user.id]);

  useEffect(() => {
    loadDownloadedQuizzes();
  }, [loadDownloadedQuizzes, downloadedCount]);

  const handleDownloadQuiz = async (quiz: Quiz, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (downloadingQuizId) return;

    setDownloadingQuizId(quiz.id);
    setDownloadStatusText("Đang nạp dữ liệu câu hỏi & hình ảnh...");

    try {
      const fullQuiz = (quiz.questions && quiz.questions.length > 0) ? quiz : await getQuizById(quiz.id);
      if (!fullQuiz) {
        alert("Không thể lấy nội dung đề thi để tải về.");
        return;
      }

      setDownloadStatusText("Đang mã hóa hình ảnh & công thức ngoại tuyến...");
      const result = await downloadQuizForOffline(fullQuiz.id, user.id);
      if (result.success) {
        await loadDownloadedQuizzes();
        alert(`Đã tải thành công đề "${fullQuiz.title}" về máy (${result.sizeKb.toFixed(1)} KB). Bạn có thể làm bài hoàn toàn ngoại tuyến!`);
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

  const refreshData = useCallback(async (isSilent = false, forceRefresh = false) => {
    if (!isSilent) setIsLoading(true);
    try {
        const [allQuizzes, userResults, myPubs, allChapters] = await Promise.all([
            getQuizzesMetadata('all', forceRefresh), 
            getResultsForStudent(user.id, user.studentCode, forceRefresh), 
            getPublishedResultsForStudent(user.studentCode, forceRefresh),
            getChapters(forceRefresh)
        ]);
        
        setChapters(allChapters);
        const gradeChapters = (allChapters || []).filter((c: Chapter) => gradeFilter === 'all' || String(c.grade) === String(gradeFilter));
        if (gradeChapters.length > 0) {
            setChapterFilter(prev => {
                const belongs = gradeChapters.some(c => c.name === prev);
                return belongs ? prev : gradeChapters[0].name;
            });
        }
        // Giữ toàn bộ đề thi đã phát hành để phục vụ việc phân quyền xem đề & khớp thông tin lịch sử nộp bài
        setQuizzes(allQuizzes.filter(q => q.isPublished));

        // Lọc khử trùng lặp dữ liệu nộp bài (do retry mạng, double submit hoặc trùng ID)
        const seenIds = new Set<string>();
        const uniqueResults: Result[] = [];
        const sortedRaw = (userResults as Result[]).sort((a: Result, b: Result) => 
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        for (const r of sortedRaw) {
            if (!r || !r.id || seenIds.has(r.id)) continue;
            seenIds.add(r.id);

            // Kiểm tra nếu có bản ghi cùng đề thi, cùng điểm và nộp sát nhau trong vòng 15 giây -> coi là bị lưu đúp
            const isDuplicate = uniqueResults.some(prev => 
                prev.quizId === r.quizId && 
                Math.abs(new Date(prev.submittedAt).getTime() - new Date(r.submittedAt).getTime()) < 15000 &&
                Math.abs(prev.score - r.score) < 0.001
            );

            if (!isDuplicate) {
                uniqueResults.push(r);
            }
        }
        setResults(uniqueResults);

        // Chỉ nạp bảng vinh danh của chính học sinh này (đã được lọc tinh gọn từ server)
        setPublishedResults(myPubs || []);

    } catch (err) {
        console.error("Lỗi đồng bộ dữ liệu StudentDashboard:", err);
    } finally {
        setIsLoading(false);
    }
  }, [user.id, user.studentCode, user.grade]);

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
      // Lọc các phiên còn "sống" (cập nhật trong 10 phút qua)
      const activeSessions = sessions.filter(s => {
        const lastUpdate = new Date(s.lastUpdate);
        return differenceInMinutes(new Date(), lastUpdate) < 10;
      });

      if (activeSessions.length > 0) {
        // 1. Chặn nếu làm đề KHÁC
        const otherQuizSession = activeSessions.find(s => s.quizId !== quizId);
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
                  alert("Không thể kết thúc phiên cũ. Vui lòng thử lại.");
                  resolve(false);
                }
              },
              onCancel: () => {
                setSessionWarning(null);
                resolve(false);
              }
            });
          });
        }

        // 2. Cảnh báo nếu làm CÙNG ĐỀ trên máy khác
        const sameQuizSession = activeSessions.find(s => s.quizId === quizId);
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
                  alert("Không thể xóa phiên cũ. Vui lòng thử lại.");
                  resolve(false);
                }
              },
              onCancel: () => {
                setSessionWarning(null);
                resolve(false);
              }
            });
          });
        }
      }
      return true;
    } catch (e) {
      console.error("Lỗi kiểm tra phiên làm bài:", e);
      return true; // Cho phép nếu lỗi mạng
    } finally {
      setIsCheckingSession(false);
    }
  };

  const handleStartQuiz = async (quiz: Quiz) => {
    // Kiểm tra số lần đã làm bài của học sinh đối với đề thi này
    const myAttempts = results.filter(r => r.quizId === quiz.id);
    const maxAttempts = quiz.maxAttempts ?? 2;
    if (myAttempts.length >= maxAttempts) {
      alert(`Bạn đã sử dụng hết ${maxAttempts} lần làm bài cho đề thi này. Nút làm bài đã được đóng băng.`);
      return;
    }

    setIsLoading(true);
    try {
      let fullQuiz: Quiz | null = null;

      if (!navigator.onLine) {
        fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        if (!fullQuiz) {
          alert("Bạn đang ngoại tuyến và đề thi này chưa được tải về máy. Vui lòng bật mạng để tải đề!");
          setIsLoading(false);
          return;
        }
      } else {
        fullQuiz = (quiz.questions && quiz.questions.length > 0) ? quiz : await getQuizById(quiz.id);
        if (!fullQuiz) {
          fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        }
      }

      if (!fullQuiz) {
        alert("Không tìm thấy dữ liệu đề thi.");
        return;
      }

      if (navigator.onLine) {
        const canStart = await checkActiveSession(fullQuiz.id);
        if (!canStart) return;
      }

      setActiveQuiz(fullQuiz);
    } catch (e) {
      console.error("Lỗi khởi tạo bài thi:", e);
      const offlineQuiz = await getOfflineQuizById(quiz.id, user.id);
      if (offlineQuiz) {
        setActiveQuiz(offlineQuiz);
      } else {
        alert("Lỗi khi tải câu hỏi bài thi.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPractice = async (quiz: Quiz) => {
    if (quiz.type === 'test') {
      alert("Đề này là Đề thi chính thức do Giáo viên chỉ định, không mở chế độ luyện tập trước.");
      return;
    }

    setIsLoading(true);
    try {
      let fullQuiz: Quiz | null = null;

      if (!navigator.onLine) {
        fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        if (!fullQuiz) {
          alert("Bạn đang ngoại tuyến và đề luyện tập này chưa được tải về máy.");
          setIsLoading(false);
          return;
        }
      } else {
        fullQuiz = (quiz.questions && quiz.questions.length > 0) ? quiz : await getQuizById(quiz.id);
        if (!fullQuiz) {
          fullQuiz = await getOfflineQuizById(quiz.id, user.id);
        }
      }

      if (!fullQuiz) {
        alert("Không tìm thấy dữ liệu đề thi.");
        return;
      }

      if (navigator.onLine) {
        const canStart = await checkActiveSession(fullQuiz.id);
        if (!canStart) return;
      }

      setActivePracticeQuiz(fullQuiz);
    } catch (e) {
      console.error("Lỗi khởi tạo luyện tập:", e);
      const offlineQuiz = await getOfflineQuizById(quiz.id, user.id);
      if (offlineQuiz) {
        setActivePracticeQuiz(offlineQuiz);
      } else {
        alert("Lỗi khi tải câu hỏi luyện tập.");
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
        getResultById(res.id)
      ]);
      if (fullQuiz && fullResult) {
        setSelectedResult({ result: fullResult, quiz: fullQuiz });
      } else if (fullQuiz) {
        setSelectedResult({ result: res, quiz: fullQuiz });
      } else {
        alert("Đề thi này đã bị xóa hoặc không tìm thấy dữ liệu.");
      }
    } catch (e) {
      console.error("Lỗi xem chi tiết kết quả:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý tự động mở đề thi từ link ẩn
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
                    const isFlexibleWindow = Boolean(startX && endY && endY.getTime() > startX.getTime());

                    if (quiz.type === 'test' && startX) {
                        if (isFlexibleWindow && endY) {
                            if (isBefore(curNow, startX)) {
                                alert(`Đề thi chưa mở. Khung giờ mở đề: ${format(startX, 'HH:mm dd/MM/yyyy')} đến ${format(endY, 'HH:mm dd/MM/yyyy')}.`);
                                return;
                            }
                            if (isAfter(curNow, endY)) {
                                alert(`Đã hết thời hạn vào làm đề thi này (Hạn chót vào thi: ${format(endY, 'HH:mm dd/MM/yyyy')}).`);
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

                    // Kiểm tra phiên trước khi tự động mở
                    const canStart = await checkActiveSession(quiz.id);
                    if (canStart) {
                        setActiveQuiz(quiz);
                        // Xóa param trên URL để không bị loop
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } else {
                    alert("Đề thi này không tồn tại hoặc chưa được phát hành.");
                }
            } catch (e) {
                console.error("Lỗi lấy đề thi từ link:", e);
            } finally {
                setIsLoading(false);
            }
        };
        checkTargetQuiz();
    }
  }, [targetQuizId]);

  // Danh sách đề thi được phân công cho học sinh (Khối, Lớp, Công khai)
  const assignedQuizzes = useMemo(() => {
    return quizzes.filter((q: Quiz) => {
      const matchGrade = !q.grade || q.grade === 'all' || gradeFilter === 'all' || String(q.grade) === String(gradeFilter);
      let isTargetMatch = false;

      if (q.targetType === 'classes') {
        const hasClassIdMatch = Boolean(user.classId && q.assignedClassIds && q.assignedClassIds.includes(user.classId));
        const hasClassNameMatch = Boolean(user.className && q.assignedClassIds && q.assignedClassIds.includes(user.className));
        const hasAssignedClassesMatch = Boolean(q.assignedClasses && q.assignedClasses.some(c => 
          (user.classId && c.id === user.classId) || (user.className && c.name === user.className)
        ));
        isTargetMatch = hasClassIdMatch || hasClassNameMatch || hasAssignedClassesMatch;
      } else {
        isTargetMatch = !q.isUnlisted;
      }

      return matchGrade && q.isPublished && isTargetMatch;
    });
  }, [quizzes, gradeFilter, user.classId, user.className]);

  const completedQuizIds = useMemo(() => new Set(results.map(r => r.quizId)), [results]);
  const completedAssignedCount = useMemo(() => assignedQuizzes.filter(q => completedQuizIds.has(q.id)).length, [assignedQuizzes, completedQuizIds]);
  const uncompletedAssignedCount = useMemo(() => Math.max(0, assignedQuizzes.length - completedAssignedCount), [assignedQuizzes, completedAssignedCount]);
  const uncompletedAssignedQuizzes = useMemo(() => assignedQuizzes.filter(q => !completedQuizIds.has(q.id)), [assignedQuizzes, completedQuizIds]);

  // Điểm cao nhất của từng đề đã nộp
  const bestScorePerQuiz = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach(r => {
      const cur = map.get(r.quizId) ?? 0;
      if (r.score > cur) map.set(r.quizId, r.score);
    });
    return map;
  }, [results]);

  const totalAssignedScore = useMemo(() => {
    let sum = 0;
    assignedQuizzes.forEach(q => {
      sum += (bestScorePerQuiz.get(q.id) ?? 0); // Đề chưa làm tính 0.00 điểm
    });
    return sum;
  }, [assignedQuizzes, bestScorePerQuiz]);

  const avgSubmittedScore = useMemo(() => {
    return results.length > 0 ? (results.reduce((acc, r) => acc + r.score, 0) / results.length) : 0;
  }, [results]);

  // ĐTB TỔNG KẾT (Quy tắc công bằng: Các đề được giao nhưng không làm sẽ tính 0.00 điểm)
  const officialAvgScore = useMemo(() => {
    if (assignedQuizzes.length === 0) return avgSubmittedScore;
    return totalAssignedScore / assignedQuizzes.length;
  }, [assignedQuizzes.length, totalAssignedScore, avgSubmittedScore]);

  const stats = useMemo(() => {
    const totalQuizzes = results.length;
    const avgScore = officialAvgScore;
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
        accumulatedPoints: effortPoints + bonusPoints
    };
  }, [results, officialAvgScore, avgSubmittedScore, completedAssignedCount, assignedQuizzes.length, uncompletedAssignedCount]);

  // Thống kê tổng số câu hỏi đã làm trên tổng số câu hỏi của các đề
  const overallQuestionsStats = useMemo(() => {
    let totalQuestions = 0;
    let completedQuestions = 0;

    const targetList = assignedQuizzes.length > 0 ? assignedQuizzes : quizzes;
    targetList.forEach(q => {
      const qTotal = q.questionCount || (q.questions ? q.questions.length : 0);
      totalQuestions += qTotal;
      const qAttempts = results.filter(r => r.quizId === q.id).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      if (qAttempts.length > 0) {
        const latest = qAttempts[0];
        const done = countCompletedQuestions(latest.userAnswers, qTotal) || (latest.score > 0 ? qTotal : 0);
        completedQuestions += done;
      }
    });

    const percentage = totalQuestions > 0 ? Math.min(100, Math.round((completedQuestions / totalQuestions) * 100)) : 0;
    return {
      completed: completedQuestions,
      total: totalQuestions,
      percentage
    };
  }, [assignedQuizzes, quizzes, results]);

  // Recharts Chart State & Computations
  const [chartType, setChartType] = useState<'timeline' | 'distribution'>('timeline');
  const [chartScope, setChartScope] = useState<'all' | 'test' | 'practice'>('all');
  const [chartLimit, setChartLimit] = useState<number>(15);

  // Chronological score data for Recharts (Sorted oldest to newest for progression line)
  const scoreHistoryData = useMemo(() => {
    let sorted = [...results].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    
    if (chartScope !== 'all') {
      sorted = sorted.filter(r => {
        const q = quizzes.find(item => item.id === r.quizId);
        return q ? q.type === chartScope : true;
      });
    }

    if (chartLimit > 0 && sorted.length > chartLimit) {
      sorted = sorted.slice(sorted.length - chartLimit);
    }

    return sorted.map((r, idx) => {
      const q = quizzes.find(item => item.id === r.quizId);
      const subDate = new Date(r.submittedAt);
      const quizTitle = q?.title || 'Bài thi';
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
        quizType: q?.type || 'test',
        label: `#${idx + 1} (${format(subDate, 'dd/MM')})`
      };
    });
  }, [results, quizzes, chartScope, chartLimit]);

  // Phổ điểm (Score distribution for bar chart)
  const scoreDistributionData = useMemo(() => {
    let filtered = [...results];
    if (chartScope !== 'all') {
      filtered = filtered.filter(r => {
        const q = quizzes.find(item => item.id === r.quizId);
        return q ? q.type === chartScope : true;
      });
    }

    const total = filtered.length || 1;
    const groups = [
      { key: 'under5', name: 'Dưới 5.0 (Cần cố gắng)', shortName: '< 5.0', range: [0, 5], count: 0, color: '#f43f5e' },
      { key: '5to65', name: '5.0 - 6.4 (Trung bình)', shortName: '5.0 - 6.4', range: [5, 6.5], count: 0, color: '#f59e0b' },
      { key: '65to8', name: '6.5 - 7.9 (Khá)', shortName: '6.5 - 7.9', range: [6.5, 8], count: 0, color: '#3b82f6' },
      { key: '8to10', name: '8.0 - 10.0 (Giỏi / Xuất sắc)', shortName: '8.0 - 10.0', range: [8, 10.01], count: 0, color: '#10b981' }
    ];

    filtered.forEach(r => {
      if (r.score < 5) groups[0].count++;
      else if (r.score < 6.5) groups[1].count++;
      else if (r.score < 8) groups[2].count++;
      else groups[3].count++;
    });

    return groups.map(g => ({
      ...g,
      percentage: filtered.length > 0 ? Math.round((g.count / total) * 100) : 0
    }));
  }, [results, quizzes, chartScope]);

  // Thống kê phân tích xu hướng
  const performanceInsights = useMemo(() => {
    if (results.length === 0) {
      return {
        highest: 0,
        latest: 0,
        recentAvg: 0,
        trendDiff: 0,
        passRate: 0,
        distinctionRate: 0
      };
    }
    const scores = results.map(r => r.score);
    const highest = Math.max(...scores);
    const sortedDesc = [...results].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const latest = sortedDesc[0]?.score || 0;
    
    // 3 bài gần nhất
    const recent3 = sortedDesc.slice(0, 3);
    const recentAvg = recent3.length > 0 ? (recent3.reduce((acc, r) => acc + r.score, 0) / recent3.length) : 0;
    const overallAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const trendDiff = recentAvg - overallAvg;

    const passCount = results.filter(r => r.score >= 5).length;
    const distinctionCount = results.filter(r => r.score >= 8).length;

    return {
      highest,
      latest,
      recentAvg,
      trendDiff,
      passRate: Math.round((passCount / results.length) * 100),
      distinctionRate: Math.round((distinctionCount / results.length) * 100)
    };
  }, [results]);

  useEffect(() => {
    refreshData();
    // 10 phút (600.000 ms) tự động kiểm tra làm mới nền một lần
    const interval = setInterval(() => refreshData(true), 10 * 60 * 1000); 
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleExitQuiz = () => {
    setActiveQuiz(null);
    setActivePracticeQuiz(null);
    setTimeout(() => refreshData(), 500);
  };

  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  };

  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    // Cập nhật thời gian mỗi 30 giây để tự động ẩn các đề thi vừa kết thúc thời gian mở
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = currentTime;

  // Hàm kiểm tra đề thi đã hết thời hạn mở đề / làm bài chưa
  const isQuizExpired = useCallback((q: Quiz, time: Date = currentTime): boolean => {
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
  }, [currentTime]);

  // Logic kiểm tra lộ trình học tập (Prerequisite Path)
  const getQuizStatus = (q: Quiz) => {
    const qOrder = q.orderIndex ?? 1;
    
    // Đề có STT = 0 là đề tự do (không chặn ai và không bị ai chặn)
    if (qOrder === 0) return { isLocked: false };
    
    // Nếu chưa có chương hoặc STT = 1 thì mặc định mở
    if (!q.category || qOrder <= 1) return { isLocked: false };
    
    // Tìm các đề trong cùng chương có thứ tự nhỏ hơn
    // Chỉ xét các đề đang còn hạn (để tránh học sinh bị kẹt bởi đề đã hết hạn)
    // Và bỏ qua các đề có STT = 0
    const prerequisites = quizzes
        .filter(prev => 
            prev.category === q.category && 
            (prev.orderIndex ?? 0) > 0 && 
            (prev.orderIndex ?? 0) < qOrder &&
            !isQuizExpired(prev, currentTime)
        )
        .sort((a, b) => (b.orderIndex ?? 0) - (a.orderIndex ?? 0));
    
    if (prerequisites.length === 0) return { isLocked: false };
    
    const prevQuiz = prerequisites[0];
    const bestScore = results
        .filter(r => r.quizId === prevQuiz.id)
        .reduce((max, r) => Math.max(max, r.score), 0);
    
    if (bestScore < 5) {
        return { isLocked: true, reason: `Cần đạt >= 5 điểm ở đề "${prevQuiz.title}"` };
    }
    
    return { isLocked: false };
  };

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q: Quiz) => {
        const matchGrade = !q.grade || q.grade === 'all' || gradeFilter === 'all' || String(q.grade) === String(gradeFilter);
        const matchChapter = chapterFilter === 'all' || q.category === chapterFilter;
        const matchYear = !academicYearFilter || academicYearFilter === 'all' || 
            (academicYearFilter === 'none' ? !q.academicYear : (q.academicYear === academicYearFilter || (!q.academicYear && academicYearFilter === currentAcademicYear)));
        
        // Kiểm tra phân quyền giao đề theo Lớp
        let isTargetMatch = false;
        if (q.targetType === 'classes') {
          const hasClassIdMatch = Boolean(user.classId && q.assignedClassIds && q.assignedClassIds.includes(user.classId));
          const hasClassNameMatch = Boolean(user.className && q.assignedClassIds && q.assignedClassIds.includes(user.className));
          const hasAssignedClassesMatch = Boolean(q.assignedClasses && q.assignedClasses.some(c => 
            (user.classId && c.id === user.classId) || (user.className && c.name === user.className)
          ));
          isTargetMatch = hasClassIdMatch || hasClassNameMatch || hasAssignedClassesMatch;
        } else {
          isTargetMatch = !q.isUnlisted;
        }

        return matchGrade && matchChapter && isTargetMatch && matchYear && q.isPublished;
    });
  }, [quizzes, gradeFilter, chapterFilter, academicYearFilter, user.classId, user.className, currentAcademicYear]);

  // Helper tính toán thời gian mở đề & thông tin làm bài của riêng học sinh này
  const getQuizTiming = useCallback((q: Quiz) => {
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
    const myAttempts = results.filter(r => r.quizId === q.id).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    const attemptCount = myAttempts.length;
    const maxAttempts = q.maxAttempts ?? (q.type === 'practice' ? 99 : 2);
    const isFrozen = q.type === 'test' && attemptCount >= maxAttempts;
    const bestScore = attemptCount > 0 ? Math.max(...myAttempts.map(r => r.score)) : null;

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
      bestScore
    };
  }, [currentTime, results, isQuizExpired]);

  // Phân loại rõ ràng đề thi theo đúng thông tin tài khoản học sinh:
  // 1. Đề thi đang mở (Đang trong giờ làm bài & còn lượt thi)
  const openTestQuizzes = useMemo(() => {
    return filteredQuizzes.filter(q => {
      if (q.type !== 'test') return false;
      const timing = getQuizTiming(q);
      return !timing.isExpired && timing.isStarted && !timing.isEnded && !timing.isFrozen;
    });
  }, [filteredQuizzes, getQuizTiming]);

  // 2. Đề thi sắp làm (Có lịch mở trong tương lai, chưa tới giờ thi)
  const upcomingTestQuizzes = useMemo(() => {
    return filteredQuizzes.filter(q => {
      if (q.type !== 'test') return false;
      const timing = getQuizTiming(q);
      return !timing.isExpired && !timing.isStarted && !timing.isEnded;
    });
  }, [filteredQuizzes, getQuizTiming]);


  // 4. Kho đề luyện tập
  const practiceQuizzes = useMemo(() => {
    return filteredQuizzes.filter(q => q.type === 'practice' && !isQuizExpired(q, currentTime));
  }, [filteredQuizzes, currentTime, isQuizExpired]);

  // Bộ lọc và hiển thị danh sách các đề đã làm ở phía dưới
  const [resultsFilter, setResultsFilter] = useState<'all' | 'expired' | 'active'>('all');
  const [resultsDisplayCount, setResultsDisplayCount] = useState(15);

  const enrichedResults = useMemo(() => {
    return results.map(r => {
      const quiz = quizzes.find(q => q.id === r.quizId);
      const title = quiz?.title || r.quizTitle || (r as any).title || 'Đề thi đã nộp';
      const category = quiz?.category || r.quizCategory || '';
      const rawType = quiz?.type || r.quizType || ((title.toLowerCase().includes('kiểm tra') || title.toLowerCase().includes('đề')) ? 'test' : 'practice');
      const isExpired = quiz ? isQuizExpired(quiz, currentTime) : true;
      const sameQuizAttempts = results
        .filter(item => item.quizId === r.quizId)
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
      const attemptIndex = sameQuizAttempts.findIndex(item => item.id === r.id);
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
        maxAttempts: quiz?.maxAttempts ?? (rawType === 'practice' ? 99 : 2)
      };
    });
  }, [results, quizzes, currentTime, isQuizExpired]);

  const filteredResults = useMemo(() => {
    if (resultsFilter === 'expired') {
      return enrichedResults.filter(item => item.isExpired);
    }
    if (resultsFilter === 'active') {
      return enrichedResults.filter(item => !item.isExpired);
    }
    return enrichedResults;
  }, [enrichedResults, resultsFilter]);

  const expiredResultsCount = useMemo(() => enrichedResults.filter(r => r.isExpired).length, [enrichedResults]);
  const activeResultsCount = useMemo(() => enrichedResults.filter(r => !r.isExpired).length, [enrichedResults]);

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={handleExitQuiz} />;
  }

  if (activePracticeQuiz) {
    return <QuickPractice quiz={activePracticeQuiz} student={user} onExit={handleExitQuiz} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 pb-20">
      {isCheckingSession && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[5000] flex items-center justify-center">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48}/>
                <p className="font-black uppercase text-xs tracking-widest text-slate-800">Đang kiểm tra bảo mật...</p>
            </div>
        </div>
      )}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">Chào mừng, {user.fullName} 👋</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest mt-1">
              Khối {user.grade}
              {user.className ? ` • Lớp ${user.className}` : ''}
              {user.academicYear ? ` (${user.academicYear})` : ''}
              {` • Mã số: ${user.studentCode}`}
            </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 relative z-10">
            {/* Online / Offline status badge */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[10px] font-black uppercase shadow-xs ${
              isOnline 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
            }`}>
              {isOnline ? <Wifi size={13} className="text-emerald-600"/> : <WifiOff size={13} className="text-amber-600"/>}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Offline Center button */}
            <button
              onClick={() => setIsOfflineManagerOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 transition-all border border-slate-700 shadow-sm flex items-center gap-2 text-xs font-bold relative"
            >
              <HardDrive size={16} className="text-teal-400"/>
              <span className="hidden sm:inline">Kho Ngoại Tuyến</span>
              <span className="px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-black text-[9px]">
                {downloadedCount}
              </span>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 text-[8px] font-black text-white items-center justify-center">!</span>
                </span>
              )}
            </button>

            <button 
                onClick={() => refreshData(false, true)} 
                title="Làm mới dữ liệu & Đề thi mới nhất"
                className={`p-3 rounded-2xl bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-100 shadow-sm flex items-center gap-2 text-xs font-bold ${isLoading ? 'opacity-70' : ''}`}
            >
                <RefreshCw size={18} className={isLoading ? 'animate-spin text-blue-600' : ''}/>
                <span className="hidden sm:inline">Làm mới</span>
            </button>
            <div className="flex items-center gap-3 bg-yellow-50 px-6 py-3 rounded-[1.5rem] border border-yellow-100 shadow-sm group">
                <div className="w-10 h-10 bg-yellow-400 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Medal size={24}/></div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-yellow-600 uppercase leading-none mb-1">Tích lũy</p>
                    <span className="text-xl font-black text-yellow-700">{stats.accumulatedPoints.toFixed(2)}</span>
                </div>
            </div>
        </div>
      </header>

      {/* Filters Section & Status Switcher */}
      <section className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <ShieldAlert size={16} className="text-blue-600"/>
                <span className="text-[10px] font-black uppercase text-slate-400">Bộ lọc:</span>
            </div>
            
            <select 
              className="bg-amber-50 border-2 border-amber-300 text-amber-950 font-black px-4 py-2 rounded-2xl text-[10px] uppercase outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer min-w-[170px]"
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
            >
              <option value="all">🗄️ TẤT CẢ NIÊN KHÓA</option>
              <option value={currentAcademicYear}>⭐ NIÊN KHÓA {currentAcademicYear} (HIỆN HÀNH)</option>
              {['2027-2028', '2026-2027', '2025-2026', '2024-2025'].filter(y => y !== currentAcademicYear).map(yr => (
                <option key={yr} value={yr}>📅 NĂM HỌC {yr}</option>
              ))}
            </select>

            <select 
              className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer min-w-[190px]"
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
            >
              <option value="all">Tất cả chương</option>
              {chapters
                .filter((c: Chapter) => gradeFilter === 'all' || String(c.grade) === String(gradeFilter))
                .map((c: Chapter) => (
                  <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>
                ))
              }
            </select>

            {chapterFilter !== 'all' && (
              <button 
                  onClick={() => { setChapterFilter('all'); }}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm"
              >
                  Đặt lại
              </button>
            )}
          </div>

          <div className="text-[9px] font-black uppercase text-slate-400 italic">
              {user.className ? `Lớp ${user.className} • ` : ''}MSHS: {user.studentCode} | Khối {user.grade || '12'}
          </div>
        </div>

        {/* Thanh chuyển đổi nhanh trạng thái: Đang mở, Sắp làm, Đã làm, Luyện tập */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            <button
                onClick={() => setQuizStatusTab('all')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    quizStatusTab === 'all'
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-200'
                }`}
            >
                <span>Tất cả ({openTestQuizzes.length + upcomingTestQuizzes.length + practiceQuizzes.length})</span>
            </button>
            <button
                onClick={() => setQuizStatusTab('open')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${
                    quizStatusTab === 'open'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
            >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Đang mở ({openTestQuizzes.length})</span>
            </button>
            <button
                onClick={() => setQuizStatusTab('upcoming')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    quizStatusTab === 'upcoming'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
            >
                <Clock size={12} />
                <span>Sắp làm ({upcomingTestQuizzes.length})</span>
            </button>
            <button
                onClick={() => setQuizStatusTab('uncompleted')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    quizStatusTab === 'uncompleted'
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                        : uncompletedAssignedQuizzes.length > 0 
                            ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200' 
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-200'
                }`}
            >
                <AlertTriangle size={12} className={uncompletedAssignedQuizzes.length > 0 ? "text-rose-600" : ""} />
                <span>Chưa làm ({uncompletedAssignedQuizzes.length})</span>
            </button>
            <button
                onClick={() => {
                    const el = document.getElementById('student-results-history');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 group"
                title="Xem danh sách bài thi đã làm & kết quả chi tiết ở bảng bên dưới"
            >
                <CheckCircle2 size={12} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Đã làm ({results.length})</span>
            </button>
            <button
                onClick={() => setQuizStatusTab('practice')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    quizStatusTab === 'practice'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
            >
                <Zap size={12} />
                <span>Luyện tập ({practiceQuizzes.length})</span>
            </button>
            <button
                onClick={() => setQuizStatusTab('downloaded')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                    quizStatusTab === 'downloaded'
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                        : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                }`}
            >
                <HardDrive size={12} />
                <span>Đã tải về máy ({downloadedQuizzes.length})</span>
            </button>
        </div>
      </section>

      {isLoading && results.length === 0 && (
          <div className="py-20 text-center space-y-4">
              <Loader2 className="animate-spin text-blue-500 mx-auto" size={40}/>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Đang kết nối Cloud...</p>
          </div>
      )}

      {/* Bảng Vàng Vinh Danh Cá Nhân (Chỉ hiển thị khi chính em đó được vinh danh) */}
      {!isLoading && publishedResults.length > 0 && (
          <section className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6 px-4">
                  <Star className="text-yellow-500 fill-yellow-500" size={18}/>
                  <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-widest italic">Bảng Vàng Danh Dự Cá Nhân Của Bạn</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {publishedResults.map(pub => {
                      const userResultInPub = pub.results.find(r => r.studentCode?.toUpperCase() === user.studentCode?.toUpperCase()) || pub.results[0];
                      return (
                          <div key={pub.id} className="relative group overflow-hidden bg-slate-900 rounded-[2rem] p-5 shadow-xl border-2 border-yellow-500/20 hover:border-yellow-500 transition-all flex flex-col h-full">
                              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-yellow-500/20 transition-all"></div>
                              <div className="relative z-10 flex flex-col h-full space-y-3">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-yellow-500 text-slate-900 rounded-2xl flex items-center justify-center shadow-lg shrink-0"><Award size={22} /></div>
                                      <div className="flex-1 overflow-hidden">
                                          <p className="text-[8px] font-black text-yellow-500 uppercase tracking-widest truncate">{pub.quizTitle}</p>
                                          <p className="text-[9px] font-bold text-white/50 uppercase leading-none mt-0.5">{format(new Date(pub.publishedAt), 'dd/MM/yyyy')}</p>
                                      </div>
                                  </div>
                                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-sm flex-1 flex flex-col justify-between items-center text-center">
                                      <div className="flex flex-col items-center">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Điểm vinh danh</p>
                                          <div className="text-2xl font-black text-emerald-400 leading-none mb-1">{userResultInPub?.score.toFixed(1)}đ</div>
                                          <p className="text-[9px] font-bold text-white/70 mt-1">{user.fullName}</p>
                                      </div>
                                      <button onClick={() => setViewingHonorees(pub)} className="w-full mt-3 py-2 bg-yellow-500 text-slate-900 rounded-xl text-[9px] font-black uppercase hover:bg-white transition-all shadow-md flex items-center justify-center gap-1.5"><Award size={13}/> Xem chi tiết vinh danh</button>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`bg-white rounded-[2rem] p-6 sm:p-8 border shadow-sm flex items-center gap-5 transition-transform hover:scale-105 ${stats.uncompletedAssignedCount > 0 ? 'border-amber-300' : 'border-slate-200'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${stats.avgScore >= 8 ? 'bg-emerald-50 text-emerald-600' : stats.avgScore >= 5 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
              <Trophy size={28} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase">ĐTB Tổng kết</p>
              <h3 className={`text-2xl font-black ${stats.avgScore >= 8 ? 'text-emerald-600' : stats.avgScore >= 5 ? 'text-blue-600' : 'text-rose-600'}`}>
                {stats.avgScore.toFixed(2)}
              </h3>
              <span className="text-[9px] font-bold text-slate-400 block">
                {stats.uncompletedAssignedCount > 0 
                  ? `⚠️ Gồm ${stats.uncompletedAssignedCount} đề chưa nộp (0đ)` 
                  : '✨ Đã hoàn thành đủ 100% đề giao'}
              </span>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border shadow-sm flex items-center gap-5 transition-transform hover:scale-105">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><BookOpen size={28} /></div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase">Tiến độ bài giao</p>
              <h3 className="text-2xl font-black text-slate-800">
                {stats.completedAssignedCount}/{stats.totalAssignedCount} bài
              </h3>
              <span className="text-[9px] font-bold text-slate-400 block">
                ĐTB bài đã nộp: <strong className="text-indigo-600">{stats.avgSubmittedScore.toFixed(2)}đ</strong>
              </span>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border shadow-sm flex flex-col justify-between gap-3 transition-transform hover:scale-105">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                <CheckCircle2 size={28} />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[10px] font-black uppercase">Tiến độ câu hỏi</p>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {overallQuestionsStats.completed}/{overallQuestionsStats.total} <span className="text-xs font-bold text-slate-400">câu</span>
                </h3>
              </div>
            </div>
            <div className="w-full">
              <div className="flex justify-between items-center text-[9px] font-black uppercase mb-1.5">
                <span className="text-slate-400">Tỷ lệ hoàn thành</span>
                <span className="text-emerald-600 font-extrabold">{overallQuestionsStats.percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${overallQuestionsStats.percentage}%` }}
                />
              </div>
            </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border shadow-sm flex items-center gap-5 transition-transform hover:scale-105">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><Clock size={28} /></div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase">TG luyện tập & Tích lũy</p>
              <h3 className="text-xl font-black text-slate-800">{formatStudyTime(stats.totalSeconds)}</h3>
              <span className="text-[9px] font-black text-yellow-600 uppercase block">⭐ Tích lũy: {stats.accumulatedPoints.toFixed(2)}</span>
            </div>
        </div>
      </div>

      {/* Biểu đồ thống kê kết quả thi & Lịch sử điểm số với Recharts */}
      <section className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                  Biểu Đồ Thống Kê & Tiến Trình Điểm Số
                </h2>
                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 font-black text-[9px] rounded-full uppercase hidden sm:inline-flex items-center gap-1">
                  <Sparkles size={10} /> Recharts Analytics
                </span>
              </div>
              <p className="text-slate-400 font-medium text-xs mt-0.5">
                Lịch sử điểm số qua các lần thi, bài luyện tập và phân tích phong độ học tập
              </p>
            </div>
          </div>

          {/* Toggle Type + Filters */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Tab switch */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setChartType('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  chartType === 'timeline'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LineChartIcon size={13} />
                <span>Tiến trình điểm</span>
              </button>
              <button
                onClick={() => setChartType('distribution')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  chartType === 'distribution'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart2 size={13} />
                <span>Phổ điểm</span>
              </button>
            </div>

            {/* Scope filter */}
            <select
              value={chartScope}
              onChange={(e) => setChartScope(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="all">Tất cả bài ({results.length})</option>
              <option value="test">Chỉ đề kiểm tra</option>
              <option value="practice">Chỉ bài luyện tập</option>
            </select>

            {/* Limit filter (only for timeline) */}
            {chartType === 'timeline' && (
              <select
                value={chartLimit}
                onChange={(e) => setChartLimit(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10 bài gần nhất</option>
                <option value={15}>15 bài gần nhất</option>
                <option value={30}>30 bài gần nhất</option>
                <option value={0}>Tất cả lịch sử</option>
              </select>
            )}
          </div>
        </div>

        {/* Analytical Insight Cards */}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Trophy size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Điểm cao nhất</p>
                <p className="text-lg font-black text-emerald-600 leading-tight">
                  {performanceInsights.highest.toFixed(2)}
                  <span className="text-[10px] text-slate-400 font-normal"> /10</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Lần thi gần nhất</p>
                <p className="text-lg font-black text-blue-600 leading-tight">
                  {performanceInsights.latest.toFixed(2)}
                  <span className="text-[10px] text-slate-400 font-normal"> /10</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                performanceInsights.trendDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {performanceInsights.trendDiff >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Phong độ 3 bài gần đây</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-black text-slate-800 leading-tight">
                    {performanceInsights.recentAvg.toFixed(2)}
                  </p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                    performanceInsights.trendDiff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {performanceInsights.trendDiff >= 0 ? `+${performanceInsights.trendDiff.toFixed(2)}` : performanceInsights.trendDiff.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Target size={18} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Tỷ lệ Đạt / Giỏi</p>
                <p className="text-xs font-black text-slate-800 leading-tight mt-0.5">
                  Đạt: <span className="text-blue-600">{performanceInsights.passRate}%</span> • Giỏi: <span className="text-emerald-600">{performanceInsights.distinctionRate}%</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Chart Area */}
        <div className="relative z-10 w-full min-h-[300px] flex flex-col justify-center">
          {results.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <LineChartIcon size={24} />
              </div>
              <p className="text-sm font-black text-slate-700 uppercase">Chưa có dữ liệu bài thi</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hãy hoàn thành các bài kiểm tra hoặc bài luyện tập để hệ thống tự động vẽ biểu đồ phân tích tiến trình điểm số của bạn.
              </p>
            </div>
          ) : scoreHistoryData.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-600">Không có bài thi nào phù hợp với bộ lọc đã chọn.</p>
              <button
                onClick={() => setChartScope('all')}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-colors"
              >
                Xem tất cả
              </button>
            </div>
          ) : chartType === 'timeline' ? (
            <div className="w-full h-[320px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={scoreHistoryData}
                  margin={{ top: 20, right: 15, left: -15, bottom: 25 }}
                >
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
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 max-w-xs text-xs z-50">
                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${
                                data.quizType === 'practice' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {data.quizType === 'practice' ? '⚡ Luyện tập' : '📝 Đề thi'} • #{data.attemptNumber}
                              </span>
                              <span className="text-slate-400 text-[9px]">{data.date}</span>
                            </div>
                            <p className="font-bold text-slate-100 text-sm mb-2 line-clamp-2">{data.quizTitle}</p>
                            <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                              <div>
                                <p className="text-[8px] uppercase text-slate-400 font-bold">Điểm số</p>
                                <p className={`text-lg font-black ${
                                  data.score >= 8 ? 'text-emerald-400' : data.score >= 5 ? 'text-blue-400' : 'text-rose-400'
                                }`}>
                                  {data.score.toFixed(2)} <span className="text-[10px] text-slate-400">/ 10</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-[8px] uppercase text-slate-400 font-bold">Thời gian</p>
                                <p className="text-slate-200 font-bold text-xs mt-1">{data.durationMinutes} phút</p>
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
              <div className="flex flex-wrap items-center justify-center gap-6 mt-2 text-[10px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
                  <span>Điểm bài thi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-indigo-500 inline-block"></span>
                  <span>ĐTB chung ({stats.avgScore.toFixed(2)})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-500 border-dashed border-t inline-block"></span>
                  <span>Chuẩn Giỏi (8.0)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 border-dashed border-t inline-block"></span>
                  <span>Chuẩn Đạt (5.0)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-[320px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scoreDistributionData}
                  margin={{ top: 20, right: 15, left: -15, bottom: 25 }}
                >
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
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs z-50">
                            <p className="font-black uppercase tracking-wider text-[10px] text-slate-300 mb-1">
                              {data.name}
                            </p>
                            <p className="text-sm font-bold text-white">
                              Số lượng: <span className="text-emerald-400 text-base font-black">{data.count}</span> bài ({data.percentage}%)
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
              <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-[10px] font-bold">
                {scoreDistributionData.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-3 h-3 rounded-md inline-block" style={{ backgroundColor: item.color }}></span>
                    <span>{item.name}: <strong>{item.count}</strong> bài ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-12">
          {/* MỤC BÀI THI CHƯA HOÀN THÀNH - CHỈ HIỂN THỊ KHI Ở TAB "CHƯA LÀM" */}
          {quizStatusTab === 'uncompleted' && (
              <div className="mb-8">
                  <div className="flex items-center gap-4 mb-6 px-2">
                      <div className="flex items-center gap-2">
                          <AlertTriangle size={18} className="text-rose-500" />
                          <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Bài thi chưa hoàn thành (Giao riêng cho Lớp)</h2>
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 font-black text-[9px] rounded-full uppercase">
                              {uncompletedAssignedQuizzes.length} đề chưa làm • Tính 0.00đ vào ĐTB
                          </span>
                      </div>
                      <div className="h-px flex-1 bg-rose-100"></div>
                  </div>

                  {uncompletedAssignedQuizzes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {uncompletedAssignedQuizzes.map(q => {
                              const timing = getQuizTiming(q);
                              const isOpen = !timing.isExpired && timing.isStarted && !timing.isEnded && !timing.isFrozen;
                              const totalQuestions = q.questionCount || (q.questions ? q.questions.length : 0);

                              return (
                                  <div key={`uncomp_card_${q.id}`} className={`bg-white rounded-[1.5rem] border-2 p-6 flex flex-col transition-all shadow-md ${
                                      isOpen ? 'border-amber-400 hover:border-amber-500 shadow-amber-100' : 'border-rose-200'
                                  }`}>
                                      <div className="flex justify-between items-start mb-3">
                                          <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase flex items-center gap-1.5 ${
                                              isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                          }`}>
                                              {isOpen ? '⚡ ĐANG MỞ - CẦN LÀM NGAY' : '🔴 CHƯA NỘP (TÍNH 0.00Đ)'}
                                          </span>
                                          <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{q.durationMinutes} phút</span>
                                      </div>
                                      {q.category && <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 italic truncate">{q.category}</p>}
                                      <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-3 uppercase line-clamp-2 min-h-[2.5em]">{q.title}</h3>

                                      <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1.5 text-[9px] font-bold text-slate-600 border border-slate-100">
                                          <div className="flex items-center justify-between text-slate-500">
                                              <span>Số câu hỏi:</span>
                                              <span className="text-slate-800 font-extrabold">{totalQuestions} câu</span>
                                          </div>
                                          <div className="flex items-center justify-between text-slate-500">
                                              <span>Trạng thái nộp:</span>
                                              <span className="text-rose-600 font-black">Chưa có kết quả</span>
                                          </div>
                                      </div>

                                      <div className="mt-auto">
                                          {isOpen ? (
                                              <button
                                                  onClick={() => handleStartQuiz(q)}
                                                  className="w-full py-3 rounded-xl font-black uppercase text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                              >
                                                  <Zap size={13} /> Vào làm bài bổ sung ngay
                                              </button>
                                          ) : (
                                              <div className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-black uppercase text-[9px] text-center">
                                                  Quá hạn thi • Đang tính 0.00đ
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-500 text-xs font-bold space-y-2">
                          <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                          <p className="font-black uppercase text-slate-800 text-sm">Tuyệt vời!</p>
                          <p className="text-slate-400">Bạn đã hoàn thành 100% các đề thi được phân công cho lớp. Không có đề thi nào bị bỏ lỡ.</p>
                      </div>
                  )}
              </div>
          )}

          {/* 1. ĐỀ THI ĐANG MỜ (VÀO LÀM BÀI NGAY) */}
          {(quizStatusTab === 'all' || quizStatusTab === 'open') && (
              <div>
                  <div className="flex items-center gap-4 mb-6 px-2">
                      <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Đề thi đang mở (Làm bài chính thức)</h2>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[9px] rounded-full uppercase">
                              {openTestQuizzes.length} đề sẵn sàng
                          </span>
                      </div>
                      <div className="h-px flex-1 bg-emerald-100"></div>
                  </div>

                  {openTestQuizzes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {openTestQuizzes.map(q => {
                              const timing = getQuizTiming(q);
                              const latestAttempt = timing.myAttempts[0];
                              const totalQuestions = q.questionCount || (q.questions ? q.questions.length : (latestAttempt?.totalQuestions || 0));
                              const completedQuestions = latestAttempt ? (countCompletedQuestions(latestAttempt.userAnswers, totalQuestions) || (latestAttempt.score > 0 ? totalQuestions : 0)) : 0;

                              return (
                                  <div key={q.id} className="bg-white rounded-[1.5rem] border-2 border-blue-600 p-6 flex flex-col transition-all shadow-xl hover:shadow-2xl">
                                      <div className="flex justify-between items-start mb-3">
                                          <div className="px-2.5 py-1 rounded-xl text-[8px] font-black uppercase flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200">
                                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                              {timing.isFlexibleWindow ? 'ĐANG MỞ ĐỀ' : 'ĐANG TRONG GIỜ THI'}
                                          </div>
                                          <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{q.durationMinutes} phút</span>
                                      </div>
                                      {q.category && <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1 italic truncate">{q.category}</p>}
                                      <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-3 uppercase line-clamp-2 min-h-[2.5em]">{q.title}</h3>
                                      
                                      {timing.startX && (
                                          <div className="text-[10px] font-bold text-slate-600 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                                              {timing.isFlexibleWindow && timing.endY ? (
                                                  <>
                                                      <div className="flex items-center gap-1.5 text-blue-700 text-[9px]">
                                                          <Calendar size={12} className="shrink-0" />
                                                          <span>Khung mở: <strong>{format(timing.startX, 'HH:mm dd/MM')}</strong> → <strong>{format(timing.endY, 'HH:mm dd/MM')}</strong></span>
                                                      </div>
                                                      <div className="text-[8px] text-slate-500 font-medium pl-4">
                                                          ⚡ Tính đủ {q.durationMinutes} phút kể từ lúc vào làm bài.
                                                      </div>
                                                  </>
                                              ) : (
                                                  <div className="flex items-center gap-1.5 text-slate-800 text-[9px]">
                                                      <Calendar size={12} className="text-blue-600 shrink-0" />
                                                      <span>Giờ thi: <strong>{format(timing.startX, 'HH:mm - dd/MM/yyyy')}</strong></span>
                                                  </div>
                                              )}
                                          </div>
                                      )}

                                      <div className="mb-3.5">
                                          <QuizProgressIndicator
                                              completed={completedQuestions}
                                              total={totalQuestions}
                                              variant="card"
                                          />
                                      </div>

                                      <div className="bg-slate-50 rounded-xl p-2.5 grid grid-cols-2 gap-2 mb-4 text-center border border-slate-100">
                                          <div>
                                              <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Số lần làm</p>
                                              <p className="text-xs font-black text-slate-800">{timing.attemptCount} / {timing.maxAttempts}</p>
                                          </div>
                                          <div>
                                              <p className="text-[7px] font-black text-blue-500 uppercase mb-0.5">Điểm cao nhất</p>
                                              <p className="text-xs font-black text-blue-600">{timing.bestScore !== null ? `${timing.bestScore.toFixed(1)}đ` : '-'}</p>
                                          </div>
                                      </div>

                                      <div className="mt-auto space-y-2">
                                          <button 
                                              onClick={() => handleStartQuiz(q)} 
                                              className="w-full py-3 rounded-xl font-black uppercase text-[9px] bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                          >
                                              <Zap size={13}/> Vào làm bài ({timing.attemptCount === 0 ? `Lần 1/${timing.maxAttempts}` : `Lần ${timing.attemptCount + 1}/${timing.maxAttempts}`})
                                          </button>

                                          {timing.attemptCount > 0 && (
                                              <button 
                                                  onClick={() => {
                                                      const res = timing.myAttempts[0];
                                                      if (res) handleViewResult(res);
                                                  }} 
                                                  className="w-full py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-black uppercase text-[8px] flex items-center justify-center gap-1.5 transition-colors"
                                              >
                                                  <Eye size={11}/> Xem lại bài đã nộp ({timing.myAttempts[0].score.toFixed(1)}đ)
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  ) : (
                      quizStatusTab === 'open' && (
                          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-bold">
                              Hiện tại không có đề thi nào trong khung giờ mở làm bài. Bạn có thể xem lịch ở tab "Sắp làm" hoặc ôn luyện tại tab "Luyện tập".
                          </div>
                      )
                  )}
              </div>
          )}

          {/* 2. ĐỀ THI SẮP LÀM (CHỜ ĐẾN GIỜ MỞ ĐỀ) */}
          {(quizStatusTab === 'all' || quizStatusTab === 'upcoming') && upcomingTestQuizzes.length > 0 && (
              <div>
                  <div className="flex items-center gap-4 mb-6 px-2">
                      <div className="flex items-center gap-2">
                          <Clock size={16} className="text-amber-500"/>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Đề thi sắp diễn ra (Lịch thi sắp tới)</h2>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black text-[9px] rounded-full uppercase">
                              {upcomingTestQuizzes.length} đề chờ giờ
                          </span>
                      </div>
                      <div className="h-px flex-1 bg-amber-100"></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {upcomingTestQuizzes.map(q => {
                          const timing = getQuizTiming(q);
                          const totalQuestions = q.questionCount || (q.questions ? q.questions.length : 0);

                          return (
                              <div key={q.id} className="bg-white rounded-[1.5rem] border border-amber-200 p-6 flex flex-col transition-all border-b-4 border-b-amber-400 shadow-sm">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="px-2.5 py-1 rounded-xl text-[8px] font-black uppercase flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200">
                                          <Clock size={10} className="text-amber-600"/>
                                          CHỜ GIỜ MỞ ĐỀ
                                      </div>
                                      <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{q.durationMinutes} phút</span>
                                  </div>
                                  {q.category && <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mb-1 italic truncate">{q.category}</p>}
                                  <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-3 uppercase line-clamp-2 min-h-[2.5em]">{q.title}</h3>

                                  {timing.startX && (
                                      <div className="text-[10px] font-bold text-amber-900 mb-4 bg-amber-50/70 p-3 rounded-2xl border border-amber-200 space-y-1">
                                          <div className="flex items-center gap-1.5 text-[10px]">
                                              <Calendar size={13} className="text-amber-600 shrink-0" />
                                              <span>Mở đề lúc: <strong>{format(timing.startX, 'HH:mm - dd/MM/yyyy')}</strong></span>
                                          </div>
                                          {timing.isFlexibleWindow && timing.endY && (
                                              <div className="text-[8px] text-amber-700 pl-4.5">
                                                  Hạn chót vào thi: {format(timing.endY, 'HH:mm dd/MM')}
                                              </div>
                                          )}
                                      </div>
                                  )}

                                  <div className="bg-slate-50 rounded-xl p-2.5 grid grid-cols-2 gap-2 mb-4 text-center border border-slate-100">
                                      <div>
                                          <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Số câu hỏi</p>
                                          <p className="text-xs font-black text-slate-800">{totalQuestions} câu</p>
                                      </div>
                                      <div>
                                          <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Tối đa lượt</p>
                                          <p className="text-xs font-black text-slate-800">{timing.maxAttempts} lần</p>
                                      </div>
                                  </div>

                                  <div className="mt-auto">
                                      <button 
                                          disabled={true} 
                                          className="w-full py-2.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl font-black uppercase text-[8px] cursor-not-allowed flex items-center justify-center gap-1.5"
                                          title={`Đề thi sẽ mở vào lúc ${timing.startX ? format(timing.startX, 'HH:mm dd/MM/yyyy') : 'sớm nhất'}`}
                                      >
                                          <Clock size={11}/> Chưa đến giờ mở đề
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}


          {/* 4. KHO ĐỀ LUYỆN TẬP (ÔN TẬP TỰ DO) */}
          {(quizStatusTab === 'all' || quizStatusTab === 'practice') && practiceQuizzes.length > 0 && (
              <div>
                  <div className="flex items-center gap-4 mb-6 px-2">
                      <div className="flex items-center gap-2">
                          <Zap size={16} className="text-purple-600"/>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Kho đề luyện tập (Ôn tập tự do)</h2>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 font-black text-[9px] rounded-full uppercase">
                              {practiceQuizzes.length} đề tự luyện
                          </span>
                      </div>
                      <div className="h-px flex-1 bg-purple-100"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {practiceQuizzes.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)).map(q => {
                        const status = getQuizStatus(q);
                        const qStats = (qid: string) => {
                          const attempts = results.filter(r => r.quizId === qid);
                          if (attempts.length === 0) return null;
                          return { count: attempts.length, max: Math.max(...attempts.map(r => r.score)) };
                        };
                        const qs = qStats(q.id);

                        const pAttempts = results.filter(r => r.quizId === q.id).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                        const latestPAttempt = pAttempts[0];
                        const pTotalQuestions = q.questionCount || (q.questions ? q.questions.length : (latestPAttempt?.totalQuestions || 0));
                        const pCompletedQuestions = latestPAttempt ? (countCompletedQuestions(latestPAttempt.userAnswers, pTotalQuestions) || (latestPAttempt.score > 0 ? pTotalQuestions : 0)) : 0;

                        return (
                          <div key={q.id} className={`bg-white rounded-[1.5rem] border border-slate-200 p-6 flex flex-col transition-all border-b-4 ${status.isLocked ? 'opacity-75 grayscale' : 'hover:shadow-xl hover:-translate-y-1 group hover:border-b-purple-500'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl font-black text-[8px] uppercase flex items-center gap-1">
                                <Zap size={10}/> {q.questionCount || (q.questions ? q.questions.length : 0)} câu
                              </div>
                              <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{q.grade === 'all' ? 'Chung' : `Khối ${q.grade}`}</span>
                            </div>
                            {q.category && <p className="text-[8px] font-black text-purple-600 uppercase tracking-widest mb-1 italic truncate">{q.category}</p>}
                            <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-4 group-hover:text-purple-600 uppercase flex items-center gap-2 line-clamp-2 min-h-[2.5em]">
                                {status.isLocked && <Lock size={14} className="text-slate-400 shrink-0"/>}
                                {q.title}
                            </h3>
                            
                            {status.isLocked ? (
                                <div className="mt-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Đang khóa</p>
                                    <p className="text-[9px] font-bold text-slate-600 leading-tight">{status.reason}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-purple-50/40 rounded-xl p-3 grid grid-cols-2 gap-2 mb-3 text-center border border-purple-100/60">
                                        <div><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Lượt luyện</p><p className="text-xs font-black text-slate-700">{qs?.count || 0}</p></div>
                                        <div><p className="text-[7px] font-black text-purple-600 uppercase mb-0.5">Điểm Max</p><p className="text-xs font-black text-purple-700">{qs ? qs.max.toFixed(1) : '-'}</p></div>
                                    </div>

                                    <div className="mb-4">
                                        <QuizProgressIndicator
                                            completed={pCompletedQuestions}
                                            total={pTotalQuestions}
                                            variant="card"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                      <button onClick={() => handleStartPractice(q)} className="flex items-center justify-center gap-1.5 bg-slate-900 text-white py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-black transition-all shadow-md active:scale-95">
                                        <Zap size={12}/> Luyện tập
                                      </button>
                                      <button 
                                        disabled={true} 
                                        title="Đề luyện tập: Chỉ mở chế độ ôn luyện từng câu, không tính vào bài thi chính thức" 
                                        className="flex items-center justify-center gap-1.5 bg-slate-100 border border-dashed border-slate-300 text-slate-400 py-2.5 rounded-xl text-[9px] font-bold uppercase cursor-not-allowed opacity-40"
                                      >
                                        <Lock size={10}/> Khóa Thi
                                      </button>
                                    </div>
                                </>
                            )}
                          </div>
                        );
                    })}
                  </div>
              </div>
          )}

          {/* 5. ĐỀ THI ĐÃ TẢI VỀ MẤY (LÀM NGOẠI TUYẾN 100%) */}
          {(quizStatusTab === 'downloaded' || (quizStatusTab === 'all' && downloadedQuizzes.length > 0)) && (
              <div>
                  <div className="flex items-center gap-4 mb-6 px-2">
                      <div className="flex items-center gap-2">
                          <HardDrive size={16} className="text-teal-600"/>
                          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Đề thi đã tải về máy (Sẵn sàng Offline 100%)</h2>
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 font-black text-[9px] rounded-full uppercase">
                              {downloadedQuizzes.length} đề offline
                          </span>
                      </div>
                      <div className="h-px flex-1 bg-teal-100"></div>
                  </div>

                  {downloadedQuizzes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {downloadedQuizzes.map(q => {
                            const totalQuestions = q.questionCount || (q.questions ? q.questions.length : 0);

                            return (
                                <div key={q.id} className="bg-white rounded-[1.5rem] border-2 border-teal-500 p-6 flex flex-col transition-all shadow-lg hover:shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-teal-500 text-white text-[7px] font-black uppercase px-3 py-1 rounded-bl-xl flex items-center gap-1">
                                        <CloudCheck size={10} /> OFFLINE READY
                                    </div>
                                    <div className="flex justify-between items-start mb-3 pt-1">
                                        <span className="text-[9px] font-black text-teal-700 uppercase bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">{q.durationMinutes} phút</span>
                                        <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{totalQuestions} câu</span>
                                    </div>
                                    {q.category && <p className="text-[8px] font-black text-teal-600 uppercase tracking-widest mb-1 italic truncate">{q.category}</p>}
                                    <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-4 uppercase line-clamp-2 min-h-[2.5em]">{q.title}</h3>

                                    <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-100 mb-4 text-[9px] font-bold text-teal-900 space-y-1">
                                        <div className="flex items-center gap-1.5 text-teal-700">
                                            <WifiOff size={12} className="shrink-0" />
                                            <span>Làm bài không cần kết nối Internet</span>
                                        </div>
                                        <div className="text-[8px] text-teal-600 font-medium pl-4">
                                            ⚡ Tự động nạp kết quả khi có mạng trở lại.
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-2">
                                        <button
                                            onClick={() => handleStartQuiz(q)}
                                            className="w-full py-3 rounded-xl font-black uppercase text-[9px] bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                        >
                                            <Zap size={13} /> Làm bài ngay (Offline)
                                        </button>
                                        <button
                                            onClick={() => handleDeleteOfflineQuiz(q.id)}
                                            className="w-full py-2 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 font-black uppercase text-[8px] flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Trash2 size={11} /> Xóa khỏi máy
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-bold">
                        Chưa có đề thi nào được tải về máy. Bạn có thể nhấn nút Tải về máy trên bất kỳ thẻ đề thi nào để sẵn sàng làm bài ngoại tuyến!
                    </div>
                  )}
              </div>
          )}
      </section>

      {/* Khi không có đề thi nào trong mục đã chọn */}
      {openTestQuizzes.length === 0 && upcomingTestQuizzes.length === 0 && practiceQuizzes.length === 0 && (
          <div className="bg-white rounded-[2rem] border border-slate-200 p-10 text-center shadow-sm">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
                  <FileText size={24} />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Không có đề thi nào trong danh mục này</h3>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto mt-1">
                  Hiện tại không có đề thi phù hợp với bộ lọc. Hãy chuyển tab "Tất cả" hoặc kiểm tra lại niên khóa và chương học.
              </p>
          </div>
      )}

      {/* Danh sách các đề đã làm & Lịch sử nộp bài (Bao gồm các đề đã hết hạn mở) */}
      <section id="student-results-history" className="pt-10 scroll-mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner shrink-0">
                      <History size={20} />
                  </div>
                  <div>
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                          Danh sách các đề đã làm & Lịch sử nộp bài
                          {results.length > 0 && (
                              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-black text-[9px] rounded-full uppercase">
                                  {results.length} bài
                              </span>
                          )}
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Tất cả các đề đã hoàn thành (bao gồm đề đã hết hạn mở đề) và kết quả chi tiết
                      </p>
                  </div>
              </div>

              {/* Bộ lọc trạng thái đề đã làm */}
              {results.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start md:self-auto">
                      <button
                          onClick={() => setResultsFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                              resultsFilter === 'all'
                                  ? 'bg-white text-slate-800 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                          Tất cả ({enrichedResults.length})
                      </button>
                      <button
                          onClick={() => setResultsFilter('expired')}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
                              resultsFilter === 'expired'
                                  ? 'bg-white text-slate-800 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                          <Lock size={10} className="text-slate-400" />
                          Đã hết hạn ({expiredResultsCount})
                      </button>
                      <button
                          onClick={() => setResultsFilter('active')}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
                              resultsFilter === 'active'
                                  ? 'bg-white text-slate-800 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                          <Zap size={10} className="text-emerald-500" />
                          Đang mở ({activeResultsCount})
                      </button>
                  </div>
              )}
          </div>

          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                  <thead>
                      <tr className="bg-slate-50 border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <th className="p-6">Tên đề thi & Trạng thái</th>
                          <th className="p-6 text-center">Phân loại</th>
                          <th className="p-6 text-center">Tiến độ câu hỏi</th>
                          <th className="p-6 text-center">Thời điểm nộp</th>
                          <th className="p-6 text-center">Kết quả</th>
                          <th className="p-6 text-center">Hành động</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y">
                      {filteredResults.slice(0, resultsDisplayCount).map((r) => {
                          const quiz = r.quiz;
                          const displayTitle = r.quizTitle || quiz?.title || 'Đề thi đã nộp';
                          const displayCategory = r.quizCategory || quiz?.category || '';
                          const displayType = r.quizType || quiz?.type || 'test';
                          const rowTotal = r.totalQuestions || quiz?.questionCount || 0;
                          const rowCompleted = countCompletedQuestions(r.userAnswers, rowTotal) || (r.score > 0 ? rowTotal : 0);
                          return (
                              <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                                  <td className="p-6">
                                      <div className="space-y-1.5 max-w-md">
                                          <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-black text-slate-800 uppercase text-xs leading-snug">
                                                  {displayTitle}
                                              </span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                              {/* Huy hiệu tình trạng hết hạn của đề */}
                                              {r.isExpired ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-md text-[8px] font-black uppercase">
                                                      <Lock size={9} className="text-slate-400" /> Đã hết hạn mở
                                                  </span>
                                              ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[8px] font-black uppercase">
                                                      <Zap size={9} className="text-emerald-500" /> Đang mở
                                                  </span>
                                              )}

                                              {/* Lần làm bài nếu có nhiều lần */}
                                              {r.hasMultipleAttempts && (
                                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[8px] font-black uppercase shrink-0">
                                                      Lần {r.attemptNumber}/{r.maxAttempts}
                                                  </span>
                                              )}

                                              {displayCategory && (
                                                  <span className="text-[9px] text-slate-400 font-medium truncate max-w-[200px]">
                                                      • {displayCategory}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  </td>
                                  <td className="p-6 text-center">
                                      <span className={`inline-block px-2.5 py-1 rounded-xl text-[8px] font-black uppercase border ${
                                          displayType === 'test' 
                                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                              : 'bg-amber-50 text-amber-700 border-amber-200'
                                      }`}>
                                          {displayType === 'test' ? 'Bài thi bắt buộc' : 'Luyện tập tự do'}
                                      </span>
                                  </td>
                                  <td className="p-6 text-center">
                                      <QuizProgressIndicator
                                          completed={rowCompleted}
                                          total={rowTotal}
                                          variant="table"
                                      />
                                  </td>
                                  <td className="p-6 text-center">
                                      <p className="text-xs font-bold text-slate-700">
                                          {format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}
                                      </p>
                                      {r.durationSeconds ? (
                                          <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                              Làm trong {Math.floor(r.durationSeconds / 60)} phút {r.durationSeconds % 60}s
                                          </p>
                                      ) : null}
                                  </td>
                                  <td className="p-6 text-center">
                                      <span className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1 rounded-xl text-sm font-black border ${
                                          r.score >= 8 
                                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                              : r.score >= 5 
                                              ? 'text-blue-700 bg-blue-50 border-blue-200' 
                                              : 'text-orange-700 bg-orange-50 border-orange-200'
                                      }`}>
                                          {r.score.toFixed(2)}đ
                                      </span>
                                  </td>
                                  <td className="p-6 text-center">
                                      <button 
                                          onClick={() => handleViewResult(r)} 
                                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                                          title="Xem lại bài thi đã nộp, đáp án và lời giải"
                                      >
                                          <Eye size={12}/> Xem lại <ChevronRight size={12}/>
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>

              {filteredResults.length === 0 && (
                  <div className="p-16 text-center text-slate-400 font-black uppercase text-[10px] italic">
                      {results.length === 0 ? 'Bạn chưa thực hiện bài thi nào' : 'Không có bài làm nào trong mục này'}
                  </div>
              )}

              {/* Điều khiển phân trang / mở rộng danh sách */}
              {filteredResults.length > 15 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-500">
                      <span>
                          Đang hiển thị {Math.min(resultsDisplayCount, filteredResults.length)} / {filteredResults.length} bài
                      </span>
                      <div className="flex items-center gap-2">
                          {filteredResults.length > resultsDisplayCount && (
                              <>
                                  <button
                                      onClick={() => setResultsDisplayCount(prev => prev + 15)}
                                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                                  >
                                      Xem thêm (+15)
                                  </button>
                                  <button
                                      onClick={() => setResultsDisplayCount(filteredResults.length)}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-blue-700 transition-colors shadow-sm"
                                  >
                                      Xem tất cả ({filteredResults.length})
                                  </button>
                              </>
                          )}
                          {resultsDisplayCount > 15 && (
                              <button
                                  onClick={() => setResultsDisplayCount(15)}
                                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-500 hover:text-slate-800 transition-colors"
                              >
                                  Thu gọn
                              </button>
                          )}
                      </div>
                  </div>
              )}
          </div>
      </section>

      {selectedResult && <ResultDetailModal isOpen={true} result={selectedResult.result} quiz={selectedResult.quiz} onClose={() => setSelectedResult(null)} />}
      {previewQuiz && <QuizPreviewModal quiz={previewQuiz} isAdmin={false} onClose={() => setPreviewQuiz(null)} />}
      {viewingHonorees && (
          <div className="fixed inset-0 bg-slate-900/95 z-[3000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
              <div className="bg-white rounded-[3.5rem] w-full max-w-lg flex flex-col overflow-hidden shadow-2xl border-4 border-yellow-400">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-yellow-500 text-slate-900 rounded-2xl shadow-lg"><Trophy size={24}/></div>
                          <div>
                              <h3 className="text-lg font-black uppercase tracking-tight italic">Bảng Vàng Danh Dự Cá Nhân</h3>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-none">{viewingHonorees.quizTitle}</p>
                          </div>
                      </div>
                      <button onClick={() => setViewingHonorees(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                  </div>
                  <div className="p-8 space-y-5 bg-slate-50 text-center">
                      <div className="inline-flex p-4 bg-yellow-100 text-yellow-600 rounded-full shadow-inner animate-bounce">
                          <Award size={48} />
                      </div>
                      <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-yellow-600 mb-1">CHỨC MỪNG THÀNH TÍCH XUẤT SẮC</p>
                          <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{user.fullName}</h4>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                              MSHS: {user.studentCode} {user.className ? `• Lớp ${user.className}` : ''} • Khối {user.grade}
                          </p>
                      </div>

                      <div className="py-5 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xs mx-auto">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ĐIỂM SỐ VINH DANH</p>
                          <p className="text-4xl font-black text-emerald-500 mt-1">
                              {(viewingHonorees.results.find(r => r.studentCode?.toUpperCase() === user.studentCode?.toUpperCase())?.score ?? viewingHonorees.results[0]?.score ?? 0).toFixed(2)}đ
                          </p>
                      </div>

                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                          Vinh danh vào ngày {format(new Date(viewingHonorees.publishedAt), 'HH:mm dd/MM/yyyy')}
                      </p>

                      <button
                          onClick={() => setViewingHonorees(null)}
                          className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black transition-all shadow-md active:scale-95"
                      >
                          Đóng
                      </button>
                  </div>
              </div>
          </div>
      )}
      {/* Session Warning Modal */}
      {sessionWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className={`p-6 text-white ${sessionWarning.type === 'different_quiz' ? 'bg-red-500' : 'bg-amber-500'}`}>
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className="w-8 h-8" />
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {sessionWarning.type === 'different_quiz' ? 'Cảnh báo bảo mật' : 'Thông báo phiên làm bài'}
                </h3>
              </div>
              <p className="text-white/90 text-sm font-bold">
                {sessionWarning.type === 'different_quiz' 
                  ? 'Phát hiện nhiều phiên làm bài đồng thời' 
                  : 'Phát hiện phiên làm bài trên thiết bị khác'}
              </p>
            </div>
            
            <div className="p-8">
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Đề thi đang hoạt động:</p>
                <p className="text-slate-700 font-black text-lg leading-tight">{sessionWarning.quizTitle}</p>
              </div>

              <div className="space-y-4 text-slate-600 text-sm leading-relaxed">
                {sessionWarning.type === 'different_quiz' ? (
                  <p>
                    Hệ đồng nhận thấy bạn đang làm bài thi <span className="font-bold text-slate-900">"{sessionWarning.quizTitle}"</span>. 
                    Để đảm bảo tính công bằng, bạn <span className="font-bold text-red-600 underline">không thể</span> bắt đầu một đề thi mới khi chưa hoàn thành đề thi hiện tại.
                  </p>
                ) : (
                  <p>
                    Bạn đang có một phiên làm bài cho đề này trên thiết bị hoặc trình duyệt khác. 
                    Nếu tiếp tục, dữ liệu chưa nộp ở máy kia <span className="font-bold text-amber-600">sẽ bị mất</span>. Bạn có chắc chắn muốn bắt đầu lại trên máy này?
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={sessionWarning.onConfirm}
                  className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                    sessionWarning.type === 'different_quiz' ? 'bg-red-500 hover:bg-red-600 shadow-red-100' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                  }`}
                >
                  {sessionWarning.type === 'different_quiz' ? 'Kết thúc đề cũ & Bắt đầu đề mới' : 'Tiếp tục (Bắt đầu mới)'}
                </button>
                <button
                  onClick={sessionWarning.onCancel}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
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
