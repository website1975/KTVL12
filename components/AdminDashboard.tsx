
import React, { useState, useEffect } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, getChapters, saveChapter, deleteChapter, changePassword
} from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, Layers, 
    Search, ChevronRight, History, Key, X, Filter, CheckCircle2, 
    HelpCircle, AlignLeft, BookOpen, Calendar, Eye, XCircle, Target, FileText
} from 'lucide-react';
import LatexText from './LatexText';

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // --- STATE BỘ LỌC ĐỀ THI ---
  const [quizGradeFilter, setQuizGradeFilter] = useState<Grade | 'all'>('all');
  const [quizChapterFilter, setQuizChapterFilter] = useState<string | 'all'>('all');
  const [quizSearch, setQuizSearch] = useState('');
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  // --- STATE QUẢN LÝ HỌC SINH ---
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // --- STATE SOẠN ĐỀ ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [category, setCategory] = useState('');

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  // Lấy danh sách chương học dựa trên Khối đang chọn trong bộ lọc
  const availableChaptersForFilter = quizGradeFilter === 'all' 
    ? chapters 
    : chapters.filter(c => c.grade === quizGradeFilter);

  // Lọc danh sách đề thi dựa trên Khối, Chương và Search
  const filteredQuizzes = quizzes.filter(q => {
      const matchGrade = quizGradeFilter === 'all' || q.grade === quizGradeFilter;
      const matchChapter = quizChapterFilter === 'all' || q.category === quizChapterFilter;
      const matchSearch = q.title.toLowerCase().includes(quizSearch.toLowerCase());
      return matchGrade && matchChapter && matchSearch;
  });

  const getQuizStats = (quizId: string) => {
    const quizResults = results.filter(r => r.quizId === quizId);
    return { 
        count: quizResults.length, 
        max: quizResults.length > 0 ? Math.max(...quizResults.map(r => r.score)) : 0 
    };
  };

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: uuidv4(), type, text: '', points: type === 'group-tf' ? 1.0 : 0.25,
      options: type === 'mcq' ? ['', '', '', ''] : undefined,
      correctAnswer: '',
      subQuestions: type === 'group-tf' ? [
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' },
          { id: uuidv4(), text: '', correctAnswer: 'True' }
      ] : undefined
    };
    setQuestions([...questions, newQ]);
  };

  const handleSave = async () => {
    if (!title) return alert("Vui lòng nhập tiêu đề!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', type: 'practice',
      grade, durationMinutes: duration, questions, isPublished: true,
      createdAt: new Date().toISOString(), category
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    alert("Đã lưu thành công!");
    setActiveMenu('quizzes');
    refreshData();
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
            <button 
              key={m.id} 
              onClick={() => { setActiveMenu(m.id as any); setSelectedStudent(null); }} 
              className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <m.icon size={16}/> {m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Professional Control Panel</div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* VIEW: DANH SÁCH ĐỀ THI */}
          {activeMenu === 'quizzes' && (
            <div className="space-y-8 animate-fade-in">
              {/* BỘ LỌC THÔNG MINH */}
              <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-5 rounded-[2rem] border shadow-sm">
                <div className="flex-1 w-full flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-2xl">
                    <Search className="text-slate-300" size={18}/>
                    <input type="text" className="bg-transparent outline-none text-xs font-bold w-full" placeholder="Tìm tên đề thi..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    {/* Lọc Khối */}
                    <select 
                        className="px-4 py-3 bg-white border rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100" 
                        value={quizGradeFilter} 
                        onChange={e => {
                            setQuizGradeFilter(e.target.value as any);
                            setQuizChapterFilter('all'); // Reset chương khi đổi khối
                        }}
                    >
                        <option value="all">TẤT CẢ KHỐI</option>
                        <option value="10">KHỐI 10</option>
                        <option value="11">KHỐI 11</option>
                        <option value="12">KHỐI 12</option>
                    </select>
                    {/* Lọc Chương (Tự động thay đổi theo Khối) */}
                    <select 
                        className="px-4 py-3 bg-white border rounded-2xl text-[10px] font-black uppercase outline-none min-w-[180px] focus:ring-2 focus:ring-blue-100" 
                        value={quizChapterFilter} 
                        onChange={e => setQuizChapterFilter(e.target.value)}
                    >
                        <option value="all">TẤT CẢ CHƯƠNG</option>
                        {availableChaptersForFilter.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
              </div>

              {/* GRID ĐỀ THI */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredQuizzes.map(q => {
                  const { count, max } = getQuizStats(q.id);
                  return (
                    <div key={q.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl transition-all group relative flex flex-col">
                      <div className="flex justify-between items-start mb-8">
                        <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic">LUYỆN TẬP</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setCategory(q.category || ''); setActiveMenu('create'); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit size={16}/></button>
                          <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      <h3 className="font-black text-slate-800 text-lg mb-8 leading-tight min-h-[56px]">{q.title}</h3>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-slate-400">
                          <BookOpen size={16} className="text-blue-400 shrink-0"/>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate">Chương: {q.category || 'Chưa phân loại'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400">
                          <Layers size={16} className="text-purple-400 shrink-0"/>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{q.questions.length} câu hỏi • {q.durationMinutes} phút</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400">
                          <Calendar size={16} className="text-orange-400 shrink-0"/>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{new Date(q.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50/70 rounded-3xl p-6 grid grid-cols-2 gap-4 mb-8">
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Số lượt thi</p>
                          <p className="text-sm font-black text-slate-800">{count}</p>
                        </div>
                        <div className="text-center border-l">
                          <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Điểm cao nhất</p>
                          <p className="text-sm font-black text-blue-600">{max.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t flex justify-between items-center">
                        <span className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                          <div className={`w-2 h-2 rounded-full ${q.isPublished ? 'bg-green-400' : 'bg-slate-200'}`}></div> {q.isPublished ? 'Đã đăng' : 'Bản nháp'}
                        </span>
                        <button onClick={() => setPreviewQuiz(q)} className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline group-hover:translate-x-1 transition-transform">
                          <Eye size={14}/> XEM THỬ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: SOẠN ĐỀ (GIỮ NGUYÊN BỘ SOẠN CHUẨN) */}
          {activeMenu === 'create' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <input type="text" className="w-full text-2xl font-black border-b-2 p-3 outline-none focus:border-blue-500 transition-colors bg-transparent" placeholder="Tên đề thi mới..." value={title} onChange={e => setTitle(e.target.value)} />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select className="border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                        <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                    </select>
                    <select className="border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">Chọn chương học</option>
                        {chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input type="number" className="border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} placeholder="Phút" />
                    <div className="flex gap-2">
                        <button onClick={() => handleAddQuestion('mcq')} className="flex-1 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-1 shadow-lg hover:bg-blue-700 transition-all"><CheckCircle2 size={14}/> MCQ</button>
                        <button onClick={() => handleAddQuestion('group-tf')} className="flex-1 bg-purple-600 text-white rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-1 shadow-lg hover:bg-purple-700 transition-all"><HelpCircle size={14}/> Đ/S</button>
                    </div>
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl"><Save size={20}/> Lưu Đề Thi</button>
              </div>

              {/* LIST CÂU HỎI */}
              <div className="space-y-8">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3rem] border shadow-sm relative animate-fade-in-up">
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-10 right-10 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                    <div className="mb-6 flex items-center gap-4">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-5 py-2 rounded-2xl uppercase tracking-widest italic">Câu hỏi {idx + 1}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{q.type}</span>
                    </div>
                    <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl mb-8 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all min-h-[100px]" value={q.text} onChange={e => { const n = [...questions]; n[idx].text = e.target.value; setQuestions(n); }} placeholder="Nội dung câu hỏi (LaTeX $...$)..." />
                    
                    {q.type === 'mcq' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options?.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                    <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[idx].correctAnswer = opt; setQuestions(n); }} className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs font-black text-slate-300 italic">{String.fromCharCode(65+oi)}.</span>
                                    <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const n = [...questions]; n[idx].options![oi] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {q.type === 'group-tf' && (
                        <div className="space-y-4">
                            {q.subQuestions?.map((sq, si) => (
                                <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <span className="text-xs font-black text-blue-600 w-8 italic">{String.fromCharCode(97+si)})</span>
                                    <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const n = [...questions]; n[idx].subQuestions![si].text = e.target.value; setQuestions(n); }} placeholder="Nội dung ý..." />
                                    <div className="flex bg-white rounded-xl p-1.5 border">
                                        {['True', 'False'].map(v => (
                                            <button key={v} onClick={() => { const n = [...questions]; n[idx].subQuestions![si].correctAnswer = v as any; setQuestions(n); }} className={`px-5 py-2 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                                                {v === 'True' ? 'ĐÚNG' : 'SAI'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: CHƯƠNG HỌC */}
          {activeMenu === 'chapters' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thêm chương học mới</h4>
                    <div className="flex flex-col gap-4">
                        <select className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" id="ch-grade">
                            <option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option>
                        </select>
                        <div className="flex gap-3">
                            <input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Tên chương..." id="ch-name" />
                            <button onClick={async () => {
                                const inputName = document.getElementById('ch-name') as HTMLInputElement;
                                const inputGrade = document.getElementById('ch-grade') as HTMLSelectElement;
                                if(!inputName.value) return;
                                await saveChapter({ id: uuidv4(), name: inputName.value, grade: inputGrade.value as Grade, order: chapters.length });
                                inputName.value = ''; refreshData();
                            }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Lưu</button>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    {['12', '11', '10'].map(g => (
                        <div key={g} className="space-y-2">
                            <h5 className="text-[10px] font-black text-slate-300 uppercase px-4 tracking-[0.2em]">Khối {g}</h5>
                            {chapters.filter(c => c.grade === g).map(c => (
                                <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all shadow-sm">
                                    <span className="font-black text-sm text-slate-700">{c.name}</span>
                                    <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* VIEW: BẢNG ĐIỂM */}
          {activeMenu === 'results' && (
            <div className="bg-white rounded-[3rem] border overflow-hidden shadow-sm animate-fade-in">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b"><tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest"><th className="p-8">Học Sinh</th><th className="p-8">Đề Thi</th><th className="p-8 text-center">Điểm</th><th className="p-8 text-right">Ngày nộp</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {results.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                            <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-8 font-black text-sm text-slate-700">{r.studentName}</td>
                                <td className="p-8 text-[11px] font-bold text-slate-400 uppercase">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                <td className="p-8 text-center"><span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-blue-100">{r.score.toFixed(2)}</span></td>
                                <td className="p-8 text-right text-[11px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {/* VIEW: HỌC SINH */}
          {activeMenu === 'students' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                {selectedStudent ? (
                  <div className="space-y-8 animate-fade-in">
                      <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-6">
                              <button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><X size={24}/></button>
                              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-2xl">{selectedStudent.fullName.charAt(0)}</div>
                              <div>
                                  <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-2">{selectedStudent.fullName}</h3>
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {selectedStudent.studentCode} • Khối {selectedStudent.grade}</p>
                              </div>
                          </div>
                      </div>
                      <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden">
                          <table className="w-full text-left">
                              <thead><tr className="border-b bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase"><th className="p-8">Tên đề thi</th><th className="p-8 text-center">Điểm</th><th className="p-8 text-right">Ngày thi</th></tr></thead>
                              <tbody className="divide-y divide-slate-50">
                                  {results.filter(r => r.studentId === selectedStudent.id).map(r => (
                                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                          <td className="p-8 text-sm font-black text-slate-700">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                          <td className="p-8 text-center"><span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                                          <td className="p-8 text-right text-[11px] font-bold text-slate-400 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.filter(u => u.role === 'student').map(u => (
                        <div key={u.id} onClick={() => setSelectedStudent(u)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-5 group shadow-sm hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer">
                            <div className="w-16 h-16 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">{u.fullName.charAt(0)}</div>
                            <div><p className="text-base font-black text-slate-800 mb-1">{u.fullName}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khối {u.grade} • MSHS: {u.studentCode}</p></div>
                        </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL XEM THỬ ĐỀ THI (PREVIEW) */}
      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black uppercase leading-tight">{previewQuiz.title}</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold italic">Chế độ xem thử • {previewQuiz.questions.length} câu hỏi • Lớp {previewQuiz.grade}</p>
                        </div>
                    </div>
                    <button onClick={() => setPreviewQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors shadow-lg"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-12 pb-12">
                        {previewQuiz.questions.map((q, i) => (
                            <div key={q.id} className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100 relative">
                                <div className="text-slate-800 text-[15px] font-bold mb-6 leading-relaxed flex items-start gap-4">
                                    <span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span>
                                    <LatexText text={q.text}/>
                                </div>
                                {q.type === 'mcq' && q.options && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-12">
                                        {q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium text-slate-500 flex items-center gap-2"><span className="text-slate-300 font-black italic">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                    </div>
                                )}
                                {q.type === 'group-tf' && q.subQuestions && (
                                    <div className="space-y-3 ml-12 border-l-2 border-slate-100 pl-6">
                                        {q.subQuestions.map((sq, si) => <div key={si} className="text-sm font-medium text-slate-500"><span className="text-slate-300 font-black italic mr-2">{String.fromCharCode(97+si)})</span> <LatexText text={sq.text}/></div>)}
                                    </div>
                                )}
                                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase italic">
                                    <Target size={14}/> Trình xem thử nội dung đề thi
                                </div>
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
