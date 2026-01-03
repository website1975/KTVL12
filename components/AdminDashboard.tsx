
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
    Search, ChevronRight, History, Key, X, Filter, User as UserIcon, Award
} from 'lucide-react';
import LatexText from './LatexText';

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // State Quản lý học sinh tối ưu
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // State Soạn đề
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

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: uuidv4(), type, text: '', points: 0.25,
      options: type === 'mcq' ? ['', '', '', ''] : undefined,
      correctAnswer: ''
    };
    setQuestions([...questions, newQ]);
  };

  const handleSave = async () => {
    if (!title) return alert("Cần tiêu đề!");
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

  const handleResetPassword = async (userId: string) => {
      const newPass = prompt("Nhập mật khẩu mới cho học sinh này (tối thiểu 3 ký tự):");
      if (newPass && newPass.length >= 3) {
          const success = await changePassword(userId, newPass);
          if (success) alert("Đã đổi mật khẩu thành công!");
          else alert("Có lỗi xảy ra.");
      }
  };

  // Logic lọc danh sách học sinh
  const filteredStudents = users.filter(u => {
      if (u.role !== 'student') return false;
      const matchSearch = u.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || 
                          u.studentCode?.toLowerCase().includes(studentSearch.toLowerCase());
      const matchGrade = gradeFilter === 'all' || u.grade === gradeFilter;
      return matchSearch && matchGrade;
  });

  // Tính toán nhanh thống kê học sinh được chọn
  const getStudentStats = (studentId: string) => {
      const studentResults = results.filter(r => r.studentId === studentId);
      const total = studentResults.length;
      const avg = total > 0 ? studentResults.reduce((acc, curr) => acc + curr.score, 0) / total : 0;
      return { total, avg };
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-700">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl z-20">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20"><Cpu size={18}/></div>
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
            <button key={m.id} onClick={() => { setActiveMenu(m.id as any); setSelectedStudent(null); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <m.icon size={16}/> {m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-300">ADMINISTRATOR</span>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* View: Quizzes */}
          {activeMenu === 'quizzes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {quizzes.map(q => (
                <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all group border-b-4 border-b-slate-100 hover:border-b-blue-600">
                  <div className="flex justify-between items-start mb-6">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">LỚP {q.grade}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setCategory(q.category || ''); setActiveMenu('create'); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                      <button onClick={async () => { if(confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm mb-4 leading-tight min-h-[40px]">{q.title}</h3>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black uppercase pt-4 border-t border-slate-50">
                    <span className="flex items-center gap-1.5"><Layers size={14}/> {q.questions.length} câu</span>
                    <span className="flex items-center gap-1.5"><Clock size={14}/> {q.durationMinutes} phút</span>
                  </div>
                </div>
              ))}
              <button onClick={() => { setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('create'); }} className="border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-8 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all bg-white/50">
                <Plus size={32} className="mb-2"/> <span className="text-xs font-black uppercase tracking-widest">Tạo đề mới</span>
              </button>
            </div>
          )}

          {/* View: Create/Edit Quiz */}
          {activeMenu === 'create' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tiêu đề đề thi</label>
                    <input type="text" className="w-full text-lg font-black border-b-2 border-slate-100 p-2 outline-none focus:border-blue-500 transition-colors" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <select className="border rounded-xl p-3 text-sm font-bold bg-slate-50" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                  <input type="number" className="border rounded-xl p-3 text-sm font-bold bg-slate-50" value={duration} onChange={e => setDuration(parseInt(e.target.value))} placeholder="Phút" />
                  <button onClick={() => handleAddQuestion('mcq')} className="bg-blue-600 text-white p-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-blue-700 transition-all">+ Câu MCQ</button>
                  <button onClick={handleSave} className="bg-slate-900 text-white p-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-xl hover:bg-black transition-all"><Save size={14}/> Lưu Đề</button>
                </div>
              </div>

              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group animate-fade-in-up">
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-6 right-6 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                    <div className="mb-6"><span className="text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl uppercase">Câu {idx + 1}</span></div>
                    <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-6 text-sm font-medium focus:ring-4 focus:ring-blue-50 outline-none transition-all min-h-[100px]" value={q.text} onChange={e => { const n = [...questions]; n[idx].text = e.target.value; setQuestions(n); }} placeholder="Nội dung câu hỏi..." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options?.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                          <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[idx].correctAnswer = opt; setQuestions(n); }} className="w-5 h-5 text-blue-600" />
                          <span className="text-xs font-black text-slate-300">{String.fromCharCode(65+oi)}.</span>
                          <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const n = [...questions]; n[idx].options![oi] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View: Students - Tối ưu nhất */}
          {activeMenu === 'students' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
               {selectedStudent ? (
                  /* CHI TIẾT HỌC SINH */
                  <div className="space-y-6 animate-fade-in">
                      <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-6">
                              <button onClick={() => setSelectedStudent(null)} className="p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all"><X size={20}/></button>
                              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-blue-100">{selectedStudent.fullName.charAt(0)}</div>
                              <div>
                                  <h3 className="text-xl font-black text-slate-800 uppercase leading-none mb-2">{selectedStudent.fullName}</h3>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <UserIcon size={12}/> MSHS: {selectedStudent.studentCode} • <Filter size={12}/> KHỐI {selectedStudent.grade}
                                  </p>
                              </div>
                          </div>
                          
                          <div className="flex gap-4">
                              <div className="bg-slate-50 px-6 py-3 rounded-2xl text-center border">
                                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Điểm TB</p>
                                  <p className="text-xl font-black text-blue-600">{getStudentStats(selectedStudent.id).avg.toFixed(2)}</p>
                              </div>
                              <div className="bg-slate-50 px-6 py-3 rounded-2xl text-center border">
                                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Đã thi</p>
                                  <p className="text-xl font-black text-slate-800">{getStudentStats(selectedStudent.id).total}</p>
                              </div>
                              <button onClick={() => handleResetPassword(selectedStudent.id)} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg"><Key size={14}/> Đổi mật khẩu</button>
                          </div>
                      </div>

                      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                          <div className="p-6 border-b bg-slate-50/50 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><History size={16}/> Nhật ký thi tập</div>
                          <table className="w-full text-left">
                              <thead>
                                  <tr className="border-b"><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Đề thi</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase text-center">Kết quả</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Thời gian</th></tr>
                              </thead>
                              <tbody className="divide-y">
                                  {results.filter(r => r.studentId === selectedStudent.id).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                                      <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                          <td className="p-6 text-sm font-black text-slate-700">{quizzes.find(q => q.id === r.quizId)?.title || 'Đề thi đã bị gỡ'}</td>
                                          <td className="p-6 text-center"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                                          <td className="p-6 text-right text-[10px] font-bold text-slate-400 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')} {new Date(r.submittedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</td>
                                      </tr>
                                  ))}
                                  {results.filter(r => r.studentId === selectedStudent.id).length === 0 && <tr><td colSpan={3} className="p-20 text-center text-slate-300 font-black uppercase text-xs">Chưa tham gia kỳ thi nào</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
               ) : (
                  /* DANH SÁCH HỌC SINH TỔNG HỢP */
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-white px-6 py-4 rounded-[1.5rem] border shadow-sm flex items-center gap-4 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <Search className="text-slate-300" size={20}/>
                            <input type="text" className="flex-1 outline-none text-sm font-bold bg-transparent" placeholder="Tìm tên hoặc mã số học sinh..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                        </div>
                        <div className="bg-white p-2 rounded-[1.5rem] border shadow-sm flex gap-1">
                            {['all', '10', '11', '12'].map(g => (
                                <button key={g} onClick={() => setGradeFilter(g as any)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gradeFilter === g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                                    {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredStudents.map(u => {
                            const {total, avg} = getStudentStats(u.id);
                            return (
                                <div key={u.id} onClick={() => setSelectedStudent(u)} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 flex flex-col group shadow-sm hover:shadow-xl hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-14 h-14 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">{u.fullName.charAt(0)}</div>
                                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase">LỚP {u.grade}</span>
                                    </div>
                                    
                                    <h4 className="text-sm font-black text-slate-800 mb-1 leading-tight">{u.fullName}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">MSHS: {u.studentCode}</p>

                                    <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex gap-4">
                                            <div><p className="text-[8px] font-black text-slate-300 uppercase">Điểm TB</p><p className="text-xs font-black text-blue-600">{avg.toFixed(1)}</p></div>
                                            <div><p className="text-[8px] font-black text-slate-300 uppercase">Bài thi</p><p className="text-xs font-black text-slate-700">{total}</p></div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm(`Xóa tài khoản ${u.fullName}?`)) { deleteUser(u.id); refreshData(); } }} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                    </div>
                                    
                                    <ChevronRight className="absolute bottom-6 right-2 text-slate-100 group-hover:text-blue-200 transition-all" size={40}/>
                                </div>
                            );
                        })}
                        {filteredStudents.length === 0 && (
                            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-300 font-black uppercase text-xs tracking-widest">Không tìm thấy học sinh phù hợp</div>
                        )}
                    </div>
                  </div>
               )}
            </div>
          )}

          {/* View: Results */}
          {activeMenu === 'results' && (
            <div className="bg-white rounded-[2.5rem] border overflow-hidden shadow-sm animate-fade-in">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50"><tr className="border-b"><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Học Sinh</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Đề Thi</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Điểm</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Ngày nộp</th></tr></thead>
                    <tbody className="divide-y">
                        {results.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                            <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-6 font-black text-sm text-slate-700">{r.studentName}</td>
                                <td className="p-6 text-xs font-bold text-slate-400">{quizzes.find(q => q.id === r.quizId)?.title || 'Đề thi đã gỡ'}</td>
                                <td className="p-6"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                                <td className="p-6 text-right text-[10px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {/* View: Chapters */}
          {activeMenu === 'chapters' && (
            <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thêm chương học mới</h4>
                    <div className="flex gap-2">
                        <input type="text" className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="Tên chương..." id="ch-name" />
                        <button onClick={async () => {
                            const input = document.getElementById('ch-name') as HTMLInputElement;
                            if(!input.value) return;
                            await saveChapter({ id: uuidv4(), name: input.value, grade: '12', order: chapters.length });
                            input.value = ''; refreshData();
                        }} className="bg-blue-600 text-white px-8 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">Thêm</button>
                    </div>
                </div>
                <div className="space-y-3">
                    {chapters.map(c => (
                        <div key={c.id} className="bg-white p-5 px-8 rounded-3xl border border-slate-200 flex justify-between items-center group hover:border-blue-400 transition-all">
                            <span className="font-black text-sm text-slate-700">{c.name}</span>
                            <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18}/></button>
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
