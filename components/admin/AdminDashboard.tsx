
import { 
  getQuizzesMetadata, getQuizById, deleteQuiz, saveQuiz, updateQuiz, uploadQuizImage,
  getUsers, saveUser, deleteUser, changePassword, getUsersPage,
  getResultsMetadata, getResultById, deleteResult, getResultsMetadataPage,
  getChapters, saveChapter, deleteChapter,
  getBankQuestions, saveBankQuestion,
  clearLocalCache,
  isDatabaseConnected,
  syncAllQuizzesMetadata,
  syncQuizzesToBank
} from '../../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF, parseQuestionsFromText } from '../../services/gemini';
import { Quiz, User, Result, Chapter, Question, QuestionType, Grade, QuizType } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  LayoutDashboard, Users, BarChart3, ShieldAlert, Sparkles, FolderTree, 
  Plus, Database, Loader2, X, RefreshCw, AlertTriangle, FileUp, DatabaseZap
} from 'lucide-react';

import QuizList from './QuizList';
import QuizEditor from './QuizEditor';
import StudentManager from './StudentManager';
import ResultsBoard from './ResultsBoard';
import ExamMonitor from './ExamMonitor';
import ChapterManager from './ChapterManager';
import QuestionBank from './QuestionBank';
import AIRenderer from './AIRenderer';

import StudentModal from './StudentModal';
import StudentDetailModal from './StudentDetailModal';
import ResultHistoryModal from './ResultHistoryModal';
import ResultDetailModal from './ResultDetailModal';
import QuizPreviewModal from './QuizPreviewModal';

type AdminTab = 'quizzes' | 'students' | 'results' | 'monitor' | 'chapters' | 'bank' | 'ai';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('quizzes');
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingInProgress, setIsSavingInProgress] = useState(false);

  // Data states
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
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
        const [q, c, r] = await Promise.all([
          getQuizzesMetadata(), 
          getChapters(),
          getResultsMetadata() 
        ]);
        setQuizzes(q);
        setChapters(c);
        setResults(r);
      } else if (tab === 'students') {
        const [paged, r, q] = await Promise.all([
          getUsersPage(1, 50),
          getResultsMetadata(),
          getQuizzesMetadata()
        ]);
        
        setStudents(paged.data.filter(user => user.role === 'student'));
        setStudentsTotal(paged.total);
        setStudentsPage(1);
        setResults(r);
        setQuizzes(q);
      } else if (tab === 'results') {
        const [paged, q, u] = await Promise.all([
          getResultsMetadataPage(1, 50),
          getQuizzesMetadata(),
          getUsers()
        ]);
        setResults(paged.data);
        setResultsTotal(paged.total);
        setResultsPage(1);
        setQuizzes(q);
        setStudents(u.filter(user => user.role === 'student'));
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

  // Quiz Editing
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizGrade, setQuizGrade] = useState<Grade>('12');
  const [quizType, setQuizType] = useState<QuizType>('test');
  const [isPublished, setIsPublished] = useState(false);
  const [isMonitored, setIsMonitored] = useState(false);
  const [isUnlisted, setIsUnlisted] = useState(false);
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

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentForm, setStudentForm] = useState({ fullName: '', studentCode: '', grade: '12' as Grade, password: '123' });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [historyData, setHistoryData] = useState<{ studentName: string, studentCode: string, quizTitle: string, history: Result[] } | null>(null);
  const [selectedResultDetail, setSelectedResultDetail] = useState<{ result: Result, quiz: Quiz } | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isBankOpen, setIsBankOpen] = useState(false);

  const allAvailableQuestions = useMemo(() => {
    return bankQuestions;
  }, [bankQuestions]);

  // Quiz Handlers
  const handleCreateQuiz = () => {
    setEditingQuizId(null); setQuizTitle(''); setQuizGrade('12'); setQuizType('test');
    setIsPublished(false); setIsMonitored(false); setIsUnlisted(false); setDuration(45); setOrderIndex(1); setCategory('');
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

  const handleSyncBank = async () => {
    if (!confirm("Hệ thống sẽ quét toàn bộ câu hỏi trong tất cả đề thi và đẩy vào kho tổng (Bank). Tiếp tục?")) return;
    setIsSyncing(true);
    try {
      const stats = await syncQuizzesToBank();
      alert(`Đã hoàn tất! Quét được ${stats.total} câu hỏi, đã đồng bộ thành công ${stats.added} câu vào Ngân hàng.`);
      loadTabData('bank');
    } catch (e) {
      alert("Lỗi khi đồng bộ Ngân hàng.");
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
        let cleaned = text.trim();
        const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
        while (labelRegex.test(cleaned)) {
            cleaned = cleaned.replace(labelRegex, "").trim();
        }
        return cleaned;
    };

    const cleanedQuestions = questions.map(q => {
        const newQ = { ...q };
        newQ.text = stripLabel(q.text);
        
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
    alert("Đã dọn dẹp nhãn cho tất cả câu hỏi!");
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDatabaseConnected() && !confirm("Bạn đang có kết nối Cloud. Việc nhập CSV này chỉ nên dùng để xem dữ liệu tạm thời. Tiếp tục?")) return;

    setIsDataLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const data = results.data as any[];
        const firstRow = data[0];
        
        try {
          if (!firstRow) throw new Error("File CSV trống.");

          // Detect type based on headers
          const headers = Object.keys(firstRow).map(h => h.toLowerCase());
          const isUserFile = headers.includes('role') || headers.includes('student_code');
          const isResultFile = headers.includes('score') || headers.includes('quiz_id');

          if (isUserFile) {
            const parsedUsers = data.map(row => ({
              ...row,
              id: row.id || uuidv4(),
              studentCode: row.studentCode || row.student_code || 'N/A',
              fullName: row.fullName || row.full_name || 'Học sinh',
              role: row.role || 'student'
            })).filter(u => u.role === 'student');
            setStudents(parsedUsers);
            setStudentsTotal(parsedUsers.length);
            alert(`Đã tải ${parsedUsers.length} học sinh từ file CSV.`);
          } else if (isResultFile) {
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
            alert(`Đã tải ${parsedResults.length} kết quả từ file CSV.`);
          } else {
            alert("Không nhận diện được định dạng file.");
          }
        } catch (err: any) {
          alert("Lỗi xử lý CSV: " + err.message);
        } finally {
          setIsDataLoading(false);
          e.target.value = '';
        }
      }
    });
  };

  const handleSaveStudent = async () => {
    if (!studentForm.fullName || !studentForm.studentCode) return alert("Vui lòng điền đủ thông tin!");
    
    const code = studentForm.studentCode.trim().toUpperCase();
    
    // Kiểm tra trùng mã học sinh (MAHS)
    const isDuplicate = students.some(s => s.studentCode === code && s.id !== selectedStudent?.id);
    if (isDuplicate) {
      return alert(`CẢNH BÁO: Mã học sinh "${code}" đã tồn tại trong hệ thống. Vui lòng kiểm tra lại!`);
    }

    setIsSavingStudent(true);
    try {
      const newUser: User = {
        id: selectedStudent?.id || uuidv4(), username: code.toLowerCase(),
        password: studentForm.password, role: 'student', fullName: studentForm.fullName,
        studentCode: code, grade: studentForm.grade,
        points: selectedStudent?.points || 0
      };
      await saveUser(newUser); setIsStudentModalOpen(false); loadTabData('students');
    } catch (e: any) { alert("Lỗi lưu học sinh"); } finally { setIsSavingStudent(false); }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (confirm(`CẢNH BÁO: Xóa học sinh "${name}" sẽ xóa vĩnh viễn toàn bộ lịch sử bài làm của học sinh này trên Database. Tiếp tục?`)) { 
      await handleDeleteStudentsBatch([id]);
    }
  };

  const handleDeleteResultBatch = async (resultsToDelete: Result[]) => {
    setIsDataLoading(true);
    try {
        // Xóa tuần tự hoặc song song nhưng chỉ load lại data 1 lần ở cuối
        await Promise.all(resultsToDelete.map(r => deleteResult(r.id)));
        await loadTabData('results');
        alert(`Đã xóa thành công ${resultsToDelete.length} bản ghi.`);
    } catch (e: any) {
        alert("Lỗi khi xóa kết quả: " + e.message);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleDeleteStudentsBatch = async (studentIds: string[]) => {
    setIsDataLoading(true);
    try {
        await Promise.all(studentIds.map(id => deleteUser(id)));
        await loadTabData('students');
        alert(`Đã xóa thành công ${studentIds.length} học sinh.`);
    } catch (e: any) {
        alert("Lỗi khi xóa học sinh: " + e.message);
    } finally {
        setIsDataLoading(false);
    }
  };

  const handleResetPassword = async (student: User) => {
    const defaultPass = '123';
    if (confirm(`Đặt lại mật khẩu cho học sinh "${student.fullName}" về mặc định "${defaultPass}"?`)) {
      setIsDataLoading(true);
      try {
        const success = await changePassword(student.id, defaultPass);
        if (success) {
          alert(`Đã đặt lại mật khẩu cho ${student.fullName} thành công!`);
          loadTabData('students');
        } else {
          alert("Có lỗi xảy ra khi đặt lại mật khẩu trên Cloud.");
        }
      } catch (e: any) {
        alert("Lỗi: " + e.message);
      } finally {
        setIsDataLoading(false);
      }
    }
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
            <span className="hidden lg:inline">EduQuiz <span className="text-blue-500">PRO</span></span>
            <span className="lg:hidden text-blue-500">EQ</span>
          </h2>
        </div>
        <nav className="flex-1 p-2 lg:p-4 space-y-1 mt-4">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'Đề thi' },
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

      <main className="flex-1 h-screen overflow-y-auto custom-scrollbar bg-slate-50">
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
                    duration={duration} setDuration={setDuration} category={category} setCategory={setCategory}
                    orderIndex={orderIndex} setOrderIndex={setOrderIndex}
                    startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime}
                    questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSaveQuiz}
                    onCleanLabels={handleCleanLabels}
                    onOpenBank={(type) => { 
                        setBTypeFilter(type); 
                        setBGradeFilter(quizGrade); 
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
                        quizzes={quizzes} results={results} chapters={chapters}
                        onEdit={handleEditQuiz} onDelete={handleDeleteQuiz} onPreview={handlePreviewQuiz}
                        qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter}
                        qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter}
                    />
                )}
              </div>
            )
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
                        students={students} results={results} quizzes={quizzes}
                        sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter}
                        onRefresh={() => loadTabData('students')}
                        onAdd={() => { setSelectedStudent(null); setStudentForm({fullName: '', studentCode: '', grade: '12', password: '123'}); setIsStudentModalOpen(true); }}
                        onImportCsv={handleImportCsv} onViewDetail={setViewingStudent}
                        onEdit={(u) => { setSelectedStudent(u); setStudentForm({fullName: u.fullName, studentCode: u.studentCode || '', grade: u.grade || '12', password: u.password}); setIsStudentModalOpen(true); }}
                        onDelete={handleDeleteStudent} 
                        onBulkDelete={handleDeleteStudentsBatch}
                        onResetPassword={handleResetPassword}
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
                      onClick={handleSyncBank} 
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
                    <QuestionBank 
                        questions={allAvailableQuestions} 
                        chapters={chapters}
                        bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter}
                        bChapterFilter={bChapterFilter} setBChapterFilter={setBChapterFilter}
                        bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter}
                        bSearch={bSearch} setBSearch={setBSearch}
                        onAddMultiple={(qs) => { setQuestions([...questions, ...qs]); setIsBankOpen(false); }}
                    />
                </div>
             </div>
        </div>
      )}
    </div>
  );
}
