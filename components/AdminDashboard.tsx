
import React, { useState, useEffect } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, QuizType } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, getChapters, saveChapter, deleteChapter, uploadQuizImage
} from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, Layers, 
    Search, X, CheckCircle2, 
    HelpCircle, AlignLeft, BookOpen, Eye, Target, FileText, ImageIcon, Loader2, Database,
    Trophy, Users2
} from 'lucide-react';
import LatexText from './LatexText';

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // --- BỘ LỌC VÀ XEM THỬ ---
  const [quizGradeFilter, setQuizGradeFilter] = useState<Grade | 'all'>('all');
  const [quizChapterFilter, setQuizChapterFilter] = useState<string | 'all'>('all');
  const [quizSearch, setQuizSearch] = useState('');
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  // --- TRẠNG THÁI SOẠN ĐỀ ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [startTime, setStartTime] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // --- NGÂN HÀNG CÂU HỎI ---
  const [showBank, setShowBank] = useState<{ type: QuestionType, open: boolean }>({ type: 'mcq', open: false });

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  const availableChapters = chapters.filter(c => c.grade === grade);

  const getQuizStats = (quizId: string) => {
    const quizResults = results.filter(r => r.quizId === quizId);
    return { 
        count: quizResults.length, 
        max: quizResults.length > 0 ? Math.max(...quizResults.map(r => r.score)) : 0 
    };
  };

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: uuidv4(), type, text: '', points: type === 'group-tf' ? 1.0 : (type === 'mcq' ? 0.25 : 0.5),
      options: type === 'mcq' ? ['', '', '', ''] : undefined,
      correctAnswer: '',
      solution: '',
      subQuestions: type === 'group-tf' ? [
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' }
      ] : undefined
    };
    setQuestions([...questions, newQ]);
  };

  const handleImageUpload = async (qId: string, file: File) => {
      setUploadingId(qId);
      try {
          const url = await uploadQuizImage(file);
          setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q));
      } catch (err) {
          alert("Lỗi upload hình ảnh!");
      } finally {
          setUploadingId(null);
      }
  };

  const handleSave = async () => {
    if (!title) return alert("Vui lòng nhập tiêu đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', type: quizType,
      grade, durationMinutes: duration, questions, isPublished: true,
      createdAt: new Date().toISOString(), category,
      startTime: quizType === 'test' ? startTime : undefined
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    alert("Đã lưu thành công!");
    setActiveMenu('quizzes');
    setEditingId(null);
    refreshData();
  };

  const getBankQuestions = (type: QuestionType) => {
      const bank: Question[] = [];
      quizzes
        .filter(q => q.grade === grade && q.category === category && q.id !== editingId)
        .forEach(quiz => {
            quiz.questions.forEach(quest => {
                if (quest.type === type) bank.push(quest);
            });
        });
      return bank;
  };

  const addFromBank = (q: Question) => {
      const newQ = { ...q, id: uuidv4() };
      if (newQ.subQuestions) newQ.subQuestions = newQ.subQuestions.map(s => ({ ...s, id: uuidv4() }));
      setQuestions([...questions, newQ]);
  };

  const filteredQuizzes = quizzes.filter(q => {
      const matchGrade = quizGradeFilter === 'all' || q.grade === quizGradeFilter;
      const matchChapter = quizChapterFilter === 'all' || q.category === quizChapterFilter;
      const matchSearch = q.title.toLowerCase().includes(quizSearch.toLowerCase());
      return matchGrade && matchChapter && matchSearch;
  });

  const QuestionSection = ({ title: sectionTitle, type, icon: Icon }: { title: string, type: QuestionType, icon: any }) => {
    const sectionQuestions = questions.filter(q => q.type === type);
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">{sectionTitle}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sectionQuestions.length} câu đã soạn</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowBank({ type, open: true })} className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                        <Database size={14}/> Ngân hàng
                    </button>
                    <button onClick={() => handleAddQuestion(type)} className={`flex items-center gap-2 px-6 py-3 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg transition-all ${type === 'mcq' ? 'bg-blue-600 shadow-blue-100' : type === 'group-tf' ? 'bg-purple-600 shadow-purple-100' : 'bg-orange-600 shadow-orange-100'}`}>
                        <Plus size={14}/> Thêm mới
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {questions.filter(q => q.type === type).map((q, qIndex) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative group animate-fade-in-up">
                        <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                        <div className="flex items-center gap-4 mb-6"><span className={`text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>Câu {qIndex + 1}</span></div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi</label>
                                <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all min-h-[120px]" value={q.text} onChange={e => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].text = e.target.value; setQuestions(n); }} placeholder="Nhập câu hỏi (LaTeX $...$)" />
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
                                        <img src={q.imageUrl} className="w-24 h-24 object-cover rounded-2xl border" />
                                        <button onClick={() => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].imageUrl = undefined; setQuestions(n); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover/img:opacity-100 transition-all"><X size={12}/></button>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-white border rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-1">{uploadingId === q.id ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/><span className="text-[8px] font-black uppercase">Trống</span></div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Đính kèm hình ảnh</p>
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && handleImageUpload(q.id, e.target.files[0])} />
                                <label htmlFor={`img-${q.id}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border text-slate-600 rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-slate-50 transition-all shadow-sm"><Plus size={14}/> {q.imageUrl ? 'Thay đổi hình' : 'Tải hình lên'}</label>
                            </div>
                        </div>

                        {type === 'mcq' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {q.options?.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                        <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].correctAnswer = opt; setQuestions(n); }} className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-black text-slate-300 italic">{String.fromCharCode(65+oi)}.</span>
                                        <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].options![oi] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && (
                            <div className="space-y-4 mb-8">
                                {q.subQuestions?.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <span className="text-xs font-black text-blue-600 w-8 italic">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].subQuestions![si].text = e.target.value; setQuestions(n); }} placeholder="Nội dung ý..." />
                                        <div className="flex bg-white rounded-xl p-1.5 border">
                                            {['True', 'False'].map(v => (
                                                <button key={v} onClick={() => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].subQuestions![si].correctAnswer = v as any; setQuestions(n); }} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-4 pt-6 border-t border-slate-50">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14}/> Lời giải chi tiết</label>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <textarea className="w-full p-6 bg-yellow-50/30 border border-yellow-100 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-yellow-50 transition-all min-h-[100px]" value={q.solution} onChange={e => { const n = [...questions]; const i = n.findIndex(x => x.id === q.id); n[i].solution = e.target.value; setQuestions(n); }} placeholder="Nhập lời giải..." />
                                <div className="w-full p-6 bg-slate-50 rounded-3xl border text-sm font-medium italic text-slate-500"><LatexText text={q.solution || '*Chưa có lời giải...*'} /></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

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
            { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' },
            { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM TỔNG' },
            { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' }
          ].map(m => (
            <button key={m.id} onClick={() => { setActiveMenu(m.id as any); if(m.id === 'create') { setEditingId(null); setTitle(''); setQuestions([]); } }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}><m.icon size={16}/> {m.label}</button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Professional Control Panel</div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* VIEW: SOẠN ĐỀ */}
          {activeMenu === 'create' && (
            <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <div className="flex items-center justify-between border-b pb-6">
                    <input type="text" className="text-3xl font-black outline-none bg-transparent placeholder-slate-200 w-full" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border">
                        {['practice', 'test'].map(t => (
                            <button key={t} onClick={() => setQuizType(t as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${quizType === t ? 'bg-white text-blue-600 shadow-md border' : 'text-slate-400 hover:text-slate-600'}`}>{t === 'practice' ? 'Luyện tập' : 'Kiểm tra'}</button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Khối lớp</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={grade} onChange={e => { setGrade(e.target.value as Grade); setCategory(''); }}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Chương học</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">Chọn chương học</option>{availableChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Thời gian (Phút)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} placeholder="Phút" /></div>
                    {quizType === 'test' && (<div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Thời gian bắt đầu</label><input type="datetime-local" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>)}
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl shadow-slate-200"><Save size={20}/> Lưu Đề Thi Vào Hệ Thống</button>
              </div>

              <QuestionSection title="PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn" type="mcq" icon={CheckCircle2} />
              <QuestionSection title="PHẦN II. Câu trắc nghiệm đúng sai" type="group-tf" icon={HelpCircle} />
              <QuestionSection title="PHẦN III. Câu trắc nghiệm trả lời ngắn" type="short" icon={AlignLeft} />
            </div>
          )}

          {/* VIEW: QUẢN LÝ ĐỀ THI */}
          {activeMenu === 'quizzes' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-5 rounded-[2rem] border shadow-sm">
                <div className="flex-1 w-full flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-2xl"><Search className="text-slate-300" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-bold w-full" placeholder="Tìm tên đề thi..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)} /></div>
                <div className="flex gap-2">
                    <select className="px-4 py-3 bg-white border rounded-2xl text-[10px] font-black uppercase" value={quizGradeFilter} onChange={e => { setQuizGradeFilter(e.target.value as any); setQuizChapterFilter('all'); }}><option value="all">TẤT CẢ KHỐI</option><option value="10">KHỐI 10</option><option value="11">KHỐI 11</option><option value="12">KHỐI 12</option></select>
                    <select className="px-4 py-3 bg-white border rounded-2xl text-[10px] font-black uppercase min-w-[180px]" value={quizChapterFilter} onChange={e => setQuizChapterFilter(e.target.value)}><option value="all">TẤT CẢ CHƯƠNG</option>{chapters.filter(c => quizGradeFilter === 'all' || c.grade === quizGradeFilter).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredQuizzes.map(q => {
                    const { count, max } = getQuizStats(q.id);
                    return (
                        <div key={q.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-[0_20px_50px_rgba(168,85,247,0.15)] hover:border-purple-200 transition-all duration-500 group relative flex flex-col">
                          <div className="flex justify-between items-start mb-8">
                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${q.type === 'practice' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{q.type === 'practice' ? 'LUYỆN TẬP' : 'KIỂM TRA'}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setCategory(q.category || ''); setQuizType(q.type); setStartTime(q.startTime || ''); setActiveMenu('create'); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors"><Edit size={16}/></button>
                              <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors"><Trash2 size={16}/></button>
                            </div>
                          </div>
                          
                          <h3 className="font-black text-slate-800 text-lg mb-8 leading-tight min-h-[56px] group-hover:text-purple-600 transition-colors">{q.title}</h3>
                          
                          <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 text-slate-400"><BookOpen size={16} className="text-blue-400 shrink-0"/><span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate">Chương: {q.category || 'Chưa phân loại'}</span></div>
                            <div className="flex items-center gap-3 text-slate-400"><Layers size={16} className="text-purple-400 shrink-0"/><span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{q.questions.length} câu hỏi • {q.durationMinutes} phút</span></div>
                            {q.startTime && <div className="flex items-center gap-3 text-slate-400"><Clock size={16} className="text-red-400 shrink-0"/><span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight italic">Bắt đầu: {new Date(q.startTime).toLocaleString('vi-VN')}</span></div>}
                          </div>

                          <div className="bg-slate-50/70 rounded-3xl p-6 grid grid-cols-2 gap-4 mb-8 border border-transparent group-hover:bg-purple-50/50 group-hover:border-purple-100 transition-all duration-500">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Users2 size={12} className="text-slate-400 group-hover:text-purple-400"/>
                                    <p className="text-[9px] font-black text-slate-400 group-hover:text-purple-500 uppercase">Số lượt làm</p>
                                </div>
                                <p className="text-sm font-black text-slate-800">{count}</p>
                            </div>
                            <div className="text-center border-l border-slate-200 group-hover:border-purple-200">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <Trophy size={12} className="text-slate-400 group-hover:text-purple-400"/>
                                    <p className="text-[9px] font-black text-slate-400 group-hover:text-purple-500 uppercase">Điểm cao nhất</p>
                                </div>
                                <p className="text-sm font-black text-purple-600">{max.toFixed(2)}</p>
                            </div>
                          </div>

                          <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-6 border-t flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline group-hover:translate-x-1 transition-transform group-hover:text-purple-600">
                            <Eye size={14}/> XEM THỬ ĐỀ THI
                          </button>
                        </div>
                    );
                })}
              </div>
            </div>
          )}

          {/* VIEW: CHƯƠNG HỌC */}
          {activeMenu === 'chapters' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thêm chương học mới</h4>
                    <div className="flex flex-col gap-4">
                        <select className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" id="ch-grade"><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                        <div className="flex gap-3"><input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" placeholder="Tên chương học..." id="ch-name" /><button onClick={async () => { const inputName = document.getElementById('ch-name') as HTMLInputElement; const inputGrade = document.getElementById('ch-grade') as HTMLSelectElement; if(!inputName.value) return; await saveChapter({ id: uuidv4(), name: inputName.value, grade: inputGrade.value as Grade, order: chapters.length }); inputName.value = ''; refreshData(); }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Lưu Chương</button></div>
                    </div>
                </div>
                <div className="space-y-8">
                    {['12', '11', '10'].map(g => (
                        <div key={g} className="space-y-3">
                            <h5 className="text-[10px] font-black text-slate-300 uppercase px-6 tracking-[0.2em]">Khối {g}</h5>
                            {chapters.filter(c => c.grade === g).map(c => (
                                <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all shadow-sm"><span className="font-black text-sm text-slate-700">{c.name}</span><button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL NGÂN HÀNG CÂU HỎI */}
      {showBank.open && (
          <div className="fixed inset-0 bg-slate-900/90 z-[1100] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><Database size={24}/></div><div><h3 className="text-lg font-black uppercase">Ngân hàng câu hỏi {showBank.type.toUpperCase()}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Lọc theo: Khối {grade} • Chương {category || 'Tất cả'}</p></div></div>
                      <button onClick={() => setShowBank({ ...showBank, open: false })} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-6">
                      {getBankQuestions(showBank.type).length === 0 ? (
                          <div className="text-center py-20 text-slate-400 font-bold italic">Không tìm thấy câu hỏi nào phù hợp trong ngân hàng.</div>
                      ) : (
                          getBankQuestions(showBank.type).map((q, i) => (
                              <div key={i} className="bg-white p-8 rounded-3xl border shadow-sm flex items-start gap-6 group hover:border-blue-500 transition-all">
                                  <div className="flex-1">
                                    <div className="text-sm font-bold text-slate-800 mb-4 leading-relaxed"><LatexText text={q.text}/></div>
                                    {q.imageUrl && <img src={q.imageUrl} className="w-32 h-20 object-cover rounded-xl border mb-4" alt="bank preview" />}
                                    <p className="text-[9px] font-black text-slate-300 uppercase italic">ID: {q.id.split('-')[0]}</p>
                                  </div>
                                  <button onClick={() => { addFromBank(q); setShowBank({...showBank, open: false}); }} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:scale-105 transition-transform">Chọn câu này</button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL XEM THỬ ĐỀ THI */}
      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0"><div className="flex items-center gap-5"><div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div><div><h3 className="text-lg font-black uppercase leading-tight">{previewQuiz.title}</h3><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Lớp {previewQuiz.grade} • {previewQuiz.questions.length} câu hỏi • {previewQuiz.durationMinutes} phút</p></div></div><button onClick={() => setPreviewQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors shadow-lg"><X size={24}/></button></div>
                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-12 pb-12">
                        {previewQuiz.questions.map((q, i) => (
                            <div key={q.id} className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 relative"><div className="text-slate-800 text-[15px] font-bold mb-6 leading-relaxed flex items-start gap-4"><span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span><div className="flex flex-col gap-4"><LatexText text={q.text}/>{q.imageUrl && <img src={q.imageUrl} className="max-w-full rounded-2xl border" alt="preview q" />}</div></div>
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
