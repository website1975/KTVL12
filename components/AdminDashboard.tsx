
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Chapter } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, deleteResult,
    getChapters, saveChapter, updateChapter, deleteChapter
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
    Clock, Download, FolderTree, ArrowUpDown
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

// --- RICH TEXT EDITOR WITH INLINE PREVIEW ---
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
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => { refreshData(); }, [activeMenu]);

  const refreshData = async () => {
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

    // Cập nhật STT gợi ý cho chương
    if (activeMenu === 'chapters') {
        const gradeChaps = chs.filter(c => c.grade === selectedGradeForChapters);
        const maxOrder = gradeChaps.length > 0 ? Math.max(...gradeChaps.map(c => c.order)) : 0;
        setChapterOrderInput(maxOrder + 1);
    }
  };

  // Lấy danh sách chương phù hợp cho Listbox
  const availableChapters = useMemo(() => {
    const targetGrade = (activeMenu === 'create' || activeMenu === 'ai') ? grade : filterGrade;
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

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setDuration(90); 
    setIsPublished(false); setQuizType('practice'); setStartTime('');
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Nhập tên đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), 
      type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), 
      isPublished, startTime: quizType === 'test' ? startTime : undefined
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    refreshData(); setActiveMenu('quizzes'); resetForm();
  };

  // --- Chapter Handlers ---
  const handleSaveChapter = async () => {
      if (!chapterNameInput.trim()) return alert("Nhập tên chương!");
      const chapData: Chapter = {
          id: editingChapterId || uuidv4(),
          grade: selectedGradeForChapters,
          name: chapterNameInput.trim(),
          order: chapterOrderInput
      };
      if (editingChapterId) await updateChapter(chapData); else await saveChapter(chapData);
      setChapterNameInput(''); setEditingChapterId(null);
      await refreshData();
  };

  const handleEditChapter = (c: Chapter) => {
      setEditingChapterId(c.id);
      setChapterNameInput(c.name);
      setChapterOrderInput(c.order);
      setSelectedGradeForChapters(c.grade);
  };

  // --- AI Handlers ---
  const handleAICompose = async () => {
    if (!aiTopic.trim()) return alert("Nhập chủ đề!");
    setIsProcessing(true); setLoadingMsg("AI Flash đang soạn đề...");
    try {
        const newQs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3 });
        setQuestions(newQs);
        setTitle(`Đề AI: ${aiTopic}`);
        setCategory(aiTopic);
        setActiveMenu('create');
    } catch (e) { alert("Lỗi AI: " + e); }
    finally { setIsProcessing(false); }
  };

  const handlePDFImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true); setLoadingMsg("Đang bóc tách PDF...");
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
            const newQs = await parseQuestionsFromPDF(base64);
            setQuestions(newQs);
            setTitle(file.name.replace('.pdf', ''));
            setActiveMenu('create');
        } catch (e) { alert("Lỗi PDF: " + e); }
        finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleShufflePreview = () => {
    if (!viewingQuiz) return;
    const shuffled = shuffleArray(viewingQuiz.questions).map(q => {
        if (q.type === 'mcq' && q.options) {
            return { ...q, options: shuffleArray(q.options) };
        }
        return q;
    });
    setPreviewQuestions(shuffled);
  };

  const handleExportDoc = () => {
    if (!viewingQuiz) return;
    const qs = previewQuestions.length > 0 ? previewQuestions : viewingQuiz.questions;
    
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${viewingQuiz.title}</title>
      <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 20px; font-weight: bold; }
        .part-title { font-weight: bold; margin: 15px 0 5px 0; text-transform: uppercase; text-decoration: underline; }
        .question { margin-bottom: 10px; }
        .options { display: grid; grid-template-cols: 1fr 1fr; margin-left: 20px; }
      </style>
      </head>
      <body>
        <div class="header">
          <p>SỞ GIÁO DỤC VÀ ĐÀO TẠO</p>
          <p>TRƯỜNG THPT .....................</p>
          <h2 style="margin-top: 20px;">ĐỀ THI: ${viewingQuiz.title.toUpperCase()}</h2>
          <p>Khối: ${viewingQuiz.grade} - Thời gian: ${viewingQuiz.durationMinutes} phút</p>
        </div>
        <hr/>
    `;

    const mcq = qs.filter(q => q.type === 'mcq');
    const tf = qs.filter(q => q.type === 'group-tf');
    const short = qs.filter(q => q.type === 'short');

    if (mcq.length > 0) {
        content += `<p class="part-title">PHẦN I. Câu trắc nghiệm nhiều phương án chọn.</p>`;
        mcq.forEach((q, i) => {
            content += `<div class="question"><b>Câu ${i+1}.</b> ${q.text}</div>`;
            if (q.options) {
                content += `<div class="options">`;
                q.options.forEach((opt, oi) => {
                    content += `<span>${String.fromCharCode(65+oi)}. ${opt}</span> &nbsp;&nbsp;&nbsp;&nbsp;`;
                });
                content += `</div>`;
            }
        });
    }

    if (tf.length > 0) {
        content += `<p class="part-title">PHẦN II. Câu trắc nghiệm đúng sai.</p>`;
        tf.forEach((q, i) => {
            content += `<div class="question"><b>Câu ${i+1}.</b> ${q.text}</div>`;
            if (q.subQuestions) {
                q.subQuestions.forEach((sq, si) => {
                    content += `<p style="margin-left: 20px;">${String.fromCharCode(97+si)}) ${sq.text}</p>`;
                });
            }
        });
    }

    if (short.length > 0) {
        content += `<p class="part-title">PHẦN III. Câu trắc nghiệm trả lời ngắn.</p>`;
        short.forEach((q, i) => {
            content += `<div class="question"><b>Câu ${i+1}.</b> ${q.text}</div>`;
            content += `<p style="margin-left: 20px; color: #ccc;">Trả lời: ...........................................................</p>`;
        });
    }

    content += `</body></html>`;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${viewingQuiz.title.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
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
        {/* SIDEBAR */}
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
                    <button key={item.id} onClick={() => { if(item.id === 'create') resetForm(); setActiveMenu(item.id as any); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[12px] font-bold transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{activeMenu}</h2>
                   
                   {/* GLOBAL FILTERS */}
                   {(activeMenu === 'quizzes' || activeMenu === 'results' || activeMenu === 'students') && (
                        <div className="flex items-center gap-2 ml-4">
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                                {(['all', '10', '11', '12'] as const).map(g => (
                                    <button key={g} onClick={() => setFilterGrade(g)} className={`px-3 py-1 rounded text-[9px] font-bold ${filterGrade === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                        {g === 'all' ? 'TẤT CẢ' : `KHỐI ${g}`}
                                    </button>
                                ))}
                            </div>
                            
                            {(activeMenu === 'quizzes' || activeMenu === 'results') && (
                                <select className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                                    <option value="all">CHƯƠNG (TẤT CẢ)</option>
                                    {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                                </select>
                            )}
                        </div>
                   )}
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={refreshData} className="p-1.5 border rounded hover:bg-slate-50 transition-colors"><Shuffle size={14}/></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* CHAPTERS TAB */}
                {activeMenu === 'chapters' && (
                    <div className="max-w-4xl mx-auto animate-fade-in">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-sm font-black uppercase tracking-tight">Cấu trúc chương trình học</h3>
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
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương mới</label>
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-100" placeholder="VD: Chương 1: Ứng dụng đạo hàm..." value={chapterNameInput} onChange={e => setChapterNameInput(e.target.value)} />
                                </div>
                                <div className="col-span-6 md:col-span-2 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Thứ tự</label>
                                    <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center outline-none" value={chapterOrderInput} onChange={e => setChapterOrderInput(parseInt(e.target.value))} />
                                </div>
                                <div className="col-span-6 md:col-span-2">
                                    <button onClick={handleSaveChapter} className="w-full bg-blue-600 text-white py-2 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                        {editingChapterId ? <Save size={14}/> : <Plus size={14}/>} {editingChapterId ? 'Cập nhật' : 'Thêm'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b flex items-center gap-2"><FolderTree size={16} className="text-slate-400"/> <h4 className="text-[10px] font-black uppercase text-slate-600">Danh sách chương khối {selectedGradeForChapters}</h4></div>
                            <div className="divide-y divide-slate-100">
                                {chapters.filter(c => c.grade === selectedGradeForChapters).length === 0 ? (
                                    <div className="p-10 text-center text-slate-300 font-bold uppercase text-[10px]">Chưa có chương nào được tạo cho khối {selectedGradeForChapters}</div>
                                ) : (
                                    chapters.filter(c => c.grade === selectedGradeForChapters).sort((a,b)=>a.order - b.order).map(c => (
                                        <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                                                <span className="text-[12px] font-bold text-slate-700">{c.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => handleEditChapter(c)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                                <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* QUIZZES TAB */}
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {filteredQuizzes.length === 0 ? (
                            <div className="col-span-full py-20 text-center text-slate-300 font-bold uppercase text-xs">Không tìm thấy đề thi phù hợp</div>
                        ) : (
                            filteredQuizzes.map(q => (
                                <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-lg transition-all group border-b-4 border-b-blue-600">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 mb-1 group-hover:text-blue-600 leading-tight">{q.title}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{q.category || 'Chưa phân loại'}</p>
                                        <div className="mt-4 flex gap-4 border-t pt-3 border-slate-50">
                                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><List size={12}/> {q.questions.length} CÂU</div>
                                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Clock size={12}/> {q.durationMinutes} PHÚT</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                                        <button onClick={() => { setViewingQuiz(q); setPreviewQuestions([]); }} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all">XEM ĐỀ</button>
                                        <button onClick={() => handleEdit(q)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                        <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* CREATE/EDIT TAB */}
                {activeMenu === 'create' && (
                    <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 mb-6 shadow-sm">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 md:col-span-6 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề đề thi</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none focus:ring-1 focus:ring-blue-100" placeholder="VD: Đề thi khảo sát HK1..." value={title} onChange={e => setTitle(e.target.value)} />
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
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hình thức</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}>
                                        <option value="practice">Luyện tập</option><option value="test">Kiểm tra</option>
                                    </select>
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Thời gian (phút)</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                </div>
                                {quizType === 'test' && (
                                    <div className="col-span-4 space-y-1 animate-fade-in">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bắt đầu thi lúc</label>
                                        <input type="datetime-local" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none" value={startTime} onChange={e => setStartTime(e.target.value)} />
                                    </div>
                                )}
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
                                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /> CÔNG KHAI ĐỀ
                                </label>
                                <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
                                    <Save size={16}/> LƯU ĐỀ THI
                                </button>
                             </div>
                        </div>
                    </div>
                )}

                {/* RESULTS TAB */}
                {activeMenu === 'results' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                         <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h2 className="text-[10px] font-black uppercase text-slate-500">Thống kê kết quả thi toàn hệ thống</h2>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Tổng số: {filteredResults.length} bài nộp</div>
                         </div>
                         <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase border-b">
                                    <th className="px-6 py-4">Học sinh</th>
                                    <th className="px-6 py-4">Đề thi</th>
                                    <th className="px-6 py-4 text-center">Khối</th>
                                    <th className="px-6 py-4 text-center">Điểm số</th>
                                    <th className="px-6 py-4 text-center">Thời gian</th>
                                    <th className="px-6 py-4 text-right">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredResults.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10 text-center text-slate-300 uppercase font-bold text-xs">Không có dữ liệu bài thi</td></tr>
                                ) : (
                                    filteredResults.sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map(r => {
                                        const q = quizzes.find(item=>item.id===r.quizId);
                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50 text-[12px] transition-colors group">
                                                <td className="px-6 py-4 font-black">{r.studentName}</td>
                                                <td className="px-6 py-4 text-slate-500">{q?.title || 'Đề thi đã bị xóa'}</td>
                                                <td className="px-6 py-4 text-center font-bold text-slate-300">{q?.grade || '-'}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`font-black text-base ${r.score >= 5 ? 'text-blue-600' : 'text-rose-500'}`}>{r.score.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-[10px] text-slate-400 font-bold uppercase">
                                                    {Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => alert('Tính năng xem chi tiết bài làm của học sinh đang được cập nhật!')} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Eye size={16}/></button>
                                                        <button onClick={async () => { if(confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-1.5 text-slate-200 hover:text-red-500"><Trash2 size={16}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                         </table>
                    </div>
                )}

                {/* STUDENTS TAB */}
                {activeMenu === 'students' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                        {users.filter(u=>u.role==='student' && (filterGrade==='all' || u.grade===filterGrade)).map(s => {
                            return (
                                <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col items-center gap-3 text-center group hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-slate-100 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg group-hover:bg-blue-50 transition-colors">{s.fullName.charAt(0)}</div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-[13px]">{s.fullName}</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">LỚP {s.grade} • ID: {s.username}</p>
                                    </div>
                                    <div className="w-full grid grid-cols-2 gap-2 mt-2">
                                        <button onClick={() => alert('Xem chi tiết tiến trình đang cập nhật!')} className="flex-1 bg-blue-50 text-blue-600 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">CHI TIẾT</button>
                                        <button onClick={async () => { if(confirm('Xóa tài khoản này?')) { await deleteUser(s.id); refreshData(); } }} className="bg-slate-50 text-slate-300 py-1.5 rounded-lg text-[9px] font-black uppercase hover:text-red-500 transition-all">XÓA</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* AI / PDF COMMON UI */}
                {(activeMenu === 'ai' || activeMenu === 'import') && (
                    <div className="max-w-xl mx-auto py-12 animate-fade-in bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-8 shadow-sm">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto">
                            {activeMenu === 'ai' ? <Sparkles size={28}/> : <FileUp size={28}/>}
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight">{activeMenu === 'ai' ? 'Soạn đề bằng AI Flash' : 'Nhập đề từ PDF'}</h2>
                        <div className="space-y-4">
                            {activeMenu === 'ai' ? (
                                <>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold" placeholder="Nhập chủ đề (VD: Đạo hàm lớp 12)" value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                                    <div className="grid grid-cols-3 gap-2">
                                        {[{l: 'P1 (MCQ)', v: 'p1'}, {l: 'P2 (Đ/S)', v: 'p2'}, {l: 'P3 (Ngắn)', v: 'p3'}].map(item => (
                                            <div key={item.v} className="text-center">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">{item.l}</label>
                                                <input type="number" className="w-full bg-slate-50 border rounded-lg p-2 text-xs text-center font-bold" value={(aiConfig as any)[item.v]} onChange={e => setAiConfig({...aiConfig, [item.v]: parseInt(e.target.value)})} />
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleAICompose} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl shadow-blue-100">BẮT ĐẦU SOẠN ĐỀ FLASH</button>
                                </>
                            ) : (
                                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 relative hover:bg-slate-100 transition-all group">
                                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePDFImport} />
                                    <Upload className="text-slate-300 group-hover:text-blue-400 mx-auto" size={40}/>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Kéo thả hoặc click để chọn PDF</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* BANK MODAL */}
        {showBank && (
            <div className="fixed inset-0 bg-slate-900/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Database size={24}/>
                            <div><h3 className="text-sm font-black uppercase">Ngân hàng câu hỏi hệ thống</h3><p className="text-[10px] text-slate-400 uppercase">Khối {bankGrade} • Chuyên đề: {bankCategory}</p></div>
                        </div>
                        <button onClick={() => setShowBank(false)} className="hover:rotate-90 transition-transform"><X size={24}/></button>
                    </div>
                    <div className="p-4 bg-slate-50 border-b flex gap-3 shrink-0">
                        <div className="flex flex-col gap-1 w-32">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Khối</label>
                            <select className="bg-white border rounded-lg p-2 text-xs font-bold outline-none" value={bankGrade} onChange={e => setBankGrade(e.target.value as Grade)}>
                                <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Chương</label>
                            <select className="bg-white border rounded-lg p-2 text-xs font-bold outline-none" value={bankCategory} onChange={e => setBankCategory(e.target.value)}>
                                <option value="all">TẤT CẢ CHƯƠNG</option>
                                {availableChapters.filter(c => c.grade === bankGrade).map(c => <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3 custom-scrollbar">
                        {quizzes.filter(q => q.grade === bankGrade && (bankCategory === 'all' || q.category === bankCategory))
                                .flatMap(q => q.questions).map((q, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-transparent hover:border-blue-400 shadow-sm transition-all flex justify-between items-center gap-4 group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[8px] font-black text-blue-500 uppercase px-1.5 py-0.5 bg-blue-50 rounded">{q.type}</span>
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">ID: {q.id.slice(0,8)}</span>
                                    </div>
                                    <div className="text-[12px] font-medium text-slate-700 leading-relaxed line-clamp-2"><LatexText text={q.text}/></div>
                                </div>
                                <button onClick={() => {
                                    const newQ = { ...q, id: uuidv4(), subQuestions: q.subQuestions?.map(sq => ({ ...sq, id: uuidv4() })) };
                                    setQuestions(sortQuestionsByType([...questions, newQ]));
                                }} className="bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 transition-all shrink-0"><Plus size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* VIEWING QUIZ (PREVIEW) */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/80 z-[800] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <FileText size={28}/>
                            <div><h3 className="text-sm font-black uppercase">{viewingQuiz.title}</h3><p className="text-[10px] text-slate-400 uppercase tracking-widest">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu hỏi</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleShufflePreview} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"><Shuffle size={14}/> XÁO ĐỀ</button>
                            <button onClick={handleExportDoc} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"><Download size={14}/> XUẤT WORD</button>
                            <button onClick={() => setViewingQuiz(null)} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"><X size={24}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                        <div className="max-w-2xl mx-auto bg-white p-12 shadow-sm rounded-[2rem] space-y-10">
                            {(previewQuestions.length > 0 ? previewQuestions : viewingQuiz.questions).map((q, i) => (
                                <div key={q.id} className="text-[13px] border-b border-slate-50 pb-8 last:border-0">
                                    <div className="font-black text-slate-800 text-base mb-4 leading-relaxed"><span className="text-blue-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                    {q.type === 'mcq' && q.options && (
                                        <div className="grid grid-cols-2 gap-4 ml-8 text-slate-500 font-medium">
                                            {q.options.map((opt, oi) => <div key={oi}><span className="text-slate-300 mr-1">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                        </div>
                                    )}
                                    {q.type === 'group-tf' && q.subQuestions && (
                                        <div className="ml-8 space-y-2 mt-2">
                                            {q.subQuestions.map((sq, si) => <div key={si}><span className="text-slate-300 mr-1">{String.fromCharCode(97+si)})</span> <LatexText text={sq.text}/></div>)}
                                        </div>
                                    )}
                                    {q.type === 'short' && (
                                        <div className="ml-8 mt-2 italic text-slate-400">
                                            Trả lời: ...........................................................
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PROCESSING OVERLAY */}
        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 mb-2 uppercase tracking-tight">{loadingMsg}</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Gemini 3 Flash đang thực thi nhiệm vụ...</p>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
