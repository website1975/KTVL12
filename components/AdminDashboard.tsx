
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
    Clock, Download, FolderTree, ArrowUpDown, Info, Copy, AlertCircle, Target, Printer, FileOutput
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

  // Chapter State
  const [selectedGradeForChapters, setSelectedGradeForChapters] = useState<Grade>('12');
  const [chapterNameInput, setChapterNameInput] = useState('');
  const [chapterOrderInput, setChapterOrderInput] = useState(1);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // Quiz Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // AI & PDF State
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 12, p2: 4, p3: 6 });

  // Modals
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  useEffect(() => { refreshData(); }, [activeMenu]);

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
        max: Math.max(...scores),
        min: Math.min(...scores)
    };
  };

  const availableChapters = useMemo(() => {
    const tg = (activeMenu === 'create' || activeMenu === 'ai') ? grade : filterGrade;
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
    setIsPublished(q.isPublished); setActiveMenu('create');
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Nhập tên đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), 
      type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), 
      isPublished
    };
    try {
        if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
        alert("Thành công!"); await refreshData(); setActiveMenu('quizzes');
    } catch(err: any) { alert(err.message); }
  };

  const handlePrint = () => {
      window.print();
  };

  const handleShufflePreview = () => {
    if (!viewingQuiz) return;
    const shuffled = shuffleArray(viewingQuiz.questions).map(q => {
        if (q.type === 'mcq' && q.options) return { ...q, options: shuffleArray(q.options) };
        return q;
    });
    setPreviewQuestions(shuffled);
  };

  // --- RENDER MENU: SOẠN ĐỀ AI ---
  const renderAIMenu = () => (
      <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center"><Sparkles size={24}/></div>
                  <div>
                      <h3 className="text-lg font-black uppercase">Trợ lý soạn đề AI</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tạo đề thi chuẩn cấu trúc chỉ trong vài giây</p>
                  </div>
              </div>

              <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Khối lớp</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={grade} onChange={e=>setGrade(e.target.value as Grade)}>
                            <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Chương học</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={category} onChange={e=>setCategory(e.target.value)}>
                            <option value="">Chọn chương...</option>
                            {availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Chủ đề chi tiết (Prompt)</label>
                      <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold h-32" placeholder="VD: Khảo sát hàm số, cực trị hàm số bậc 3, các bài toán thực tế..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl grid grid-cols-3 gap-4 border border-slate-100">
                      <div className="text-center">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Phần I (MCQ)</label>
                          <input type="number" className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-center font-bold" value={aiConfig.p1} onChange={e=>setAiConfig({...aiConfig, p1: parseInt(e.target.value)})} />
                      </div>
                      <div className="text-center">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Phần II (Đ/S)</label>
                          <input type="number" className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-center font-bold" value={aiConfig.p2} onChange={e=>setAiConfig({...aiConfig, p2: parseInt(e.target.value)})} />
                      </div>
                      <div className="text-center">
                          <label className="text-[8px] font-black text-slate-400 uppercase">Phần III (Ngắn)</label>
                          <input type="number" className="w-full mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs text-center font-bold" value={aiConfig.p3} onChange={e=>setAiConfig({...aiConfig, p3: parseInt(e.target.value)})} />
                      </div>
                  </div>

                  <button 
                    onClick={async () => {
                        if(!aiTopic.trim()) return alert("Nhập chủ đề!");
                        setIsProcessing(true); setLoadingMsg("AI đang suy nghĩ và soạn đề...");
                        try {
                            const qs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3 });
                            setQuestions(qs); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create');
                        } catch(e) { alert("Lỗi soạn đề!"); } finally { setIsProcessing(false); }
                    }}
                    className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-3">
                      <Sparkles size={18}/> Bắt đầu soạn đề ngay
                  </button>
              </div>
          </div>
      </div>
  );

  // --- RENDER MENU: NHẬP PDF ---
  const renderImportMenu = () => (
    <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white p-12 rounded-[2.5rem] border-4 border-dashed border-slate-100 text-center">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><FileUp size={32}/></div>
            <h3 className="text-xl font-black uppercase mb-2">Nhập đề từ file PDF</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">AI sẽ tự động nhận diện câu hỏi, đáp án và lời giải</p>
            
            <input type="file" id="pdf-upload" className="hidden" accept=".pdf" onChange={async (e)=>{
                const file = e.target.files?.[0];
                if(!file) return;
                setIsProcessing(true); setLoadingMsg("Đang đọc dữ liệu PDF...");
                try {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const base64 = (event.target?.result as string).split(',')[1];
                        const qs = await parseQuestionsFromPDF(base64);
                        setQuestions(qs); setTitle(`Đề nhập từ file: ${file.name}`); setActiveMenu('create');
                        setIsProcessing(false);
                    };
                    reader.readAsDataURL(file);
                } catch(e) { alert("Lỗi đọc PDF!"); setIsProcessing(false); }
            }} />
            <label htmlFor="pdf-upload" className="inline-block bg-blue-600 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-transform cursor-pointer">Chọn file PDF từ máy tính</label>
        </div>
    </div>
  );

  // --- RENDER MENU: KẾT QUẢ THI ---
  const renderResultsMenu = () => (
      <div className="animate-fade-in space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-[12px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase tracking-widest">
                      <tr>
                          <th className="px-6 py-4">Học sinh</th>
                          <th className="px-6 py-4">Đề thi</th>
                          <th className="px-6 py-4">Điểm</th>
                          <th className="px-6 py-4">Thời gian</th>
                          <th className="px-6 py-4">Ngày nộp</th>
                          <th className="px-6 py-4">Thao tác</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {results.map(r => {
                          const q = quizzes.find(item => item.id === r.quizId);
                          return (
                              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-bold">{r.studentName}</td>
                                  <td className="px-6 py-4 text-slate-500">{q?.title || 'Đã xóa'}</td>
                                  <td className="px-6 py-4"><span className={`font-black ${r.score >= 8 ? 'text-green-600' : (r.score < 5 ? 'text-red-500' : 'text-blue-600')}`}>{r.score.toFixed(2)}</span></td>
                                  <td className="px-6 py-4">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                  <td className="px-6 py-4">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                  <td className="px-6 py-4"><button onClick={async() => { if(confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
  );

  // --- RENDER MENU: QUẢN LÝ HỌC SINH ---
  const renderStudentsMenu = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {users.filter(u => u.role === 'student').map(u => (
            <div key={u.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center font-black text-xl">{u.fullName.charAt(0)}</div>
                <div className="flex-1">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{u.fullName}</h4>
                    <p className="text-[10px] text-slate-400 font-bold">LỚP {u.grade} • ID: {u.username}</p>
                </div>
                <button onClick={async() => { if(confirm('Xóa học sinh này?')) { await deleteUser(u.id); refreshData(); } }} className="text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
        ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print">
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
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0 no-print">
                <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    {(activeMenu === 'quizzes' || activeMenu === 'results') && (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                            {(['all', '10', '11', '12'] as const).map(g => (
                                <button key={g} onClick={() => setFilterGrade(g)} className={`px-3 py-1 rounded text-[9px] font-bold ${filterGrade === g ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-400'}`}>
                                    {g === 'all' ? 'TẤT CẢ' : `KHỐI ${g}`}
                                </button>
                            ))}
                        </div>
                    )}
                    <button onClick={refreshData} className="p-1.5 border rounded hover:bg-slate-50"><Shuffle size={14}/></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeMenu === 'quizzes' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {filteredQuizzes.map(q => {
                            const gStats = getQuizGlobalStats(q.id);
                            return (
                                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-xl transition-all border-b-4 border-b-blue-600 group">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                            <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 mb-1 leading-tight group-hover:text-blue-600 min-h-[40px] line-clamp-2">{q.title}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{q.category || 'Chưa phân loại'}</p>
                                        
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
                                    <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                                        <button onClick={() => { setViewingQuiz(q); setPreviewQuestions([]); }} className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <Eye size={14}/> XEM & IN ĐỀ
                                        </button>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(q)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit size={16}/></button>
                                            <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeMenu === 'create' && (
                    <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-12 md:col-span-6 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề đề thi</label>
                                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={title} onChange={e => setTitle(e.target.value)} />
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chương / Chuyên đề</label>
                                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="">Chọn chương...</option>
                                        {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-6 md:col-span-3 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thời gian (Phút)</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            {/* MCQ Editor */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest">Phần I: Câu trắc nghiệm nhiều phương án</h4>
                                    <button onClick={() => {
                                        const q: Question = { id: uuidv4(), type: 'mcq', text: '', points: '0.25', solution: '', options: ['', '', '', ''] };
                                        setQuestions([...questions, q]);
                                    }} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">+ THÊM CÂU</button>
                                </div>
                                <div className="space-y-4">
                                    {questions.filter(q=>q.type==='mcq').map((q, idx) => {
                                        const globalIdx = questions.findIndex(item=>item.id===q.id);
                                        return (
                                            <div key={q.id} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 group relative">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-[10px] font-black text-slate-300">CÂU {globalIdx+1}</span>
                                                    <button onClick={()=>{const n=[...questions]; n.splice(globalIdx, 1); setQuestions(n);}} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                                </div>
                                                <RichTextEditor rows={2} value={q.text} onChange={v=>{const n=[...questions]; n[globalIdx].text=v; setQuestions(n);}} placeholder="Câu hỏi..." label="Nội dung" />
                                                <div className="grid grid-cols-2 gap-4 mt-4">
                                                    {q.options?.map((opt, oi)=>(
                                                        <div key={oi} className="flex items-center gap-2">
                                                            <input type="radio" checked={q.correctAnswer===opt && opt!==''} onChange={()=>{const n=[...questions]; n[globalIdx].correctAnswer=opt; setQuestions(n);}} />
                                                            <input type="text" className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs" value={opt} onChange={e=>{const n=[...questions]; const o=[...(n[globalIdx].options||[])]; o[oi]=e.target.value; n[globalIdx].options=o; setQuestions(n);}} placeholder={`Phương án ${String.fromCharCode(65+oi)}`} />
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4"><RichTextEditor rows={1} value={q.solution || ''} onChange={v=>{const n=[...questions]; n[globalIdx].solution=v; setQuestions(n);}} placeholder="Giải thích..." label="Hướng dẫn giải" /></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Group TF Editor */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xs font-black uppercase text-purple-600 tracking-widest">Phần II: Câu trắc nghiệm đúng sai</h4>
                                    <button onClick={() => {
                                        const q: Question = { id: uuidv4(), type: 'group-tf', text: '', points: '1.0', solution: '', subQuestions: Array(4).fill(0).map(()=>({id:uuidv4(), text:'', correctAnswer:'True'})) };
                                        setQuestions([...questions, q]);
                                    }} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">+ THÊM CÂU</button>
                                </div>
                                <div className="space-y-4">
                                    {questions.filter(q=>q.type==='group-tf').map((q, idx) => {
                                        const globalIdx = questions.findIndex(item=>item.id===q.id);
                                        return (
                                            <div key={q.id} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 group relative">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-[10px] font-black text-slate-300">CÂU {globalIdx+1}</span>
                                                    <button onClick={()=>{const n=[...questions]; n.splice(globalIdx, 1); setQuestions(n);}} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                                </div>
                                                <RichTextEditor rows={2} value={q.text} onChange={v=>{const n=[...questions]; n[globalIdx].text=v; setQuestions(n);}} placeholder="Yêu cầu bài toán..." label="Nội dung" />
                                                <div className="space-y-2 mt-4">
                                                    {q.subQuestions?.map((sq, si)=>(
                                                        <div key={si} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                            <span className="text-[10px] font-black w-4 text-slate-300">{String.fromCharCode(97+si)})</span>
                                                            <input type="text" className="flex-1 text-[11px] outline-none" value={sq.text} onChange={e=>{
                                                                const n=[...questions]; const s=[...(n[globalIdx].subQuestions||[])]; s[si].text=e.target.value; n[globalIdx].subQuestions=s; setQuestions(n);
                                                            }} placeholder={`Ý ${String.fromCharCode(97+si)}`} />
                                                            <div className="flex gap-1">
                                                                {['True', 'False'].map(v=>(
                                                                    <button key={v} onClick={()=>{
                                                                        const n=[...questions]; const s=[...(n[globalIdx].subQuestions||[])]; s[si].correctAnswer=v as any; n[globalIdx].subQuestions=s; setQuestions(n);
                                                                    }} className={`px-2 py-0.5 rounded text-[8px] font-bold ${sq.correctAnswer===v ? (v==='True'?'bg-green-600 text-white':'bg-red-600 text-white') : 'bg-slate-50 text-slate-300'}`}>
                                                                        {v==='True'?'Đ':'S'}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4"><RichTextEditor rows={1} value={q.solution || ''} onChange={v=>{const n=[...questions]; n[globalIdx].solution=v; setQuestions(n);}} placeholder="Giải thích..." label="Hướng dẫn giải" /></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-8 left-[300px] right-8 flex justify-end pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-3 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-2xl border border-slate-100">
                                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-all">
                                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /> CÔNG KHAI
                                </label>
                                <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2 hover:scale-105 transition-all"><Save size={18}/> LƯU ĐỀ THI</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeMenu === 'ai' && renderAIMenu()}
                {activeMenu === 'import' && renderImportMenu()}
                {activeMenu === 'results' && renderResultsMenu()}
                {activeMenu === 'students' && renderStudentsMenu()}
                {activeMenu === 'chapters' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
                            <h3 className="text-sm font-black uppercase tracking-tight mb-6">Quản lý chương trình học</h3>
                            <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <div className="col-span-12 md:col-span-8 space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương (Khối {selectedGradeForChapters})</label>
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" value={chapterNameInput} onChange={e=>setChapterNameInput(e.target.value)} placeholder="VD: Chương 1: Ứng dụng đạo hàm..." />
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
                                    }} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition-all">LƯU CHƯƠNG</button>
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
                                {chapters.filter(c=>c.grade===selectedGradeForChapters).length === 0 ? (
                                    <div className="p-10 text-center text-slate-300 font-bold uppercase text-[10px]">Chưa có chương nào</div>
                                ) : (
                                    chapters.filter(c=>c.grade===selectedGradeForChapters).sort((a,b)=>a.order-b.order).map(c=>(
                                        <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                                                <span className="text-[12px] font-bold text-slate-700">{c.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={()=>{setEditingChapterId(c.id); setChapterNameInput(c.name); setChapterOrderInput(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                                                <button onClick={async()=>{if(confirm('Xóa?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* MODAL XEM & IN ĐỀ (VERSION XUẤT WORD CHUẨN) */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md no-print animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase line-clamp-1">{viewingQuiz.title}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Đề thi chuyên nghiệp • Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleShufflePreview} className="px-5 py-3 bg-slate-800 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 flex items-center gap-2"><Shuffle size={14}/> Xáo đề</button>
                            <button onClick={handlePrint} className="px-6 py-3 bg-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 flex items-center gap-2 shadow-xl shadow-emerald-900/20"><Printer size={16}/> Xuất đề (Word/In)</button>
                            <button onClick={()=>setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar print-area">
                        {/* HEADER ĐỀ THI CHUẨN BỘ GIÁO DỤC */}
                        <div className="mb-10 text-black">
                            <div className="flex justify-between items-start border-b-2 border-black pb-4">
                                <div className="text-center w-5/12">
                                    <p className="font-bold text-sm uppercase">SỞ GD&ĐT TỈNH/THÀNH PHỐ</p>
                                    <p className="font-bold text-sm uppercase underline decoration-2">TRƯỜNG THPT CHUYÊN EDUQUIZ</p>
                                    <p className="text-[11px] mt-1 italic">(Đề thi có {Math.ceil(viewingQuiz.questions.length/2)} trang)</p>
                                </div>
                                <div className="text-center w-6/12">
                                    <p className="font-bold text-sm uppercase">KIỂM TRA CHẤT LƯỢNG HỌC TẬP</p>
                                    <p className="font-bold text-sm uppercase">NĂM HỌC 2024 - 2025</p>
                                    <p className="font-bold text-sm uppercase">Môn: TOÁN - KHỐI {viewingQuiz.grade}</p>
                                    <p className="text-[11px] mt-1 font-bold italic">Thời gian làm bài: {viewingQuiz.durationMinutes} phút</p>
                                </div>
                            </div>
                            <div className="mt-5 flex justify-between font-bold text-[14px]">
                                <p>Họ và tên thí sinh: ................................................................................</p>
                                <p>SBD: ............................</p>
                                <p className="border-2 border-black px-4 py-0.5">Mã đề: 10{viewingQuiz.grade}</p>
                            </div>
                        </div>

                        {/* PHẦN I: MCQ */}
                        <div className="mb-10">
                            <h4 className="font-bold text-sm uppercase mb-3 text-black">PHẦN I. Câu trắc nghiệm nhiều phương án chọn.</h4>
                            <p className="text-[12px] italic mb-5 text-gray-600">Thí sinh trả lời từ câu 1 đến câu {viewingQuiz.questions.filter(q=>q.type==='mcq').length}. Mỗi câu hỏi chỉ chọn một phương án.</p>
                            
                            <div className="space-y-6">
                                {(previewQuestions.length > 0 ? previewQuestions : viewingQuiz.questions).filter(q=>q.type==='mcq').map((q, i) => (
                                    <div key={q.id} className="text-[14px] leading-relaxed text-black">
                                        <div className="font-bold flex gap-2">
                                            <span className="shrink-0">Câu {i+1}.</span>
                                            <LatexText text={q.text}/>
                                        </div>
                                        <div className={`mt-2 grid gap-x-2 gap-y-1 ${q.options?.some(o=>o.length > 30) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>
                                            {q.options?.map((opt, oi) => (
                                                <div key={oi} className="flex gap-1">
                                                    <span className="font-bold">{String.fromCharCode(65+oi)}.</span>
                                                    <LatexText text={opt}/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PHẦN II: ĐÚNG SAI */}
                        <div className="mb-10 page-break-before">
                            <h4 className="font-bold text-sm uppercase mb-3 text-black">PHẦN II. Câu trắc nghiệm đúng sai.</h4>
                            <p className="text-[12px] italic mb-5 text-gray-600">Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</p>
                            
                            <div className="space-y-8">
                                {(previewQuestions.length > 0 ? previewQuestions : viewingQuiz.questions).filter(q=>q.type==='group-tf').map((q, i) => (
                                    <div key={q.id} className="text-[14px] leading-relaxed text-black">
                                        <div className="font-bold flex gap-2">
                                            <span className="shrink-0">Câu {i+1}.</span>
                                            <LatexText text={q.text}/>
                                        </div>
                                        <div className="mt-2 space-y-1 pl-6">
                                            {q.subQuestions?.map((sq, si) => (
                                                <div key={si} className="flex gap-2">
                                                    <span className="font-bold">{String.fromCharCode(97+si)})</span>
                                                    <LatexText text={sq.text}/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="text-center font-bold uppercase text-sm mt-10 border-t-2 border-black pt-5">--- HẾT ---</div>
                    </div>
                    
                    <div className="p-6 bg-slate-50 border-t flex justify-center gap-4 no-print">
                        <button onClick={() => { handleEdit(viewingQuiz); setViewingQuiz(null); }} className="px-10 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-xs hover:bg-white shadow-sm transition-all">Sửa đề thi này</button>
                        <button onClick={() => setViewingQuiz(null)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Đóng</button>
                    </div>
                </div>
            </div>
        )}

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 uppercase tracking-widest">{loadingMsg}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Hệ thống AI đang xử lý dữ liệu phức tạp...</p>
            </div>
        )}

        <style>{`
            @media print {
                .no-print { display: none !important; }
                .print-area { padding: 0 !important; overflow: visible !important; color: black !important; }
                body { background: white !important; -webkit-print-color-adjust: exact; }
                .page-break-before { page-break-before: always; }
                @page { margin: 1.5cm; }
                .text-black { color: black !important; }
            }
        `}</style>
    </div>
  );
};

export default AdminDashboard;
