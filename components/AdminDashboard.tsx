
import { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
// Fix: Added CheckCircle and Trophy to the imports from lucide-react to resolve "Cannot find name" errors
import { Plus, Trash2, Save, List, Upload, FileText, BarChart3, Edit, XCircle, Filter, BookOpen, Lightbulb, Users, ChevronRight, Database, Bold, Italic, Underline, CornerDownLeft, Sigma, Info, Settings2, FolderTree, Layers, Sparkles, Zap, BrainCircuit, RefreshCw, Loader2, PieChart, TrendingUp, UserCheck, Calendar, ListChecks, Search, GraduationCap, CheckCircle, Trophy } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER COMPONENTS ---
interface ToolbarButtonProps { onClick: () => void; icon?: React.ReactNode; label?: string; tooltip: string; }
const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button type="button" onClick={onClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-medium text-xs flex items-center gap-1 border border-transparent hover:border-gray-300 transition-all min-w-[24px] justify-center" title={tooltip}>
        {icon} {label && <span>{label}</span>}
    </button>
);

interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; }
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
                <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} className={`w-full p-3 outline-none text-sm font-mono leading-relaxed resize-y ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" className={`w-full p-2 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students' | 'auto'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Filters
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterQuizId, setResultFilterQuizId] = useState<string>('all');
  const [studentFilterGrade, setStudentFilterGrade] = useState<Grade | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo...');
  const [file, setFile] = useState<File | null>(null);

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // AI Auto Gen State
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 10, p2: 4, p3: 6, diff: 'Thông hiểu' });

  const loadingMessages = ['Đang trích xuất dữ liệu...', 'Đang nhận diện công thức toán học...', 'Đang phân tích lời giải chi tiết...', 'Đang hoàn tất cấu trúc đề thi...'];

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade).forEach((q: Quiz) => {
      const catName = q.category || 'Chưa phân loại';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(q);
    });
    return groups;
  }, [quizzes, quizFilterGrade]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
        const quiz = quizzes.find(q => q.id === r.quizId);
        const matchesQuiz = resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId;
        const matchesGrade = quizFilterGrade === 'all' || (quiz && quiz.grade === quizFilterGrade);
        return matchesQuiz && matchesGrade;
    }).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [results, resultFilterQuizId, quizFilterGrade, quizzes]);

  const stats = useMemo(() => {
    const totalResults = filteredResults.length;
    const avgScore = totalResults > 0 ? filteredResults.reduce((sum, r) => sum + r.score, 0) / totalResults : 0;
    const topScore = totalResults > 0 ? Math.max(...filteredResults.map(r => r.score)) : 0;
    return { totalResults, avgScore, topScore };
  }, [filteredResults]);

  const filteredStudents = useMemo(() => {
      return users.filter(u => u.role === 'student' && (studentFilterGrade === 'all' || u.grade === studentFilterGrade));
  }, [users, studentFilterGrade]);

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    quizzes.forEach((q: Quiz) => { if (q.category) cats.add(q.category); });
    return Array.from(cats).sort();
  }, [quizzes]);

  useEffect(() => { refreshData(); }, [activeTab]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      let step = 0;
      interval = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        setLoadingMsg(loadingMessages[step]);
      }, 3000);
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
    setEditingId(null); setTitle(''); setDescription(''); setCategory(''); setQuestions([]); setStartTime(''); setDuration(90); setFile(null); setIsPublished(false);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: prev[cat] === false ? true : false
    }));
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tên đề thi."); return; }
    if (questions.length === 0) { alert("Đề thi cần ít nhất 1 câu hỏi."); return; }
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description, category: category.trim() || undefined, type: quizType, grade, startTime: quizType === 'test' ? startTime : undefined, durationMinutes: duration, questions, createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(), isPublished: isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    await refreshData(); setActiveTab('list'); resetForm();
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingId(quiz.id); setTitle(quiz.title); setDescription(quiz.description); setCategory(quiz.category || ''); setQuizType(quiz.type); setGrade(quiz.grade); setStartTime(quiz.startTime || ''); setDuration(quiz.durationMinutes); setQuestions(quiz.questions); setIsPublished(quiz.isPublished); setActiveTab('create');
  };

  const handleAutoGenerate = async () => {
      if (!aiTopic.trim()) { alert("Vui lòng nhập chủ đề."); return; }
      setIsProcessing(true);
      try {
          const generated = await generateQuizFromPrompt({
              grade,
              category: category || "Chung",
              topic: aiTopic,
              part1Count: aiConfig.p1,
              part2Count: aiConfig.p2,
              part3Count: aiConfig.p3,
              difficulty: aiConfig.diff
          });
          setQuestions(generated);
          setTitle(`Đề thi AI - ${aiTopic}`);
          alert(`Đã soạn xong ${generated.length} câu hỏi. Hãy kiểm tra lại ở Tab Soạn Đề!`);
          setActiveTab('create');
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleFileUpload = async () => {
    if (!file) { alert("Vui lòng chọn file PDF."); return; }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(',')[1];
      try {
        const extracted = await parseQuestionsFromPDF(base64Str);
        setQuestions([...questions, ...extracted]);
        alert(`Đã phân tích xong ${extracted.length} câu hỏi từ PDF!`);
        setActiveTab('create');
      } catch (e: any) { alert(e.message); } finally { setIsProcessing(false); }
    };
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
    return (
      <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2">{label}</h3>
          <div className="flex gap-2">
            <button onClick={() => { setBankTargetType(type); setShowBankModal(true); setBankSelectedQuizId(''); }} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 transition-all"><Database size={14}/> Ngân hàng</button>
            <button onClick={() => {
                let q: Question;
                if (type === 'mcq') q = { id: uuidv4(), type: 'mcq', text: '', points: 0.25, options: ['', '', '', ''], correctAnswer: '', solution: '' };
                else if (type === 'group-tf') q = { id: uuidv4(), type: 'group-tf', text: '', points: 1.0, subQuestions: [{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'}], solution: '' };
                else q = { id: uuidv4(), type: 'short', text: '', points: 0.5, correctAnswer: '', solution: '' };
                setQuestions([...questions, q]);
            }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm transition-all"><Plus size={14}/> Thêm câu</button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {questions.map((q, idx) => {
            if (q.type !== type) return null;
            return (
              <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-dashed text-sm">
                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {idx + 1}</span>
                    <div className="flex items-center gap-3">
                        <input type="text" className="w-14 border rounded p-1 text-center font-bold text-xs bg-gray-50" value={q.points} onChange={(e) => {
                            const n = [...questions]; n[idx].points = e.target.value; setQuestions(n);
                        }} />
                        <button onClick={() => { if(window.confirm('Xóa?')) { const n = [...questions]; n.splice(idx,1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full transition-all"><Trash2 size={16}/></button>
                    </div>
                </div>
                <div className="space-y-4">
                  <RichTextEditor rows={2} value={q.text} onChange={(val) => { const n = [...questions]; n[idx].text = val; setQuestions(n); }} placeholder="Nội dung câu hỏi..." />
                  {q.type === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                          <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[idx].correctAnswer = opt; setQuestions(n); }} />
                          <RichTextEditor className="flex-1 border-none bg-transparent" value={opt} onChange={(val) => { const o = [...(q.options||[])]; o[optIdx]=val; const n = [...questions]; n[idx].options=o; setQuestions(n); }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'short' && (
                      <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-600">Đáp án đúng (số):</span>
                          <input type="text" className="border rounded-lg p-2 flex-1 focus:ring-2 focus:ring-blue-100 outline-none" value={q.correctAnswer || ''} onChange={(e) => { const n = [...questions]; n[idx].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Ví dụ: 6.5" />
                      </div>
                  )}
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <h5 className="text-[10px] font-bold text-yellow-700 uppercase flex items-center gap-1 mb-2"><Lightbulb size={12}/> Lời giải:</h5>
                    <RichTextEditor rows={2} value={q.solution || ''} onChange={(val) => { const n = [...questions]; n[idx].text = val; setQuestions(n); }} placeholder="Giải thích chi tiết..." />
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2 tracking-tight"><Settings2 className="text-blue-600" size={32} /> EDUQUIZ <span className="text-blue-600">ADMIN</span></h1>
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border">
              {(['all', '10', '11', '12'] as const).map(g => (
                  <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizFilterGrade === g ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ KHỐI' : `LỚP ${g}`}</button>
              ))}
          </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'list' ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><List size={18} /> QUẢN LÝ ĐỀ</button>
        <button onClick={() => setActiveTab('auto')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'auto' ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BrainCircuit size={18} /> SOẠN ĐỀ AI</button>
        <button onClick={() => setActiveTab('import')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'import' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Upload size={18} /> NHẬP TỪ PDF</button>
        <button onClick={() => setActiveTab('results')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'results' ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={18} /> KẾT QUẢ & THỐNG KÊ</button>
        <button onClick={() => setActiveTab('students')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'students' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Users size={18} /> HỌC SINH</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-fade-in">
          {Object.keys(groupedQuizzes).length === 0 ? (
              <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-gray-200 text-center flex flex-col items-center">
                  <div className="p-6 bg-gray-50 rounded-full text-gray-300 mb-4"><Database size={48}/></div>
                  <h3 className="text-xl font-bold text-gray-400">Chưa có đề thi nào trong danh sách.</h3>
                  <button onClick={() => setActiveTab('auto')} className="mt-4 text-blue-600 font-bold hover:underline">Thử soạn đề bằng AI ngay!</button>
              </div>
          ) : (
            Object.keys(groupedQuizzes).sort().map(cat => (
              <div key={cat} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <button onClick={() => toggleCategory(cat)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-100/50 transition-all border-b text-left">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><FolderTree size={20}/></div>
                    <div><h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{cat}</h3><p className="text-[10px] text-gray-400 font-bold uppercase">{groupedQuizzes[cat].length} bài đăng</p></div>
                  </div>
                  <ChevronRight size={20} className={`text-gray-400 transition-transform ${expandedCategories[cat] === false ? '' : 'rotate-90'}`}/>
                </button>
                {(expandedCategories[cat] !== false) && (
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                    {groupedQuizzes[cat].map(q => (
                      <div key={q.id} className="bg-white p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex justify-between items-center group">
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                            {q.type === 'test' ? <FileText size={24}/> : <BookOpen size={24}/>}
                          </div>
                          <div className="overflow-hidden"><h3 className="font-bold text-gray-800 truncate">{q.title}</h3><div className="flex gap-2 items-center mt-1"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${q.isPublished ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>{q.isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</span><span className="text-[9px] text-gray-400 font-bold">{q.questions.length} CÂU | {q.durationMinutes} PHÚT</span></div></div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={18}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Upload size={32}/></div>
                      <div><h2 className="text-2xl font-black text-gray-800">Tải Lên File PDF</h2><p className="text-gray-400 text-sm font-medium">Hệ thống AI sẽ tự động bóc tách câu hỏi và lời giải chi tiết.</p></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 border-dashed">
                          <h4 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2"><Info size={14}/> Quy định định dạng file mẫu</h4>
                          <ul className="text-xs text-slate-600 space-y-3 font-medium">
                              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0"/> Phần I: MCQ 4 đáp án (Kèm dấu * ở đáp án đúng).</li>
                              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0"/> Phần II: Trắc nghiệm Đ/S (Ghi rõ ý a, b, c, d).</li>
                              <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0"/> Phần III: Trả lời ngắn (Đáp số là số cụ thể).</li>
                              <li className="flex items-start gap-2 text-blue-600 font-bold"><Sparkles size={14} className="shrink-0"/> Đặt tiêu đề "HƯỚNG DẪN GIẢI" hoặc "LỜI GIẢI" ở cuối file để AI nhận diện lời giải chi tiết cho từng câu.</li>
                          </ul>
                      </div>
                      <div className="flex flex-col justify-center items-center p-8 bg-blue-50/30 rounded-2xl border-2 border-dashed border-blue-200">
                          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                          <label htmlFor="pdf-upload" className="cursor-pointer group flex flex-col items-center gap-2">
                              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform"><FileText size={32}/></div>
                              <span className="font-bold text-blue-600 mt-2 text-center">{file ? file.name : "Nhấp để chọn file PDF"}</span>
                          </label>
                      </div>
                  </div>

                  <button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={20}/>}
                      {isProcessing ? "ĐANG PHÂN TÍCH FILE..." : "BẮT ĐẦU TRÍCH XUẤT AI"}
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'results' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng lượt thi</p><p className="text-2xl font-black">{stats.totalResults}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-green-50 text-green-600 rounded-xl"><PieChart size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm trung bình</p><p className="text-2xl font-black">{stats.avgScore.toFixed(2)}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Trophy size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm cao nhất</p><p className="text-2xl font-black">{stats.topScore.toFixed(2)}</p></div>
                  </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 w-full"><label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Lọc theo Đề thi</label><select className="w-full border rounded-xl p-2.5 font-bold text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100" value={resultFilterQuizId} onChange={e => setResultFilterQuizId(e.target.value)}><option value="all">Tất cả đề thi</option>{quizzes.map(q => <option key={q.id} value={q.id}>{q.title} (Lớp {q.grade})</option>)}</select></div>
                  <button onClick={refreshData} className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all self-end"><RefreshCw size={20}/></button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b">
                              <tr>
                                  <th className="px-6 py-4">Học sinh</th>
                                  <th className="px-6 py-4">Đề thi</th>
                                  <th className="px-6 py-4">Ngày nộp</th>
                                  <th className="px-6 py-4 text-center">Thời gian</th>
                                  <th className="px-6 py-4 text-right">Điểm</th>
                                  <th className="px-6 py-4 text-center">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {filteredResults.length === 0 ? (
                                  <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold">Không có kết quả nào phù hợp.</td></tr>
                              ) : (
                                filteredResults.map(r => (
                                    <tr key={r.id} className="hover:bg-blue-50/30 transition-all">
                                        <td className="px-6 py-4 font-bold text-gray-800">{r.studentName}</td>
                                        <td className="px-6 py-4 font-medium text-gray-500 truncate max-w-[200px]">{quizzes.find(q => q.id === r.quizId)?.title || "Đề đã xóa"}</td>
                                        <td className="px-6 py-4 text-gray-400 font-medium">{format(parseISO(r.submittedAt), "HH:mm dd/MM")}</td>
                                        <td className="px-6 py-4 text-center text-gray-500 font-mono">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                        <td className="px-6 py-4 text-right"><span className={`font-black text-lg ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{r.score.toFixed(2)}</span></td>
                                        <td className="px-6 py-4 text-center"><button onClick={async () => { if(window.confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-red-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'students' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                      {(['all', '10', '11', '12'] as const).map(g => (
                          <button key={g} onClick={() => setStudentFilterGrade(g)} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${studentFilterGrade === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ' : `KHỐI ${g}`}</button>
                      ))}
                  </div>
                  <div className="text-sm font-black text-gray-400 uppercase tracking-widest">Sỹ số: {filteredStudents.length} học sinh</div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                              <tr>
                                  <th className="px-6 py-5">Họ và Tên</th>
                                  <th className="px-6 py-5">Tên đăng nhập</th>
                                  <th className="px-6 py-5">Khối</th>
                                  <th className="px-6 py-5 text-center">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {filteredStudents.length === 0 ? (
                                  <tr><td colSpan={4} className="px-6 py-20 text-center text-gray-400 font-bold">Danh sách trống.</td></tr>
                              ) : (
                                filteredStudents.map(u => (
                                    <tr key={u.id} className="hover:bg-indigo-50/20 transition-all">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black"><GraduationCap size={20}/></div>
                                                <span className="font-bold text-gray-800">{u.fullName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-gray-500">{u.username}</td>
                                        <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">Lớp {u.grade}</span></td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => { if(window.confirm('Xóa tài khoản này?')) { deleteUser(u.id); refreshData(); } }} className="p-2.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                                        </td>
                                    </tr>
                                ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'auto' && (
          <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-6 text-purple-600 font-black uppercase text-xs tracking-widest"><Zap size={20}/> Cấu hình thông minh</div>
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khối lớp mục tiêu</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Mức độ tư duy</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={aiConfig.diff} onChange={e=>setAiConfig({...aiConfig, diff:e.target.value})}><option value="Nhận biết">Nhận biết</option><option value="Thông hiểu">Thông hiểu</option><option value="Vận dụng">Vận dụng</option><option value="Vận dụng cao">Vận dụng cao</option></select></div>
                              <div className="pt-4 border-t border-dashed">
                                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">Số lượng câu hỏi từng phần</label>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.I</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p1} onChange={e=>setAiConfig({...aiConfig, p1:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.II</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p2} onChange={e=>setAiConfig({...aiConfig, p2:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.III</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p3} onChange={e=>setAiConfig({...aiConfig, p3:Number(e.target.value)})}/></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-purple-100 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BrainCircuit size={120}/></div>
                          <h3 className="text-2xl font-black text-gray-800 mb-2">Chủ đề đề thi bạn mong muốn?</h3>
                          <p className="text-gray-400 text-sm mb-6 font-medium">Nhập chi tiết yêu cầu để AI soạn nội dung bám sát ma trận đề nhất.</p>
                          <textarea className="w-full border-2 border-purple-50 rounded-2xl p-6 text-lg focus:border-purple-300 outline-none transition-all bg-purple-50/10 min-h-[200px]" placeholder="Ví dụ: Đề thi thử học kỳ 1, tập trung vào kiến thức đạo hàm, tính đơn điệu của hàm số lớp 12..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                          <div className="mt-8 flex flex-col md:flex-row gap-4">
                              <button onClick={()=>{setAiTopic(''); setQuestions([]);}} className="px-6 py-4 rounded-2xl font-bold text-gray-400 hover:bg-gray-100 flex items-center justify-center gap-2"><RefreshCw size={20}/> LÀM MỚI</button>
                              <button onClick={handleAutoGenerate} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                  {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles />} {isProcessing ? "ĐANG SOẠN ĐỀ..." : "BẮT ĐẦU SOẠN ĐỀ TỰ ĐỘNG"}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2 border-b pb-4 uppercase tracking-tight"><Info className="text-blue-500"/> Cài đặt đề thi</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border-2 rounded-xl p-4 focus:border-blue-500 outline-none transition font-black text-xl bg-gray-50/50" placeholder="Tiêu đề chính của bài thi..." value={title} onChange={e => setTitle(e.target.value)}/>
                 <div className="relative"><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Nhóm kiến thức / Chương</label><div className="relative"><Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input list="cat-list" type="text" className="w-full border rounded-xl pl-12 pr-4 py-3 focus:border-blue-500 outline-none transition bg-white font-bold" placeholder="VD: Chương 1: Hàm số..." value={category} onChange={e => setCategory(e.target.value)}/><datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hình thức</label><select className="w-full border rounded-xl p-3 bg-white font-bold" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập Tự Do</option><option value="test">Kiểm Tra Có Hẹn Giờ</option></select></div>
                    <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khối học</label><select className="w-full border rounded-xl p-3 bg-white font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Lựa chọn nhiều phương án', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi Đúng/Sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Câu hỏi Trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-2xl sticky top-24 text-center">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest">Ma trận đề thi</h4>
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase mb-1">Tổng số câu</p><p className="text-2xl font-black text-blue-600">{questions.length}</p></div>
                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase mb-1">Tổng điểm</p><p className="text-2xl font-black text-blue-600">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</p></div>
                  </div>
                  <div className="mb-6">
                      <label className="flex items-center justify-center gap-3 cursor-pointer p-4 bg-blue-50 rounded-2xl font-bold text-sm text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all">
                          <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500" />
                          Công bố đề cho học sinh
                      </label>
                  </div>
                  <button onClick={handleSaveQuiz} className="w-full bg-slate-800 hover:bg-black text-white py-5 rounded-2xl font-black shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-2 tracking-widest"><Save size={20} /> LƯU DỮ LIỆU ĐỀ</button>
               </div>
           </div>
        </div>
      )}

      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center"><h3 className="text-xl font-black flex items-center gap-2 tracking-tight"><Database size={24}/> NGÂN HÀNG LỚP {grade}</h3><button onClick={() => setShowBankModal(false)}><XCircle size={28}/></button></div>
                  <div className="p-4 border-b bg-slate-50"><select className="w-full border-2 border-indigo-100 rounded-xl p-3 font-bold text-sm outline-none focus:border-indigo-500" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}><option value="">-- Chọn đề thi làm nguồn câu hỏi --</option>{quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title} ({q.questions.length} câu)</option>)}</select></div>
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-100 space-y-4">
                    {bankSelectedQuizId && quizzes.find(q => q.id === bankSelectedQuizId)?.questions.filter(q => q.type === bankTargetType).map((q: Question, i: number) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-indigo-400 flex justify-between items-start gap-4 transition-all group">
                            <div className="flex-1 text-sm font-medium leading-relaxed"><LatexText text={q.text}/></div>
                            <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg group-active:scale-90 transition-all"><Plus size={20}/></button>
                        </div>
                    ))}
                  </div>
              </div>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
              <div className="relative">
                  <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-inner"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600"><Sparkles size={32}/></div>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mt-10 mb-4 uppercase tracking-tighter text-center max-w-xl">{loadingMsg}</h2>
              <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-300"></div>
              </div>
              <p className="mt-8 text-gray-400 font-bold animate-pulse text-xs tracking-widest">HỆ THỐNG AI ĐANG LÀM VIỆC, VUI LÒNG ĐỢI GIÂY LÁT...</p>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
