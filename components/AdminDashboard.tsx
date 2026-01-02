
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    uploadImage, getUsers, deleteUser, deleteResult 
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, FileText, BarChart3, Edit, 
    XCircle, BookOpen, Lightbulb, Users, ChevronRight, Database, 
    Bold, Italic, Underline, CornerDownLeft, Sigma, Info, Settings2, 
    FolderTree, Layers, Sparkles, Zap, BrainCircuit, Loader2, PieChart, 
    TrendingUp, Calendar, Trophy, Eye, Image as ImageIcon, X, Link as LinkIcon, 
    FileDown, Shuffle, CheckSquare, Clock as ClockIcon, Send, Search
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER FUNCTIONS ---
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<QuestionType, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

// --- HELPER COMPONENTS ---
interface ToolbarButtonProps { onClick: () => void; icon?: React.ReactNode; label?: string; tooltip: string; }
const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button type="button" onClick={onClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-medium text-xs flex items-center gap-1 border border-transparent hover:border-gray-300 transition-all min-w-[24px] justify-center" title={tooltip}>
        {icon} {label && <span>{label}</span>}
    </button>
);

interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; }
const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, rows, className }) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const text = el.value;
        const newVal = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        onChange(newVal);
    };
    return (
        <div className="flex flex-col border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border-b border-gray-100">
                <ToolbarBtn onClick={() => insertTag('<b>', '</b>')} icon={<Bold size={14}/>} tooltip="In đậm" />
                <ToolbarBtn onClick={() => insertTag('<i>', '</i>')} icon={<Italic size={14}/>} tooltip="In nghiêng" />
                <ToolbarBtn onClick={() => insertTag('<u>', '</u>')} icon={<Underline size={14}/>} tooltip="Gạch chân" />
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <ToolbarBtn onClick={() => insertTag('$', '$')} icon={<Sigma size={14}/>} tooltip="Công thức toán" />
                <ToolbarBtn onClick={() => insertTag('$\\frac{', '}$') } label="a/b" tooltip="Phân số" />
                <ToolbarBtn onClick={() => insertTag('$^{', '}$') } label="x²" tooltip="Số mũ" />
                <ToolbarBtn onClick={() => insertTag('$_{', '}$') } label="x₁" tooltip="Chỉ số" />
            </div>
            {rows ? (
                <textarea ref={inputRef as any} className={`w-full p-3 outline-none text-sm leading-relaxed resize-y ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as any} type="text" className={`w-full p-2 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students' | 'auto'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterQuizId, setResultFilterQuizId] = useState<string>('all');
  const [studentFilterGrade, setStudentFilterGrade] = useState<Grade | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo...');
  const [file, setFile] = useState<File | null>(null);

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [batchPoints, setBatchPoints] = useState<Record<QuestionType, string>>({ 'mcq': '0.25', 'group-tf': '1.0', 'short': '0.5' });
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<User | null>(null);
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 10, p2: 4, p3: 6, diff: 'Thông hiểu' });

  useEffect(() => { refreshData(); }, [activeTab]);

  useEffect(() => {
      if (viewingQuiz) setPreviewQuestions([...viewingQuiz.questions]);
  }, [viewingQuiz]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setStartTime(''); setDuration(90); setFile(null); setIsPublished(false);
  };

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    const filtered = quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade);
    filtered.forEach(q => {
      const cat = q.category || 'Chưa phân loại';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    });
    return groups;
  }, [quizzes, quizFilterGrade]);

  const stats = useMemo(() => {
    const filtered = results.filter(r => {
        const quiz = quizzes.find(q => q.id === r.quizId);
        const matchesQuiz = resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId;
        const matchesGrade = quizFilterGrade === 'all' || (quiz && quiz.grade === quizFilterGrade);
        return matchesQuiz && matchesGrade;
    });
    const total = filtered.length;
    const avg = total > 0 ? filtered.reduce((acc, curr) => acc + curr.score, 0) / total : 0;
    const top = total > 0 ? Math.max(...filtered.map(r => r.score)) : 0;
    return { total, avg, top };
  }, [results, resultFilterQuizId, quizFilterGrade, quizzes]);

  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên đề thi.");
    if (questions.length === 0) return alert("Cần ít nhất 1 câu hỏi.");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, startTime: quizType === 'test' ? startTime : undefined, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    await refreshData(); setActiveTab('list'); resetForm();
  };

  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); setGrade(q.grade); setStartTime(q.startTime || ''); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveTab('create');
  };

  const handleFileUpload = async () => {
    if (!file) return alert("Vui lòng chọn file PDF.");
    setIsProcessing(true);
    setLoadingMsg("AI đang phân tích cấu trúc 3 phần đề thi...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await parseQuestionsFromPDF(base64);
        setQuestions(sortQuestionsByType([...questions, ...extracted]));
        alert(`Đã trích xuất thành công ${extracted.length} câu hỏi.`);
        setActiveTab('create');
      } catch (e) { alert("Lỗi khi xử lý PDF."); } finally { setIsProcessing(false); }
    };
  };

  const handleAutoGenerate = async () => {
    if (!aiTopic.trim()) return alert("Nhập chủ đề cần soạn.");
    setIsProcessing(true);
    setLoadingMsg("AI đang soạn đề thi mới cho bạn...");
    try {
        const generated = await generateQuizFromPrompt({
            grade, category: "Chung", topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3, difficulty: aiConfig.diff
        });
        setQuestions(sortQuestionsByType([...questions, ...generated]));
        alert("Đã soạn thêm câu hỏi bằng AI.");
        setActiveTab('create');
    } catch (e) { alert("Lỗi soạn đề AI."); } finally { setIsProcessing(false); }
  };

  const handleShufflePreview = () => {
      const p1 = shuffleArray(previewQuestions.filter(q => q.type === 'mcq'));
      const p2 = shuffleArray(previewQuestions.filter(q => q.type === 'group-tf'));
      const p3 = shuffleArray(previewQuestions.filter(q => q.type === 'short'));
      setPreviewQuestions([...p1, ...p2, ...p3]);
      alert("Đã xáo trộn thứ tự các câu hỏi!");
  };

  const handleExportWord = (quizObj: Quiz, currentQuestions: Question[]) => {
    const getOptionChar = (i: number) => String.fromCharCode(65 + i);
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
          .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
          .section-title { font-weight: bold; margin-top: 15px; text-decoration: underline; }
          .question { margin-top: 10px; }
          .options { margin-left: 20px; }
          .ans-table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          .ans-table th, .ans-table td { border: 1px solid black; padding: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          TRƯỜNG THPT .........................<br/>
          ĐỀ ÔN TẬP: ${quizObj.title.toUpperCase()}<br/>
          Môn: Toán học | Thời gian: ${quizObj.durationMinutes} phút
        </div>
    `;

    const mcqs = currentQuestions.filter(q => q.type === 'mcq');
    if (mcqs.length > 0) {
      content += `<div class="section-title">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</div>`;
      mcqs.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div><div class="options">`;
        q.options?.forEach((opt, oi) => {
          content += `<b>${getOptionChar(oi)}.</b> ${opt}&nbsp;&nbsp;&nbsp;&nbsp;`;
        });
        content += `</div>`;
      });
    }

    const tfs = currentQuestions.filter(q => q.type === 'group-tf');
    if (tfs.length > 0) {
      content += `<div class="section-title">PHẦN II. Câu trắc nghiệm đúng sai.</div>`;
      tfs.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div>`;
        q.subQuestions?.forEach((sq, si) => {
          content += `<div class="options"><b>${String.fromCharCode(97 + si)})</b> ${sq.text}</div>`;
        });
      });
    }

    const shorts = currentQuestions.filter(q => q.type === 'short');
    if (shorts.length > 0) {
      content += `<div class="section-title">PHẦN III. Câu trắc nghiệm trả lời ngắn.</div>`;
      shorts.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div>`;
      });
    }

    content += `<br/><div class="header">--- HẾT ---</div></body></html>`;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_Thi_${quizObj.title.replace(/\s+/g, '_')}.doc`;
    link.click();
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => (
    <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-extrabold text-gray-800 uppercase text-sm tracking-widest">{label}</h3>
            <div className="flex gap-2">
                <button onClick={() => {
                    let q: Question;
                    if (type === 'mcq') q = { id: uuidv4(), type: 'mcq', text: '', points: batchPoints['mcq'], options: ['', '', '', ''], correctAnswer: '', solution: '' };
                    else if (type === 'group-tf') q = { id: uuidv4(), type: 'group-tf', text: '', points: batchPoints['group-tf'], subQuestions: [{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'}], solution: '' };
                    else q = { id: uuidv4(), type: 'short', text: '', points: batchPoints['short'], correctAnswer: '', solution: '' };
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">+ Thêm câu</button>
            </div>
        </div>
        <div className="p-4 space-y-4">
            {questions.filter(q => q.type === type).map((q) => {
                const globalIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="border rounded-xl p-4 space-y-4 bg-white hover:border-blue-200 transition-all shadow-sm">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 border-b border-dashed pb-2">
                            <span className="bg-gray-100 px-3 py-1 rounded text-blue-600">CÂU {globalIdx + 1}</span>
                            <div className="flex items-center gap-3">
                                <span>ĐIỂM:</span>
                                <input type="text" className="w-12 border rounded text-center py-1 font-black" value={q.points} onChange={e => {
                                    const n = [...questions]; n[globalIdx].points = e.target.value; setQuestions(n);
                                }} />
                                <button onClick={() => { if(confirm('Xóa câu này?')) { const n = [...questions]; n.splice(globalIdx, 1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Nội dung câu hỏi</label>
                            <RichTextEditor rows={3} value={q.text} onChange={v => { const n = [...questions]; n[globalIdx].text = v; setQuestions(n); }} />
                        </div>

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        <input type="radio" className="w-4 h-4" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[globalIdx].correctAnswer = opt; setQuestions(n); }} />
                                        <input type="text" className="flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-blue-300" value={opt} onChange={e => {
                                            const n = [...questions]; const o = [...(n[globalIdx].options||[])]; o[oi] = e.target.value; n[globalIdx].options = o; setQuestions(n);
                                        }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && q.subQuestions && (
                            <div className="space-y-3">
                                {q.subQuestions.map((sq, si) => (
                                    <div key={si} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <span className="text-xs font-bold text-blue-600">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 bg-white border rounded-lg p-2 text-sm" value={sq.text} onChange={e => {
                                            const n = [...questions]; const s = [...(n[globalIdx].subQuestions||[])]; s[si].text = e.target.value; n[globalIdx].subQuestions = s; setQuestions(n);
                                        }} />
                                        <div className="flex gap-1">
                                            {['True', 'False'].map(val => (
                                                <button key={val} onClick={() => {
                                                    const n = [...questions]; const s = [...(n[globalIdx].subQuestions||[])]; s[si].correctAnswer = val as any; n[globalIdx].subQuestions = s; setQuestions(n);
                                                }} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${sq.correctAnswer === val ? (val === 'True' ? 'bg-green-600 text-white' : 'bg-orange-600 text-white') : 'bg-white text-gray-300'}`}>
                                                    {val === 'True' ? 'Đúng' : 'Sai'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'short' && (
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center gap-3">
                                <span className="text-sm font-bold text-green-700">Đáp án (số):</span>
                                <input type="text" className="flex-1 border-2 border-green-200 rounded-lg p-2 font-black text-lg focus:border-green-500 outline-none" value={q.correctAnswer} onChange={e => {
                                    const n = [...questions]; n[globalIdx].correctAnswer = e.target.value; setQuestions(n);
                                }} />
                            </div>
                        )}

                        <div className="p-3 bg-yellow-50/50 rounded-xl border border-yellow-100">
                            <label className="text-[10px] font-black text-yellow-700 uppercase mb-2 flex items-center gap-1"><Lightbulb size={12}/> Lời giải chi tiết</label>
                            <RichTextEditor rows={2} value={q.solution || ''} onChange={v => { const n = [...questions]; n[globalIdx].solution = v; setQuestions(n); }} placeholder="Hướng dẫn giải..." />
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2 tracking-tighter"><Settings2 className="text-blue-600" size={32} /> EDUQUIZ <span className="text-blue-600">ADMIN</span></h1>
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border">
              {(['all', '10', '11', '12'] as const).map(g => (
                  <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizFilterGrade === g ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ KHỐI' : `LỚP ${g}`}</button>
              ))}
          </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'list' ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><List size={18} /> QUẢN LÝ ĐỀ</button>
        <button onClick={() => { setActiveTab('create'); if(!editingId && questions.length === 0) resetForm(); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'create' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Plus size={18} /> SOẠN ĐỀ MỚI</button>
        <button onClick={() => setActiveTab('auto')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'auto' ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BrainCircuit size={18} /> SOẠN ĐỀ AI</button>
        <button onClick={() => setActiveTab('import')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'import' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Upload size={18} /> NHẬP TỪ PDF</button>
        <button onClick={() => setActiveTab('results')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'results' ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={18} /> KẾT QUẢ</button>
        <button onClick={() => setActiveTab('students')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'students' ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Users size={18} /> HỌC SINH</button>
      </div>

      {activeTab === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {Object.keys(groupedQuizzes).length === 0 ? (
                  <div className="col-span-full py-20 text-center text-gray-400 font-bold border-2 border-dashed rounded-3xl">Chưa có đề thi nào trong mục này.</div>
              ) : (
                Object.keys(groupedQuizzes).map(cat => (
                    <div key={cat} className="col-span-full space-y-4">
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><FolderTree size={16}/> {cat}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedQuizzes[cat].map(q => (
                                <div key={q.id} className="bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-blue-200 transition-all flex flex-col justify-between group">
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                            <span className="text-[9px] font-black text-gray-300 uppercase">LỚP {q.grade}</span>
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{q.title}</h3>
                                        <p className="text-xs text-gray-400 mb-4">{q.questions.length} câu hỏi • {q.durationMinutes} phút</p>
                                    </div>
                                    <div className="flex gap-2 mt-2 pt-4 border-t border-dashed">
                                        <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all">XEM ĐỀ</button>
                                        <button onClick={() => handleEditQuiz(q)} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-xl transition-all"><Edit size={16}/></button>
                                        <button onClick={async () => { if(confirm('Xóa vĩnh viễn đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-300 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
              )}
          </div>
      )}

      {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
              <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                      <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter border-b pb-4">Thông tin cấu hình đề</h3>
                      <div className="space-y-4">
                          <input type="text" className="w-full text-2xl font-black border-none focus:ring-0 outline-none placeholder-gray-200" placeholder="TÊN ĐỀ THI KIỂM TRA" value={title} onChange={e => setTitle(e.target.value)} />
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chương / Mục</label>
                                  <input type="text" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold" placeholder="VD: Hàm số mũ" value={category} onChange={e => setCategory(e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Khối lớp</label>
                                  <select className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hình thức</label>
                                  <select className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Thời gian (phút)</label>
                                  <input type="number" className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm font-bold" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                              </div>
                          </div>
                      </div>
                  </div>
                  {renderPartEditor('mcq', 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn', 'border-blue-500')}
                  {renderPartEditor('group-tf', 'Phần II: Câu trắc nghiệm đúng sai', 'border-purple-500')}
                  {renderPartEditor('short', 'Phần III: Câu trắc nghiệm trả lời ngắn', 'border-green-500')}
              </div>
              <div className="lg:col-span-1">
                  <div className="sticky top-24 bg-white p-8 rounded-3xl border border-gray-100 shadow-2xl text-center space-y-6">
                      <div className="flex justify-center"><div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><Sparkles size={32}/></div></div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Tóm tắt cấu trúc</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase">Câu hỏi</p><p className="text-2xl font-black text-blue-600">{questions.length}</p></div>
                          <div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase">Thang điểm</p><p className="text-2xl font-black text-blue-600">{questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</p></div>
                      </div>
                      <label className="flex items-center justify-center gap-2 cursor-pointer bg-blue-50 py-3 rounded-2xl font-bold text-sm text-blue-700">
                          <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5" /> CÔNG KHAI ĐỀ THI
                      </label>
                      <button onClick={handleSaveQuiz} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl transform active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={18}/> HOÀN TẤT & LƯU ĐỀ</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'results' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><TrendingUp size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase">Số lượt thi</p><p className="text-3xl font-black">{stats.total}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
                      <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><PieChart size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase">Điểm trung bình</p><p className="text-3xl font-black">{stats.avg.toFixed(2)}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
                      <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><Trophy size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase">Điểm cao nhất</p><p className="text-3xl font-black">{stats.top.toFixed(2)}</p></div>
                  </div>
              </div>

              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">Danh sách kết quả rèn luyện</h3>
                      <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase">Lọc theo đề:</label>
                          <select className="border-none bg-white rounded-xl text-xs font-bold p-2 shadow-sm focus:ring-blue-500" value={resultFilterQuizId} onChange={e => setResultFilterQuizId(e.target.value)}>
                              <option value="all">Tất cả đề thi</option>
                              {quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-white border-b text-[10px] font-black uppercase text-gray-400 tracking-widest">
                              <tr>
                                  <th className="px-6 py-4">Thí sinh</th>
                                  <th className="px-6 py-4">Đề thi</th>
                                  <th className="px-6 py-4">Ngày thi</th>
                                  <th className="px-6 py-4 text-right">Điểm số</th>
                                  <th className="px-6 py-4 text-center">Xóa</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {results.filter(r => (resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId) && (quizFilterGrade === 'all' || quizzes.find(q => q.id === r.quizId)?.grade === quizFilterGrade)).length === 0 ? (
                                  <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold italic">Chưa có kết quả rèn luyện nào.</td></tr>
                              ) : (
                                results.filter(r => (resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId) && (quizFilterGrade === 'all' || quizzes.find(q => q.id === r.quizId)?.grade === quizFilterGrade)).map(r => (
                                    <tr key={r.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-gray-800">{r.studentName}</td>
                                        <td className="px-6 py-4 text-gray-500">{quizzes.find(q => q.id === r.quizId)?.title || "Đề đã xóa"}</td>
                                        <td className="px-6 py-4 text-gray-400 font-medium">{format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm")}</td>
                                        <td className="px-6 py-4 text-right font-black text-lg text-blue-600">{r.score.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center"><button onClick={async () => { if(confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-gray-200 group-hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {viewingQuiz && (
          <div className="fixed inset-0 bg-black/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><BookOpen size={24}/></div>
                          <div><h3 className="text-xl font-black uppercase tracking-tight">{viewingQuiz.title}</h3><p className="text-[10px] font-bold text-blue-300 uppercase">Khối {viewingQuiz.grade} • {viewingQuiz.questions.length} câu</p></div>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={handleShufflePreview} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-md"><Shuffle size={16}/> Xáo đề</button>
                          <button onClick={() => handleExportWord(viewingQuiz, previewQuestions)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-md"><FileDown size={16}/> Xuất Word</button>
                          <button onClick={() => setViewingQuiz(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><XCircle size={28}/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
                      <div className="max-w-3xl mx-auto bg-white p-12 shadow-xl rounded-2xl min-h-screen border space-y-12">
                          <div className="text-center pb-8 border-b-2 border-slate-50">
                              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">{viewingQuiz.title}</h2>
                              <div className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em]">Khối {viewingQuiz.grade} • Thời gian: {viewingQuiz.durationMinutes} phút</div>
                          </div>

                          {previewQuestions.filter(q => q.type === 'mcq').length > 0 && (
                              <div className="space-y-6">
                                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-4 border-blue-600 pl-3 bg-blue-50 py-2">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn</h4>
                                  <div className="space-y-8">
                                      {previewQuestions.filter(q => q.type === 'mcq').map((q, i) => (
                                          <div key={q.id}>
                                              <div className="font-bold text-gray-800 mb-3"><span className="text-blue-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 ml-6">
                                                  {q.options?.map((opt, oi) => (
                                                      <div key={oi} className="text-sm text-gray-700"><span className="font-bold mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>
                                                  ))}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {previewQuestions.filter(q => q.type === 'group-tf').length > 0 && (
                              <div className="space-y-6">
                                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-4 border-purple-600 pl-3 bg-purple-50 py-2">PHẦN II. Câu trắc nghiệm đúng sai</h4>
                                  <div className="space-y-8">
                                      {previewQuestions.filter(q => q.type === 'group-tf').map((q, i) => (
                                          <div key={q.id}>
                                              <div className="font-bold text-gray-800 mb-4"><span className="text-purple-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                              <div className="space-y-2 ml-6">
                                                  {q.subQuestions?.map((sq, si) => (
                                                      <div key={si} className="text-sm text-gray-700 flex gap-2">
                                                          <span className="font-bold text-gray-400 shrink-0">{String.fromCharCode(97+si)})</span>
                                                          <LatexText text={sq.text}/>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {previewQuestions.filter(q => q.type === 'short').length > 0 && (
                              <div className="space-y-6">
                                  <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-4 border-green-600 pl-3 bg-green-50 py-2">PHẦN III. Câu trắc nghiệm trả lời ngắn</h4>
                                  <div className="space-y-8">
                                      {previewQuestions.filter(q => q.type === 'short').map((q, i) => (
                                          <div key={q.id}>
                                              <div className="font-bold text-gray-800 mb-3"><span className="text-green-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'auto' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-10 rounded-3xl shadow-xl border border-purple-100 space-y-8">
                  <div className="flex items-center gap-4 border-b pb-6">
                      <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center shadow-inner"><Sparkles size={32}/></div>
                      <div><h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Soạn đề bằng Trí tuệ nhân tạo (AI)</h2><p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tự động bóc tách kiến thức theo yêu cầu</p></div>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-3">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Yêu cầu soạn thảo (Chủ đề, kiến thức...)</label>
                          <textarea className="w-full h-40 p-6 bg-purple-50/20 border-2 border-purple-50 rounded-2xl focus:border-purple-300 outline-none transition-all text-lg font-medium" placeholder="Ví dụ: Đề kiểm tra chương Đạo hàm lớp 11, mức độ thông hiểu, tập trung vào công thức cơ bản..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-white p-4 rounded-2xl border shadow-sm text-center"><p className="text-[9px] font-black text-gray-400 uppercase mb-2">Số câu Phần I</p><input type="number" className="w-full text-center font-black text-xl border-none focus:ring-0" value={aiConfig.p1} onChange={e => setAiConfig({...aiConfig, p1: parseInt(e.target.value)||0})} /></div>
                          <div className="bg-white p-4 rounded-2xl border shadow-sm text-center"><p className="text-[9px] font-black text-gray-400 uppercase mb-2">Số câu Phần II</p><input type="number" className="w-full text-center font-black text-xl border-none focus:ring-0" value={aiConfig.p2} onChange={e => setAiConfig({...aiConfig, p2: parseInt(e.target.value)||0})} /></div>
                          <div className="bg-white p-4 rounded-2xl border shadow-sm text-center"><p className="text-[9px] font-black text-gray-400 uppercase mb-2">Số câu Phần III</p><input type="number" className="w-full text-center font-black text-xl border-none focus:ring-0" value={aiConfig.p3} onChange={e => setAiConfig({...aiConfig, p3: parseInt(e.target.value)||0})} /></div>
                      </div>
                      <button onClick={handleAutoGenerate} disabled={isProcessing} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
                          {isProcessing ? <Loader2 className="animate-spin" /> : <Zap size={20}/>} {isProcessing ? "AI ĐANG SOẠN THẢO..." : "BẮT ĐẦU SOẠN ĐỀ AI"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-10 rounded-3xl shadow-xl border border-indigo-100 flex flex-col items-center text-center space-y-8">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner"><Upload size={40}/></div>
                  <div><h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Nhập đề từ File PDF</h2><p className="text-sm font-medium text-gray-400 mt-2 max-w-sm">Hệ thống AI sẽ tự động nhận diện các phần thi MCQ, Đúng/Sai và Trả lời ngắn từ file PDF của bạn.</p></div>
                  <div className="w-full max-w-sm p-8 border-2 border-dashed border-indigo-200 rounded-3xl hover:border-indigo-400 transition-colors cursor-pointer group bg-indigo-50/30 relative">
                      <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setFile(e.target.files?.[0] || null)} />
                      <div className="flex flex-col items-center gap-2">
                          <FileText className="text-indigo-400 group-hover:scale-110 transition-transform" size={48}/>
                          <span className="font-bold text-indigo-600 truncate px-4">{file ? file.name : "CHỌN FILE PDF ĐỂ TẢI LÊN"}</span>
                      </div>
                  </div>
                  <button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full max-w-md bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>} {isProcessing ? "AI ĐANG PHÂN TÍCH FILE..." : "TIẾN HÀNH TRÍCH XUẤT"}
                  </button>
              </div>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
              <div className="relative">
                  <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600"><Sparkles size={36}/></div>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mt-12 mb-4 uppercase tracking-tighter">{loadingMsg}</h2>
              <p className="text-gray-400 font-black animate-pulse text-[10px] tracking-[0.2em] uppercase">Vui lòng không đóng trình duyệt lúc này</p>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
