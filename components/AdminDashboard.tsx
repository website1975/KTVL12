
import { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, List, Upload, FileText, Image as ImageIcon, BarChart3, Edit, CheckCircle, XCircle, Filter, BookOpen, Lightbulb, UserPlus, Users, ChevronUp, ChevronDown, ChevronRight, Database, SearchCode, Bold, Italic, Underline, CornerDownLeft, Sigma, FileSpreadsheet, AlertCircle, Loader2, Info, FileCheck, HelpCircle, Settings2, FolderTree, Layers, Sparkles, Zap, BrainCircuit, RefreshCw } from 'lucide-react';
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
  const [resultFilterGrade, setResultFilterGrade] = useState<Grade | 'all'>('all');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');

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

  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', grade: '12' as Grade, role: 'student' as Role });

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // AI Auto Gen State
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 10, p2: 4, p3: 6, diff: 'Thông hiểu' });

  const loadingMessages = ['Máy đang khởi động...', 'Đang truy cập kho tri thức...', 'Đang soạn câu hỏi trắc nghiệm...', 'Đang tính toán đáp án và lời giải...', 'Sắp xong rồi, vui lòng đợi...'];

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
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(',')[1];
      try {
        const extracted = await parseQuestionsFromPDF(base64Str);
        setQuestions([...questions, ...extracted]);
        setActiveTab('create');
      } catch (e: any) { alert(e.message); } finally { setIsProcessing(false); }
    };
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
    return (
      <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2 tracking-tighter">{label}</h3>
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
              <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm group">
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
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2 animate-fade-in"><Settings2 className="text-blue-600" /> Quản Trị Hệ Thống</h1>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><List size={20} /> Danh Sách Đề</button>
        <button onClick={() => setActiveTab('auto')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'auto' ? 'bg-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><BrainCircuit size={20} /> Trợ Lý Soạn Đề AI</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>{editingId ? <Edit size={20} /> : <Plus size={20} />} {editingId ? 'Sửa Đề' : 'Soạn Đề Mới'}</button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'import' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Upload size={20} /> Nhập Từ File PDF</button>
        <button onClick={() => { setActiveTab('results'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><BarChart3 size={20} /> Kết Quả Thi</button>
        <button onClick={() => { setActiveTab('students'); resetForm(); }} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'students' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}><Users size={20} /> Quản Lý Học Sinh</button>
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
                <button onClick={() => toggleCategory(cat)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-all border-b">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md"><FolderTree size={20}/></div>
                    <div className="text-left"><h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">{cat}</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{groupedQuizzes[cat].length} bài đăng</p></div>
                  </div>
                  <div className={`transition-transform duration-300 ${expandedCategories[cat] === false ? '' : 'rotate-90'}`}><ChevronRight size={24} className="text-gray-400"/></div>
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
          <div className="max-w-5xl mx-auto animate-fade-in-up">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-6 text-purple-600 font-black uppercase text-sm tracking-widest"><Zap size={20}/> Cấu hình AI Soạn Đề</div>
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Khối lớp</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Chương/Mục</label><input list="cat-auto" className="w-full border rounded-xl p-3 bg-gray-50 font-bold" placeholder="VD: Chương 1: Động lực học" value={category} onChange={e=>setCategory(e.target.value)} /><datalist id="cat-auto">{existingCategories.map(c=><option key={c} value={c}/>)}</datalist></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-1">Mức độ tư duy</label><select className="w-full border rounded-xl p-3 bg-gray-50 font-bold" value={aiConfig.diff} onChange={e=>setAiConfig({...aiConfig, diff:e.target.value})}><option value="Nhận biết">Nhận biết (Dễ)</option><option value="Thông hiểu">Thông hiểu (Vừa)</option><option value="Vận dụng">Vận dụng (Khó)</option><option value="Vận dụng cao">Vận dụng cao (Cực khó)</option></select></div>
                              <div className="pt-4 border-t border-dashed">
                                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1 block mb-3">Số lượng câu hỏi từng phần</label>
                                  <div className="grid grid-cols-3 gap-2">
                                      <div className="text-center"><span className="text-[9px] text-gray-400 font-bold">Phần I</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p1} onChange={e=>setAiConfig({...aiConfig, p1:Number(e.target.value)})}/></div>
                                      <div className="text-center"><span className="text-[9px] text-gray-400 font-bold">Phần II</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p2} onChange={e=>setAiConfig({...aiConfig, p2:Number(e.target.value)})}/></div>
                                      <div className="text-center"><span className="text-[9px] text-gray-400 font-bold">Phần III</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p3} onChange={e=>setAiConfig({...aiConfig, p3:Number(e.target.value)})}/></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-purple-100 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><Sparkles size={120} className="text-purple-600"/></div>
                          <h3 className="text-2xl font-black text-gray-800 mb-2">Bạn muốn AI soạn đề về chủ đề gì?</h3>
                          <p className="text-gray-400 text-sm mb-6 font-medium">Mô tả càng chi tiết, AI soạn đề càng bám sát yêu cầu của bạn.</p>
                          <textarea className="w-full border-2 border-purple-50 rounded-2xl p-6 text-lg focus:border-purple-300 outline-none transition-all shadow-inner bg-purple-50/20" rows={5} placeholder="Ví dụ: Soạn đề thi tập trung vào phần Định luật Newton, các bài toán về mặt phẳng nghiêng, bỏ qua ma sát..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                          
                          <div className="mt-8 flex gap-4">
                              <button onClick={()=>{setAiTopic(''); setQuestions([]);}} className="px-6 py-4 rounded-2xl font-bold text-gray-400 hover:bg-gray-100 flex items-center gap-2"><RefreshCw size={20}/> Làm mới</button>
                              <button onClick={handleAutoGenerate} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-lg py-5 rounded-2xl shadow-xl shadow-purple-200 transform active:scale-95 transition-all flex items-center justify-center gap-3">
                                  {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles />} {isProcessing ? "TRÍ TUỆ NHÂN TẠO ĐANG SOẠN ĐỀ..." : "BẮT ĐẦU SOẠN ĐỀ TỰ ĐỘNG"}
                              </button>
                          </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex gap-4">
                          <div className="bg-amber-200 p-3 rounded-xl shrink-0"><Lightbulb className="text-amber-700"/></div>
                          <div>
                              <h4 className="font-black text-amber-800 text-sm uppercase mb-1">Mẹo nhỏ cho giáo viên</h4>
                              <p className="text-xs text-amber-700 leading-relaxed">Sau khi AI soạn xong, hệ thống sẽ đưa bạn đến tab "Soạn Đề". Tại đó, bạn có thể bấm vào nút <b>"Ngân hàng"</b> trong từng phần để lấy thêm các câu hỏi cũ đã lưu từ Database để trộn vào đề mới.</p>
                          </div>
                      </div>
                  </div>
              </div>
              {isProcessing && (
                  <div className="fixed inset-0 bg-white/90 z-[200] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                      <div className="relative mb-12">
                          <div className="w-32 h-32 border-[12px] border-purple-50 border-t-purple-600 rounded-full animate-spin shadow-2xl"></div>
                          <div className="absolute inset-0 flex items-center justify-center"><BrainCircuit className="text-purple-600 w-12 h-12 animate-pulse" /></div>
                      </div>
                      <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tighter uppercase">{loadingMsg}</h2>
                      <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.4em]">Đang sử dụng Gemini 3 Pro Preview</p>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2 border-b pb-4"><Info className="text-blue-500"/> Thông Tin Chung</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border-2 rounded-lg p-3 focus:border-blue-500 outline-none transition font-bold text-lg" placeholder="Nhập tên đề thi..." value={title} onChange={e => setTitle(e.target.value)}/>
                 <div className="relative"><label className="text-xs font-bold text-gray-400 uppercase ml-1 block mb-1 tracking-wider">Chương / Mục</label><div className="relative"><Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input list="cat-list" type="text" className="w-full border rounded-lg pl-10 pr-3 py-2.5 focus:border-blue-500 outline-none transition bg-gray-50 font-medium" placeholder="VD: Chương 1..." value={category} onChange={e => setCategory(e.target.value)}/><datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">Loại đề</label><select className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase ml-1 block mb-1">Khối lớp</label><select className="w-full border rounded-lg p-2.5 bg-gray-50 font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Trắc nghiệm khách quan', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi Đúng - Sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Câu hỏi Trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-2xl sticky top-24">
                  <h4 className="text-xs font-black text-gray-400 uppercase mb-6 tracking-[0.2em]">Tổng quan đề</h4>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="font-bold text-gray-500 text-xs">SỐ CÂU</span><span className="text-blue-600 font-black text-xl">{questions.length}</span></div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="font-bold text-gray-500 text-xs">TỔNG ĐIỂM</span><span className="text-blue-600 font-black text-xl">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</span></div>
                  </div>
                  <button onClick={handleSaveQuiz} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black shadow-xl flex justify-center items-center gap-2 transition-all transform active:scale-95"><Save size={20} /> LƯU ĐỀ VÀO HỆ THỐNG</button>
               </div>
           </div>
        </div>
      )}

      {/* BANK MODAL - Reused logic but enhanced */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <h3 className="text-xl font-bold flex items-center gap-2"><Database size={24}/> Ngân hàng câu hỏi Lớp {grade}</h3>
                      <button onClick={() => setShowBankModal(false)}><XCircle size={28}/></button>
                  </div>
                  <div className="p-4 border-b bg-gray-50 flex gap-4 shrink-0">
                      <select className="flex-1 border rounded-xl p-2.5 font-bold" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}>
                          <option value="">-- Chọn đề thi nguồn --</option>
                          {quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-100">
                    {bankSelectedQuizId && quizzes.find(q => q.id === bankSelectedQuizId)?.questions.filter(q => q.type === bankTargetType).map((q: Question, i: number) => (
                        <div key={i} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-start gap-4 hover:border-indigo-400 transition-all group">
                            <div className="flex-1"><LatexText text={q.text}/></div>
                            <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-2.5 rounded-lg shadow-lg transform group-active:scale-90 transition-all"><Plus size={20}/></button>
                        </div>
                    ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
