
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
    Search, ChevronRight, History, Key, X, Filter, CheckCircle2, HelpCircle, AlignLeft
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
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20">
        <div className="p-8 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Cpu size={18}/></div>
          <span className="font-black text-[10px] tracking-[0.2em] uppercase">EduQuiz Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
            { id: 'create', icon: Plus, label: 'SOẠN ĐỀ MỚI' },
            { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' },
            { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM TỔNG' },
            { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' }
          ].map(m => (
            <button key={m.id} onClick={() => { setActiveMenu(m.id as any); setSelectedStudent(null); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <m.icon size={16}/> {m.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu}</h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {/* QUẢN LÝ ĐỀ THI */}
          {activeMenu === 'quizzes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map(q => (
                <div key={q.id} className="bg-white p-6 rounded-[2rem] border shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">LỚP {q.grade}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setActiveMenu('create'); }} className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                      <button onClick={async () => { if(confirm('Xóa đề thi?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 text-sm mb-4 leading-tight">{q.title}</h3>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-black uppercase pt-4 border-t">
                    <span className="flex items-center gap-1"><Layers size={14}/> {q.questions.length} câu</span>
                    <span className="flex items-center gap-1"><Clock size={14}/> {q.durationMinutes} phút</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TRÌNH SOẠN ĐỀ (KHÔI PHỤC ĐỦ 3 LOẠI) */}
          {activeMenu === 'create' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
              <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6">
                <input type="text" className="w-full text-lg font-black border-b-2 p-2 outline-none focus:border-blue-500 transition-colors" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <select className="border rounded-xl p-3 text-xs font-black bg-slate-50 uppercase" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                  <input type="number" className="border rounded-xl p-3 text-xs font-black bg-slate-50" value={duration} onChange={e => setDuration(parseInt(e.target.value))} placeholder="Phút" />
                  <button onClick={() => handleAddQuestion('mcq')} className="bg-blue-600 text-white p-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1"><CheckCircle2 size={14}/> MCQ</button>
                  <button onClick={() => handleAddQuestion('group-tf')} className="bg-purple-600 text-white p-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1"><HelpCircle size={14}/> Đúng/Sai</button>
                  <button onClick={() => handleAddQuestion('short')} className="bg-orange-600 text-white p-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1"><AlignLeft size={14}/> Ngắn</button>
                </div>
                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200"><Save size={18}/> Lưu Đề Thi</button>
              </div>

              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-8 rounded-[2rem] border shadow-sm relative group">
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-6 right-6 text-slate-200 hover:text-red-500"><Trash2 size={20}/></button>
                    <div className="mb-4 flex items-center gap-3">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl uppercase">Câu {idx + 1}</span>
                        <span className="text-[10px] font-black text-slate-300 uppercase">{q.type}</span>
                    </div>
                    <textarea className="w-full p-4 bg-slate-50 border rounded-2xl mb-6 text-sm font-bold outline-none" value={q.text} onChange={e => { const n = [...questions]; n[idx].text = e.target.value; setQuestions(n); }} placeholder="Nội dung câu hỏi (hỗ trợ $...$)..." />
                    
                    {/* MCQ UI */}
                    {q.type === 'mcq' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options?.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border">
                            <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[idx].correctAnswer = opt; setQuestions(n); }} />
                            <input type="text" className="bg-transparent text-xs font-bold outline-none flex-1" value={opt} onChange={e => { const n = [...questions]; n[idx].options![oi] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Group TF UI */}
                    {q.type === 'group-tf' && (
                        <div className="space-y-3">
                            {q.subQuestions?.map((sq, si) => (
                                <div key={si} className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border">
                                    <span className="text-xs font-black text-blue-600 w-6">{String.fromCharCode(97+si)})</span>
                                    <input type="text" className="flex-1 bg-transparent text-xs font-bold outline-none" value={sq.text} onChange={e => { const n = [...questions]; n[idx].subQuestions![si].text = e.target.value; setQuestions(n); }} placeholder="Nội dung ý..." />
                                    <div className="flex bg-white rounded-lg p-1 border">
                                        {['True', 'False'].map(v => (
                                            <button key={v} onClick={() => { const n = [...questions]; n[idx].subQuestions![si].correctAnswer = v as any; setQuestions(n); }} className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                                                {v === 'True' ? 'ĐÚNG' : 'SAI'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Short Answer UI */}
                    {q.type === 'short' && (
                        <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border">
                            <span className="text-xs font-black text-slate-400 uppercase">Đáp án đúng:</span>
                            <input type="text" className="flex-1 bg-transparent text-sm font-black text-blue-600 outline-none" value={q.correctAnswer} onChange={e => { const n = [...questions]; n[idx].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Nhập đáp án chính xác..." />
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUẢN LÝ HỌC SINH (BẢN TỐI ƯU) */}
          {activeMenu === 'students' && (
            <div className="max-w-5xl mx-auto space-y-6">
               {selectedStudent ? (
                  <div className="space-y-6 animate-fade-in">
                      <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-5">
                              <button onClick={() => setSelectedStudent(null)} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><X size={20}/></button>
                              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl">{selectedStudent.fullName.charAt(0)}</div>
                              <div>
                                  <h3 className="text-lg font-black text-slate-800 uppercase leading-none mb-2">{selectedStudent.fullName}</h3>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {selectedStudent.studentCode} • KHỐI {selectedStudent.grade}</p>
                              </div>
                          </div>
                          <button onClick={() => handleResetPassword(selectedStudent.id)} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-lg"><Key size={14}/> Đổi mật khẩu</button>
                      </div>

                      <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
                          <div className="p-6 border-b bg-slate-50/50 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><History size={16}/> Lịch sử thi tập</div>
                          <table className="w-full text-left border-collapse">
                              <thead>
                                  <tr className="border-b bg-slate-50/30"><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Đề thi</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Điểm</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Ngày nộp</th></tr>
                              </thead>
                              <tbody className="divide-y">
                                  {results.filter(r => r.studentId === selectedStudent.id).map(r => (
                                      <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                          <td className="p-6 text-sm font-black text-slate-700">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                          <td className="p-6"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                                          <td className="p-6 text-right text-[10px] font-bold text-slate-400 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                                      </tr>
                                  ))}
                                  {results.filter(r => r.studentId === selectedStudent.id).length === 0 && <tr><td colSpan={3} className="p-20 text-center text-slate-300 font-black uppercase text-xs">Chưa có dữ liệu bài thi</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
               ) : (
                  <>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 bg-white px-6 py-4 rounded-2xl border shadow-sm flex items-center gap-4">
                            <Search className="text-slate-300" size={20}/>
                            <input type="text" className="flex-1 outline-none text-sm font-bold bg-transparent" placeholder="Tìm tên hoặc MSHS..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                        </div>
                        <div className="bg-white p-2 rounded-2xl border shadow-sm flex gap-1">
                            {['all', '10', '11', '12'].map(g => (
                                <button key={g} onClick={() => setGradeFilter(g as any)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${gradeFilter === g ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>
                                    {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStudents.map(u => (
                            <div key={u.id} onClick={() => setSelectedStudent(u)} className="bg-white p-6 rounded-[2rem] border flex justify-between items-center group shadow-sm hover:border-blue-400 transition-all cursor-pointer">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-600 group-hover:text-white transition-all">{u.fullName.charAt(0)}</div>
                                    <div><p className="text-sm font-black text-slate-800">{u.fullName}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {u.studentCode} • Lớp {u.grade}</p></div>
                                </div>
                                <ChevronRight className="text-slate-200 group-hover:text-blue-500 transition-all" size={20}/>
                            </div>
                        ))}
                    </div>
                  </>
               )}
            </div>
          )}

          {/* BẢNG ĐIỂM TỔNG (GIỮ NGUYÊN) */}
          {activeMenu === 'results' && (
            <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm animate-fade-in">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50"><tr className="border-b"><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Học Sinh</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Đề Thi</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase">Điểm</th><th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Ngày nộp</th></tr></thead>
                    <tbody className="divide-y">
                        {results.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).map(r => (
                            <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-6 font-black text-sm text-slate-700">{r.studentName}</td>
                                <td className="p-6 text-xs font-bold text-slate-400">{quizzes.find(q => q.id === r.quizId)?.title || 'N/A'}</td>
                                <td className="p-6"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                                <td className="p-6 text-right text-[10px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          )}

          {/* CHƯƠNG HỌC (GIỮ NGUYÊN) */}
          {activeMenu === 'chapters' && (
            <div className="max-w-xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-[2rem] border shadow-sm flex gap-2">
                    <input type="text" className="flex-1 p-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none" placeholder="Tên chương học..." id="ch-name" />
                    <button onClick={async () => {
                        const input = document.getElementById('ch-name') as HTMLInputElement;
                        if(!input.value) return;
                        await saveChapter({ id: uuidv4(), name: input.value, grade: '12', order: chapters.length });
                        input.value = ''; refreshData();
                    }} className="bg-blue-600 text-white px-8 rounded-2xl font-black text-xs uppercase shadow-lg hover:bg-blue-700 transition-all">Thêm</button>
                </div>
                <div className="space-y-3">
                    {chapters.map(c => (
                        <div key={c.id} className="bg-white p-5 px-8 rounded-3xl border flex justify-between items-center group hover:border-blue-400 transition-all">
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
