
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
    Trophy, Users2, Sparkles, FileUp, CheckCircle, AlertCircle, Filter, ChevronRight
} from 'lucide-react';
import LatexText from './LatexText';

// --- SUB-COMPONENT: QUESTION SECTION ---
interface SectionProps {
    title: string;
    type: QuestionType;
    questions: Question[];
    setQuestions: (qs: Question[]) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
}

const QuestionSection: React.FC<SectionProps> = ({ title, type, questions, setQuestions, onUploadImage, uploadingId }) => {
    const sectionQuestions = questions.filter(q => q.type === type);
    const Icon = type === 'mcq' ? CheckCircle2 : type === 'group-tf' ? HelpCircle : AlignLeft;

    const addManual = () => {
        const newQ: Question = {
            id: uuidv4(), type, text: '', points: type === 'mcq' ? 0.25 : type === 'group-tf' ? 1.0 : 0.5,
            options: type === 'mcq' ? ['', '', '', ''] : undefined,
            correctAnswer: '', solution: '',
            subQuestions: type === 'group-tf' ? [
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' }
            ] : undefined
        };
        setQuestions([...questions, newQ]);
    };

    return (
        <div className="space-y-6 mt-10">
            <div className="flex items-center justify-between bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sectionQuestions.length} câu</p>
                    </div>
                </div>
                <button onClick={addManual} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">
                    <Plus size={14}/> Thêm câu hỏi
                </button>
            </div>

            <div className="space-y-6">
                {sectionQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative group animate-fade-in-up">
                        <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors">
                            <Trash2 size={24}/>
                        </button>
                        <span className="text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest bg-slate-100 text-slate-500 mb-6 inline-block">Câu {idx + 1}</span>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold outline-none min-h-[120px]" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung câu hỏi (LaTeX $...$)" />
                            <div className="w-full p-6 bg-blue-50/30 rounded-3xl border border-blue-50 min-h-[120px] text-sm"><LatexText text={q.text || '*Đang nhập liệu...*'} /></div>
                        </div>

                        <div className="mb-8 flex items-center gap-6 p-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <div className="shrink-0">
                                {q.imageUrl ? (
                                    <div className="relative group/img">
                                        <img src={q.imageUrl} className="w-24 h-24 object-cover rounded-2xl border" alt="q" />
                                        <button onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].imageUrl = undefined; setQuestions(nl); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><X size={12}/></button>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-white border rounded-2xl flex flex-col items-center justify-center text-slate-300 gap-1">{uploadingId === q.id ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/>}</div>
                                )}
                            </div>
                            <div>
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} />
                                <label htmlFor={`img-${q.id}`} className="px-5 py-2.5 bg-white border rounded-xl text-[10px] font-black uppercase cursor-pointer">Tải hình ảnh</label>
                            </div>
                        </div>

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border">
                                        <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} />
                                        <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'group-tf' && (
                            <div className="space-y-4 mb-8">
                                {q.subQuestions?.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border">
                                        <span className="text-xs font-black text-blue-600 w-8">{String.fromCharCode(97+si)})</span>
                                        <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý..." />
                                        <div className="flex bg-white rounded-xl p-1 border">
                                            {['True', 'False'].map(v => (
                                                <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'short' && (
                            <div className="mb-8 flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border">
                                <span className="text-[10px] font-black text-orange-600 uppercase">Đáp án:</span>
                                <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả..." />
                            </div>
                        )}

                        <div className="space-y-4 pt-6 border-t border-slate-50">
                            <label className="text-[10px] font-black text-slate-400 uppercase">Lời giải chi tiết</label>
                            <textarea className="w-full p-6 bg-yellow-50/30 border border-yellow-100 rounded-3xl text-sm outline-none min-h-[100px]" value={q.solution} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} placeholder="Nhập lời giải..." />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN ADMIN COMPONENT ---
const AdminDashboard = () => {
    // Menu States
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'editor' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
    
    // Data States
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);

    // Editor States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [grade, setGrade] = useState<Grade>('12');
    const [quizType, setQuizType] = useState<QuizType>('practice');
    const [isPublished, setIsPublished] = useState(true);
    const [duration, setDuration] = useState(90);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [category, setCategory] = useState('');
    const [startTime, setStartTime] = useState('');

    // AI States
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiPart1, setAiPart1] = useState(5);
    const [aiPart2, setAiPart2] = useState(2);
    const [aiPart3, setAiPart3] = useState(2);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // Global loading/modals
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

    // Filter states
    const [quizSearch, setQuizSearch] = useState('');
    const [resultGradeFilter, setResultGradeFilter] = useState<Grade | 'all'>('all');
    const [studentGradeFilter, setStudentGradeFilter] = useState<Grade | 'all'>('all');

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    };

    const startEdit = (q: Quiz) => {
        setEditingId(q.id);
        setTitle(q.title);
        setGrade(q.grade);
        setQuizType(q.type);
        setIsPublished(q.isPublished);
        setDuration(q.durationMinutes);
        setQuestions(q.questions);
        setCategory(q.category || '');
        setStartTime(q.startTime || '');
        setActiveMenu('editor');
    };

    const handleSave = async () => {
        if (!title) return alert("Vui lòng nhập tên đề!");
        const data: Quiz = {
            id: editingId || uuidv4(), title, description: '', type: quizType,
            grade, durationMinutes: duration, questions, isPublished,
            createdAt: new Date().toISOString(), category,
            startTime: quizType === 'test' ? startTime : undefined
        };
        if (editingId) await updateQuiz(data); else await saveQuiz(data);
        alert("Đã lưu thành công!");
        setEditingId(null);
        setActiveMenu('quizzes');
        refreshData();
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return alert("Vui lòng nhập yêu cầu!");
        setIsAiLoading(true);
        try {
            const aiQs = await generateQuizFromPrompt({ 
                grade, topic: aiPrompt, part1Count: aiPart1, part2Count: aiPart2, part3Count: aiPart3 
            });
            setQuestions([...questions, ...aiQs]);
            alert("Đã soạn xong bằng AI! Đang chuyển sang trình soạn thảo.");
            setActiveMenu('editor');
        } catch (e) { alert("Lỗi AI!"); } finally { setIsAiLoading(false); }
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
        } catch (e) { alert("Lỗi PDF!"); setIsAiLoading(false); }
    };

    const handleUploadImage = async (qId: string, file: File) => {
        setUploadingId(qId);
        try {
            const url = await uploadQuizImage(file);
            setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q));
        } catch (e) { alert("Lỗi upload!"); } finally { setUploadingId(null); }
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-700 font-sans">
            {/* SIDEBAR NAVIGATION */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
                <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Cpu size={18}/></div>
                    <span className="font-black text-[11px] tracking-[0.2em] uppercase italic">EduQuiz Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {[
                        { id: 'quizzes', icon: LayoutDashboard, label: '1. QUẢN LÝ ĐỀ THI' },
                        { id: 'editor', icon: Plus, label: '2. SOẠN ĐỀ / CHỈNH SỬA', action: () => { setEditingId(null); setTitle(''); setQuestions([]); } },
                        { id: 'ai', icon: Sparkles, label: '3. SOẠN ĐỀ BẰNG AI' },
                        { id: 'results', icon: BarChart3, label: '4. BẢNG ĐIỂM TỔNG' },
                        { id: 'students', icon: Users, label: '5. QUẢN LÝ HỌC SINH' },
                        { id: 'chapters', icon: FolderTree, label: '6. QUẢN LÝ CHƯƠNG' }
                    ].map(m => (
                        <button 
                            key={m.id} 
                            onClick={() => { setActiveMenu(m.id as any); if(m.action) m.action(); }} 
                            className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}
                        >
                            <m.icon size={16}/> {m.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Panel v2.5 • {activeMenu}</h2>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                    
                    {/* MENU 1: QUẢN LÝ ĐỀ THI */}
                    {activeMenu === 'quizzes' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-center gap-4 bg-white p-5 rounded-[2rem] border shadow-sm">
                                <Search className="text-slate-300 ml-4" size={20}/>
                                <input type="text" className="bg-transparent outline-none text-sm font-bold w-full" placeholder="Tìm kiếm đề thi..." value={quizSearch} onChange={e => setQuizSearch(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {quizzes.filter(q => q.title.toLowerCase().includes(quizSearch.toLowerCase())).map(q => (
                                    <div key={q.id} className="bg-white rounded-[2.5rem] p-8 border hover:border-purple-200 transition-all group flex flex-col">
                                        <div className="flex justify-between items-start mb-6">
                                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${q.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {q.isPublished ? 'CÔNG KHAI' : 'NHÁP'}
                                            </span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => startEdit(q)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl"><Edit size={16}/></button>
                                                <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                        <h3 className="font-black text-slate-800 text-lg mb-6 leading-tight min-h-[56px]">{q.title}</h3>
                                        <div className="bg-slate-50 rounded-2xl p-5 grid grid-cols-2 gap-4 mb-6">
                                            <div className="text-center"><p className="text-[9px] font-black text-slate-400 uppercase">Khối</p><p className="text-sm font-black">{q.grade}</p></div>
                                            <div className="text-center border-l"><p className="text-[9px] font-black text-slate-400 uppercase">Câu hỏi</p><p className="text-sm font-black">{q.questions.length}</p></div>
                                        </div>
                                        <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-6 border-t flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:text-purple-600 transition-colors"><Eye size={14}/> XEM CHI TIẾT</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MENU 2: SOẠN ĐỀ / CHỈNH SỬA */}
                    {activeMenu === 'editor' && (
                        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-8">
                                    <input type="text" className="text-3xl font-black outline-none bg-transparent placeholder-slate-200 w-full" placeholder="Nhập tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                                    <label className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:scale-105 transition-all shadow-xl shadow-slate-200">
                                        <FileUp size={16}/> Bóc tách đề từ PDF
                                        <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfExtract}/>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Khối lớp</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Trạng thái</label><button onClick={() => setIsPublished(!isPublished)} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</button></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Chương học</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">Chọn chương</option>{chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Thời gian (Phút)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
                                </div>
                                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl shadow-slate-200"><Save size={20}/> {editingId ? 'CẬP NHẬT ĐỀ THI' : 'LƯU ĐỀ THI MỚI'}</button>
                            </div>

                            <QuestionSection title="PHẦN I. Câu trắc nghiệm" type="mcq" questions={questions} setQuestions={setQuestions} onUploadImage={handleUploadImage} uploadingId={uploadingId} />
                            <QuestionSection title="PHẦN II. Câu đúng sai" type="group-tf" questions={questions} setQuestions={setQuestions} onUploadImage={handleUploadImage} uploadingId={uploadingId} />
                            <QuestionSection title="PHẦN III. Trả lời ngắn" type="short" questions={questions} setQuestions={setQuestions} onUploadImage={handleUploadImage} uploadingId={uploadingId} />
                        </div>
                    )}

                    {/* MENU 3: SOẠN ĐỀ AI */}
                    {activeMenu === 'ai' && (
                        <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                                <div className="flex items-center gap-4 text-purple-600 border-b pb-6"><Sparkles size={32}/><h3 className="text-2xl font-black uppercase tracking-tight">Soạn đề bằng AI Gemini</h3></div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhập yêu cầu chi tiết</label>
                                    <textarea className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-bold outline-none focus:ring-4 focus:ring-purple-50 transition-all min-h-[200px]" placeholder="VD: Soạn cho tôi đề thi giữa kì 2 toán lớp 12 chuyên đề đạo hàm và tích phân, độ khó khá..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Phần I (Trắc nghiệm)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={aiPart1} onChange={e => setAiPart1(parseInt(e.target.value))} /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Phần II (Đúng/Sai)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={aiPart2} onChange={e => setAiPart2(parseInt(e.target.value))} /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Phần III (Trả lời ngắn)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={aiPart3} onChange={e => setAiPart3(parseInt(e.target.value))} /></div>
                                </div>
                                <button onClick={handleAiGenerate} disabled={isAiLoading} className="w-full bg-purple-600 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-purple-700 transition-all shadow-2xl shadow-purple-100 disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={20}/>} {isAiLoading ? 'AI ĐANG SOẠN ĐỀ...' : 'BẮT ĐẦU SOẠN BẰNG AI'}
                                </button>
                            </div>
                            <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 flex items-start gap-4">
                                <AlertCircle className="text-blue-600 shrink-0" size={24}/><div className="text-xs font-medium text-blue-800 leading-relaxed"><p className="font-bold mb-2 uppercase tracking-widest text-[10px]">Lưu ý từ hệ thống:</p>Sau khi AI hoàn tất, các câu hỏi sẽ được đưa vào trình soạn thảo. Bạn có thể chỉnh sửa lại nội dung hoặc hình ảnh trước khi lưu đề thi chính thức.</div>
                            </div>
                        </div>
                    )}

                    {/* MENU 4: BẢNG ĐIỂM TỔNG */}
                    {activeMenu === 'results' && (
                        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                            <div className="flex gap-4 bg-white p-5 rounded-[2rem] border shadow-sm items-center">
                                <Filter className="text-slate-300 ml-4" size={20}/><span className="text-[10px] font-black text-slate-400 uppercase">Bộ lọc:</span>
                                <select className="px-4 py-2 bg-slate-50 border rounded-xl text-[10px] font-black uppercase outline-none" value={resultGradeFilter} onChange={e => setResultGradeFilter(e.target.value as any)}><option value="all">Tất cả khối</option><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                            </div>
                            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="p-6">Học sinh</th><th className="p-6">Đề thi</th><th className="p-6 text-center">Điểm</th><th className="p-6 text-center">Thời gian</th><th className="p-6 text-center">Thao tác</th></tr></thead>
                                    <tbody className="divide-y">{results.filter(r => resultGradeFilter === 'all' || quizzes.find(q=>q.id===r.quizId)?.grade === resultGradeFilter).map(r => (
                                        <tr key={r.id} className="group hover:bg-slate-50/50"><td className="p-6 font-black text-slate-800">{r.studentName}</td><td className="p-6 text-sm font-bold text-slate-500">{quizzes.find(q => q.id === r.quizId)?.title || 'Đề đã xóa'}</td><td className="p-6 text-center"><span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-black text-sm">{r.score.toFixed(2)}</span></td><td className="p-6 text-center text-xs font-bold text-slate-400">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td><td className="p-6 text-center"><button onClick={async () => { if(confirm('Xóa?')) { await deleteResult(r.id); refreshData(); } }} className="p-2.5 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18}/></button></td></tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* MENU 5: QUẢN LÝ HỌC SINH */}
                    {activeMenu === 'students' && (
                        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                            <div className="flex gap-4 bg-white p-5 rounded-[2rem] border shadow-sm items-center">
                                <Users2 className="text-slate-300 ml-4" size={20}/><span className="text-[10px] font-black text-slate-400 uppercase">Khối:</span>
                                <select className="px-4 py-2 bg-slate-50 border rounded-xl text-[10px] font-black uppercase outline-none" value={studentGradeFilter} onChange={e => setStudentGradeFilter(e.target.value as any)}><option value="all">Tất cả</option><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {users.filter(u => u.role === 'student' && (studentGradeFilter === 'all' || u.grade === studentGradeFilter)).map(u => (
                                    <div key={u.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm text-center relative group">
                                        <button onClick={async () => { if(confirm('Xóa học sinh?')) { await deleteUser(u.id); refreshData(); } }} className="absolute top-6 right-6 p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                                        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full mx-auto flex items-center justify-center font-black text-2xl mb-4">{u.fullName.charAt(0)}</div>
                                        <h4 className="font-black text-slate-800 text-lg">{u.fullName}</h4><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">MS: {u.studentCode} • Khối {u.grade}</p>
                                        <div className="mt-6 pt-6 border-t flex justify-around"><div className="text-center"><p className="text-[8px] font-black text-slate-300 uppercase mb-1">Đề đã làm</p><p className="font-black text-slate-700">{results.filter(r => r.studentId === u.id).length}</p></div><div className="text-center border-l w-px h-8 self-center"/><div className="text-center"><p className="text-[8px] font-black text-slate-300 uppercase mb-1">Điểm TB</p><p className="font-black text-blue-600">{(results.filter(r => r.studentId === u.id).reduce((a,b)=>a+b.score,0)/(results.filter(r => r.studentId === u.id).length || 1)).toFixed(1)}</p></div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* MENU 6: QUẢN LÝ CHƯƠNG */}
                    {activeMenu === 'chapters' && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tạo chương học mới</h4>
                                <div className="flex flex-col gap-4">
                                    <select className="p-5 bg-slate-50 border rounded-2xl text-sm font-bold outline-none" id="ch-grade"><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                                    <div className="flex gap-3"><input type="text" className="flex-1 p-5 bg-slate-50 border rounded-2xl text-sm font-bold outline-none" placeholder="Tên chương học..." id="ch-name" /><button onClick={async () => { const n = document.getElementById('ch-name') as HTMLInputElement; const g = document.getElementById('ch-grade') as HTMLSelectElement; if(!n.value) return; await saveChapter({ id: uuidv4(), name: n.value, grade: g.value as Grade, order: chapters.length }); n.value = ''; refreshData(); }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all">Lưu Chương</button></div>
                                </div>
                            </div>
                            {['12', '11', '10'].map(g => (
                                <div key={g} className="space-y-3">
                                    <h5 className="text-[10px] font-black text-slate-300 uppercase px-6 tracking-[0.2em]">Khối {g}</h5>
                                    {chapters.filter(c => c.grade === g).map(c => (
                                        <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border flex justify-between items-center group hover:border-blue-400 transition-all shadow-sm"><span className="font-black text-sm text-slate-700">{c.name}</span><button onClick={async () => { if(confirm('Xóa?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={20}/></button></div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* PREVIEW MODAL */}
            {previewQuiz && (
                <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-5"><FileText size={24}/><h3 className="text-lg font-black uppercase">{previewQuiz.title}</h3></div>
                            <button onClick={() => setPreviewQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-12 bg-slate-50">
                            {previewQuiz.questions.map((q, i) => (
                                <div key={q.id || i} className="bg-white p-10 rounded-[2rem] shadow-sm border mb-8 relative">
                                    <div className="text-slate-800 font-bold mb-6 flex items-start gap-4">
                                        <span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span>
                                        <div className="flex flex-col gap-4">
                                            <LatexText text={q.text}/>
                                            {q.imageUrl && <img src={q.imageUrl} className="max-w-full rounded-2xl border" alt="preview q" />}
                                        </div>
                                    </div>
                                    {q.type === 'mcq' && q.options && (<div className="grid grid-cols-2 gap-4 ml-12">{q.options.map((opt, oi) => <div key={oi} className="text-sm text-slate-500">{String.fromCharCode(65+oi)}. <LatexText text={opt}/></div>)}</div>)}
                                    {q.solution && (<div className="mt-8 pt-6 border-t border-yellow-100 bg-yellow-50/50 p-6 rounded-2xl"><p className="text-[10px] font-black text-yellow-600 uppercase mb-3">Lời giải tham khảo:</p><div className="text-sm font-medium text-slate-600 italic leading-relaxed"><LatexText text={q.solution}/></div></div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
