
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
    Clock, Download, FolderTree, ArrowUpDown, Info, Copy, AlertCircle, Target
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

  // Filter States
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterQuizId, setFilterQuizId] = useState('all');

  // Chapter State
  const [selectedGradeForChapters, setSelectedGradeForChapters] = useState<Grade>('12');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterNameInput, setChapterNameInput] = useState('');
  const [chapterOrderInput, setChapterOrderInput] = useState(1);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

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

  // AI & Modals
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 12, p2: 4, p3: 6 });
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

  useEffect(() => {
    const gradeChaps = chapters.filter(c => c.grade === selectedGradeForChapters);
    const maxOrder = gradeChaps.length > 0 ? Math.max(...gradeChaps.map(c => c.order)) : 0;
    setChapterOrderInput(maxOrder + 1);
  }, [selectedGradeForChapters, chapters]);

  const refreshData = async () => {
    try {
        const [qs, rs, us, chs] = await Promise.all([
            getQuizzes(), getResults(), getUsers(), getChapters()
        ]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    } catch (err) { console.error(err); }
  };

  const getQuizGlobalStats = (quizId: string) => {
      const qResults = results.filter(r => r.quizId === quizId);
      if (qResults.length === 0) return null;
      const scores = qResults.map(r => r.score);
      return {
          total: qResults.length,
          avg: scores.reduce((a,b)=>a+b,0) / qResults.length,
          max: Math.max(...scores)
      };
  };

  const availableChapters = useMemo(() => {
    let tg: Grade | 'all' = 'all';
    if (activeMenu === 'create' || activeMenu === 'ai') tg = grade;
    else if (activeMenu === 'quizzes' || activeMenu === 'results') tg = filterGrade;
    if (tg === 'all') return chapters;
    return chapters.filter(c => c.grade === tg);
  }, [chapters, grade, filterGrade, activeMenu]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      if (filterGrade !== 'all' && q.grade !== filterGrade) return false;
      if (filterCategory !== 'all' && q.category !== filterCategory) return false;
      return true;
    });
  }, [quizzes, filterGrade, filterCategory]);

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
    } catch(err: any) { alert("Lỗi: " + err.message); }
  };

  const handleShufflePreview = () => {
    if (!viewingQuiz) return;
    const shuffled = shuffleArray(viewingQuiz.questions).map(q => {
        if (q.type === 'mcq' && q.options) return { ...q, options: shuffleArray(q.options) };
        return q;
    });
    setPreviewQuestions(shuffled);
  };

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
                        </div>
                   )}
                </div>
                <button onClick={refreshData} className="p-1.5 border rounded hover:bg-slate-50 transition-colors"><Shuffle size={14}/></button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {filteredQuizzes.map(q => {
                            const gStats = getQuizGlobalStats(q.id);
                            return (
                                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-xl transition-all group border-b-4 border-b-blue-600">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                            <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 mb-1 group-hover:text-blue-600 leading-tight line-clamp-2 min-h-[40px]">{q.title}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{q.category || 'Chưa phân loại'}</p>
                                        
                                        {/* THỐNG KÊ TOÀN HỆ THỐNG TRÊN CARD ADMIN */}
                                        <div className="mt-5 bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-2">
                                            <div className="border-r border-slate-200 pr-2">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Lượt thi</p>
                                                <p className="text-xs font-black text-slate-700">{gStats?.total || 0}</p>
                                            </div>
                                            <div className="pl-2">
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Điểm TB</p>
                                                <p className="text-xs font-black text-blue-600">{gStats ? gStats.avg.toFixed(2) : '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 pt-5 border-t border-slate-50 flex gap-2">
                                        <button onClick={() => { setViewingQuiz(q); setPreviewQuestions([]); }} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <Eye size={14}/> XEM ĐỀ
                                        </button>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(q)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Sửa"><Edit size={16}/></button>
                                            <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Xóa"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* --- GIỮ NGUYÊN CÁC TAB KHÁC NHƯ CŨ (CREATE, CHAPTERS, AI...) --- */}
                {activeMenu === 'chapters' && (
                    <div className="max-w-4xl mx-auto">
                         <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
                            <h3 className="text-sm font-black uppercase tracking-tight mb-6">Quản lý chương trình học</h3>
                            <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-6 rounded-2xl">
                                <div className="col-span-12 md:col-span-8 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương (Khối {selectedGradeForChapters})</label>
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" value={chapterNameInput} onChange={e=>setChapterNameInput(e.target.value)} />
                                </div>
                                <div className="col-span-12 md:col-span-2 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Số TT</label>
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-center outline-none" value={chapterOrderInput} onChange={e=>setChapterOrderInput(parseInt(e.target.value))} />
                                </div>
                                <div className="col-span-12 md:col-span-2">
                                    <button onClick={async ()=>{
                                        if(!chapterNameInput.trim()) return;
                                        const c:Chapter = { id: editingChapterId || uuidv4(), grade: selectedGradeForChapters, name: chapterNameInput, order: chapterOrderInput };
                                        if(editingChapterId) await updateChapter(c); else await saveChapter(c);
                                        setChapterNameInput(''); setEditingChapterId(null); await refreshData();
                                    }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-100 hover:bg-blue-700">LƯU CHƯƠNG</button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                                <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                                    {(['10','11','12'] as const).map(g=>(
                                        <button key={g} onClick={()=>setSelectedGradeForChapters(g)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${selectedGradeForChapters===g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>KHỐI {g}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {chapters.filter(c=>c.grade===selectedGradeForChapters).map(c=>(
                                    <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                                            <span className="text-[12px] font-bold">{c.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                            <button onClick={()=>{setEditingChapterId(c.id); setChapterNameInput(c.name); setChapterOrderInput(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                            <button onClick={async()=>{if(confirm('Xóa?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* --- MODAL XEM ĐỀ (DÙNG CHO ADMIN) --- */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase">{viewingQuiz.title}</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Quản trị viên • {viewingQuiz.questions.length} câu hỏi • {viewingQuiz.durationMinutes} phút</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleShufflePreview} className="px-4 py-2 bg-slate-800 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 flex items-center gap-2"><Shuffle size={14}/> Xáo đề</button>
                            <button onClick={()=>setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><XCircle size={24}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                        <div className="max-w-3xl mx-auto space-y-12">
                            {(previewQuestions.length > 0 ? previewQuestions : viewingQuiz.questions).map((q, i) => (
                                <div key={q.id} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                                    <div className="text-slate-800 text-[16px] font-black mb-6 leading-relaxed flex items-start gap-4">
                                        <span className="text-blue-600 shrink-0">Câu {i+1}.</span>
                                        <LatexText text={q.text}/>
                                    </div>
                                    {q.type === 'mcq' && q.options && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-10">
                                            {q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium text-slate-500"><span className="text-slate-300 mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                        </div>
                                    )}
                                    <div className="mt-8 pt-8 border-t border-slate-50">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2"><Target size={14} className="text-emerald-500"/> Đáp án & Lời giải quản trị</p>
                                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                                            <p className="text-xs font-black text-emerald-700">ĐÁP ÁN: {q.correctAnswer}</p>
                                            {q.solution && <div className="mt-2 text-[12px] text-slate-600 leading-relaxed italic"><LatexText text={q.solution}/></div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 bg-white border-t flex justify-center gap-4">
                        <button onClick={() => { handleEdit(viewingQuiz); setViewingQuiz(null); }} className="px-10 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-slate-50">Sửa đề thi này</button>
                        <button onClick={() => setViewingQuiz(null)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Đóng xem trước</button>
                    </div>
                </div>
            </div>
        )}

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 uppercase">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
