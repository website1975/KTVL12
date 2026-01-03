
import React, { useState, useEffect } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, QuizType } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, getChapters, saveChapter, deleteChapter, uploadQuizImage, deleteResult, deleteUser
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, Layers, 
    Search, X, CheckCircle2, 
    HelpCircle, AlignLeft, BookOpen, Eye, Target, FileText, ImageIcon, Loader2, Database,
    Trophy, Users2, Sparkles, FileUp, Filter, AlertCircle, CheckCircle
} from 'lucide-react';
import LatexText from './LatexText';

// --- SUB-COMPONENT: QUESTION SECTION ---
interface SectionProps {
    title: string;
    type: QuestionType;
    icon: any;
    questions: Question[];
    setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
    onAdd: (type: QuestionType) => void;
    onOpenBank: (type: QuestionType) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
}

const QuestionSection: React.FC<SectionProps> = ({ 
    title, type, icon: Icon, questions, setQuestions, onAdd, onOpenBank, onUploadImage, uploadingId 
}) => {
    const sectionQuestions = questions.filter(q => q.type === type);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sectionQuestions.length} câu đã soạn</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                        <Database size={14}/> Ngân hàng
                    </button>
                    <button onClick={() => onAdd(type)} className={`flex items-center gap-2 px-6 py-3 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all ${type === 'mcq' ? 'bg-blue-600 shadow-blue-100' : type === 'group-tf' ? 'bg-purple-600 shadow-purple-100' : 'bg-orange-600 shadow-orange-100'}`}>
                        <Plus size={14}/> Thêm mới
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {sectionQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative group animate-fade-in-up">
                        <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors">
                            <Trash2 size={24}/>
                        </button>
                        <div className="flex items-center gap-4 mb-6">
                            <span className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                Câu {idx + 1}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi</label>
                                <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all min-h-[120px]" value={q.text} onChange={e => { const newList = [...questions]; const i = newList.findIndex(x => x.id === q.id); newList[i].text = e.target.value; setQuestions(newList); }} placeholder="Nhập câu hỏi (LaTeX $...$)" />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Xem trước</label>
                                <div className="w-full p-6 bg-blue-50/30 rounded-3xl border border-blue-50 min-h-[120px] text-sm font-medium"><LatexText text={q.text || '*Đang nhập liệu...*'} /></div>
                            </div>
                        </div>

                        <div className="mb-8 flex items-center gap-6 p-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <div className="shrink-0">
                                {q.imageUrl ? (
                                    <div className="relative group/img">
                                        <img src={q.imageUrl} className="w-24 h-24 object-cover rounded-2xl border" alt="qimg" />
                                        <button onClick={() => { const newList = [...questions]; const i = newList.findIndex(x => x.id === q.id); newList[i].imageUrl = undefined; setQuestions(newList); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover/img:opacity-100 transition-all"><X size={12}/></button>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-white border rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-1">{uploadingId === q.id ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/><span className="text-[8px] font-black uppercase">Trống</span></div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Đính kèm hình ảnh</p>
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} />
                                <label htmlFor={`img-${q.id}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border text-slate-600 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-slate-50 transition-all shadow-sm"><Plus size={14}/> {q.imageUrl ? 'Thay đổi hình' : 'Tải hình lên'}</label>
                            </div>
                        </div>

                        {type === 'mcq' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {q.options?.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                        <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-black text-slate-300 italic">{String.fromCharCode(65+oi)}.</span>
                                        <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && (
                            <div className="space-y-4 mb-8">
                                {q.subQuestions?.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <span className="text-xs font-black text-blue-600 w-8 italic">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý..." />
                                        <div className="flex bg-white rounded-xl p-1.5 border">
                                            {['True', 'False'].map(v => (
                                                <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'short' && (
                            <div className="mb-8 flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <span className="text-xs font-black text-orange-600 uppercase italic">Đáp án đúng:</span>
                                <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả ngắn..." />
                            </div>
                        )}

                        <div className="space-y-4 pt-6 border-t border-slate-50">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Lời giải chi tiết</label>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <textarea className="w-full p-6 bg-yellow-50/30 border border-yellow-100 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-yellow-50 transition-all min-h-[100px]" value={q.solution} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} placeholder="Nhập lời giải..." />
                                <div className="w-full p-6 bg-slate-50 rounded-3xl border text-sm font-medium italic text-slate-500"><LatexText text={q.solution || '*Chưa có lời giải...*'} /></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // States cho soạn đề
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [isPublished, setIsPublished] = useState(true);
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState('');
  const [startTime, setStartTime] = useState('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [showBank, setShowBank] = useState<{ type: QuestionType, open: boolean }>({ type: 'mcq', open: false });
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  // Filter cho list đề thi
  const [quizGradeFilter, setQuizGradeFilter] = useState<Grade | 'all'>('all');
  const [quizSearch, setQuizSearch] = useState('');

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  const handleSave = async () => {
    if (!title) return alert("Vui lòng nhập tiêu đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', type: quizType,
      grade, durationMinutes: duration, questions, isPublished,
      createdAt: new Date().toISOString(), category,
      startTime: quizType === 'test' ? startTime : undefined
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    alert("Đã lưu thành công!");
    setActiveMenu('quizzes');
    setEditingId(null);
    refreshData();
  };

  const handleAiGenerate = async () => {
      const topic = prompt("Nhập chủ đề cần soạn đề (VD: Đạo hàm, Tích phân...):");
      if (!topic) return;
      setIsAiLoading(true);
      try {
          const aiQs = await generateQuizFromPrompt({ grade, topic, part1Count: 5, part2Count: 2, part3Count: 2 });
          setQuestions([...questions, ...aiQs]);
      } catch (err) { alert("Lỗi soạn AI!"); } finally { setIsAiLoading(false); }
  };

  const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsAiLoading(true);
      try {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
              const base64 = (reader.result as string).split(',')[1];
              const pdfQs = await parseQuestionsFromPDF(base64);
              setQuestions([...questions, ...pdfQs]);
              setIsAiLoading(false);
          };
      } catch (err) { alert("Lỗi bóc tách PDF!"); setIsAiLoading(false); }
  };

  const getQuizStats = (quizId: string) => {
    const qResults = results.filter(r => r.quizId === quizId);
    return { count: qResults.length, max: qResults.length > 0 ? Math.max(...qResults.map(r => r.score)) : 0 };
  };

  const filteredQuizzes = quizzes.filter(q => {
      const matchGrade = quizGradeFilter === 'all' || q.grade === quizGradeFilter;
      const matchSearch = q.title.toLowerCase().includes(quizSearch.toLowerCase());
      return matchGrade && matchSearch;
  });

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-700 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Cpu size={18}/></div>
          <span className="font-black text-[11px] tracking-[0.2em] uppercase italic">EduQuiz Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
            { id: 'create', icon: Plus, label: 'SOẠN ĐỀ MỚI' },
            { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM TỔNG' },
            { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' },
            { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' }
          ].map(m => (
            <button key={m.id} onClick={() => { setActiveMenu(m.id as any); if(m.id === 'create') { setEditingId(null); setTitle(''); setQuestions([]); setIsPublished(true); } }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><m.icon size={16}/> {m.label}</button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic italic">VN High School Standard</div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* MENU: QUẢN LÝ ĐỀ THI */}
          {activeMenu === 'quizzes' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-5 rounded-[2rem] border shadow-sm">
                <div className="flex-1 w-full flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-2xl"><Search className="text-slate-300" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-bold w-full" placeholder="Tìm tên đề thi..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)} /></div>
                <select className="px-4 py-3 bg-white border rounded-2xl text-[10px] font-black uppercase" value={quizGradeFilter} onChange={e => setQuizGradeFilter(e.target.value as any)}><option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option></select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredQuizzes.map(q => {
                    const stats = getQuizStats(q.id);
                    return (
                        <div key={q.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-[0_20px_50px_rgba(168,85,247,0.15)] hover:border-purple-200 transition-all duration-500 group relative flex flex-col">
                          <div className="flex justify-between items-start mb-8">
                            <div className="flex flex-col gap-2">
                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${q.type === 'practice' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{q.type === 'practice' ? 'LUYỆN TẬP' : 'KIỂM TRA'}</span>
                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${q.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{q.isPublished ? <CheckCircle size={10}/> : <Clock size={10}/>} {q.isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setCategory(q.category || ''); setQuizType(q.type); setStartTime(q.startTime || ''); setIsPublished(q.isPublished); setActiveMenu('create'); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit size={16}/></button>
                              <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={16}/></button>
                            </div>
                          </div>
                          <h3 className="font-black text-slate-800 text-lg mb-8 leading-tight min-h-[56px] group-hover:text-purple-600 transition-colors">{q.title}</h3>
                          <div className="bg-slate-50/70 rounded-3xl p-6 grid grid-cols-2 gap-4 mb-8">
                            <div className="text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Số lượt làm</p><p className="text-sm font-black text-slate-800">{stats.count}</p></div>
                            <div className="text-center border-l border-slate-200"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Điểm cao</p><p className="text-sm font-black text-purple-600">{stats.max.toFixed(1)}</p></div>
                          </div>
                          <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-6 border-t flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline group-hover:text-purple-600"><Eye size={14}/> XEM THỬ ĐỀ THI</button>
                        </div>
                    );
                })}
              </div>
            </div>
          )}

          {/* MENU: SOẠN ĐỀ MỚI */}
          {activeMenu === 'create' && (
            <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
                    <input type="text" className="text-3xl font-black outline-none bg-transparent placeholder-slate-200 w-full" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                    <div className="flex gap-4">
                        <button onClick={handleAiGenerate} disabled={isAiLoading} className="flex items-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-all disabled:opacity-50"><Sparkles size={16}/> {isAiLoading ? 'AI Đang soạn...' : 'Soạn bằng AI'}</button>
                        <label className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer shadow-xl hover:scale-105 transition-all"><FileUp size={16}/> Tải PDF bóc tách<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfExtract}/></label>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Khối lớp</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Chương học</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">Chọn chương</option>{chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Hình thức & Trạng thái</label>
                        <div className="flex gap-2">
                            <select className="flex-1 border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={quizType} onChange={e => setQuizType(e.target.value as any)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select>
                            <button onClick={() => setIsPublished(!isPublished)} className={`px-4 rounded-2xl font-black text-[9px] uppercase border transition-all ${isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{isPublished ? 'CÔNG KHAI' : 'NHÁP'}</button>
                        </div>
                    </div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Thời gian (Phút)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl shadow-slate-200"><Save size={20}/> Lưu Đề Thi & Cập Nhật</button>
              </div>

              <QuestionSection title="PHẦN I. Câu trắc nghiệm" type="mcq" icon={CheckCircle2} questions={questions} setQuestions={setQuestions} onAdd={(t) => setQuestions([...questions, { id: uuidv4(), type: t, text: '', points: 0.25, options: ['', '', '', ''], correctAnswer: '', solution: '' }])} onOpenBank={(t) => setShowBank({ type: t, open: true })} onUploadImage={async (qId, f) => { setUploadingId(qId); const url = await uploadQuizImage(f); setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} />
              <QuestionSection title="PHẦN II. Câu đúng sai" type="group-tf" icon={HelpCircle} questions={questions} setQuestions={setQuestions} onAdd={(t) => setQuestions([...questions, { id: uuidv4(), type: t, text: '', points: 1.0, subQuestions: [{ id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }], solution: '' }])} onOpenBank={(t) => setShowBank({ type: t, open: true })} onUploadImage={async (qId, f) => { setUploadingId(qId); const url = await uploadQuizImage(f); setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} />
              <QuestionSection title="PHẦN III. Trả lời ngắn" type="short" icon={AlignLeft} questions={questions} setQuestions={setQuestions} onAdd={(t) => setQuestions([...questions, { id: uuidv4(), type: t, text: '', points: 0.5, correctAnswer: '', solution: '' }])} onOpenBank={(t) => setShowBank({ type: t, open: true })} onUploadImage={async (qId, f) => { setUploadingId(qId); const url = await uploadQuizImage(f); setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} />
            </div>
          )}

          {/* MENU: BẢNG ĐIỂM TỔNG */}
          {activeMenu === 'results' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-3"><BarChart3 className="text-blue-600"/> Bảng điểm hệ thống</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead><tr className="border-b text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="pb-4 px-4">Ngày nộp</th><th className="pb-4">Học sinh</th><th className="pb-4">Đề thi</th><th className="pb-4">Điểm</th><th className="pb-4">Thời gian</th><th className="pb-4">Thao tác</th></tr></thead>
                            <tbody className="divide-y">
                                {results.map(r => (
                                    <tr key={r.id} className="text-sm group hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4 font-medium text-slate-400">{new Date(r.submittedAt).toLocaleDateString()}</td>
                                        <td className="py-4 font-black text-slate-800">{r.studentName}</td>
                                        <td className="py-4 font-bold text-slate-500">{quizzes.find(q => q.id === r.quizId)?.title || 'Đề đã xóa'}</td>
                                        <td className="py-4"><span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black">{r.score.toFixed(2)}</span></td>
                                        <td className="py-4 text-slate-400 font-bold">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                        <td className="py-4"><button onClick={async () => { if(confirm('Xóa kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          )}

          {/* MENU: QUẢN LÝ HỌC SINH */}
          {activeMenu === 'students' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-8 rounded-[3rem] border shadow-sm">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-3"><Users className="text-blue-600"/> Danh sách học sinh</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {users.filter(u => u.role === 'student').map(u => (
                            <div key={u.id} className="p-6 border rounded-3xl flex flex-col items-center text-center gap-4 hover:shadow-xl transition-all group">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-blue-600 font-black text-2xl uppercase">{u.fullName.charAt(0)}</div>
                                <div><h4 className="font-black text-slate-800 text-lg leading-tight">{u.fullName}</h4><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Lớp {u.grade} • MS: {u.studentCode}</p></div>
                                <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t">
                                    <div className="text-center"><p className="text-[8px] font-black text-slate-300 uppercase">Lượt làm</p><p className="font-black text-slate-800">{results.filter(r => r.studentId === u.id).length}</p></div>
                                    <div className="text-center border-l"><p className="text-[8px] font-black text-slate-300 uppercase">Avg</p><p className="font-black text-blue-600">{(results.filter(r => r.studentId === u.id).reduce((a,b)=>a+b.score,0)/(results.filter(r => r.studentId === u.id).length||1)).toFixed(1)}</p></div>
                                </div>
                                <button onClick={async () => { if(confirm('Xóa học sinh này?')) { await deleteUser(u.id); refreshData(); } }} className="mt-4 p-3 bg-red-50 text-red-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {/* MENU: CHƯƠNG HỌC */}
          {activeMenu === 'chapters' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thêm chương học mới</h4>
                    <div className="flex flex-col gap-4">
                        <select className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" id="ch-grade"><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                        <div className="flex gap-3"><input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Tên chương học..." id="ch-name" /><button onClick={async () => { const n = document.getElementById('ch-name') as HTMLInputElement; const g = document.getElementById('ch-grade') as HTMLSelectElement; if(!n.value) return; await saveChapter({ id: uuidv4(), name: n.value, grade: g.value as Grade, order: chapters.length }); n.value = ''; refreshData(); }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Lưu Chương</button></div>
                    </div>
                </div>
                {['12', '11', '10'].map(g => (
                    <div key={g} className="space-y-3">
                        <h5 className="text-[10px] font-black text-slate-300 uppercase px-6 tracking-[0.2em]">Khối {g}</h5>
                        {chapters.filter(c => c.grade === g).map(c => (
                            <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all shadow-sm"><span className="font-black text-sm text-slate-700">{c.name}</span><button onClick={async () => { if(confirm('Xóa?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button></div>
                        ))}
                    </div>
                ))}
            </div>
          )}
        </div>
      </main>

      {/* MODAL BANK & PREVIEW (GIỮ NGUYÊN NHƯ PHIÊN BẢN TRƯỚC) */}
      {showBank.open && (
          <div className="fixed inset-0 bg-slate-900/90 z-[1100] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><Database size={24}/></div><h3 className="text-lg font-black uppercase tracking-tight">Ngân hàng câu hỏi {showBank.type.toUpperCase()}</h3></div>
                      <button onClick={() => setShowBank({ ...showBank, open: false })} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-6">
                      {quizzes.filter(q => q.grade === grade).flatMap(q => q.questions).filter(q => q.type === showBank.type).map((q, i) => (
                          <div key={i} className="bg-white p-8 rounded-3xl border shadow-sm flex items-start gap-6 group hover:border-blue-500 transition-all">
                              <div className="flex-1"><div className="text-sm font-bold text-slate-800 mb-4 leading-relaxed"><LatexText text={q.text}/></div>{q.imageUrl && <img src={q.imageUrl} className="w-32 h-20 object-cover rounded-xl border mb-4" alt="p" />}</div>
                              <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); setShowBank({...showBank, open: false}); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:scale-105 transition-transform">Chọn câu này</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div><div><h3 className="text-lg font-black uppercase leading-tight">{previewQuiz.title}</h3><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Lớp {previewQuiz.grade} • {previewQuiz.questions.length} câu hỏi • {previewQuiz.durationMinutes} phút</p></div></div>
                    <button onClick={() => setPreviewQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors shadow-lg"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-12 pb-12">
                        {previewQuiz.questions.map((q, i) => (
                            <div key={q.id || i} className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 relative">
                                <div className="text-slate-800 text-[15px] font-bold mb-6 leading-relaxed flex items-start gap-4">
                                    <span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span>
                                    <div className="flex flex-col gap-4">
                                        <LatexText text={q.text}/>
                                        {q.imageUrl && <img src={q.imageUrl} className="max-w-full rounded-2xl border" alt="preview q" />}
                                    </div>
                                </div>
                                {q.type === 'mcq' && q.options && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">{q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium text-slate-500 flex items-center gap-2"><span className="text-slate-300 font-black italic">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}</div>)}
                                {q.solution && (<div className="mt-8 pt-6 border-t border-yellow-100 bg-yellow-50/50 p-6 rounded-2xl"><p className="text-[10px] font-black text-yellow-600 uppercase mb-3 flex items-center gap-2"><Target size={14}/> Lời giải tham khảo:</p><div className="text-sm font-medium text-slate-600 italic leading-relaxed"><LatexText text={q.solution}/></div></div>)}
                            </div>
                        ))}
                    </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
