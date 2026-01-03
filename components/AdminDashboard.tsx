
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
    X, BookOpen, Lightbulb, Bold, Sigma, CornerDownLeft, 
    Sparkles, Shuffle, Eye, Cpu, FileUp, Trophy, History, 
    Settings, Filter, FolderTree, FileOutput, Search, Database, 
    ChevronRight, LayoutDashboard, Users, FileText, Send, Layers
} from 'lucide-react';
import LatexText from './LatexText';

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
            {value && value.includes('$') && (
                <div className="px-2 py-1.5 bg-blue-50/20 rounded border border-blue-50 text-[12px] text-slate-600"><LatexText text={value} /></div>
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

  // Filters
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [showEditorPreview, setShowEditorPreview] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  // Chapters Setup
  const [selectedGradeCh, setSelectedGradeCh] = useState<Grade>('12');
  const [chName, setChName] = useState('');
  const [chOrder, setChOrder] = useState(1);
  const [editingChId, setEditingChId] = useState<string | null>(null);

  // AI & PDF
  const [aiTopic, setAiTopic] = useState('');
  const [aiCounts, setAiCounts] = useState({ p1: 12, p2: 4, p3: 6 });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    try {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    } catch (e) { console.error(e); }
  };

  const quizStats = (id: string) => {
    const qR = results.filter(r => r.quizId === id);
    if (qR.length === 0) return { count: 0, max: 0 };
    return { count: qR.length, max: Math.max(...qR.map(r => r.score)) };
  };

  const availableChapters = useMemo(() => {
    const tg = (activeMenu === 'create' || activeMenu === 'ai') ? grade : filterGrade;
    return chapters.filter(c => tg === 'all' || c.grade === tg).sort((a,b)=>a.order - b.order);
  }, [chapters, grade, filterGrade, activeMenu]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter(q => (filterGrade === 'all' || q.grade === filterGrade) && (filterCategory === 'all' || q.category === filterCategory));
  }, [quizzes, filterGrade, filterCategory]);

  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); 
    setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); 
    setIsPublished(q.isPublished); setActiveMenu('create');
  };

  // --- RENDER MODULES ---

  const renderQuizzes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {filteredQuizzes.map(q => {
            const stats = quizStats(q.id);
            return (
                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-xl transition-all border-b-4 border-b-blue-600 group">
                    <div>
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 mb-1 leading-tight group-hover:text-blue-600 min-h-[40px] line-clamp-2">{q.title}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{q.category || 'Chưa phân loại'}</p>
                        <div className="mt-5 grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div><p className="text-[8px] font-black text-slate-400 uppercase">Lượt làm</p><p className="text-xs font-black text-slate-700">{stats.count}</p></div>
                            <div><p className="text-[8px] font-black text-slate-400 uppercase">Điểm cao</p><p className="text-xs font-black text-blue-600">{stats.max.toFixed(2)}</p></div>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                        <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"><Eye size={14}/> XEM ĐỀ</button>
                        <button onClick={() => handleEditQuiz(q)} className="p-2.5 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                        <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                </div>
            );
        })}
    </div>
  );

  const renderChapters = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
            <h3 className="text-sm font-black uppercase mb-6 flex items-center gap-2"><FolderTree size={18} className="text-blue-600"/> Quản lý chương trình học</h3>
            <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="col-span-12 md:col-span-8 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương (Khối {selectedGradeCh})</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" value={chName} onChange={e=>setChName(e.target.value)} placeholder="VD: Chương 1: Đạo hàm..." />
                </div>
                <div className="col-span-6 md:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Thứ tự</label>
                    <input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-center outline-none" value={chOrder} onChange={e=>setChOrder(parseInt(e.target.value))} />
                </div>
                <div className="col-span-6 md:col-span-2">
                    <button onClick={async ()=>{
                        if(!chName.trim()) return;
                        const c:Chapter = { id: editingChId || uuidv4(), grade: selectedGradeCh, name: chName, order: chOrder };
                        if(editingChId) await updateChapter(c); else await saveChapter(c);
                        setChName(''); setEditingChId(null); await refreshData();
                    }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg">LƯU</button>
                </div>
            </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b flex gap-1">
                {(['10','11','12'] as const).map(g=>(<button key={g} onClick={()=>setSelectedGradeCh(g)} className={`px-5 py-2 rounded-lg text-[10px] font-black ${selectedGradeCh===g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white'}`}>KHỐI {g}</button>))}
            </div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                {chapters.filter(c=>c.grade===selectedGradeCh).sort((a,b)=>a.order-b.order).map(c=>(
                    <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600">{c.order}</div>
                            <span className="text-[13px] font-bold text-slate-700">{c.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={()=>{setEditingChId(c.id); setChName(c.name); setChOrder(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                            <button onClick={async()=>{if(confirm('Xóa?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-6xl mx-auto pb-32 animate-fade-in flex flex-col lg:flex-row gap-6">
        {/* VÙNG SOẠN THẢO */}
        <div className="flex-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 md:col-span-6 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề đề thi</label>
                        <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none focus:ring-1 focus:ring-blue-500" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại đề</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}>
                            <option value="practice">Luyện tập</option><option value="test">Kiểm tra</option>
                        </select>
                    </div>
                    <div className="col-span-6 md:col-span-3 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời gian (Phút)</label>
                        <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                    </div>
                    <div className="col-span-6 md:col-span-4 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khối lớp</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                            <option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
                        </select>
                    </div>
                    <div className="col-span-6 md:col-span-8 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chương học</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">Chọn chương...</option>
                            {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'mcq', text: '', points: '0.25', options: ['', '', '', ''], correctAnswer: '' }])} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">+ Trắc nghiệm (P1)</button>
                <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'group-tf', text: '', points: '1.0', subQuestions: [{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'}] }])} className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">+ Đúng sai (P2)</button>
                <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'short', text: '', points: '0.5', correctAnswer: '' }])} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-[10px] font-black uppercase">+ Trả lời ngắn (P3)</button>
                <button onClick={() => setShowBankModal(true)} className="px-5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><Database size={16}/> Ngân hàng</button>
            </div>

            <div className="space-y-4">
                {questions.map((q, idx) => (
                    <div key={q.id} className="p-6 bg-white rounded-3xl border border-slate-200 relative group transition-all">
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-full bg-slate-100 group-hover:bg-blue-600 transition-colors"></div>
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">Câu {idx+1} • {q.type}</span>
                            <button onClick={()=>{const n=[...questions]; n.splice(idx,1); setQuestions(n);}} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                        <RichTextEditor value={q.text} onChange={v=>{const n=[...questions]; n[idx].text=v; setQuestions(n);}} placeholder="Nội dung câu hỏi..." />
                        
                        {q.type === 'mcq' && (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                {q.options?.map((opt, oi)=>(
                                    <div key={oi} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <input type="radio" name={`q-${q.id}`} checked={q.correctAnswer===opt && opt!==''} onChange={()=> {const n=[...questions]; n[idx].correctAnswer=opt; setQuestions(n);}} />
                                        <input type="text" className="flex-1 bg-transparent text-xs font-bold outline-none" value={opt} onChange={e=>{const n=[...questions]; n[idx].options![oi]=e.target.value; setQuestions(n);}} placeholder={`Đáp án ${String.fromCharCode(65+oi)}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {q.type === 'group-tf' && (
                            <div className="space-y-2 mt-4">
                                {q.subQuestions?.map((sq, si)=>(
                                    <div key={si} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 bg-transparent text-xs outline-none" value={sq.text} onChange={e=>{const n=[...questions]; n[idx].subQuestions![si].text=e.target.value; setQuestions(n);}} placeholder="Nhập ý phát biểu..." />
                                        <select className="text-[9px] font-black p-1 rounded bg-white border outline-none" value={sq.correctAnswer} onChange={e=>{const n=[...questions]; n[idx].subQuestions![si].correctAnswer=e.target.value as any; setQuestions(n);}}><option value="True">ĐÚNG</option><option value="False">SAI</option></select>
                                    </div>
                                ))}
                            </div>
                        )}

                        {q.type === 'short' && (
                            <div className="mt-4"><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs font-black outline-none focus:ring-1 focus:ring-blue-500" value={q.correctAnswer || ''} onChange={e=>{const n=[...questions]; n[idx].correctAnswer=e.target.value; setQuestions(n);}} placeholder="Đáp số đúng..." /></div>
                        )}

                        <div className="mt-4 border-t border-slate-50 pt-4">
                            <RichTextEditor value={q.solution || ''} onChange={v=>{const n=[...questions]; n[idx].solution=v; setQuestions(n);}} label="Lời giải chi tiết" placeholder="Nhập lời giải để học sinh xem sau khi thi..." rows={3} />
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* VÙNG PREVIEW TRỰC TIẾP */}
        <div className="w-[400px] shrink-0 hidden xl:block">
            <div className="sticky top-6 bg-slate-900 rounded-[2.5rem] p-8 text-white min-h-[600px] shadow-2xl overflow-hidden border-8 border-slate-800">
                <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                    <h4 className="text-xs font-black uppercase text-blue-400">Preview Đề Thi</h4>
                    <span className="text-[10px] font-bold opacity-50">{questions.length} câu</span>
                </div>
                <div className="space-y-10 overflow-y-auto max-h-[80vh] custom-scrollbar pr-2">
                    {questions.length === 0 ? <div className="text-center py-20 opacity-20 italic">Chưa có câu hỏi nào...</div> : questions.map((q, i) => (
                        <div key={q.id} className="text-[13px]">
                            <p className="font-bold mb-3"><span className="text-blue-400 mr-2">Câu {i+1}.</span><LatexText text={q.text || 'Nội dung...'} /></p>
                            {q.type === 'mcq' && (
                                <div className="grid grid-cols-2 gap-2 opacity-60">
                                    {q.options?.map((o, oi) => <div key={oi} className="flex gap-1"><strong>{String.fromCharCode(65+oi)}.</strong><LatexText text={o || '...'}/></div>)}
                                </div>
                            )}
                            {q.type === 'group-tf' && (
                                <div className="space-y-1 opacity-60 pl-4 border-l border-slate-700">
                                    {q.subQuestions?.map((sq, si) => <div key={si} className="flex gap-1"><strong>{String.fromCharCode(97+si)})</strong><LatexText text={sq.text || '...'}/></div>)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="fixed bottom-8 left-[300px] right-8 flex justify-end pointer-events-none z-50">
            <div className="pointer-events-auto flex items-center gap-3 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-2xl border border-slate-100">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-all"><input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /> CÔNG KHAI</label>
                <button onClick={async () => {
                    if (!title.trim()) return alert("Nhập tên đề!");
                    const qD: Quiz = { id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished };
                    try { if (editingId) await updateQuiz(qD); else await saveQuiz(qD); alert("Lưu thành công!"); refreshData(); setActiveMenu('quizzes'); } catch(e:any) { alert(e.message); }
                }} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2 hover:scale-105 transition-all"><Save size={18}/> LƯU ĐỀ THI</button>
            </div>
        </div>
    </div>
  );

  const renderAI = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 text-blue-50 opacity-10 pointer-events-none"><Sparkles size={160}/></div>
            <div className="flex items-center gap-6 mb-10">
                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200"><Sparkles size={32}/></div>
                <div><h3 className="text-xl font-black uppercase tracking-tight">Trợ lý AI Soạn Đề</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cấu trúc chuẩn theo chương trình 2024</p></div>
            </div>
            <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold" value={grade} onChange={e=>setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Chọn chương học...</option>{availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Mô tả chủ đề chi tiết</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-medium h-48 focus:ring-2 focus:ring-blue-100 transition-all outline-none" placeholder="Nhập nội dung AI cần soạn, VD: 'Hàm số bậc ba và cực trị hàm số, bao gồm cả bài toán thực tế'..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl grid grid-cols-3 gap-6">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Trắc nghiệm</label><input type="number" className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p1} onChange={e=>setAiCounts({...aiCounts, p1: parseInt(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Đúng Sai</label><input type="number" className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p2} onChange={e=>setAiCounts({...aiCounts, p2: parseInt(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Trả lời ngắn</label><input type="number" className="w-full bg-white border border-slate-100 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p3} onChange={e=>setAiCounts({...aiCounts, p3: parseInt(e.target.value)})} /></div>
                </div>
                <button onClick={async () => {
                    if(!aiTopic) return alert("Nhập chủ đề!"); setIsProcessing(true); setLoadingMsg("AI đang soạn đề thi mới...");
                    try { const qs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiCounts.p1, part2Count: aiCounts.p2, part3Count: aiCounts.p3 }); setQuestions(qs); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create'); } catch(e) { alert("Lỗi AI"); } finally { setIsProcessing(false); }
                }} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-sm uppercase shadow-2xl shadow-blue-100 hover:scale-[1.02] transition-all">BẮT ĐẦU SOẠN ĐỀ VỚI AI</button>
            </div>
        </div>
    </div>
  );

  const renderImport = () => (
    <div className="max-w-4xl mx-auto animate-fade-in text-center">
        <div className="bg-white p-16 rounded-[3rem] border-4 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-8"><FileUp size={40}/></div>
            <h3 className="text-xl font-black uppercase mb-4">Nhập đề từ file PDF</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto mb-10">AI sẽ tự động nhận diện cấu trúc đề thi 3 phần và chuyển đổi sang dữ liệu hệ thống.</p>
            <input type="file" id="pdf-upload" hidden accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            <label htmlFor="pdf-upload" className="inline-flex items-center gap-3 px-12 py-4 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-900 transition-all">{pdfFile ? pdfFile.name : 'CHỌN FILE PDF'}</label>
            {pdfFile && (
                <button onClick={async () => {
                    setIsProcessing(true); setLoadingMsg("AI đang đọc và phân tích PDF...");
                    const reader = new FileReader(); reader.readAsDataURL(pdfFile);
                    reader.onload = async () => {
                        try { const base64 = (reader.result as string).split(',')[1]; const qs = await parseQuestionsFromPDF(base64); setQuestions(qs); setTitle(`Đề từ PDF: ${pdfFile.name}`); setActiveMenu('create'); } catch(e) { alert("Lỗi đọc PDF"); } finally { setIsProcessing(false); }
                    };
                }} className="block mx-auto mt-6 text-blue-600 font-black text-[10px] uppercase underline">Bắt đầu phân tích</button>
            )}
        </div>
    </div>
  );

  const renderResults = () => (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-black uppercase flex items-center gap-2"><Trophy size={18} className="text-orange-500"/> Nhật ký thi & Kết quả</h3>
            <button onClick={refreshData} className="p-2 border rounded-xl hover:bg-slate-50 transition-all"><Shuffle size={14}/></button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase"><tr className="border-b border-slate-100"><th className="px-6 py-4">Thời gian</th><th className="px-6 py-4">Thí sinh</th><th className="px-6 py-4">Đề thi</th><th className="px-6 py-4">Điểm</th><th className="px-6 py-4">Thời gian làm</th><th className="px-6 py-4">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                    {results.sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-400">{new Date(r.submittedAt).toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold">{r.studentName}</td>
                            <td className="px-6 py-4">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td>
                            <td className="px-6 py-4 font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td>
                            <td className="px-6 py-4 text-slate-400">{Math.floor(r.durationSeconds / 60)} phút {r.durationSeconds % 60}s</td>
                            <td className="px-6 py-4"><button onClick={async () => { if(confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderStudents = () => (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-black uppercase flex items-center gap-2"><Users size={18} className="text-blue-600"/> Quản lý Học sinh</h3>
            <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 uppercase">{users.filter(u=>u.role==='student').length} thành viên</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase"><tr className="border-b border-slate-100"><th className="px-6 py-4">Họ và tên</th><th className="px-6 py-4">Tên đăng nhập</th><th className="px-6 py-4">Lớp</th><th className="px-6 py-4">Mật khẩu</th><th className="px-6 py-4">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                    {users.filter(u=>u.role==='student').map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-800">{u.fullName}</td>
                            <td className="px-6 py-4 font-mono text-blue-600">{u.username}</td>
                            <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-0.5 rounded font-black">Khối {u.grade}</span></td>
                            <td className="px-6 py-4 font-mono text-slate-300">{u.password}</td>
                            <td className="px-6 py-4"><button onClick={async () => { if(confirm(`Xóa học sinh ${u.fullName}?`)) { await deleteUser(u.id); refreshData(); } }} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print z-50">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-lg shadow-blue-900/50"><Cpu size={18}/></div>
                <h1 className="text-sm font-black text-white uppercase tracking-widest">EDUQUIZ <span className="text-blue-400">PRO</span></h1>
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
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0 no-print z-40">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    {activeMenu === 'quizzes' && (
                        <div className="flex items-center gap-2 mr-4">
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black outline-none cursor-pointer" value={filterGrade} onChange={e=>setFilterGrade(e.target.value as any)}><option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option></select>
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black outline-none cursor-pointer" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="all">TẤT CẢ CHƯƠNG</option>{chapters.filter(c => filterGrade === 'all' || c.grade === filterGrade).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                        </div>
                    )}
                    <button onClick={refreshData} className="p-2 border rounded-xl hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"><Shuffle size={14}/></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#f8fafc]">
                {activeMenu === 'quizzes' && renderQuizzes()}
                {activeMenu === 'chapters' && renderChapters()}
                {activeMenu === 'create' && renderCreateQuiz()}
                {activeMenu === 'ai' && renderAI()}
                {activeMenu === 'import' && renderImport()}
                {activeMenu === 'results' && renderResults()}
                {activeMenu === 'students' && renderStudents()}
            </div>
        </main>

        {/* MODAL NGÂN HÀNG CÂU HỎI */}
        {showBankModal && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3"><Database size={20} className="text-blue-400"/><h3 className="font-black uppercase text-sm">Lấy câu hỏi từ ngân hàng</h3></div>
                        <button onClick={() => setShowBankModal(false)} className="p-2 hover:bg-slate-800 rounded-xl"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
                        {quizzes.length === 0 ? <p className="text-center text-slate-400 py-10 font-bold uppercase text-[10px]">Chưa có đề thi nào để lấy câu hỏi</p> : quizzes.map(q => (
                            <div key={q.id} className="mb-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 border-b pb-1">{q.title}</h4>
                                <div className="space-y-2">
                                    {q.questions.map((qItem, qiIdx) => (
                                        <div key={qItem.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-start group hover:border-blue-400 transition-all">
                                            <div className="flex-1 text-[12px]"><span className="font-black text-blue-600 mr-2">{qiIdx+1}.</span><LatexText text={qItem.text}/></div>
                                            <button onClick={() => { setQuestions([...questions, { ...qItem, id: uuidv4() }]); setShowBankModal(false); }} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">+ CHỌN</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* MODAL XEM ĐỀ */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase line-clamp-1">{viewingQuiz.title}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu • {viewingQuiz.durationMinutes} phút</p>
                            </div>
                        </div>
                        <button onClick={() => setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar">
                        <div className="max-w-3xl mx-auto space-y-12">
                            {/* PHẦN I */}
                            {viewingQuiz.questions.filter(q=>q.type==='mcq').length > 0 && (
                                <section><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-blue-600 pl-3">PHẦN I. Câu trắc nghiệm nhiều phương án.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='mcq').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-blue-600">Câu {i+1}.</span><LatexText text={q.text}/></div><div className={`mt-3 grid gap-x-4 gap-y-2 ${q.options?.some(o=>o.length > 30) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>{q.options?.map((opt, oi) => (<div key={oi} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/></div>))}</div></div>))}</div></section>
                            )}
                            {/* PHẦN II */}
                            {viewingQuiz.questions.filter(q=>q.type==='group-tf').length > 0 && (
                                <section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-purple-600 pl-3">PHẦN II. Câu trắc nghiệm đúng sai.</h4><div className="space-y-10">{viewingQuiz.questions.filter(q=>q.type==='group-tf').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-purple-600">Câu {i+1}.</span><LatexText text={q.text}/></div><div className="mt-4 space-y-2 pl-8">{q.subQuestions?.map((sq, si) => (<div key={si} className="flex gap-3 items-start border-l-2 border-slate-100 pl-4 py-1"><span className="font-bold text-slate-400">{String.fromCharCode(97+si)})</span><LatexText text={sq.text}/></div>))}</div></div>))}</div></section>
                            )}
                            {/* PHẦN III */}
                            {viewingQuiz.questions.filter(q=>q.type==='short').length > 0 && (
                                <section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-emerald-600 pl-3">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='short').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-emerald-600">Câu {i+1}.</span><LatexText text={q.text}/></div><div className="mt-3 pl-8 text-slate-400 italic">Đáp số: .................................................</div></div>))}</div></section>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 uppercase tracking-widest">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
