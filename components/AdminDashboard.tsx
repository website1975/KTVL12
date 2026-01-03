
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Chapter } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, deleteResult,
    getChapters, saveChapter, updateChapter, deleteChapter,
    isDatabaseConnected
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, BarChart3, Edit, 
    XCircle, X, BookOpen, Lightbulb, Database, 
    Bold, Italic, Underline, CornerDownLeft, Sigma, Settings2, 
    Sparkles, BrainCircuit, FileDown, Shuffle, Check, Search,
    ChevronRight, LayoutDashboard, Users, GraduationCap, FileText,
    Eye, Monitor, Cpu, FileUp, Trophy, History, Settings, Filter, Calendar,
    Clock, Download, FolderTree, ArrowUpDown, Info, Copy, AlertCircle
} from 'lucide-react';
import LatexText from './LatexText';

// --- HELPERS ---
const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

// --- RICH TEXT EDITOR ---
interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; label?: string; }
const RichTextEditor = ({ value, onChange, placeholder, rows, className, label }: RichTextEditorProps) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;
        const start = (el as any).selectionStart || 0;
        const end = (el as any).selectionEnd || 0;
        const text = el.value;
        const newVal = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        onChange(newVal);
    };
    return (
        <div className="flex flex-col gap-1 mb-2">
            {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</label>}
            <div className="flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <div className="flex items-center gap-0.5 p-1 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1 hover:bg-white rounded text-slate-500"><Bold size={11}/></button>
                    <button type="button" onClick={() => insertTag('$', '$')} className="p-1 hover:bg-white rounded text-blue-600" title="Toán LaTeX"><Sigma size={11}/></button>
                    <button type="button" onClick={() => insertTag('<br/>')} className="p-1 hover:bg-white rounded text-slate-500"><CornerDownLeft size={11}/></button>
                </div>
                {rows ? (
                    <textarea ref={inputRef as any} className={`w-full p-2 outline-none text-[13px] leading-relaxed resize-none ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                ) : (
                    <input ref={inputRef as any} type="text" className={`w-full p-2 outline-none text-[13px] ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                )}
            </div>
            {value && (
                <div className="px-2 py-1.5 bg-blue-50/20 rounded border border-blue-50 text-[12px] text-slate-600">
                    <LatexText text={value} />
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Global Filter States
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterQuizId, setFilterQuizId] = useState('all');

  // Chapter Management State
  const [selectedGradeForChapters, setSelectedGradeForChapters] = useState<Grade>('12');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterNameInput, setChapterNameInput] = useState('');
  const [chapterOrderInput, setChapterOrderInput] = useState(1);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // AI & PDF State
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 12, p2: 4, p3: 6 });

  // Quiz Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [startTime, setStartTime] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Modal States
  const [showBank, setShowBank] = useState(false);
  const [bankGrade, setBankGrade] = useState<Grade>('12');
  const [bankCategory, setBankCategory] = useState('all');
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const isOnline = isDatabaseConnected();

  useEffect(() => { 
    refreshData(); 
  }, [activeMenu]);

  // Tự động nảy số STT khi đổi khối hoặc load chapters
  useEffect(() => {
    const gradeChaps = chapters.filter(c => c.grade === selectedGradeForChapters);
    const maxOrder = gradeChaps.length > 0 ? Math.max(...gradeChaps.map(c => c.order)) : 0;
    setChapterOrderInput(maxOrder + 1);
  }, [selectedGradeForChapters, chapters]);

  const refreshData = async () => {
    try {
        const [qs, rs, us, chs] = await Promise.all([
            getQuizzes(),
            getResults(),
            getUsers(),
            getChapters()
        ]);
        setQuizzes(qs);
        setResults(rs);
        setUsers(us);
        setChapters(chs);
    } catch (err) {
        console.error("Lỗi refresh:", err);
    }
  };

  // Memo: Danh sách chương cho các ô chọn (Listbox)
  const availableChapters = useMemo(() => {
    let targetGrade: Grade | 'all' = 'all';
    if (activeMenu === 'create' || activeMenu === 'ai') targetGrade = grade;
    else if (activeMenu === 'quizzes' || activeMenu === 'results') targetGrade = filterGrade;
    
    if (targetGrade === 'all') return chapters;
    return chapters.filter(c => c.grade === targetGrade);
  }, [chapters, grade, filterGrade, activeMenu]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      if (filterGrade !== 'all' && q.grade !== filterGrade) return false;
      if (filterCategory !== 'all' && q.category !== filterCategory) return false;
      return true;
    });
  }, [quizzes, filterGrade, filterCategory]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
        const q = quizzes.find(item => item.id === r.quizId);
        if (!q) return false;
        if (filterGrade !== 'all' && q.grade !== filterGrade) return false;
        if (filterCategory !== 'all' && q.category !== filterCategory) return false;
        if (filterQuizId !== 'all' && r.quizId !== filterQuizId) return false;
        return true;
    });
  }, [results, quizzes, filterGrade, filterCategory, filterQuizId]);

  const handleEdit = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); 
    setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); 
    setIsPublished(q.isPublished); setStartTime(q.startTime || ''); setActiveMenu('create');
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Nhập tên đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), 
      type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), 
      isPublished, startTime: quizType === 'test' ? startTime : undefined
    };
    try {
        if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
        alert("Lưu đề thi thành công!");
        await refreshData(); setActiveMenu('quizzes');
    } catch(err: any) {
        alert("Lỗi: " + (err.message || err));
    }
  };

  // --- CHAPTER LOGIC ---
  const handleSaveChapter = async () => {
      if (!chapterNameInput.trim()) return alert("Nhập tên chương!");
      setIsProcessing(true);
      setLoadingMsg("Đang đồng bộ...");
      try {
          const chapData: Chapter = {
              id: editingChapterId || uuidv4(),
              grade: selectedGradeForChapters,
              name: chapterNameInput.trim(),
              order: chapterOrderInput
          };
          
          if (editingChapterId) await updateChapter(chapData); 
          else await saveChapter(chapData);
          
          // Cập nhật State cục bộ ngay lập tức để UI nhảy STT và hiện danh sách
          setChapters(prev => {
              const exists = prev.find(p => p.id === chapData.id);
              if (exists) return prev.map(p => p.id === chapData.id ? chapData : p);
              return [...prev, chapData].sort((a,b) => a.order - b.order);
          });

          setChapterNameInput(''); 
          setEditingChapterId(null);
          alert("Thêm chương thành công!");
          await refreshData(); 
      } catch (err: any) {
          alert(`LỖI HỆ THỐNG:\n${err.message}`);
          setShowSqlGuide(true);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleShufflePreview = () => {
    if (!viewingQuiz) return;
    const shuffled = shuffleArray(viewingQuiz.questions).map(q => {
        if (q.type === 'mcq' && q.options) return { ...q, options: shuffleArray(q.options) };
        return q;
    });
    setPreviewQuestions(shuffled);
  };

  const renderQuestionEditor = (type: QuestionType, label: string, colorClass: string) => (
    <div className={`mb-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm`}>
        <div className="bg-slate-50 px-4 py-1.5 border-b border-slate-200 flex justify-between items-center">
            <h3 className={`text-[10px] font-black uppercase tracking-widest ${colorClass}`}>{label}</h3>
            <div className="flex gap-2">
                <button onClick={() => { setBankGrade(grade); setShowBank(true); }} className="text-blue-600 hover:text-blue-700 text-[10px] font-bold flex items-center gap-1"><Database size={12}/> NGÂN HÀNG</button>
                <button onClick={() => {
                    let q: Question = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
                    if (type === 'mcq') q.options = ['', '', '', ''];
                    if (type === 'group-tf') q.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' }));
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] font-bold">+ THÊM CÂU</button>
            </div>
        </div>
        <div className="p-4 space-y-2">
            {questions.filter(q => q.type === type).map((q) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50/20 relative group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-slate-300">CÂU {gIdx + 1}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">ĐIỂM:</span>
                                <input type="text" className="w-8 border border-slate-200 rounded text-center text-[10px] font-bold" value={q.points} onChange={e => {
                                    const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                }} />
                                <button onClick={() => { if(confirm('Xóa?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-slate-200 hover:text-red-500"><Trash2 size={12}/></button>
                            </div>
                        </div>
                        <RichTextEditor rows={2} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} placeholder="Nội dung câu hỏi..." label="Nội dung câu hỏi" />
                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                        <input type="radio" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} className="w-3 h-3 accent-blue-600" />
                                        <input type="text" className="flex-1 bg-white border border-slate-200 rounded p-1 text-[12px] outline-none" value={opt} onChange={e => {
                                            const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = e.target.value; n[gIdx].options = o; setQuestions(n);
                                        }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}`} />
                                    </div>
                                ))}
                            </div>
                        )}
                        {type === 'group-tf' && q.subQuestions && (
                            <div className="space-y-1.5 bg-white p-2 rounded border border-slate-100 mt-2">
                                {q.subQuestions.map((sq, si) => (
                                    <div key={si} className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold w-4 text-slate-300">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 text-[11px] outline-none border-b border-transparent focus:border-blue-200" value={sq.text} onChange={e => {
                                            const n = [...questions]; const s = [...(n[gIdx].subQuestions||[])]; s[si].text = e.target.value; n[gIdx].subQuestions = s; setQuestions(n);
                                        }} placeholder={`Ý ${String.fromCharCode(97+si)}`} />
                                        <div className="flex gap-0.5">
                                            {['True', 'False'].map(val => (
                                                <button key={val} onClick={() => {
                                                    const n = [...questions]; const s = [...(n[gIdx].subQuestions || [])]; s[si].correctAnswer = val as any; n[gIdx].subQuestions = s; setQuestions(n);
                                                }} className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${sq.correctAnswer === val ? (val === 'True' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'text-slate-300 bg-slate-50'}`}>
                                                    {val === 'True' ? 'Đ' : 'S'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {type === 'short' && (
                            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-100 mt-2">
                                <span className="text-[10px] font-bold text-slate-400">ĐÁP ÁN:</span>
                                <input type="text" className="flex-1 bg-slate-50 border border-slate-100 rounded p-1 text-xs font-bold outline-none" value={q.correctAnswer} onChange={e => {
                                    const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                }} placeholder="Nhập kết quả..." />
                            </div>
                        )}
                        <div className="mt-2">
                            <RichTextEditor rows={1} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Lời giải chi tiết..." label="Hướng dẫn giải" />
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Cpu size={18}/></div>
                <h1 className="text-sm font-black text-white tracking-widest uppercase">EDUQUIZ <span className="text-blue-400">PRO</span></h1>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                    { id: 'chapters', icon: FolderTree, label: 'QL CHƯƠNG' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ THỦ CÔNG' },
                    { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                    { id: 'import', icon: FileUp, label: 'NHẬP ĐỀ TỪ PDF' },
                    { id: 'results', icon: BarChart3, label: 'KẾT QUẢ THI' },
                    { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' }
                ].map(item => (
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[12px] font-bold transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{activeMenu}</h2>
                   {(activeMenu === 'quizzes' || activeMenu === 'results') && (
                        <div className="flex items-center gap-2 ml-4">
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                {(['all', '10', '11', '12'] as const).map(g => (
                                    <button key={g} onClick={() => setFilterGrade(g)} className={`px-3 py-1 rounded text-[9px] font-bold ${filterGrade === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                        {g === 'all' ? 'TẤT CẢ' : `KHỐI ${g}`}
                                    </button>
                                ))}
                            </div>
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                <option value="all">CHƯƠNG (TẤT CẢ)</option>
                                {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                            </select>
                        </div>
                   )}
                </div>
                <button onClick={refreshData} className="p-1.5 border rounded hover:bg-slate-50 transition-colors"><Shuffle size={14}/></button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeMenu === 'chapters' && (
                    <div className="max-w-4xl mx-auto animate-fade-in">
                        {/* ALERT SQL GUIDE */}
                        {showSqlGuide && (
                            <div className="mb-6 bg-red-50 border-2 border-red-200 p-4 rounded-xl flex items-start gap-4">
                                <AlertCircle className="text-red-500 shrink-0" size={24}/>
                                <div className="flex-1">
                                    <h4 className="font-black text-red-800 text-sm uppercase">Cần thiết lập Database</h4>
                                    <p className="text-xs text-red-700 mt-1 leading-relaxed">Dường như bạn chưa có bảng <b>'chapters'</b> trong Supabase. Hãy vào <b>SQL Editor</b> trong Supabase và chạy lệnh sau:</p>
                                    <div className="mt-3 bg-slate-900 p-3 rounded-lg flex justify-between items-center group">
                                        <code className="text-blue-300 text-[11px]">CREATE TABLE chapters (id UUID PRIMARY KEY, grade TEXT, data JSONB);</code>
                                        <button onClick={() => { navigator.clipboard.writeText("CREATE TABLE chapters (id UUID PRIMARY KEY, grade TEXT, data JSONB);"); alert("Đã copy mã SQL!"); }} className="p-1.5 text-slate-400 hover:text-white"><Copy size={14}/></button>
                                    </div>
                                </div>
                                <button onClick={() => setShowSqlGuide(false)} className="text-red-400"><X size={18}/></button>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-black uppercase tracking-tight">Cấu trúc chương trình học</h3>
                                    <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase ${isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {isOnline ? 'Database Online' : 'Local Storage'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                    {(['10', '11', '12'] as const).map(g => (
                                        <button key={g} onClick={() => setSelectedGradeForChapters(g)} className={`px-4 py-1.5 rounded text-[10px] font-black ${selectedGradeForChapters === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                            KHỐI {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                <div className="col-span-12 md:col-span-8 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương mới (Khối {selectedGradeForChapters})</label>
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-100" placeholder="VD: Chương 1: Ứng dụng đạo hàm..." value={chapterNameInput} onChange={e => setChapterNameInput(e.target.value)} />
                                </div>
                                <div className="col-span-6 md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Thứ tự</label>
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none" value={chapterOrderInput} onChange={e => setChapterOrderInput(parseInt(e.target.value))} />
                                </div>
                                <div className="col-span-6 md:col-span-2">
                                    <button onClick={handleSaveChapter} className="w-full bg-blue-600 text-white py-2 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                        {editingChapterId ? <Save size={14}/> : <Plus size={14}/>} {editingChapterId ? 'Lưu' : 'Thêm'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                                <div className="flex items-center gap-2"><FolderTree size={16} className="text-slate-400"/> <h4 className="text-[10px] font-black uppercase text-slate-600">Danh sách chương khối {selectedGradeForChapters}</h4></div>
                                <button onClick={() => setShowSqlGuide(true)} className="text-[9px] font-black text-blue-600 hover:underline flex items-center gap-1"><Info size={12}/> Hướng dẫn DB</button>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {chapters.filter(c => c.grade === selectedGradeForChapters).length === 0 ? (
                                    <div className="p-10 text-center text-slate-300 font-bold uppercase text-[10px]">Chưa có chương nào cho khối {selectedGradeForChapters}</div>
                                ) : (
                                    chapters.filter(c => c.grade === selectedGradeForChapters).sort((a,b)=>a.order - b.order).map(c => (
                                        <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                                                <span className="text-[12px] font-bold text-slate-700">{c.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => { setEditingChapterId(c.id); setChapterNameInput(c.name); setChapterOrderInput(c.order); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                                <button onClick={async () => { if(confirm('Xóa?')) { await deleteChapter(c.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {filteredQuizzes.map(q => (
                            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-lg transition-all group border-b-4 border-b-blue-600">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                        <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 mb-1 group-hover:text-blue-600 leading-tight">{q.title}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{q.category || 'Chưa phân loại'}</p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                                    <button onClick={() => { setViewingQuiz(q); setPreviewQuestions([]); }} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all">XEM ĐỀ</button>
                                    <button onClick={() => handleEdit(q)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                    <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeMenu === 'create' && (
                    <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 md:col-span-6 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề đề thi</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chương / Chuyên đề</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="">Chọn chương...</option>
                                        {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Khối</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                                        <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {renderQuestionEditor('mcq', 'Phần I: Câu trắc nghiệm nhiều phương án', 'text-blue-600')}
                            {renderQuestionEditor('group-tf', 'Phần II: Câu trắc nghiệm Đúng/Sai', 'text-purple-600')}
                            {renderQuestionEditor('short', 'Phần III: Câu trắc nghiệm trả lời ngắn', 'text-emerald-600')}
                        </div>
                        <div className="fixed bottom-8 left-[300px] right-8 flex justify-end gap-3 pointer-events-none">
                             <div className="pointer-events-auto bg-white/80 backdrop-blur shadow-2xl rounded-2xl p-2 border border-slate-100 flex gap-2">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /> CÔNG KHAI
                                </label>
                                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2"><Save size={16}/> LƯU ĐỀ</button>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </main>

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 uppercase">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
