
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
  const [filterCategory, setFilterCategory] = useState<string>('all');

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
        max: Math.max(...scores)
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

  // --- LOGIC XUẤT WORD CHUYÊN NGHIỆP ---
  const handleExportWord = (quiz: Quiz) => {
    const header = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-family: 'Times New Roman', serif;">
          <div style="text-align: center; width: 45%;">
              <p style="margin: 0; font-weight: bold; text-transform: uppercase;">SỞ GD&ĐT TỈNH/THÀNH PHỐ</p>
              <p style="margin: 0; font-weight: bold; text-transform: uppercase; text-decoration: underline;">TRƯỜNG THPT CHUYÊN EDUQUIZ</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; font-style: italic;">(Đề thi có 02 trang)</p>
          </div>
          <div style="text-align: center; width: 50%;">
              <p style="margin: 0; font-weight: bold; text-transform: uppercase;">KIỂM TRA CHẤT LƯỢNG HỌC TẬP</p>
              <p style="margin: 0; font-weight: bold;">NĂM HỌC 2024 - 2025</p>
              <p style="margin: 0; font-weight: bold;">Môn: TOÁN - KHỐI ${quiz.grade}</p>
              <p style="margin: 5px 0 0 0; font-size: 12px; font-style: italic;">Thời gian làm bài: ${quiz.durationMinutes} phút</p>
          </div>
      </div>
      <div style="margin-bottom: 20px; font-family: 'Times New Roman', serif; border-top: 1px solid black; padding-top: 10px;">
          <table style="width: 100%;">
              <tr>
                  <td style="width: 70%;">Họ và tên thí sinh: ................................................................................</td>
                  <td>SBD: ............................</td>
                  <td style="border: 2px solid black; padding: 5px; text-align: center; font-weight: bold;">Mã đề: 101</td>
              </tr>
          </table>
      </div>
    `;

    const getMcqLayout = (options: string[]) => {
        const isLong = options.some(o => o.length > 25);
        const isMed = options.some(o => o.length > 12);
        
        if (isLong) return 'grid-template-columns: 1fr;';
        if (isMed) return 'grid-template-columns: 1fr 1fr;';
        return 'grid-template-columns: 1fr 1fr 1fr 1fr;';
    };

    let content = "";

    // PHẦN I
    const p1 = quiz.questions.filter(q => q.type === 'mcq');
    if (p1.length > 0) {
        content += `<h4 style="margin-top: 30px; text-transform: uppercase; border-left: 5px solid #3b82f6; padding-left: 10px;">PHẦN I. Câu trắc nghiệm nhiều phương án chọn.</h4>`;
        content += `<p style="font-style: italic; font-size: 13px; color: #666;">Thí sinh trả lời từ câu 1 đến câu ${p1.length}. Mỗi câu hỏi chỉ chọn một phương án.</p>`;
        p1.forEach((q, i) => {
            content += `
              <div style="margin-bottom: 15px; font-size: 14px;">
                  <p><strong>Câu ${i+1}.</strong> ${q.text}</p>
                  <div style="display: grid; ${getMcqLayout(q.options || [])} gap: 10px; margin-left: 20px;">
                      ${q.options?.map((o, oi) => `<div><strong>${String.fromCharCode(65+oi)}.</strong> ${o}</div>`).join('')}
                  </div>
              </div>
            `;
        });
    }

    // PHẦN II
    const p2 = quiz.questions.filter(q => q.type === 'group-tf');
    if (p2.length > 0) {
        content += `<h4 style="margin-top: 40px; text-transform: uppercase; border-left: 5px solid #8b5cf6; padding-left: 10px;">PHẦN II. Câu trắc nghiệm đúng sai.</h4>`;
        content += `<p style="font-style: italic; font-size: 13px; color: #666;">Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</p>`;
        p2.forEach((q, i) => {
            content += `
              <div style="margin-bottom: 20px; font-size: 14px;">
                  <p><strong>Câu ${i+1}.</strong> ${q.text}</p>
                  <div style="margin-left: 30px;">
                      ${q.subQuestions?.map((sq, si) => `<p><strong>${String.fromCharCode(97+si)})</strong> ${sq.text}</p>`).join('')}
                  </div>
              </div>
            `;
        });
    }

    // PHẦN III
    const p3 = quiz.questions.filter(q => q.type === 'short');
    if (p3.length > 0) {
        content += `<h4 style="margin-top: 40px; text-transform: uppercase; border-left: 5px solid #10b981; padding-left: 10px;">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4>`;
        content += `<p style="font-style: italic; font-size: 13px; color: #666;">Thí sinh trả lời từ câu 1 đến câu ${p3.length}.</p>`;
        p3.forEach((q, i) => {
            content += `
              <div style="margin-bottom: 20px; font-size: 14px;">
                  <p><strong>Câu ${i+1}.</strong> ${q.text}</p>
                  <p style="margin-left: 30px; font-style: italic; border-bottom: 1px dotted #ccc; width: 200px;">Đáp án: .....................</p>
              </div>
            `;
        });
    }

    const fullHtml = `
      <html>
        <head><meta charset="utf-8"></head>
        <body style="padding: 40px; font-family: 'Times New Roman', serif;">
          ${header}
          ${content}
          <div style="text-align: center; margin-top: 50px; font-weight: bold; border-top: 1px solid black; padding-top: 10px;">--- HẾT ---</div>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title.replace(/\s+/g, '_')}_DeThi.doc`;
    link.click();
  };

  const handleShufflePreview = () => {
    if (!viewingQuiz) return;
    const shuffled = shuffleArray(viewingQuiz.questions).map(q => {
        if (q.type === 'mcq' && q.options) return { ...q, options: shuffleArray(q.options) };
        return q;
    });
    setPreviewQuestions(shuffled);
  };

  // Render các menu AI, Import, Results... tương tự mẫu trước (giữ nguyên logic)
  const renderAIMenu = () => (
      <div className="max-w-3xl mx-auto animate-fade-in">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center"><Sparkles size={24}/></div>
                  <div><h3 className="text-lg font-black uppercase">Trợ lý soạn đề AI</h3><p className="text-[10px] text-slate-400 font-bold uppercase">Chuẩn cấu trúc đề mới</p></div>
              </div>
              <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={grade} onChange={e=>setGrade(e.target.value as Grade)}>
                        <option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
                      </select>
                      <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold" value={category} onChange={e=>setCategory(e.target.value)}>
                        <option value="">Chọn chương học...</option>
                        {availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                  </div>
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold h-32" placeholder="Nhập chủ đề chi tiết để AI soạn đề..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                  <button onClick={async () => {
                      if(!aiTopic) return; setIsProcessing(true); setLoadingMsg("AI đang soạn đề...");
                      try {
                          const qs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3 });
                          setQuestions(qs); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create');
                      } catch(e) { alert("Lỗi AI"); } finally { setIsProcessing(false); }
                  }} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-[1.02] transition-all">SOẠN ĐỀ NGAY</button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Cpu size={18}/></div>
                <h1 className="text-sm font-black text-white uppercase tracking-widest">EDUQUIZ <span className="text-blue-400">PRO</span></h1>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                <h2 className="text-[11px] font-black uppercase text-slate-400">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    {/* BỘ LỌC CHƯƠNG CHO QUẢN LÝ ĐỀ */}
                    {(activeMenu === 'quizzes') && (
                        <div className="flex items-center gap-2 mr-4">
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none" value={filterGrade} onChange={e=>setFilterGrade(e.target.value as any)}>
                                <option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option>
                            </select>
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
                                <option value="all">TẤT CẢ CHƯƠNG</option>
                                {availableChapters.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
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
                                            <div className="border-r border-slate-200 pr-2"><p className="text-[8px] font-black text-slate-400 uppercase">Lượt thi</p><p className="text-xs font-black text-slate-700">{gStats?.total || 0}</p></div>
                                            <div className="pl-2"><p className="text-[8px] font-black text-slate-400 uppercase">Điểm TB</p><p className="text-xs font-black text-blue-600">{gStats ? gStats.avg.toFixed(2) : '-'}</p></div>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                                        <button onClick={() => { setViewingQuiz(q); setPreviewQuestions([]); }} className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <Eye size={14}/> XEM & IN ĐỀ
                                        </button>
                                        <button onClick={() => handleEdit(q)} className="p-2.5 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                                        <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeMenu === 'ai' && renderAIMenu()}
                {/* Giữ nguyên các Tabs khác với logic render tương tự đã được hoàn thiện */}
            </div>
        </main>

        {/* MODAL XEM & XUẤT ĐỀ CHUYÊN NGHIỆP */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md no-print animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase line-clamp-1">{viewingQuiz.title}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleExportWord(viewingQuiz)} className="px-6 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 flex items-center gap-2 shadow-xl"><FileOutput size={16}/> Xuất đề Word</button>
                            <button onClick={() => setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar">
                        {/* HIỂN THỊ ĐỦ 3 PHẦN TRONG MODAL XEM ĐỀ */}
                        <div className="max-w-4xl mx-auto space-y-12">
                            {/* PHẦN I */}
                            <section>
                                <h4 className="font-black text-sm uppercase mb-4 border-l-4 border-blue-600 pl-3">PHẦN I. Câu trắc nghiệm nhiều phương án.</h4>
                                <div className="space-y-8">
                                    {viewingQuiz.questions.filter(q=>q.type==='mcq').map((q, i) => (
                                        <div key={q.id} className="text-[14px]">
                                            <div className="font-bold flex gap-2"><span className="shrink-0 text-blue-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                            <div className={`mt-3 grid gap-x-4 gap-y-2 ${q.options?.some(o=>o.length > 25) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>
                                                {q.options?.map((opt, oi) => (
                                                    <div key={oi} className="flex gap-1"><span className="font-bold">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/></div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* PHẦN II */}
                            <section className="pt-8 border-t border-slate-100">
                                <h4 className="font-black text-sm uppercase mb-4 border-l-4 border-purple-600 pl-3">PHẦN II. Câu trắc nghiệm đúng sai.</h4>
                                <div className="space-y-8">
                                    {viewingQuiz.questions.filter(q=>q.type==='group-tf').map((q, i) => (
                                        <div key={q.id} className="text-[14px]">
                                            <div className="font-bold flex gap-2"><span className="shrink-0 text-purple-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                            <div className="mt-2 space-y-1 pl-8">
                                                {q.subQuestions?.map((sq, si) => (
                                                    <div key={si} className="flex gap-2"><span className="font-bold">{String.fromCharCode(97+si)})</span><LatexText text={sq.text}/></div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* PHẦN III */}
                            <section className="pt-8 border-t border-slate-100">
                                <h4 className="font-black text-sm uppercase mb-4 border-l-4 border-emerald-600 pl-3">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4>
                                <div className="space-y-8">
                                    {viewingQuiz.questions.filter(q=>q.type==='short').map((q, i) => (
                                        <div key={q.id} className="text-[14px]">
                                            <div className="font-bold flex gap-2"><span className="shrink-0 text-emerald-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                            <div className="mt-2 pl-8 text-slate-400 italic">Đáp án: ...........................</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
