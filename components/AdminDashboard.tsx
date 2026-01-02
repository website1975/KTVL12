
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
    Eye, Monitor, Cpu, FileUp, Trophy, History, Settings
} from 'lucide-react';
import LatexText from './LatexText';

// --- HELPERS ---
const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

// --- RICH TEXT EDITOR COMPONENT ---
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
        <div className="flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <div className="flex items-center gap-0.5 p-1 bg-slate-50 border-b border-slate-100">
                <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1 hover:bg-white rounded text-slate-500"><Bold size={12}/></button>
                <button type="button" onClick={() => insertTag('$', '$')} className="p-1 hover:bg-white rounded text-blue-600" title="Toán LaTeX"><Sigma size={12}/></button>
                <button type="button" onClick={() => insertTag('<br/>')} className="p-1 hover:bg-white rounded text-slate-500"><CornerDownLeft size={12}/></button>
            </div>
            {rows ? (
                <textarea ref={inputRef as any} className={`w-full p-2 outline-none text-[13px] leading-relaxed resize-none ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as any} type="text" className={`w-full p-2 outline-none text-[13px] ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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

  // Modals & UI
  const [showBank, setShowBank] = useState(false);
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [viewingResult, setViewingResult] = useState<Result | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showPreviewPane, setShowPreviewPane] = useState(true);

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

  const renderQuestionEditor = (type: QuestionType, label: string, color: string) => (
    <div className={`mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm`}>
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
            <h3 className={`text-[11px] font-black uppercase tracking-wider ${color}`}>{label}</h3>
            <button onClick={() => {
                let q: Question = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
                if (type === 'mcq') q.options = ['', '', '', ''];
                if (type === 'group-tf') q.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' }));
                setQuestions(sortQuestionsByType([...questions, q]));
            }} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold">+ THÊM CÂU</button>
        </div>
        <div className="p-4 space-y-6">
            {questions.filter(q => q.type === type).map((q, qIdxInType) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/30 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Câu {gIdx + 1}</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Điểm:</span>
                                    <input type="text" className="w-10 bg-white border border-slate-200 rounded p-1 text-center text-xs font-bold" value={q.points} onChange={e => {
                                        const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                                <button onClick={() => { if(confirm('Xóa câu?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <RichTextEditor rows={2} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} placeholder="Nội dung câu hỏi..." />

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-2 gap-3">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                        <input type="radio" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} />
                                        <RichTextEditor className="flex-1" value={opt} onChange={v => {
                                            const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = v; n[gIdx].options = o; setQuestions(n);
                                        }} placeholder={`Đ.án ${String.fromCharCode(65+oi)}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && q.subQuestions && (
                            <div className="space-y-2">
                                {q.subQuestions.map((sq, si) => (
                                    <div key={si} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100">
                                        <span className="text-[10px] font-bold w-4">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 text-[12px] outline-none" value={sq.text} onChange={e => {
                                            const n = [...questions]; const s = [...(n[gIdx].subQuestions||[])]; s[si].text = e.target.value; n[gIdx].subQuestions = s; setQuestions(n);
                                        }} placeholder={`Nội dung ý ${String.fromCharCode(97+si)}`} />
                                        <div className="flex gap-1">
                                            {['True', 'False'].map(val => (
                                                <button key={val} onClick={() => {
                                                    const n = [...questions]; const s = [...(n[gIdx].subQuestions || [])]; s[si].correctAnswer = val as any; n[gIdx].subQuestions = s; setQuestions(n);
                                                }} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${sq.correctAnswer === val ? (val === 'True' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'text-slate-300 border'}`}>
                                                    {val === 'True' ? 'Đúng' : 'Sai'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'short' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400">ĐÁP ÁN:</span>
                                <input type="text" className="flex-1 bg-white border border-slate-200 rounded p-2 text-xs font-bold" value={q.correctAnswer} onChange={e => {
                                    const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                }} placeholder="Giá trị đáp án chính xác..." />
                            </div>
                        )}

                        <div className="bg-white p-3 rounded-lg border border-slate-100">
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Lời giải chi tiết</label>
                            <RichTextEditor rows={1} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Hướng dẫn giải..." />
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        {/* SIDEBAR CHUẨN WEB */}
        <aside className="w-[240px] bg-[#1e293b] flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-700 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-lg"><Cpu size={18}/></div>
                <h1 className="text-sm font-black text-white tracking-widest">EDUQUIZ <span className="text-blue-400">ADMIN</span></h1>
            </div>
            <nav className="flex-1 p-3 space-y-1">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ THỦ CÔNG' },
                    { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                    { id: 'import', icon: FileUp, label: 'NHẬP ĐỀ TỪ PDF' },
                    { id: 'results', icon: BarChart3, label: 'KẾT QUẢ & ĐIỂM SỐ' },
                    { id: 'students', icon: Users, label: 'DANH SÁCH HỌC SINH' }
                ].map(item => (
                    <button key={item.id} onClick={() => { if(item.id === 'create') resetForm(); setActiveMenu(item.id as any); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-bold transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-700 text-[10px] text-slate-500 text-center font-bold">V.2.8 STABLE FLASH</div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-14 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0">
                <h2 className="text-xs font-black uppercase text-slate-500">{activeMenu.replace('quizzes', 'Danh sách đề').toUpperCase()}</h2>
                <div className="flex gap-2">
                    {activeMenu === 'create' && (
                        <button onClick={() => setShowPreviewPane(!showPreviewPane)} className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 border">
                            <Eye size={14}/> {showPreviewPane ? 'ẨN XEM TRƯỚC' : 'HIỆN XEM TRƯỚC'}
                        </button>
                    )}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-0.5 flex">
                        {(['all', '10', '11', '12'] as const).map(g => (
                            <button key={g} onClick={() => setGradeFilter(g)} className={`px-4 py-1 rounded-md text-[10px] font-bold ${gradeFilter === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                {g === 'all' ? 'TẤT CẢ' : `LỚP ${g}`}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {quizzes.filter(q => gradeFilter === 'all' || q.grade === gradeFilter).map(q => (
                            <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-lg transition-all border-b-4 border-b-blue-500 group">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                        <span className="text-[9px] font-bold text-slate-300">LỚP {q.grade}</span>
                                    </div>
                                    <h3 className="text-[15px] font-bold text-slate-800 mb-1 leading-tight group-hover:text-blue-600">{q.title}</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{q.questions.length} câu • {q.durationMinutes} phút</p>
                                </div>
                                <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                                    <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all border border-slate-100">XEM ĐỀ</button>
                                    <button onClick={() => handleEdit(q)} className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all border border-slate-100"><Edit size={14}/></button>
                                    <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-100"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeMenu === 'create' && (
                    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 animate-fade-in pb-20">
                        <div className="flex-1 space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                                <input type="text" className="w-full text-xl font-bold border-none focus:ring-0 outline-none placeholder-slate-200 bg-transparent" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" placeholder="Chương / Mục" value={category} onChange={e => setCategory(e.target.value)} />
                                    <input type="number" className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                </div>
                            </div>
                            {renderQuestionEditor('mcq', 'Phần I: Trắc nghiệm 4 lựa chọn', 'text-blue-600')}
                            {renderQuestionEditor('group-tf', 'Phần II: Trắc nghiệm Đúng/Sai', 'text-purple-600')}
                            {renderQuestionEditor('short', 'Phần III: Trắc nghiệm trả lời ngắn', 'text-emerald-600')}
                        </div>
                        
                        {showPreviewPane && (
                            <div className="w-full lg:w-[400px] shrink-0">
                                <div className="sticky top-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
                                    <div className="bg-slate-900 p-4 text-white text-xs font-black uppercase tracking-widest text-center">Bản xem trước Đề thi</div>
                                    <div className="p-6 h-[70vh] overflow-y-auto space-y-8 custom-scrollbar">
                                        <div className="text-center border-b pb-4">
                                            <h4 className="font-bold text-sm uppercase">{title || 'Đề chưa đặt tên'}</h4>
                                            <p className="text-[10px] text-slate-400 uppercase mt-1">Lớp {grade} • {duration} Phút</p>
                                        </div>
                                        {questions.map((q, idx) => (
                                            <div key={q.id} className="text-[13px] border-b border-slate-50 pb-4">
                                                <div className="font-bold mb-2 text-slate-800"><span className="text-blue-600 mr-1">Câu {idx+1}.</span> <LatexText text={q.text}/></div>
                                                {q.type === 'mcq' && q.options && (
                                                    <div className="grid grid-cols-2 gap-2 pl-4 text-[12px] text-slate-500">
                                                        {q.options.map((opt, oi) => <div key={oi}>{String.fromCharCode(65+oi)}. <LatexText text={opt}/></div>)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 bg-slate-50 border-t flex flex-col gap-2">
                                        <label className="flex items-center justify-center gap-2 cursor-pointer py-2 bg-white rounded-lg border text-[10px] font-bold">
                                            <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} /> CÔNG KHAI ĐỀ THI
                                        </label>
                                        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase shadow-lg shadow-blue-100 hover:bg-blue-700">LƯU ĐỀ THI NGAY</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeMenu === 'ai' && (
                    <div className="max-w-xl mx-auto py-12 animate-fade-in bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-8 shadow-sm">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto"><Sparkles size={28}/></div>
                        <h2 className="text-xl font-bold uppercase">Soạn đề bằng AI Flash</h2>
                        <div className="space-y-4">
                            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold" placeholder="Nhập chủ đề (VD: Đạo hàm lớp 12)" value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                            <div className="grid grid-cols-3 gap-2">
                                {[{l: 'P1 (MCQ)', v: 'p1'}, {l: 'P2 (Đ/S)', v: 'p2'}, {l: 'P3 (Ngắn)', v: 'p3'}].map(item => (
                                    <div key={item.v} className="text-center">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">{item.l}</label>
                                        <input type="number" className="w-full bg-slate-50 border rounded-lg p-2 text-xs text-center font-bold" value={(aiConfig as any)[item.v]} onChange={e => setAiConfig({...aiConfig, [item.v]: parseInt(e.target.value)})} />
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAICompose} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase text-xs shadow-xl shadow-blue-100">BẮT ĐẦU SOẠN ĐỀ FLASH</button>
                        </div>
                    </div>
                )}

                {activeMenu === 'import' && (
                    <div className="max-w-xl mx-auto py-12 animate-fade-in bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-6 shadow-sm">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto"><FileUp size={28}/></div>
                        <h2 className="text-xl font-bold uppercase">Nhập đề từ file PDF</h2>
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 relative hover:bg-slate-100 transition-all group">
                            <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handlePDFImport} />
                            <Upload className="text-slate-300 group-hover:text-blue-400 mx-auto" size={40}/>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-4">Kéo thả hoặc click để chọn PDF</p>
                        </div>
                    </div>
                )}

                {activeMenu === 'results' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h2 className="text-xs font-black uppercase text-slate-800">Bảng kết quả học sinh</h2>
                            <button onClick={refreshData} className="p-2 text-slate-400 hover:text-blue-600 border rounded-lg bg-white"><Shuffle size={14}/></button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                                        <th className="px-6 py-4">Học sinh</th>
                                        <th className="px-6 py-4">Đề thi</th>
                                        <th className="px-6 py-4 text-center">Thời gian</th>
                                        <th className="px-6 py-4 text-center">Điểm</th>
                                        <th className="px-6 py-4 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold">{r.studentName}</td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-500">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề cũ'}</td>
                                            <td className="px-6 py-4 text-center text-[10px] font-bold">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                            <td className="px-6 py-4 text-center font-black text-blue-600 text-base">{r.score.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => setViewingResult(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-all"><Eye size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeMenu === 'students' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                        {users.filter(u=>u.role==='student' && (gradeFilter==='all' || u.grade===gradeFilter)).map(s => (
                            <div key={s.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center gap-3 text-center hover:shadow-md transition-all">
                                <div className="w-12 h-12 bg-slate-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">{s.fullName.charAt(0)}</div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-xs">{s.fullName}</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">LỚP {s.grade} • ID: {s.username}</p>
                                </div>
                                <button onClick={async () => { if(confirm('Xóa?')) { await deleteUser(s.id); refreshData(); } }} className="text-[9px] font-bold text-red-300 hover:text-red-500 uppercase flex items-center gap-1"><Trash2 size={12}/> Xóa TK</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>

        {/* VIEWING MODAL (PREVIEW) */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <FileText size={24}/>
                            <div><h3 className="text-sm font-bold uppercase">{viewingQuiz.title}</h3><p className="text-[9px] text-slate-400">KHỐI {viewingQuiz.grade} • {viewingQuiz.questions.length} CÂU</p></div>
                        </div>
                        <button onClick={() => setViewingQuiz(null)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 bg-slate-50 custom-scrollbar">
                        <div className="max-w-2xl mx-auto bg-white p-12 shadow-sm rounded-2xl space-y-8">
                            {viewingQuiz.questions.map((q, i) => (
                                <div key={q.id} className="text-[13px] border-b border-slate-50 pb-6 last:border-0">
                                    <div className="font-bold mb-4 text-slate-800 flex gap-2"><span className="text-blue-600 shrink-0">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                    {q.type === 'mcq' && q.options && (
                                        <div className="grid grid-cols-2 gap-4 ml-6 text-slate-500 italic">
                                            {q.options.map((opt, oi) => <div key={oi}>{String.fromCharCode(65+oi)}. <LatexText text={opt}/></div>)}
                                        </div>
                                    )}
                                    {q.solution && (
                                        <div className="mt-4 ml-6 p-4 bg-slate-50 rounded-xl text-[12px] text-slate-400 border border-slate-100">
                                            <div className="font-black text-[9px] uppercase mb-1">Lời giải:</div>
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

        {/* VIEWING RESULT (CHI TIẾT) */}
        {viewingResult && (
            <div className="fixed inset-0 bg-slate-900/80 z-[700] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="p-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <Trophy size={24}/>
                            <div><h3 className="text-sm font-bold uppercase">Chi tiết kết quả thi</h3><p className="text-[9px] text-blue-100 uppercase font-bold">{viewingResult.studentName}</p></div>
                        </div>
                        <button onClick={() => setViewingResult(null)}><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-6 custom-scrollbar">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center"><p className="text-[9px] font-bold text-slate-400 mb-1">ĐIỂM SỐ</p><p className="text-2xl font-black text-blue-600">{viewingResult.score.toFixed(2)}</p></div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center"><p className="text-[9px] font-bold text-slate-400 mb-1">THỜI GIAN</p><p className="text-xl font-black">{Math.floor(viewingResult.durationSeconds/60)}p {viewingResult.durationSeconds%60}s</p></div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-center"><p className="text-[9px] font-bold text-slate-400 mb-1">TRẠNG THÁI</p><p className="text-xs font-black text-green-600">HOÀN THÀNH</p></div>
                        </div>
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-300 italic text-xs py-10">Lịch sử quá trình làm bài chi tiết đang được đồng bộ...</div>
                    </div>
                </div>
            </div>
        )}

        {/* PROCESSING OVERLAY */}
        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-bold text-slate-800 mt-6 uppercase tracking-tight">{loadingMsg}</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 animate-pulse">Hệ thống AI Flash đang làm việc...</p>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
