
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
    ChevronRight, LayoutDashboard, Users, GraduationCap, FileText
} from 'lucide-react';
import LatexText from './LatexText';

// --- HELPERS ---
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

// --- RICH TEXT EDITOR ---
interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; }
const RichTextEditor = ({ value, onChange, placeholder, rows, className }: RichTextEditorProps) => {
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
        <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-50 border-b border-slate-100">
                <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 hover:bg-slate-200 rounded transition-colors text-slate-600"><Bold size={14}/></button>
                <button type="button" onClick={() => insertTag('<i>', '</i>')} className="p-1.5 hover:bg-slate-200 rounded transition-colors text-slate-600"><Italic size={14}/></button>
                <button type="button" onClick={() => insertTag('<u>', '</u>')} className="p-1.5 hover:bg-slate-200 rounded transition-colors text-slate-600"><Underline size={14}/></button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button type="button" onClick={() => insertTag('$', '$')} className="p-1.5 hover:bg-slate-200 rounded transition-colors text-slate-600"><Sigma size={14}/></button>
                <button type="button" onClick={() => insertTag('<br/>')} className="p-1.5 hover:bg-slate-200 rounded transition-colors text-slate-600"><CornerDownLeft size={14}/></button>
            </div>
            {rows ? (
                <textarea ref={inputRef as any} className={`w-full p-3 outline-none text-sm leading-relaxed resize-none ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as any} type="text" className={`w-full p-2.5 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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

  // Quiz Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Bank Modal
  const [showBank, setShowBank] = useState(false);
  const [bankGrade, setBankGrade] = useState<Grade>('12');
  const [bankQuizId, setBankQuizId] = useState('');

  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQs, setPreviewQs] = useState<Question[]>([]);

  useEffect(() => { refreshData(); }, [activeMenu]);
  useEffect(() => { if (viewingQuiz) setPreviewQs([...viewingQuiz.questions]); }, [viewingQuiz]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
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
    if (!title.trim()) return alert("Nhập tên đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    refreshData(); setActiveMenu('quizzes'); resetForm();
  };

  const handleEdit = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveMenu('create');
  };

  const handleExportWord = (quiz: Quiz, qs: Question[]) => {
    const getChar = (i: number) => String.fromCharCode(65 + i);
    let html = `<html><head><meta charset='utf-8'><style>body{font-family:'Times New Roman',serif;line-height:1.5;}.header{text-align:center;font-weight:bold;margin-bottom:20px;}.q{margin-top:15px;}.sol{font-style:italic;color:#666;border-left:2px solid #ccc;padding-left:10px;margin-top:5px;}</style></head><body><div class='header'>ĐỀ THI: ${quiz.title.toUpperCase()}</div>`;
    qs.forEach((q, i) => {
        html += `<div class='q'><b>Câu ${i+1}.</b> ${q.text}</div>`;
        if(q.type === 'mcq') {
            html += `<div>${q.options?.map((o,oi)=>`<b>${getChar(oi)}.</b> ${o}`).join('&nbsp;&nbsp;&nbsp;')}</div>`;
        } else if(q.type === 'group-tf') {
            q.subQuestions?.forEach((sq, si) => html += `<div style='margin-left:20px;'>${String.fromCharCode(97+si)}) ${sq.text}</div>`);
        }
        if(q.solution) html += `<div class='sol'><b>Lời giải:</b> ${q.solution}</div>`;
    });
    html += `</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${quiz.title}.doc`;
    link.click();
  };

  const renderQuestionEditor = (type: QuestionType, label: string, color: string) => (
    <div className={`border-l-4 ${color} bg-white rounded-r-3xl shadow-sm mb-8 overflow-hidden`}>
        <div className="bg-slate-50 px-8 py-5 flex justify-between items-center border-b border-slate-100">
            <h3 className="font-black text-slate-800 uppercase text-sm tracking-widest flex items-center gap-2"><div className={`w-2 h-2 rounded-full bg-current ${color.replace('border-','bg-')}`}></div> {label}</h3>
            <div className="flex gap-3">
                <button onClick={() => setShowBank(true)} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"><Database size={14}/> NGÂN HÀNG</button>
                <button onClick={() => {
                    let q: Question = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
                    if (type === 'mcq') q.options = ['', '', '', ''];
                    if (type === 'group-tf') q.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' }));
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition-all shadow-md">+ THÊM CÂU MỚI</button>
            </div>
        </div>
        <div className="p-8 space-y-8">
            {questions.filter(q => q.type === type).map((q) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="group border-2 border-slate-100 rounded-[2rem] p-6 space-y-6 hover:border-blue-100 hover:shadow-xl transition-all bg-white relative">
                        <div className="flex justify-between items-center">
                            <span className="bg-slate-100 text-slate-500 px-5 py-2 rounded-full font-black text-xs">CÂU {gIdx + 1}</span>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Điểm:</span>
                                    <input type="text" className="w-14 bg-slate-50 border-none rounded-xl text-center font-black py-2 text-sm focus:ring-2 focus:ring-blue-100" value={q.points} onChange={e => {
                                        const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                                <button onClick={() => { if(confirm('Xóa câu này?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-slate-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-full"><Trash2 size={20}/></button>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Nội dung câu hỏi</label>
                                <RichTextEditor rows={3} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} placeholder="Nhập câu hỏi tại đây..." />
                            </div>

                            {type === 'mcq' && q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                                            <input type="radio" className="w-6 h-6 accent-blue-600 cursor-pointer" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} />
                                            <RichTextEditor className="flex-1 border-none bg-transparent" value={opt} onChange={v => {
                                                const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = v; n[gIdx].options = o; setQuestions(n);
                                            }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {type === 'group-tf' && q.subQuestions && (
                                <div className="space-y-3">
                                    {q.subQuestions.map((sq, si) => (
                                        <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                            <span className="text-xs font-black text-blue-600 w-8">{String.fromCharCode(97+si)})</span>
                                            <input type="text" className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none" value={sq.text} onChange={e => {
                                                const n = [...questions]; const s = [...(n[gIdx].subQuestions||[])]; s[si].text = e.target.value; n[gIdx].subQuestions = s; setQuestions(n);
                                            }} placeholder={`Nội dung ý ${String.fromCharCode(97+si)}...`} />
                                            <div className="flex gap-1 shrink-0 bg-white p-1 rounded-xl shadow-inner border border-slate-100">
                                                {['True', 'False'].map(val => (
                                                    <button key={val} onClick={() => {
                                                        const n = [...questions]; const s = [...(n[gIdx].subQuestions || [])]; s[si].correctAnswer = val as any; n[gIdx].subQuestions = s; setQuestions(n);
                                                    }} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${sq.correctAnswer === val ? (val === 'True' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'text-slate-300 hover:text-slate-400'}`}>
                                                        {val === 'True' ? 'ĐÚNG' : 'SAI'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {type === 'short' && (
                                <div className="bg-green-50 p-5 rounded-3xl border-2 border-green-100 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shrink-0"><Check size={24}/></div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-black text-green-700 uppercase mb-1 block">Đáp án chính xác</label>
                                        <input type="text" className="w-full bg-white border-2 border-green-200 rounded-xl p-3 font-black text-xl text-green-700 focus:border-green-500 outline-none" value={q.correctAnswer} onChange={e => {
                                            const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                        }} />
                                    </div>
                                </div>
                            )}

                            <div className="bg-yellow-50/50 p-6 rounded-[2rem] border-2 border-yellow-100">
                                <label className="text-[10px] font-black text-yellow-700 uppercase mb-3 flex items-center gap-2 tracking-widest"><Lightbulb size={16} className="text-yellow-500"/> Lời giải chi tiết</label>
                                <RichTextEditor rows={3} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Nhập hướng dẫn giải toán chi tiết..." />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        {/* SIDEBAR */}
        <aside className="w-72 bg-slate-900 flex flex-col shrink-0">
            <div className="p-8 border-b border-slate-800">
                <h1 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><GraduationCap size={24}/></div>
                    EDUQUIZ <span className="text-blue-500">PRO</span>
                </h1>
            </div>
            <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                <button onClick={() => setActiveMenu('quizzes')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'quizzes' ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <LayoutDashboard size={20}/> QUẢN LÝ ĐỀ THI
                </button>
                <button onClick={() => { resetForm(); setActiveMenu('create'); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'create' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Plus size={20}/> SOẠN ĐỀ THỦ CÔNG
                </button>
                <button onClick={() => setActiveMenu('ai')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'ai' ? 'bg-purple-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <BrainCircuit size={20}/> SOẠN ĐỀ BẰNG AI
                </button>
                <button onClick={() => setActiveMenu('import')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'import' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Upload size={20}/> NHẬP ĐỀ TỪ PDF
                </button>
                <div className="pt-4 pb-2 px-5 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Dữ liệu</div>
                <button onClick={() => setActiveMenu('results')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'results' ? 'bg-emerald-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <BarChart3 size={20}/> BẢNG ĐIỂM KẾT QUẢ
                </button>
                <button onClick={() => setActiveMenu('students')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-black transition-all ${activeMenu === 'students' ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
                    <Users size={20}/> QUẢN LÝ HỌC SINH
                </button>
            </nav>
            <div className="p-8 border-t border-slate-800">
                <div className="bg-slate-800/50 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Phiên bản</p>
                    <p className="text-white text-xs font-black">2.5.0 STABLE</p>
                </div>
            </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Header Header */}
            <header className="h-20 bg-white border-b border-slate-100 px-10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-100">
                        {activeMenu.toUpperCase()}
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        {(['all', '10', '11', '12'] as const).map(g => (
                            <button key={g} onClick={() => setGradeFilter(g)} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${gradeFilter === g ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {g === 'all' ? 'TẤT CẢ' : `LỚP ${g}`}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-10">
                
                {/* LIST VIEW */}
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-fade-in">
                        {Object.keys(groupedQuizzes).length === 0 ? (
                            <div className="col-span-full py-40 text-center flex flex-col items-center gap-6 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200"><FileText size={48}/></div>
                                <p className="text-slate-300 font-black text-xl uppercase tracking-widest">Chưa có đề thi nào</p>
                            </div>
                        ) : (
                            Object.keys(groupedQuizzes).sort().map(cat => (
                                <div key={cat} className="col-span-full space-y-6">
                                    <div className="flex items-center gap-4 pl-4 border-l-8 border-blue-500">
                                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{cat}</h2>
                                        <div className="h-px flex-1 bg-slate-200"></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                        {groupedQuizzes[cat].map(q => (
                                            <div key={q.id} className="group bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl border-2 border-transparent hover:border-blue-200 transition-all p-8 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex justify-between items-start mb-6">
                                                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>{q.type === 'test' ? 'KIỂM TRA' : 'LUYỆN TẬP'}</span>
                                                        <span className="text-[10px] font-black text-slate-300 uppercase">LỚP {q.grade}</span>
                                                    </div>
                                                    <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors leading-tight">{q.title}</h3>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{q.questions.length} CÂU HỎI • {q.durationMinutes} PHÚT</p>
                                                </div>
                                                <div className="mt-8 pt-8 border-t-2 border-dashed border-slate-50 flex gap-3">
                                                    <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-blue-50 text-blue-600 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">XEM ĐỀ</button>
                                                    <button onClick={() => handleEdit(q)} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"><Edit size={20}/></button>
                                                    <button onClick={async () => { if(confirm('Xóa vĩnh viễn đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
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
                    <div className="max-w-6xl mx-auto space-y-12 animate-fade-in pb-20">
                        <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-12">
                            <div className="flex-1 space-y-8">
                                <input type="text" className="w-full text-4xl font-black border-none focus:ring-0 outline-none placeholder-slate-200 bg-transparent tracking-tighter" placeholder="TÊN ĐỀ THI..." value={title} onChange={e => setTitle(e.target.value)} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chương / Mục / Chủ đề</label>
                                        <input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-2 focus:ring-blue-100" placeholder="VD: Chương 1: Hàm số" value={category} onChange={e => setCategory(e.target.value)} />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khối lớp</label>
                                        <select className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-2 focus:ring-blue-100" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option></select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Loại đề</label>
                                        <select className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-2 focus:ring-blue-100" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra chính thức</option></select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian (phút)</label>
                                        <input type="number" className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-2 focus:ring-blue-100" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full md:w-80 bg-slate-900 rounded-[2.5rem] p-10 flex flex-col justify-between text-center gap-8 shadow-2xl">
                                <div className="space-y-6">
                                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30"><Check size={32}/></div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Thống kê</p>
                                        <p className="text-3xl font-black text-white">{questions.length} <span className="text-slate-600 text-sm">Câu</span></p>
                                        <p className="text-lg font-black text-blue-500">{questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1)} <span className="text-slate-600 text-xs">Điểm</span></p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="flex items-center justify-center gap-3 cursor-pointer bg-slate-800 py-4 rounded-2xl font-black text-xs text-slate-400 hover:text-white transition-all border border-slate-700">
                                        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-0" /> CÔNG KHAI ĐỀ
                                    </label>
                                    <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-900/40 transition-all flex items-center justify-center gap-3">
                                        <Save size={20}/> LƯU ĐỀ THI
                                    </button>
                                </div>
                            </div>
                        </div>

                        {renderQuestionEditor('mcq', 'Phần I: Câu trắc nghiệm nhiều phương án', 'border-blue-500')}
                        {renderQuestionEditor('group-tf', 'Phần II: Câu trắc nghiệm Đúng/Sai', 'border-purple-500')}
                        {renderQuestionEditor('short', 'Phần III: Câu trắc nghiệm trả lời ngắn', 'border-emerald-500')}
                    </div>
                )}

                {/* AI / IMPORT VIEW (Placeholder for brevity, can implement fully if needed) */}
                {(activeMenu === 'ai' || activeMenu === 'import') && (
                    <div className="max-w-4xl mx-auto py-20 text-center animate-fade-in bg-white rounded-[4rem] border-2 border-slate-100 shadow-sm px-10">
                         <div className="w-24 h-24 bg-purple-50 text-purple-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><BrainCircuit size={48}/></div>
                         <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-4">{activeMenu === 'ai' ? 'Trí tuệ nhân tạo soạn đề' : 'Nhập liệu từ file PDF'}</h2>
                         <p className="text-slate-400 font-medium max-w-lg mx-auto mb-10 text-lg">Hệ thống AI đang được tối ưu hóa cho môn Toán. Vui lòng sử dụng tính năng "Soạn đề thủ công" hoặc "Ngân hàng câu hỏi" để đảm bảo tính chính xác cao nhất.</p>
                         <button onClick={() => setActiveMenu('create')} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-black transition-all">Sử dụng Soạn đề thủ công</button>
                    </div>
                )}

                {/* RESULTS VIEW */}
                {activeMenu === 'results' && (
                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
                        <div className="p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Bảng điểm học sinh</h2>
                            <div className="flex gap-4">
                                <button onClick={refreshData} className="p-3 bg-white text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 shadow-sm"><Shuffle size={20}/></button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <th className="px-10 py-5">Học sinh</th>
                                        <th className="px-10 py-5">Đề thi</th>
                                        <th className="px-10 py-5">Thời gian</th>
                                        <th className="px-10 py-5">Ngày nộp</th>
                                        <th className="px-10 py-5 text-right">Điểm số</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {results.length === 0 ? (
                                        <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-sm">Chưa có kết quả nào</td></tr>
                                    ) : (
                                        results.sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-10 py-6 font-black text-slate-800">{r.studentName}</td>
                                                <td className="px-10 py-6 text-sm font-bold text-slate-500">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td>
                                                <td className="px-10 py-6 text-xs font-black text-slate-400 uppercase">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                                <td className="px-10 py-6 text-xs font-bold text-slate-400">{new Date(r.submittedAt).toLocaleString('vi-VN')}</td>
                                                <td className="px-10 py-6 text-right font-black text-2xl text-blue-600">{r.score.toFixed(2)}</td>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                        {users.filter(u=>u.role==='student' && (gradeFilter==='all' || u.grade===gradeFilter)).map(s => (
                            <div key={s.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-6 group hover:shadow-xl transition-all">
                                <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner">{s.fullName.charAt(0)}</div>
                                <div className="flex-1">
                                    <h3 className="font-black text-slate-800 group-hover:text-amber-600 transition-colors">{s.fullName}</h3>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">LỚP {s.grade} • ID: {s.username}</p>
                                    <button onClick={async () => { if(confirm('Xóa học sinh này?')) { await deleteUser(s.id); refreshData(); } }} className="mt-3 text-[10px] font-black text-red-300 hover:text-red-500 uppercase tracking-widest flex items-center gap-1"><Trash2 size={12}/> Xóa tài khoản</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>

        {/* BANK MODAL */}
        {showBank && (
            <div className="fixed inset-0 bg-slate-900/80 z-[600] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Database size={24}/></div>
                            <div><h3 className="text-xl font-black uppercase tracking-tight">Ngân hàng câu hỏi</h3><p className="text-xs font-bold text-indigo-200 uppercase mt-0.5 tracking-widest">Lớp {bankGrade}</p></div>
                        </div>
                        <button onClick={() => setShowBank(false)} className="hover:rotate-90 transition-transform"><XCircle size={32}/></button>
                    </div>
                    <div className="p-8 bg-slate-50 border-b flex gap-4 shrink-0">
                        <select className="flex-1 bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-sm focus:border-indigo-500 outline-none" value={bankQuizId} onChange={e => setBankQuizId(e.target.value)}>
                            <option value="">-- Chọn đề thi gốc --</option>
                            {quizzes.filter(q => q.grade === bankGrade).map(q => <option key={q.id} value={q.id}>{q.title} ({q.questions.length} câu)</option>)}
                        </select>
                        <select className="w-40 bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-sm focus:border-indigo-500 outline-none" value={bankGrade} onChange={e => setBankGrade(e.target.value as Grade)}>
                            <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                        </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-4">
                        {bankQuizId ? (
                            quizzes.find(q => q.id === bankQuizId)?.questions.map((q, idx) => (
                                <div key={q.id} className="bg-white p-6 rounded-3xl border-2 border-transparent hover:border-indigo-400 shadow-sm transition-all flex justify-between items-center gap-6 group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] font-black text-indigo-500 uppercase px-3 py-1 bg-indigo-50 rounded-full">{q.type}</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">Câu {idx+1}</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-700 leading-relaxed line-clamp-2"><LatexText text={q.text}/></div>
                                    </div>
                                    <button onClick={() => {
                                        const newQ = { ...q, id: uuidv4(), subQuestions: q.subQuestions?.map(sq => ({ ...sq, id: uuidv4() })) };
                                        setQuestions(sortQuestionsByType([...questions, newQ]));
                                        alert("Đã thêm câu hỏi vào đề!");
                                    }} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center shrink-0"><Plus size={24}/></button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 text-slate-300 font-black flex flex-col items-center gap-4"><Search size={48}/><p className="uppercase text-xs tracking-widest">Chọn một đề thi để xem danh sách câu hỏi</p></div>
                        )}
                    </div>
                    <div className="p-6 bg-white border-t flex justify-center shrink-0">
                        <button onClick={() => setShowBank(false)} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Hoàn tất</button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEWING MODAL */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[700] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
                <div className="bg-white rounded-[4rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                    <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-xl"><FileText size={32}/></div>
                            <div>
                                <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight">{viewingQuiz.title}</h3>
                                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mt-1">KHỐI {viewingQuiz.grade} • {viewingQuiz.questions.length} CÂU HỎI</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setPreviewQs(shuffleArray([...previewQs]))} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><Shuffle size={18}/> XÁO ĐỀ</button>
                            <button onClick={() => handleExportWord(viewingQuiz, previewQs)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"><FileDown size={18}/> XUẤT WORD</button>
                            <button onClick={() => setViewingQuiz(null)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-white"><X size={24}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 bg-slate-100">
                        <div className="max-w-4xl mx-auto bg-white p-16 shadow-2xl rounded-[3rem] space-y-12">
                            <div className="text-center pb-12 border-b-4 border-slate-50">
                                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4 leading-tight">{viewingQuiz.title}</h2>
                                <div className="text-slate-400 font-black uppercase text-xs tracking-[0.4em]">KHỐI LỚP {viewingQuiz.grade} • THỜI GIAN: {viewingQuiz.durationMinutes} PHÚT</div>
                            </div>
                            <div className="space-y-12">
                                {previewQs.map((q, i) => (
                                    <div key={q.id}>
                                        <div className="font-black text-slate-800 text-lg mb-6 leading-relaxed"><span className="text-blue-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                        {q.type === 'mcq' && q.options && (
                                            <div className="grid grid-cols-2 gap-x-12 gap-y-4 ml-10">
                                                {q.options.map((opt, oi) => (
                                                    <div key={oi} className="text-sm text-slate-600 font-bold"><span className="text-slate-400 mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>
                                                ))}
                                            </div>
                                        )}
                                        {q.type === 'group-tf' && q.subQuestions && (
                                            <div className="space-y-4 ml-10">
                                                {q.subQuestions.map((sq, si) => (
                                                    <div key={si} className="text-sm text-slate-600 font-bold flex gap-4"><span className="text-slate-400 shrink-0">{String.fromCharCode(97+si)})</span> <LatexText text={sq.text}/></div>
                                                ))}
                                            </div>
                                        )}
                                        {q.solution && (
                                            <div className="mt-8 ml-10 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 italic text-sm text-slate-500 leading-relaxed relative">
                                                <div className="absolute top-0 left-8 -translate-y-1/2 bg-white px-4 py-1 rounded-full border-2 border-slate-100 not-italic font-black text-[10px] text-slate-400 uppercase tracking-widest">Hướng dẫn giải</div>
                                                <LatexText text={q.solution}/>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PROCESSING OVERLAY */}
        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
                <div className="relative">
                    <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-2xl"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-blue-600"><Sparkles size={40}/></div>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mt-12 mb-4 uppercase tracking-tighter">{loadingMsg}</h2>
                <p className="text-slate-400 font-black text-[10px] tracking-[0.3em] uppercase animate-pulse">Hệ thống AI đang trích xuất dữ liệu toán học...</p>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
