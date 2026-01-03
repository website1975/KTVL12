
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Chapter } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, deleteResult,
    getChapters, saveChapter, updateChapter, deleteChapter,
    isDatabaseConnected, uploadQuizImage
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, BarChart3, Edit, 
    X, BookOpen, Lightbulb, Bold, Sigma, CornerDownLeft, 
    Sparkles, Shuffle, Eye, Cpu, FileUp, Trophy, History, 
    Settings, Filter, FolderTree, FileOutput, Search, Database, 
    ChevronRight, LayoutDashboard, Users, FileText, Send, Layers,
    Image as ImageIcon, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
    Info, FileQuestion
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
        <div className="flex flex-col gap-1 mb-4 w-full">
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
                    <div className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest opacity-70">Review hiển thị:</div>
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

  // Filters
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [resGrade, setResGrade] = useState<Grade | 'all'>('all');
  const [resChapter, setResChapter] = useState<string>('all');
  const [resQuizId, setResQuizId] = useState<string>('all');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
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

  // Chapter Editor State
  const [selectedGradeCh, setSelectedGradeCh] = useState<Grade>('10');
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

  const imageInputRef = useRef<HTMLInputElement>(null);
  const currentQIdxForImage = useRef<number | null>(null);

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

  const resetEditor = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setDuration(90); setIsPublished(false);
  };

  const availableChapters = useMemo(() => {
    const tg = (activeMenu === 'create' || activeMenu === 'ai') ? grade : filterGrade;
    return chapters.filter(c => tg === 'all' || c.grade === tg).sort((a,b)=>a.order - b.order);
  }, [chapters, grade, filterGrade, activeMenu]);

  const resChapters = useMemo(() => {
    return chapters.filter(c => resGrade === 'all' || c.grade === resGrade).sort((a,b)=>a.order - b.order);
  }, [chapters, resGrade]);

  const resAvailableQuizzes = useMemo(() => {
    return quizzes.filter(q => (resGrade === 'all' || q.grade === resGrade) && (resChapter === 'all' || q.category === resChapter));
  }, [quizzes, resGrade, resChapter]);

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

  const resultStats = useMemo(() => {
      if (filteredResults.length === 0) return { totalTakers: 0, highestScore: 0 };
      const uniqueStudents = new Set(filteredResults.map(r => r.studentId));
      return { totalTakers: uniqueStudents.size, highestScore: Math.max(...filteredResults.map(r => r.score)) };
  }, [filteredResults]);

  const groupedResults = useMemo(() => {
      const groups: Record<string, Result[]> = {};
      filteredResults.forEach(r => {
          if (!groups[r.studentId]) groups[r.studentId] = [];
          groups[r.studentId].push(r);
      });
      return Object.values(groups).sort((a, b) => Math.max(...b.map(x=>x.score)) - Math.max(...a.map(x=>x.score)));
  }, [filteredResults]);

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

  const handleImageUploadTrigger = (qIdx: number) => {
      currentQIdxForImage.current = qIdx;
      imageInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || currentQIdxForImage.current === null) return;
      setIsProcessing(true); setLoadingMsg("Đang tải hình ảnh lên Supabase...");
      try {
          const url = await uploadQuizImage(file);
          const n = [...questions];
          n[currentQIdxForImage.current].imageUrl = url;
          setQuestions(n);
      } catch (err: any) { alert("Lỗi tải ảnh: " + err.message); } finally {
          setIsProcessing(false); currentQIdxForImage.current = null;
          if (e.target) e.target.value = '';
      }
  };

  // --- RENDER MODULES ---

  const renderQuizzes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {filteredQuizzes.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                <FileQuestion size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Chưa có đề thi nào phù hợp</p>
            </div>
        ) : filteredQuizzes.map(q => {
            const stats = quizStats(q.id);
            return (
                <div key={q.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all group relative border-b-4 border-b-slate-100 hover:border-b-blue-600">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${q.type === 'test' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                            {q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleEditQuiz(q)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit size={16}/></button>
                            <button onClick={async () => { if(confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <h3 className="font-black text-slate-800 text-sm mb-4 line-clamp-2 min-h-[2.5rem] leading-tight group-hover:text-blue-600 transition-colors">{q.title}</h3>
                    <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><BookOpen size={12}/> {q.category || 'Chưa phân loại'}</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><Layers size={12}/> {q.questions.length} câu hỏi • {q.durationMinutes} phút</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><History size={12}/> {new Date(q.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-4 flex justify-between items-center mb-6">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">Số người làm</p><p className="text-xs font-black text-slate-800">{stats.count} lượt</p></div>
                        <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Điểm cao nhất</p><p className="text-xs font-black text-blue-600">{stats.max.toFixed(2)}</p></div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                        <span className={`text-[9px] font-black uppercase flex items-center gap-1.5 ${q.isPublished ? 'text-green-500' : 'text-slate-300'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${q.isPublished ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            {q.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                        </span>
                        <button onClick={() => setViewingQuiz(q)} className="text-[9px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1"><Eye size={12}/> Xem thử</button>
                    </div>
                </div>
            )
        })}
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-4xl mx-auto pb-48 animate-fade-in space-y-12">
        <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={onFileChange} />
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

        {[
            { type: 'mcq' as QuestionType, title: 'Phần I: Câu trắc nghiệm nhiều phương án', color: 'blue' },
            { type: 'group-tf' as QuestionType, title: 'Phần II: Câu trắc nghiệm đúng sai', color: 'purple' },
            { type: 'short' as QuestionType, title: 'Phần III: Câu trắc nghiệm trả lời ngắn', color: 'emerald' }
        ].map(section => (
            <div key={section.type} className="space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h4 className={`text-sm font-black uppercase text-${section.color}-600 tracking-tight flex items-center gap-2`}>
                        <Layers size={18}/> {section.title}
                    </h4>
                    <div className="flex gap-2">
                        <button onClick={() => { setBankTargetPart(section.type); setShowBankModal(true); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-900 transition-all shadow-lg"><Database size={14}/> Ngân hàng</button>
                        <button onClick={() => addQuestion(section.type)} className={`bg-${section.color}-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg`}><Plus size={14}/> Thêm mới</button>
                    </div>
                </div>

                <div className="space-y-8">
                    {questions.map((q, qIdx) => q.type === section.type && (
                        <div key={q.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm relative group hover:shadow-md transition-all">
                            <button onClick={() => { if(confirm('Xóa câu hỏi này?')){ const n = [...questions]; n.splice(qIdx, 1); setQuestions(n); } }} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                            <div className="flex items-center gap-3 mb-8"><span className={`w-10 h-10 rounded-2xl bg-${section.color}-50 text-${section.color}-600 flex items-center justify-center font-black text-sm`}>{questions.filter(qu=>qu.type===section.type).indexOf(q) + 1}</span><div className="h-px flex-1 bg-slate-100"></div></div>

                            <RichTextEditor label="Nội dung câu hỏi" value={q.text} onChange={v => { const n = [...questions]; n[qIdx].text = v; setQuestions(n); }} placeholder="Nhập câu hỏi..." />

                            <div className="mb-8">
                                <button onClick={() => handleImageUploadTrigger(qIdx)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase hover:text-blue-600 transition-colors bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"><ImageIcon size={14}/> {q.imageUrl ? 'Thay đổi hình ảnh' : 'Tải lên hình ảnh'}</button>
                                {q.imageUrl && (
                                    <div className="mt-4 relative inline-block group/img">
                                        <img src={q.imageUrl} className="max-h-64 rounded-2xl border-2 border-slate-100 bg-white shadow-sm" alt="Minh họa" />
                                        <button onClick={() => { const n=[...questions]; n[qIdx].imageUrl=undefined; setQuestions(n); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md transition-all"><X size={12}/></button>
                                    </div>
                                )}
                            </div>

                            {q.type === 'mcq' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {q.options?.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                            <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[qIdx].correctAnswer = opt; setQuestions(n); }} className="w-5 h-5 text-blue-600 border-slate-300 focus:ring-blue-500" />
                                            <span className="text-xs font-black text-slate-400">{String.fromCharCode(65+oIdx)}.</span>
                                            <input type="text" className="flex-1 bg-transparent border-none text-sm font-bold outline-none placeholder:text-slate-300" value={opt} onChange={e => { const n = [...questions]; n[qIdx].options![oIdx] = e.target.value; setQuestions(n); }} placeholder={`Phương án ${String.fromCharCode(65+oIdx)}...`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'group-tf' && (
                                <div className="space-y-3 mb-8">
                                    {q.subQuestions?.map((sq, sIdx) => (
                                        <div key={sq.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group/sq transition-all hover:bg-white hover:border-blue-100">
                                            <span className="text-xs font-black text-slate-400">{String.fromCharCode(97+sIdx)})</span>
                                            <input type="text" className="flex-1 bg-transparent border-none text-sm font-medium outline-none" value={sq.text} onChange={e => { const n = [...questions]; n[qIdx].subQuestions![sIdx].text = e.target.value; setQuestions(n); }} placeholder="Ý phát biểu..." />
                                            <select className="text-[10px] font-black p-2 rounded-xl bg-white border border-slate-200 outline-none cursor-pointer" value={sq.correctAnswer} onChange={e => { const n = [...questions]; n[qIdx].subQuestions![sIdx].correctAnswer = e.target.value as any; setQuestions(n); }}><option value="True">ĐÚNG</option><option value="False">SAI</option></select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'short' && (
                                <div className="mb-8"><div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest whitespace-nowrap">ĐÁP SỐ ĐÚNG:</span><input type="text" className="flex-1 bg-transparent border-none text-sm font-black outline-none text-emerald-700" value={q.correctAnswer} onChange={e => { const n = [...questions]; n[qIdx].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Kết quả..." /></div></div>
                            )}

                            <div className="pt-8 border-t border-slate-50"><RichTextEditor label="Lời giải chi tiết cho câu hỏi này" value={q.solution || ''} onChange={v => { const n = [...questions]; n[qIdx].solution = v; setQuestions(n); }} placeholder="Giải thích chi tiết..." rows={5} /></div>
                        </div>
                    ))}
                </div>
            </div>
        ))}

        <div className="fixed bottom-8 left-[280px] right-8 flex justify-end pointer-events-none z-[60]">
            <div className="pointer-events-auto flex items-center gap-3 bg-white/90 backdrop-blur-md p-3 rounded-[2.5rem] shadow-2xl border border-slate-200">
                <label className="flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-all"><input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500" /> CÔNG KHAI</label>
                <button onClick={async () => {
                        if (!title.trim()) return alert("Nhập tiêu đề!");
                        setIsProcessing(true); setLoadingMsg("Đang lưu đề thi...");
                        const quizData: Quiz = { id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished };
                        try {
                            if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
                            alert("Đã lưu đề thi thành công!"); await refreshData(); resetEditor(); setActiveMenu('quizzes');
                        } catch(err: any) { alert(err.message); } finally { setIsProcessing(false); }
                    }} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center gap-2 hover:scale-[1.03] transition-all"><Save size={20}/> Lưu & Xuất bản</button>
            </div>
        </div>
    </div>
  );

  const renderImport = () => (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-12 pb-32">
        <div className="bg-white p-16 rounded-[3rem] border-4 border-dashed border-slate-100 shadow-sm text-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-8"><FileUp size={40}/></div>
            <h3 className="text-xl font-black uppercase mb-4 text-slate-800">Nhập đề từ file PDF</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm mx-auto mb-10 leading-relaxed text-center">Tải lên file PDF đề thi. AI sẽ tự động tách câu hỏi, đáp án và lời giải chi tiết cho hệ thống.</p>
            <input type="file" id="pdf-upload" hidden accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            <label htmlFor="pdf-upload" className="inline-flex items-center gap-3 px-12 py-4 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase cursor-pointer hover:bg-slate-900 transition-all shadow-xl active:scale-95">{pdfFile ? pdfFile.name : 'CHỌN FILE PDF'}</label>
            {pdfFile && (
                <button onClick={async () => {
                    setIsProcessing(true); setLoadingMsg("AI đang phân tích dữ liệu từ PDF...");
                    const reader = new FileReader(); reader.readAsDataURL(pdfFile);
                    reader.onload = async () => {
                        try { const base64 = (reader.result as string).split(',')[1]; const qs = await parseQuestionsFromPDF(base64); setQuestions(qs); setTitle(`Đề từ PDF: ${pdfFile.name}`); setActiveMenu('create'); } catch(e) { alert("Lỗi phân tích PDF."); } finally { setIsProcessing(false); }
                    };
                }} className="block mx-auto mt-8 text-blue-600 font-black text-[10px] uppercase underline underline-offset-4 tracking-widest hover:text-blue-700">Tiến hành phân tích</button>
            )}
        </div>

        <div className="bg-blue-50 rounded-[2.5rem] p-10 border border-blue-100 flex gap-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg"><Info size={24}/></div>
            <div className="space-y-4">
                <h4 className="font-black text-sm uppercase text-blue-900 tracking-tight">Hướng dẫn định dạng file PDF để AI đọc chuẩn</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">1. Cấu trúc câu hỏi</p>
                        <ul className="text-sm space-y-2 text-blue-700">
                            <li><span className="font-bold">Trắc nghiệm:</span> Để AI nhận diện đáp án đúng, hãy đánh dấu <span className="text-red-600 font-black">*</span> trước ký tự phương án. VD: <span className="italic">*A. Nội dung...</span></li>
                            <li><span className="font-bold">Đúng Sai:</span> Ở cuối mỗi ý a, b, c, d hãy ghi <span className="text-green-600 font-bold">(Đ)</span> hoặc <span className="text-red-600 font-bold">(S)</span>.</li>
                            <li><span className="font-bold">Trả lời ngắn:</span> Ghi <span className="font-bold italic">Đáp án: 12.5</span> ngay dưới nội dung câu hỏi.</li>
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest">2. Lời giải chi tiết</p>
                        <p className="text-sm text-blue-700 leading-relaxed">Để bóc tách lời giải, hãy bắt đầu bằng từ khóa <span className="font-bold underline">Lời giải:</span> hoặc <span className="font-bold underline">Hướng dẫn:</span> ngay dưới nội dung câu hỏi.</p>
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <code className="text-[10px] font-mono text-slate-500">Lời giải: Ta có AB = 5, AC = 12 nên BC = 13...</code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderResults = () => (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-8 border-b border-slate-100 space-y-8 bg-slate-50/50">
            <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase flex items-center gap-2"><Trophy size={20} className="text-orange-500"/> Bảng điểm & Thống kê</h3><button onClick={refreshData} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"><Shuffle size={16}/></button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Lọc theo Khối</label><select className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold outline-none" value={resGrade} onChange={e=>{setResGrade(e.target.value as any); setResChapter('all'); setResQuizId('all');}}><option value="all">Tất cả Khối</option><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Lọc theo Chương</label><select className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold outline-none" value={resChapter} onChange={e=>{setResChapter(e.target.value); setResQuizId('all');}}><option value="all">Tất cả Chương</option>{resChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase ml-1">Lọc theo Đề thi</label><select className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-bold outline-none" value={resQuizId} onChange={e=>setResQuizId(e.target.value)}><option value="all">Tất cả Đề thi</option>{resAvailableQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6"><div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase">Số người thi</p><p className="text-2xl font-black text-slate-800 mt-1">{resultStats.totalTakers}</p></div><div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase">Điểm cao nhất</p><p className="text-2xl font-black text-blue-600 mt-1">{resultStats.highestScore.toFixed(2)}</p></div></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="bg-slate-50 text-slate-400 font-black uppercase border-b border-slate-100"><tr><th className="px-8 py-5">Thí sinh</th><th className="px-8 py-5">Đề thi mới nhất</th><th className="px-8 py-5">Điểm cao nhất</th><th className="px-8 py-5">Số lượt thi</th><th className="px-8 py-5">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-50">
                    {groupedResults.map((attempts) => {
                        const last = attempts[0]; const student = users.find(u=>u.id===last.studentId); const isExp = expandedStudent === last.studentId; const maxScore = Math.max(...attempts.map(a=>a.score));
                        return (<React.Fragment key={last.studentId}><tr className="hover:bg-slate-50/50 transition-colors group"><td className="px-8 py-5"><div className="font-bold text-slate-800">{last.studentName}</div><div className="text-[10px] text-slate-400 uppercase font-black">Khối {student?.grade || '?'}</div></td><td className="px-8 py-5"><div className="font-medium truncate max-w-[200px]">{quizzes.find(q=>q.id===last.quizId)?.title || 'Đề đã xóa'}</div><div className="text-[10px] text-slate-400">{new Date(last.submittedAt).toLocaleString('vi-VN')}</div></td><td className="px-8 py-5"><span className={`font-black text-base ${maxScore >= 8 ? 'text-green-600' : (maxScore >= 5 ? 'text-blue-600' : 'text-red-500')}`}>{maxScore.toFixed(2)}</span></td><td className="px-8 py-5"><div className="flex items-center gap-3"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-black text-[10px]">{attempts.length} lần</span>{attempts.length > 1 && (<button onClick={()=>setExpandedStudent(isExp ? null : last.studentId)} className="text-blue-600 font-black text-[10px] uppercase hover:underline flex items-center gap-1">{isExp ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} XEM CHI TIẾT</button>)}</div></td><td className="px-8 py-5"><button onClick={async () => { if(confirm('Xóa tất cả kết quả của học sinh này?')) { for(const r of attempts) await deleteResult(r.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18}/></button></td></tr>
                                {isExp && (<tr className="bg-slate-50/30"><td colSpan={5} className="px-8 py-0"><div className="border-l-4 border-blue-100 ml-4 my-4 p-4 space-y-3"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Lịch sử thi của {last.studentName}:</p>
                                                {attempts.map((a, idx) => (<div key={a.id} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-slate-100"><div className="flex items-center gap-4"><span className="text-slate-300 font-bold">#{attempts.length - idx}</span><span className="font-medium text-slate-500">{new Date(a.submittedAt).toLocaleString('vi-VN')}</span></div><div className="flex items-center gap-8"><span className="text-slate-400 font-medium">Làm trong {Math.floor(a.durationSeconds / 60)}p {a.durationSeconds % 60}s</span><span className="font-black text-blue-600">Điểm: {a.score.toFixed(2)}</span><button onClick={async () => { if(confirm('Xóa lượt thi này?')){ await deleteResult(a.id); refreshData(); } }} className="text-slate-300 hover:text-red-500"><X size={14}/></button></div></div>))}</div></td></tr>)}</React.Fragment>);
                    })}
                    {groupedResults.length === 0 && (
                        <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Không có dữ liệu kết quả thi phù hợp</td></tr>
                    )}
                </tbody></table></div>
    </div>
  );

  const renderStudents = () => (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-6">
            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Users size={24}/></div><div><h3 className="text-sm font-black uppercase tracking-tight">Quản lý Tài khoản Học sinh</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang hiển thị {filteredStudents.length} học sinh</p></div></div>
            <div className="flex items-center gap-3"><label className="text-[9px] font-black text-slate-400 uppercase">Lọc theo khối lớp:</label><div className="flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">{(['all', '10', '11', '12'] as const).map(g => (<button key={g} onClick={() => setStdGrade(g)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${stdGrade === g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{g === 'all' ? 'Tất cả' : `Khối ${g}`}</button>))}</div></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead className="bg-slate-50 text-slate-400 font-black uppercase border-b border-slate-100"><tr><th className="px-8 py-5">Họ và tên học sinh</th><th className="px-8 py-5">Tên đăng nhập</th><th className="px-8 py-5">Khối</th><th className="px-8 py-5">Mật khẩu</th><th className="px-8 py-5">Thống kê</th><th className="px-8 py-5">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-50">
                    {filteredStudents.map(u => {
                        const sR = results.filter(r => r.studentId === u.id);
                        return (<tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-5 font-bold text-slate-800">{u.fullName}</td>
                                <td className="px-8 py-5 font-mono text-blue-600">{u.username}</td>
                                <td className="px-8 py-5"><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-black text-[10px] uppercase">Lớp {u.grade}</span></td>
                                <td className="px-8 py-5 font-mono text-slate-300">{u.password}</td>
                                <td className="px-8 py-5"><div className="text-[10px] font-black text-slate-400 uppercase">Đã làm {sR.length} lượt thi</div><div className="text-xs font-bold text-slate-700">TB: {(sR.reduce((a,b)=>a+b.score,0)/(sR.length||1)).toFixed(1)}đ</div></td>
                                <td className="px-8 py-5"><button onClick={async () => { if(confirm(`Xóa học sinh ${u.fullName}?`)) { await deleteUser(u.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 transition-all group-hover:text-red-600"><Trash2 size={18}/></button></td>
                            </tr>);
                    })}
                    {filteredStudents.length === 0 && (
                        <tr><td colSpan={6} className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Không có tài khoản học sinh nào</td></tr>
                    )}
                </tbody></table></div>
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
                    }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg">LƯU CHƯƠNG</button>
                </div>
            </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b flex gap-1">{(['10','11','12'] as const).map(g=>(<button key={g} onClick={()=>setSelectedGradeCh(g)} className={`px-5 py-2 rounded-lg text-[10px] font-black ${selectedGradeCh===g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white'}`}>KHỐI {g}</button>))}</div>
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                {chapters.filter(c=>c.grade===selectedGradeCh).sort((a,b)=>a.order-b.order).map(c=>(
                    <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors"><div className="flex items-center gap-4"><div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div><span className="text-[13px] font-bold text-slate-700">{c.name}</span></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={()=>{setEditingChId(c.id); setChName(c.name); setChOrder(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button><button onClick={async()=>{if(confirm('Xóa chương học này?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button></div></div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderAI = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 text-blue-50 opacity-10 pointer-events-none"><Sparkles size={160}/></div>
            <div className="flex items-center gap-6 mb-10"><div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200"><Sparkles size={32}/></div><div><h3 className="text-xl font-black uppercase tracking-tight">AI Soạn Đề Thông Minh</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tạo đề thi chuẩn trong giây lát</p></div></div>
            <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4"><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" value={grade} onChange={e=>setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select><select className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Chọn chương học...</option>{availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Mô tả chủ đề chi tiết</label><textarea className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-medium h-56 focus:ring-2 focus:ring-blue-100 transition-all outline-none" placeholder="Ví dụ: Soạn đề về Khối đa diện..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} /></div>
                <div className="bg-slate-50 p-6 rounded-3xl grid grid-cols-3 gap-6 border border-slate-100"><div><label className="text-[9px] font-black text-slate-400 uppercase">Trắc nghiệm</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center shadow-sm" value={aiCounts.p1} onChange={e=>setAiCounts({...aiCounts, p1: parseInt(e.target.value)})} /></div><div><label className="text-[9px] font-black text-slate-400 uppercase">Đúng Sai</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center shadow-sm" value={aiCounts.p2} onChange={e=>setAiCounts({...aiCounts, p2: parseInt(e.target.value)})} /></div><div><label className="text-[9px] font-black text-slate-400 uppercase">Trả lời ngắn</label><input type="number" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-black text-center shadow-sm" value={aiCounts.p3} onChange={e=>setAiCounts({...aiCounts, p3: parseInt(e.target.value)})} /></div></div>
                <button onClick={async () => {
                    if(!aiTopic) return alert("Nhập chủ đề!"); setIsProcessing(true); setLoadingMsg("AI đang soạn đề...");
                    try { const qs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiCounts.p1, part2Count: aiCounts.p2, part3Count: aiCounts.p3 }); setQuestions(qs); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create'); } catch(e) { alert("Lỗi AI."); } finally { setIsProcessing(false); }
                }} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black text-sm uppercase shadow-2xl hover:scale-[1.02] transition-all">BẮT ĐẦU SOẠN ĐỀ WITH AI</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print z-[70] shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white shadow-lg"><Cpu size={18}/></div><h1 className="text-sm font-black text-white uppercase tracking-widest">EDUQUIZ <span className="text-blue-400">PRO</span></h1></div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                    { id: 'chapters', icon: FolderTree, label: 'QUẢN LÝ CHƯƠNG' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ THỦ CÔNG' },
                    { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                    { id: 'import', icon: FileUp, label: 'NHẬP ĐỀ TỪ PDF' },
                    { id: 'results', icon: BarChart3, label: 'KẾT QUẢ THI' },
                    { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' }
                ].map(item => (
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}><item.icon size={16}/> {item.label}</button>
                ))}
            </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0 no-print z-40">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    {activeMenu === 'quizzes' && (<div className="flex items-center gap-2 mr-4"><select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black outline-none cursor-pointer" value={filterGrade} onChange={e=>setFilterGrade(e.target.value as any)}><option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option></select><select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-black outline-none cursor-pointer" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="all">TẤT CẢ CHƯƠNG</option>{chapters.filter(c => filterGrade === 'all' || c.grade === filterGrade).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></div>)}
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

        {/* MODAL NGÂN HÀNG THEO KHỐI ĐANG CHỌN */}
        {showBankModal && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-3"><Database size={20} className="text-blue-400"/><div><h3 className="font-black uppercase text-sm mb-1">Ngân hàng Lớp {grade}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bankTargetPart}</p></div></div><button onClick={() => { setShowBankModal(false); setBankTargetPart(null); }} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-all"><X size={20}/></button></div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50">
                        {quizzes.filter(q=>q.grade===grade).length === 0 ? <p className="text-center text-slate-400 py-10 font-bold uppercase text-[10px]">Chưa có đề thi khối {grade}</p> : quizzes.filter(q=>q.grade===grade).map(q => {
                            const filteredBankQs = q.questions.filter(qi => qi.type === bankTargetPart); if (filteredBankQs.length === 0) return null;
                            return (<div key={q.id} className="mb-10"><h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 border-b border-slate-200 pb-2">Đề: {q.title}</h4><div className="grid grid-cols-1 gap-4">{filteredBankQs.map((qItem, qiIdx) => (<div key={qItem.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-start group hover:border-blue-400 hover:shadow-lg transition-all"><div className="flex-1 text-[13px] pr-6"><div className="font-bold flex gap-2 mb-2"><span className="text-blue-600">#{qiIdx+1}.</span><LatexText text={qItem.text}/></div>{qItem.imageUrl && <div className="my-2"><img src={qItem.imageUrl} className="max-h-24 rounded border"/></div>}</div><button onClick={() => { setQuestions([...questions, { ...qItem, id: uuidv4() }]); setShowBankModal(false); setBankTargetPart(null); }} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95">+ Thêm</button></div>))}</div></div>);
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* MODAL XEM ĐỀ */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0"><div className="flex items-center gap-5"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl"><FileText size={24}/></div><div><h3 className="text-lg font-black uppercase line-clamp-1">{viewingQuiz.title}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Lớp {viewingQuiz.grade} • {viewingQuiz.questions.length} câu • {viewingQuiz.durationMinutes} phút</p></div></div><button onClick={() => setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button></div>
                    <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar"><div className="max-w-3xl mx-auto space-y-12">
                            {viewingQuiz.questions.filter(q=>q.type==='mcq').length > 0 && (<section><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-blue-600 pl-3 text-blue-600">PHẦN I. Câu trắc nghiệm nhiều phương án.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='mcq').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-blue-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className={`mt-3 grid gap-x-4 gap-y-2 ${q.options?.some(o=>o.length > 30) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>{q.options?.map((opt, oi) => (<div key={oi} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/></div>))}</div></div>))}</div></section>)}
                            {viewingQuiz.questions.filter(q=>q.type==='group-tf').length > 0 && (<section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-purple-600 pl-3 text-purple-600">PHẦN II. Câu trắc nghiệm đúng sai.</h4><div className="space-y-10">{viewingQuiz.questions.filter(q=>q.type==='group-tf').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-purple-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className="mt-4 space-y-2 pl-8">{q.subQuestions?.map((sq, si) => (<div key={si} className="flex gap-3 items-start border-l-2 border-slate-100 pl-4 py-1"><span className="font-bold text-slate-400">{String.fromCharCode(97+si)})</span><LatexText text={sq.text}/></div>))}</div></div>))}</div></section>)}
                            {viewingQuiz.questions.filter(q=>q.type==='short').length > 0 && (<section className="pt-8 border-t border-slate-100"><h4 className="font-black text-sm uppercase mb-6 border-l-4 border-emerald-600 pl-3 text-emerald-600">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4><div className="space-y-8">{viewingQuiz.questions.filter(q=>q.type==='short').map((q, i) => (<div key={q.id} className="text-[15px] leading-relaxed"><div className="font-bold flex gap-2"><span className="shrink-0 text-emerald-600">Câu {i+1}.</span><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="my-4 max-h-48 rounded-xl border border-slate-100" alt="Minh họa" />}<div className="mt-3 pl-8 text-slate-400 italic font-medium">Đáp số: .................................................</div></div>))}</div></section>)}
                        </div></div>
                </div>
            </div>
        )}

        {isProcessing && (<div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm"><div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div><h2 className="text-lg font-black text-slate-800 mt-8 uppercase tracking-widest">{loadingMsg}</h2></div>)}
    </div>
  );
};

export default AdminDashboard;
