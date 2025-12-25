
import React, { useState, useEffect, useRef } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, SubQuestion, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { generateQuestions, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Sparkles, Save, List, Upload, FileText, Image as ImageIcon, BarChart3, Eye, Edit, Calendar, Clock, CheckCircle, XCircle, Filter, History, Search, BookOpen, GraduationCap, Lightbulb, Users, UserPlus, Key, Download, FileSpreadsheet, TrendingUp, Award, UserCheck, Bold, Italic, Underline, Type, Sigma, CornerDownLeft, ChevronUp, ChevronDown, SortAsc, Copy, SearchCode, Database } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER COMPONENTS FOR RICH EDITOR ---

interface ToolbarButtonProps {
    onClick: () => void;
    icon?: React.ReactNode;
    label?: string;
    tooltip: string;
}

const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button 
        type="button"
        onClick={onClick}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-medium text-xs flex items-center gap-1 border border-transparent hover:border-gray-300 transition-all min-w-[24px] justify-center"
        title={tooltip}
    >
        {icon}
        {label && <span>{label}</span>}
    </button>
);

interface RichTextEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, rows, className }) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value;

        if (start === null || end === null) return;

        const before = text.substring(0, start);
        const selected = text.substring(start, end);
        const after = text.substring(end);

        const newVal = before + prefix + selected + suffix + after;
        
        onChange(newVal);

        setTimeout(() => {
            el.focus();
            const newCursorPos = start + prefix.length + selected.length;
            el.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="flex flex-col border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border-b border-gray-100">
                <ToolbarBtn onClick={() => insertTag('<b>', '</b>')} icon={<Bold size={14}/>} tooltip="In đậm (Bold)" />
                <ToolbarBtn onClick={() => insertTag('<i>', '</i>')} icon={<Italic size={14}/>} tooltip="In nghiêng (Italic)" />
                <ToolbarBtn onClick={() => insertTag('<u>', '</u>')} icon={<Underline size={14}/>} tooltip="Gạch chân (Underline)" />
                <ToolbarBtn onClick={() => insertTag('<br/>')} icon={<CornerDownLeft size={14}/>} tooltip="Xuống dòng (Line Break)" />
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <ToolbarBtn onClick={() => insertTag('$', '$')} icon={<Sigma size={14}/>} tooltip="Công thức toán (Inline Latex)" />
                <ToolbarBtn onClick={() => insertTag('$\\frac{', '}$') } label="a/b" tooltip="Phân số" />
                <ToolbarBtn onClick={() => insertTag('$\\sqrt{', '}$') } label="√x" tooltip="Căn bậc hai" />
                <ToolbarBtn onClick={() => insertTag('$^{', '}$') } label="x²" tooltip="Số mũ" />
                <ToolbarBtn onClick={() => insertTag('$_{', '}$') } label="x₁" tooltip="Chỉ số dưới" />
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <ToolbarBtn onClick={() => insertTag('$\\rightarrow$') } label="→" tooltip="Mũi tên đơn" />
                <ToolbarBtn onClick={() => insertTag('$\\Rightarrow$') } label="⇒" tooltip="Suy ra" />
            </div>

            {rows ? (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className={`w-full p-3 outline-none text-sm font-mono leading-relaxed resize-y ${className}`}
                    rows={rows}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            ) : (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    className={`w-full p-2 outline-none text-sm font-medium ${className}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            )}
        </div>
    );
};

// --- END HELPER COMPONENTS ---

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterGrade, setResultFilterGrade] = useState<Grade | 'all'>('all');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('10');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [viewHistoryData, setViewHistoryData] = useState<{ studentName: string, quizTitle: string, items: Result[] } | null>(null);

  // Question Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
      fullName: '',
      username: '',
      password: '',
      grade: '10' as Grade,
      role: 'student' as Role
  });

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    const qData = await getQuizzes();
    setQuizzes(qData);
    const rData = await getResults();
    setResults(rData);
    const uData = await getUsers();
    setUsers(uData);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) {
      alert("Vui lòng nhập tên đề thi.");
      return;
    }
    if (questions.length === 0) {
      alert("Đề thi cần ít nhất 1 câu hỏi.");
      return;
    }
    if (quizType === 'test' && !startTime) {
      alert("Bài kiểm tra bắt buộc phải có 'Thời gian bắt đầu'.");
      return;
    }

    const cleanQuestions = questions.map(q => ({
        ...q,
        points: typeof q.points === 'string' 
            ? parseFloat(q.points.replace(',', '.')) || 0 
            : q.points
    }));

    const quizData: Quiz = {
      id: editingId || uuidv4(),
      title,
      description,
      type: quizType,
      grade,
      startTime: quizType === 'test' ? startTime : undefined,
      durationMinutes: duration,
      questions: cleanQuestions,
      createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      isPublished: isPublished
    };

    if (editingId) {
      await updateQuiz(quizData);
    } else {
      await saveQuiz(quizData);
    }

    await refreshData();
    setActiveTab('list');
    resetForm();
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    const updated = { ...quiz, isPublished: !quiz.isPublished };
    await updateQuiz(updated);
    refreshData();
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingId(quiz.id);
    setTitle(quiz.title);
    setDescription(quiz.description);
    setQuizType(quiz.type);
    setGrade(quiz.grade);
    setStartTime(quiz.startTime || '');
    setDuration(quiz.durationMinutes);
    setQuestions(quiz.questions);
    setIsPublished(quiz.isPublished);
    setActiveTab('create');
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setQuestions([]);
    setStartTime('');
    setDuration(30);
    setFile(null);
    setIsPublished(false);
  };

  const handleFileUpload = async () => {
      if (!file) return;
      setIsProcessing(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
          const base64Str = (reader.result as string).split(',')[1];
          try {
              const extractedQuestions = await parseQuestionsFromPDF(base64Str);
              setQuestions([...questions, ...extractedQuestions]);
              alert(`Đã trích xuất thành công ${extractedQuestions.length} câu hỏi!`);
              setActiveTab('create');
          } catch (e: any) {
              alert(e.message || "Lỗi đọc PDF.");
          } finally {
              setIsProcessing(false);
          }
      };
      reader.onerror = () => {
          alert("Lỗi không thể đọc file.");
          setIsProcessing(false);
      }
  };

  // Logic thêm câu hỏi thông minh: Chèn vào đúng phân đoạn
  const addManualQuestion = (type: QuestionType = 'mcq') => {
    let q: Question;
    if (type === 'mcq') {
      q = { id: uuidv4(), type: 'mcq', text: 'Nội dung câu trắc nghiệm...', points: 0.25, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', solution: '' };
    } else if (type === 'group-tf') {
      q = { id: uuidv4(), type: 'group-tf', text: 'Nội dung câu Đúng/Sai...', points: 1.0, subQuestions: [{ id: uuidv4(), text: 'Ý a)', correctAnswer: 'True' }, { id: uuidv4(), text: 'Ý b)', correctAnswer: 'False' }, { id: uuidv4(), text: 'Ý c)', correctAnswer: 'True' }, { id: uuidv4(), text: 'Ý d)', correctAnswer: 'False' }], solution: '' };
    } else {
      q = { id: uuidv4(), type: 'short', text: 'Nội dung câu trả lời ngắn...', points: 0.5, correctAnswer: '', solution: '' };
    }

    const lastIdxOfSameType = [...questions].reverse().findIndex(x => x.type === type);
    if (lastIdxOfSameType === -1) {
        if (type === 'mcq') {
            setQuestions([q, ...questions]);
        } else if (type === 'group-tf') {
            const firstShortIdx = questions.findIndex(x => x.type === 'short');
            if (firstShortIdx === -1) setQuestions([...questions, q]);
            else {
                const newQs = [...questions];
                newQs.splice(firstShortIdx, 0, q);
                setQuestions(newQs);
            }
        } else {
            setQuestions([...questions, q]);
        }
    } else {
        const actualIdx = questions.length - 1 - lastIdxOfSameType;
        const newQs = [...questions];
        newQs.splice(actualIdx + 1, 0, q);
        setQuestions(newQs);
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const sortQuestionsByPart = () => {
    const sorted = [...questions].sort((a, b) => {
        const order = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
        return order[a.type] - order[b.type];
    });
    setQuestions(sorted);
  };

  const onSelectImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const url = await uploadImage(file);
      if (url) updateQuestion(index, 'imageUrl', url);
  };

  const updateSubQuestion = (qIndex: number, subIndex: number, field: keyof SubQuestion, value: any) => {
      const updated = [...questions];
      if (updated[qIndex].subQuestions) {
          updated[qIndex].subQuestions![subIndex] = { ...updated[qIndex].subQuestions![subIndex], [field]: value };
          setQuestions(updated);
      }
  };

  const getGroupedResults = () => {
      const groups: Record<string, { studentName: string, quizTitle: string, quizGrade: string, attempts: number, maxScore: number, items: Result[] }> = {};
      results.forEach(r => {
          const quiz = quizzes.find(q => q.id === r.quizId);
          if (resultFilterGrade !== 'all') {
              if (quiz?.grade !== resultFilterGrade) return;
              if (selectedQuizId && r.quizId !== selectedQuizId) return;
          }
          if (!quiz) return; 
          const key = `${r.studentId}_${r.quizId}`;
          if (!groups[key]) {
              groups[key] = { studentName: r.studentName, quizTitle: quiz.title, quizGrade: quiz.grade, attempts: 0, maxScore: 0, items: [] };
          }
          groups[key].attempts += 1;
          groups[key].maxScore = Math.max(groups[key].maxScore, r.score);
          groups[key].items.push(r);
      });
      Object.values(groups).forEach(g => g.items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
      return Object.values(groups);
  };
  
  const groupedResults = activeTab === 'results' ? getGroupedResults() : [];
  const practiceQuizzes = quizzes.filter(q => q.grade === resultFilterGrade && q.type === 'practice');
  const testQuizzes = quizzes.filter(q => q.grade === resultFilterGrade && q.type === 'test');

  const { tests: listTests, practices: listPractices } = {
    tests: quizzes.filter(q => q.type === 'test' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade)),
    practices: quizzes.filter(q => q.type === 'practice' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade))
  };

  const handleExportExcel = () => {
      if (!selectedQuizId) return;
      const quiz = quizzes.find(q => q.id === selectedQuizId);
      if (!quiz) return;
      const quizResults = results.filter(r => r.quizId === selectedQuizId);
      const headers = ["STT", "Họ và Tên", "Tên đăng nhập", "Lớp", "Điểm số", "Ngày nộp"];
      const csvRows = [headers.join(",")];
      quizResults.forEach((r, index) => {
          const student = users.find(u => u.id === r.studentId);
          const row = [index + 1, student?.fullName || r.studentName, student?.username || "N/A", student?.grade || "N/A", r.score.toFixed(2), format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm")];
          csvRows.push(row.join(","));
      });
      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `KetQua_${quiz.title}.csv`;
      link.click();
  };

  const handleSaveUser = async () => {
      if (!userForm.username || !userForm.password || !userForm.fullName) return;
      const userData: User = { id: editingUser ? editingUser.id : uuidv4(), username: userForm.username, password: userForm.password, fullName: userForm.fullName, grade: userForm.role === 'student' ? userForm.grade : undefined, role: userForm.role };
      if (editingUser) await updateUser(userData);
      else await saveUser(userData);
      setShowUserModal(false);
      refreshData();
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
      const partQuestions = questions.filter(q => q.type === type);
      return (
          <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                  <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2">
                      {label} <span className="text-sm font-normal text-gray-500">({partQuestions.length} câu)</span>
                  </h3>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => { setBankTargetType(type); setShowBankModal(true); setBankSelectedQuizId(''); }} 
                        className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1"
                      >
                        <Database size={14}/> Lấy từ đề cũ
                      </button>
                      <button onClick={() => addManualQuestion(type)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm">
                        <Plus size={14}/> Thêm câu mới
                      </button>
                  </div>
              </div>
              <div className="p-4 space-y-4">
                  {questions.map((q, idx) => {
                      if (q.type !== type) return null;
                      return (
                        <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-dashed">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {idx + 1}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={18}/></button>
                                        <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={18}/></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase">ĐIỂM:</div>
                                    <input type="text" className="w-14 border rounded p-1 text-center font-bold text-xs bg-gray-50" value={q.points} onChange={(e) => updateQuestion(idx, 'points', e.target.value.replace(',', '.'))} />
                                    <button onClick={() => { if(window.confirm('Xóa câu này?')) { const n = [...questions]; n.splice(idx, 1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full transition"><Trash2 size={16}/></button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* NHẬP CÂU HỎI & PREVIEW */}
                                <div>
                                    <RichTextEditor rows={2} value={q.text} onChange={(val) => updateQuestion(idx, 'text', val)} placeholder="Nhập nội dung câu hỏi..." />
                                    <div className="mt-1 p-2 bg-gray-50 rounded border text-xs text-gray-600 flex gap-2 overflow-x-auto">
                                        <span className="shrink-0 font-bold text-blue-500 uppercase text-[9px]">Xem trước:</span>
                                        <div className="flex-1"><LatexText text={q.text || '...'} /></div>
                                    </div>
                                </div>

                                {/* HÌNH ẢNH */}
                                <div className="flex gap-4 items-start">
                                    <div className="flex-1">
                                        <div className="flex gap-2">
                                            <input type="text" className="flex-1 border rounded p-2 text-xs text-gray-600 bg-white" placeholder="Link ảnh hoặc..." value={q.imageUrl || ''} onChange={e => updateQuestion(idx, 'imageUrl', e.target.value)}/>
                                            <label className="cursor-pointer bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-200 hover:bg-blue-100 transition flex items-center gap-2 text-xs font-bold">
                                                <ImageIcon size={14}/> Upload
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => onSelectImage(e, idx)} />
                                            </label>
                                        </div>
                                    </div>
                                    {q.imageUrl && <div className="shrink-0 w-12 h-12 border rounded bg-gray-50 flex items-center justify-center overflow-hidden"><img src={q.imageUrl} alt="preview" className="w-full h-full object-contain" /></div>}
                                </div>

                                {/* ĐÁP ÁN THEO LOẠI */}
                                {q.type === 'mcq' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options?.map((opt, optIdx) => (
                                            <div key={optIdx} className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-100 group hover:border-blue-300 transition-all">
                                                    <input type="radio" className="w-4 h-4" checked={q.correctAnswer === opt} onChange={() => updateQuestion(idx, 'correctAnswer', opt)} />
                                                    <span className="text-[10px] font-bold text-gray-400 w-4">{String.fromCharCode(65+optIdx)}.</span>
                                                    <RichTextEditor className="flex-1 bg-white border-transparent" value={opt} onChange={(val) => { const o = [...(q.options||[])]; o[optIdx]=val; updateQuestion(idx, 'options', o); if(q.correctAnswer===opt) updateQuestion(idx, 'correctAnswer', val); }} />
                                                </div>
                                                <div className="pl-8 text-[11px] text-gray-500"><LatexText text={opt || '...'} /></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'short' && (
                                    <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100 shadow-inner">
                                        <span className="text-xs font-bold text-green-700 uppercase">ĐÁP ÁN PHẦN III:</span>
                                        <input type="text" className="flex-1 border-2 border-green-200 rounded p-2 font-bold text-green-900 bg-white" placeholder="Nhập đáp số..." value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)} />
                                    </div>
                                )}
                                {q.type === 'group-tf' && (
                                    <div className="space-y-3">
                                        {q.subQuestions?.map((sq, sqIdx) => (
                                            <div key={sqIdx} className="bg-gray-50 p-2 rounded border border-gray-100 space-y-2 shadow-sm">
                                                <div className="flex gap-2 items-center">
                                                    <span className="font-bold text-gray-500 text-xs w-4">{String.fromCharCode(97+sqIdx)})</span>
                                                    <RichTextEditor className="flex-1" value={sq.text} onChange={(val) => updateSubQuestion(idx, sqIdx, 'text', val)} />
                                                    <div className="flex flex-col gap-1">
                                                        <button onClick={()=>updateSubQuestion(idx,sqIdx,'correctAnswer','True')} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='True'?'bg-green-500 text-white border-green-600 font-bold':'bg-white text-gray-400 hover:bg-gray-100'}`}>Đ</button>
                                                        <button onClick={()=>updateSubQuestion(idx,sqIdx,'correctAnswer','False')} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='False'?'bg-red-500 text-white border-red-600 font-bold':'bg-white text-gray-400 hover:bg-gray-100'}`}>S</button>
                                                    </div>
                                                </div>
                                                <div className="pl-6 text-[11px] text-gray-500"><LatexText text={sq.text || '...'} /></div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* LỜI GIẢI CHI TIẾT */}
                                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                    <div className="flex items-center gap-2 mb-2 text-yellow-600 font-bold text-[10px] uppercase">
                                        <Lightbulb size={14} /> Lời giải chi tiết / Hướng dẫn:
                                    </div>
                                    <RichTextEditor rows={3} className="bg-yellow-50/50 border-yellow-100 focus:ring-yellow-200" value={q.solution || ''} onChange={(val) => updateQuestion(idx, 'solution', val)} placeholder="Nhập lời giải để học sinh đối chiếu..." />
                                    <div className="mt-1 p-2 bg-yellow-50/30 rounded border border-yellow-50 text-[11px] text-yellow-800">
                                        <LatexText text={q.solution || 'Chưa có lời giải'} />
                                    </div>
                                </div>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
         <Database className="text-blue-600" /> Quản Lý Đề Thi Online
      </h1>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><List size={20} /> Danh Sách Đề</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          {editingId ? <Edit size={20} /> : <Plus size={20} />} 
          {editingId ? 'Sửa Đề Thi' : 'Soạn Đề Mới'}
        </button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'import' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Upload size={20} /> Nhập File PDF</button>
        <button onClick={() => { setActiveTab('results'); resetForm(); setSelectedQuizId(''); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><BarChart3 size={20} /> Kết Quả Thi</button>
        <button onClick={() => { setActiveTab('students'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Users size={20} /> Quản Lý Học Sinh</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
             <span className="flex items-center gap-2 text-gray-700 font-bold"><Filter size={18}/> Lọc theo khối:</span>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['all', '10', '11', '12'] as const).map(g => (
                    <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${quizFilterGrade === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                    </button>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
               <h2 className="text-lg font-bold text-red-700 flex items-center gap-2 uppercase border-b border-red-200 pb-2"><GraduationCap className="text-red-600"/> Đề Kiểm Tra ({listTests.length})</h2>
               <div className="space-y-3">
                 {listTests.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-red-300 transition group relative">
                        <div className="flex justify-between items-start">
                           <div><h3 className="font-bold text-gray-800">{q.title}</h3><div className="text-xs text-gray-500 mt-1">K{q.grade} • {q.durationMinutes}p • {q.startTime ? format(parseISO(q.startTime), "dd/MM HH:mm") : '---'}</div></div>
                           <button onClick={() => handleTogglePublish(q)} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${q.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{q.isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</button>
                        </div>
                        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-dashed">
                            <button onClick={() => setPreviewQuiz(q)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Xem"><Eye size={16}/></button>
                            <button onClick={() => handleEditQuiz(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={16}/></button>
                            <button onClick={async () => { if(window.confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                        </div>
                    </div>
                 ))}
               </div>
            </div>

            <div className="space-y-4">
               <h2 className="text-lg font-bold text-green-700 flex items-center gap-2 uppercase border-b border-green-200 pb-2"><BookOpen className="text-green-600"/> Đề Luyện Tập ({listPractices.length})</h2>
               <div className="space-y-3">
                 {listPractices.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-green-300 transition group relative">
                        <div className="flex justify-between items-start">
                           <div><h3 className="font-bold text-gray-800">{q.title}</h3><div className="text-xs text-gray-500 mt-1">K{q.grade} • {q.durationMinutes}p • {q.questions.length} câu</div></div>
                           <button onClick={() => handleTogglePublish(q)} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${q.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{q.isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</button>
                        </div>
                        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-dashed">
                            <button onClick={() => setPreviewQuiz(q)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Xem"><Eye size={16}/></button>
                            <button onClick={() => handleEditQuiz(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={16}/></button>
                            <button onClick={async () => { if(window.confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                        </div>
                    </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-semibold mb-4 text-gray-800">Thông Tin Đề Thi</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border rounded-lg p-2.5" placeholder="Tên đề thi" value={title} onChange={e => setTitle(e.target.value)}/>
                 <textarea className="w-full border rounded-lg p-2.5" placeholder="Mô tả đề thi" value={description} onChange={e => setDescription(e.target.value)}/>
                 <div className="grid grid-cols-2 gap-4">
                    <select className="border rounded-lg p-2.5" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select>
                    <select className="border rounded-lg p-2.5" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Thời lượng (phút):</label><input type="number" className="w-full border rounded-lg p-2" value={duration} onChange={e => setDuration(Number(e.target.value))}/></div>
                    {quizType === 'test' && <div><label className="block text-xs font-bold text-gray-500 mb-1">Giờ bắt đầu:</label><input type="datetime-local" className="w-full border rounded-lg p-2" value={startTime} onChange={e => setStartTime(e.target.value)}/></div>}
                 </div>
               </div>
             </div>
             
             <div className="space-y-6">
                {renderPartEditor('mcq', 'Phần I: Câu hỏi trắc nghiệm', 'border-blue-500')}
                {renderPartEditor('group-tf', 'Phần II: Câu hỏi đúng sai', 'border-purple-500')}
                {renderPartEditor('short', 'Phần III: Câu hỏi trả lời ngắn', 'border-green-500')}
             </div>
           </div>
           
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg sticky top-6">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b font-bold"><span className="text-gray-500 uppercase text-xs">Tổng số câu:</span><span className="text-xl">{questions.length}</span></div>
                  <div className="flex justify-between items-center mb-6 font-bold"><span className="text-gray-500 uppercase text-xs">Tổng điểm:</span><span className="text-xl text-blue-600">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</span></div>
                  <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg"><span className="text-sm font-bold text-gray-700">Trạng thái:</span><button onClick={() => setIsPublished(!isPublished)} className={`px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition shadow-sm ${isPublished ? 'bg-green-100 text-green-700 border-green-200 border' : 'bg-gray-200 text-gray-500 border border-gray-300'}`}>{isPublished ? <CheckCircle size={14}/> : <XCircle size={14}/>}{isPublished ? 'CÔNG KHAI' : 'LƯU NHÁP'}</button></div>
                  <button onClick={handleSaveQuiz} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-extrabold shadow-lg flex justify-center items-center gap-2 transition transform active:scale-95"><Save size={20} /> LƯU ĐỀ THI</button>
                  <button onClick={sortQuestionsByPart} className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2"><SortAsc size={18}/> Sắp xếp lại STT</button>
               </div>
           </div>
        </div>
      )}

      {/* QUESTION BANK MODAL */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><Database size={24}/> Ngân hàng câu hỏi</h3>
                        <p className="text-xs text-indigo-100 opacity-80 uppercase font-bold mt-1">Lọc cho: {bankTargetType === 'mcq' ? 'PHẦN I' : bankTargetType === 'group-tf' ? 'PHẦN II' : 'PHẦN III'}</p>
                      </div>
                      <button onClick={() => setShowBankModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><XCircle size={28}/></button>
                  </div>
                  <div className="p-6 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-4 shrink-0">
                      <div className="flex items-center gap-4 flex-1">
                          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">Chọn đề thi:</span>
                          <select className="flex-1 min-w-[250px] border rounded-lg p-2.5 bg-white shadow-sm font-medium" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}>
                              <option value="">-- Danh sách đề Khối {grade} --</option>
                              {quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title} ({q.isPublished ? 'Công khai' : 'Nháp'})</option>)}
                              <option disabled>──────────</option>
                              <option value="ALL">Duyệt toàn bộ đề thi (Mọi khối)</option>
                          </select>
                      </div>
                      <div className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                          <Filter size={16} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700 uppercase">Khối đang soạn: {grade}</span>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-100">
                      {bankSelectedQuizId === '' ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                              <SearchCode size={64} className="mb-4 text-indigo-200"/>
                              <p className="font-bold">Chọn một đề thi cũ để xem danh sách câu hỏi</p>
                              <p className="text-xs mt-2 text-center max-w-sm">Chỉ những câu chưa có trong đề hiện tại mới được hiển thị để tránh trùng lặp.</p>
                          </div>
                      ) : (
                          <>
                            {(() => {
                                // Lấy đề thi nguồn
                                let sourceQuizzes = [];
                                if (bankSelectedQuizId === 'ALL') sourceQuizzes = quizzes;
                                else {
                                    const found = quizzes.find(q => q.id === bankSelectedQuizId);
                                    if (found) sourceQuizzes = [found];
                                }

                                // Gom toàn bộ câu hỏi từ các đề thi nguồn thỏa mãn điều kiện
                                let allSourceQs: Question[] = [];
                                sourceQuizzes.forEach(sq => {
                                    sq.questions.filter(q => q.type === bankTargetType).forEach(q => {
                                        // Thêm thông tin đề thi gốc vào câu hỏi để hiển thị
                                        allSourceQs.push({ ...q, solution: q.solution || `(Nguồn: ${sq.title})` });
                                    });
                                });
                                
                                // LỌC: Bỏ những câu hỏi có nội dung text trùng với câu đã có trong đề hiện tại
                                const availableQs = allSourceQs.filter(sq => 
                                    !questions.some(currQ => currQ.text.trim() === sq.text.trim())
                                );
                                
                                if (availableQs.length === 0) return (
                                    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed text-gray-400">
                                        <CheckCircle size={48} className="mb-4 text-green-200"/>
                                        <p className="font-bold text-center">Tất cả câu hỏi trong đề này đã có mặt trong đề hiện tại!</p>
                                    </div>
                                );
                                
                                return availableQs.map((q) => (
                                    <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-400 transition-colors flex justify-between items-start gap-4 group">
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{q.type}</span>
                                                <span className="text-xs text-gray-400 font-medium">{q.points} điểm</span>
                                                <span className="text-[10px] text-indigo-300 italic truncate max-w-[200px]">{q.solution}</span>
                                            </div>
                                            <div className="text-sm text-gray-800"><LatexText text={q.text}/></div>
                                            {q.imageUrl && <div className="mt-2"><img src={q.imageUrl} className="h-20 rounded border object-contain bg-gray-50" alt=""/></div>}
                                            {q.type === 'mcq' && q.options && (
                                                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500 italic">
                                                    {q.options.map((o, i) => (
                                                        <div key={i} className={o === q.correctAnswer ? 'text-green-600 font-bold' : ''}>
                                                            {String.fromCharCode(65+i)}. {o.substring(0, 30)}{o.length > 30 ? '...' : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newQ = { ...q, id: uuidv4() }; 
                                                const reverseIdx = [...questions].reverse().findIndex(x => x.type === bankTargetType);
                                                const newQs = [...questions];
                                                if (reverseIdx === -1) {
                                                    if (bankTargetType === 'mcq') newQs.unshift(newQ);
                                                    else if (bankTargetType === 'group-tf') {
                                                        const firstShort = newQs.findIndex(x => x.type === 'short');
                                                        if (firstShort === -1) newQs.push(newQ);
                                                        else newQs.splice(firstShort, 0, newQ);
                                                    } else newQs.push(newQ);
                                                }
                                                else {
                                                   newQs.splice(questions.length - reverseIdx, 0, newQ);
                                                }
                                                setQuestions(newQs);
                                                // Alert nhẹ nhàng hoặc toast
                                            }}
                                            className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 shrink-0 transform group-active:scale-90"
                                            title="Thêm vào đề hiện tại"
                                        >
                                            <Plus size={20}/>
                                        </button>
                                    </div>
                                ));
                            })()}
                          </>
                      )}
                  </div>
                  <div className="p-4 bg-gray-50 border-t flex justify-between items-center shrink-0">
                      <p className="text-xs text-gray-500 italic">Gợi ý: Chỉ chọn những câu hỏi chất lượng nhất cho học sinh của bạn.</p>
                      <button onClick={() => setShowBankModal(false)} className="px-10 py-2.5 bg-gray-800 text-white rounded-lg font-bold hover:bg-black transition shadow-lg">ĐÓNG</button>
                  </div>
              </div>
          </div>
      )}

      {/* REST OF THE UI (IMPORT, STUDENTS, PREVIEW) */}
      {activeTab === 'import' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="text-blue-600" /> Nhập Đề Từ PDF</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition cursor-pointer bg-gray-50">
                      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                      <label htmlFor="pdf-upload" className="cursor-pointer block"><Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" /><span className="block font-medium text-gray-700">{file ? file.name : 'Chọn file PDF đề thi'}</span></label>
                  </div>
                  <div className="mt-6"><button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50">{isProcessing ? 'Đang trích xuất...' : 'Bắt đầu trích xuất'}</button></div>
              </div>
          </div>
      )}

      {activeTab === 'students' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Tìm tên học sinh..." className="pl-10 pr-4 py-2 border rounded-lg w-64" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}/></div>
                  <button onClick={() => { setEditingUser(null); setUserForm({fullName:'', username:'', password:'', grade:'10', role:'student'}); setShowUserModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><UserPlus size={18} /> Thêm Học Sinh</button>
              </div>
              <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase"><tr><th className="p-4">Họ và Tên</th><th className="p-4">Tên đăng nhập</th><th className="p-4">Khối</th><th className="p-4 text-right">Hành động</th></tr></thead>
                  <tbody>{users.filter(u=>u.role==='student' && u.fullName.toLowerCase().includes(searchUser.toLowerCase())).map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 font-bold">{u.fullName}</td><td className="p-4 font-mono text-blue-600">{u.username}</td><td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">K{u.grade}</span></td>
                          <td className="p-4 text-right flex justify-end gap-2">
                              <button onClick={() => { setEditingUser(u); setUserForm({fullName:u.fullName, username:u.username, password:u.password, grade:u.grade||'10', role:u.role}); setShowUserModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                              <button onClick={async () => { if(window.confirm('Xóa?')) { await deleteUser(u.id); refreshData(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                          </td>
                      </tr>
                  ))}</tbody>
              </table>
          </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"><div className="p-4 bg-blue-600 text-white flex justify-between items-center"><h3 className="font-bold">Thông Tin Học Sinh</h3><button onClick={() => setShowUserModal(false)}><XCircle size={24}/></button></div><div className="p-6 space-y-4"><div><label className="block text-sm font-medium mb-1">Họ Tên</label><input type="text" className="w-full border rounded-lg p-2" value={userForm.fullName} onChange={e=>setUserForm({...userForm, fullName:e.target.value})}/></div><div><label className="block text-sm font-medium mb-1">Username</label><input type="text" className="w-full border rounded-lg p-2" value={userForm.username} onChange={e=>setUserForm({...userForm, username:e.target.value})} disabled={!!editingUser}/></div><div><label className="block text-sm font-medium mb-1">Mật khẩu</label><input type="text" className="w-full border rounded-lg p-2" value={userForm.password} onChange={e=>setUserForm({...userForm, password:e.target.value})}/></div><div><label className="block text-sm font-medium mb-1">Khối</label><select className="w-full border rounded-lg p-2" value={userForm.grade} onChange={e=>setUserForm({...userForm, grade:e.target.value as Grade})}><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div><button onClick={handleSaveUser} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg">LƯU HỌC SINH</button></div></div></div>
      )}
      
      {activeTab === 'results' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-center">
                <span className="text-sm font-bold text-gray-700 uppercase">Xem kết quả Khối:</span>
                <div className="flex bg-white rounded-lg border p-1 shadow-sm">
                    {(['all', '10', '11', '12'] as const).map(g => (
                        <button key={g} onClick={() => { setResultFilterGrade(g); setSelectedQuizId(''); }} className={`px-4 py-1.5 rounded text-xs font-bold ${resultFilterGrade === g ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{g==='all'?'Tất cả':`Khối ${g}`}</button>
                    ))}
                </div>
                {resultFilterGrade !== 'all' && (
                    <select className="border rounded-lg p-2 text-sm max-w-[300px]" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                        <option value="">-- Chọn đề thi --</option>
                        {[...testQuizzes, ...practiceQuizzes].map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                    </select>
                )}
                {selectedQuizId && <button onClick={handleExportExcel} className="bg-green-600 text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-1"><FileSpreadsheet size={16}/> Xuất CSV</button>}
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-500 uppercase text-[10px]"><tr><th className="p-4">Học Sinh</th><th className="p-4">Bài Thi</th><th className="p-4 text-center">Số Lần</th><th className="p-4 text-center">Điểm Cao Nhất</th><th className="p-4 text-right">Chi tiết</th></tr></thead>
                <tbody>{groupedResults.map((g, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-bold">{g.studentName}</td><td className="p-4 text-gray-600">{g.quizTitle}</td><td className="p-4 text-center">{g.attempts}</td><td className="p-4 text-center font-bold text-blue-600">{g.maxScore.toFixed(2)}</td>
                        <td className="p-4 text-right"><button onClick={() => setViewHistoryData({studentName:g.studentName, quizTitle:g.quizTitle, items:g.items})} className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1 justify-end"><History size={14}/> Lịch sử</button></td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
      )}

      {viewHistoryData && (
          <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"><div className="p-4 bg-gray-100 border-b flex justify-between items-center"><h3 className="font-bold">Lịch sử: {viewHistoryData.studentName}</h3><button onClick={()=>setViewHistoryData(null)}><XCircle size={20}/></button></div><div className="max-h-[60vh] overflow-y-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr><th className="p-3">Ngày nộp</th><th className="p-3">Điểm</th><th className="p-3 text-right">Hành động</th></tr></thead><tbody>{viewHistoryData.items.map(it=>(<tr key={it.id} className="border-b"><td className="p-3">{format(parseISO(it.submittedAt), "dd/MM/yyyy HH:mm")}</td><td className="p-3 font-bold">{it.score.toFixed(2)}</td><td className="p-3 text-right"><button onClick={async ()=>{if(window.confirm('Xóa?')){await deleteResult(it.id); refreshData(); setViewHistoryData(null);}}} className="text-red-500 p-1"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div></div></div>
      )}
      
      {previewQuiz && (
        <div className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"><div className="p-6 bg-gray-50 border-b flex justify-between items-center"><h2 className="text-xl font-bold">{previewQuiz.title}</h2><button onClick={()=>setPreviewQuiz(null)}><XCircle size={24}/></button></div><div className="flex-1 overflow-y-auto p-8 space-y-8">{previewQuiz.questions.map((q, idx)=>(<div key={q.id} className="border-b pb-6 last:border-0"><div className="font-bold text-gray-800 mb-2">Câu {idx+1} ({q.points}đ): <LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="max-h-60 rounded border my-3 mx-auto" alt=""/>}{q.type === 'mcq' && <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">{q.options?.map((o,i)=>(<div key={i} className={`p-2 border rounded ${o===q.correctAnswer?'bg-green-50 border-green-300 font-bold':''}`}>{String.fromCharCode(65+i)}. <LatexText text={o}/></div>))}</div>}{q.type === 'group-tf' && <div className="space-y-1 text-sm">{q.subQuestions?.map((s,i)=>(<div key={i} className="flex justify-between border-b border-dashed pb-1"><span>{String.fromCharCode(97+i)}) <LatexText text={s.text}/></span><span className={s.correctAnswer==='True'?'text-green-600 font-bold':'text-red-500 font-bold'}>{s.correctAnswer==='True'?'ĐÚNG':'SAI'}</span></div>))}</div>}{q.type==='short' && <div className="text-sm bg-green-50 p-2 rounded inline-block font-bold">Đáp án: {q.correctAnswer}</div>}</div>))}</div><div className="p-4 bg-gray-50 text-right"><button onClick={()=>setPreviewQuiz(null)} className="px-8 py-2 bg-gray-800 text-white rounded-lg font-bold">ĐÓNG</button></div></div></div>
      )}
    </div>
  );
};

export default AdminDashboard;
