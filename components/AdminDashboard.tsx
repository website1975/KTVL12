
import { useState, useEffect, useRef } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, SubQuestion, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, List, Upload, FileText, Image as ImageIcon, BarChart3, Eye, Edit, CheckCircle, XCircle, Filter, History, Search, BookOpen, GraduationCap, Lightbulb, UserPlus, Users, ChevronUp, ChevronDown, SortAsc, Database, SearchCode, Bold, Italic, Underline, CornerDownLeft, Sigma, FileSpreadsheet, AlertCircle, Loader2, Info, FileCheck, HelpCircle, Settings2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER COMPONENTS ---

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
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const text = el.value;
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
                <ToolbarBtn onClick={() => insertTag('<b>', '</b>')} icon={<Bold size={14}/>} tooltip="In đậm" />
                <ToolbarBtn onClick={() => insertTag('<i>', '</i>')} icon={<Italic size={14}/>} tooltip="In nghiêng" />
                <ToolbarBtn onClick={() => insertTag('<u>', '</u>')} icon={<Underline size={14}/>} tooltip="Gạch chân" />
                <ToolbarBtn onClick={() => insertTag('<br/>')} icon={<CornerDownLeft size={14}/>} tooltip="Xuống dòng" />
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <ToolbarBtn onClick={() => insertTag('$', '$')} icon={<Sigma size={14}/>} tooltip="Công thức toán" />
                <ToolbarBtn onClick={() => insertTag('$\\frac{', '}$') } label="a/b" tooltip="Phân số" />
                <ToolbarBtn onClick={() => insertTag('$^{', '}$') } label="x²" tooltip="Số mũ" />
                <ToolbarBtn onClick={() => insertTag('$_{', '}$') } label="x₁" tooltip="Chỉ số" />
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

// --- MAIN COMPONENT ---

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
  const [grade, setGrade] = useState<Grade>('12');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo máy chủ...');
  const [file, setFile] = useState<File | null>(null);

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', grade: '12' as Grade, role: 'student' as Role });

  const loadingMessages = [
    'Máy đang tải dữ liệu PDF...',
    'Đang kết nối trí tuệ nhân tạo Gemini...',
    'Đang quét cấu trúc đề thi...',
    'Đang trích xuất công thức Toán...',
    'Đang nhận diện đáp án A, B, C, D...',
    'Đang tổng hợp lời giải chi tiết...',
    'Sắp xong rồi, vui lòng đợi giây lát...'
  ];

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      let step = 0;
      interval = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        setLoadingMsg(loadingMessages[step]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const refreshData = async () => {
    const qData = await getQuizzes();
    setQuizzes(qData);
    const rData = await getResults();
    setResults(rData);
    const uData = await getUsers();
    setUsers(uData);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setQuestions([]);
    setStartTime('');
    setDuration(90);
    setFile(null);
    setIsPublished(false);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tên đề thi."); return; }
    if (questions.length === 0) { alert("Đề thi cần ít nhất 1 câu hỏi."); return; }
    
    const quizData: Quiz = {
      id: editingId || uuidv4(),
      title,
      description,
      type: quizType,
      grade,
      startTime: quizType === 'test' ? startTime : undefined,
      durationMinutes: duration,
      questions,
      createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      isPublished: isPublished
    };

    if (editingId) await updateQuiz(quizData);
    else await saveQuiz(quizData);

    await refreshData();
    setActiveTab('list');
    resetForm();
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

  const addManualQuestion = (type: QuestionType = 'mcq') => {
    let q: Question;
    if (type === 'mcq') {
      q = { id: uuidv4(), type: 'mcq', text: '', points: 0.25, options: ['', '', '', ''], correctAnswer: '', solution: '' };
    } else if (type === 'group-tf') {
      q = { id: uuidv4(), type: 'group-tf', text: '', points: 1.0, subQuestions: [{ id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }], solution: '' };
    } else {
      q = { id: uuidv4(), type: 'short', text: '', points: 0.5, correctAnswer: '', solution: '' };
    }
    setQuestions([...questions, q]);
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

  const handleFileUpload = async () => {
    if (!file) {
        alert("Vui lòng chọn file PDF.");
        return;
    }
    setIsProcessing(true);
    setLoadingMsg(loadingMessages[0]);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(',')[1];
      try {
        const extractedQuestions = await parseQuestionsFromPDF(base64Str);
        setQuestions([...questions, ...extractedQuestions]);
        alert(`Đã nhập thành công ${extractedQuestions.length} câu hỏi!`);
        setActiveTab('create');
      } catch (e: any) {
        alert(e.message || "Lỗi đọc PDF.");
      } finally {
        setIsProcessing(false);
      }
    };
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

  const onSelectImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files?.[0]) return;
    const url = await uploadImage(e.target.files[0]);
    if (url) updateQuestion(index, 'imageUrl', url);
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
    return (
      <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2">{label}</h3>
          <div className="flex gap-2">
            <button onClick={() => { setBankTargetType(type); setShowBankModal(true); setBankSelectedQuizId(''); }} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1"><Database size={14}/> Ngân hàng</button>
            <button onClick={() => addManualQuestion(type)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"><Plus size={14}/> Thêm câu</button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {questions.map((q, idx) => {
            if (q.type !== type) return null;
            return (
              <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-dashed text-sm">
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {idx + 1}</span>
                        <div className="flex gap-1">
                            <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={18}/></button>
                            <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={18}/></button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="text" className="w-14 border rounded p-1 text-center font-bold text-xs bg-gray-50" value={q.points} onChange={(e) => updateQuestion(idx, 'points', e.target.value.replace(',', '.'))} />
                        <button onClick={() => { if(window.confirm('Xóa câu này?')) { const n = [...questions]; n.splice(idx, 1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                    </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <RichTextEditor rows={2} value={q.text} onChange={(val) => updateQuestion(idx, 'text', val)} placeholder="Nội dung câu hỏi..." />
                    <div className="mt-2 p-3 bg-blue-50/30 rounded border border-blue-100 text-sm"><LatexText text={q.text || '...'} /></div>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" className="flex-1 border rounded p-2 text-xs" placeholder="Link ảnh..." value={q.imageUrl || ''} onChange={e => updateQuestion(idx, 'imageUrl', e.target.value)}/>
                    <label className="cursor-pointer bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200 transition text-xs font-bold flex items-center gap-1"><ImageIcon size={14}/> Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => onSelectImage(e, idx)} /></label>
                  </div>
                  {q.type === 'mcq' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options?.map((opt, optIdx) => (
                        <div key={optIdx} className="space-y-1">
                          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                            <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => updateQuestion(idx, 'correctAnswer', opt)} />
                            <span className="font-bold text-gray-400 w-4">{String.fromCharCode(65+optIdx)}.</span>
                            <RichTextEditor className="flex-1 border-none" value={opt} onChange={(val) => { const o = [...(q.options||[])]; o[optIdx]=val; updateQuestion(idx, 'options', o); if(q.correctAnswer===opt) updateQuestion(idx, 'correctAnswer', val); }} />
                          </div>
                          <div className="pl-8 text-xs text-gray-500 italic"><LatexText text={opt || '...'} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'short' && (
                    <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                      <span className="text-xs font-bold text-green-700 uppercase">Đáp số:</span>
                      <input type="text" className="flex-1 border-2 border-green-200 rounded p-2 font-bold" value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)} />
                    </div>
                  )}
                  {q.type === 'group-tf' && (
                    <div className="space-y-2">
                      {q.subQuestions?.map((sq, sqIdx) => (
                        <div key={sqIdx} className="bg-gray-50 p-2 rounded border border-gray-100">
                          <div className="flex gap-2 items-center">
                            <span className="font-bold text-gray-400 w-4">{String.fromCharCode(97+sqIdx)})</span>
                            <RichTextEditor className="flex-1" value={sq.text} onChange={(val) => { const s = [...(q.subQuestions||[])]; s[sqIdx].text = val; updateQuestion(idx, 'subQuestions', s); }} />
                            <div className="flex gap-1 shrink-0">
                              <button onClick={()=>{const s=[...(q.subQuestions||[])]; s[sqIdx].correctAnswer='True'; updateQuestion(idx,'subQuestions',s);}} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='True'?'bg-green-600 text-white':'bg-white text-gray-300'}`}>Đ</button>
                              <button onClick={()=>{const s=[...(q.subQuestions||[])]; s[sqIdx].correctAnswer='False'; updateQuestion(idx,'subQuestions',s);}} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='False'?'bg-red-600 text-white':'bg-white text-gray-300'}`}>S</button>
                            </div>
                          </div>
                          <div className="pl-8 text-xs text-gray-500 italic mt-1"><LatexText text={sq.text || '...'} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-dashed">
                    <div className="flex items-center gap-1 mb-2 text-yellow-600 font-bold text-[10px] uppercase"><Lightbulb size={14} /> Lời giải chi tiết:</div>
                    <RichTextEditor rows={3} className="bg-yellow-50/50 border-yellow-100" value={q.solution || ''} onChange={(val) => updateQuestion(idx, 'solution', val)} />
                    <div className="mt-1 p-2 bg-yellow-50/30 rounded border border-yellow-50 text-xs text-yellow-800 italic"><LatexText text={q.solution || 'Chưa có lời giải'} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Settings2 className="text-blue-600" /> Hệ Thống Quản Trị EduQuiz</h1>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><List size={20} /> Danh Sách Đề</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>{editingId ? <Edit size={20} /> : <Plus size={20} />} {editingId ? 'Sửa Đề' : 'Soạn Đề Thủ Công'}</button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'import' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Upload size={20} /> Nhập Từ File PDF</button>
        <button onClick={() => { setActiveTab('results'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><BarChart3 size={20} /> Kết Quả Thi</button>
        <button onClick={() => { setActiveTab('students'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'students' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Users size={20} /> Quản Lý Học Sinh</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3">
             <span className="font-bold text-gray-700 flex items-center gap-1"><Filter size={18}/> Lọc Khối:</span>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['all', '10', '11', '12'] as const).map(g => (
                    <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${quizFilterGrade === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{g === 'all' ? 'Tất cả' : `Lớp ${g}`}</button>
                ))}
             </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
               <h2 className="text-lg font-bold text-red-700 uppercase border-b-2 border-red-200 pb-2 flex items-center gap-2"><FileText size={20}/> Bài Kiểm Tra</h2>
               {quizzes.filter(q => q.type === 'test' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade)).map(q => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-red-300 hover:shadow-md transition flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                          {q.isPublished ? <CheckCircle className="text-green-500" size={20}/> : <AlertCircle className="text-yellow-500" size={20}/>}
                          <div>
                            <h3 className="font-bold text-gray-800">{q.title}</h3>
                            <div className="flex items-center gap-2 text-[10px] mt-1">
                                <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">LỚP {q.grade}</span>
                                <span className="text-gray-400">|</span>
                                <span className={`${q.isPublished ? 'text-green-600' : 'text-yellow-600'} font-bold uppercase`}>{q.isPublished ? 'Công bố' : 'Bản nháp'}</span>
                            </div>
                          </div>
                      </div>
                      <div className="flex gap-1">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Chỉnh sửa"><Edit size={18}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề này vĩnh viễn?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition" title="Xóa"><Trash2 size={18}/></button>
                      </div>
                  </div>
               ))}
            </div>
            <div className="space-y-3">
               <h2 className="text-lg font-bold text-green-700 uppercase border-b-2 border-green-200 pb-2 flex items-center gap-2"><BookOpen size={20}/> Bài Luyện Tập</h2>
               {quizzes.filter(q => q.type === 'practice' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade)).map(q => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-md transition flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="text-blue-400" size={20}/>
                        <div>
                          <h3 className="font-bold text-gray-800">{q.title}</h3>
                          <div className="flex items-center gap-2 text-[10px] mt-1">
                              <span className="bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-bold">LỚP {q.grade}</span>
                              <span className="text-gray-400">|</span>
                              <span className="text-gray-500 uppercase font-bold">{q.questions.length} câu hỏi</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={18}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề luyện tập?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
                      </div>
                  </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2"><Info className="text-blue-500"/> Thông Tin Đề Thi</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border-2 rounded-lg p-3 focus:border-blue-500 outline-none transition" placeholder="Nhập tên đề thi (ví dụ: Kiểm tra giữa kỳ 1 Toán 12)" value={title} onChange={e => setTitle(e.target.value)}/>
                 <textarea className="w-full border-2 rounded-lg p-3 focus:border-blue-500 outline-none transition" rows={2} placeholder="Mô tả ngắn gọn về nội dung đề thi..." value={description} onChange={e => setDescription(e.target.value)}/>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase ml-1">Loại đề</label><select className="w-full border rounded-lg p-2.5 bg-gray-50" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase ml-1">Khối lớp</label><select className="w-full border rounded-lg p-2.5 bg-gray-50" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase ml-1">Thời gian (phút)</label><input type="number" className="w-full border rounded-lg p-2.5" value={duration} onChange={e => setDuration(Number(e.target.value))}/></div>
                    {quizType === 'test' && <div><label className="text-xs font-bold text-gray-500 uppercase ml-1">Ngày giờ bắt đầu</label><input type="datetime-local" className="w-full border rounded-lg p-2.5" value={startTime} onChange={e => setStartTime(e.target.value)}/></div>}
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Câu hỏi trắc nghiệm khách quan', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi Đúng - Sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Câu hỏi Trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl border shadow-xl sticky top-24">
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Tổng quan đề thi</h4>
                  <div className="flex justify-between items-center mb-2 font-bold text-gray-600"><span>Số lượng câu:</span><span className="text-blue-600">{questions.length}</span></div>
                  <div className="flex justify-between items-center mb-6 font-bold text-gray-600"><span>Tổng điểm:</span><span className="text-blue-600 text-2xl">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</span></div>
                  
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-dashed flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">Trạng thái đăng:</span>
                      <button onClick={() => setIsPublished(!isPublished)} className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold border transition-all shadow-sm ${isPublished ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-400 border-gray-300'}`}>
                          {isPublished ? 'CÔNG KHAI' : 'LƯU NHÁP'}
                      </button>
                  </div>

                  <button onClick={handleSaveQuiz} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-extrabold shadow-lg flex justify-center items-center gap-2 transition transform active:scale-95">
                      <Save size={20} /> HOÀN TẤT & LƯU ĐỀ
                  </button>
                  <p className="mt-4 text-[10px] text-gray-400 text-center italic">Đề thi sẽ được lưu vào hệ thống và sẵn sàng để học sinh vào thi.</p>
               </div>
           </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-8 animate-fade-in">
          {/* HƯỚNG DẪN MẪU ĐỀ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="bg-indigo-600 px-6 py-4 flex items-center gap-2 text-white">
                <FileCheck size={22}/>
                <h3 className="font-bold uppercase tracking-wide">Mẫu đề thi chuẩn (Định dạng MOET 2025)</h3>
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex flex-col h-full">
                   <div className="flex items-center gap-2 mb-3 text-blue-700 font-extrabold text-sm uppercase"><span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span> Phần I: Trắc nghiệm</div>
                   <div className="bg-white p-3 rounded border font-mono text-[10px] leading-relaxed flex-1 shadow-sm">
                      <p className="text-gray-400 mb-1">Câu 1. Nội dung câu hỏi...</p>
                      <p>A. Lựa chọn 1</p>
                      <p className="text-blue-600 font-bold">*B. Đáp án đúng (Có dấu *)</p>
                      <p>C. Lựa chọn 3</p>
                      <p>D. Lựa chọn 4</p>
                      <p className="mt-2 text-indigo-500 italic">Lời giải: Giải thích chi tiết...</p>
                   </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 flex flex-col h-full">
                   <div className="flex items-center gap-2 mb-3 text-purple-700 font-extrabold text-sm uppercase"><span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span> Phần II: Đúng/Sai</div>
                   <div className="bg-white p-3 rounded border font-mono text-[10px] leading-relaxed flex-1 shadow-sm">
                      <p className="text-gray-400 mb-1">Câu 2. Nội dung câu hỏi...</p>
                      <p>a) Mệnh đề 1 <span className="text-green-600 font-bold">(Đ)</span></p>
                      <p>b) Mệnh đề 2 <span className="text-red-600 font-bold">(S)</span></p>
                      <p>c) Mệnh đề 3 <span className="text-green-600 font-bold">(Đ)</span></p>
                      <p>d) Mệnh đề 4 <span className="text-red-600 font-bold">(S)</span></p>
                   </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100 flex flex-col h-full">
                   <div className="flex items-center gap-2 mb-3 text-green-700 font-extrabold text-sm uppercase"><span className="bg-green-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">3</span> Phần III: Trả lời ngắn</div>
                   <div className="bg-white p-3 rounded border font-mono text-[10px] leading-relaxed flex-1 shadow-sm">
                      <p className="text-gray-400 mb-1">Câu 3. Nội dung câu hỏi...</p>
                      <p className="font-bold text-green-600 mt-2">Đáp số: 12.5</p>
                      <p className="mt-2 text-indigo-500 italic">Lời giải: Sử dụng công thức...</p>
                   </div>
                </div>
             </div>
             <div className="px-6 pb-4 flex items-center gap-2 text-amber-600 text-xs font-bold">
                <AlertCircle size={14}/> 
                {/* FIX: Escaped y within a string literal to prevent TS2304 error on Vercel */}
                <span>{'Lưu ý: Công thức toán hãy để trong dấu $...$ (Ví dụ: $x^2 + \\sqrt{y}$). AI sẽ tự động nhận diện.'}</span>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center relative overflow-hidden h-full min-h-[400px]">
              {isProcessing ? (
                  <div className="py-20 flex flex-col items-center z-10 animate-fade-in">
                      <div className="relative mb-8">
                         {/* Biểu tượng xoay sinh động báo máy đang tải */}
                         <div className="w-24 h-24 border-8 border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-inner"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="text-blue-500 w-10 h-10 animate-pulse" />
                         </div>
                      </div>
                      <h3 className="text-2xl font-black text-gray-800 mb-4 uppercase tracking-tighter">Đang xử lý đề thi PDF</h3>
                      <div className="bg-blue-600 px-8 py-3 rounded-2xl shadow-2xl shadow-blue-200 flex items-center gap-3">
                        <Loader2 className="animate-spin text-white" size={20}/>
                        <span className="text-white font-black text-sm uppercase tracking-widest">{loadingMsg}</span>
                      </div>
                      <p className="text-gray-400 text-[10px] max-w-xs mx-auto mt-6 italic">Hệ thống đang sử dụng trí tuệ nhân tạo để trích xuất dữ liệu. Vui lòng không đóng cửa sổ này.</p>
                  </div>
              ) : (
                  <>
                      <div className="bg-blue-50 w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-inner">
                          <Upload className="w-12 h-12 text-blue-500" />
                      </div>
                      <h3 className="text-2xl font-black mb-4 text-gray-800 uppercase">Nhập đề PDF tự động</h3>
                      <p className="text-gray-500 mb-8 max-w-sm mx-auto">Tải file PDF đề thi của bạn lên, AI sẽ tự động tách câu hỏi, đáp án và lời giải.</p>
                      
                      <div className="w-full border-2 border-dashed border-gray-300 rounded-3xl p-16 hover:border-blue-500 transition-all cursor-pointer bg-gray-50 group relative">
                          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4 group-hover:text-blue-500 transition-all group-hover:scale-110" />
                          <p className="font-extrabold text-gray-600 text-lg">{file ? file.name : "Chọn hoặc kéo thả file PDF"}</p>
                          <p className="text-gray-400 text-sm mt-2">Hỗ trợ PDF văn bản, công thức Toán học</p>
                      </div>

                      <button 
                          onClick={handleFileUpload} 
                          disabled={!file} 
                          className="w-full mt-10 bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl disabled:opacity-50 transition shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 transform active:scale-95"
                      >
                          <Database size={20}/> TẢI LÊN & XỬ LÝ VỚI AI
                      </button>
                  </>
              )}
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 h-full">
               <div className="flex items-center gap-3 mb-8">
                  <div className="bg-amber-100 p-3 rounded-2xl text-amber-600"><HelpCircle size={28}/></div>
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Mẹo để trích xuất chuẩn</h3>
               </div>
               <div className="space-y-6">
                  <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400">01</div>
                     <div>
                        <h4 className="font-bold text-gray-800 mb-1">Dấu (*) trước đáp án</h4>
                        <p className="text-sm text-gray-500">{'Ví dụ: *C. Nội dung đáp án đúng. Máy sẽ tự động nhận diện câu trả lời.'}</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400">02</div>
                     <div>
                        <h4 className="font-bold text-gray-800 mb-1">Cụm từ "Lời giải:"</h4>
                        <p className="text-sm text-gray-500">Mọi nội dung phía sau chữ "Lời giải:" sẽ được lưu vào phần hướng dẫn chi tiết cho học sinh.</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400">03</div>
                     <div>
                        <h4 className="font-bold text-gray-800 mb-1">Đánh số "Câu X."</h4>
                        <p className="text-sm text-gray-500">Bắt đầu mỗi câu bằng "Câu 1.", "Câu 2." để máy tách các câu hỏi một cách chính xác.</p>
                     </div>
                  </div>
                  <div className="flex gap-4">
                     <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 font-black text-gray-400">04</div>
                     <div>
                        <h4 className="font-bold text-gray-800 mb-1">Chất lượng PDF</h4>
                        <p className="text-sm text-gray-500">Sử dụng file PDF sạch (xuất từ Word) sẽ có độ chính xác 100% so với file PDF scan ảnh.</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
            <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4 items-center">
                <span className="text-sm font-bold text-gray-700 uppercase flex items-center gap-1"><Filter size={16}/> Lọc:</span>
                <select className="border rounded-lg p-2 text-sm bg-white font-bold" value={resultFilterGrade} onChange={e => { setResultFilterGrade(e.target.value as Grade | 'all'); setSelectedQuizId(''); }}>
                    <option value="all">Tất cả Khối</option>
                    <option value="10">Lớp 10</option>
                    <option value="11">Lớp 11</option>
                    <option value="12">Lớp 12</option>
                </select>
                <select className="border rounded-lg p-2 text-sm flex-1 min-w-[200px] bg-white font-bold" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                    <option value="">-- Tất cả Đề Thi --</option>
                    {quizzes.filter(q => resultFilterGrade === 'all' || q.grade === resultFilterGrade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
                {selectedQuizId && <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-extrabold flex items-center gap-2 shadow-sm hover:bg-green-700"><FileSpreadsheet size={16}/> XUẤT EXCEL</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-500 uppercase text-[10px] font-extrabold">
                      <tr>
                          <th className="p-4">STT</th>
                          <th className="p-4">Họ và Tên Học Sinh</th>
                          <th className="p-4">Đề Thi</th>
                          <th className="p-4 text-center">Điểm số</th>
                          <th className="p-4">Thời gian nộp</th>
                          <th className="p-4 text-right">Thao tác</th>
                      </tr>
                  </thead>
                  <tbody>
                      {results.filter(r => {
                          const quiz = quizzes.find(q => q.id === r.quizId);
                          const matchesGrade = resultFilterGrade === 'all' || quiz?.grade === resultFilterGrade;
                          const matchesQuiz = !selectedQuizId || r.quizId === selectedQuizId;
                          return matchesGrade && matchesQuiz;
                      }).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map((r, i) => (
                          <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="p-4 text-gray-400 font-mono">{i+1}</td>
                              <td className="p-4 font-bold text-gray-800">{r.studentName}</td>
                              <td className="p-4 text-gray-600">{quizzes.find(q => q.id === r.quizId)?.title || "N/A"}</td>
                              <td className="p-4 text-center">
                                  <span className={`font-extrabold text-lg ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{r.score.toFixed(2)}</span>
                              </td>
                              <td className="p-4 text-gray-500">{format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm")}</td>
                              <td className="p-4 text-right">
                                  <button onClick={async () => { if(window.confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="text-red-400 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                              </td>
                          </tr>
                      ))}
                      {results.length === 0 && (
                          <tr><td colSpan={6} className="p-10 text-center text-gray-400 italic font-medium">Chưa có kết quả thi nào.</td></tr>
                      )}
                  </tbody>
              </table>
            </div>
        </div>
      )}

      {activeTab === 'students' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
              <div className="p-6 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
                  <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input type="text" placeholder="Tìm tên hoặc tài khoản học sinh..." className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}/>
                  </div>
                  <button onClick={() => { setEditingUser(null); setUserForm({fullName:'', username:'', password:'', grade:'12', role:'student'}); setShowUserModal(true); }} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-extrabold flex items-center gap-2 shadow-lg shadow-blue-100"><UserPlus size={18} /> THÊM HỌC SINH</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 border-b text-gray-500 text-[10px] uppercase font-extrabold"><tr><th className="p-4">STT</th><th className="p-4">Họ và Tên</th><th className="p-4">Tên đăng nhập</th><th className="p-4">Mật khẩu</th><th className="p-4">Khối</th><th className="p-4 text-right">Thao tác</th></tr></thead>
                    <tbody>
                        {users.filter(u=>u.role==='student' && (u.fullName.toLowerCase().includes(searchUser.toLowerCase()) || u.username.toLowerCase().includes(searchUser.toLowerCase()))).map((u, i) => (
                        <tr key={u.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-gray-400 font-mono">{i+1}</td>
                            <td className="p-4 font-bold text-gray-800">{u.fullName}</td>
                            <td className="p-4 font-mono text-blue-600 font-bold">{u.username}</td>
                            <td className="p-4 font-mono text-gray-400">{u.password}</td>
                            <td className="p-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-extrabold uppercase">LỚP {u.grade}</span></td>
                            <td className="p-4 text-right flex justify-end gap-1">
                                <button onClick={() => { setEditingUser(u); setUserForm({fullName:u.fullName, username:u.username, password:u.password, grade:u.grade||'12', role:u.role}); setShowUserModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={async () => { if(window.confirm('Xóa vĩnh viễn tài khoản?')) { await deleteUser(u.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              </div>
          </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center"><h3 className="font-bold">Quản lý Tài Khoản</h3><button onClick={() => setShowUserModal(false)}><XCircle size={24}/></button></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-xs font-extrabold text-gray-400 uppercase mb-1">Họ Tên</label><input type="text" className="w-full border rounded-lg p-2.5 font-bold" value={userForm.fullName} onChange={e=>setUserForm({...userForm, fullName:e.target.value})}/></div>
              <div><label className="block text-xs font-extrabold text-gray-400 uppercase mb-1">Tên đăng nhập</label><input type="text" className="w-full border rounded-lg p-2.5 font-mono text-blue-600 font-bold" value={userForm.username} onChange={e=>setUserForm({...userForm, username:e.target.value})} disabled={!!editingUser}/></div>
              <div><label className="block text-xs font-extrabold text-gray-400 uppercase mb-1">Mật khẩu</label><input type="text" className="w-full border rounded-lg p-2.5 font-mono" value={userForm.password} onChange={e=>setUserForm({...userForm, password:e.target.value})}/></div>
              <div><label className="block text-xs font-extrabold text-gray-400 uppercase mb-1">Khối lớp</label><select className="w-full border rounded-lg p-2.5 font-bold" value={userForm.grade} onChange={e=>setUserForm({...userForm, grade:e.target.value as Grade})}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
              <button onClick={handleSaveUser} className="w-full bg-blue-600 text-white font-extrabold py-3 rounded-xl shadow-lg transition transform active:scale-95">LƯU THÔNG TIN</button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION BANK MODAL */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div><h3 className="text-xl font-bold flex items-center gap-2"><Database size={24}/> Ngân hàng câu hỏi Lớp {grade}</h3></div>
                      <button onClick={() => setShowBankModal(false)} className="hover:rotate-90 transition-transform duration-300"><XCircle size={28}/></button>
                  </div>
                  <div className="p-6 border-b bg-gray-50 shrink-0 flex flex-wrap gap-4 items-center">
                      <span className="text-sm font-bold text-gray-500">Nguồn:</span>
                      <select className="flex-1 min-w-[300px] border rounded-lg p-2.5 shadow-sm font-bold" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}>
                          <option value="">-- Chọn đề thi nguồn --</option>
                          {quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                          <option value="ALL">Xem tất cả</option>
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-100">
                      {bankSelectedQuizId === '' ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60"><SearchCode size={64} className="mb-4"/><p className="font-bold">Vui lòng chọn đề thi nguồn</p></div>
                      ) : (
                          <>
                            {(() => {
                                let sourceQuizzes = bankSelectedQuizId === 'ALL' ? quizzes : quizzes.filter(q => q.id === bankSelectedQuizId);
                                let allQs: Question[] = [];
                                sourceQuizzes.forEach(sq => {
                                  sq.questions.filter(q => q.type === bankTargetType).forEach(q => {
                                    allQs.push({ ...q, solution: q.solution || `(Đề: ${sq.title})` });
                                  });
                                });
                                return allQs.map((q, qIdx) => (
                                    <div key={q.id || qIdx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-400 transition-all flex justify-between items-start gap-4 group">
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-xs font-bold text-indigo-500 mb-1 uppercase tracking-tight">CÂU HỎI TỪ NGÂN HÀNG</div>
                                            <div className="text-sm text-gray-800 font-medium"><LatexText text={q.text}/></div>
                                        </div>
                                        <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 shadow-lg transform active:scale-90 transition-all"><Plus size={20}/></button>
                                    </div>
                                ));
                            })()}
                          </>
                      )}
                  </div>
                  <div className="p-4 bg-gray-50 border-t text-right shrink-0"><button onClick={() => setShowBankModal(false)} className="px-12 py-3 bg-gray-800 text-white rounded-xl font-extrabold shadow-lg">ĐÓNG</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
