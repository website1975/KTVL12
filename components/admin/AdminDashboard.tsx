
import { 
  getQuizzesMetadata, getQuizById, deleteQuiz, saveQuiz, updateQuiz, uploadQuizImage,
  getUsers, saveUser, deleteUser, changePassword, getUsersPage, saveUsersBatch,
  getResultsMetadata, getResultById, deleteResult, getResultsMetadataPage,
  getChapters, saveChapter, deleteChapter,
  getBankQuestions, saveBankQuestion,
  getClasses, saveClass, deleteClass, saveClassesBatch, assignStudentsToClass,
  clearLocalCache,
  isDatabaseConnected,
  syncAllQuizzesMetadata,
  syncQuizzesToBank,
  updateQuizTarget,
  batchUpdateQuizTarget,
  updateQuizAllowReview
} from '../../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF, parseQuestionsFromText } from '../../services/gemini';
import { normalizeFullText } from '../../services/vietnameseFixer';
import { Quiz, User, Result, Chapter, Question, QuestionType, Grade, QuizType, Role, ClassRoom } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { 
  LayoutDashboard, Users, BarChart3, ShieldAlert, Sparkles, FolderTree, 
  Plus, Database, Loader2, X, RefreshCw, AlertTriangle, FileUp, DatabaseZap, GraduationCap
} from 'lucide-react';

import QuizList from './QuizList';
import QuizEditor from './QuizEditor';
import StudentManager from './StudentManager';
import ResultsBoard from './ResultsBoard';
import ExamMonitor from './ExamMonitor';
import ChapterManager from './ChapterManager';
import QuestionBank from './QuestionBank';
import AIRenderer from './AIRenderer';
import ClassManager from './ClassManager';

import StudentModal from './StudentModal';
import StudentDetailModal from './StudentDetailModal';
import ResultHistoryModal from './ResultHistoryModal';
import ResultDetailModal from './ResultDetailModal';
import QuizPreviewModal from './QuizPreviewModal';

type AdminTab = 'quizzes' | 'classes' | 'students' | 'results' | 'monitor' | 'chapters' | 'bank' | 'ai';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('quizzes');
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingInProgress, setIsSavingInProgress] = useState(false);

  // Data states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [results, setResults] = useState<Result[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [resultsPage, setResultsPage] = useState(1);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);

  // Lazy loading data
  const loadTabData = useCallback(async (tab: AdminTab) => {
    if (!isDatabaseConnected()) return;
    setIsDataLoading(true);
    try {
      if (tab === 'quizzes') {
        const [q, c, r, cls] = await Promise.all([
          getQuizzesMetadata(), 
          getChapters(),
          getResultsMetadata(),
          getClasses()
        ]);
        setQuizzes(q);
        setChapters(c);
        setResults(r);
        setClasses(cls);
      } else if (tab === 'classes') {
        const [cls, u, q, r, c] = await Promise.all([
          getClasses(),
          getUsers(),
          getQuizzesMetadata(),
          getResultsMetadata(),
          getChapters()
        ]);
        setClasses(cls);
        setStudents(u.filter(user => user.role === 'student'));
        setQuizzes(q);
        setResults(r);
        setChapters(c);
      } else if (tab === 'students') {
        const [paged, r, q, cls] = await Promise.all([
          getUsersPage(1, 50),
          getResultsMetadata(),
          getQuizzesMetadata(),
          getClasses()
        ]);
        
        setStudents(paged.data.filter(user => user.role === 'student'));
        setStudentsTotal(paged.total);
        setStudentsPage(1);
        setResults(r);
        setQuizzes(q);
        setClasses(cls);
      } else if (tab === 'results') {
        const [paged, q, u, cls] = await Promise.all([
          getResultsMetadataPage(1, 50),
          getQuizzesMetadata(),
          getUsers(),
          getClasses()
        ]);
        setResults(paged.data);
        setResultsTotal(paged.total);
        setResultsPage(1);
        setQuizzes(q);
        setStudents(u.filter(user => user.role === 'student'));
        setClasses(cls);
      } else if (tab === 'bank') {
        const [b, c] = await Promise.all([
          getBankQuestions(),
          getChapters()
        ]);
        setBankQuestions(b);
        setChapters(c);
      } else if (tab === 'chapters') {
        const c = await getChapters();
        setChapters(c);
      }
    } catch (e) {
      console.error("Lỗi tải dữ liệu tab:", tab, e);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);

  const mainScrollRef = useRef<HTMLElement | null>(null);

  // Hỗ trợ cuộn phím Mũi tên lên/xuống, PageUp, PageDown, Space, Home, End khi click vào khoảng trống
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        (active as HTMLElement).isContentEditable
      );

      // Nếu người dùng đang gõ trong ô nhập liệu (input, textarea), để phím điều hướng con trỏ bình thường
      if (isInput) return;

      const scrollContainer = mainScrollRef.current;
      if (!scrollContainer) return;

      const SCROLL_STEP = 120; // Khoảng cách cuộn mượt mỗi lần bấm phím mũi tên
      const PAGE_STEP = scrollContainer.clientHeight * 0.85;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollContainer.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollContainer.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' });
      } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        e.preventDefault();
        scrollContainer.scrollBy({ top: PAGE_STEP, behavior: 'smooth' });
      } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        e.preventDefault();
        scrollContainer.scrollBy({ top: -PAGE_STEP, behavior: 'smooth' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMainClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('input, textarea, select, button, a, [role="button"], [contenteditable="true"]');
    if (!isInteractive) {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      mainScrollRef.current?.focus();
    }
  };

  // Quiz Editing
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizGrade, setQuizGrade] = useState<Grade>('12');
  const [quizType, setQuizType] = useState<QuizType>('test');
  const [isPublished, setIsPublished] = useState(false);
  const [isMonitored, setIsMonitored] = useState(false);
  const [isUnlisted, setIsUnlisted] = useState(false);
  const [targetType, setTargetType] = useState<'all' | 'classes'>('all');
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [maxAttempts, setMaxAttempts] = useState<number>(2);
  const [allowReview, setAllowReview] = useState<boolean>(false);
  const [duration, setDuration] = useState(45);
  const [orderIndex, setOrderIndex] = useState(1);
  const [category, setCategory] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Filters
  const [qSearch, setQSearch] = useState('');
  const [qGradeFilter, setQGradeFilter] = useState<Grade | 'all'>('all');
  const [qChapterFilter, setQChapterFilter] = useState('all');
  const [sSearch, setSSearch] = useState('');
  const [rSearch, setRSearch] = useState('');
  const [sGradeFilter, setSGradeFilter] = useState<Grade | 'all'>('all');
  const [rGradeFilter, setRGradeFilter] = useState<Grade | 'all'>('all');
  const [rChapterFilter, setRChapterFilter] = useState('all');
  const [rQuizFilter, setRQuizFilter] = useState('all');

  // Server-side filtering for results
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeTab === 'results' && isDatabaseConnected()) {
        setIsDataLoading(true);
        try {
          const paged = await getResultsMetadataPage(1, 50, rQuizFilter, rSearch);
          setResults(paged.data);
          setResultsTotal(paged.total);
          setResultsPage(1);
        } catch (e) {
          console.error("Lỗi lọc kết quả:", e);
        } finally {
          setIsDataLoading(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [rQuizFilter, rSearch, activeTab]);

  // Server-side filtering for students
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeTab === 'students' && isDatabaseConnected()) {
        setIsDataLoading(true);
        try {
          const paged = await getUsersPage(1, 50, sSearch);
          setStudents(paged.data.filter(u => u.role === 'student'));
          setStudentsTotal(paged.total);
          setStudentsPage(1);
        } catch (e) {
          console.error("Lỗi lọc học sinh:", e);
        } finally {
          setIsDataLoading(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sSearch, activeTab]);

  const [bGradeFilter, setBGradeFilter] = useState<Grade | 'all'>('all');
  const [bChapterFilter, setBChapterFilter] = useState('all');
  const [bTypeFilter, setBTypeFilter] = useState<QuestionType | 'all'>('all');
  const [bSearch, setBSearch] = useState('');

  // Alert and Confirmation Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  const showAlert = useCallback((title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info', onConfirm?: () => void) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      confirmText: 'Đóng',
      onConfirm: () => {
        setAlertModal(null);
        if (onConfirm) onConfirm();
      }
    });
  }, []);

  const showConfirm = useCallback((
    title: string, 
    message: string, 
    onConfirm: () => void, 
    onCancel?: () => void,
    confirmText: string = 'Xác nhận',
    cancelText: string = 'Hủy'
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type: 'warning',
      confirmText,
      cancelText,
      onConfirm: () => {
        setAlertModal(null);
        onConfirm();
      },
      onCancel: () => {
        setAlertModal(null);
        if (onCancel) onCancel();
      }
    });
  }, []);

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentForm, setStudentForm] = useState<{
    fullName: string;
    studentCode: string;
    grade: Grade;
    password: string;
    classId?: string;
    className?: string;
    academicYear?: string;
  }>({ fullName: '', studentCode: '', grade: '12' as Grade, password: '123' });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [historyData, setHistoryData] = useState<{ studentName: string, studentCode: string, quizTitle: string, history: Result[] } | null>(null);
  const [selectedResultDetail, setSelectedResultDetail] = useState<{ result: Result, quiz: Quiz } | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [isBankLoading, setIsBankLoading] = useState(false);

  const loadBankDataIfNeeded = useCallback(async () => {
    if (!isDatabaseConnected()) return;
    if (bankQuestions.length === 0) {
      setIsBankLoading(true);
      try {
        const [b, c] = await Promise.all([
          getBankQuestions(),
          getChapters()
        ]);
        setBankQuestions(b);
        if (c && c.length > 0) setChapters(c);
      } catch (e) {
        console.error("Lỗi tải ngân hàng câu hỏi:", e);
      } finally {
        setIsBankLoading(false);
      }
    }
  }, [bankQuestions.length]);

  const allAvailableQuestions = useMemo(() => {
    return bankQuestions;
  }, [bankQuestions]);

  // Quiz Handlers
  const handleCreateQuiz = () => {
    setEditingQuizId(null); setQuizTitle(''); setQuizGrade('12'); setQuizType('test');
    setIsPublished(false); setIsMonitored(false); setIsUnlisted(false);
    setTargetType('all'); setAssignedClassIds([]); setMaxAttempts(2); setAllowReview(false);
    setDuration(45); setOrderIndex(1); setCategory('');
    setStartTime(''); setEndTime(''); setQuestions([]); setIsEditingQuiz(true);
    setActiveTab('quizzes');
  };

  const handleEditQuiz = async (quiz: Quiz) => {
    setIsDataLoading(true);
    try {
        const fullQuiz = await getQuizById(quiz.id);
        if (fullQuiz) {
            setEditingQuizId(fullQuiz.id); setQuizTitle(fullQuiz.title); setQuizGrade(fullQuiz.grade);
            setQuizType(fullQuiz.type); setIsPublished(fullQuiz.isPublished); setIsMonitored(fullQuiz.isMonitored || false);
            setIsUnlisted(fullQuiz.isUnlisted || false);
            setTargetType(fullQuiz.targetType || 'all');
            setAssignedClassIds(fullQuiz.assignedClassIds || []);
            setMaxAttempts(fullQuiz.maxAttempts ?? 2);
            setAllowReview(fullQuiz.allowReview ?? (fullQuiz.type === 'practice'));
            setDuration(fullQuiz.durationMinutes); setOrderIndex(fullQuiz.orderIndex || 1); setCategory(fullQuiz.category || ''); setStartTime(fullQuiz.startTime || '');
            setEndTime(fullQuiz.endTime || ''); setQuestions(fullQuiz.questions); setIsEditingQuiz(true);
            setActiveTab('quizzes');
        }
    } finally {
        setIsDataLoading(false);
    }
  };

  const handlePreviewQuiz = async (quiz: Quiz) => {
    setIsDataLoading(true);
    try {
        const fullQuiz = await getQuizById(quiz.id);
        if (fullQuiz) setPreviewQuiz(fullQuiz);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleViewResultDetail = async (res: Result) => {
    setIsDataLoading(true);
    try {
        const [fullResult, fullQuiz] = await Promise.all([
            getResultById(res.id),
            getQuizById(res.quizId)
        ]);
        if (fullResult && fullQuiz) {
            setSelectedResultDetail({ result: fullResult, quiz: fullQuiz });
        } else {
            alert("Không tìm thấy dữ liệu chi tiết cho kết quả này.");
        }
    } catch (e) {
        console.error("Error loading result detail:", e);
        alert("Lỗi khi tải chi tiết bài làm.");
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleSyncAllQuizzes = async () => {
    if (!confirm("Hệ thống sẽ quét lại toàn bộ đề thi để cập nhật chính xác số câu hỏi. Tiếp tục?")) return;
    setIsSyncing(true);
    try {
      const count = await syncAllQuizzesMetadata();
      alert(`Đã đồng bộ thành công ${count} đề thi!`);
      loadTabData('quizzes');
    } catch (e) {
      alert("Lỗi khi đồng bộ dữ liệu.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncBank = async (forceAll: boolean = false) => {
    const confirmMsg = forceAll 
      ? "Hệ thống sẽ quét lại TOÀN BỘ đề thi (bất kể đã đồng bộ hay chưa) và đối chiếu khử trùng lặp vào Ngân hàng. Tiếp tục?" 
      : "Hệ thống sẽ quét các đề thi MỚI CHƯA ĐỒNG BỘ, tự động khử trùng lặp và đẩy vào Ngân hàng câu hỏi. Tiếp tục?";
    if (!confirm(confirmMsg)) return;
    setIsSyncing(true);
    try {
      const stats = await syncQuizzesToBank(forceAll);
      if (stats.syncedQuizzesCount === 0) {
        showAlert(
          "Dữ liệu đã cập nhật",
          `Tất cả đề thi (${stats.totalQuizzes} đề) đều đã được đồng bộ vào Ngân hàng từ trước. Không có đề thi mới nào cần quét.`,
          "info"
        );
      } else {
        showAlert(
          "Đồng bộ Ngân hàng thành công",
          `Đã quét ${stats.syncedQuizzesCount} đề thi mới (${stats.total} câu hỏi):\n• Thêm mới vào Ngân hàng: ${stats.added} câu\n• Cập nhật thông tin: ${stats.updated} câu\n• Đã có sẵn (bỏ qua trùng lặp): ${stats.skipped} câu\n• Đã gắn cờ đồng bộ cho ${stats.syncedQuizzesCount} đề thi.`,
          "success"
        );
      }
      loadTabData('bank');
    } catch (e) {
      showAlert("Lỗi đồng bộ", "Có lỗi xảy ra khi đồng bộ ngân hàng câu hỏi.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAiGenerate = async (config: {
    topic: string;
    p1: number;
    p2: number;
    p3: number;
    target: 'editor' | 'bank';
    matrix?: { easy: number; medium: number; hard: number; vhard: number };
    pdfBase64?: string;
  }) => {
    setIsAiLoading(true);
    try {
      const newQs = await generateQuizFromPrompt({
        topic: config.topic,
        grade: quizGrade,
        part1Count: config.p1,
        part2Count: config.p2,
        part3Count: config.p3,
        matrix: config.matrix,
        pdfBase64: config.pdfBase64
      });
      
      if (config.target === 'editor') {
        setQuestions([...questions, ...newQs]);
        setActiveTab('quizzes');
        setIsEditingQuiz(true);
        if (!quizTitle) setQuizTitle(config.topic.slice(0, 50).toUpperCase());
      } else {
        for (const q of newQs) {
          await saveBankQuestion(q);
        }
        alert(`Đã lưu ${newQs.length} câu hỏi mới vào Ngân hàng!`);
        loadTabData('bank');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle) return alert("Vui lòng nhập tiêu đề đề thi!");
    if (questions.length === 0) return alert("Đề thi chưa có câu hỏi nào!");
    
    setIsSavingInProgress(true);
    const quiz: Quiz = {
      id: editingQuizId || uuidv4(), title: quizTitle, grade: quizGrade, type: quizType,
      isPublished, isMonitored, isUnlisted, durationMinutes: duration, orderIndex, category, startTime, endTime,
      targetType, assignedClassIds, maxAttempts: maxAttempts || 2,
      allowReview: quizType === 'practice' ? true : allowReview,
      questions, createdAt: new Date().toISOString(), description: ''
    };
    
    try {
      if (editingQuizId) {
          await updateQuiz(quiz);
      } else {
          await saveQuiz(quiz);
      }
      setIsEditingQuiz(false);
      await loadTabData('quizzes');
      alert("Đã lưu đề thi thành công vào Database Cloud!");
    } catch (e: any) { 
      alert("Lỗi khi lưu đề thi: " + (e.message || "Không xác định"));
    } finally {
      setIsSavingInProgress(false);
    }
  };

  const handleToggleAllowReview = async (quizId: string, currentAllowReview: boolean) => {
    const newStatus = !currentAllowReview;
    try {
      await updateQuizAllowReview(quizId, newStatus);
      setQuizzes(prev => prev.map(q => q.id === quizId ? { ...q, allowReview: newStatus } : q));
      showAlert(
        newStatus ? "Đã mở đáp án" : "Đã khóa đáp án",
        newStatus 
          ? "Học sinh hiện đã có thể xem lại chi tiết đáp án & lời giải của đề thi này." 
          : "Đã ẩn toàn bộ đáp án và lời giải chi tiết. Học sinh chỉ thấy điểm tổng kết (chống lộ đề).",
        "success"
      );
    } catch (e: any) {
      showAlert("Lỗi", "Không thể cập nhật quyền xem đáp án: " + (e.message || "Không xác định"), "error");
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa vĩnh viễn đề thi này không?")) { 
        setIsDataLoading(true);
        try {
            await deleteQuiz(id); 
            await loadTabData('quizzes');
            alert("Đã xóa đề thi thành công.");
        } catch (e: any) {
            alert("Lỗi khi xóa đề thi: " + (e.message || "Không xác định"));
        } finally {
            setIsDataLoading(false);
        }
    }
  };

  const handleQuickAssignTarget = async (quizIds: string[], targetType: 'all' | 'classes', assignedClassIds: string[]) => {
    try {
      if (quizIds.length === 1) {
        await updateQuizTarget(quizIds[0], targetType, assignedClassIds);
      } else {
        await batchUpdateQuizTarget(quizIds, targetType, assignedClassIds);
      }
      // Cập nhật ngay trên state local để phản hồi tức thì
      setQuizzes(prev => prev.map(q => {
        if (quizIds.includes(q.id)) {
          return {
            ...q,
            targetType,
            assignedClassIds: targetType === 'classes' ? assignedClassIds : []
          };
        }
        return q;
      }));
      alert(`Đã cập nhật phân quyền phòng/lớp cho ${quizIds.length} đề thi thành công!`);
    } catch (error: any) {
      alert("Lỗi khi cập nhật phân quyền: " + (error.message || "Không xác định"));
    }
  };

  const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAiLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newQs = await parseQuestionsFromPDF(base64);
        setQuestions([...questions, ...newQs]);
        setIsAiLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) { alert(error.message); setIsAiLoading(false); }
  };

  const handleTextExtract = async (text: string) => {
      if (!text.trim()) return;
      setIsAiLoading(true);
      try {
          const newQs = await parseQuestionsFromText(text);
          setQuestions([...questions, ...newQs]);
      } catch (error: any) {
          alert(error.message);
      } finally {
          setIsAiLoading(false);
      }
  };

  const handleUploadImage = async (id: string, f: File) => {
    setUploadingId(id);
    const url = await uploadQuizImage(f);
    if (url) setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q));
    setUploadingId(null);
  };

  const handleCleanLabels = () => {
    const stripLabel = (text: string): string => {
        if (!text) return "";
        let cleaned = normalizeFullText(text.trim());
        const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
        while (labelRegex.test(cleaned)) {
            cleaned = cleaned.replace(labelRegex, "").trim();
        }
        return cleaned;
    };

    const cleanedQuestions = questions.map(q => {
        const newQ = { ...q };
        newQ.text = stripLabel(q.text);
        if (q.solution) newQ.solution = normalizeFullText(q.solution);
        
        if (q.options) {
            newQ.options = q.options.map(opt => stripLabel(opt));
        }

        if (q.type === 'mcq' && q.correctAnswer && q.options) {
            const currentAns = q.correctAnswer.trim();
            const cleanAns = stripLabel(currentAns);
            
            // Nếu đáp án hiện tại là một nhãn đơn lẻ (A, B, C, D)
            const matchLabel = currentAns.match(/^[A-D][\.\)\s]*$/i);
            if (matchLabel) {
                const label = matchLabel[0].charAt(0).toUpperCase();
                const index = label.charCodeAt(0) - 65;
                if (q.options[index]) {
                    newQ.correctAnswer = stripLabel(q.options[index]);
                }
            } else {
                newQ.correctAnswer = cleanAns;
            }
        }

        if (q.subQuestions) {
            newQ.subQuestions = q.subQuestions.map(sq => ({
                ...sq,
                text: stripLabel(sq.text)
            }));
        }
        return newQ;
    });

    setQuestions(cleanedQuestions);
    showAlert("Thành công", "Đã chuẩn hóa dấu tiếng Việt, sửa lỗi vỡ chữ và dọn dẹp nhãn cho toàn bộ câu hỏi!", "success");
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDataLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (resultsObj: any) => {
        setIsDataLoading(false);
        const data = resultsObj.data as any[];
        if (!data || data.length === 0) {
          showAlert("Không có dữ liệu", "File CSV rỗng hoặc không đúng định dạng.", "error");
          e.target.value = '';
          return;
        }

        const firstRow = data[0];
        const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
        
        // Cụ thể hóa kiểm tra file học sinh
        const isUserFile = headers.includes('role') || 
                           headers.includes('student_code') || 
                           headers.includes('studentcode') || 
                           headers.includes('mahs') || 
                           headers.includes('hoten');
                           
        const isResultFile = headers.includes('score') || headers.includes('quiz_id') || headers.includes('quizid');

        if (isUserFile) {
          const parsedUsers: User[] = data.map(row => {
            const getVal = (keys: string[]) => {
              for (const k of keys) {
                const foundKey = Object.keys(row).find(x => x.toLowerCase().trim() === k.toLowerCase().trim());
                if (foundKey && row[foundKey] !== undefined) {
                  return String(row[foundKey]).trim();
                }
              }
              return '';
            };

            const rawMahs = getVal(['mahs', 'studentCode', 'student_code', 'studentcode']);
            const fullName = getVal(['hoten', 'fullName', 'full_name', 'fullname']) || 'Học sinh';
            const grade = (getVal(['khoi', 'grade']) || '12') as Grade;
            const password = getVal(['pass', 'password']) || '123';
            const role = (getVal(['role']) || 'student') as Role;
            const rawClassName = getVal(['lop', 'class', 'className', 'classname']);
            const rawAcademicYear = getVal(['nienkhoa', 'academicYear', 'academic_year', 'namhoc']);

            const studentCode = rawMahs.toUpperCase();
            const username = studentCode.toLowerCase();

            // Tìm class tương ứng nếu có
            let matchedClass = classes.find(c => 
              c.name.trim().toLowerCase() === rawClassName.trim().toLowerCase() &&
              (!rawAcademicYear || c.academicYear.trim() === rawAcademicYear.trim())
            );

            return {
              id: String(row.id || uuidv4()),
              username,
              password,
              role,
              fullName,
              studentCode,
              grade: (matchedClass ? matchedClass.grade : grade) as Grade,
              classId: matchedClass?.id || (row.classId || row.class_id || undefined),
              className: matchedClass?.name || (rawClassName || undefined),
              academicYear: matchedClass?.academicYear || (rawAcademicYear || undefined),
              points: Number(row.points || 0)
            };
          }).filter(u => u.role === 'student' && u.studentCode);

          if (parsedUsers.length === 0) {
            showAlert(
              "Định dạng không khớp", 
              "Không tìm thấy học sinh hợp lệ. Yêu cầu file CSV chứa các cột thông tin: Mahs (hoặc studentCode), Hoten (hoặc fullName), khoi (hoặc grade), pass (hoặc password).", 
              "error"
            );
            e.target.value = '';
            return;
          }

          if (isDatabaseConnected()) {
            showConfirm(
              "Nạp học sinh từ CSV",
              `Bạn đang kết nối Cloud. Bạn có chắc chắn muốn nạp và lưu trữ vĩnh viễn ${parsedUsers.length} học sinh này vào Database Cloud? Các học sinh có mã số trùng lặp sẽ tự động cập nhật thông tin mới.`,
              async () => {
                setIsDataLoading(true);
                try {
                  await saveUsersBatch(parsedUsers);
                  await loadTabData('students');
                  showAlert(
                    "Thành công", 
                    `Đã nạp và lưu thành công ${parsedUsers.length} học sinh lên Database Cloud!`, 
                    "success"
                  );
                } catch (err: any) {
                  showAlert("Lỗi", "Không thể lưu học sinh lên Database: " + err.message, "error");
                } finally {
                  setIsDataLoading(false);
                }
              },
              undefined,
              "Đồng ý lưu Cloud",
              "Hủy"
            );
          } else {
            setStudents(parsedUsers);
            setStudentsTotal(parsedUsers.length);
            showAlert(
              "Đã tải tạm thời", 
              `Đã tải tạm thời ${parsedUsers.length} học sinh vào bộ nhớ (Chưa lưu trữ Cloud vì mất kết nối Database).`, 
              "success"
            );
          }
        } else if (isResultFile) {
          // File kết quả thi
          const parsedResults = data.map(row => {
            const sId = row.studentId || row.student_id;
            const scStr = String(row.studentCode || row.student_code || "").trim();
            return {
              ...row,
              id: row.id || uuidv4(),
              quizId: row.quizId || row.quiz_id,
              studentId: sId,
              studentCode: scStr || 'N/A',
              studentName: row.studentName || row.student_name || row.full_name || 'Học sinh',
              score: Number(row.score || 0),
              submittedAt: row.submittedAt || row.submitted_at || new Date().toISOString()
            };
          });

          setResults(parsedResults);
          setResultsTotal(parsedResults.length);
          showAlert("Thành công", `Đã tải ${parsedResults.length} kết quả thi từ file CSV.`, "success");
        } else {
          showAlert(
            "Không thể nhận diện", 
            "Định dạng file CSV không được hỗ trợ. Hãy sử dụng các cột tiêu đề sau: Mahs, Hoten, khoi, pass.", 
            "error"
          );
        }
        e.target.value = '';
      },
      error: (err: any) => {
        setIsDataLoading(false);
        showAlert("Lỗi đọc file", "Không thể parse file CSV: " + err.message, "error");
        e.target.value = '';
      }
    });
  };

  const handleSaveStudent = async () => {
    if (!studentForm.fullName || !studentForm.studentCode) {
      return showAlert("Thiếu thông tin", "Vui lòng điền đủ thông tin học sinh!", "warning");
    }
    
    const code = studentForm.studentCode.trim().toUpperCase();
    
    // Kiểm tra trùng mã học sinh (MAHS)
    const isDuplicate = students.some(s => s.studentCode === code && s.id !== selectedStudent?.id);
    if (isDuplicate) {
      return showAlert("Trùng mã số học sinh", `Mã học sinh "${code}" đã tồn tại trong hệ thống. Vui lòng kiểm tra lại!`, "error");
    }

    setIsSavingStudent(true);
    try {
      const newUser: User = {
        id: selectedStudent?.id || uuidv4(), username: code.toLowerCase(),
        password: studentForm.password, role: 'student', fullName: studentForm.fullName,
        studentCode: code, grade: studentForm.grade,
        classId: studentForm.classId,
        className: studentForm.className,
        academicYear: studentForm.academicYear,
        points: selectedStudent?.points || 0
      };
      await saveUser(newUser); setIsStudentModalOpen(false); loadTabData('students');
      showAlert("Thành công", `Đã lưu học sinh ${studentForm.fullName} thành công!`, "success");
    } catch (e: any) { 
      showAlert("Lỗi", "Lỗi lưu học sinh trên Cloud", "error"); 
    } finally { 
      setIsSavingStudent(false); 
    }
  };

  const handleBulkAssignClass = async (studentIds: string[], classInfo: any) => {
    setIsDataLoading(true);
    try {
      if (classInfo) {
        await assignStudentsToClass(studentIds, {
          classId: classInfo.classId,
          className: classInfo.className,
          academicYear: classInfo.academicYear,
          grade: classInfo.grade
        });
      } else {
        await assignStudentsToClass(studentIds, null);
      }
      await loadTabData('students');
      showAlert("Thành công", `Đã cập nhật phân lớp cho ${studentIds.length} học sinh!`, "success");
    } catch (e: any) {
      showAlert("Lỗi", "Không thể phân lớp: " + (e.message || "Lỗi không xác định"), "error");
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    showConfirm(
      "Xác nhận xóa học sinh",
      `CẢNH BÁO: Xóa học sinh "${name}" sẽ xóa vĩnh viễn toàn bộ lịch sử bài làm của học sinh này trên Database. Bạn có chắc chắn muốn tiếp tục?`,
      async () => {
        await handleDeleteStudentsBatch([id]);
      }
    );
  };

  const handleDeleteResultBatch = async (resultsToDelete: Result[]) => {
    setIsDataLoading(true);
    try {
        await Promise.all(resultsToDelete.map(r => deleteResult(r.id)));
        await loadTabData('results');
        showAlert("Thành công", `Đã xóa thành công ${resultsToDelete.length} bản ghi kết quả thi.`, "success");
    } catch (e: any) {
        showAlert("Lỗi", "Lỗi khi xóa kết quả: " + e.message, "error");
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteStudentsBatch = async (studentIds: string[]) => {
    setIsDataLoading(true);
    try {
        await Promise.all(studentIds.map(id => deleteUser(id)));
        await loadTabData('students');
        showAlert("Thành công", `Đã xóa thành công ${studentIds.length} học sinh.`, "success");
    } catch (e: any) {
        showAlert("Lỗi", "Lỗi khi xóa học sinh: " + e.message, "error");
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleResetPassword = async (student: User) => {
    const defaultPass = '123';
    showConfirm(
      "Đặt lại mật khẩu",
      `Đặt lại mật khẩu cho học sinh "${student.fullName}" về mặc định "${defaultPass}"?`,
      async () => {
        setIsDataLoading(true);
        try {
          const success = await changePassword(student.id, defaultPass);
          if (success) {
            showAlert("Thành công", `Đã đặt lại mật khẩu cho ${student.fullName} thành công về "123"!`, "success");
            loadTabData('students');
          } else {
            showAlert("Thất bại", "Có lỗi xảy ra khi đặt lại mật khẩu trên Cloud.", "error");
          }
        } catch (e: any) {
          showAlert("Lỗi", "Lỗi: " + e.message, "error");
        } finally {
          setIsDataLoading(false);
        }
      }
    );
  };

  const handleLoadMoreStudents = async () => {
    setIsDataLoading(true);
    try {
      const nextPage = studentsPage + 1;
      const paged = await getUsersPage(nextPage, 50, sSearch);
      setStudents(prev => [...prev, ...paged.data.filter(u => u.role === 'student')]);
      setStudentsPage(nextPage);
      setStudentsTotal(paged.total);
    } catch (e) {
      console.error("Lỗi tải thêm học sinh:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleLoadMoreResults = async () => {
    setIsDataLoading(true);
    try {
      const nextPage = resultsPage + 1;
      const paged = await getResultsMetadataPage(nextPage, 50, rQuizFilter, rSearch);
      setResults(prev => [...prev, ...paged.data]);
      setResultsPage(nextPage);
      setResultsTotal(paged.total);
    } catch (e) {
      console.error("Lỗi tải thêm kết quả:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  const dbConnected = isDatabaseConnected();

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-16 lg:w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-all">
        <div className="p-4 lg:p-8 border-b border-white/10 text-center lg:text-left">
          <h2 className="text-xl font-black uppercase tracking-tighter italic">
            <span className="hidden lg:inline">TNMenu<span className="text-blue-500">_U60</span></span>
            <span className="lg:hidden text-blue-500">EQ</span>
          </h2>
        </div>
        <nav className="flex-1 p-2 lg:p-4 space-y-1 mt-4">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'Đề thi' },
            { id: 'classes', icon: GraduationCap, label: 'Lớp học' },
            { id: 'ai', icon: Sparkles, label: 'AI Soạn đề' },
            { id: 'students', icon: Users, label: 'Học sinh' },
            { id: 'results', icon: BarChart3, label: 'Bảng điểm' },
            { id: 'monitor', icon: ShieldAlert, label: 'Giám sát' },
            { id: 'chapters', icon: FolderTree, label: 'Chương' },
            { id: 'bank', icon: Database, label: 'Ngân hàng' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as AdminTab); setIsEditingQuiz(false); }}
              className={`w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <tab.icon size={18}/> <span className="hidden lg:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main 
        ref={mainScrollRef}
        tabIndex={-1}
        onClick={handleMainClick}
        className="flex-1 h-screen overflow-y-auto custom-scrollbar bg-slate-50 outline-none focus:outline-none"
      >
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto">
          {!dbConnected && (
            <div className="mb-8 bg-red-50 border-2 border-red-100 p-8 rounded-[3rem] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-red-600 text-white rounded-[1.5rem] shadow-lg"><AlertTriangle size={28}/></div>
                    <div>
                        <h4 className="text-red-900 font-black uppercase text-sm">Hệ thống đang mất kết nối Database</h4>
                        <p className="text-red-700 text-[10px] font-bold uppercase tracking-tight mt-1 leading-tight">Bạn không thể tải dữ liệu từ Cloud. Vui lòng sử dụng file CSV đã export từ Supabase để xem tạm thời.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 px-8 py-4 bg-white text-red-600 border border-red-200 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase shadow-sm cursor-pointer">
                        <FileUp size={16}/> Chọn file CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv}/>
                    </label>
                </div>
            </div>
          )}

          {activeTab === 'quizzes' && (
            isEditingQuiz ? (
              <>
                {isSavingInProgress && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[3000] flex items-center justify-center">
                        <div className="bg-white p-10 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4">
                            <Loader2 className="animate-spin text-blue-600" size={48}/>
                            <p className="font-black uppercase text-xs tracking-widest text-slate-800">Đang ghi dữ liệu vào Cloud...</p>
                        </div>
                    </div>
                )}
                <QuizEditor
                    editingId={editingQuizId} title={quizTitle} setTitle={setQuizTitle}
                    grade={quizGrade} setGrade={setQuizGrade} quizType={quizType} setQuizType={setQuizType}
                    isPublished={isPublished} setIsPublished={setIsPublished} isMonitored={isMonitored} setIsMonitored={setIsMonitored}
                    isUnlisted={isUnlisted} setIsUnlisted={setIsUnlisted}
                    targetType={targetType} setTargetType={setTargetType}
                    assignedClassIds={assignedClassIds} setAssignedClassIds={setAssignedClassIds}
                    classes={classes}
                    maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts}
                    allowReview={allowReview} setAllowReview={setAllowReview}
                    duration={duration} setDuration={setDuration} category={category} setCategory={setCategory}
                    orderIndex={orderIndex} setOrderIndex={setOrderIndex}
                    startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime}
                    questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSaveQuiz}
                    onCleanLabels={handleCleanLabels}
                    onOpenBank={(type) => { 
                        setBTypeFilter(type); 
                        setBGradeFilter(quizGrade); 
                        loadBankDataIfNeeded();
                        setIsBankOpen(true); 
                    }}
                    onPdfExtract={handlePdfExtract} onTextExtract={handleTextExtract} onUploadImage={handleUploadImage} uploadingId={uploadingId} isAiLoading={isAiLoading}
                />
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h1 className="text-xl font-black text-slate-800 uppercase italic">QUẢN LÝ ĐỀ THI</h1>
                   <div className="flex gap-3">
                      <button 
                        onClick={handleSyncAllQuizzes} 
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 text-slate-500 rounded-xl font-black uppercase text-[10px] shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                      >
                         {isSyncing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                         CẬP NHẬT SỐ CÂU
                      </button>
                      <button onClick={handleCreateQuiz} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-black transition-all">
                          <Plus size={16}/> TẠO ĐỀ MỚI
                      </button>
                   </div>
                </div>
                {isDataLoading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40}/><p className="mt-4 text-[10px] font-black uppercase text-slate-400">Đang tải Cloud...</p></div>
                ) : (
                    <QuizList 
                        quizzes={quizzes} results={results} chapters={chapters} classes={classes}
                        onEdit={handleEditQuiz} onDelete={handleDeleteQuiz} onPreview={handlePreviewQuiz}
                        onQuickAssignTarget={handleQuickAssignTarget}
                        onToggleAllowReview={handleToggleAllowReview}
                        qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter}
                        qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter}
                    />
                )}
              </div>
            )
          )}

          {activeTab === 'classes' && (
            <ClassManager 
              classes={classes}
              students={students}
              quizzes={quizzes}
              results={results}
              chapters={chapters}
              onSaveClass={async (c) => {
                await saveClass(c);
                await loadTabData('classes');
              }}
              onDeleteClass={async (id, name) => {
                showConfirm(
                  "Xác nhận xóa lớp học",
                  `Bạn có chắc chắn muốn xóa lớp "${name}" không? Học sinh thuộc lớp này sẽ không bị xóa khỏi hệ thống mà chỉ gỡ liên kết lớp.`,
                  async () => {
                    await deleteClass(id);
                    await loadTabData('classes');
                  }
                );
              }}
              onAssignStudents={async (studentIds, classInfo) => {
                await assignStudentsToClass(studentIds, classInfo);
                await loadTabData('classes');
              }}
              onRefresh={() => loadTabData('classes')}
            />
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
                <h1 className="text-xl font-black text-slate-800 uppercase italic">SOẠN ĐỀ THÔNG MINH</h1>
                <AIRenderer 
                    grade={quizGrade} 
                    setGrade={setQuizGrade} 
                    onGenerate={handleAiGenerate}
                    isLoading={isAiLoading}
                    hasQuestionsInEditor={questions.length > 0}
                />
            </div>
          )}

          {activeTab === 'students' && (
            <div className="space-y-6">
                <h1 className="text-xl font-black text-slate-800 uppercase italic">DANH SÁCH HỌC SINH</h1>
                {isDataLoading && students.length === 0 ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40}/><p className="mt-4 text-[10px] font-black uppercase text-slate-400">Đang tải...</p></div>
                ) : (
                    <StudentManager 
                        students={students} results={results} quizzes={quizzes} classes={classes}
                        sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter}
                        onRefresh={() => loadTabData('students')}
                        onAdd={() => { setSelectedStudent(null); setStudentForm({fullName: '', studentCode: '', grade: '12', password: '123', classId: '', className: '', academicYear: ''}); setIsStudentModalOpen(true); }}
                        onImportCsv={handleImportCsv} onViewDetail={setViewingStudent}
                        onEdit={(u) => { setSelectedStudent(u); setStudentForm({fullName: u.fullName, studentCode: u.studentCode || '', grade: u.grade || '12', password: u.password, classId: u.classId || '', className: u.className || '', academicYear: u.academicYear || ''}); setIsStudentModalOpen(true); }}
                        onDelete={handleDeleteStudent} 
                        onBulkDelete={handleDeleteStudentsBatch}
                        onResetPassword={handleResetPassword}
                        onBulkAssignClass={handleBulkAssignClass}
                        totalCount={studentsTotal}
                        onLoadMore={handleLoadMoreStudents}
                        isMoreLoading={isDataLoading}
                    />
                )}
            </div>
          )}

          {activeTab === 'results' && (
             <div className="space-y-6">
                <h1 className="text-xl font-black text-slate-800 uppercase italic">KẾT QUẢ HỌC TẬP</h1>
                {isDataLoading && results.length === 0 ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40}/><p className="mt-4 text-[10px] font-black uppercase text-slate-400">Đang tải...</p></div>
                ) : (
                    <ResultsBoard 
                        results={results} quizzes={quizzes} users={students} chapters={chapters}
                        rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter}
                        rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter}
                        rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter}
                        rSearch={rSearch} setRSearch={setRSearch}
                        onRefresh={() => loadTabData('results')}
                        onClearCache={clearLocalCache}
                        onViewHistory={(name, code, title, history) => setHistoryData({ studentName: name, studentCode: code, quizTitle: title, history })}
                        onDeleteResult={handleDeleteResultBatch}
                        onImportCsv={handleImportCsv}
                        totalCount={resultsTotal}
                        onLoadMore={handleLoadMoreResults}
                        isMoreLoading={isDataLoading}
                    />
                )}
             </div>
          )}

          {activeTab === 'monitor' && <ExamMonitor />}
          {activeTab === 'chapters' && (
            <ChapterManager chapters={chapters} onSave={async (c) => { await saveChapter(c); loadTabData('chapters'); }} onDelete={async (id) => { await deleteChapter(id); loadTabData('chapters'); }} />
          )}
          {activeTab === 'bank' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <h1 className="text-xl font-black text-slate-800 uppercase italic">NGÂN HÀNG CÂU HỎI</h1>
                   <button 
                      onClick={() => handleSyncBank(false)} 
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 text-blue-600 rounded-xl font-black uppercase text-[10px] shadow-sm hover:bg-blue-50 transition-all disabled:opacity-50"
                   >
                      {isSyncing ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                      CẬP NHẬT TỪ ĐỀ THI
                   </button>
                </div>
                {isDataLoading ? (
                    <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" size={40}/><p className="mt-4 text-[10px] font-black uppercase text-slate-400">Đang tải...</p></div>
                ) : (
                    <QuestionBank 
                        questions={allAvailableQuestions} chapters={chapters} bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter}
                        bChapterFilter={bChapterFilter} setBChapterFilter={setBChapterFilter}
                        bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter} bSearch={bSearch} setBSearch={setBSearch}
                        onAddMultiple={(qs) => { setQuestions([...questions, ...qs]); setActiveTab('quizzes'); setIsEditingQuiz(true); }}
                    />
                )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {isStudentModalOpen && (
        <StudentModal 
          isOpen={isStudentModalOpen} 
          student={selectedStudent} 
          form={studentForm} 
          setForm={setStudentForm} 
          classes={classes}
          onClose={() => setIsStudentModalOpen(false)} 
          onSave={handleSaveStudent} 
          isSaving={isSavingStudent} 
          isDuplicate={students.some(s => s.studentCode === studentForm.studentCode.trim().toUpperCase() && s.id !== selectedStudent?.id)}
        />
      )}
      {viewingStudent && <StudentDetailModal student={viewingStudent} results={results} quizzes={quizzes} onClose={() => setViewingStudent(null)} onViewResult={handleViewResultDetail} />}
      {historyData && <ResultHistoryModal isOpen={true} {...historyData} onClose={() => setHistoryData(null)} onViewDetail={handleViewResultDetail} onDeleteOne={(r) => deleteResult(r.id).then(() => loadTabData('results'))} />}
      {selectedResultDetail && <ResultDetailModal isOpen={true} result={selectedResultDetail.result} quiz={selectedResultDetail.quiz} onClose={() => setSelectedResultDetail(null)} />}
      {previewQuiz && <QuizPreviewModal quiz={previewQuiz} onClose={() => setPreviewQuiz(null)} />}
      
      {isBankOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[2000] flex items-stretch justify-end">
             <div className="bg-white w-full h-full flex flex-col overflow-hidden shadow-2xl">
                <div className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Database size={16} className="text-blue-500"/>
                        <h3 className="text-[11px] font-black uppercase italic">Chọn từ Ngân hàng</h3>
                    </div>
                    <button onClick={() => setIsBankOpen(false)} className="px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-red-600 text-[10px] font-black uppercase flex items-center gap-1">
                        <span>Đóng</span> <X size={14}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
                    {isBankLoading ? (
                        <div className="py-20 text-center">
                            <Loader2 className="animate-spin mx-auto text-blue-500" size={40}/>
                            <p className="mt-4 text-[10px] font-black uppercase text-slate-400">Đang tải Ngân hàng câu hỏi từ Cloud...</p>
                        </div>
                    ) : (
                        <QuestionBank 
                            questions={allAvailableQuestions} 
                            chapters={chapters}
                            bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter}
                            bChapterFilter={bChapterFilter} setBChapterFilter={setBChapterFilter}
                            bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter}
                            bSearch={bSearch} setBSearch={setBSearch}
                            onAddMultiple={(qs) => { setQuestions([...questions, ...qs]); setIsBankOpen(false); }}
                        />
                    )}
                </div>
             </div>
        </div>
      )}

      {/* Alert and Confirmation Modal Overlay */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[5000] flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-3xl border shadow-2xl p-6 overflow-hidden animate-scale-up">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-2xl shrink-0 ${
                alertModal.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                alertModal.type === 'error' ? 'bg-red-50 text-red-600' :
                alertModal.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                'bg-blue-50 text-blue-600'
              }`}>
                {alertModal.type === 'success' && <DatabaseZap size={24} className="text-emerald-600" />}
                {alertModal.type === 'error' && <AlertTriangle size={24} className="text-red-600" />}
                {alertModal.type === 'warning' && <AlertTriangle size={24} />}
                {alertModal.type === 'info' && <DatabaseZap size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1 leading-tight">{alertModal.title}</h3>
                <p className="text-xs text-slate-500 font-bold leading-relaxed break-words">{alertModal.message}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              {alertModal.cancelText && (
                <button 
                  onClick={() => {
                    if (alertModal.onCancel) alertModal.onCancel();
                    setAlertModal(null);
                  }}
                  className="px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  {alertModal.cancelText}
                </button>
              )}
              <button 
                onClick={() => {
                  if (alertModal.onConfirm) alertModal.onConfirm();
                  else setAlertModal(null);
                }}
                className={`px-5 py-2.5 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-md ${
                  alertModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' :
                  alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' :
                  alertModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' :
                  'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                }`}
              >
                {alertModal.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
