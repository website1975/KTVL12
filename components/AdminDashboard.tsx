
import { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
// Fix: Added ListChecks to the lucide-react import list
import { Plus, Trash2, Save, List, Upload, FileText, BarChart3, Edit, XCircle, Filter, BookOpen, Lightbulb, Users, ChevronRight, Database, Bold, Italic, Underline, CornerDownLeft, Sigma, Info, Settings2, FolderTree, Layers, Sparkles, Zap, BrainCircuit, RefreshCw, Loader2, PieChart, TrendingUp, UserCheck, Calendar, ListChecks } from 'lucide-react';
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
  
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
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

  const loadingMessages = ['Đang truy cập kho tri thức...', 'Đang soạn câu hỏi trắc nghiệm...', 'Đang tính toán đáp án và lời giải...', 'Sắp xong rồi, vui lòng đợi...'];

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade).forEach((q: Quiz) => {
      const catName = q.category || 'Chưa phân loại';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(q);
    });
    return groups;
  }, [quizzes, quizFilterGrade]);

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    quizzes.forEach((q: Quiz) => { if (q.category) cats.add(q.category); });
    return Array.from(cats).sort();
  }, [quizzes]);

  // Thống kê dữ liệu
  const stats = useMemo(() => {
      const totalResults = results.length;
      const avgScore = totalResults > 0 ? results.reduce((sum, r) => sum + r.score, 0) / totalResults : 0;
      const totalStudents = users.filter(u => u.role === 'student').length;
      
      // Tìm đề thi được làm nhiều nhất
      const quizCounts: Record<string, number> = {};
      results.forEach(r => {
          quizCounts[r.quizId] = (quizCounts[r.quizId] || 0) + 1;
      });
      const topQuizId = Object.entries(quizCounts).sort((a,b) => b[1] - a[1])[0]?.[0];
      const topQuizTitle = quizzes.find(q => q.id === topQuizId)?.title || "Chưa có dữ liệu";

      return { totalResults, avgScore, totalStudents, topQuizTitle };
  }, [results, users, quizzes]);

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
        alert("Đã phân tích xong câu hỏi từ PDF!");
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
                    <RichTextEditor rows={2} value={q.solution || ''} onChange={(val) => { const n = [...questions]; n[idx].solution = val; setQuestions(n); }} placeholder="Giải thích chi tiết..." />
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

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><List size={20} /> Danh Sách Đề</button>
        <button onClick={() => setActiveTab('auto')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'auto' ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><BrainCircuit size={20} /> Trợ Lý Soạn Đề AI</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>{editingId ? <Edit size={20} /> : <Plus size={20} />} {editingId ? 'Sửa Đề' : 'Soạn Đề Mới'}</button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'import' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Upload size={20} /> Nhập Từ PDF</button>
        <button onClick={() => { setActiveTab('results'); refreshData(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><BarChart3 size={20} /> Kết Quả & Thống Kê</button>
        <button onClick={() => { setActiveTab('students'); refreshData(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'students' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Users size={20} /> Quản Lý Học Sinh</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
             <span className="font-bold text-gray-700 flex items-center gap-1"><Filter size={18}/> Lọc Khối:</span>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['all', '10', '11', '12'] as const).map(g => (
                    <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${quizFilterGrade === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{g === 'all' ? 'Tất cả' : `Lớp ${g}`}</button>
                ))}
             </div>
          </div>
          <div className="space-y-4">
            {Object.keys(groupedQuizzes).sort().map(cat => (
              <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button onClick={() => toggleCategory(cat)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-all border-b text-left">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md"><FolderTree size={20}/></div>
                    <div><h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">{cat}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{groupedQuizzes[cat].length} bài đăng</p></div>
                  </div>
                  <ChevronRight size={24} className={`text-gray-400 transition-transform ${expandedCategories[cat] === false ? '' : 'rotate-90'}`}/>
                </button>
                {(expandedCategories[cat] !== false) && (
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                    {groupedQuizzes[cat].map(q => (
                      <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex justify-between items-center group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                            {q.type === 'test' ? <FileText size={20}/> : <BookOpen size={20}/>}
                          </div>
                          <div className="overflow-hidden"><h3 className="font-bold text-gray-800 truncate">{q.title}</h3><div className="text-[10px] mt-1 text-gray-400 font-bold">{q.questions.length} câu | {q.isPublished ? 'Đã công bố' : 'Bản nháp'}</div></div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={18}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'auto' && (
          <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-6 text-purple-600 font-black uppercase text-sm tracking-widest"><Zap size={20}/> Cấu hình AI</div>
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khối lớp</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Mức độ tư duy</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={aiConfig.diff} onChange={e=>setAiConfig({...aiConfig, diff:e.target.value})}><option value="Nhận biết">Nhận biết</option><option value="Thông hiểu">Thông hiểu</option><option value="Vận dụng">Vận dụng</option><option value="Vận dụng cao">Vận dụng cao</option></select></div>
                              <div className="pt-4 border-t border-dashed">
                                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">Số lượng câu hỏi</label>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.I (Lựa chọn)</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p1} onChange={e=>setAiConfig({...aiConfig, p1:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.II (Đ/S)</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p2} onChange={e=>setAiConfig({...aiConfig, p2:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">P.III (Ngắn)</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p3} onChange={e=>setAiConfig({...aiConfig, p3:Number(e.target.value)})}/></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-purple-100 relative overflow-hidden">
                          <h3 className="text-2xl font-black text-gray-800 mb-2">Bạn muốn AI soạn đề về chủ đề gì?</h3>
                          <p className="text-gray-400 text-sm mb-6 font-medium">Mô tả chi tiết để AI soạn đề bám sát yêu cầu nhất.</p>
                          <textarea className="w-full border-2 border-purple-50 rounded-2xl p-6 text-lg focus:border-purple-300 outline-none transition-all bg-purple-50/20" rows={5} placeholder="Ví dụ: Soạn đề tập trung vào Định luật Newton, các bài toán mặt phẳng nghiêng..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                          <div className="mt-8 flex gap-4">
                              <button onClick={()=>{setAiTopic(''); setQuestions([]);}} className="px-6 py-4 rounded-2xl font-bold text-gray-400 hover:bg-gray-100 flex items-center gap-2"><RefreshCw size={20}/> Làm mới</button>
                              <button onClick={handleAutoGenerate} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl transform active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                  {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles />} {isProcessing ? "ĐANG SOẠN ĐỀ..." : "BẮT ĐẦU SOẠN ĐỀ TỰ ĐỘNG"}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'import' && (
          <div className="max-w-2xl mx-auto mt-10 animate-fade-in">
              <div className="bg-white p-10 rounded-3xl shadow-xl border-2 border-dashed border-blue-200 text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Upload size={40}/>
                  </div>
                  <h2 className="text-2xl font-black text-gray-800 mb-2">Nhập Đề Từ PDF</h2>
                  <p className="text-gray-500 mb-8">Hỗ trợ trích xuất câu hỏi từ file PDF đề thi định dạng 2025.</p>
                  
                  <div className="mb-8">
                      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                      <label htmlFor="pdf-upload" className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all border border-gray-200">
                          {file ? file.name : "Chọn file PDF từ máy tính"}
                      </label>
                  </div>

                  <button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>}
                      {isProcessing ? "ĐANG PHÂN TÍCH PDF..." : "BẮT ĐẦU XỬ LÝ"}
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'results' && (
          <div className="space-y-8 animate-fade-in">
              {/* Thẻ thống kê nhanh */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24}/></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Tổng lượt thi</p><p className="text-2xl font-black">{stats.totalResults}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                      <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><PieChart size={24}/></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Điểm TB</p><p className="text-2xl font-black">{stats.avgScore.toFixed(2)}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                      <div className="p-3 bg-green-50 text-green-600 rounded-xl"><UserCheck size={24}/></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Học sinh</p><p className="text-2xl font-black">{stats.totalStudents}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Zap size={24}/></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Đề hot nhất</p><p className="text-sm font-black truncate max-w-[120px]">{stats.topQuizTitle}</p></div>
                  </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-black text-gray-800 uppercase flex items-center gap-2"><ListChecks className="text-blue-600"/> Bảng Điểm Chi Tiết</h3>
                      <button onClick={refreshData} className="p-2 hover:bg-white rounded-lg border transition-all shadow-sm"><RefreshCw size={18}/></button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-gray-100/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b">
                              <tr>
                                  <th className="px-6 py-4">Học sinh</th>
                                  <th className="px-6 py-4">Đề thi</th>
                                  <th className="px-6 py-4">Thời gian làm</th>
                                  <th className="px-6 py-4">Ngày nộp</th>
                                  <th className="px-6 py-4 text-right">Điểm</th>
                                  <th className="px-6 py-4 text-center">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {results.map(r => (
                                  <tr key={r.id} className="hover:bg-blue-50/30 transition-all">
                                      <td className="px-6 py-4 font-bold text-gray-800">{r.studentName}</td>
                                      <td className="px-6 py-4 font-medium text-gray-500">{quizzes.find(q => q.id === r.quizId)?.title || "Đề đã xóa"}</td>
                                      <td className="px-6 py-4 font-mono text-gray-400">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                      <td className="px-6 py-4 text-gray-400 flex items-center gap-1"><Calendar size={14}/> {format(parseISO(r.submittedAt), "HH:mm dd/MM")}</td>
                                      <td className="px-6 py-4 text-right"><span className={`font-black text-lg ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{r.score.toFixed(2)}</span></td>
                                      <td className="px-6 py-4 text-center">
                                          <button onClick={async () => { if(window.confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'students' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
              <div className="p-6 border-b bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-black text-gray-800 uppercase flex items-center gap-2"><Users className="text-blue-600"/> Danh Sách Học Sinh</h3>
                  <div className="text-xs font-bold text-gray-400 uppercase">Tổng cộng: {users.filter(u => u.role === 'student').length} học sinh</div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-gray-100/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b">
                          <tr>
                              <th className="px-6 py-4">Họ và Tên</th>
                              <th className="px-6 py-4">Tên đăng nhập</th>
                              <th className="px-6 py-4">Khối lớp</th>
                              <th className="px-6 py-4">Vai trò</th>
                              <th className="px-6 py-4 text-center">Thao tác</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                          {users.map(u => (
                              <tr key={u.id} className="hover:bg-blue-50/30 transition-all">
                                  <td className="px-6 py-4 font-bold text-gray-800">{u.fullName}</td>
                                  <td className="px-6 py-4 font-mono text-gray-500">{u.username}</td>
                                  <td className="px-6 py-4"><span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold">Lớp {u.grade || 'Admin'}</span></td>
                                  <td className="px-6 py-4 text-xs font-black uppercase text-gray-400">{u.role === 'admin' ? 'Giáo Viên' : 'Học Sinh'}</td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex justify-center gap-1">
                                          <button onClick={() => { if(window.confirm('Xóa tài khoản?')) { deleteUser(u.id); refreshData(); } }} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2 border-b pb-4"><Info className="text-blue-500"/> Thông Tin Chung</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border-2 rounded-lg p-3 focus:border-blue-500 outline-none transition font-bold text-lg" placeholder="Nhập tên đề thi..." value={title} onChange={e => setTitle(e.target.value)}/>
                 <div className="relative"><label className="text-xs font-bold text-gray-400 uppercase block mb-1">Chương / Mục</label><div className="relative"><Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input list="cat-list" type="text" className="w-full border rounded-lg pl-10 pr-3 py-2.5 focus:border-blue-500 outline-none transition bg-gray-50 font-medium" placeholder="VD: Chương 1..." value={category} onChange={e => setCategory(e.target.value)}/><datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Loại đề</label><select className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Khối lớp</label><select className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Trắc nghiệm khách quan', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi Đúng - Sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Câu hỏi Trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xl sticky top-24 text-center">
                  <h4 className="text-xs font-black text-gray-400 uppercase mb-6 tracking-widest">Tổng quan</h4>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="font-bold text-gray-500 text-xs uppercase">Số câu</span><span className="text-blue-600 font-black text-xl">{questions.length}</span></div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="font-bold text-gray-500 text-xs uppercase">Điểm</span><span className="text-blue-600 font-black text-xl">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</span></div>
                  </div>
                  <div className="mb-4">
                      <label className="flex items-center justify-center gap-2 cursor-pointer p-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-600 border border-transparent hover:border-blue-200">
                          <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                          Công bố đề thi cho học sinh
                      </label>
                  </div>
                  <button onClick={handleSaveQuiz} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black shadow-xl transform active:scale-95 transition-all"><Save size={20} className="inline-block mr-2" /> LƯU ĐỀ THI</button>
               </div>
           </div>
        </div>
      )}

      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center"><h3 className="text-xl font-bold flex items-center gap-2"><Database size={24}/> Ngân hàng Lớp {grade}</h3><button onClick={() => setShowBankModal(false)}><XCircle size={28}/></button></div>
                  <div className="p-4 border-b bg-gray-50"><select className="w-full border rounded-xl p-2.5 font-bold" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}><option value="">-- Chọn đề thi nguồn --</option>{quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></div>
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-100 space-y-4">
                    {bankSelectedQuizId && quizzes.find(q => q.id === bankSelectedQuizId)?.questions.filter(q => q.type === bankTargetType).map((q: Question, i: number) => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-start gap-4 hover:border-indigo-400 group">
                            <div className="flex-1"><LatexText text={q.text}/></div>
                            <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-2.5 rounded-lg shadow-lg group-active:scale-90 transition-all"><Plus size={20}/></button>
                        </div>
                    ))}
                  </div>
              </div>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/90 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
              <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-2xl mb-8"></div>
              <h2 className="text-3xl font-black text-gray-800 mb-4 uppercase text-center max-w-xl">{loadingMsg}</h2>
              <p className="text-gray-400 font-bold animate-pulse">Vui lòng không đóng trình duyệt...</p>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
