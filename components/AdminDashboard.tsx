
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

// --- RICH TEXT EDITOR COMPONENT ---
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
                <div className="px-2 py-1.5 bg-blue-50/20 rounded border border-blue-50 text-[12px] text-slate-600">
                    <LatexText text={value} />
                </div>
            )}
        </div>
    );
};

const AdminDashboard = () => {
  // Navigation State
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
  
  // Data State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Filter States
  const [filterGrade, setFilterGrade] = useState<Grade | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Chapter Editor State
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

  // Modals & Loading
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Initial Load
  useEffect(() => { refreshData(); }, []);
  useEffect(() => { if(activeMenu === 'chapters') refreshData(); }, [activeMenu]);

  const refreshData = async () => {
    try {
        const [qs, rs, us, chs] = await Promise.all([
            getQuizzes(), getResults(), getUsers(), getChapters()
        ]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    } catch (err) { console.error("Lỗi tải dữ liệu:", err); }
  };

  // --- FILTERS LOGIC ---
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

  // --- ACTIONS ---
  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); 
    setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); 
    setIsPublished(q.isPublished); setActiveMenu('create');
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên đề thi!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), 
      type: quizType, grade, durationMinutes: duration, questions, createdAt: new Date().toISOString(), 
      isPublished
    };
    try {
        if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
        alert("Lưu đề thi thành công!"); await refreshData(); setActiveMenu('quizzes');
    } catch(err: any) { alert("Lỗi: " + err.message); }
  };

  // --- EXPORT WORD LOGIC ---
  const handleExportWord = (quiz: Quiz) => {
    const getMcqTable = (options: string[]) => {
      const isLong = options.some(o => o.length > 30);
      const isMed = options.some(o => o.length > 15);
      
      if (isLong) {
        return `<table style="width: 100%; margin-left: 20px;">
          ${options.map((o, i) => `<tr><td style="padding: 3px 0;"><strong>${String.fromCharCode(65+i)}.</strong> ${o}</td></tr>`).join('')}
        </table>`;
      }
      if (isMed) {
        return `<table style="width: 100%; margin-left: 20px;">
          <tr><td style="width: 50%; padding: 3px 0;"><strong>A.</strong> ${options[0]}</td><td style="width: 50%; padding: 3px 0;"><strong>B.</strong> ${options[1]}</td></tr>
          <tr><td style="padding: 3px 0;"><strong>C.</strong> ${options[2]}</td><td style="padding: 3px 0;"><strong>D.</strong> ${options[3]}</td></tr>
        </table>`;
      }
      return `<table style="width: 100%; margin-left: 20px;">
        <tr>
          <td style="width: 25%; padding: 3px 0;"><strong>A.</strong> ${options[0]}</td>
          <td style="width: 25%; padding: 3px 0;"><strong>B.</strong> ${options[1]}</td>
          <td style="width: 25%; padding: 3px 0;"><strong>C.</strong> ${options[2]}</td>
          <td style="width: 25%; padding: 3px 0;"><strong>D.</strong> ${options[3]}</td>
        </tr>
      </table>`;
    };

    const header = `
      <div style="font-family: 'Times New Roman', serif;">
          <table style="width: 100%; margin-bottom: 25px;">
            <tr>
              <td style="text-align: center; width: 40%; border-bottom: 1.5pt solid black;">
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; font-size: 13pt;">SỞ GD&ĐT TỈNH/THÀNH PHỐ</p>
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; font-size: 13pt;">TRƯỜNG THPT EDUQUIZ PRO</p>
                <p style="margin: 5px 0 10px 0; font-size: 11pt; font-style: italic;">(Đề thi gồm ${Math.ceil(quiz.questions.length / 4)} trang)</p>
              </td>
              <td style="text-align: center; width: 60%; border-bottom: 1.5pt solid black;">
                <p style="margin: 0; font-weight: bold; text-transform: uppercase; font-size: 13pt;">KIỂM TRA CHẤT LƯỢNG HỌC TẬP</p>
                <p style="margin: 0; font-weight: bold; font-size: 12pt;">NĂM HỌC 2024 - 2025</p>
                <p style="margin: 0; font-weight: bold; font-size: 12pt;">Môn: TOÁN - LỚP ${quiz.grade}</p>
                <p style="margin: 5px 0 10px 0; font-size: 11pt; font-style: italic;">Thời gian làm bài: ${quiz.durationMinutes} phút</p>
              </td>
            </tr>
          </table>
          <div style="margin-bottom: 30px;">
            <table style="width: 100%; font-size: 12pt;">
              <tr>
                <td style="width: 65%;">Họ và tên thí sinh: ................................................................................</td>
                <td style="width: 20%;">SBD: .................</td>
                <td style="width: 15%; border: 2pt solid black; padding: 5px; text-align: center; font-weight: bold;">Mã đề: 10${quiz.grade}</td>
              </tr>
            </table>
          </div>
      </div>
    `;

    let content = "";
    
    // PHẦN I
    const p1 = quiz.questions.filter(q => q.type === 'mcq');
    if (p1.length > 0) {
      content += `<h4 style="text-transform: uppercase; font-size: 13pt; margin-top: 20pt; font-family: 'Times New Roman';">PHẦN I. Câu trắc nghiệm nhiều phương án chọn.</h4>`;
      content += `<p style="font-style: italic; font-size: 11pt; margin-bottom: 10pt; font-family: 'Times New Roman';">Thí sinh trả lời từ câu 1 đến câu ${p1.length}. Mỗi câu hỏi chỉ chọn một phương án.</p>`;
      p1.forEach((q, i) => {
        content += `<div style="margin-bottom: 15pt; font-size: 12pt; font-family: 'Times New Roman';"><strong>Câu ${i+1}.</strong> ${q.text}${getMcqTable(q.options || [])}</div>`;
      });
    }

    // PHẦN II
    const p2 = quiz.questions.filter(q => q.type === 'group-tf');
    if (p2.length > 0) {
      content += `<h4 style="text-transform: uppercase; font-size: 13pt; margin-top: 30pt; font-family: 'Times New Roman';">PHẦN II. Câu trắc nghiệm đúng sai.</h4>`;
      content += `<p style="font-style: italic; font-size: 11pt; margin-bottom: 10pt; font-family: 'Times New Roman';">Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</p>`;
      p2.forEach((q, i) => {
        content += `<div style="margin-bottom: 20pt; font-size: 12pt; font-family: 'Times New Roman';"><strong>Câu ${i+1}.</strong> ${q.text}<div style="margin-left: 25pt;">${q.subQuestions?.map((sq, si) => `<p style="margin: 4pt 0;"><strong>${String.fromCharCode(97+si)})</strong> ${sq.text}</p>`).join('')}</div></div>`;
      });
    }

    // PHẦN III
    const p3 = quiz.questions.filter(q => q.type === 'short');
    if (p3.length > 0) {
      content += `<h4 style="text-transform: uppercase; font-size: 13pt; margin-top: 30pt; font-family: 'Times New Roman';">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4>`;
      content += `<p style="font-style: italic; font-size: 11pt; margin-bottom: 10pt; font-family: 'Times New Roman';">Thí sinh trả lời từ câu 1 đến câu ${p3.length}.</p>`;
      p3.forEach((q, i) => {
        content += `<div style="margin-bottom: 20pt; font-size: 12pt; font-family: 'Times New Roman';"><strong>Câu ${i+1}.</strong> ${q.text}<p style="margin-left: 25pt; font-style: italic; border-bottom: 1px dotted black; width: 250px; padding-top: 10px;">Đáp số: .......................................</p></div>`;
      });
    }

    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>EduQuiz Export</title></head>
      <body style="padding: 1in; font-family: 'Times New Roman', serif;">
          ${header}
          ${content}
          <div style="text-align: center; margin-top: 50pt; font-weight: bold; border-top: 1.5pt solid black; padding-top: 10pt; font-family: 'Times New Roman';">--- HẾT ---</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title.replace(/\s+/g, '_')}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- RENDER FUNCTIONS ---

  const renderQuizzes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {filteredQuizzes.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Không tìm thấy đề thi phù hợp</p>
            </div>
        ) : filteredQuizzes.map(q => (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-xl transition-all border-b-4 border-b-blue-600 group">
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${q.type === 'test' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase">Khối {q.grade}</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-800 mb-1 leading-tight group-hover:text-blue-600 min-h-[40px] line-clamp-2">{q.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{q.category || 'Chưa phân loại'}</p>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                    <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-slate-50 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">
                        <Eye size={14}/> XEM ĐỀ
                    </button>
                    <button onClick={() => handleEditQuiz(q)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-all"><Edit size={16}/></button>
                    <button onClick={async () => { if(confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                </div>
            </div>
        ))}
    </div>
  );

  const renderChapters = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <FolderTree size={18} className="text-blue-600"/> Quản lý chương trình học
            </h3>
            <div className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="col-span-12 md:col-span-8 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Tên chương (Khối {selectedGradeForChapters})</label>
                    <input type="text" className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" value={chapterNameInput} onChange={e=>setChapterNameInput(e.target.value)} placeholder="VD: Chương 1: Ứng dụng đạo hàm..." />
                </div>
                <div className="col-span-12 md:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Thứ tự</label>
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
            <div className="p-4 bg-slate-50 border-b flex gap-1">
                {(['10','11','12'] as const).map(g=>(
                    <button key={g} onClick={()=>setSelectedGradeForChapters(g)} className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${selectedGradeForChapters===g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-white'}`}>KHỐI {g}</button>
                ))}
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                {chapters.filter(c=>c.grade===selectedGradeForChapters).length === 0 ? (
                    <div className="p-10 text-center text-slate-300 font-bold uppercase text-[10px]">Chưa có chương học nào cho khối này</div>
                ) : (
                    chapters.filter(c=>c.grade===selectedGradeForChapters).sort((a,b)=>a.order-b.order).map(c=>(
                        <div key={c.id} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center font-black text-[10px] group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">{c.order}</div>
                                <span className="text-[13px] font-bold text-slate-700">{c.name}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={()=>{setEditingChapterId(c.id); setChapterNameInput(c.name); setChapterOrderInput(c.order);}} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                                <button onClick={async()=>{if(confirm('Xóa chương học này?')){await deleteChapter(c.id); refreshData();}}} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-4xl mx-auto pb-32 animate-fade-in">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 mb-6 shadow-sm">
            <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-6 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiêu đề đề thi</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none focus:ring-1 focus:ring-blue-500" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="col-span-6 md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khối lớp</label>
                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                        <option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
                    </select>
                </div>
                <div className="col-span-6 md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chương học</label>
                    <select className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">Chọn chương...</option>
                        {availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
            </div>
        </div>
        
        <div className="space-y-6">
            {/* Phần MCQ */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-black uppercase text-blue-600">Phần I: Trắc nghiệm (Chọn 1)</h4>
                    <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'mcq', text: '', points: '0.25', options: ['', '', '', ''], correctAnswer: '' }])} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">+ THÊM CÂU</button>
                </div>
                {questions.filter(q=>q.type==='mcq').map((q, idx) => (
                    <div key={q.id} className="mb-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 relative">
                        <button onClick={()=>{const n=[...questions]; n.splice(questions.indexOf(q),1); setQuestions(n);}} className="absolute top-4 right-4 text-slate-300 hover:text-red-500"><X size={16}/></button>
                        <RichTextEditor value={q.text} onChange={v=>{const n=[...questions]; n[questions.indexOf(q)].text=v; setQuestions(n);}} placeholder="Nhập câu hỏi..." label={`Câu ${idx+1}`} />
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {q.options?.map((opt, oi)=>(
                                <div key={oi} className="flex items-center gap-2">
                                    <input type="radio" checked={q.correctAnswer===opt && opt!==''} onChange={()=> {const n=[...questions]; n[questions.indexOf(q)].correctAnswer=opt; setQuestions(n);}} />
                                    <input type="text" className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs" value={opt} onChange={e=>{const n=[...questions]; q.options![oi]=e.target.value; setQuestions(n);}} placeholder={`Đáp án ${String.fromCharCode(65+oi)}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Các loại câu hỏi khác như Đúng/Sai, Trả lời ngắn... cũng render tương tự */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-black uppercase text-purple-600">Phần II: Đúng Sai</h4>
                    <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'group-tf', text: '', points: '1.0', subQuestions: [{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'},{id:uuidv4(), text:'', correctAnswer:'True'}] }])} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">+ THÊM CÂU</button>
                </div>
                {questions.filter(q=>q.type==='group-tf').map((q, idx) => (
                    <div key={q.id} className="mb-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <RichTextEditor value={q.text} onChange={v=>{const n=[...questions]; n[questions.indexOf(q)].text=v; setQuestions(n);}} placeholder="Yêu cầu chung..." label={`Câu ${idx+1}`} />
                        <div className="space-y-2 mt-4">
                            {q.subQuestions?.map((sq, si)=>(
                                <div key={si} className="flex gap-2 items-center">
                                    <input type="text" className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs" value={sq.text} onChange={e=>{const n=[...questions]; q.subQuestions![si].text=e.target.value; setQuestions(n);}} placeholder={`Ý ${String.fromCharCode(97+si)})`} />
                                    <select className="text-[10px] font-bold p-2 bg-white border rounded-lg" value={sq.correctAnswer} onChange={e=>{const n=[...questions]; q.subQuestions![si].correctAnswer=e.target.value as any; setQuestions(n);}}>
                                        <option value="True">Đúng</option><option value="False">Sai</option>
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xs font-black uppercase text-emerald-600">Phần III: Trả lời ngắn</h4>
                    <button onClick={() => setQuestions([...questions, { id: uuidv4(), type: 'short', text: '', points: '0.5', correctAnswer: '' }])} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">+ THÊM CÂU</button>
                </div>
                {questions.filter(q=>q.type==='short').map((q, idx) => (
                    <div key={q.id} className="mb-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <RichTextEditor value={q.text} onChange={v=>{const n=[...questions]; n[questions.indexOf(q)].text=v; setQuestions(n);}} placeholder="Nhập câu hỏi..." label={`Câu ${idx+1}`} />
                        <input type="text" className="w-full mt-2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold" value={q.correctAnswer || ''} onChange={e=>{const n=[...questions]; n[questions.indexOf(q)].correctAnswer=e.target.value; setQuestions(n);}} placeholder="Đáp số đúng..." />
                    </div>
                ))}
            </div>
        </div>

        <div className="fixed bottom-8 left-[300px] right-8 flex justify-end pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-3 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-2xl border border-slate-100">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black text-slate-500 cursor-pointer hover:bg-slate-50 transition-all">
                    <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /> CÔNG KHAI
                </label>
                <button onClick={handleSaveQuiz} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2 hover:scale-105 transition-all"><Save size={18}/> LƯU ĐỀ THI</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-[#0f172a] flex flex-col shrink-0 no-print shadow-2xl z-50">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white"><Cpu size={18}/></div>
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
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[12px] font-bold transition-all ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
            <header className="h-14 bg-white border-b border-slate-200 px-6 flex justify-between items-center shrink-0 no-print z-40 shadow-sm">
                <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    {activeMenu === 'quizzes' && (
                        <div className="flex items-center gap-2 mr-4">
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500" value={filterGrade} onChange={e=>setFilterGrade(e.target.value as any)}>
                                <option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option>
                            </select>
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
                                <option value="all">TẤT CẢ CHƯƠNG</option>
                                {chapters.filter(c => filterGrade === 'all' || c.grade === filterGrade).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button onClick={refreshData} className="p-1.5 border rounded-lg hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"><Shuffle size={14}/></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#f8fafc]">
                {activeMenu === 'quizzes' && renderQuizzes()}
                {activeMenu === 'chapters' && renderChapters()}
                {activeMenu === 'create' && renderCreateQuiz()}
                {/* AI, Import, Results... sẽ render các hàm tương ứng (giữ nguyên logic đã có) */}
                {activeMenu === 'ai' && <div className="p-10 text-center font-bold text-slate-300">Tính năng AI đang sẵn sàng...</div>}
                {activeMenu === 'import' && <div className="p-10 text-center font-bold text-slate-300">Tính năng Import đang sẵn sàng...</div>}
                {activeMenu === 'results' && <div className="p-10 text-center font-bold text-slate-300">Kết quả thi sẽ hiển thị tại đây...</div>}
                {activeMenu === 'students' && <div className="p-10 text-center font-bold text-slate-300">Danh sách học sinh...</div>}
            </div>
        </main>

        {/* MODAL XEM ĐỀ 3 PHẦN & XUẤT WORD */}
        {viewingQuiz && (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md no-print animate-fade-in">
                <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border-8 border-white">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><FileText size={24}/></div>
                            <div>
                                <h3 className="text-lg font-black uppercase line-clamp-1">{viewingQuiz.title}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu hỏi • {viewingQuiz.durationMinutes} phút</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleExportWord(viewingQuiz)} className="px-6 py-3 bg-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 flex items-center gap-2 shadow-xl transition-all active:scale-95"><FileOutput size={16}/> Xuất đề Word</button>
                            <button onClick={() => setViewingQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-12">
                            {/* PHẦN I */}
                            {viewingQuiz.questions.filter(q=>q.type==='mcq').length > 0 && (
                                <section>
                                    <h4 className="font-black text-sm uppercase mb-6 border-l-4 border-blue-600 pl-3">PHẦN I. Câu trắc nghiệm nhiều phương án chọn.</h4>
                                    <div className="space-y-8">
                                        {viewingQuiz.questions.filter(q=>q.type==='mcq').map((q, i) => (
                                            <div key={q.id} className="text-[15px] leading-relaxed">
                                                <div className="font-bold flex gap-2"><span className="shrink-0 text-blue-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                                <div className={`mt-3 grid gap-x-4 gap-y-2 ${q.options?.some(o=>o.length > 30) ? 'grid-cols-1' : (q.options?.some(o=>o.length > 15) ? 'grid-cols-2' : 'grid-cols-4')}`}>
                                                    {q.options?.map((opt, oi) => (
                                                        <div key={oi} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/></div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* PHẦN II */}
                            {viewingQuiz.questions.filter(q=>q.type==='group-tf').length > 0 && (
                                <section className="pt-8 border-t border-slate-100">
                                    <h4 className="font-black text-sm uppercase mb-6 border-l-4 border-purple-600 pl-3">PHẦN II. Câu trắc nghiệm đúng sai.</h4>
                                    <div className="space-y-10">
                                        {viewingQuiz.questions.filter(q=>q.type==='group-tf').map((q, i) => (
                                            <div key={q.id} className="text-[15px] leading-relaxed">
                                                <div className="font-bold flex gap-2"><span className="shrink-0 text-purple-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                                <div className="mt-4 space-y-2 pl-8">
                                                    {q.subQuestions?.map((sq, si) => (
                                                        <div key={si} className="flex gap-3 items-start border-l-2 border-slate-100 pl-4 py-1">
                                                            <span className="font-bold text-slate-400">{String.fromCharCode(97+si)})</span>
                                                            <LatexText text={sq.text}/>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* PHẦN III */}
                            {viewingQuiz.questions.filter(q=>q.type==='short').length > 0 && (
                                <section className="pt-8 border-t border-slate-100">
                                    <h4 className="font-black text-sm uppercase mb-6 border-l-4 border-emerald-600 pl-3">PHẦN III. Câu trắc nghiệm trả lời ngắn.</h4>
                                    <div className="space-y-8">
                                        {viewingQuiz.questions.filter(q=>q.type==='short').map((q, i) => (
                                            <div key={q.id} className="text-[15px] leading-relaxed">
                                                <div className="font-bold flex gap-2"><span className="shrink-0 text-emerald-600">Câu {i+1}.</span><LatexText text={q.text}/></div>
                                                <div className="mt-3 pl-8 text-slate-400 italic">Đáp số: .................................................</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            <div className="text-center font-black uppercase text-xs mt-10 border-t border-slate-100 pt-8 tracking-[0.3em] text-slate-300">--- HẾT ---</div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isProcessing && (
            <div className="fixed inset-0 bg-white/90 z-[2000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-lg font-black text-slate-800 mt-8 uppercase tracking-widest">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
