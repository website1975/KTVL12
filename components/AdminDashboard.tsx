
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteQuiz as deleteQuizStorage 
} from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, BarChart3, Edit, 
    XCircle, BookOpen, Lightbulb, Database, 
    Bold, Italic, Underline, CornerDownLeft, Sigma, Settings2, 
    Sparkles, BrainCircuit, FileDown, Shuffle, Check, Search
} from 'lucide-react';
import LatexText from './LatexText';

// Helper to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

// Sort questions by their type for logical ordering
const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<string, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; }

// Fix: Simplified component declaration to avoid React.FC pitfalls and potential "() => void" type mismatch errors
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
        <div className="flex flex-col border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border-b border-gray-100">
                <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1 hover:bg-gray-200 rounded" title="In đậm"><Bold size={14}/></button>
                <button type="button" onClick={() => insertTag('<i>', '</i>')} className="p-1 hover:bg-gray-200 rounded" title="In nghiêng"><Italic size={14}/></button>
                <button type="button" onClick={() => insertTag('<u>', '</u>')} className="p-1 hover:bg-gray-200 rounded" title="Gạch chân"><Underline size={14}/></button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => insertTag('$', '$')} className="p-1 hover:bg-gray-200 rounded" title="Toán học"><Sigma size={14}/></button>
                <button type="button" onClick={() => insertTag('<br/>')} className="p-1 hover:bg-gray-200 rounded" title="Xuống dòng"><CornerDownLeft size={14}/></button>
            </div>
            {rows ? (
                <textarea ref={inputRef as any} className={`w-full p-3 outline-none text-sm leading-relaxed resize-y ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as any} type="text" className={`w-full p-2 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            )}
        </div>
    );
};

// Fix: Simplified component declaration and addressed the "no default export" error in App.tsx by ensuring valid syntax
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students' | 'auto'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');

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

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankGrade, setBankGrade] = useState<Grade>('12');
  const [bankQuizId, setBankQuizId] = useState('');

  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

  useEffect(() => { refreshData(); }, [activeTab]);
  useEffect(() => { if (viewingQuiz) setPreviewQuestions([...viewingQuiz.questions]); }, [viewingQuiz]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setStartTime(''); setDuration(90); setIsPublished(false);
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

  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên đề thi.");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, startTime: quizType === 'test' ? startTime : undefined, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    await refreshData(); setActiveTab('list'); resetForm();
  };

  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); setGrade(q.grade); setStartTime(q.startTime || ''); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveTab('create');
  };

  const handleShufflePreview = () => {
    setPreviewQuestions(shuffleArray([...previewQuestions]));
  };

  const handleExportWord = (quiz: Quiz, qs: Question[]) => {
    const getChar = (i: number) => String.fromCharCode(65 + i);
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
          .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
          .section-title { font-weight: bold; margin-top: 20px; text-decoration: underline; background: #f9f9f9; padding: 5px; }
          .question { margin-top: 15px; text-align: justify; }
          .options { margin-left: 20px; }
          .solution { margin-top: 10px; font-style: italic; color: #444; border-left: 3px solid #ddd; padding-left: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          TRƯỜNG THPT .........................<br/>
          ĐỀ ÔN TẬP: ${quiz.title.toUpperCase()}<br/>
          Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút
        </div>
    `;

    const p1 = qs.filter(q => q.type === 'mcq');
    if (p1.length > 0) {
      content += `<div class="section-title">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.</div>`;
      p1.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div><div class="options">`;
        q.options?.forEach((opt, oi) => { content += `<b>${getChar(oi)}.</b> ${opt}&nbsp;&nbsp;&nbsp;&nbsp;`; });
        content += `</div>`;
      });
    }

    const p2 = qs.filter(q => q.type === 'group-tf');
    if (p2.length > 0) {
      content += `<div class="section-title">PHẦN II. Câu trắc nghiệm đúng sai.</div>`;
      p2.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div>`;
        q.subQuestions?.forEach((sq, si) => { content += `<div style="margin-left: 20px;"><b>${String.fromCharCode(97 + si)})</b> ${sq.text}</div>`; });
      });
    }

    const p3 = qs.filter(q => q.type === 'short');
    if (p3.length > 0) {
      content += `<div class="section-title">PHẦN III. Câu trắc nghiệm trả lời ngắn.</div>`;
      p3.forEach((q, i) => { content += `<div class="question"><b>Câu ${i + 1}.</b> ${q.text}</div>`; });
    }

    content += `<div style="page-break-before: always;"></div><div class="header">HƯỚNG DẪN GIẢI CHI TIẾT</div>`;
    qs.forEach((q, i) => {
        content += `<div class="question"><b>Câu ${i+1}.</b> ${q.solution ? `<div class="solution">${q.solution}</div>` : '<i>(Chưa có lời giải)</i>'}</div>`;
    });

    content += `</body></html>`;
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_Thi_${quiz.title.replace(/\s+/g, '_')}.doc`;
    link.click();
  };

  const renderEditor = (type: QuestionType, label: string, colorClass: string) => (
    <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-2xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">{label}</h3>
            <div className="flex gap-2">
                <button onClick={() => { setBankGrade(grade); setShowBankModal(true); }} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100 flex items-center gap-1 hover:bg-indigo-100 transition-all"><Database size={14}/> Ngân hàng</button>
                <button onClick={() => {
                    let q: Question = { id: uuidv4(), type, text: '', points: type === 'mcq' ? '0.25' : (type === 'group-tf' ? '1.0' : '0.5'), solution: '' };
                    if (type === 'mcq') q.options = ['', '', '', ''];
                    if (type === 'group-tf') q.subQuestions = Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' }));
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm">+ Thêm câu</button>
            </div>
        </div>
        <div className="p-4 space-y-6">
            {questions.filter(q => q.type === type).map((q) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="border-2 rounded-2xl p-5 space-y-4 bg-white hover:border-blue-100 transition-all shadow-sm">
                        <div className="flex justify-between items-center pb-3 border-b border-dashed">
                            <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl font-black text-xs uppercase">Câu {gIdx + 1}</span>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase">Điểm:</span>
                                    <input type="text" className="w-12 border-2 rounded-xl text-center font-black py-1 text-sm focus:border-blue-500 outline-none" value={q.points} onChange={e => {
                                        const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                                <button onClick={() => { if(confirm('Xóa câu này?')) { const n = [...questions]; n.splice(gIdx, 1); setQuestions(n); }}} className="text-red-300 hover:text-red-500 transition-all p-2 hover:bg-red-50 rounded-full"><Trash2 size={20}/></button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nội dung câu hỏi</label>
                                <RichTextEditor rows={3} value={q.text} onChange={v => { const n = [...questions]; n[gIdx].text = v; setQuestions(n); }} />
                            </div>
                            {type === 'mcq' && q.options && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {q.options.map((opt, oi) => (
                                        <div key={oi} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <input type="radio" className="w-5 h-5 accent-blue-600" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n); }} />
                                            <RichTextEditor className="flex-1 border-none bg-transparent" value={opt} onChange={v => {
                                                const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = v; n[gIdx].options = o; setQuestions(n);
                                            }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {type === 'group-tf' && q.subQuestions && (
                                <div className="space-y-2">
                                    {q.subQuestions.map((sq, si) => (
                                        <div key={si} className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-xs font-black text-blue-600 w-6">{String.fromCharCode(97+si)})</span>
                                            <input type="text" className="flex-1 bg-white border rounded-lg p-2 text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none" value={sq.text} onChange={e => {
                                                const n = [...questions]; const s = [...(n[gIdx].subQuestions||[])]; s[si].text = e.target.value; n[gIdx].subQuestions = s; setQuestions(n);
                                            }} placeholder={`Ý ${String.fromCharCode(97+si)}...`} />
                                            <div className="flex gap-1 shrink-0">
                                                {['True', 'False'].map(val => (
                                                    <button key={val} onClick={() => {
                                                        const n = [...questions]; const s = [...(n[gIdx].subQuestions || [])]; s[si].correctAnswer = val as any; n[gIdx].subQuestions = s; setQuestions(n);
                                                    }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${sq.correctAnswer === val ? (val === 'True' ? 'bg-green-600 text-white shadow-md' : 'bg-orange-600 text-white shadow-md') : 'bg-white text-gray-300'}`}>
                                                        {val === 'True' ? 'Đúng' : 'Sai'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {type === 'short' && (
                                <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-100 flex items-center gap-4">
                                    <span className="text-sm font-black text-green-700">Đáp án chính xác:</span>
                                    <input type="text" className="flex-1 border-2 border-green-200 rounded-xl p-3 font-black text-xl focus:border-green-500 bg-white outline-none" value={q.correctAnswer} onChange={e => {
                                        const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                    }} />
                                </div>
                            )}
                            <div className="bg-yellow-50/50 p-4 rounded-2xl border-2 border-yellow-100">
                                <label className="text-[10px] font-black text-yellow-700 uppercase mb-2 flex items-center gap-1 tracking-widest"><Lightbulb size={12}/> Lời giải chi tiết</label>
                                <RichTextEditor rows={3} value={q.solution || ''} onChange={v => { const n = [...questions]; n[gIdx].solution = v; setQuestions(n); }} placeholder="Nhập hướng dẫn giải..." />
                            </div>
                        </div>
                        {/* Fix: Added missing closing div for the question card container */}
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-slate-100 pb-8">
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3 tracking-tighter"><Settings2 className="text-blue-600" size={36} /> EDUQUIZ <span className="text-blue-600">PRO</span></h1>
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border-2">
              {(['all', '10', '11', '12'] as const).map(g => (
                  <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${quizFilterGrade === g ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ KHỐI' : `KHỐI ${g}`}</button>
              ))}
          </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 whitespace-nowrap transition-all border-2 ${activeTab === 'list' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50'}`}><List size={20} /> QUẢN LÝ ĐỀ</button>
        <button onClick={() => { setActiveTab('create'); if(!editingId && questions.length === 0) resetForm(); }} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 whitespace-nowrap transition-all border-2 ${activeTab === 'create' ? 'bg-blue-600 text-white border-blue-600 shadow-xl' : 'bg-white text-blue-400 hover:bg-blue-50'}`}><Plus size={20} /> SOẠN ĐỀ MỚI</button>
        <button onClick={() => setActiveTab('auto')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 whitespace-nowrap transition-all border-2 ${activeTab === 'auto' ? 'bg-purple-600 text-white border-purple-600 shadow-xl' : 'bg-white text-purple-400 hover:bg-purple-50'}`}><BrainCircuit size={20} /> SOẠN ĐỀ AI</button>
        <button onClick={() => setActiveTab('import')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 whitespace-nowrap transition-all border-2 ${activeTab === 'import' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-indigo-400 hover:bg-indigo-50'}`}><Upload size={20} /> NHẬP TỪ PDF</button>
        <button onClick={() => setActiveTab('results')} className={`px-6 py-3 rounded-2xl font-black flex items-center gap-2 whitespace-nowrap transition-all border-2 ${activeTab === 'results' ? 'bg-green-600 text-white border-green-600 shadow-xl' : 'bg-white text-green-400 hover:bg-green-50'}`}><BarChart3 size={20} /> KẾT QUẢ</button>
      </div>

      {activeTab === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
              {Object.keys(groupedQuizzes).length === 0 ? (
                  <div className="col-span-full py-24 text-center text-slate-300 font-black text-xl border-4 border-dashed rounded-[3rem]">Chưa có đề thi nào trong mục này.</div>
              ) : (
                Object.keys(groupedQuizzes).sort().map(cat => (
                    <div key={cat} className="col-span-full space-y-6">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3 pl-4 border-l-4 border-slate-200">{cat}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groupedQuizzes[cat].map(q => (
                                <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-transparent hover:border-blue-300 hover:shadow-xl transition-all flex flex-col justify-between group">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{q.type === 'test' ? 'KIỂM TRA' : 'LUYỆN TẬP'}</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase">LỚP {q.grade}</span>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg mb-2 group-hover:text-blue-600 transition-colors leading-tight">{q.title}</h3>
                                        <p className="text-xs text-slate-400 mb-6 font-bold">{q.questions.length} CÂU HỎI • {q.durationMinutes} PHÚT</p>
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-6 border-t-2 border-dashed border-slate-50">
                                        <button onClick={() => setViewingQuiz(q)} className="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl text-xs font-black uppercase hover:bg-blue-600 hover:text-white transition-all tracking-widest">XEM ĐỀ</button>
                                        <button onClick={() => handleEditQuiz(q)} className="p-3 text-indigo-400 hover:bg-indigo-50 rounded-2xl transition-all"><Edit size={20}/></button>
                                        <button onClick={async () => { if(confirm('Xóa vĩnh viễn đề này?')) { await deleteQuizStorage(q.id); refreshData(); } }} className="p-3 text-red-300 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-fade-in">
              <div className="lg:col-span-2 space-y-10">
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-50 space-y-8">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter border-b-2 border-slate-50 pb-6 flex items-center gap-3"><Settings2 className="text-blue-600"/> Cấu hình đề mới</h3>
                      <div className="space-y-6">
                          <input type="text" className="w-full text-3xl font-black border-none focus:ring-0 outline-none placeholder-slate-200 bg-transparent" placeholder="TÊN ĐỀ THI KIỂM TRA..." value={title} onChange={e => setTitle(e.target.value)} />
                          <div className="grid grid-cols-2 gap-6">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Chương / Mục</label>
                                  <input type="text" className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-blue-100" placeholder="VD: Chương 1: Đạo hàm" value={category} onChange={e => setCategory(e.target.value)} />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Khối lớp</label>
                                  <select className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-blue-100" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                              </div>
                          </div>
                      </div>
                  </div>
                  {renderEditor('mcq', 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn', 'border-blue-500')}
                  {renderEditor('group-tf', 'Phần II: Câu trắc nghiệm đúng sai', 'border-purple-500')}
                  {renderEditor('short', 'Phần III: Câu trắc nghiệm trả lời ngắn', 'border-green-500')}
              </div>
              <div className="lg:col-span-1">
                  <div className="sticky top-24 bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-2xl text-center space-y-8">
                      <div className="flex justify-center"><div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center shadow-inner"><Sparkles size={40}/></div></div>
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Thống kê đề</h4>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-6 rounded-[2rem]"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Số câu</p><p className="text-3xl font-black text-blue-600">{questions.length}</p></div>
                          <div className="bg-slate-50 p-6 rounded-[2rem]"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Điểm</p><p className="text-3xl font-black text-blue-600">{questions.reduce((acc, q) => acc + (parseFloat(String(q.points)) || 0), 0).toFixed(1)}</p></div>
                      </div>
                      <button onClick={handleSaveQuiz} className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl transform active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20}/> HOÀN TẤT & LƯU ĐỀ</button>
                  </div>
              </div>
          </div>
      )}

      {viewingQuiz && (
          <div className="fixed inset-0 bg-black/70 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-white">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-xl"><BookOpen size={32}/></div>
                          <div><h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{viewingQuiz.title}</h3><p className="text-[11px] font-black text-blue-300 uppercase tracking-widest mt-1">LỚP {viewingQuiz.grade} • {viewingQuiz.questions.length} CÂU HỎI</p></div>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={handleShufflePreview} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all shadow-lg active:scale-95"><Shuffle size={18}/> XÁO ĐỀ</button>
                          <button onClick={() => handleExportWord(viewingQuiz, previewQuestions)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all shadow-lg active:scale-95"><FileDown size={18}/> XUẤT WORD</button>
                          <button onClick={() => setViewingQuiz(null)} className="p-3 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"><XCircle size={32}/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 bg-slate-100">
                      <div className="max-w-4xl mx-auto bg-white p-16 shadow-2xl rounded-[3rem] border border-slate-200 space-y-16">
                          <div className="text-center pb-10 border-b-4 border-slate-50">
                              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3 leading-tight">{viewingQuiz.title}</h2>
                          </div>
                          <div className="space-y-16">
                              {previewQuestions.map((q, i) => (
                                  <div key={q.id}>
                                      <div className="font-black text-slate-800 mb-4 leading-relaxed"><span className="text-blue-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                      {q.type === 'mcq' && q.options && (
                                          <div className="grid grid-cols-2 gap-x-10 gap-y-3 ml-8">
                                              {q.options.map((opt, oi) => (
                                                  <div key={oi} className="text-sm text-slate-600 font-bold"><span className="text-slate-400 mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>
                                              ))}
                                          </div>
                                      )}
                                      {q.solution && (
                                          <div className="mt-6 ml-8 p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 italic text-sm text-slate-500">
                                              <span className="font-black text-slate-400 not-italic uppercase text-[10px] mb-2 block tracking-widest">Lời giải chi tiết:</span>
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

      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up border-4 border-indigo-100">
                  <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <Database size={32}/>
                          <div><h3 className="text-xl font-black uppercase tracking-tight">Ngân hàng câu hỏi</h3><p className="text-[10px] font-black text-indigo-200 uppercase mt-1">Chọn từ các đề thi đã soạn thảo</p></div>
                      </div>
                      <button onClick={() => setShowBankModal(false)}><XCircle size={32}/></button>
                  </div>
                  <div className="p-6 bg-slate-50 border-b flex gap-4">
                      <select className="flex-1 bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-sm outline-none focus:border-indigo-500" value={bankQuizId} onChange={e => setBankQuizId(e.target.value)}>
                          <option value="">-- Chọn đề thi gốc --</option>
                          {quizzes.filter(q => q.grade === bankGrade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                      <select className="w-40 bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-sm outline-none focus:border-indigo-500" value={bankGrade} onChange={e => setBankGrade(e.target.value as Grade)}>
                          <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                      {bankQuizId ? (
                          quizzes.find(q => q.id === bankQuizId)?.questions.map((q, idx) => (
                              <div key={q.id} className="bg-white p-5 rounded-3xl border-2 border-transparent hover:border-indigo-400 shadow-sm transition-all flex justify-between items-start gap-6 group">
                                  <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                          <span className="text-[10px] font-black text-indigo-500 uppercase px-2 py-0.5 bg-indigo-50 rounded-lg">{q.type}</span>
                                          <span className="text-[10px] font-black text-slate-300 uppercase">Câu {idx+1}</span>
                                      </div>
                                      <div className="text-sm font-bold text-slate-700 leading-relaxed line-clamp-2"><LatexText text={q.text}/></div>
                                  </div>
                                  <button onClick={() => {
                                      const newQ = { ...q, id: uuidv4(), subQuestions: q.subQuestions?.map(sq => ({ ...sq, id: uuidv4() })) };
                                      setQuestions(sortQuestionsByType([...questions, newQ]));
                                  }} className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-lg group-active:scale-90 transition-all hover:bg-indigo-700 flex items-center justify-center"><Plus size={24}/></button>
                              </div>
                          ))
                      ) : (
                          <div className="text-center py-20 text-slate-300 font-black flex flex-col items-center gap-4"><Search size={48} className="text-slate-200"/><p className="uppercase text-xs tracking-[0.2em]">Chọn một đề thi để xem danh sách câu hỏi</p></div>
                      )}
                  </div>
                  <div className="p-4 bg-white border-t-2 border-slate-100 flex justify-center">
                      <button onClick={() => setShowBankModal(false)} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2"><Check size={18}/> Xong</button>
                  </div>
              </div>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
              <div className="relative">
                  <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600"><Sparkles size={36}/></div>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mt-12 mb-4 uppercase tracking-tighter text-center max-w-lg">{loadingMsg}</h2>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
