
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, BarChart3, Edit, 
    XCircle, X, BookOpen, Lightbulb, Database, 
    Bold, Italic, Underline, CornerDownLeft, Sigma, Settings2, 
    Sparkles, BrainCircuit, FileDown, Shuffle, Check, Search,
    ChevronRight, LayoutDashboard, Users, GraduationCap, FileText,
    Eye, Monitor, Cpu, FileUp, Trophy, History
} from 'lucide-react';
import LatexText from './LatexText';

// --- HELPERS ---
const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

// --- RICH TEXT EDITOR WITH PREVIEW ---
interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; showPreview?: boolean; }
const RichTextEditor = ({ value, onChange, placeholder, rows, className, showPreview = true }: RichTextEditorProps) => {
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
        <div className="flex flex-col gap-2">
            <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors"><Bold size={12}/></button>
                    <button type="button" onClick={() => insertTag('<i>', '</i>')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors"><Italic size={12}/></button>
                    <button type="button" onClick={() => insertTag('<u>', '</u>')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors"><Underline size={12}/></button>
                    <div className="w-px h-3 bg-slate-300 mx-1"></div>
                    <button type="button" onClick={() => insertTag('$', '$')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors" title="Toán LaTeX"><Sigma size={12}/></button>
                    <button type="button" onClick={() => insertTag('<br/>')} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded transition-colors"><CornerDownLeft size={12}/></button>
                </div>
                {rows ? (
                    <textarea ref={inputRef as any} className={`w-full p-3 outline-none text-sm leading-relaxed resize-none ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                ) : (
                    <input ref={inputRef as any} type="text" className={`w-full p-2.5 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
                )}
            </div>
            {showPreview && value && (
                <div className="px-3 py-2 bg-indigo-50/30 rounded-lg border border-indigo-50 text-xs text-indigo-900/70 italic min-h-[1.5rem]">
                    <span className="font-bold opacity-40 mr-2 not-italic text-[9px] uppercase tracking-tighter">Xem trước:</span>
                    <LatexText text={value} />
                </div>
            )}
        </div>
    );
};

// --- MAIN DASHBOARD ---
const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');

  // AI & PDF States
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 12, p2: 4, p3: 6 });
  const [importFile, setImportFile] = useState<File | null>(null);

  // Quiz Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Modals
  const [showBank, setShowBank] = useState(false);
  const [bankGrade, setBankGrade] = useState<Grade>('12');
  const [bankQuizId, setBankQuizId] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [viewingResult, setViewingResult] = useState<Result | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => { refreshData(); }, [activeMenu]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
  };

  // Fix: handleEdit implementation to load quiz data into the editor state
  const handleEdit = (q: Quiz) => {
    setEditingId(q.id);
    setTitle(q.title);
    setCategory(q.category || '');
    setQuizType(q.type);
    setGrade(q.grade);
    setDuration(q.durationMinutes);
    setQuestions(q.questions);
    setIsPublished(q.isPublished);
    setActiveMenu('create');
  };

  // Fix: handleExportWord implementation to generate a downloadable .doc file from quiz content
  const handleExportWord = (quiz: Quiz, questions: Question[]) => {
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${quiz.title}</title></head>
      <body>
        <h1 style='text-align:center'>${quiz.title}</h1>
        <p>Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</p>
        <hr/>
    `;

    questions.forEach((q, i) => {
      content += `<div><b>Câu ${i + 1}:</b> ${q.text}</div>`;
      if (q.type === 'mcq' && q.options) {
        content += "<ul>";
        q.options.forEach((opt, oi) => {
          content += `<li>${String.fromCharCode(65 + oi)}. ${opt}</li>`;
        });
        content += "</ul>";
      }
      if (q.type === 'group-tf' && q.subQuestions) {
          content += "<ul>";
          q.subQuestions.forEach((sq, si) => {
              content += `<li>${String.fromCharCode(97 + si)}) ${sq.text}</li>`;
          });
          content += "</ul>";
      }
      content += "<br/>";
    });

    content += "</body></html>";

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setDuration(90); setIsPublished(false);
  };

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    const filtered = quizzes.filter(q => gradeFilter === 'all' || q.grade === gradeFilter);
    filtered.forEach(q => {
      const cat = q.category || 'Chưa phân loại';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    });
    return groups;
  }, [quizzes, gradeFilter]);

  const handleSave = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên đề thi.");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    refreshData(); setActiveMenu('quizzes'); resetForm();
  };

  const handleAICompose = async () => {
    if (!aiTopic.trim()) return alert("Nhập chủ đề đề thi!");
    setIsProcessing(true); setLoadingMsg("AI đang soạn đề thi Toán...");
    try {
        const newQs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3 });
        setQuestions(newQs);
        setTitle(`Đề thi: ${aiTopic}`);
        setActiveMenu('create');
    } catch (e) { alert("Lỗi soạn đề AI: " + e); }
    finally { setIsProcessing(false); }
  };

  const handlePDFImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true); setLoadingMsg("Đang đọc và bóc tách PDF...");
    const reader = new FileReader();
    reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
            const newQs = await parseQuestionsFromPDF(base64);
            setQuestions(newQs);
            setTitle(file.name.replace('.pdf', ''));
            setActiveMenu('create');
        } catch (e) { alert("Lỗi nhập PDF: " + e); }
        finally { setIsProcessing(false); }
    };
    reader.readAsDataURL(file);
  };

  const renderQuestionEditor = (type: QuestionType, label: string, color: string) => (
    <div className={`border-l-4 ${color} bg-white rounded-r-2xl shadow-sm mb-6 overflow-hidden border border-slate-100`}>
        <div className="bg-slate-50 px-6 py-3.5 flex justify-between items-center border-b border-slate-100">
            <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-widest flex items-center gap-2">{label}</h3>
            <div className="flex gap-2">
                <button onClick={() => { setBankGrade(grade); setShowBank(true); }} className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-indigo-50 transition-all flex items-center gap-1 border border-slate-200 shadow-sm"><Database size={12}/> NGÂN HÀNG</button>
                <button onClick={() => {
                    let q: Question = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
                    if (type === 'mcq') q.options = ['', '', '', ''];
                    if (type === 'group-tf') q.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' }));
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-indigo-700 transition-all shadow-md">+ THÊM CÂU</button>
            </div>
        </div>
        <div className="p-6 space-y-6">
            {questions.filter(q => q.type === type).map((q) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="border border-slate-100 rounded-2xl p-5 space-y-5 bg-white relative hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center pb-2">
                            <span className="text-indigo-600 font-black text-[10px] uppercase">Câu {gIdx + 1}</span>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Điểm:</span>
                                    <input type="text" className="w-10 bg-slate-50 border border-slate-200 rounded-lg text-center font-black py-1 text-xs focus:ring-2 focus:ring-indigo-100 outline-none" value={q.points} onChange={e => {
                                        const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                                <button onClick={() => { if(confirm('Xóa câu này?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="space-y-5">
                            <RichTextEditor rows={2} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} placeholder="Nhập nội dung câu hỏi..." />

                            {type === 'mcq' && q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-2 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
                                            <input type="radio" className="w-4 h-4 accent-indigo-600 cursor-pointer" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} />
                                            <RichTextEditor className="flex-1 border-none bg-transparent" showPreview={false} value={opt} onChange={v => {
                                                const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = v; n[gIdx].options = o; setQuestions(n);
                                            }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {type === 'group-tf' && q.subQuestions && (
                                <div className="space-y-2">
                                    {q.subQuestions.map((sq, si) => (
                                        <div key={si} className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-black text-indigo-500 w-5">{String.fromCharCode(97+si)})</span>
                                            <input type="text" className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium outline-none" value={sq.text} onChange={e => {
                                                const n = [...questions]; const s = [...(n[gIdx].subQuestions||[])]; s[si].text = e.target.value; n[gIdx].subQuestions = s; setQuestions(n);
                                            }} placeholder={`Ý ${String.fromCharCode(97+si)}...`} />
                                            <div className="flex gap-1 shrink-0 bg-white p-0.5 rounded-lg border">
                                                {['True', 'False'].map(val => (
                                                    <button key={val} onClick={() => {
                                                        const n = [...questions]; const s = [...(n[gIdx].subQuestions || [])]; s[si].correctAnswer = val as any; n[gIdx].subQuestions = s; setQuestions(n);
                                                    }} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${sq.correctAnswer === val ? (val === 'True' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-300'}`}>
                                                        {val === 'True' ? 'Đúng' : 'Sai'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {type === 'short' && (
                                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3">
                                    <Check className="text-emerald-600" size={16}/>
                                    <input type="text" className="flex-1 bg-white border border-emerald-200 rounded-lg p-2 font-black text-sm text-emerald-700 outline-none" value={q.correctAnswer} onChange={e => {
                                        const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                    }} placeholder="Nhập đáp án đúng..." />
                                </div>
                            )}

                            <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100">
                                <label className="text-[9px] font-black text-amber-700 uppercase mb-2 flex items-center gap-1 tracking-widest"><Lightbulb size={12}/> Lời giải chi tiết</label>
                                <RichTextEditor rows={2} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Nhập lời giải..." />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
        {/* SIDEBAR MẢNH */}
        <aside className="w-60 bg-[#1e293b] flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg"><Cpu className="text-white" size={18}/></div>
                <h1 className="text-sm font-black text-white tracking-widest">EDUQUIZ <span className="text-indigo-400">VN</span></h1>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                <button onClick={() => setActiveMenu('quizzes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'quizzes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <LayoutDashboard size={16}/> QUẢN LÝ ĐỀ
                </button>
                <button onClick={() => { resetForm(); setActiveMenu('create'); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'create' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Plus size={16}/> SOẠN THỦ CÔNG
                </button>
                <button onClick={() => setActiveMenu('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'ai' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Sparkles size={16}/> SOẠN BẰNG AI
                </button>
                <button onClick={() => setActiveMenu('import')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'import' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <FileUp size={16}/> NHẬP TỪ PDF
                </button>
                <div className="pt-6 pb-2 px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Dữ liệu hệ thống</div>
                <button onClick={() => setActiveMenu('results')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'results' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <BarChart3 size={16}/> KẾT QUẢ THI
                </button>
                <button onClick={() => setActiveMenu('students')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === 'students' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Users size={16}/> HỌC SINH
                </button>
            </nav>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 bg-white border-b border-slate-100 px-8 flex justify-between items-center shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                        {activeMenu === 'quizzes' ? 'Danh sách đề thi' : activeMenu.toUpperCase()}
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    {(['all', '10', '11', '12'] as const).map(g => (
                        <button key={g} onClick={() => setGradeFilter(g)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${gradeFilter === g ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            {g === 'all' ? 'TẤT CẢ' : `LỚP ${g}`}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* LIST VIEW */}
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {Object.keys(groupedQuizzes).length === 0 ? (
                            <div className="col-span-full py-40 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
                                <FileText size={40} className="text-slate-200"/>
                                <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Hệ thống chưa có đề thi nào</p>
                            </div>
                        ) : (
                            Object.keys(groupedQuizzes).sort().map(cat => (
                                <div key={cat} className="col-span-full space-y-4">
                                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2 border-l-4 border-indigo-400">{cat}</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedQuizzes[cat].map(q => (
                                            <div key={q.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-xl transition-all group">
                                                <div>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${q.type === 'test' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                                        <span className="text-[9px] font-black text-slate-300 uppercase">Lớp {q.grade}</span>
                                                    </div>
                                                    <h3 className="text-base font-black text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{q.title}</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{q.questions.length} câu hỏi • {q.durationMinutes} phút</p>
                                                </div>
                                                <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                                                    <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-indigo-50 text-indigo-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">Xem đề</button>
                                                    <button onClick={() => handleEdit(q)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit size={16}/></button>
                                                    <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* CREATE VIEW */}
                {activeMenu === 'create' && (
                    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in pb-20">
                        <div className="lg:col-span-8 space-y-8">
                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                                <input type="text" className="w-full text-2xl font-black border-none focus:ring-0 outline-none placeholder-slate-200 bg-transparent tracking-tight" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Chương / Mục</label>
                                        <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-black focus:ring-2 focus:ring-indigo-100" placeholder="VD: Chương 1: Đạo hàm" value={category} onChange={e => setCategory(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Thời gian (phút)</label>
                                        <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-black focus:ring-2 focus:ring-indigo-100" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                            {renderQuestionEditor('mcq', 'Phần I: Câu trắc nghiệm nhiều phương án', 'border-indigo-500')}
                            {renderQuestionEditor('group-tf', 'Phần II: Câu trắc nghiệm Đúng/Sai', 'border-purple-500')}
                            {renderQuestionEditor('short', 'Phần III: Câu trắc nghiệm trả lời ngắn', 'border-emerald-500')}
                        </div>
                        <div className="lg:col-span-4">
                            <div className="sticky top-24 space-y-6">
                                <div className="bg-[#1e293b] text-white p-8 rounded-[2rem] shadow-xl space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thống kê đề thi</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-800 p-4 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-500 uppercase mb-1">Số câu</p><p className="text-2xl font-black">{questions.length}</p></div>
                                        <div className="bg-slate-800 p-4 rounded-2xl text-center"><p className="text-[9px] font-black text-slate-500 uppercase mb-1">Điểm</p><p className="text-2xl font-black text-indigo-400">{questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1)}</p></div>
                                    </div>
                                    <label className="flex items-center justify-center gap-3 cursor-pointer bg-slate-800 py-3 rounded-xl border border-slate-700 text-xs font-bold text-slate-400">
                                        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-0" /> CÔNG KHAI ĐỀ THI
                                    </label>
                                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2">
                                        <Save size={16}/> LƯU ĐỀ THI NGAY
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI VIEW */}
                {activeMenu === 'ai' && (
                    <div className="max-w-2xl mx-auto py-20 animate-fade-in bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center space-y-8">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner"><Sparkles size={32}/></div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Soạn đề thi bằng AI</h2>
                            <p className="text-slate-400 text-sm font-medium mt-2">Nhập chủ đề và AI sẽ tự động tạo đề thi Toán 3 phần có lời giải.</p>
                        </div>
                        <div className="space-y-6">
                            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-bold focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="VD: Khảo sát hàm số lớp 12" value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">P1 (MCQ)</label><input type="number" className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-center font-bold" value={aiConfig.p1} onChange={e => setAiConfig({...aiConfig, p1: parseInt(e.target.value)})} /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">P2 (Đ/S)</label><input type="number" className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-center font-bold" value={aiConfig.p2} onChange={e => setAiConfig({...aiConfig, p2: parseInt(e.target.value)})} /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">P3 (Ngắn)</label><input type="number" className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs text-center font-bold" value={aiConfig.p3} onChange={e => setAiConfig({...aiConfig, p3: parseInt(e.target.value)})} /></div>
                            </div>
                            <button onClick={handleAICompose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all">BẮT ĐẦU SOẠN ĐỀ AI</button>
                        </div>
                    </div>
                )}

                {/* IMPORT VIEW */}
                {activeMenu === 'import' && (
                    <div className="max-w-2xl mx-auto py-20 animate-fade-in bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center space-y-8">
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner"><FileUp size={32}/></div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Nhập đề từ file PDF</h2>
                            <p className="text-slate-400 text-sm font-medium mt-2">Hệ thống sẽ tự động bóc tách câu hỏi, đáp án và lời giải.</p>
                        </div>
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 relative hover:bg-slate-100 transition-all group">
                            <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePDFImport} />
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="text-slate-300 group-hover:text-indigo-400 transition-colors" size={48}/>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Kéo thả hoặc Click để chọn file PDF</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* RESULTS VIEW */}
                {activeMenu === 'results' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Trophy size={16} className="text-amber-500"/> Bảng điểm học sinh</h2>
                            <button onClick={refreshData} className="p-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-200 shadow-sm"><Shuffle size={16}/></button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                        <th className="px-8 py-4">Học sinh</th>
                                        <th className="px-8 py-4">Đề thi</th>
                                        <th className="px-8 py-4">Thời gian</th>
                                        <th className="px-8 py-4">Ngày thi</th>
                                        <th className="px-8 py-4 text-center">Điểm</th>
                                        <th className="px-8 py-4 text-right">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {results.length === 0 ? (
                                        <tr><td colSpan={6} className="p-20 text-center text-slate-300 font-black uppercase text-xs">Chưa có dữ liệu bài thi</td></tr>
                                    ) : (
                                        results.sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-5 font-black text-slate-800 text-xs">{r.studentName}</td>
                                                <td className="px-8 py-5 text-xs font-bold text-slate-500">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td>
                                                <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                                <td className="px-8 py-5 text-[10px] font-bold text-slate-400">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                                <td className="px-8 py-5 text-center font-black text-lg text-indigo-600">{r.score.toFixed(2)}</td>
                                                <td className="px-8 py-5 text-right">
                                                    <button onClick={() => setViewingResult(r)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg"><Eye size={18}/></button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* STUDENTS VIEW */}
                {activeMenu === 'students' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                        {users.filter(u=>u.role==='student' && (gradeFilter==='all' || u.grade===gradeFilter)).map(s => (
                            <div key={s.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-4 text-center group hover:shadow-lg transition-all">
                                <div className="w-16 h-16 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:bg-indigo-50 transition-colors">{s.fullName.charAt(0)}</div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm">{s.fullName}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">LỚP {s.grade} • ID: {s.username}</p>
                                </div>
                                <button onClick={async () => { if(confirm('Xóa học sinh?')) { await deleteUser(s.id); refreshData(); } }} className="text-[9px] font-black text-rose-300 hover:text-rose-500 uppercase tracking-widest flex items-center gap-1"><Trash2 size={12}/> Xóa tài khoản</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>

        {/* BANK MODAL */}
        {showBank && (
            <div className="fixed inset-0 bg-slate-900/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Database size={24}/>
                            <div><h3 className="text-base font-black uppercase">Ngân hàng câu hỏi</h3><p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Khối {bankGrade}</p></div>
                        </div>
                        <button onClick={() => setShowBank(false)} className="hover:rotate-90 transition-transform"><XCircle size={28}/></button>
                    </div>
                    <div className="p-6 bg-slate-50 border-b flex gap-4 shrink-0">
                        <select className="flex-1 bg-white border border-slate-200 rounded-xl p-3 font-black text-xs outline-none" value={bankQuizId} onChange={e => setBankQuizId(e.target.value)}>
                            <option value="">-- Chọn đề gốc --</option>
                            {quizzes.filter(q => q.grade === bankGrade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                        </select>
                        <select className="w-32 bg-white border border-slate-200 rounded-xl p-3 font-black text-xs outline-none" value={bankGrade} onChange={e => setBankGrade(e.target.value as Grade)}>
                            <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                        </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-4">
                        {bankQuizId ? (
                            quizzes.find(q => q.id === bankQuizId)?.questions.map((q, idx) => (
                                <div key={q.id} className="bg-white p-5 rounded-3xl border border-transparent hover:border-indigo-400 shadow-sm transition-all flex justify-between items-center gap-6 group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[9px] font-black text-indigo-500 uppercase px-2 py-0.5 bg-indigo-50 rounded-lg">{q.type}</span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase">Câu {idx+1}</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-700 leading-relaxed line-clamp-2"><LatexText text={q.text}/></div>
                                    </div>
                                    <button onClick={() => {
                                        const newQ = { ...q, id: uuidv4(), subQuestions: q.subQuestions?.map(sq => ({ ...sq, id: uuidv4() })) };
                                        setQuestions(sortQuestionsByType([...questions, newQ]));
                                        alert("Đã thêm!");
                                    }} className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center shrink-0"><Plus size={20}/></button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 text-slate-300 font-black flex flex-col items-center gap-4"><Search size={40}/><p className="uppercase text-[10px] tracking-widest">Hãy chọn đề thi gốc</p></div>
                        )}
                    </div>
                    <div className="p-6 bg-white border-t flex justify-center shrink-0">
                        <button onClick={() => setShowBank(false)} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl">Hoàn tất</button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEWING MODAL (PREVIEW ĐỀ) */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                    <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl"><FileText size={28}/></div>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{viewingQuiz.title}</h3>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu hỏi</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => handleExportWord(viewingQuiz, viewingQuiz.questions)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><FileDown size={18}/> XUẤT WORD</button>
                            <button onClick={() => setViewingQuiz(null)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white"><X size={24}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 bg-slate-100 custom-scrollbar">
                        <div className="max-w-4xl mx-auto bg-white p-16 shadow-2xl rounded-[3rem] space-y-12">
                            {viewingQuiz.questions.map((q, i) => (
                                <div key={q.id}>
                                    <div className="font-black text-slate-800 text-base mb-6 leading-relaxed"><span className="text-indigo-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                    {q.type === 'mcq' && q.options && (
                                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 ml-10">
                                            {q.options.map((opt, oi) => (
                                                <div key={oi} className="text-sm text-slate-600 font-bold"><span className="text-slate-400 mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>
                                            ))}
                                        </div>
                                    )}
                                    {q.solution && (
                                        <div className="mt-8 ml-10 p-6 bg-slate-50 rounded-2xl border border-slate-200 italic text-sm text-slate-500 leading-relaxed">
                                            <div className="font-black text-[10px] text-slate-400 uppercase mb-2">Lời giải:</div>
                                            <LatexText text={q.solution}/>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* VIEWING RESULT (CHI TIẾT KẾT QUẢ) */}
        {viewingResult && (
            <div className="fixed inset-0 bg-slate-900/90 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                    <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Monitor size={28}/>
                            <div>
                                <h3 className="text-lg font-black uppercase">Chi tiết kết quả thi</h3>
                                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">{viewingResult.studentName}</p>
                            </div>
                        </div>
                        <button onClick={() => setViewingResult(null)}><XCircle size={32}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 bg-slate-50 custom-scrollbar">
                        <div className="grid grid-cols-3 gap-6 mb-10">
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Điểm số</p><p className="text-3xl font-black text-indigo-600">{viewingResult.score.toFixed(2)}</p></div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Thời gian</p><p className="text-2xl font-black">{Math.floor(viewingResult.durationSeconds/60)}p {viewingResult.durationSeconds%60}s</p></div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ngày thi</p><p className="text-sm font-black">{new Date(viewingResult.submittedAt).toLocaleDateString('vi-VN')}</p></div>
                        </div>
                        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100">
                             <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 border-b pb-4">Quá trình làm bài</h4>
                             <div className="text-center text-slate-300 italic text-xs py-10">Chi tiết từng câu đang được đồng bộ...</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PROCESSING OVERLAY */}
        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
                <div className="relative">
                    <div className="w-24 h-24 border-8 border-slate-50 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-indigo-600"><Sparkles size={32}/></div>
                </div>
                <h2 className="text-xl font-black text-slate-800 mt-8 mb-2 uppercase tracking-tight">{loadingMsg}</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Hệ thống Gemini 3 Pro đang xử lý dữ liệu Toán học...</p>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
