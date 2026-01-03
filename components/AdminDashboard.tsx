
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Chapter } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser,
    getChapters, saveChapter, updateChapter, deleteChapter,
    uploadQuizImage
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, BarChart3, Edit, 
    X, BookOpen, Bold, Sigma, CornerDownLeft, 
    Sparkles, Shuffle, Eye, Cpu, FileUp, Trophy, History, 
    Settings, Filter, FolderTree, Search, Database, 
    ChevronRight, LayoutDashboard, Users, FileText, Send, Layers,
    Image as ImageIcon, CheckCircle2, AlertCircle, Trash, Copy, Clock
} from 'lucide-react';
import LatexText from './LatexText';

// --- RICH TEXT EDITOR WITH LATEX PREVIEW ---
interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; label?: string; }
const RichTextEditor = ({ value, onChange, placeholder, rows, label }: RichTextEditorProps) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const newVal = value.substring(0, start) + prefix + value.substring(start, end) + suffix + value.substring(end);
        onChange(newVal);
    };
    return (
        <div className="flex flex-col gap-1 mb-4 w-full">
            {label && <label className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{label}</label>}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                <div className="flex items-center gap-1 p-1.5 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 hover:bg-white rounded text-slate-500" title="In đậm"><Bold size={12}/></button>
                    <button type="button" onClick={() => insertTag('$', '$')} className="p-1.5 hover:bg-white rounded text-blue-600" title="Toán học LaTeX"><Sigma size={12}/></button>
                    <button type="button" onClick={() => insertTag('<br/>')} className="p-1.5 hover:bg-white rounded text-slate-500" title="Xuống dòng"><CornerDownLeft size={12}/></button>
                </div>
                <textarea ref={inputRef} className="w-full p-4 outline-none text-[14px] leading-relaxed resize-none font-medium min-h-[100px]" rows={rows || 3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            </div>
            {value && <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100/30 text-sm text-slate-700 shadow-sm"><LatexText text={value} /></div>}
        </div>
    );
};

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Quiz Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Chapters & Misc
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterGrade, setNewChapterGrade] = useState<Grade>('12');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetPart, setBankTargetPart] = useState<QuestionType | null>(null);

  // AI & PDF State
  const [aiTopic, setAiTopic] = useState('');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  const handleAddQuestion = (type: QuestionType) => {
      const newQ: Question = {
          id: uuidv4(), type, text: '', 
          points: type === 'mcq' ? 0.25 : (type === 'group-tf' ? 1.0 : 0.5),
          options: type === 'mcq' ? ['', '', '', ''] : undefined,
          subQuestions: type === 'group-tf' ? Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' })) : undefined,
          correctAnswer: type === 'mcq' ? '' : (type === 'short' ? '' : undefined)
      };
      setQuestions([...questions, newQ]);
  };

  const handleDuplicate = (q: Quiz) => {
      setEditingId(null);
      setTitle(`${q.title} (Bản sao)`);
      setCategory(q.category || '');
      setGrade(q.grade);
      setDuration(q.durationMinutes);
      setQuestions(q.questions.map(qu => ({ ...qu, id: uuidv4() })));
      setIsPublished(false);
      setActiveMenu('create');
  };

  const handleSaveQuiz = async () => {
      if (!title.trim()) return alert("Vui lòng nhập tên đề thi!");
      setIsProcessing(true); setLoadingMsg("Đang lưu dữ liệu...");
      const quizData: Quiz = {
          id: editingId || uuidv4(), title, description: '', type: 'practice', 
          grade, category, durationMinutes: duration, questions, 
          createdAt: new Date().toISOString(), isPublished
      };
      try {
          if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
          alert("Thành công!");
          setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('quizzes');
          refreshData();
      } catch (e) { alert("Lỗi khi lưu."); } finally { setIsProcessing(false); }
  };

  // --- RENDER VIEWS ---

  const renderQuizzes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
        {quizzes.map(q => (
            <div key={q.id} className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-slate-100 hover:border-b-blue-600">
                <div className="flex justify-between items-start mb-6">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Lớp {q.grade}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handleDuplicate(q)} className="p-2 text-slate-400 hover:text-emerald-600" title="Nhân bản"><Copy size={16}/></button>
                        <button onClick={() => { setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveMenu('create'); }} className="p-2 text-slate-400 hover:text-blue-600" title="Sửa"><Edit size={16}/></button>
                        <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500" title="Xóa"><Trash2 size={16}/></button>
                    </div>
                </div>
                <h3 className="font-black text-slate-800 text-sm mb-4 leading-tight min-h-[40px]">{q.title}</h3>
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50 text-[10px] font-black text-slate-400">
                    <span className="flex items-center gap-1.5"><Layers size={14}/> {q.questions.length} câu</span>
                    <span className="flex items-center gap-1.5"><Clock size={14}/> {q.durationMinutes} phút</span>
                    <span className={`uppercase ml-auto ${q.isPublished ? 'text-green-500' : 'text-slate-300'}`}>{q.isPublished ? 'Công khai' : 'Bản nháp'}</span>
                </div>
            </div>
        ))}
        <button onClick={() => { setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('create'); }} className="border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-white/50">
            <Plus size={32} className="mb-2"/> <span className="text-xs font-black uppercase tracking-widest">Tạo đề mới</span>
        </button>
    </div>
  );

  const renderChapters = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest flex items-center gap-2"><FolderTree size={16}/> Thêm chương học mới</h3>
            <div className="flex gap-4">
                <select className="bg-slate-50 border rounded-xl px-4 text-sm font-bold" value={newChapterGrade} onChange={e => setNewChapterGrade(e.target.value as Grade)}>
                    <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                </select>
                <input type="text" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100" placeholder="Tên chương (VD: Khảo sát hàm số)..." value={newChapterName} onChange={e => setNewChapterName(e.target.value)} />
                <button onClick={async () => {
                    if(!newChapterName.trim()) return;
                    await saveChapter({ id: uuidv4(), name: newChapterName, grade: newChapterGrade, order: chapters.length });
                    setNewChapterName(''); refreshData();
                }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all"><Plus size={18}/></button>
            </div>
        </div>
        <div className="space-y-3">
            {chapters.sort((a,b) => a.grade.localeCompare(b.grade) || a.order - b.order).map(c => (
                <div key={c.id} className="bg-white p-4 px-6 rounded-2xl border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all">
                    <div className="flex items-center gap-4">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">LỚP {c.grade}</span>
                        <span className="text-sm font-black text-slate-700">{c.name}</span>
                    </div>
                    <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                </div>
            ))}
            {chapters.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">Chưa có chương học nào</div>}
        </div>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-4xl mx-auto pb-48 animate-fade-in space-y-12">
        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-white shadow-xl grid grid-cols-12 gap-6 sticky top-2 z-20">
            <div className="col-span-12 md:col-span-8"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Tên đề thi</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-4 focus:ring-blue-50" value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Kiểm tra cuối kỳ I..." /></div>
            <div className="col-span-6 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Khối</label><select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
            <div className="col-span-6 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Thời gian (phút)</label><input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
            <div className="col-span-12"><label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">Chương học</label><select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">-- Chọn phân loại --</option>{chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
        </div>

        {/* 3 Sections of Questions */}
        {[
            { id: 'mcq', label: 'PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN', color: 'blue' },
            { id: 'group-tf', label: 'PHẦN II. TRẮC NGHIỆM ĐÚNG SAI', color: 'purple' },
            { id: 'short', label: 'PHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN', color: 'emerald' }
        ].map(sec => (
            <div key={sec.id} className="space-y-6">
                <div className="flex justify-between items-center px-4">
                    <h4 className={`text-sm font-black uppercase text-${sec.color}-600 flex items-center gap-2`}><Layers size={18}/> {sec.label}</h4>
                    <div className="flex gap-2">
                        <button onClick={() => { setBankTargetPart(sec.id as any); setShowBankModal(true); }} className="text-[10px] font-black bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg hover:bg-black transition-all flex items-center gap-1.5"><Database size={14}/> NGÂN HÀNG</button>
                        <button onClick={() => handleAddQuestion(sec.id as any)} className={`text-[10px] font-black bg-${sec.color}-600 text-white px-4 py-2 rounded-full shadow-lg hover:opacity-90 transition-all flex items-center gap-1.5`}><Plus size={14}/> THÊM CÂU</button>
                    </div>
                </div>
                <div className="space-y-8">
                    {questions.filter(q => q.type === sec.id).map((q, idx) => (
                        <div key={q.id} className={`bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative group border-l-8 border-l-${sec.color}-500 transition-all hover:shadow-md`}>
                            <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                            <div className="mb-6"><span className={`text-[11px] font-black text-${sec.color}-600 bg-${sec.color}-50 px-4 py-1.5 rounded-xl uppercase`}>Câu {questions.filter(qu=>qu.type===sec.id).indexOf(q) + 1}</span></div>
                            <RichTextEditor label="Nội dung câu hỏi" value={q.text} onChange={val => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].text=val; setQuestions(n); }} />
                            
                            {q.type === 'mcq' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                    {q.options?.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                            <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].correctAnswer=opt; setQuestions(n); }} className="w-5 h-5" />
                                            <span className="text-xs font-black text-slate-400">{String.fromCharCode(65+oIdx)}.</span>
                                            <input type="text" className="flex-1 bg-transparent border-none text-sm font-bold outline-none" value={opt} onChange={e => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].options![oIdx]=e.target.value; setQuestions(n); }} placeholder={`Phương án ${String.fromCharCode(65+oIdx)}...`} />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'group-tf' && (
                                <div className="space-y-3 mt-6">
                                    {q.subQuestions?.map((sq, sIdx) => (
                                        <div key={sq.id} className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <span className="text-xs font-bold text-slate-400">{String.fromCharCode(97+sIdx)})</span>
                                            <input type="text" className="flex-1 bg-transparent border-none text-sm font-medium outline-none" value={sq.text} onChange={e => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].subQuestions![sIdx].text=e.target.value; setQuestions(n); }} placeholder="Lời khẳng định..." />
                                            <select className="text-[10px] font-black p-2 bg-white border rounded-xl outline-none" value={sq.correctAnswer} onChange={e => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].subQuestions![sIdx].correctAnswer=e.target.value as any; setQuestions(n); }}><option value="True">ĐÚNG</option><option value="False">SAI</option></select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {q.type === 'short' && (
                                <div className="mt-6 flex items-center gap-4 bg-emerald-50 p-6 rounded-2xl border border-emerald-100"><span className="text-[10px] font-black text-emerald-600 uppercase">Đáp số chuẩn:</span><input type="text" className="flex-1 bg-white border border-emerald-200 rounded-xl p-3 text-sm font-black outline-none" value={q.correctAnswer} onChange={e => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].correctAnswer=e.target.value; setQuestions(n); }} placeholder="Nhập kết quả..." /></div>
                            )}

                            <div className="mt-8 pt-8 border-t border-slate-100"><RichTextEditor label="Lời giải chi tiết" value={q.solution || ''} onChange={val => { const n=[...questions]; const qi=n.findIndex(qu=>qu.id===q.id); n[qi].solution=val; setQuestions(n); }} placeholder="Giải thích cho học sinh..." rows={4} /></div>
                        </div>
                    ))}
                    {questions.filter(q => q.type === sec.id).length === 0 && <div className="text-center py-10 bg-slate-50 border-2 border-dashed rounded-[2rem] text-slate-300 font-bold text-xs uppercase">Chưa có câu hỏi trong phần này</div>}
                </div>
            </div>
        ))}

        {/* Action Bar Floating */}
        <div className="fixed bottom-8 left-[280px] right-8 flex justify-end z-[60] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md p-3 rounded-[2.5rem] shadow-2xl border border-slate-200 flex items-center gap-6 pointer-events-auto">
                <label className="flex items-center gap-2 px-6 cursor-pointer text-[11px] font-black text-slate-500 uppercase"><input type="checkbox" className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} /> Công khai ngay</label>
                <button onClick={handleSaveQuiz} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2"><Save size={20}/> Lưu & Hoàn tất</button>
            </div>
        </div>
    </div>
  );

  const renderResults = () => (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100"><th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Học sinh</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã số</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đề thi</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Thời gian</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {results.map(r => (
                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-6 text-sm font-black text-slate-700">{r.studentName}</td>
                            <td className="p-6 text-xs font-bold text-slate-400">#{(users.find(u => u.id === r.studentId)?.studentCode) || '---'}</td>
                            <td className="p-6 text-xs font-bold text-slate-500">{(quizzes.find(q => q.id === r.quizId)?.title) || 'Đề đã xóa'}</td>
                            <td className="p-6"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                            <td className="p-6 text-right text-[10px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleString('vi-VN')}</td>
                        </tr>
                    ))}
                    {results.length === 0 && <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Chưa có kết quả nộp bài</td></tr>}
                </tbody>
            </table>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f1f5f9] overflow-hidden text-slate-700">
        <aside className="w-[240px] bg-slate-900 flex flex-col shrink-0 z-50 shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Cpu size={18}/></div><h1 className="text-xs font-black text-white uppercase tracking-widest">EDUQUIZ <span className="text-blue-500">ADMIN</span></h1></div>
            <nav className="flex-1 p-4 space-y-1">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'TẤT CẢ ĐỀ THI' },
                    { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ THỦ CÔNG' },
                    { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                    { id: 'import', icon: FileUp, label: 'NHẬP ĐỀ TỪ PDF' },
                    { id: 'results', icon: BarChart3, label: 'KẾT QUẢ THI' },
                    { id: 'students', icon: Users, label: 'HỌC SINH' }
                ].map(item => (
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}><item.icon size={16}/> {item.label}</button>
                ))}
            </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
            <header className="h-16 bg-white border-b border-slate-200 px-8 flex justify-between items-center shrink-0">
                <h2 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">{activeMenu}</h2>
                <button onClick={refreshData} className="p-2 border rounded-xl hover:bg-slate-50 transition-all text-slate-400"><Shuffle size={14}/></button>
            </header>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeMenu === 'quizzes' && renderQuizzes()}
                {activeMenu === 'chapters' && renderChapters()}
                {activeMenu === 'create' && renderCreateQuiz()}
                {activeMenu === 'results' && renderResults()}
                {activeMenu === 'students' && (
                    <div className="max-w-4xl mx-auto space-y-4">
                        {users.filter(u => u.role === 'student').map(u => (
                            <div key={u.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 flex justify-between items-center group shadow-sm hover:shadow-lg transition-all">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-sm">{u.fullName.charAt(0)}</div>
                                    <div><p className="text-sm font-black text-slate-800">{u.fullName}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {u.studentCode} • LỚP {u.grade}</p></div>
                                </div>
                                <button onClick={async () => { if(confirm('Xóa tài khoản này?')) { await deleteUser(u.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>
                            </div>
                        ))}
                    </div>
                )}
                {activeMenu === 'ai' && (
                  <div className="max-w-2xl mx-auto bg-white p-12 rounded-[3rem] border border-slate-200 shadow-xl text-center space-y-8 animate-fade-in-up">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto animate-pulse"><Sparkles size={40}/></div>
                    <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Soạn đề thông minh bằng AI</h3><p className="text-slate-400 text-sm mt-2 font-medium">Nhập chủ đề Toán học, AI sẽ tự động tạo bộ câu hỏi 3 phần</p></div>
                    <div className="space-y-4 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Chủ đề bài học</label>
                      <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-black outline-none focus:ring-4 focus:ring-blue-100" placeholder="VD: Khảo sát hàm số bậc ba..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
                    </div>
                    <button onClick={async () => {
                      if(!aiTopic.trim()) return;
                      setIsProcessing(true); setLoadingMsg("AI đang suy nghĩ và tạo đề bài...");
                      try {
                        const newQs = await generateQuizFromPrompt({ grade, topic: aiTopic, part1Count: 4, part2Count: 4, part3Count: 4 });
                        setQuestions(newQs); setEditingId(null); setTitle(`Đề AI: ${aiTopic}`); setActiveMenu('create');
                      } catch (e) { alert("AI gặp lỗi, hãy thử lại."); } finally { setIsProcessing(false); }
                    }} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase shadow-2xl flex items-center justify-center gap-3 hover:bg-black transition-all"><Send size={18}/> Bắt đầu tạo đề ngay</button>
                  </div>
                )}
                {activeMenu === 'import' && (
                  <div className="max-w-2xl mx-auto bg-white p-12 rounded-[3rem] border border-slate-200 shadow-xl text-center space-y-8 animate-fade-in-up">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto"><FileUp size={40}/></div>
                    <div><h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Số hóa đề thi từ PDF</h3><p className="text-slate-400 text-sm mt-2 font-medium">Tải file PDF đề thi, AI sẽ tự động bóc tách thành dữ liệu</p></div>
                    <label className="block border-4 border-dashed border-slate-100 rounded-3xl p-12 cursor-pointer hover:border-emerald-200 hover:bg-emerald-50 transition-all">
                      <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (re) => {
                            const base64 = (re.target?.result as string).split(',')[1];
                            setIsProcessing(true); setLoadingMsg("AI đang phân tích file PDF...");
                            try {
                              const newQs = await parseQuestionsFromPDF(base64);
                              setQuestions(newQs); setTitle(`Nhập từ PDF: ${file.name}`); setActiveMenu('create');
                            } catch (e) { alert("Lỗi phân tích file."); } finally { setIsProcessing(false); }
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                      <div className="text-slate-300 font-black text-xs uppercase tracking-[0.2em]"><Upload size={32} className="mx-auto mb-4"/> Click để chọn file PDF</div>
                    </label>
                  </div>
                )}
            </div>
        </main>

        {/* BANK MODAL */}
        {showBankModal && (
            <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up">
                    <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-3"><Database size={24} className="text-blue-400"/><div><h3 className="font-black uppercase text-sm mb-1 tracking-tight">Ngân hàng câu hỏi khối {grade}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bankTargetPart === 'mcq' ? 'Trắc nghiệm 4 lựa chọn' : bankTargetPart === 'group-tf' ? 'Trắc nghiệm Đúng/Sai' : 'Trả lời ngắn'}</p></div></div><button onClick={() => { setShowBankModal(false); setBankTargetPart(null); }} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-all shadow-lg"><X size={24}/></button></div>
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50 space-y-10">
                        {quizzes.filter(q=>q.grade===grade).map(q => {
                            const filteredBankQs = q.questions.filter(qi => qi.type === bankTargetPart); if (filteredBankQs.length === 0) return null;
                            return (<div key={q.id} className="space-y-4"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 inline-block px-3 py-1 rounded-lg">Từ đề: {q.title}</h4><div className="grid grid-cols-1 gap-4">{filteredBankQs.map((qItem, qiIdx) => (<div key={qItem.id} className="bg-white p-8 rounded-3xl border border-slate-200 flex justify-between items-center group hover:border-blue-500 hover:shadow-xl transition-all"><div className="flex-1 pr-8 text-[14px] font-medium leading-relaxed"><div className="font-bold flex gap-3 mb-2 text-slate-800"><span className="text-blue-600 font-black">Câu {qiIdx+1}.</span><LatexText text={qItem.text}/></div></div><button onClick={() => { setQuestions([...questions, { ...qItem, id: uuidv4() }]); setShowBankModal(false); setBankTargetPart(null); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all hover:scale-105">+ Chọn câu này</button></div>))}</div></div>);
                        })}
                        {quizzes.filter(q=>q.grade===grade).length === 0 && <div className="py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Không có dữ liệu trong ngân hàng</div>}
                    </div>
                </div>
            </div>
        )}

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin shadow-xl"></div>
                <h2 className="text-sm font-black text-slate-800 mt-8 uppercase tracking-[0.4em] animate-pulse">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
