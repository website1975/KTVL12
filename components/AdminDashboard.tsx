
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
    ChevronRight, LayoutDashboard, Users, FileText, Send, Layers,
    Image as ImageIcon, CheckCircle2, AlertCircle
} from 'lucide-react';
import LatexText from './LatexText';

// --- RICH TEXT EDITOR ---
interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; label?: string; showPreview?: boolean; }
const RichTextEditor = ({ value, onChange, placeholder, rows, className, label, showPreview = true }: RichTextEditorProps) => {
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
        <div className="flex flex-col gap-1 mb-4">
            {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{label}</label>}
            <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <div className="flex items-center gap-0.5 p-1.5 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 hover:bg-white rounded text-slate-500 transition-colors"><Bold size={12}/></button>
                    <button type="button" onClick={() => insertTag('$', '$')} className="p-1.5 hover:bg-white rounded text-blue-600 transition-colors" title="Toán LaTeX"><Sigma size={12}/></button>
                    <button type="button" onClick={() => insertTag('<br/>')} className="p-1.5 hover:bg-white rounded text-slate-500 transition-colors"><CornerDownLeft size={12}/></button>
                </div>
                <textarea 
                    ref={inputRef as any} 
                    className={`w-full p-4 outline-none text-[14px] leading-relaxed resize-none bg-white ${className}`} 
                    rows={rows || 3} 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)} 
                    placeholder={placeholder} 
                />
            </div>
            {showPreview && value && (
                <div className="mt-2 p-4 bg-blue-50/30 rounded-xl border border-blue-100/50 text-[14px] text-slate-700 shadow-sm animate-fade-in">
                    <div className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest opacity-70">Xem trước hiển thị:</div>
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

  // Filters for Main Quiz View
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filters for Results
  const [resGrade, setResGrade] = useState<Grade | 'all'>('all');
  const [resChapter, setResChapter] = useState<string>('all');
  const [resQuizId, setResQuizId] = useState<string>('all');

  // Filters for Students
  const [stdGrade, setStdGrade] = useState<Grade | 'all'>('all');

  // Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetPart, setBankTargetPart] = useState<QuestionType | null>(null);

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

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const q = quizzes.find(qz => qz.id === r.quizId);
      if (resGrade !== 'all' && q?.grade !== resGrade) return false;
      if (resChapter !== 'all' && q?.category !== resChapter) return false;
      if (resQuizId !== 'all' && r.quizId !== resQuizId) return false;
      return true;
    }).sort((a,b)=>new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime());
  }, [results, resGrade, resChapter, resQuizId, quizzes]);

  const filteredStudents = useMemo(() => {
    return users.filter(u => u.role === 'student' && (stdGrade === 'all' || u.grade === stdGrade));
  }, [users, stdGrade]);

  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); 
    setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); 
    setIsPublished(q.isPublished); setActiveMenu('create');
  };

  const addQuestion = (type: QuestionType) => {
      const base: any = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
      if (type === 'mcq') { base.options = ['', '', '', '']; base.correctAnswer = ''; }
      else if (type === 'group-tf') { base.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' })); }
      else { base.correctAnswer = ''; }
      setQuestions([...questions, base]);
  };

  const handleImageUpload = (qIdx: number) => {
      const url = prompt("Dán URL hình ảnh minh họa (hoặc link ảnh từ Google Drive/Dropbox):");
      if (url) {
          const n = [...questions];
          n[qIdx].imageUrl = url;
          setQuestions(n);
      }
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
                        <button onClick={() => handleEditQuiz(q)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-all"><Edit size={16}/></button>
                        <button onClick={async () => { if(confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                    </div>
                </div>
            );
        })}
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-5xl mx-auto pb-48 animate-fade-in space-y-8">
        {/* THÔNG TIN CHUNG */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm border-b-4 border-b-slate-100">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><Settings size={14}/> Thiết lập thông tin đề thi</h3>
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Tiêu đề đề thi</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nhập tên đề thi..." />
                </div>
                <div className="col-span-6 md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Loại đề</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black outline-none cursor-pointer" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}>
                        <option value="practice">Luyện tập</option><option value="test">Kiểm tra</option>
                    </select>
                </div>
                <div className="col-span-6 md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Thời gian (Phút)</label>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                </div>
                <div className="col-span-6 md:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Khối lớp</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black outline-none cursor-pointer" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                        <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                    </select>
                </div>
                <div className="col-span-6 md:col-span-9 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Chương học</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-black outline-none cursor-pointer" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">Chọn chương...</option>
                        {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
            </div>
        </div>

        {/* NỘI DUNG CÂU HỎI THEO PHẦN */}
        {[
            { type: 'mcq' as QuestionType, title: 'Phần I: Câu trắc nghiệm nhiều phương án', color: 'blue' },
            { type: 'group-tf' as QuestionType, title: 'Phần II: Câu trắc nghiệm đúng sai', color: 'purple' },
            { type: 'short' as QuestionType, title: 'Phần III: Câu trắc nghiệm trả lời ngắn', color: 'emerald' }
        ].map(section => (
            <div key={section.type} className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h4 className={`text-sm font-black uppercase text-${section.color}-600 tracking-tight flex items-center gap-2`}>
                        <Layers size={18}/> {section.title}
                    </h4>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setBankTargetPart(section.type); setShowBankModal(true); }}
                            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg"
                        >
                            <Database size={14}/> Lấy từ ngân hàng
                        </button>
                        <button 
                            onClick={() => addQuestion(section.type)}
                            className={`bg-${section.color}-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg`}
                        >
                            <Plus size={14}/> Thêm câu mới
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    {questions.map((q, qIdx) => q.type === section.type && (
                        <div key={q.id} className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm relative group hover:shadow-md transition-all">
                            <button 
                                onClick={() => { const n = [...questions]; n.splice(qIdx, 1); setQuestions(n); }}
                                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            >
                                <Trash2 size={18}/>
                            </button>
                            
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`w-10 h-10 rounded-2xl bg-${section.color}-50 text-${section.color}-600 flex items-center justify-center font-black text-sm`}>{questions.filter(qu=>qu.type===section.type).indexOf(q) + 1}</span>
                                <div className="h-px flex-1 bg-slate-100"></div>
                            </div>

                            {/* CÂU HỎI */}
                            <RichTextEditor 
                                label="Nội dung câu hỏi" 
                                value={q.text} 
                                onChange={v => { const n = [...questions]; n[qIdx].text = v; setQuestions(n); }} 
                                placeholder="Nhập câu hỏi (hỗ trợ LaTeX $...$)"
                            />

                            {/* HÌNH ẢNH */}
                            <div className="mb-6">
                                <button 
                                    onClick={() => handleImageUpload(qIdx)}
                                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"
                                >
                                    <ImageIcon size={14}/> {q.imageUrl ? 'Thay đổi hình ảnh' : 'Thêm hình ảnh minh họa'}
                                </button>
                                {q.imageUrl && (
                                    <div className="mt-3 relative inline-block group/img">
                                        <img src={q.imageUrl} className="max-h-48 rounded-xl border-2 border-slate-100 bg-white" alt="Minh họa" />
                                        <button onClick={() => { const n=[...questions]; n[qIdx].imageUrl=undefined; setQuestions(n); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover/img:opacity-100 transition-all"><X size={12}/></button>
                                    </div>
                                )}
                            </div>

                            {/* LỰA CHỌN PHẢN HỒI THEO LOẠI */}
                            {q.type === 'mcq' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {q.options?.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                            <input 
                                                type="radio" 
                                                name={`correct-${q.id}`} 
                                                checked={q.correctAnswer === opt && opt !== ''} 
                                                onChange={() => { const n = [...questions]; n[qIdx].correctAnswer = opt; setQuestions(n); }}
                                                className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500"
                                            />
                                            <span className="text-xs font-black text-slate-400">{String.fromCharCode(65+oIdx)}.</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 bg-transparent border-none text-sm font-bold outline-none placeholder:text-slate-300"
                                                value={opt}
                                                onChange={e => { const n = [...questions]; n[qIdx].options![oIdx] = e.target.value; setQuestions(n); }}
                                                placeholder={`Phương án ${String.fromCharCode(65+oIdx)}...`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'group-tf' && (
                                <div className="space-y-3 mb-8">
                                    {q.subQuestions?.map((sq, sIdx) => (
                                        <div key={sq.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group/sq transition-all hover:bg-white hover:border-blue-100">
                                            <span className="text-xs font-black text-slate-400">{String.fromCharCode(97+sIdx)})</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 bg-transparent border-none text-sm font-medium outline-none"
                                                value={sq.text}
                                                onChange={e => { const n = [...questions]; n[qIdx].subQuestions![sIdx].text = e.target.value; setQuestions(n); }}
                                                placeholder="Ý phát biểu đúng/sai..."
                                            />
                                            <select 
                                                className="text-[10px] font-black p-2 rounded-xl bg-white border border-slate-200 outline-none cursor-pointer"
                                                value={sq.correctAnswer}
                                                onChange={e => { const n = [...questions]; n[qIdx].subQuestions![sIdx].correctAnswer = e.target.value as any; setQuestions(n); }}
                                            >
                                                <option value="True">ĐÚNG</option><option value="False">SAI</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'short' && (
                                <div className="mb-8">
                                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">ĐÁP SỐ ĐÚNG:</span>
                                        <input 
                                            type="text" 
                                            className="flex-1 bg-transparent border-none text-sm font-black outline-none text-emerald-700"
                                            value={q.correctAnswer}
                                            onChange={e => { const n = [...questions]; n[qIdx].correctAnswer = e.target.value; setQuestions(n); }}
                                            placeholder="Kết quả cuối cùng..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* LỜI GIẢI CHI TIẾT */}
                            <div className="pt-6 border-t border-slate-50">
                                <RichTextEditor 
                                    label="Lời giải chi tiết" 
                                    value={q.solution || ''} 
                                    onChange={v => { const n = [...questions]; n[qIdx].solution = v; setQuestions(n); }} 
                                    placeholder="Nhập hướng dẫn giải để học sinh ôn tập..." 
                                    rows={4}
                                />
                            </div>
                        </div>
                    ))}
                    {questions.filter(q=>q.type===section.type).length === 0 && (
                        <div className="py-10 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                            <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Chưa có câu hỏi nào trong phần này</p>
                        </div>
                    )}
                </div>
            </div>
        ))}

        <div className="fixed bottom-8 left-[280px] right-8 flex justify-end pointer-events-none z-[60]">
            <div className="pointer-events-auto flex items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-[2rem] shadow-2xl border border-slate-200">
                <label className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-all">
                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500" /> CÔNG KHAI ĐỀ THI
                </label>
                <button 
                    onClick={async () => {
                        if (!title.trim()) return alert("Vui lòng nhập tiêu đề đề thi!");
                        setIsProcessing(true); setLoadingMsg("Đang lưu đề thi...");
                        const quizData: Quiz = {
                          id: editingId || uuidv4(), title, description: '', category: category.trim(), 
                          type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), 
                          isPublished
                        };
                        try {
                            if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
                            alert("Đã lưu đề thi thành công!"); await refreshData(); setActiveMenu('quizzes');
                        } catch(err: any) { alert(err.message); } finally { setIsProcessing(false); }
                    }} 
                    className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-200 flex items-center gap-2 hover:scale-[1.03] transition-all active:scale-95"
                >
                    <Save size={20}/> Lưu & Xuất bản
                </button>
            </div>
        </div>
    </div>
  );

  const renderResults = () => (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-8 border-b border-slate-100 space-y-6 bg-slate-50/50">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase flex items-center gap-2"><Trophy size={20} className="text-orange-500"/> Bảng điểm & Kết quả học tập</h3>
                <div className="flex gap-2">
                    <button onClick={refreshData} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"><Shuffle size={16}/></button>
                </div>
            </div>

            {/* BỘ LỌC KẾT QUẢ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Khối lớp</label>
                    <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" value={resGrade} onChange={e=>setResGrade(e.target.value as any)}>
                        <option value="all">Tất cả Khối</option><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Chương học</label>
                    <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" value={resChapter} onChange={e=>setResChapter(e.target.value)}>
                        <option value="all">Tất cả Chương</option>
                        {chapters.map(c => <option key={c.id} value={c.name}>{c.name} (L{c.grade})</option>)}
                    </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Tên đề thi</label>
                    <select className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" value={resQuizId} onChange={e=>setResQuizId(e.target.value)}>
                        <option value="all">Tất cả Đề thi</option>
                        {quizzes.filter(q => (resGrade==='all'||q.grade===resGrade) && (resChapter==='all'||q.category===resChapter)).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase"><tr className="border-b border-slate-100"><th className="px-8 py-5">Thời gian nộp</th><th className="px-8 py-5">Thí sinh</th><th className="px-8 py-5">Đề thi</th><th className="px-8 py-5">Điểm số</th><th className="px-8 py-5">Thời gian làm</th><th className="px-8 py-5">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredResults.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5 text-slate-400">{new Date(r.submittedAt).toLocaleString('vi-VN')}</td>
                            <td className="px-8 py-5">
                                <div className="font-bold text-slate-800">{r.studentName}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-black">Lớp {users.find(u=>u.id===r.studentId)?.grade}</div>
                            </td>
                            <td className="px-8 py-5">
                                <div className="font-medium max-w-[200px] truncate">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</div>
                                <div className="text-[9px] text-slate-400 uppercase font-bold">{quizzes.find(q=>q.id===r.quizId)?.category}</div>
                            </td>
                            <td className="px-8 py-5">
                                <span className={`font-black text-base ${r.score >= 8 ? 'text-green-600' : (r.score >= 5 ? 'text-blue-600' : 'text-red-500')}`}>{r.score.toFixed(2)}</span>
                            </td>
                            <td className="px-8 py-5 text-slate-500 font-medium">{Math.floor(r.durationSeconds / 60)}p {r.durationSeconds % 60}s</td>
                            <td className="px-8 py-5"><button onClick={async () => { if(confirm('Bạn có chắc chắn muốn xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button></td>
                        </tr>
                    ))}
                    {filteredResults.length === 0 && (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Không có dữ liệu kết quả phù hợp</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderStudents = () => (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Users size={24}/></div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Danh sách Học sinh</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hệ thống có {filteredStudents.length} học sinh</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <label className="text-[9px] font-black text-slate-400 uppercase">Lọc theo khối:</label>
                <div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1">
                    {(['all', '10', '11', '12'] as const).map(g => (
                        <button 
                            key={g} 
                            onClick={() => setStdGrade(g)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${stdGrade === g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase"><tr className="border-b border-slate-100"><th className="px-8 py-5">Họ và tên học sinh</th><th className="px-8 py-5">Tên đăng nhập</th><th className="px-8 py-5">Khối lớp</th><th className="px-8 py-5">Mật khẩu</th><th className="px-8 py-5">Hoạt động</th><th className="px-8 py-5">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredStudents.map(u => {
                        const sR = results.filter(r => r.studentId === u.id);
                        return (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-5 font-bold text-slate-800">{u.fullName}</td>
                                <td className="px-8 py-5 font-mono text-blue-600">{u.username}</td>
                                <td className="px-8 py-5"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-black text-[10px] uppercase">Khối {u.grade}</span></td>
                                <td className="px-8 py-5 font-mono text-slate-300">{u.password}</td>
                                <td className="px-8 py-5">
                                    <div className="text-[10px] font-black text-slate-400 uppercase">Đã làm {sR.length} đề thi</div>
                                    <div className="text-xs font-bold text-slate-700">TB: {(sR.reduce((a,b)=>a+b.score,0)/(sR.length||1)).toFixed(1)}</div>
                                </td>
                                <td className="px-8 py-5"><button onClick={async () => { if(confirm(`Xóa học sinh ${u.fullName}? Mọi kết quả thi liên quan cũng sẽ bị ảnh hưởng.`)) { await deleteUser(u.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button></td>
                            </tr>
                        );
                    })}
                    {filteredStudents.length === 0 && (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Chưa có tài khoản học sinh nào đăng ký</td></tr>
                    )}
                </tbody>
            </table>
        </div>
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
                    <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                            <span className="text-[13px] font-bold text-slate-700">{c.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={()=>{setEditingChId(c.id); setChName(c.name); setChOrder(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                            <button onClick={async()=>{if(confirm('Xóa chương học này?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
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
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" value={grade} onChange={e=>setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Chọn chương học...</option>{availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Mô tả chủ đề chi tiết</label>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-medium h-48 focus:ring-2 focus:ring-blue-100 transition-all outline-none" placeholder="Nhập nội dung AI cần soạn, VD: 'Hàm số bậc ba và cực trị hàm số, bao gồm cả bài toán thực tế'..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl grid grid-cols-3 gap-6 border border-slate-100">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Trắc nghiệm</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p1} onChange={e=>setAiCounts({...aiCounts, p1: parseInt(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Đúng Sai</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p2} onChange={e=>setAiCounts({...aiCounts, p2: parseInt(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase">Trả lời ngắn</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center" value={aiCounts.p3} onChange={e=>setAiCounts({...aiCounts, p3: parseInt(e.target.value)})} /></div>
                </div>
                <button onClick={async () => {
                    if(!aiTopic) return alert("Nhập chủ đề!"); setIsProcessing(true); setLoadingMsg("AI đang soạn đề thi mới...");
                    try { const qs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiCounts.p1, part2Count: aiCounts.p2, part3Count: aiCounts.p3 }); setQuestions(qs); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create'); } catch(e) { alert("Lỗi AI: Vui lòng thử lại với chủ đề rõ ràng hơn."); } finally { setIsProcessing(false); }
                }} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-sm uppercase shadow-2xl shadow-blue-100 hover:scale-[1.02] transition-all active:scale-95">BẮT ĐẦU SOẠN ĐỀ VỚI AI</button>
            </div>
        </div>
    </div>
  );

  const renderImport = () => (
    <div className="max-w-4xl mx-auto animate-fade-in text-center">
        <div className="bg-white p-16 rounded-[3rem] border-4 border-dashed border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><FileUp size={40}/></div>
            <h3 className="text-xl font-black uppercase mb-4 text-slate-800">Nhập đề từ file PDF</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto mb-10 leading-relaxed">AI sẽ tự động nhận diện cấu trúc đề thi 3 phần và chuyển đổi sang dữ liệu hệ thống (Hỗ trợ định dạng PDF chuẩn).</p>
            <input type="file" id="pdf-upload" hidden accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            <label htmlFor="pdf-upload" className="inline-flex items-center gap-3 px-12 py-4 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-900 transition-all shadow-xl active:scale-95">{pdfFile ? pdfFile.name : 'CHỌN FILE PDF TỪ MÁY TÍNH'}</label>
            {pdfFile && (
                <button onClick={async () => {
                    setIsProcessing(true); setLoadingMsg("AI đang đọc và phân tích PDF...");
                    const reader = new FileReader(); reader.readAsDataURL(pdfFile);
                    reader.onload = async () => {
                        try { const base64 = (reader.result as string).split(',')[1]; const qs = await parseQuestionsFromPDF(base64); setQuestions(qs); setTitle(`Đề từ PDF: ${pdfFile.name}`); setActiveMenu('create'); } catch(e) { alert("Lỗi đọc PDF hoặc cấu trúc file không phù hợp."); } finally { setIsProcessing(false); }
                    };
                }} className="block mx-auto mt-8 text-blue-600 font-black text-[10px] uppercase underline underline-offset-4 tracking-widest hover:text-blue-700">Bắt đầu phân tích dữ liệu</button>
            )}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print z-[70] shadow-2xl">
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

        {/* MODAL NGÂN HÀNG CÂU HỎI THEO PHẦN */}
        {showBankModal && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Database size={20} className="text-blue-400"/>
                            <div>
                                <h3 className="font-black uppercase text-sm leading-none mb-1">Ngân hàng câu hỏi</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang lọc phần: {bankTargetPart === 'mcq' ? 'Trắc nghiệm (P1)' : (bankTargetPart === 'group-tf' ? 'Đúng Sai (P2)' : 'Trả lời ngắn (P3)')}</p>
                            </div>
                        </div>
                        <button onClick={() => { setShowBankModal(false); setBankTargetPart(null); }} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-all"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
                        {quizzes.length === 0 ? <p className="text-center text-slate-400 py-10 font-bold uppercase text-[10px]">Chưa có đề thi nào có sẵn</p> : quizzes.map(q => {
                            const filteredBankQs = q.questions.filter(qi => qi.type === bankTargetPart);
                            if (filteredBankQs.length === 0) return null;
                            return (
                                <div key={q.id} className="mb-10">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 border-b border-slate-200 pb-2 flex justify-between items-center">
                                        <span>{q.title}</span>
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-bold tracking-tight">Lớp {q.grade}</span>
                                    </h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        {filteredBankQs.map((qItem, qiIdx) => (
                                            <div key={qItem.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-start group hover:border-blue-400 hover:shadow-lg transition-all">
                                                <div className="flex-1 text-[13px] leading-relaxed">
                                                    <div className="font-bold flex gap-2 mb-2"><span className="text-blue-600">Câu {qiIdx+1}.</span><LatexText text={qItem.text}/></div>
                                                    {qItem.type === 'mcq' && (
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-60 text-[11px]">
                                                            {qItem.options?.map((opt, oi) => <div key={oi}><strong>{String.fromCharCode(65+oi)}.</strong> {opt}</div>)}
                                                        </div>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => { 
                                                        setQuestions([...questions, { ...qItem, id: uuidv4() }]); 
                                                        setShowBankModal(false); 
                                                        setBankTargetPart(null);
                                                    }} 
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all shadow-lg active:scale-95"
                                                >
                                                    + Thêm vào đề
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
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
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl"><FileText size={24}/></div>
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
                                <section><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-blue-600 pl-3 text-blue-600">PHẦN I. Câu trắc nghiệm nhiều phương án.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='mcq').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-blue-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className={`mt-3 grid gap-x-4 gap-y-2 ${q.options?.some(o=>o.length > 30) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>{q.options?.map((opt, oi) => (<div key={oi} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/></div>))}</div></div>))}</div></section>
                            )}
                            {/* PHẦN II */}
                            {viewingQuiz.questions.filter(q=>q.type==='group-tf').length > 0 && (
                                <section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-purple-600 pl-3 text-purple-600">PHẦN II. Câu trắc nghiệm đúng sai.</h4><div className="space-y-10">{viewingQuiz.questions.filter(q=>q.type==='group-tf').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-purple-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className="mt-4 space-y-2 pl-8">{q.subQuestions?.map((sq, si) => (<div key={si} className="flex gap-3 items-start border-l-2 border-slate-100 pl-4 py-1"><span className="font-bold text-slate-400">{String.fromCharCode(97+si)})</span><LatexText text={sq.text}/></div>))}</div></div>))}</div></section>
                            )}
                            {/* PHẦN III */}
                            {viewingQuiz.questions.filter(q=>q.type==='short').length > 0 && (
                                <section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-emerald-600 pl-3 text-emerald-600">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='short').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-emerald-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className="mt-3 pl-8 text-slate-400 italic font-medium">Đáp số: .................................................</div></div>))}</div></section>
                            )}
                            <div className="text-center font-black uppercase text-xs mt-10 border-t border-slate-100 pt-10 tracking-[0.5em] text-slate-300">--- HẾT ---</div>
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
