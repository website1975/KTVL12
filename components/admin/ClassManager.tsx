import React, { useState, useMemo } from 'react';
import { ClassRoom, User, Grade, Quiz, Result, Chapter } from '../../types';
import { 
  GraduationCap, Plus, Search, Edit3, Trash2, Users, Calendar, 
  ArrowRight, CheckSquare, Square, UserPlus, UserMinus,
  Check, ChevronRight, X, ArrowUpRight, BarChart3, Award,
  Clock, TrendingUp, AlertCircle, Copy, CheckCheck, BookOpen, 
  Star, Filter, ArrowLeft, Lightbulb, CheckCircle2, XCircle,
  BarChart2, LineChart as LineChartIcon, Sparkles, Trophy
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
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

interface ClassManagerProps {
  classes: ClassRoom[];
  students: User[];
  quizzes?: Quiz[];
  results?: Result[];
  chapters?: Chapter[];
  onSaveClass: (c: ClassRoom) => Promise<void>;
  onDeleteClass: (id: string, name: string) => Promise<void>;
  onAssignStudents: (studentIds: string[], classInfo: { classId?: string; className?: string; academicYear?: string; grade?: Grade } | null) => Promise<void>;
  onRefresh: () => void;
}

type ClassDetailTab = 'students' | 'stats' | 'progress';

export default function ClassManager({
  classes,
  students,
  quizzes = [],
  results = [],
  chapters = [],
  onSaveClass,
  onDeleteClass,
  onAssignStudents
}: ClassManagerProps) {
  // Main view state
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const [activeTab, setActiveTab] = useState<ClassDetailTab>('students');

  // Filters for Class Cards
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<Grade | 'all'>('all');

  // Class Modals (Create / Edit)
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [classForm, setClassForm] = useState<{
    name: string;
    academicYear: string;
    grade: Grade;
    description: string;
  }>({
    name: '',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    grade: '12',
    description: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Tab 1: Member state & Modals
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIdsToAdd, setSelectedStudentIdsToAdd] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Batch Promote / Transfer Modal
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [promoteTargetClassId, setPromoteTargetClassId] = useState<string>('');
  const [selectedStudentIdsToPromote, setSelectedStudentIdsToPromote] = useState<string[]>([]);

  // Tab 2: Quiz Stats state
  const [statsChapterFilter, setStatsChapterFilter] = useState<string>('all');
  const [statsQuizSearch, setStatsQuizSearch] = useState<string>('');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [participationView, setParticipationView] = useState<'submitted' | 'unsubmitted'>('submitted');
  const [copiedUnsubmitted, setCopiedUnsubmitted] = useState(false);

  // Tab 3: Progress & Evaluation state
  const [progressSearch, setProgressSearch] = useState<string>('');
  const [inspectingStudent, setInspectingStudent] = useState<User | null>(null);
  const [inspectingChartType, setInspectingChartType] = useState<'timeline' | 'distribution'>('timeline');
  const [classProgressChartType, setClassProgressChartType] = useState<'timeline' | 'distribution'>('timeline');
  const [classProgressChartScope, setClassProgressChartScope] = useState<'all' | 'test' | 'practice'>('all');
  const [classProgressChartLimit, setClassProgressChartLimit] = useState<number>(15);
  const [selectedStudentForComparison, setSelectedStudentForComparison] = useState<string>('all');

  // Unique academic years
  const academicYears = useMemo(() => {
    const years = new Set<string>();
    classes.forEach(c => {
      if (c.academicYear) years.add(c.academicYear.trim());
    });
    const currentYear = new Date().getFullYear();
    years.add(`${currentYear}-${currentYear + 1}`);
    years.add(`${currentYear + 1}-${currentYear + 2}`);
    return Array.from(years).sort().reverse();
  }, [classes]);

  // Filtered classes for cards view
  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchYear = selectedYear === 'all' || c.academicYear === selectedYear;
      const matchGrade = selectedGrade === 'all' || c.grade === selectedGrade;
      return matchSearch && matchYear && matchGrade;
    }).sort((a, b) => {
      if (b.academicYear !== a.academicYear) return b.academicYear.localeCompare(a.academicYear);
      if (b.grade !== a.grade) return b.grade.localeCompare(a.grade);
      return a.name.localeCompare(b.name);
    });
  }, [classes, searchQuery, selectedYear, selectedGrade]);

  // Count unassigned students
  const unassignedStudentsCount = useMemo(() => {
    return students.filter(s => !s.classId && !s.className).length;
  }, [students]);

  // Students belonging to the currently selected class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => 
      s.classId === selectedClass.id || 
      (s.className === selectedClass.name && s.academicYear === selectedClass.academicYear)
    );
  }, [students, selectedClass]);

  // Filtered students for Tab 1
  const filteredClassStudents = useMemo(() => {
    return classStudents.filter(s => {
      if (!memberSearch.trim()) return true;
      const q = memberSearch.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || 
             (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
             s.username.toLowerCase().includes(q);
    });
  }, [classStudents, memberSearch]);

  // Quizzes assigned to the selected class (Explicitly assigned OR grade-wide assigned)
  const classAssignedQuizzes = useMemo(() => {
    if (!selectedClass) return [];
    return quizzes.filter(q => {
      const matchGrade = q.grade === selectedClass.grade || q.grade === 'all';
      if (!matchGrade) return false;
      
      // Class targeting rule:
      if (q.targetType === 'classes') {
        return q.assignedClassIds && q.assignedClassIds.includes(selectedClass.id);
      }
      return true; // Default target 'all' for this grade
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [quizzes, selectedClass]);

  // Quizzes filtered for Tab 2 dropdown
  const filteredClassQuizzes = useMemo(() => {
    return classAssignedQuizzes.filter(q => {
      const matchChapter = statsChapterFilter === 'all' || q.category === statsChapterFilter;
      const matchSearch = !statsQuizSearch.trim() || q.title.toLowerCase().includes(statsQuizSearch.toLowerCase());
      return matchChapter && matchSearch;
    });
  }, [classAssignedQuizzes, statsChapterFilter, statsQuizSearch]);

  // Set default selected quiz when entering Tab 2 or changing class
  const currentQuiz = useMemo(() => {
    if (filteredClassQuizzes.length === 0) return null;
    if (selectedQuizId) {
      const found = filteredClassQuizzes.find(q => q.id === selectedQuizId);
      if (found) return found;
    }
    return filteredClassQuizzes[0];
  }, [filteredClassQuizzes, selectedQuizId]);

  // Tab 2: Detailed Quiz Performance based on FIRST ATTEMPT (Lần 1)
  const quizAttemptStats = useMemo(() => {
    if (!currentQuiz || !selectedClass) {
      return {
        submittedStudents: [],
        unsubmittedStudents: [],
        scoreTiers: { gio: 0, kha: 0, dat: 0, chuaDat: 0 },
        tierPercentages: { gio: 0, kha: 0, dat: 0, chuaDat: 0 },
        top5: [],
        avgFirstScore: 0,
        highestFirstScore: 0,
        lowestFirstScore: 0
      };
    }

    const quizResults = results.filter(r => r.quizId === currentQuiz.id);
    const submittedList: Array<{
      student: User;
      firstAttempt: Result;
      bestScore: number;
      totalAttempts: number;
    }> = [];
    const unsubmittedList: User[] = [];

    classStudents.forEach(student => {
      const studentResults = quizResults.filter(r => 
        r.studentId === student.id || 
        (student.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === student.studentCode.trim().toUpperCase())
      );

      if (studentResults.length > 0) {
        // Sort by date ascending to get FIRST attempt
        const sorted = [...studentResults].sort((a, b) => 
          new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
        );
        const firstAttempt = sorted[0];
        const bestScore = studentResults.reduce((max, r) => Math.max(max, r.score), 0);

        submittedList.push({
          student,
          firstAttempt,
          bestScore,
          totalAttempts: studentResults.length
        });
      } else {
        unsubmittedList.push(student);
      }
    });

    // Calculate score tiers on FIRST attempt
    let gio = 0, kha = 0, dat = 0, chuaDat = 0;
    let totalScore = 0;
    let highest = 0;
    let lowest = submittedList.length > 0 ? 10 : 0;

    submittedList.forEach(item => {
      const score = item.firstAttempt.score;
      totalScore += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;

      if (score >= 8.0) gio++;
      else if (score >= 7.0) kha++;
      else if (score >= 5.0) dat++;
      else chuaDat++;
    });

    const totalSub = submittedList.length;
    const tierPercentages = {
      gio: totalSub > 0 ? (gio / totalSub) * 100 : 0,
      kha: totalSub > 0 ? (kha / totalSub) * 100 : 0,
      dat: totalSub > 0 ? (dat / totalSub) * 100 : 0,
      chuaDat: totalSub > 0 ? (chuaDat / totalSub) * 100 : 0
    };

    // Sort submittedList by first attempt score desc, then duration asc to get TOP 5
    const sortedForTop5 = [...submittedList].sort((a, b) => {
      if (b.firstAttempt.score !== a.firstAttempt.score) {
        return b.firstAttempt.score - a.firstAttempt.score;
      }
      return (a.firstAttempt.durationSeconds || 0) - (b.firstAttempt.durationSeconds || 0);
    });

    return {
      submittedStudents: submittedList,
      unsubmittedStudents: unsubmittedList,
      scoreTiers: { gio, kha, dat, chuaDat },
      tierPercentages,
      top5: sortedForTop5.slice(0, 5),
      avgFirstScore: totalSub > 0 ? totalScore / totalSub : 0,
      highestFirstScore: highest,
      lowestFirstScore: totalSub > 0 ? lowest : 0
    };
  }, [currentQuiz, selectedClass, classStudents, results]);

  // Tab 3: Helper to calculate student progress statistics & automated feedback
  const getStudentTrainingData = (student: User) => {
    const studentResults = results.filter(r => 
      r.studentId === student.id || 
      (student.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === student.studentCode.trim().toUpperCase())
    );

    const totalSeconds = studentResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
    const effortPoints = totalSeconds / 2700; // 45 mins = 1 effort point

    const bonusPoints = studentResults.reduce((acc, r) => {
      const bp = (r as any).bonusPoint;
      if (bp !== undefined && bp !== null) return acc + Number(bp);
      if (r.score >= 8) return acc + 1;
      return acc;
    }, 0);

    const accumulatedPoints = effortPoints + bonusPoints;

    // Completed quizzes vs Assigned quizzes
    const completedQuizIds = new Set(studentResults.map(r => r.quizId));
    const completedQuizzesCount = classAssignedQuizzes.filter(q => completedQuizIds.has(q.id)).length;
    const totalAssignedCount = classAssignedQuizzes.length;
    const completionRate = totalAssignedCount > 0 ? (completedQuizzesCount / totalAssignedCount) * 100 : 0;
    const uncompletedQuizzes = classAssignedQuizzes.filter(q => !completedQuizIds.has(q.id));
    const uncompletedCount = uncompletedQuizzes.length;

    // Điểm cao nhất của từng đề đã nộp
    const quizScoreMap = new Map<string, number>();
    studentResults.forEach(r => {
      const cur = quizScoreMap.get(r.quizId) ?? 0;
      if (r.score > cur) quizScoreMap.set(r.quizId, r.score);
    });

    const sumSubmittedScores = Array.from(quizScoreMap.values()).reduce((a, b) => a + b, 0);

    // ĐTB thực tế các bài đã làm
    const avgSubmittedScore = quizScoreMap.size > 0 
      ? sumSubmittedScores / quizScoreMap.size 
      : 0;

    // ĐTB TỔNG KẾT (Quy tắc công bằng: Các đề được giao nhưng KHÔNG LÀM sẽ tính 0.00 điểm)
    // ĐTB Tổng kết = (Tổng điểm các đề đã nộp + 0 * Số đề chưa làm) / Tổng số đề được giao
    const finalOfficialScore = totalAssignedCount > 0 
      ? sumSubmittedScores / totalAssignedCount 
      : avgSubmittedScore;

    // Progression analysis (compare older results with recent results)
    const sortedChronological = [...studentResults].sort((a, b) => 
      new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()
    );

    let progressStatus: 'excellent' | 'steady' | 'needs_effort' | 'new' = 'new';
    let progressFeedback = '';
    const recommendedChapters: string[] = [];

    // Phân tích tiến độ và phản hồi công bằng (Có xét việc bỏ bài = 0đ)
    if (totalAssignedCount > 0 && completionRate < 50) {
      progressStatus = 'needs_effort';
      progressFeedback = `Chưa hoàn thành đủ số bài được giao (Mới làm ${completedQuizzesCount}/${totalAssignedCount} đề - Bị tính 0đ cho ${uncompletedCount} đề chưa nộp). ĐTB tổng kết hiện tại: ${finalOfficialScore.toFixed(1)}đ. Cần khẩn trương nộp bù các đề còn thiếu để đảm bảo điểm số.`;
    } else if (totalAssignedCount > 0 && completionRate < 80) {
      if (avgSubmittedScore >= 8.0) {
        progressStatus = 'steady';
        progressFeedback = `Chất lượng bài làm khá tốt (Điểm TB bài đã nộp ${avgSubmittedScore.toFixed(1)}đ), tuy nhiên còn ${uncompletedCount} đề chưa hoàn thành (bị tính 0đ làm ĐTB tổng kết giảm còn ${finalOfficialScore.toFixed(1)}đ). Cần làm đủ 100% bài giao để đạt danh hiệu Giỏi/Xuất sắc.`;
      } else {
        progressStatus = 'needs_effort';
        progressFeedback = `ĐTB tổng kết đạt ${finalOfficialScore.toFixed(1)}đ (còn ${uncompletedCount} đề chưa nộp tính 0đ). Cần tăng cường thời lượng rèn luyện và làm đầy đủ bài tập.`;
      }
    } else if (sortedChronological.length >= 3) {
      const firstHalf = sortedChronological.slice(0, Math.floor(sortedChronological.length / 2));
      const secondHalf = sortedChronological.slice(Math.floor(sortedChronological.length / 2));

      const firstAvg = firstHalf.reduce((acc, r) => acc + r.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((acc, r) => acc + r.score, 0) / secondHalf.length;

      // Identify low scoring chapters
      sortedChronological.filter(r => r.score < 6.5).forEach(r => {
        const foundQ = quizzes.find(q => q.id === r.quizId);
        if (foundQ && foundQ.category && !recommendedChapters.includes(foundQ.category)) {
          recommendedChapters.push(foundQ.category);
        }
      });

      if (finalOfficialScore >= 8.0 && (secondAvg - firstAvg >= 0.5 || secondAvg >= 8.5)) {
        progressStatus = 'excellent';
        progressFeedback = `Học sinh có ý thức và phong độ xuất sắc! Hoàn thành tốt các đề giao, ĐTB tổng kết đạt ${finalOfficialScore.toFixed(1)}đ (Điểm các bài gần đây: ${secondAvg.toFixed(1)}đ). Phát huy rất tốt!`;
      } else if (finalOfficialScore >= 6.5) {
        progressStatus = 'steady';
        progressFeedback = `Học sinh duy trì phong độ học tập ổn định (ĐTB tổng kết ${finalOfficialScore.toFixed(1)}đ). Cần tiếp tục phát huy và luyện tập thêm các câu hỏi nâng cao.`;
      } else {
        progressStatus = 'needs_effort';
        progressFeedback = `ĐTB tổng kết đạt ${finalOfficialScore.toFixed(1)}đ. Học sinh cần tăng thời lượng rèn luyện và chú ý làm lại các bài thi chưa đạt.`;
      }
    } else if (sortedChronological.length > 0) {
      if (finalOfficialScore >= 8.0 && completionRate >= 80) {
        progressStatus = 'excellent';
        progressFeedback = `Kết quả ban đầu rất khả quan (ĐTB tổng kết ${finalOfficialScore.toFixed(1)}đ). Cần tiếp tục duy trì làm đều các đề mới được giao.`;
      } else if (finalOfficialScore >= 5.0) {
        progressStatus = 'steady';
        progressFeedback = `Đã hoàn thành ${completedQuizzesCount}/${totalAssignedCount} đề (ĐTB tổng kết ${finalOfficialScore.toFixed(1)}đ). Cần tiếp tục làm thêm các bài còn lại.`;
      } else {
        progressStatus = 'needs_effort';
        progressFeedback = `Mới hoàn thành ${completedQuizzesCount}/${totalAssignedCount} đề (ĐTB tổng kết ${finalOfficialScore.toFixed(1)}đ - gồm ${uncompletedCount} đề chưa nộp tính 0đ). Cần hoàn thành đủ bài để cải thiện kết quả.`;
      }
    } else {
      progressFeedback = 'Chưa tham gia làm bài thi nào (Tất cả đề giao đang tính 0đ). Cần đôn đốc học sinh đăng nhập và làm các đề thi được giao.';
    }

    return {
      totalSeconds,
      accumulatedPoints,
      effortPoints,
      bonusPoints,
      completedQuizzesCount,
      totalAssignedCount,
      completionRate,
      uncompletedCount,
      avgScore: finalOfficialScore, // ĐTB Tổng kết (chuẩn hóa 0đ bài chưa nộp)
      avgSubmittedScore, // ĐTB thực tế các bài đã làm
      finalOfficialScore,
      progressStatus,
      progressFeedback,
      recommendedChapters,
      studentResults,
      uncompletedQuizzes
    };
  };

  // Tab 3 Class-level Progress & Analytics Data (Including 0 points for uncompleted quizzes)
  const classProgressData = useMemo(() => {
    if (!selectedClass || classStudents.length === 0) {
      return {
        timelineData: [],
        distributionData: [],
        classOfficialAvg: 0,
        classSubmittedAvg: 0,
        totalAssignedSlots: 0,
        totalCompletedSlots: 0,
        classCompletionRate: 0,
        excellentStudentsCount: 0,
        effortNeededStudentsCount: 0,
        selectedStudentObj: null
      };
    }

    // Filter assigned quizzes by scope
    let assignedList = [...classAssignedQuizzes];
    if (classProgressChartScope !== 'all') {
      assignedList = assignedList.filter(q => q.type === classProgressChartScope);
    }
    // Sort oldest to newest for chronological progress line
    assignedList.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    if (classProgressChartLimit > 0 && assignedList.length > classProgressChartLimit) {
      assignedList = assignedList.slice(assignedList.length - classProgressChartLimit);
    }

    const selectedStudentObj = selectedStudentForComparison !== 'all'
      ? classStudents.find(s => s.id === selectedStudentForComparison) || null
      : null;

    // Build timeline points per quiz
    const timelineData = assignedList.map((quiz, idx) => {
      let totalAssignedScoreOnQuiz = 0;
      let totalSubmittedScoreOnQuiz = 0;
      let submittedCountOnQuiz = 0;
      let studentScoreVal: number | null = null;
      let selectedStudentSubmitted = false;

      classStudents.forEach(student => {
        const studentResults = results.filter(r => 
          r.quizId === quiz.id && 
          (r.studentId === student.id || (student.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === student.studentCode.trim().toUpperCase()))
        );

        if (studentResults.length > 0) {
          const best = Math.max(...studentResults.map(r => r.score));
          totalAssignedScoreOnQuiz += best;
          totalSubmittedScoreOnQuiz += best;
          submittedCountOnQuiz++;

          if (selectedStudentObj && student.id === selectedStudentObj.id) {
            studentScoreVal = Number(best.toFixed(2));
            selectedStudentSubmitted = true;
          }
        } else {
          // Uncompleted student gets 0.00 points
          totalAssignedScoreOnQuiz += 0;
          if (selectedStudentObj && student.id === selectedStudentObj.id) {
            studentScoreVal = 0.00;
            selectedStudentSubmitted = false;
          }
        }
      });

      const unsubmittedCountOnQuiz = Math.max(0, classStudents.length - submittedCountOnQuiz);
      const classAvgOfficial = classStudents.length > 0 ? totalAssignedScoreOnQuiz / classStudents.length : 0;
      const classAvgSubmitted = submittedCountOnQuiz > 0 ? totalSubmittedScoreOnQuiz / submittedCountOnQuiz : 0;
      const quizDate = quiz.createdAt ? new Date(quiz.createdAt) : new Date();

      return {
        id: quiz.id,
        attemptNumber: idx + 1,
        quizTitle: quiz.title,
        shortTitle: quiz.title.length > 18 ? quiz.title.slice(0, 16) + '...' : quiz.title,
        date: format(quizDate, 'dd/MM/yyyy'),
        shortDate: format(quizDate, 'dd/MM'),
        classAvgOfficial: Number(classAvgOfficial.toFixed(2)),
        classAvgSubmitted: Number(classAvgSubmitted.toFixed(2)),
        submittedCount: submittedCountOnQuiz,
        unsubmittedCount: unsubmittedCountOnQuiz,
        totalStudents: classStudents.length,
        completionRate: classStudents.length > 0 ? Math.round((submittedCountOnQuiz / classStudents.length) * 100) : 0,
        selectedStudentScore: (studentScoreVal as (number | null)),
        selectedStudentSubmitted,
        quizType: quiz.type || 'test'
      };
    });

    // Score distribution across all assigned slots (student x assignedQuizzes)
    // Every uncompleted slot is counted as 0.00 points
    const distGroups = [
      { key: 'zero', name: '0.00đ (Bỏ thi / Chưa làm)', shortName: '0.0đ (Bỏ thi)', count: 0, color: '#f43f5e' },
      { key: 'under5', name: '< 5.0đ (Chưa đạt)', shortName: '< 5.0đ', count: 0, color: '#fb7185' },
      { key: '5to65', name: '5.0 - 6.4đ (Trung bình)', shortName: '5.0 - 6.4đ', count: 0, color: '#f59e0b' },
      { key: '65to8', name: '6.5 - 7.9đ (Khá)', shortName: '6.5 - 7.9đ', count: 0, color: '#3b82f6' },
      { key: '8to10', name: '8.0 - 10.0đ (Giỏi / Xuất sắc)', shortName: '8.0 - 10.0đ', count: 0, color: '#10b981' }
    ];

    let grandTotalAssignedScore = 0;
    let grandTotalSubmittedScore = 0;
    let grandTotalSubmittedCount = 0;
    let excellentCount = 0;
    let effortNeededCount = 0;

    classStudents.forEach(student => {
      const training = getStudentTrainingData(student);
      if (training.finalOfficialScore >= 8.0) excellentCount++;
      if (training.finalOfficialScore < 5.0 || training.completionRate < 60) effortNeededCount++;

      classAssignedQuizzes.forEach(quiz => {
        const studentResults = results.filter(r => 
          r.quizId === quiz.id && 
          (r.studentId === student.id || (student.studentCode && r.studentCode && r.studentCode.trim().toUpperCase() === student.studentCode.trim().toUpperCase()))
        );

        if (studentResults.length > 0) {
          const best = Math.max(...studentResults.map(r => r.score));
          grandTotalAssignedScore += best;
          grandTotalSubmittedScore += best;
          grandTotalSubmittedCount++;

          if (best === 0) distGroups[0].count++;
          else if (best < 5) distGroups[1].count++;
          else if (best < 6.5) distGroups[2].count++;
          else if (best < 8) distGroups[3].count++;
          else distGroups[4].count++;
        } else {
          // Uncompleted counts as 0.00 points
          distGroups[0].count++;
        }
      });
    });

    const totalSlots = (classStudents.length * classAssignedQuizzes.length) || 1;
    const distributionData = distGroups.map(g => ({
      ...g,
      percentage: totalSlots > 0 ? Math.round((g.count / totalSlots) * 100) : 0
    }));

    const classOfficialAvg = totalSlots > 0 ? (grandTotalAssignedScore / totalSlots) : 0;
    const classSubmittedAvg = grandTotalSubmittedCount > 0 ? (grandTotalSubmittedScore / grandTotalSubmittedCount) : 0;
    const classCompletionRate = totalSlots > 0 ? Math.round((grandTotalSubmittedCount / totalSlots) * 100) : 0;

    return {
      timelineData,
      distributionData,
      classOfficialAvg,
      classSubmittedAvg,
      totalAssignedSlots: totalSlots,
      totalCompletedSlots: grandTotalSubmittedCount,
      classCompletionRate,
      excellentStudentsCount: excellentCount,
      effortNeededStudentsCount: effortNeededCount,
      selectedStudentObj
    };
  }, [selectedClass, classStudents, classAssignedQuizzes, results, classProgressChartScope, classProgressChartLimit, selectedStudentForComparison]);

  // Helper time formatter
  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Helper date formatter
  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'HH:mm dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Open Create Class Modal
  const handleOpenCreate = () => {
    setEditingClass(null);
    const currentYear = new Date().getFullYear();
    setClassForm({
      name: '',
      academicYear: selectedYear !== 'all' ? selectedYear : `${currentYear}-${currentYear + 1}`,
      grade: selectedGrade !== 'all' ? selectedGrade : '12',
      description: ''
    });
    setIsClassModalOpen(true);
  };

  // Open Edit Class Modal
  const handleOpenEdit = (c: ClassRoom, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClass(c);
    setClassForm({
      name: c.name,
      academicYear: c.academicYear,
      grade: c.grade,
      description: c.description || ''
    });
    setIsClassModalOpen(true);
  };

  // Save Class
  const handleSaveClass = async () => {
    if (!classForm.name.trim()) {
      alert("Vui lòng nhập tên lớp (Ví dụ: 12A1, 11A2, 10A1...)");
      return;
    }
    if (!classForm.academicYear.trim()) {
      alert("Vui lòng nhập niên khóa (Ví dụ: 2025-2026)");
      return;
    }

    setIsSaving(true);
    try {
      const classId = editingClass ? editingClass.id : `class_${classForm.name.trim().replace(/\s+/g, '')}_${classForm.academicYear.trim().replace(/[^a-zA-Z0-9]/g, '')}_${uuidv4().slice(0, 6)}`;
      const saved: ClassRoom = {
        id: classId,
        name: classForm.name.trim().toUpperCase(),
        academicYear: classForm.academicYear.trim(),
        grade: classForm.grade,
        description: classForm.description.trim(),
        createdAt: editingClass?.createdAt || new Date().toISOString()
      };
      await onSaveClass(saved);
      setIsClassModalOpen(false);
      if (selectedClass && selectedClass.id === saved.id) {
        setSelectedClass(saved);
      }
    } catch (e) {
      alert("Lỗi lưu lớp học. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Class
  const handleDeleteClass = async (c: ClassRoom, e: React.MouseEvent) => {
    e.stopPropagation();
    const count = students.filter(s => s.classId === c.id || (s.className === c.name && s.academicYear === c.academicYear)).length;
    const msg = count > 0 
      ? `Lớp "${c.name} (${c.academicYear})" hiện có ${count} học sinh.\nNếu xóa lớp, các học sinh sẽ trở về trạng thái "Chưa phân lớp" (tài khoản và điểm rèn luyện vẫn giữ nguyên).\nBạn có chắc chắn muốn xóa?`
      : `Bạn có chắc chắn muốn xóa lớp "${c.name} (${c.academicYear})"?`;
    
    if (confirm(msg)) {
      await onDeleteClass(c.id, `${c.name} (${c.academicYear})`);
      if (selectedClass?.id === c.id) {
        setSelectedClass(null);
      }
    }
  };

  // Assign students into current class
  const handleConfirmAddStudents = async () => {
    if (!selectedClass || selectedStudentIdsToAdd.length === 0) return;
    setIsAssigning(true);
    try {
      await onAssignStudents(selectedStudentIdsToAdd, {
        classId: selectedClass.id,
        className: selectedClass.name,
        academicYear: selectedClass.academicYear,
        grade: selectedClass.grade
      });
      setIsAddStudentModalOpen(false);
      setSelectedStudentIdsToAdd([]);
    } catch (e) {
      alert("Lỗi gán học sinh vào lớp.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Remove single student from class
  const handleRemoveStudentFromClass = async (studentId: string, studentName: string) => {
    if (confirm(`Gỡ học sinh "${studentName}" khỏi lớp ${selectedClass?.name}? (Tài khoản và điểm số không bị mất)`)) {
      await onAssignStudents([studentId], null);
    }
  };

  // Remove multiple selected students from class
  const handleBatchRemoveStudents = async () => {
    if (selectedMemberIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn gỡ ${selectedMemberIds.length} học sinh đã chọn khỏi lớp ${selectedClass?.name}?`)) {
      setIsAssigning(true);
      try {
        await onAssignStudents(selectedMemberIds, null);
        setSelectedMemberIds([]);
      } catch (e) {
        alert("Lỗi gỡ học sinh khỏi lớp.");
      } finally {
        setIsAssigning(false);
      }
    }
  };

  // Promote / Transfer students across academic years / classes
  const handleConfirmPromote = async () => {
    if (!promoteTargetClassId) {
      alert("Vui lòng chọn lớp đích để chuyển tới!");
      return;
    }
    const target = classes.find(c => c.id === promoteTargetClassId);
    if (!target) return;

    if (selectedStudentIdsToPromote.length === 0) {
      alert("Vui lòng chọn ít nhất 1 học sinh để chuyển lớp!");
      return;
    }

    setIsAssigning(true);
    try {
      await onAssignStudents(selectedStudentIdsToPromote, {
        classId: target.id,
        className: target.name,
        academicYear: target.academicYear,
        grade: target.grade
      });
      alert(`Đã chuyển thành công ${selectedStudentIdsToPromote.length} học sinh sang lớp ${target.name} (${target.academicYear})!`);
      setIsPromoteModalOpen(false);
      setSelectedStudentIdsToPromote([]);
    } catch (e) {
      alert("Lỗi khi chuyển lớp.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Copy unsubmitted student names to clipboard for teacher announcement
  const handleCopyUnsubmitted = () => {
    if (quizAttemptStats.unsubmittedStudents.length === 0) return;
    const text = `DANH SÁCH HỌC SINH LỚP ${selectedClass?.name} CHƯA LÀM ĐỀ "${currentQuiz?.title}":\n` + 
      quizAttemptStats.unsubmittedStudents.map((s, idx) => `${idx + 1}. ${s.fullName} (${s.studentCode || 'N/A'})`).join('\n') +
      `\n\nNhắc nhở: Các em vui lòng đăng nhập vào hệ thống để hoàn thành bài thi trước hạn chót!`;
    navigator.clipboard.writeText(text);
    setCopiedUnsubmitted(true);
    setTimeout(() => setCopiedUnsubmitted(false), 3000);
  };

  // Available students to add into this class
  const availableStudentsToAdd = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(s => {
      const isAlreadyInThisClass = s.classId === selectedClass.id || 
        (s.className === selectedClass.name && s.academicYear === selectedClass.academicYear);
      if (isAlreadyInThisClass) return false;

      if (!studentSearch.trim()) return true;
      const q = studentSearch.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || 
             (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
             (s.className && s.className.toLowerCase().includes(q));
    });
  }, [students, selectedClass, studentSearch]);

  return (
    <div className="space-y-6 animate-fade-in">
      {!selectedClass ? (
        // ==========================================
        // VIEW 1: COMPACT CLASS CARDS LIST
        // ==========================================
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3 relative z-10">
              <div className="p-3 bg-indigo-600/40 border border-indigo-400/30 rounded-2xl">
                <GraduationCap size={24} className="text-indigo-300" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight">Danh Sách Lớp Học & Niên Khóa</h2>
                <p className="text-slate-400 text-xs font-medium">
                  Quản lý học viên, giao đề thi phân hóa & theo dõi kết quả rèn luyện từng lớp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap relative z-10">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
                <span className="text-[9px] font-black text-indigo-300 uppercase block">Tổng số lớp</span>
                <span className="text-base font-black text-white">{classes.length}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
                <span className="text-[9px] font-black text-emerald-300 uppercase block">Đã vào lớp</span>
                <span className="text-base font-black text-emerald-400">{students.length - unassignedStudentsCount} HS</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-center">
                <span className="text-[9px] font-black text-amber-300 uppercase block">Chưa phân lớp</span>
                <span className="text-base font-black text-amber-400">{unassignedStudentsCount} HS</span>
              </div>
              <button
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-500 shadow-md transition-all active:scale-95"
              >
                <Plus size={16} /> THÊM LỚP MỚI
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center bg-white p-4 rounded-2xl border shadow-sm">
            <div className="flex-1 w-full relative">
              <input
                className="w-full py-2.5 px-4 bg-slate-50 border rounded-xl outline-none text-xs font-bold pl-10"
                placeholder="Tìm tên lớp hoặc ghi chú..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            </div>

            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-xl border">
                <Calendar size={13} className="text-slate-400" />
                <select
                  className="bg-transparent py-1.5 text-[10px] font-black uppercase outline-none"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                >
                  <option value="all">TẤT CẢ NIÊN KHÓA</option>
                  {academicYears.map(yr => (
                    <option key={yr} value={yr}>NIÊN KHÓA {yr}</option>
                  ))}
                </select>
              </div>

              <select
                className="px-3 py-2 bg-white border rounded-xl text-[10px] font-black uppercase outline-none"
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value as any)}
              >
                <option value="all">TẤT CẢ KHỐI</option>
                <option value="12">KHỐI 12</option>
                <option value="11">KHỐI 11</option>
                <option value="10">KHỐI 10</option>
              </select>
            </div>
          </div>

          {/* Compact Class Cards Grid */}
          {filteredClasses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {filteredClasses.map(c => {
                const count = students.filter(s => 
                  s.classId === c.id || 
                  (s.className === c.name && s.academicYear === c.academicYear)
                ).length;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedClass(c);
                      setActiveTab('students');
                    }}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-400 transition-all flex flex-col justify-between group cursor-pointer relative overflow-hidden"
                  >
                    <div>
                      {/* Top Badges & Actions */}
                      <div className="flex justify-between items-center mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded-md text-[8px] uppercase border border-indigo-100">
                            Khối {c.grade}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded-md text-[8px]">
                            {c.academicYear}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleOpenEdit(c, e)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Sửa lớp"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClass(c, e)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Xóa lớp"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Class Title */}
                      <h3 className="font-black text-base text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">
                        {c.name}
                      </h3>

                      {/* Short Description */}
                      <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5 mb-3">
                        {c.description || "Chưa có ghi chú phân loại"}
                      </p>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users size={13} className="text-indigo-500" />
                        <span className="text-[11px] font-black text-slate-700">{count} HS</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Xem lớp <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center bg-white rounded-2xl border border-dashed p-8 space-y-3">
              <GraduationCap size={32} className="text-indigo-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-800 uppercase">Chưa tìm thấy lớp học nào</h3>
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                Bấm nút &quot;Thêm lớp mới&quot; để tạo lớp học theo khối và niên khóa.
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-md"
              >
                <Plus size={14} /> TẠO LỚP ĐẦU TIÊN
              </button>
            </div>
          )}
        </div>
      ) : (
        // ==========================================
        // VIEW 2: MULTI-TAB CLASS DETAIL SCREEN
        // ==========================================
        <div className="space-y-6">
          {/* Header of Selected Class */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedClass(null)}
                  className="p-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-600 rounded-xl transition-all"
                  title="Quay lại danh sách thẻ lớp"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                      Lớp {selectedClass.name}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-black rounded-lg text-[10px] uppercase border border-indigo-100">
                      Khối {selectedClass.grade}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px]">
                      Niên khóa: {selectedClass.academicYear}
                    </span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded-lg text-[10px] flex items-center gap-1">
                      <Users size={11} /> {classStudents.length} học sinh
                    </span>
                  </div>
                  {selectedClass.description && (
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {selectedClass.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                <button
                  onClick={() => setActiveTab('students')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'students' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <Users size={14} /> Danh sách HS
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'stats' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <BarChart3 size={14} /> Thống kê đề thi
                </button>
                <button
                  onClick={() => setActiveTab('progress')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${activeTab === 'progress' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <Award size={14} /> Kết quả rèn luyện
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: DANH SÁCH & GÁN HỌC SINH (Members & Batch Promotion/Progression)    */}
          {/* ========================================================================= */}
          {activeTab === 'students' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 animate-fade-in">
              {/* Action Toolbar */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="w-full md:w-80 relative">
                  <input
                    className="w-full py-2.5 px-4 bg-slate-50 border rounded-xl outline-none text-xs font-bold pl-9"
                    placeholder="Tìm học sinh theo tên hoặc MAHS..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                  {selectedMemberIds.length > 0 && (
                    <button
                      onClick={handleBatchRemoveStudents}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all shadow-sm"
                    >
                      <UserMinus size={14} /> Gỡ {selectedMemberIds.length} HS đã chọn
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setSelectedStudentIdsToPromote(classStudents.map(s => s.id));
                      setIsPromoteModalOpen(true);
                    }}
                    disabled={classStudents.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-600 shadow-md disabled:opacity-50 transition-all"
                  >
                    <ArrowUpRight size={15} /> Chuyển Niên Khóa / Lên Lớp
                  </button>

                  <button
                    onClick={() => {
                      setSelectedStudentIdsToAdd([]);
                      setIsAddStudentModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-md transition-all"
                  >
                    <UserPlus size={15} /> Thêm học sinh vào lớp
                  </button>
                </div>
              </div>

              {/* Members Table */}
              {filteredClassStudents.length > 0 ? (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="p-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-indigo-600"
                            checked={selectedMemberIds.length > 0 && selectedMemberIds.length === filteredClassStudents.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMemberIds(filteredClassStudents.map(s => s.id));
                              } else {
                                setSelectedMemberIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="p-3.5 w-12 text-center">STT</th>
                        <th className="p-3.5">Họ và tên</th>
                        <th className="p-3.5 text-center">Mã số (MAHS)</th>
                        <th className="p-3.5 text-center">Khối</th>
                        <th className="p-3.5 text-center">Tài khoản</th>
                        <th className="p-3.5 text-center">Điểm tích lũy</th>
                        <th className="p-3.5 text-center">Tổng TG rèn</th>
                        <th className="p-3.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClassStudents.map((s, idx) => {
                        const training = getStudentTrainingData(s);
                        const isSelected = selectedMemberIds.includes(s.id);

                        return (
                          <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                            <td className="p-3.5 text-center">
                              <input
                                type="checkbox"
                                className="w-3.5 h-3.5 rounded text-indigo-600"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedMemberIds(prev => 
                                    prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                  );
                                }}
                              />
                            </td>
                            <td className="p-3.5 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-3.5 font-black text-slate-800 uppercase">
                              {s.fullName}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">
                                {s.studentCode || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3.5 text-center text-slate-500 font-bold">
                              Khối {s.grade || selectedClass.grade}
                            </td>
                            <td className="p-3.5 text-center font-mono text-slate-500 text-[11px]">
                              {s.username}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="font-black text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-md text-[11px]">
                                ⭐ {training.accumulatedPoints.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3.5 text-center font-bold text-slate-600 text-[11px]">
                              {formatStudyTime(training.totalSeconds)}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setInspectingStudent(s)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Xem kết quả rèn luyện cá nhân"
                                >
                                  <Award size={15} />
                                </button>
                                <button
                                  onClick={() => handleRemoveStudentFromClass(s.id, s.fullName)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Gỡ khỏi lớp"
                                >
                                  <UserMinus size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed space-y-3">
                  <Users size={28} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-black text-slate-500 uppercase">
                    {memberSearch ? "Không tìm thấy học sinh phù hợp" : "Lớp chưa có học sinh nào"}
                  </p>
                  <button
                    onClick={() => {
                      setSelectedStudentIdsToAdd([]);
                      setIsAddStudentModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700"
                  >
                    <UserPlus size={14} /> Thêm học sinh ngay
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: THỐNG KÊ (3 PHẦN: Lọc -> Biểu đồ Điểm Lần 1 -> Đã/Chưa làm)       */}
          {/* ========================================================================= */}
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-fade-in">
              {/* PHẦN 1: BỘ LỌC ĐỀ THI ĐƯỢC PHÂN CHO LỚP */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Filter size={15} className="text-indigo-600" />
                    1. Chọn Đề Thi Cần Thống Kê ({classAssignedQuizzes.length} đề được phân cho lớp)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Filter Chapter */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Lọc theo chương:
                    </label>
                    <select
                      className="w-full py-2 px-3 bg-slate-50 border rounded-xl text-xs font-black uppercase outline-none"
                      value={statsChapterFilter}
                      onChange={e => setStatsChapterFilter(e.target.value)}
                    >
                      <option value="all">TẤT CẢ CHƯƠNG</option>
                      {chapters
                        .filter(c => String(c.grade) === String(selectedClass.grade) || c.grade === 'all')
                        .map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Search Quiz Title */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                      Tìm kiếm tên đề:
                    </label>
                    <input
                      className="w-full py-2 px-3 bg-slate-50 border rounded-xl text-xs font-bold outline-none"
                      placeholder="Gõ tên đề..."
                      value={statsQuizSearch}
                      onChange={e => setStatsQuizSearch(e.target.value)}
                    />
                  </div>

                  {/* Select Target Quiz */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-indigo-600 block mb-1">
                      Chọn đề thi:
                    </label>
                    <select
                      className="w-full py-2 px-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-black uppercase outline-none"
                      value={currentQuiz?.id || ''}
                      onChange={e => setSelectedQuizId(e.target.value)}
                    >
                      {filteredClassQuizzes.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.title} ({q.type === 'test' ? 'Đề thi' : 'Luyện tập'} - {q.questions?.length || 0} câu)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {currentQuiz ? (
                <>
                  {/* PHẦN 2: THỐNG KÊ BIỂU ĐỒ ĐIỂM LẦN 1 & TOP 5 */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <BarChart3 size={16} />
                          </span>
                          <h3 className="text-sm font-black uppercase text-slate-900">
                            2. Thống Kê Phổ Điểm (Căn Cứ Trên Điểm Lần 1 - First Attempt)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 font-bold mt-1">
                          Đề thi: <span className="text-indigo-600 font-black">{currentQuiz.title}</span> • Thời lượng: {currentQuiz.durationMinutes} phút
                        </p>
                      </div>

                      {/* Summary Metrics */}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="bg-slate-50 border px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[9px] font-black text-slate-400 uppercase block">Điểm TB Lần 1</span>
                          <span className="font-black text-slate-900">{quizAttemptStats.avgFirstScore.toFixed(1)}đ</span>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[9px] font-black text-emerald-600 uppercase block">Cao nhất</span>
                          <span className="font-black text-emerald-700">{quizAttemptStats.highestFirstScore.toFixed(1)}đ</span>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl text-center">
                          <span className="text-[9px] font-black text-rose-600 uppercase block">Thấp nhất</span>
                          <span className="font-black text-rose-700">{quizAttemptStats.lowestFirstScore.toFixed(1)}đ</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart & Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Visual Bar Distribution */}
                      <div className="space-y-3.5 bg-slate-50 p-5 rounded-2xl border">
                        <h4 className="text-[11px] font-black uppercase text-slate-600 tracking-wide">
                          Phân loại kết quả Lần 1 ({quizAttemptStats.submittedStudents.length} học sinh đã nộp bài)
                        </h4>

                        {/* GIỎI >= 8.0 */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-emerald-700 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                              Giỏi (Điểm &gt;= 8.0)
                            </span>
                            <span className="text-slate-700 font-black">
                              {quizAttemptStats.scoreTiers.gio} HS ({quizAttemptStats.tierPercentages.gio.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${quizAttemptStats.tierPercentages.gio}%` }}
                            />
                          </div>
                        </div>

                        {/* KHÁ >= 7.0 & < 8.0 */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-blue-700 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                              Khá (Điểm &gt;= 7.0)
                            </span>
                            <span className="text-slate-700 font-black">
                              {quizAttemptStats.scoreTiers.kha} HS ({quizAttemptStats.tierPercentages.kha.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${quizAttemptStats.tierPercentages.kha}%` }}
                            />
                          </div>
                        </div>

                        {/* ĐẠT >= 5.0 & < 7.0 */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-amber-700 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                              Đạt (Điểm &gt;= 5.0)
                            </span>
                            <span className="text-slate-700 font-black">
                              {quizAttemptStats.scoreTiers.dat} HS ({quizAttemptStats.tierPercentages.dat.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${quizAttemptStats.tierPercentages.dat}%` }}
                            />
                          </div>
                        </div>

                        {/* CHƯA ĐẠT < 5.0 */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-rose-700 font-black flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                              Chưa Đạt (Điểm &lt; 5.0)
                            </span>
                            <span className="text-slate-700 font-black">
                              {quizAttemptStats.scoreTiers.chuaDat} HS ({quizAttemptStats.tierPercentages.chuaDat.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${quizAttemptStats.tierPercentages.chuaDat}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Top 5 First-Attempt Leaderboard */}
                      <div className="bg-slate-50 p-5 rounded-2xl border space-y-3">
                        <div className="flex items-center gap-2 text-yellow-600">
                          <Star size={16} className="fill-yellow-500 text-yellow-500" />
                          <h4 className="text-[11px] font-black uppercase tracking-wide text-slate-800">
                            Top 5 Học Sinh Điểm Lần 1 Cao Nhất
                          </h4>
                        </div>

                        {quizAttemptStats.top5.length > 0 ? (
                          <div className="space-y-2">
                            {quizAttemptStats.top5.map((item, rank) => {
                              const rankColors = [
                                'bg-yellow-100 text-yellow-800 border-yellow-300 font-black',
                                'bg-slate-200 text-slate-700 border-slate-300 font-black',
                                'bg-amber-100 text-amber-800 border-amber-300 font-black',
                                'bg-slate-100 text-slate-600 border-slate-200',
                                'bg-slate-100 text-slate-600 border-slate-200'
                              ];

                              return (
                                <div
                                  key={item.student.id}
                                  className="bg-white p-2.5 rounded-xl border flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center text-[11px] ${rankColors[rank]}`}>
                                      #{rank + 1}
                                    </span>
                                    <div>
                                      <p className="font-black text-slate-800 uppercase text-xs leading-tight">
                                        {item.student.fullName}
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-medium">
                                        Mã: <span className="font-mono text-blue-600">{item.student.studentCode || 'N/A'}</span> • Làm trong {formatStudyTime(item.firstAttempt.durationSeconds || 0)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                      {item.firstAttempt.score.toFixed(1)}đ
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-400 text-xs font-medium">
                            Chưa có học sinh nào nộp bài đề thi này
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PHẦN 3: THỐNG KÊ SỐ NGƯỜI THAM GIA LÀM & CHƯA LÀM */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                          <Users size={16} className="text-indigo-600" />
                          3. Thống Kê Tham Gia Làm Bài ({classStudents.length} học sinh)
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Nhấn vào từng tab bên dưới để xem danh sách chi tiết
                        </p>
                      </div>

                      {/* Toggle Cards for Submitted vs Unsubmitted */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setParticipationView('submitted')}
                          className={`flex-1 sm:flex-initial flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${participationView === 'submitted' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <CheckCircle2 size={15} /> Đã làm ({quizAttemptStats.submittedStudents.length})
                        </button>
                        <button
                          onClick={() => setParticipationView('unsubmitted')}
                          className={`flex-1 sm:flex-initial flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${participationView === 'unsubmitted' ? 'bg-rose-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          <XCircle size={15} /> Chưa làm ({quizAttemptStats.unsubmittedStudents.length})
                        </button>
                      </div>
                    </div>

                    {/* SUBMITTED LIST */}
                    {participationView === 'submitted' && (
                      <div className="space-y-3 animate-fade-in">
                        {quizAttemptStats.submittedStudents.length > 0 ? (
                          <div className="overflow-x-auto border rounded-2xl">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  <th className="p-3 w-10 text-center">STT</th>
                                  <th className="p-3">Họ và tên</th>
                                  <th className="p-3 text-center">Mã số</th>
                                  <th className="p-3 text-center">Điểm Lần 1</th>
                                  <th className="p-3 text-center">Điểm Cao Nhất</th>
                                  <th className="p-3 text-center">Số lần làm</th>
                                  <th className="p-3 text-center">TG làm Lần 1</th>
                                  <th className="p-3 text-center">Ngày nộp Lần 1</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {quizAttemptStats.submittedStudents.map((item, idx) => (
                                  <tr key={item.student.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                    <td className="p-3 font-black text-slate-800 uppercase">{item.student.fullName}</td>
                                    <td className="p-3 text-center font-mono text-blue-600 font-bold">{item.student.studentCode || 'N/A'}</td>
                                    <td className="p-3 text-center">
                                      <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                                        {item.firstAttempt.score.toFixed(1)}đ
                                      </span>
                                    </td>
                                    <td className="p-3 text-center">
                                      <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">
                                        {item.bestScore.toFixed(1)}đ
                                      </span>
                                    </td>
                                    <td className="p-3 text-center font-bold text-slate-600">{item.totalAttempts} lần</td>
                                    <td className="p-3 text-center text-slate-600 font-medium">{formatStudyTime(item.firstAttempt.durationSeconds || 0)}</td>
                                    <td className="p-3 text-center text-slate-400 text-[10px]">{formatDateStr(item.firstAttempt.submittedAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed">
                            Chưa có học sinh nào nộp bài
                          </div>
                        )}
                      </div>
                    )}

                    {/* UNSUBMITTED LIST */}
                    {participationView === 'unsubmitted' && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center bg-rose-50 p-3.5 rounded-2xl border border-rose-100">
                          <span className="text-xs font-black text-rose-800">
                            Có {quizAttemptStats.unsubmittedStudents.length} học sinh chưa nộp bài
                          </span>
                          <button
                            onClick={handleCopyUnsubmitted}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all shadow-xs"
                          >
                            {copiedUnsubmitted ? <CheckCheck size={13} /> : <Copy size={13} />}
                            {copiedUnsubmitted ? "ĐÃ SAO CHÉP TÊN HS" : "SAO CHÉP DANH SÁCH NHẮC NHỞ"}
                          </button>
                        </div>

                        {quizAttemptStats.unsubmittedStudents.length > 0 ? (
                          <div className="overflow-x-auto border rounded-2xl">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  <th className="p-3 w-10 text-center">STT</th>
                                  <th className="p-3">Họ và tên</th>
                                  <th className="p-3 text-center">Mã số (MAHS)</th>
                                  <th className="p-3 text-center">Tài khoản</th>
                                  <th className="p-3 text-center">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {quizAttemptStats.unsubmittedStudents.map((s, idx) => (
                                  <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                    <td className="p-3 font-black text-slate-800 uppercase">{s.fullName}</td>
                                    <td className="p-3 text-center font-mono text-blue-600 font-bold">{s.studentCode || 'N/A'}</td>
                                    <td className="p-3 text-center font-mono text-slate-500">{s.username}</td>
                                    <td className="p-3 text-center">
                                      <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-[10px] uppercase">
                                        Chưa làm bài
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-8 text-center text-emerald-600 font-black text-xs bg-emerald-50 rounded-2xl border border-emerald-100">
                            🎉 Tuyệt vời! 100% học sinh trong lớp đã hoàn thành bài thi này!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center bg-white rounded-3xl border border-dashed p-8 space-y-3">
                  <AlertCircle size={32} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-black text-slate-500 uppercase">
                    Không có đề thi nào phù hợp với bộ lọc chương
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: KẾT QUẢ RÈN LUYỆN (Student History, Points & Smart Feedback)       */}
          {/* ========================================================================= */}
          {activeTab === 'progress' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
              {/* Toolbar & Filter Header */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 border-b pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-600" />
                    Theo Dõi Tiến Bộ & Kết Quả Rèn Luyện Toàn Lớp
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Đánh giá công bằng: các bài thi giao nhưng học sinh chưa làm hoặc bỏ thi sẽ tính <strong>0.00 điểm</strong>
                  </p>
                </div>

                <div className="w-full md:w-80 relative">
                  <input
                    className="w-full py-2 px-4 bg-slate-50 border rounded-xl outline-none text-xs font-bold pl-9"
                    placeholder="Lọc theo tên hoặc MAHS..."
                    value={progressSearch}
                    onChange={e => setProgressSearch(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>
              </div>

              {/* 4 Overview Metric Cards for Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    classProgressData.classOfficialAvg >= 8 ? 'bg-emerald-50 text-emerald-600' : classProgressData.classOfficialAvg >= 5 ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    <Trophy size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[9px] font-black uppercase">ĐTB Tổng Kết Lớp</p>
                    <h4 className={`text-xl font-black ${
                      classProgressData.classOfficialAvg >= 8 ? 'text-emerald-600' : classProgressData.classOfficialAvg >= 5 ? 'text-blue-600' : 'text-rose-600'
                    }`}>
                      {classProgressData.classOfficialAvg.toFixed(2)}đ
                    </h4>
                    <span className="text-[9px] text-slate-400 font-bold block">
                      ĐTB bài đã nộp: <strong className="text-indigo-600">{classProgressData.classSubmittedAvg.toFixed(2)}đ</strong>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <CheckSquare size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[9px] font-black uppercase">Tỷ Lệ Nộp Bài Giao</p>
                    <h4 className="text-xl font-black text-slate-800">
                      {classProgressData.totalCompletedSlots}/{classProgressData.totalAssignedSlots} lượt
                    </h4>
                    <span className={`text-[9px] font-bold block ${
                      classProgressData.classCompletionRate >= 80 ? 'text-emerald-600' : classProgressData.classCompletionRate >= 50 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      Tỷ lệ hoàn thành: <strong>{classProgressData.classCompletionRate}%</strong>
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Award size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[9px] font-black uppercase">HS Rèn Luyện Tốt</p>
                    <h4 className="text-xl font-black text-emerald-600">
                      {classProgressData.excellentStudentsCount} / {classStudents.length} HS
                    </h4>
                    <span className="text-[9px] text-slate-400 font-bold block">
                      ĐTB tổng kết ≥ 8.0 điểm
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[9px] font-black uppercase">Cần Đôn Đốc / Nhắc Nhở</p>
                    <h4 className="text-xl font-black text-rose-600">
                      {classProgressData.effortNeededStudentsCount} HS
                    </h4>
                    <span className="text-[9px] text-slate-400 font-bold block">
                      Chưa đạt chuẩn / Bỏ nhiều bài
                    </span>
                  </div>
                </div>
              </div>

              {/* Recharts Biểu đồ Thống kê Tiến trình & Kết Quả Rèn Luyện Toàn Lớp */}
              <div className="bg-slate-50/70 p-5 sm:p-6 rounded-[2rem] border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                      <BarChart3 size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                          Đồ Thị Tiến Trình & Kết Quả Rèn Luyện Toàn Lớp
                        </h4>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-black text-[9px] rounded-md uppercase hidden sm:inline-flex items-center gap-1">
                          <Sparkles size={10} /> Tính 0đ bài bỏ thi
                        </span>
                      </div>
                      <p className="text-slate-400 font-medium text-[11px] mt-0.5">
                        Theo dõi mức độ tiến bộ qua từng đề thi được giao và so sánh trực tiếp phong độ học viên
                      </p>
                    </div>
                  </div>

                  {/* Filter & Chart Options */}
                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                    {/* Switch Timeline vs Distribution */}
                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                      <button
                        onClick={() => setClassProgressChartType('timeline')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          classProgressChartType === 'timeline'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <LineChartIcon size={12} />
                        <span>Tiến trình điểm</span>
                      </button>
                      <button
                        onClick={() => setClassProgressChartType('distribution')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          classProgressChartType === 'distribution'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <BarChart2 size={12} />
                        <span>Phổ điểm lớp</span>
                      </button>
                    </div>

                    {/* Scope Selector */}
                    <select
                      value={classProgressChartScope}
                      onChange={(e) => setClassProgressChartScope(e.target.value as any)}
                      className="bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-xs"
                    >
                      <option value="all">Tất cả bài giao ({classAssignedQuizzes.length})</option>
                      <option value="test">Chỉ đề kiểm tra</option>
                      <option value="practice">Chỉ bài luyện tập</option>
                    </select>

                    {/* Timeline Limit Selector */}
                    {classProgressChartType === 'timeline' && (
                      <select
                        value={classProgressChartLimit}
                        onChange={(e) => setClassProgressChartLimit(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-xs"
                      >
                        <option value={10}>10 đề gần nhất</option>
                        <option value={15}>15 đề gần nhất</option>
                        <option value={30}>30 đề gần nhất</option>
                        <option value={0}>Tất cả các đề</option>
                      </select>
                    )}

                    {/* Student Comparison Selector */}
                    {classProgressChartType === 'timeline' && classStudents.length > 0 && (
                      <select
                        value={selectedStudentForComparison}
                        onChange={(e) => setSelectedStudentForComparison(e.target.value)}
                        className="bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-xs max-w-[180px]"
                      >
                        <option value="all">📊 ĐTB Chung Cả Lớp</option>
                        {classStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            👤 {s.fullName} ({s.studentCode || 'HS'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Main Recharts Area / Bar Chart */}
                {classProgressData.timelineData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-dashed">
                    Chưa có dữ liệu đề thi được giao cho lớp này
                  </div>
                ) : classProgressChartType === 'timeline' ? (
                  <div className="space-y-2">
                    <div className="w-full h-64 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={classProgressData.timelineData}
                          margin={{ top: 15, right: 20, left: -20, bottom: 25 }}
                        >
                          <defs>
                            <linearGradient id="adminClassAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="shortDate"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            dy={8}
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
                                  <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 max-w-xs text-xs z-50 space-y-2">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                                      <span className="text-[9px] font-bold text-slate-400">{data.date}</span>
                                      <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[8px] font-black uppercase">
                                        {data.quizType === 'test' ? 'Đề kiểm tra' : 'Bài luyện tập'}
                                      </span>
                                    </div>
                                    <p className="font-bold text-slate-100 text-xs line-clamp-2">{data.quizTitle}</p>
                                    
                                    <div className="space-y-1.5 bg-slate-800/80 p-2.5 rounded-xl">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 text-[10px] font-bold">ĐTB Lớp (0đ bài bỏ):</span>
                                        <span className={`font-black text-xs ${
                                          data.classAvgOfficial >= 8 ? 'text-emerald-400' : data.classAvgOfficial >= 5 ? 'text-blue-400' : 'text-rose-400'
                                        }`}>
                                          {data.classAvgOfficial.toFixed(2)}đ
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400 text-[10px] font-bold">ĐTB bài đã nộp:</span>
                                        <span className="text-slate-200 font-bold text-[11px]">{data.classAvgSubmitted.toFixed(2)}đ</span>
                                      </div>
                                      <div className="flex items-center justify-between pt-1 border-t border-slate-700/60">
                                        <span className="text-slate-400 text-[10px]">Đã nộp / Chưa làm:</span>
                                        <span className="text-emerald-400 font-bold text-[10px]">
                                          {data.submittedCount}/{data.totalStudents} HS ({data.completionRate}%)
                                        </span>
                                      </div>

                                      {classProgressData.selectedStudentObj && (
                                        <div className="mt-2 pt-2 border-t border-indigo-500/40 flex items-center justify-between bg-indigo-950/60 p-1.5 rounded-lg">
                                          <span className="text-amber-300 font-bold text-[10px]">
                                            {classProgressData.selectedStudentObj.fullName}:
                                          </span>
                                          <span className={`font-black text-xs ${
                                            (data.selectedStudentScore ?? 0) >= 8 ? 'text-emerald-400' : (data.selectedStudentScore ?? 0) >= 5 ? 'text-amber-400' : 'text-rose-400'
                                          }`}>
                                            {data.selectedStudentScore !== null ? `${data.selectedStudentScore.toFixed(2)}đ` : 'Chưa thi (0đ)'}
                                            {!data.selectedStudentSubmitted && ' (0đ)'}
                                          </span>
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
                            label={{ value: 'Chuẩn Giỏi (8.0)', position: 'insideTopRight', fill: '#10b981', fontSize: 9, fontWeight: 700 }}
                          />
                          <ReferenceLine
                            y={5}
                            stroke="#f59e0b"
                            strokeDasharray="3 3"
                            label={{ value: 'Chuẩn Đạt (5.0)', position: 'insideBottomRight', fill: '#f59e0b', fontSize: 9, fontWeight: 700 }}
                          />
                          <ReferenceLine
                            y={Number(classProgressData.classOfficialAvg.toFixed(2))}
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            label={{ value: `ĐTB Lớp (${classProgressData.classOfficialAvg.toFixed(2)})`, position: 'insideLeft', fill: '#6366f1', fontSize: 9, fontWeight: 700 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="classAvgOfficial"
                            name="ĐTB Lớp (0đ bài bỏ)"
                            stroke="#4f46e5"
                            strokeWidth={2.5}
                            fill="url(#adminClassAreaGrad)"
                            activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const isLow = payload.classAvgOfficial < 5;
                              const isHigh = payload.classAvgOfficial >= 8;
                              const fillColor = isLow ? '#f43f5e' : isHigh ? '#10b981' : '#4f46e5';
                              return (
                                <circle
                                  key={`dot-${payload.id}`}
                                  cx={cx}
                                  cy={cy}
                                  r={4}
                                  fill={fillColor}
                                  stroke="#ffffff"
                                  strokeWidth={1.5}
                                />
                              );
                            }}
                          />

                          {/* Overlay Line for Selected Student Comparison */}
                          {classProgressData.selectedStudentObj && (
                            <Line
                              type="monotone"
                              dataKey="selectedStudentScore"
                              name={classProgressData.selectedStudentObj.fullName}
                              stroke="#f59e0b"
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (payload.selectedStudentScore === null) return <></>;
                                const isZero = !payload.selectedStudentSubmitted;
                                return (
                                  <circle
                                    key={`student-dot-${payload.id}`}
                                    cx={cx}
                                    cy={cy}
                                    r={isZero ? 5 : 4}
                                    fill={isZero ? '#f43f5e' : '#f59e0b'}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                  />
                                );
                              }}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Chart Legend & Explanation */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[10px] font-bold text-slate-500">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span>
                          <span>ĐTB Tổng kết Lớp (Tính 0đ các bài bỏ)</span>
                        </div>
                        {classProgressData.selectedStudentObj && (
                          <div className="flex items-center gap-1.5 text-amber-700">
                            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                            <span>Học sinh: {classProgressData.selectedStudentObj.fullName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                          <span>Bài chưa nộp / Điểm liệt (0.00đ)</span>
                        </div>
                      </div>
                      <span className="italic text-slate-400">
                        Hiển thị {classProgressData.timelineData.length} đề thi
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full h-64 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={classProgressData.distributionData}
                          margin={{ top: 15, right: 20, left: -20, bottom: 25 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis
                            dataKey="shortName"
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            dy={8}
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
                                      Số lượt: <span className="text-emerald-400 font-black">{data.count}</span> lượt ({data.percentage}%)
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="count" name="Số lượt" radius={[6, 6, 0, 0]} maxBarSize={56}>
                            {classProgressData.distributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200">
                      {classProgressData.distributionData.map(group => (
                        <div key={group.key} className="bg-white p-2.5 rounded-xl border text-center shadow-xs">
                          <span className="text-[9px] font-bold text-slate-500 block truncate">{group.shortName}</span>
                          <span className="text-sm font-black text-slate-900 block leading-tight mt-0.5">{group.count} lượt</span>
                          <span className="text-[9px] font-bold text-slate-400">{group.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Students Progress Table */}
              {classStudents.length > 0 ? (
                <div className="overflow-x-auto border rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="p-3.5 w-12 text-center">STT</th>
                        <th className="p-3.5">Học sinh</th>
                        <th className="p-3.5 text-center">Mã số (MAHS)</th>
                        <th className="p-3.5 text-center">Đề đã làm / Giao</th>
                        <th className="p-3.5 text-center">ĐTB Tổng kết (0đ bài bỏ)</th>
                        <th className="p-3.5 text-center">ĐTB Đã nộp</th>
                        <th className="p-3.5 text-center">Tổng TG rèn luyện</th>
                        <th className="p-3.5 text-center">Điểm tích lũy</th>
                        <th className="p-3.5 text-center">Đánh giá tiến bộ</th>
                        <th className="p-3.5 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classStudents
                        .filter(s => {
                          if (!progressSearch.trim()) return true;
                          const q = progressSearch.toLowerCase();
                          return s.fullName.toLowerCase().includes(q) || (s.studentCode && s.studentCode.toLowerCase().includes(q));
                        })
                        .map((s, idx) => {
                          const training = getStudentTrainingData(s);

                          return (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-3.5 font-black text-slate-800 uppercase">{s.fullName}</td>
                              <td className="p-3.5 text-center font-mono text-blue-600 font-bold">{s.studentCode || 'N/A'}</td>
                              <td className="p-3.5 text-center">
                                <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${training.completionRate >= 80 ? 'bg-emerald-50 text-emerald-700' : training.completionRate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {training.completedQuizzesCount}/{training.totalAssignedCount} đề ({training.completionRate.toFixed(0)}%)
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`font-black px-2.5 py-1 rounded-lg text-xs ${
                                  training.finalOfficialScore >= 8.0 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                    : training.finalOfficialScore >= 5.0 
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {training.finalOfficialScore.toFixed(2)}đ
                                </span>
                              </td>
                              <td className="p-3.5 text-center text-slate-600 font-bold text-[11px]">
                                {training.avgSubmittedScore > 0 ? `${training.avgSubmittedScore.toFixed(2)}đ` : '-'}
                              </td>
                              <td className="p-3.5 text-center font-bold text-slate-700">
                                <Clock size={12} className="inline mr-1 text-slate-400" />
                                {formatStudyTime(training.totalSeconds)}
                              </td>
                              <td className="p-3.5 text-center">
                                <span className="font-black text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-md text-[11px]">
                                  ⭐ {training.accumulatedPoints.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-3.5 text-center">
                                {training.progressStatus === 'excellent' && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-black text-[10px] uppercase">
                                    Tiến bộ vượt bậc
                                  </span>
                                )}
                                {training.progressStatus === 'steady' && (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-black text-[10px] uppercase">
                                    Duy trì tốt
                                  </span>
                                )}
                                {training.progressStatus === 'needs_effort' && (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-black text-[10px] uppercase">
                                    Cần rèn luyện thêm
                                  </span>
                                )}
                                {training.progressStatus === 'new' && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md font-bold text-[10px] uppercase">
                                    Chưa tham gia
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => setInspectingStudent(s)}
                                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-black uppercase transition-all shadow-xs"
                                >
                                  Chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Chưa có học sinh trong lớp
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHI TIẾT RÈN LUYỆN & NHẬN XÉT CÁ NHÂN (Smart Evaluation Panel)     */}
      {/* ========================================================================= */}
      {inspectingStudent && selectedClass && (() => {
        const training = getStudentTrainingData(inspectingStudent);

        // Chuẩn bị dữ liệu biểu đồ cho học sinh bao gồm các bài chưa làm (0.00đ)
        const studentTimelineData: any[] = [];
        const studentResultsMap = new Map<string, Result[]>();
        training.studentResults.forEach(r => {
          const list = studentResultsMap.get(r.quizId) || [];
          list.push(r);
          studentResultsMap.set(r.quizId, list);
        });

        // 1. Duyệt qua tất cả các đề được giao cho lớp
        classAssignedQuizzes.forEach((q) => {
          const subs = studentResultsMap.get(q.id);
          if (subs && subs.length > 0) {
            const bestSub = [...subs].sort((a, b) => b.score - a.score)[0];
            const subDate = new Date(bestSub.submittedAt);
            studentTimelineData.push({
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
            studentTimelineData.push({
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

        // 2. Bổ sung các bài nộp khác của học sinh (nếu có đề ngoài lớp)
        training.studentResults.forEach(r => {
          if (!classAssignedQuizzes.some(q => q.id === r.quizId) && !studentTimelineData.some(item => item.quizId === r.quizId)) {
            const q = quizzes.find(item => item.id === r.quizId);
            const subDate = new Date(r.submittedAt);
            studentTimelineData.push({
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

        studentTimelineData.sort((a, b) => a.timestamp - b.timestamp);

        // Phổ điểm (Distribution data)
        const totalItems = studentTimelineData.length || 1;
        const distGroups = [
          { key: 'zero', name: '0.00đ (Bỏ thi / Chưa làm)', shortName: '0.0đ (Bỏ thi)', count: 0, color: '#f43f5e' },
          { key: 'under5', name: '< 5.0đ (Chưa đạt)', shortName: '< 5.0đ', count: 0, color: '#fb7185' },
          { key: '5to65', name: '5.0 - 6.4đ (Trung bình)', shortName: '5.0 - 6.4đ', count: 0, color: '#f59e0b' },
          { key: '65to8', name: '6.5 - 7.9đ (Khá)', shortName: '6.5 - 7.9đ', count: 0, color: '#3b82f6' },
          { key: '8to10', name: '8.0 - 10.0đ (Giỏi / Xuất sắc)', shortName: '8.0 - 10.0đ', count: 0, color: '#10b981' }
        ];

        studentTimelineData.forEach(item => {
          if (!item.isSubmitted || item.score === 0) distGroups[0].count++;
          else if (item.score < 5) distGroups[1].count++;
          else if (item.score < 6.5) distGroups[2].count++;
          else if (item.score < 8) distGroups[3].count++;
          else distGroups[4].count++;
        });

        const studentDistributionData = distGroups.map(g => ({
          ...g,
          percentage: studentTimelineData.length > 0 ? Math.round((g.count / totalItems) * 100) : 0
        }));

        return (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden border shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 rounded-xl">
                    <Award size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Kết Quả Rèn Luyện: {inspectingStudent.fullName}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Mã số: {inspectingStudent.studentCode || 'N/A'} • Lớp: {selectedClass.name} ({selectedClass.academicYear})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setInspectingStudent(null)}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                {/* 5 Stat Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-slate-50 border p-3 rounded-2xl text-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase block">Thời gian</span>
                    <span className="text-base font-black text-slate-900">{formatStudyTime(training.totalSeconds)}</span>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl text-center">
                    <span className="text-[9px] font-black text-indigo-600 uppercase block">Đã nộp / Giao</span>
                    <span className="text-base font-black text-indigo-700">{training.completedQuizzesCount}/{training.totalAssignedCount} đề</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-center">
                    <span className="text-[9px] font-black text-blue-600 uppercase block">ĐTB bài đã nộp</span>
                    <span className="text-base font-black text-blue-700">{training.avgSubmittedScore > 0 ? `${training.avgSubmittedScore.toFixed(2)}đ` : '-'}</span>
                  </div>
                  <div className={`border p-3 rounded-2xl text-center ${training.finalOfficialScore >= 8 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : training.finalOfficialScore >= 5 ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <span className="text-[9px] font-black uppercase block">ĐTB Tổng kết</span>
                    <span className="text-lg font-black block leading-none mt-1">{training.finalOfficialScore.toFixed(2)}đ</span>
                    <span className="text-[8px] font-medium opacity-80">(0đ bài bỏ)</span>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-2xl text-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black text-yellow-600 uppercase block">Điểm tích lũy</span>
                    <span className="text-base font-black text-yellow-700">⭐ {training.accumulatedPoints.toFixed(2)}</span>
                  </div>
                </div>

                {/* Smart AI / Teacher Feedback Box */}
                <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 font-black uppercase text-[11px]">
                    <Lightbulb size={16} className="text-amber-500" />
                    Đánh Giá Năng Lực & Kỷ Luật Học Tập (Nguyên tắc 0đ bài chưa nộp)
                  </div>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {training.progressFeedback}
                  </p>

                  {training.recommendedChapters.length > 0 && (
                    <div className="pt-2 border-t border-indigo-100 flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-black text-indigo-900">Chương cần ôn tập thêm:</span>
                      {training.recommendedChapters.map(ch => (
                        <span key={ch} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md font-bold">
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Biểu đồ Recharts thống kê tiến trình điểm số & phổ điểm */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                        <BarChart3 size={16} />
                      </div>
                      <div>
                        <h4 className="font-black uppercase text-slate-800 text-xs">
                          Biểu Đồ Tiến Trình & Lịch Sử Điểm (Tính 0đ các bài bỏ thi)
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold">
                          Đã làm {training.completedQuizzesCount}/{training.totalAssignedCount} đề • {training.uncompletedCount} đề chưa nộp (tính 0.00đ)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                      <button
                        onClick={() => setInspectingChartType('timeline')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                          inspectingChartType === 'timeline'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Tiến trình điểm
                      </button>
                      <button
                        onClick={() => setInspectingChartType('distribution')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                          inspectingChartType === 'distribution'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Phổ điểm
                      </button>
                    </div>
                  </div>

                  {studentTimelineData.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Chưa có dữ liệu đề thi được giao
                    </div>
                  ) : inspectingChartType === 'timeline' ? (
                    <div className="w-full h-56 pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={studentTimelineData}
                          margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="adminStudentAreaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
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
                                  <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl shadow-2xl border border-slate-700 max-w-xs text-xs z-50">
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
                            y={Number(training.finalOfficialScore.toFixed(2))}
                            stroke="#6366f1"
                            strokeWidth={1.5}
                            label={{ value: `ĐTB (${training.finalOfficialScore.toFixed(2)})`, position: 'insideLeft', fill: '#6366f1', fontSize: 9, fontWeight: 700 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            name="Điểm số"
                            stroke="#4f46e5"
                            strokeWidth={2.5}
                            fill="url(#adminStudentAreaGrad)"
                            activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              const isZero = !payload.isSubmitted || payload.score === 0;
                              const isGood = payload.score >= 8;
                              const fillColor = isZero ? '#f43f5e' : isGood ? '#10b981' : '#4f46e5';
                              return (
                                <circle
                                  key={`dot-${payload.id}`}
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
                          data={studentDistributionData}
                          margin={{ top: 15, right: 15, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
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
                            {studentDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Quizzes Completed vs Uncompleted */}
                <div className="space-y-3">
                  <h4 className="font-black uppercase text-slate-700 text-xs flex items-center gap-2">
                    <BookOpen size={14} className="text-indigo-600" />
                    Lịch Sử Đề Thi Đã Làm ({training.studentResults.length} lần nộp)
                  </h4>

                  {training.studentResults.length > 0 ? (
                    <div className="overflow-x-auto border rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400">
                            <th className="p-2.5">Tên đề thi</th>
                            <th className="p-2.5 text-center">Điểm số</th>
                            <th className="p-2.5 text-center">Thời gian làm</th>
                            <th className="p-2.5 text-center">Ngày nộp bài</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {training.studentResults.map((r, i) => {
                            const q = quizzes.find(item => item.id === r.quizId);
                            return (
                              <tr key={r.id || i} className="hover:bg-slate-50">
                                <td className="p-2.5 font-black text-slate-800">
                                  {q?.title || `Đề ${r.quizId.slice(0, 8)}`}
                                  {q?.category && <span className="block text-[10px] font-medium text-slate-400">{q.category}</span>}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={`font-black px-2 py-0.5 rounded-md text-[11px] ${r.score >= 8 ? 'bg-emerald-50 text-emerald-700' : r.score >= 5 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                                    {r.score.toFixed(2)}đ
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-medium text-slate-600">
                                  {formatStudyTime(r.durationSeconds || 0)}
                                </td>
                                <td className="p-2.5 text-center text-slate-400 text-[10px]">
                                  {formatDateStr(r.submittedAt)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed">
                      Học sinh chưa nộp bài thi nào
                    </div>
                  )}

                  {/* List of remaining assigned quizzes */}
                  {training.uncompletedQuizzes.length > 0 && (
                    <div className="pt-3">
                      <h4 className="font-black uppercase text-rose-800 text-xs mb-2 flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-rose-600" /> Các Đề Được Giao Chưa Hoàn Thành ({training.uncompletedQuizzes.length} đề — Tính 0.00 điểm):
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {training.uncompletedQuizzes.map(q => (
                          <div key={q.id} className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-bold text-rose-950 truncate max-w-[70%]">{q.title}</span>
                            <span className="text-[10px] font-black text-rose-700 uppercase bg-white px-2 py-0.5 rounded-md border border-rose-300 shadow-xs">
                              0.00đ (Bỏ thi)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-end">
                <button
                  onClick={() => setInspectingStudent(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-black"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT CLASS                                             */}
      {/* ========================================================================= */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden border shadow-2xl animate-scale-up">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <GraduationCap size={18} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-tight">
                  {editingClass ? 'Sửa thông tin Lớp học' : 'Tạo Lớp học mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1">
                  1. Tên Lớp (Ví dụ: 12A1, 11A2, 10A1...)
                </label>
                <input
                  className="w-full p-3 bg-slate-50 border rounded-xl font-black uppercase text-xs outline-none focus:border-indigo-500 transition-all"
                  value={classForm.name}
                  onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="VÍ DỤ: 12A1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                    2. Niên khóa
                  </label>
                  <input
                    className="w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs outline-none focus:border-indigo-500"
                    value={classForm.academicYear}
                    onChange={e => setClassForm({ ...classForm, academicYear: e.target.value })}
                    placeholder="2025-2026"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                    3. Khối
                  </label>
                  <select
                    className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs outline-none focus:border-indigo-500"
                    value={classForm.grade}
                    onChange={e => setClassForm({ ...classForm, grade: e.target.value as Grade })}
                  >
                    <option value="12">Khối 12</option>
                    <option value="11">Khối 11</option>
                    <option value="10">Khối 10</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                  4. Ghi chú / Trình độ phân loại (Tùy chọn)
                </label>
                <input
                  className="w-full p-3 bg-slate-50 border rounded-xl font-medium text-xs outline-none focus:border-indigo-500"
                  value={classForm.description}
                  onChange={e => setClassForm({ ...classForm, description: e.target.value })}
                  placeholder="Ví dụ: Trình độ Nâng cao, GVCN Thầy Tuấn..."
                />
              </div>

              <button
                onClick={handleSaveClass}
                disabled={isSaving}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all mt-2 disabled:opacity-50"
              >
                <Check size={16} /> {isSaving ? 'ĐANG LƯU...' : 'LƯU THÔNG TIN LỚP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD STUDENTS TO CLASS                                           */}
      {/* ========================================================================= */}
      {isAddStudentModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden border shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight">
                    Thêm học sinh vào Lớp {selectedClass.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Niên khóa {selectedClass.academicYear} • Khối {selectedClass.grade}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b shrink-0 flex gap-3 items-center bg-slate-50">
              <div className="flex-1 relative">
                <input
                  className="w-full p-2.5 bg-white border rounded-xl outline-none text-xs font-bold pl-8"
                  placeholder="Tìm học sinh theo tên hoặc MAHS..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              </div>
              <button
                onClick={() => {
                  if (selectedStudentIdsToAdd.length === availableStudentsToAdd.length) {
                    setSelectedStudentIdsToAdd([]);
                  } else {
                    setSelectedStudentIdsToAdd(availableStudentsToAdd.map(s => s.id));
                  }
                }}
                className="px-3 py-2 bg-white border rounded-xl text-[10px] font-black uppercase hover:bg-slate-100"
              >
                {selectedStudentIdsToAdd.length === availableStudentsToAdd.length ? 'Bỏ chọn' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-1.5">
              {availableStudentsToAdd.length > 0 ? (
                availableStudentsToAdd.map(s => {
                  const isChecked = selectedStudentIdsToAdd.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedStudentIdsToAdd(prev => 
                          prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id]
                        );
                      }}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${isChecked ? 'bg-indigo-50/80 border-indigo-300 shadow-xs' : 'bg-white hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1 rounded-md ${isChecked ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 uppercase text-xs">
                            {s.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Mã: <span className="font-mono text-blue-600 font-bold">{s.studentCode || 'N/A'}</span> • Khối {s.grade || '12'}
                            {s.className ? (
                              <span className="text-amber-600 ml-1">
                                (Hiện đang ở lớp: {s.className} - {s.academicYear || ''})
                              </span>
                            ) : (
                              <span className="text-slate-400 ml-1">(Chưa vào lớp nào)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-bold">
                  Không tìm thấy học sinh nào
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">
                Đã chọn: <strong className="text-indigo-600">{selectedStudentIdsToAdd.length}</strong> học sinh
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="px-4 py-2 bg-white border text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmAddStudents}
                  disabled={selectedStudentIdsToAdd.length === 0 || isAssigning}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase hover:bg-indigo-700 disabled:opacity-50 shadow-md flex items-center gap-1.5"
                >
                  <UserPlus size={14} /> {isAssigning ? 'Đang gán...' : 'Gán vào lớp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: BATCH PROMOTE / TRANSFER (Chuyển Niên Khóa / Thăng Lớp)          */}
      {/* ========================================================================= */}
      {isPromoteModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden border shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-5 bg-amber-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight">
                    Chuyển Niên Khóa / Thăng Lớp
                  </h3>
                  <p className="text-[10px] text-amber-100 font-bold">
                    Từ Lớp: <strong>{selectedClass.name} ({selectedClass.academicYear})</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPromoteModalOpen(false)}
                className="p-1.5 hover:bg-amber-700 rounded-xl transition-colors text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 leading-relaxed space-y-1">
                <p className="font-black uppercase text-[10px] text-amber-800">
                  💡 Giữ nguyên tài khoản & Lịch sử học tập
                </p>
                <p className="text-[11px]">
                  Khi chuyển sang niên khóa mới (Ví dụ từ <strong>11A1 (2025-2026)</strong> lên <strong>12A1 (2026-2027)</strong>), tài khoản đăng nhập, mật khẩu và toàn bộ điểm rèn luyện của học sinh sẽ <strong>được giữ nguyên</strong>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                  1. Chọn Lớp đích để chuyển tới:
                </label>
                <select
                  className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-xs outline-none focus:border-amber-500"
                  value={promoteTargetClassId}
                  onChange={e => setPromoteTargetClassId(e.target.value)}
                >
                  <option value="">-- CHỌN LỚP ĐÍCH --</option>
                  {classes
                    .filter(c => c.id !== selectedClass.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} • Niên khóa {c.academicYear} (Khối {c.grade})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">
                    2. Chọn học sinh cần chuyển ({selectedStudentIdsToPromote.length}/{classStudents.length}):
                  </label>
                  <button
                    onClick={() => {
                      if (selectedStudentIdsToPromote.length === classStudents.length) {
                        setSelectedStudentIdsToPromote([]);
                      } else {
                        setSelectedStudentIdsToPromote(classStudents.map(s => s.id));
                      }
                    }}
                    className="text-[10px] font-black text-amber-600 uppercase hover:underline"
                  >
                    {selectedStudentIdsToPromote.length === classStudents.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto border rounded-xl divide-y bg-slate-50">
                  {classStudents.map(s => {
                    const isChecked = selectedStudentIdsToPromote.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudentIdsToPromote(prev => 
                            prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`p-2.5 text-xs flex items-center justify-between cursor-pointer ${isChecked ? 'bg-amber-100/60 font-black text-slate-900' : 'text-slate-600'}`}
                      >
                        <div className="flex items-center gap-2">
                          {isChecked ? <CheckSquare size={15} className="text-amber-600" /> : <Square size={15} className="text-slate-300" />}
                          <span>{s.fullName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{s.studentCode}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t shrink-0 flex justify-end gap-2">
              <button
                onClick={() => setIsPromoteModalOpen(false)}
                className="px-4 py-2 bg-white border text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmPromote}
                disabled={!promoteTargetClassId || selectedStudentIdsToPromote.length === 0 || isAssigning}
                className="px-5 py-2 bg-amber-600 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-700 disabled:opacity-50 shadow-md flex items-center gap-1.5"
              >
                <ArrowRight size={14} /> {isAssigning ? 'Đang chuyển...' : `Chuyển ${selectedStudentIdsToPromote.length} HS`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
