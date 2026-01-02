
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
    Eye, Monitor, Cpu, FileUp, Trophy, History, Settings, Filter
} from 'lucide-react';
import LatexText from './LatexText';

// --- HELPERS ---
const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
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
        <div className="flex flex-col gap-1">
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
                <div className="px-2 py-1.5 bg-blue-50/30 rounded border border-blue-50 text-[12px] text-slate-600 italic">
                    <span className="text-[9px] font-bold text-blue-400 uppercase mr-2 not-italic">Hiển thị:</span>
                    <LatexText text={value} />
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');

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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Modals
  const [showBank, setShowBank] = useState(false);
  const [bankGrade, setBankGrade] = useState<Grade>('12');
  const [bankCategory, setBankCategory] = useState('Tất cả');
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => { refreshData(); }, [activeMenu]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
  };

  const handleEdit = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveMenu('create');
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setDuration(90); setIsPublished(false);
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Nhập tên đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    refreshData(); setActiveMenu('quizzes'); resetForm();
  };

  const handleAICompose = async () => {
    if (!aiTopic.trim()) return alert("Nhập chủ đề!");
    setIsProcessing(true); setLoadingMsg("AI Flash đang soạn thảo...");
    try {
        const newQs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3 });
        setQuestions(newQs);
        setTitle(`Đề AI: ${aiTopic}`);
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

  const bankCategories = useMemo(() => {
    const cats = new Set<string>(['Tất cả']);
    quizzes.filter(q => q.grade === bankGrade).forEach(q => {
        if (q.category) cats.add(q.category);
    });
    return Array.from(cats);
  }, [quizzes, bankGrade]);

  const bankQuestions = useMemo(() => {
    let qs: Question[] = [];
    quizzes.filter(q => q.grade === bankGrade && (bankCategory === 'Tất cả' || q.category === bankCategory))
           .forEach(q => { qs = [...qs, ...q.questions]; });
    return qs;
  }, [quizzes, bankGrade, bankCategory]);

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
                }} className="bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] font-bold">+ THÊM</button>
            </div>
        </div>
        <div className="p-4 space-y-4">
            {questions.filter(q => q.type === type).map((q) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50/20 space-y-3 relative group">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Câu {gIdx + 1}</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-slate-400">ĐIỂM:</span>
                                    <input type="text" className="w-8 bg-white border border-slate-200 rounded p-0.5 text-center text-[10px] font-bold" value={q.points} onChange={e => {
                                        const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                                <button onClick={() => { if(confirm('Xóa?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                            </div>
                        </div>
                        
                        <RichTextEditor rows={2} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} placeholder="Nhập nội dung câu hỏi..." label="Nội dung câu hỏi" />

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-2 gap-2">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                        <input type="radio" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} className="w-3 h-3 accent-blue-600" />
                                        <input type="text" className="flex-1 bg-white border border-slate-200 rounded p-1 text-[12px] outline-none" value={opt} onChange={e => {
                                            const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = e.target.value; n[gIdx].options = o; setQuestions(n);
                                        }} placeholder={`PA ${String.fromCharCode(65+oi)}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && q.subQuestions && (
                            <div className="space-y-1.5 bg-white p-2 rounded border border-slate-100">
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
                            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400">ĐÁP ÁN:</span>
                                <input type="text" className="flex-1 bg-slate-50 border border-slate-100 rounded p-1 text-xs font-bold outline-none" value={q.correctAnswer} onChange={e => {
                                    const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                }} placeholder="Kết quả..." />
                            </div>
                        )}

                        <RichTextEditor rows={1} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Lời giải chi tiết..." label="Lời giải" />
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Cpu size={18}/></div>
                <h1 className="text-sm font-black text-white tracking-widest uppercase">EduQuiz <span className="text-blue-400">VN</span></h1>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ THỦ CÔNG' },
                    { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                    { id: 'import', icon: FileUp, label: 'NHẬP ĐỀ TỪ PDF' },
                    { id: 'results', icon: BarChart3, label: 'KẾT QUẢ THI' },
                    { id: 'students', icon: Users, label: 'DANH SÁCH HỌC SINH' }
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
            <header className="h-14 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{activeMenu}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400"/>
                    <div className="bg-slate-50 border rounded-lg p-0.5 flex">
                        {(['all', '10', '11', '12'] as const).map(g => (
                            <button key={g} onClick={() => setGradeFilter(g)} className={`px-4 py-1 rounded-md text-[10px] font-bold ${gradeFilter === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                {g === 'all' ? 'TẤT CẢ' : `LỚP ${g}`}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* QUIZ LIST */}
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {quizzes.filter(q => gradeFilter === 'all' || q.grade === gradeFilter).map(q => (
                            <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-blue-500">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                        <span className="text-[10px] font-bold text-slate-300">Khối {q.grade}</span>
                                    </div>
                                    <h3 className="text-[14px] font-black text-slate-800 mb-1 leading-tight">{q.title}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{q.category || 'Chưa phân loại'}</p>
                                    <div className="mt-4 flex gap-4">
                                        <div className="text-[10px] text-slate-500"><span className="font-black">{q.questions.length}</span> CÂU</div>
                                        <div className="text-[10px] text-slate-500"><span className="font-black">{q.durationMinutes}</span> PHÚT</div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-50 flex gap-1">
                                    <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all">XEM ĐỀ</button>
                                    <button onClick={() => handleEdit(q)} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                    <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CREATE QUIZ */}
                {activeMenu === 'create' && (
                    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 mb-6 shadow-sm">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 md:col-span-6 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Tên đề thi</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none focus:ring-1 focus:ring-blue-100" placeholder="VD: Khảo sát hàm số..." value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="col-span-12 md:col-span-3 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Chương / Mục</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none focus:ring-1 focus:ring-blue-100" placeholder="Chương 1..." value={category} onChange={e => setCategory(e.target.value)} />
                                </div>
                                <div className="col-span-12 md:col-span-3 space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Phút</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-black outline-none focus:ring-1 focus:ring-blue-100" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {renderQuestionEditor('mcq', 'Phần I: Câu trắc nghiệm 4 lựa chọn', 'text-blue-600')}
                            {renderQuestionEditor('group-tf', 'Phần II: Câu trắc nghiệm Đúng/Sai', 'text-purple-600')}
                            {renderQuestionEditor('short', 'Phần III: Câu trả lời ngắn', 'text-emerald-600')}
                        </div>

                        <div className="fixed bottom-8 right-8 flex flex-col gap-2">
                             <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-lg text-[10px] font-black text-slate-500 cursor-pointer">
                                <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} /> CÔNG KHAI
                             </label>
                             <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-3 rounded-full font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
                                <Save size={16}/> LƯU ĐỀ THI
                             </button>
                        </div>
                    </div>
                )}

                {/* STUDENTS */}
                {activeMenu === 'students' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                        {users.filter(u=>u.role==='student' && (gradeFilter==='all' || u.grade===gradeFilter)).map(s => {
                            const studentResults = results.filter(r => r.studentId === s.id);
                            const avgScore = studentResults.length > 0 ? studentResults.reduce((a, b) => a + b.score, 0) / studentResults.length : 0;
                            
                            return (
                                <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col items-center gap-3 text-center group hover:shadow-md transition-all">
                                    <div className="w-12 h-12 bg-slate-100 text-blue-600 rounded-lg flex items-center justify-center font-black text-lg group-hover:bg-blue-50 transition-colors">{s.fullName.charAt(0)}</div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-[13px]">{s.fullName}</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">LỚP {s.grade} • ID: {s.username}</p>
                                    </div>
                                    <div className="w-full flex justify-between px-4 py-2 bg-slate-50 rounded-lg text-[10px] font-bold">
                                        <div className="text-slate-400">ĐỀ: <span className="text-slate-700">{studentResults.length}</span></div>
                                        <div className="text-slate-400">ĐIỂM: <span className="text-blue-600">{avgScore.toFixed(1)}</span></div>
                                    </div>
                                    <div className="flex w-full gap-2">
                                        <button onClick={() => setViewingStudent(s)} className="flex-1 bg-white border border-slate-200 py-1.5 rounded-lg text-[9px] font-black uppercase text-slate-500 hover:bg-slate-50">Chi tiết</button>
                                        <button onClick={async () => { if(confirm('Xóa?')) { await deleteUser(s.id); refreshData(); } }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* AI / PDF VIEWS (Keeping stable as before but refined) */}
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
                                        {[{l: 'P1', v: 'p1'}, {l: 'P2', v: 'p2'}, {l: 'P3', v: 'p3'}].map(item => (
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

                {/* RESULTS */}
                {activeMenu === 'results' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                         <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                            <h2 className="text-[11px] font-black uppercase text-slate-500">Bảng kết quả thi tập trung</h2>
                            <button onClick={refreshData} className="p-1.5 border rounded bg-white text-slate-400"><Shuffle size={14}/></button>
                         </div>
                         <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase border-b">
                                    <th className="px-6 py-3">Học sinh</th>
                                    <th className="px-6 py-3">Đề thi</th>
                                    <th className="px-6 py-3 text-center">Khối</th>
                                    <th className="px-6 py-3 text-center">Điểm</th>
                                    <th className="px-6 py-3 text-right">Ngày nộp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50 text-[12px] transition-colors">
                                        <td className="px-6 py-3 font-bold">{r.studentName}</td>
                                        <td className="px-6 py-3 text-slate-500">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề cũ'}</td>
                                        <td className="px-6 py-3 text-center font-bold text-slate-400">{quizzes.find(q=>q.id===r.quizId)?.grade || '-'}</td>
                                        <td className="px-6 py-3 text-center font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td>
                                        <td className="px-6 py-3 text-right text-slate-400 text-[10px]">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
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
                            <div><h3 className="text-sm font-black uppercase">Ngân hàng câu hỏi theo chuyên đề</h3><p className="text-[10px] text-slate-400">Chọn câu hỏi để thêm vào đề hiện tại</p></div>
                        </div>
                        <button onClick={() => setShowBank(false)} className="hover:rotate-90 transition-transform"><XCircle size={28}/></button>
                    </div>
                    <div className="p-4 bg-slate-50 border-b flex gap-3 shrink-0">
                        <div className="flex flex-col gap-1 w-32">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Khối</label>
                            <select className="bg-white border rounded-lg p-2 text-xs font-bold outline-none" value={bankGrade} onChange={e => setBankGrade(e.target.value as Grade)}>
                                <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Chuyên đề (Mục)</label>
                            <select className="bg-white border rounded-lg p-2 text-xs font-bold outline-none" value={bankCategory} onChange={e => setBankCategory(e.target.value)}>
                                {bankCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-3 custom-scrollbar">
                        {bankQuestions.map((q, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-transparent hover:border-blue-400 shadow-sm transition-all flex justify-between items-center gap-4 group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[8px] font-black text-blue-500 uppercase px-1.5 py-0.5 bg-blue-50 rounded">{q.type}</span>
                                        <span className="text-[9px] font-bold text-slate-300">Câu {idx+1}</span>
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

        {/* STUDENT DETAIL MODAL */}
        {viewingStudent && (
            <div className="fixed inset-0 bg-slate-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Monitor size={24}/>
                            <div><h3 className="text-sm font-black uppercase">Tiến trình rèn luyện của học sinh</h3><p className="text-[10px] text-blue-100 uppercase">{viewingStudent.fullName}</p></div>
                        </div>
                        <button onClick={() => setViewingStudent(null)}><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6 custom-scrollbar">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border text-center"><p className="text-[9px] font-bold text-slate-400 uppercase">Số đề đã thi</p><p className="text-2xl font-black">{results.filter(r=>r.studentId===viewingStudent.id).length}</p></div>
                            <div className="bg-white p-4 rounded-xl border text-center"><p className="text-[9px] font-bold text-slate-400 uppercase">Điểm trung bình</p><p className="text-2xl font-black text-blue-600">{(results.filter(r=>r.studentId===viewingStudent.id).reduce((a,b)=>a+b.score,0) / (results.filter(r=>r.studentId===viewingStudent.id).length || 1)).toFixed(1)}</p></div>
                            <div className="bg-white p-4 rounded-xl border text-center"><p className="text-[9px] font-bold text-slate-400 uppercase">Xếp loại</p><p className="text-lg font-black text-green-600">Ổn định</p></div>
                        </div>
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="p-3 bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b">Lịch sử bài làm chi tiết</div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <tbody className="divide-y">
                                        {results.filter(r=>r.studentId===viewingStudent.id).sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map(r => (
                                            <tr key={r.id} className="text-[11px] hover:bg-slate-50">
                                                <td className="px-4 py-3 font-bold">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề cũ'}</td>
                                                <td className="px-4 py-3 text-center">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                                <td className="px-4 py-3 text-right font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-slate-400">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* PROCESSING OVERLAY */}
        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-sm font-black text-slate-800 mt-6 uppercase tracking-widest">{loadingMsg}</h2>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-2 animate-pulse">Hệ thống AI Flash đang bóc tách nội dung...</p>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
