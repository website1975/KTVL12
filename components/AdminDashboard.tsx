
import React, { useState, useEffect } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, SubQuestion } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, getChapters, saveChapter, deleteChapter, changePassword
} from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, Layers, 
    Search, ChevronRight, History, Key, X, Filter, CheckCircle2, 
    HelpCircle, AlignLeft, BookOpen, Calendar, Eye
} from 'lucide-react';
import LatexText from './LatexText';

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // State Quản lý học sinh
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // State Soạn đề
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  // Tính toán thống kê cho từng đề thi
  const getQuizStats = (quizId: string) => {
    const quizResults = results.filter(r => r.quizId === quizId);
    const count = quizResults.length;
    const max = count > 0 ? Math.max(...quizResults.map(r => r.score)) : 0;
    return { count, max };
  };

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: uuidv4(), 
      type, 
      text: '', 
      points: type === 'group-tf' ? 1.0 : 0.25,
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
    if (!title) return alert("Vui lòng nhập tiêu đề đề thi!");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', type: 'practice',
      grade, durationMinutes: duration, questions, isPublished: true,
      createdAt: new Date().toISOString()
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    alert("Đã lưu đề thi thành công!");
    setActiveMenu('quizzes');
    refreshData();
  };

  const handleResetPassword = async (userId: string) => {
      const newPass = prompt("Nhập mật khẩu mới cho học sinh:");
      if (newPass && newPass.length >= 3) {
          const success = await changePassword(userId, newPass);
          if (success) alert("Đã đổi mật khẩu thành công!");
      }
  };

  const filteredStudents = users.filter(u => {
      if (u.role !== 'student') return false;
      const matchSearch = u.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          u.studentCode?.toLowerCase().includes(studentSearch.toLowerCase());
      const matchGrade = gradeFilter === 'all' || u.grade === gradeFilter;
      return matchSearch && matchGrade;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-700">
      {/* Sidebar - Chuyên nghiệp */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"><Cpu size={18}/></div>
          <span className="font-black text-[11px] tracking-[0.2em] uppercase">EduQuiz Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
            { id: 'create', icon: Plus, label: 'SOẠN ĐỀ MỚI' },
            { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' },
            { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM TỔNG' },
            { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' }
          ].map(m => (
            <button key={m.id} onClick={() => { setActiveMenu(m.id as any); setSelectedStudent(null); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <m.icon size={16}/> {m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
            <div className="flex items-center gap-4">
                <div className="h-8 w-px bg-slate-100"></div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Admin Control Panel</span>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* DANH SÁCH ĐỀ THI - THEO MẪU ẢNH BẠN GỬI */}
          {activeMenu === 'quizzes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
              {quizzes.map(q => {
                const { count, max } = getQuizStats(q.id);
                return (
                  <div key={q.id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl transition-all group relative overflow-hidden flex flex-col">
                    <div className="flex justify-between items-start mb-8">
                      <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">LUYỆN TẬP</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setActiveMenu('create'); }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit size={16}/></button>
                        <button onClick={async () => { if(confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 size={16}/></button>
                      </div>
                    </div>

                    <h3 className="font-black text-slate-800 text-lg mb-8 leading-tight min-h-[56px]">{q.title}</h3>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3 text-slate-400">
                        <BookOpen size={16} className="shrink-0"/>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate">Chương: {q.category || 'Mô tả chuyển động...'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <Layers size={16} className="shrink-0"/>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{q.questions.length} câu hỏi • {q.durationMinutes} phút</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <Calendar size={16} className="shrink-0"/>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">{new Date(q.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-3xl p-6 grid grid-cols-2 gap-4 mb-8">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Số người làm</p>
                        <p className="text-sm font-black text-slate-800">{count} lượt</p>
                      </div>
                      <div className="text-center border-l">
                        <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Điểm cao nhất</p>
                        <p className="text-sm font-black text-blue-600">{max.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t flex justify-between items-center">
                       <span className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                         <div className="w-2 h-2 rounded-full bg-slate-200"></div> Bản nháp
                       </span>
                       <button className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                         <Eye size={14}/> Xem thử
                       </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => { setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('create'); }} className="border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-slate-300 hover:border-blue-400 hover:text-blue-500 transition-all bg-white/30">
                <Plus size={48} className="mb-4"/> <span className="text-xs font-black uppercase tracking-widest">Tạo đề thi mới</span>
              </button>
            </div>
          )}

          {/* TRÌNH SOẠN ĐỀ (GIỮ NGUYÊN BẢN CŨ CỦA BẠN) */}
          {activeMenu === 'create' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
              <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                <input type="text" className="w-full text-2xl font-black border-b-2 p-3 outline-none focus:border-blue-500 transition-colors bg-transparent" placeholder="Tiêu đề đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <select className="border rounded-2xl p-4 text-xs font-black bg-slate-50 uppercase outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option></select>
                  <input type="number" className="border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} placeholder="Phút" />
                  <button onClick={() => handleAddQuestion('mcq')} className="bg-blue-600 text-white p-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700"><CheckCircle2 size={16}/> MCQ</button>
                  <button onClick={() => handleAddQuestion('group-tf')} className="bg-purple-600 text-white p-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-purple-100 hover:bg-purple-700"><HelpCircle size={16}/> Đúng/Sai</button>
                  <button onClick={() => handleAddQuestion('short')} className="bg-orange-500 text-white p-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-100 hover:bg-orange-600"><AlignLeft size={16}/> Ngắn</button>
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl shadow-slate-200"><Save size={20}/> Lưu Đề Thi Vào Hệ Thống</button>
              </div>

              <div className="space-y-8 mt-12">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-10 rounded-[3rem] border shadow-sm relative group animate-fade-in-up">
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-10 right-10 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                    <div className="mb-8 flex items-center gap-4">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-5 py-2 rounded-2xl uppercase tracking-widest">Câu hỏi {idx + 1}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{q.type}</span>
                    </div>
                    <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl mb-8 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all min-h-[120px]" value={q.text} onChange={e => { const n = [...questions]; n[idx].text = e.target.value; setQuestions(n); }} placeholder="Nội dung câu hỏi (hỗ trợ LaTeX $...$)..." />
                    
                    {/* UI CHO CÁC LOẠI CÂU HỎI */}
                    {q.type === 'mcq' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {q.options?.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[idx].correctAnswer = opt; setQuestions(n); }} className="w-5 h-5 text-blue-600" />
                            <span className="text-xs font-black text-slate-300">{String.fromCharCode(65+oi)}.</span>
                            <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const n = [...questions]; n[idx].options![oi] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'group-tf' && (
                        <div className="space-y-4">
                            {q.subQuestions?.map((sq, si) => (
                                <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <span className="text-xs font-black text-blue-600 w-8">{String.fromCharCode(97+si)})</span>
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

                    {q.type === 'short' && (
                        <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Đáp án đúng:</span>
                            <input type="text" className="flex-1 bg-transparent text-lg font-black text-blue-600 outline-none" value={q.correctAnswer} onChange={e => { const n = [...questions]; n[idx].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Nhập đáp án chính xác..." />
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUẢN LÝ HỌC SINH - ĐÃ TỐI ƯU HÓA */}
          {activeMenu === 'students' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
               {selectedStudent ? (
                  <div className="space-y-8 animate-fade-in">
                      <div className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                          <div className="flex items-center gap-6">
                              <button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><X size={24}/></button>
                              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-blue-200">{selectedStudent.fullName.charAt(0)}</div>
                              <div>
                                  <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-2">{selectedStudent.fullName}</h3>
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {selectedStudent.studentCode} • KHỐI {selectedStudent.grade}</p>
                              </div>
                          </div>
                          <button onClick={() => handleResetPassword(selectedStudent.id)} className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-xl shadow-slate-200"><Key size={18}/> Đặt lại mật khẩu</button>
                      </div>

                      <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden">
                          <div className="p-8 border-b bg-slate-50/30 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-slate-400"><History size={20}/> Nhật ký kết quả làm bài</div>
                          <table className="w-full text-left">
                              <thead>
                                  <tr className="border-b bg-slate-50/20"><th className="p-8 text-[11px] font-black text-slate-400 uppercase">Tên đề thi đã thực hiện</th><th className="p-8 text-[11px] font-black text-slate-400 uppercase text-center">Điểm số</th><th className="p-8 text-[11px] font-black text-slate-400 uppercase text-right">Ngày nộp bài</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                  {results.filter(r => r.studentId === selectedStudent.id).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                          <td className="p-8 text-sm font-black text-slate-700">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                          <td className="p-8 text-center"><span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-blue-100">{r.score.toFixed(2)}</span></td>
                                          <td className="p-8 text-right text-[11px] font-bold text-slate-400 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')} {new Date(r.submittedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</td>
                                      </tr>
                                  ))}
                                  {results.filter(r => r.studentId === selectedStudent.id).length === 0 && <tr><td colSpan={3} className="p-24 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Học sinh này chưa tham gia thi</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
               ) : (
                  <div className="space-y-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-white px-8 py-5 rounded-3xl border shadow-sm flex items-center gap-4 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <Search className="text-slate-300" size={24}/>
                            <input type="text" className="flex-1 outline-none text-sm font-bold bg-transparent" placeholder="Tìm kiếm học sinh theo Tên hoặc MSHS..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                        </div>
                        <div className="bg-white p-2 rounded-3xl border shadow-sm flex gap-1">
                            {['all', '10', '11', '12'].map(g => (
                                <button key={g} onClick={() => setGradeFilter(g as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${gradeFilter === g ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                                    {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredStudents.map(u => (
                            <div key={u.id} onClick={() => setSelectedStudent(u)} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex justify-between items-center group shadow-sm hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-slate-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center font-black text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">{u.fullName.charAt(0)}</div>
                                    <div>
                                      <p className="text-base font-black text-slate-800 leading-tight mb-1">{u.fullName}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {u.studentCode} • LỚP {u.grade}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); if(confirm(`Xóa tài khoản ${u.fullName}?`)) { deleteUser(u.id); refreshData(); } }} className="p-2 text-slate-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>
                                    <ChevronRight className="text-slate-100 group-hover:text-blue-500 transition-all" size={24}/>
                                </div>
                            </div>
                        ))}
                    </div>
                  </div>
               )}
            </div>
          )}

          {/* BẢNG ĐIỂM TỔNG - GIỮ NGUYÊN */}
          {activeMenu === 'results' && (
            <div className="bg-white rounded-[3rem] border overflow-hidden shadow-sm animate-fade-in">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50"><tr className="border-b"><th className="p-8 text-[11px] font-black text-slate-400 uppercase">Học Sinh</th><th className="p-8 text-[11px] font-black text-slate-400 uppercase">Đề Thi</th><th className="p-8 text-[11px] font-black text-slate-400 uppercase text-center">Điểm</th><th className="p-8 text-[11px] font-black text-slate-400 uppercase text-right">Ngày nộp</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {results.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                            <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-8 font-black text-sm text-slate-700">{r.studentName}</td>
                                <td className="p-8 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                <td className="p-8 text-center"><span className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-blue-100">{r.score.toFixed(2)}</span></td>
                                <td className="p-8 text-right text-[11px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {/* CHƯƠNG HỌC - GIỮ NGUYÊN */}
          {activeMenu === 'chapters' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thêm chương học mới</h4>
                    <div className="flex gap-3">
                        <input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Tên chương học..." id="ch-name" />
                        <button onClick={async () => {
                            const input = document.getElementById('ch-name') as HTMLInputElement;
                            if(!input.value) return;
                            await saveChapter({ id: uuidv4(), name: input.value, grade: '12', order: chapters.length });
                            input.value = ''; refreshData();
                        }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Thêm</button>
                    </div>
                </div>
                <div className="space-y-4">
                    {chapters.map(c => (
                        <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all shadow-sm">
                            <span className="font-black text-sm text-slate-700">{c.name}</span>
                            <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
