
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Chapter, SubQuestion } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, deleteUser, deleteResult,
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
    Image as ImageIcon, CheckCircle2, AlertCircle, Trash
} from 'lucide-react';
import LatexText from './LatexText';

// --- TRÌNH SOẠN THẢO VĂN BẢN (RICH TEXT) ---
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
        <div className="flex flex-col gap-1 mb-4">
            {label && <label className="text-[10px] font-black text-slate-400 uppercase mb-1">{label}</label>}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                <div className="flex items-center gap-1 p-1 bg-slate-50 border-b border-slate-100">
                    <button type="button" onClick={() => insertTag('<b>', '</b>')} className="p-1.5 hover:bg-white rounded text-slate-500"><Bold size={12}/></button>
                    <button type="button" onClick={() => insertTag('$', '$')} className="p-1.5 hover:bg-white rounded text-blue-600"><Sigma size={12}/></button>
                    <button type="button" onClick={() => insertTag('<br/>')} className="p-1.5 hover:bg-white rounded text-slate-500"><CornerDownLeft size={12}/></button>
                </div>
                <textarea ref={inputRef} className="w-full p-3 outline-none text-sm leading-relaxed min-h-[80px]" rows={rows || 3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            </div>
            {value && <div className="mt-1 p-3 bg-blue-50/30 rounded-lg text-sm border border-blue-100"><LatexText text={value} /></div>}
        </div>
    );
};

const AdminDashboard = () => {
  const [activeMenu, setActiveMenu] = useState<'quizzes' | 'create' | 'import' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // State Soạn đề
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // State Quản lý chương
  const [newChapterName, setNewChapterName] = useState('');
  const [newChapterGrade, setNewChapterGrade] = useState<Grade>('12');

  // State AI/Import
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [aiTopic, setAiTopic] = useState('');

  useEffect(() => { refreshData(); }, []);

  const refreshData = async () => {
    const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
    setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
  };

  const handleAddQuestion = (type: QuestionType) => {
    const newQ: Question = {
        id: uuidv4(), type, text: '', points: type === 'mcq' ? 0.25 : 1.0,
        options: type === 'mcq' ? ['', '', '', ''] : undefined,
        subQuestions: type === 'group-tf' ? Array(4).fill(0).map(() => ({ id: uuidv4(), text: '', correctAnswer: 'True' })) : undefined,
        correctAnswer: type === 'mcq' ? '' : (type === 'short' ? '' : undefined)
    };
    setQuestions([...questions, newQ]);
  };

  const handleSaveQuiz = async () => {
      if (!title) return alert("Vui lòng nhập tiêu đề!");
      setIsProcessing(true);
      const data: Quiz = {
          id: editingId || uuidv4(), title, description: '', type: quizType, grade, category, 
          durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
      };
      try {
          if (editingId) await updateQuiz(data); else await saveQuiz(data);
          alert("Lưu đề thi thành công!");
          setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('quizzes');
          refreshData();
      } catch (e) { alert("Lỗi lưu đề."); } finally { setIsProcessing(false); }
  };

  // --- RENDER SECTIONS ---

  const renderQuizzes = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quizzes.map(q => (
            <div key={q.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Lớp {q.grade}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setGrade(q.grade); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveMenu('create'); }} className="p-2 hover:text-blue-600"><Edit size={16}/></button>
                        <button onClick={async () => { if(confirm('Xóa đề?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                </div>
                <h3 className="font-black text-slate-800 mb-2 leading-tight h-10 overflow-hidden">{q.title}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-6">{q.category || 'Chưa phân loại'}</p>
                <div className="flex justify-between items-center pt-4 border-t">
                    <span className="text-[10px] font-black text-slate-400">{q.questions.length} câu • {q.durationMinutes}p</span>
                    <span className={`text-[10px] font-black uppercase ${q.isPublished ? 'text-green-500' : 'text-slate-300'}`}>{q.isPublished ? 'Công khai' : 'Bản nháp'}</span>
                </div>
            </div>
        ))}
        <button onClick={() => { setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('create'); }} className="border-2 border-dashed border-slate-300 rounded-[2rem] flex flex-col items-center justify-center p-8 text-slate-400 hover:border-blue-400 hover:text-blue-400 transition-all">
            <Plus size={32} className="mb-2"/> <span className="text-xs font-black uppercase tracking-widest">Thêm đề mới</span>
        </button>
    </div>
  );

  const renderChapters = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest">Thêm chương mới</h3>
            <div className="flex gap-4">
                <select className="bg-slate-50 border rounded-xl px-4 text-sm font-bold" value={newChapterGrade} onChange={e => setNewChapterGrade(e.target.value as Grade)}>
                    <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                </select>
                <input type="text" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 text-sm font-bold outline-none" placeholder="Tên chương (VD: Đạo hàm)..." value={newChapterName} onChange={e => setNewChapterName(e.target.value)} />
                <button onClick={async () => {
                    if(!newChapterName) return;
                    await saveChapter({ id: uuidv4(), name: newChapterName, grade: newChapterGrade, order: chapters.length });
                    setNewChapterName(''); refreshData();
                }} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100"><Plus size={18}/></button>
            </div>
        </div>
        <div className="space-y-3">
            {chapters.map(c => (
                <div key={c.id} className="bg-white p-4 px-6 rounded-2xl border border-slate-200 flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black">LỚP {c.grade}</span>
                        <span className="text-sm font-black text-slate-700">{c.name}</span>
                    </div>
                    <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash size={16}/></button>
                </div>
            ))}
        </div>
    </div>
  );

  const renderCreateQuiz = () => (
    <div className="max-w-4xl mx-auto pb-40 animate-fade-in">
        {/* Header Config */}
        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-white shadow-xl mb-12 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-8">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Tiêu đề đề thi</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none focus:ring-4 focus:ring-blue-50" value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Kiểm tra 1 tiết chương 1..." />
            </div>
            <div className="col-span-6 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Khối</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                    <option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option>
                </select>
            </div>
            <div className="col-span-6 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Phút</label>
                <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
            </div>
            <div className="col-span-12">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 mb-1 block">Chương học</label>
                <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-black outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">-- Chọn chương --</option>
                    {chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>
        </div>

        {/* Questions */}
        <div className="space-y-12">
            {['mcq', 'group-tf', 'short'].map(type => (
                <div key={type} className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-4 px-4">
                        <h4 className="text-sm font-black uppercase text-slate-500 tracking-widest">{type === 'mcq' ? 'Phần I. Nhiều lựa chọn' : type === 'group-tf' ? 'Phần II. Đúng / Sai' : 'Phần III. Trả lời ngắn'}</h4>
                        <button onClick={() => handleAddQuestion(type as QuestionType)} className="flex items-center gap-2 text-[10px] font-black bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-100 active:scale-95 transition-all"><Plus size={14}/> THÊM CÂU</button>
                    </div>
                    <div className="space-y-6">
                        {questions.filter(q => q.type === type).map((q, idx) => (
                            <div key={q.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative group">
                                <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                                <div className="mb-6"><span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg mr-3">CÂU {idx + 1}</span></div>
                                <RichTextEditor value={q.text} onChange={val => {
                                    const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].text = val; setQuestions(n);
                                }} placeholder="Nội dung câu hỏi, dùng $ để nhập LaTeX..." />
                                
                                {type === 'mcq' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                        {q.options?.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].correctAnswer = opt; setQuestions(n); }} />
                                                <input type="text" className="flex-1 bg-transparent border-none text-sm font-bold outline-none" value={opt} onChange={e => { const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].options![oIdx] = e.target.value; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+oIdx)}...`} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {type === 'group-tf' && (
                                    <div className="space-y-3 mt-6">
                                        {q.subQuestions?.map((sq, sIdx) => (
                                            <div key={sq.id} className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <span className="text-xs font-bold text-slate-400 w-6">{String.fromCharCode(97+sIdx)})</span>
                                                <input type="text" className="flex-1 bg-transparent border-none text-sm font-medium outline-none" value={sq.text} onChange={e => { const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].subQuestions![sIdx].text = e.target.value; setQuestions(n); }} placeholder="Nhận định..." />
                                                <select className="text-[10px] font-black p-1 bg-white border rounded" value={sq.correctAnswer} onChange={e => { const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].subQuestions![sIdx].correctAnswer = e.target.value as any; setQuestions(n); }}><option value="True">ĐÚNG</option><option value="False">SAI</option></select>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {type === 'short' && (
                                    <div className="mt-6 flex items-center gap-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <span className="text-[10px] font-black text-emerald-600 uppercase">Đáp số chuẩn:</span>
                                        <input type="text" className="flex-1 bg-white border border-emerald-200 rounded-lg p-2 text-sm font-black outline-none" value={q.correctAnswer} onChange={e => { const n = [...questions]; const qi = n.findIndex(qu => qu.id === q.id); n[qi].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Kết quả..." />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* Action Bar */}
        <div className="fixed bottom-8 left-[280px] right-8 flex justify-end z-[60]">
            <div className="bg-white/80 backdrop-blur-xl p-3 rounded-[2rem] shadow-2xl border border-white flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 cursor-pointer text-[10px] font-black text-slate-400 uppercase"><input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} /> Công khai</label>
                <button onClick={handleSaveQuiz} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center gap-2"><Save size={18}/> Lưu đề thi</button>
            </div>
        </div>
    </div>
  );

  const renderResults = () => (
    <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Học sinh</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã số</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Đề thi</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm</th>
                        <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ngày nộp</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {results.map(r => (
                        <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-6 text-sm font-black text-slate-700">{r.studentName}</td>
                            <td className="p-6 text-xs font-bold text-slate-400">#{(users.find(u => u.id === r.studentId)?.studentCode) || '---'}</td>
                            <td className="p-6 text-xs font-bold text-slate-500">{(quizzes.find(q => q.id === r.quizId)?.title) || 'Đề đã xóa'}</td>
                            <td className="p-6"><span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">{r.score.toFixed(2)}</span></td>
                            <td className="p-6 text-right text-[10px] font-bold text-slate-300 uppercase">{new Date(r.submittedAt).toLocaleDateString('vi-VN')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {results.length === 0 && <div className="p-20 text-center text-slate-300 font-black uppercase text-xs">Chưa có kết quả thi nào</div>}
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[240px] bg-slate-900 flex flex-col shrink-0 z-50 shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Cpu size={18}/></div>
                <h1 className="text-xs font-black text-white uppercase tracking-widest">EDUQUIZ <span className="text-blue-500">ADMIN</span></h1>
            </div>
            <nav className="flex-1 p-4 space-y-1">
                {[
                    { id: 'quizzes', icon: LayoutDashboard, label: 'KHO ĐỀ THI' },
                    { id: 'chapters', icon: FolderTree, label: 'CHƯƠNG HỌC' },
                    { id: 'create', icon: Plus, label: 'SOẠN ĐỀ MỚI' },
                    { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM' },
                    { id: 'students', icon: Users, label: 'HỌC SINH' }
                ].map(item => (
                    <button key={item.id} onClick={() => setActiveMenu(item.id as any)} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <item.icon size={16}/> {item.label}
                    </button>
                ))}
            </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 bg-white border-b border-slate-100 px-8 flex justify-between items-center shrink-0">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{activeMenu}</h2>
                <div className="flex items-center gap-2">
                    <button onClick={refreshData} className="p-2 border rounded-xl hover:bg-slate-50 transition-all text-slate-400"><Shuffle size={14}/></button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {activeMenu === 'quizzes' && renderQuizzes()}
                {activeMenu === 'chapters' && renderChapters()}
                {activeMenu === 'create' && renderCreateQuiz()}
                {activeMenu === 'results' && renderResults()}
                {activeMenu === 'students' && (
                    <div className="max-w-4xl mx-auto space-y-4">
                        {users.filter(u => u.role === 'student').map(u => (
                            <div key={u.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center group shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs">{u.fullName.charAt(0)}</div>
                                    <div>
                                        <p className="text-sm font-black text-slate-700">{u.fullName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MSHS: {u.studentCode} • LỚP {u.grade}</p>
                                    </div>
                                </div>
                                <button onClick={async () => { if(confirm('Xóa tài khoản này?')) { await deleteUser(u.id); refreshData(); } }} className="p-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>

        {isProcessing && (
            <div className="fixed inset-0 bg-white/95 z-[2000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                <h2 className="text-xs font-black text-slate-800 mt-6 uppercase tracking-[0.3em]">{loadingMsg}</h2>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
