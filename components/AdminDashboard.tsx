
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, QuizType } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, getChapters, saveChapter, deleteChapter, uploadQuizImage, deleteResult, deleteUser, saveUser, changePassword
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, 
    Search, X, CheckCircle2, 
    HelpCircle, AlignLeft, Eye, Target, FileText, ImageIcon, Loader2, Database,
    Sparkles, FileUp, CheckCircle, AlertCircle, Filter, ChevronRight, Info, Calendar, History, TrendingUp, Trophy, UserPlus, Lightbulb, Medal, Target as TargetIcon, CopyCheck, RefreshCw, UserCog, FileSpreadsheet, Download, XCircle, RotateCcw
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import LatexText from './LatexText';

// --- SUB-COMPONENT: QUESTION SECTION ---
interface SectionProps {
    title: string;
    type: QuestionType;
    questions: Question[];
    setQuestions: (qs: Question[]) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
    onOpenBank: (type: QuestionType) => void;
}

const QuestionSection: React.FC<SectionProps> = ({ title, type, questions, setQuestions, onUploadImage, uploadingId, onOpenBank }) => {
    const sectionQuestions = questions.filter(q => q.type === type);
    const Icon = type === 'mcq' ? CheckCircle2 : type === 'group-tf' ? HelpCircle : AlignLeft;

    const addManual = () => {
        const lastQ = sectionQuestions[sectionQuestions.length - 1];
        const defaultPoints = lastQ ? lastQ.points : (type === 'mcq' ? 0.25 : type === 'group-tf' ? 1.0 : 0.5);

        const newQ: Question = {
            id: uuidv4(), type, text: '', points: defaultPoints,
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

    const applyPointsToAll = (points: string | number) => {
        const newQuestions = questions.map(q => {
            if (q.type === type) return { ...q, points };
            return q;
        });
        setQuestions(newQuestions);
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
                <div className="flex gap-2">
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all border border-slate-200">
                        <Database size={14}/> Ngân hàng
                    </button>
                    <button onClick={addManual} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">
                        <Plus size={14}/> Thêm mới
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {sectionQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative group animate-fade-in-up">
                        <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <span className="text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest bg-slate-100 text-slate-500 inline-block">Câu {idx + 1}</span>
                            
                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-2xl border border-blue-100">
                                <TargetIcon size={14} className="text-blue-500" />
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Điểm:</span>
                                <input 
                                    type="text" 
                                    className="bg-transparent text-xs font-black text-blue-700 outline-none w-14 text-center border-b border-blue-200 focus:border-blue-500 transition-colors" 
                                    value={q.points} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        const nl = [...questions];
                                        const i = nl.findIndex(x => x.id === q.id);
                                        nl[i].points = val;
                                        setQuestions(nl);
                                    }}
                                />
                                <button 
                                    onClick={() => {
                                        if(confirm(`Áp dụng mức ${q.points} điểm cho TOÀN BỘ các câu trong phần này?`)) {
                                            applyPointsToAll(q.points);
                                        }
                                    }}
                                    className="ml-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-md active:scale-90"
                                >
                                    <CopyCheck size={12} />
                                    <span className="text-[8px] font-black uppercase">Set hết</span>
                                </button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Nội dung câu hỏi</label>
                                <textarea className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold outline-none min-h-[120px] focus:border-blue-300 transition-colors" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="Nhập câu hỏi (LaTeX: $...$)" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-blue-400 uppercase ml-2">Xem trước nội dung</label>
                                <div className="w-full p-6 bg-blue-50/30 rounded-3xl border border-blue-100 min-h-[120px] text-sm overflow-auto"><LatexText text={q.text || '*Trống*'} /></div>
                            </div>
                        </div>

                        <div className="mb-8 flex items-center gap-6 p-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <div className="shrink-0">{q.imageUrl ? <img src={q.imageUrl} className="w-24 h-24 object-cover rounded-2xl border" alt="q" /> : <div className="w-24 h-24 bg-white border rounded-2xl flex items-center justify-center text-slate-300">{uploadingId === q.id ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/>}</div>}</div>
                            <div><input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} /><label htmlFor={`img-${q.id}`} className="px-5 py-2.5 bg-white border rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-slate-50 transition-colors">Tải hình ảnh</label></div>
                        </div>

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border"><input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} /><input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} /></div>
                                ))}
                            </div>
                        )}
                        {type === 'group-tf' && (
                            <div className="space-y-4 mb-8">
                                {q.subQuestions?.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border"><span className="text-xs font-black text-blue-600 w-8">{String.fromCharCode(97+si)})</span><input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý..." /><div className="flex bg-white rounded-xl p-1 border">{['True', 'False'].map(v => <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>)}</div></div>
                                ))}
                            </div>
                        )}
                        {type === 'short' && (
                            <div className="mb-8 flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border"><span className="text-[10px] font-black text-orange-600 uppercase">Đáp án đúng:</span><input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả..." /></div>
                        )}

                        <div className="pt-8 border-t border-slate-100 space-y-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Lightbulb size={16} className="text-yellow-500"/> Lời giải chi tiết (LaTeX: $...$)</label>
                            <textarea 
                                className="w-full p-6 bg-yellow-50/20 border border-yellow-100 rounded-3xl text-sm outline-none min-h-[100px] focus:bg-yellow-50/50 transition-all font-medium" 
                                value={q.solution} 
                                onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} 
                                placeholder="Nhập hướng dẫn giải..." 
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'editor' | 'ai' | 'results' | 'students' | 'chapters'>('quizzes');
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [grade, setGrade] = useState<Grade>('12');
    const [quizType, setQuizType] = useState<QuizType>('practice');
    const [isPublished, setIsPublished] = useState(true);
    const [duration, setDuration] = useState(90);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [category, setCategory] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const [aiPrompt, setAiPrompt] = useState('');
    const [aiPart1, setAiPart1] = useState(5);
    const [aiPart2, setAiPart2] = useState(2);
    const [aiPart3, setAiPart3] = useState(2);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const [qSearch, setQSearch] = useState('');
    const [qGradeFilter, setQGradeFilter] = useState<Grade | 'all'>('all');
    const [qChapterFilter, setQChapterFilter] = useState<string>('all');
    
    const [rGradeFilter, setRGradeFilter] = useState<Grade | 'all'>('all');
    const [rChapterFilter, setRChapterFilter] = useState<string>('all');
    const [rQuizFilter, setRQuizFilter] = useState<string>('all');

    const [sGradeFilter, setSGradeFilter] = useState<Grade | 'all'>('all');
    const [sSearch, setSSearch] = useState('');

    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const [bankModal, setBankModal] = useState<{ open: boolean, type: QuestionType | null }>({ open: false, type: null });
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentCode, setNewStudentCode] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState<Grade>('12');

    const csvInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    };

    const handleAddStudentManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudentName || !newStudentCode) return alert("Nhập đủ thông tin!");
        const newUser: User = {
            id: uuidv4(),
            username: newStudentCode.toLowerCase(),
            password: '123',
            role: 'student',
            fullName: newStudentName,
            studentCode: newStudentCode.toUpperCase(),
            grade: newStudentGrade,
            points: 0
        };
        await saveUser(newUser);
        alert("Thêm thành công!");
        setIsAddStudentOpen(false);
        setNewStudentName(''); setNewStudentCode('');
        refreshData();
    };

    const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            const lines = text.split(/\r?\n/);
            const newUsers: User[] = [];
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                let cols = line.split('\t');
                if (cols.length < 2) cols = line.split(',');
                const mahs = cols[0]?.trim().toUpperCase();
                const ten = cols[1]?.trim();
                if (!mahs || !ten || mahs === 'MAHS') continue;
                newUsers.push({ id: uuidv4(), username: mahs.toLowerCase(), password: '123', role: 'student', fullName: ten, studentCode: mahs, grade: (cols[2]?.trim() || '12') as Grade, points: 0 });
            }
            if (newUsers.length > 0) {
              for (const u of newUsers) await saveUser(u);
              alert(`Đã nhập ${newUsers.length} học sinh thành công!`);
              refreshData();
            }
        };
        reader.readAsText(file);
    };

    const exportToDoc = (quiz: Quiz) => {
        let content = `<html><head><meta charset="utf-8"></head><body>`;
        content += `<h1 style="text-align:center">${quiz.title}</h1>`;
        content += `<p style="text-align:center">Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</p><hr/>`;
        const parts = [{ title: 'PHẦN I. Câu trắc nghiệm nhiều lựa chọn', type: 'mcq' }, { title: 'PHẦN II. Câu trắc nghiệm Đúng/Sai', type: 'group-tf' }, { title: 'PHẦN III. Câu trắc nghiệm Trả lời ngắn', type: 'short' }];
        parts.forEach(part => {
            const partQs = quiz.questions.filter(q => q.type === part.type);
            if (partQs.length > 0) {
                content += `<h3>${part.title}</h3>`;
                partQs.forEach((q, idx) => {
                    content += `<p><b>Câu ${idx + 1}.</b> ${q.text}</p>`;
                    if (q.type === 'mcq' && q.options) q.options.forEach((opt, oi) => content += `<p style="margin-left:20px">${String.fromCharCode(65+oi)}. ${opt}</p>`);
                    else if (q.type === 'group-tf' && q.subQuestions) q.subQuestions.forEach((sq, si) => content += `<p style="margin-left:20px">${String.fromCharCode(97+si)}) ${sq.text}</p>`);
                });
            }
        });
        content += `</body></html>`;
        const blob = new Blob([content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${quiz.title}.doc`; link.click();
    };

    const filteredStudents = useMemo(() => {
        return users.filter(u => u.role === 'student' && (sGradeFilter === 'all' || u.grade === sGradeFilter) && (u.fullName.toLowerCase().includes(sSearch.toLowerCase()) || (u.studentCode && u.studentCode.toLowerCase().includes(sSearch.toLowerCase()))));
    }, [users, sSearch, sGradeFilter]);

    const filteredQuizzesList = useMemo(() => {
        return quizzes.filter(q => (qGradeFilter === 'all' || q.grade === qGradeFilter) && (qChapterFilter === 'all' || q.category === qChapterFilter) && q.title.toLowerCase().includes(qSearch.toLowerCase()));
    }, [quizzes, qSearch, qGradeFilter, qChapterFilter]);

    const filteredResults = useMemo(() => {
        return results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            const matchGrade = rGradeFilter === 'all' || (quiz && quiz.grade === rGradeFilter);
            const matchChapter = rChapterFilter === 'all' || (quiz && quiz.category === rChapterFilter);
            const matchQuiz = rQuizFilter === 'all' || r.quizId === rQuizFilter;
            return matchGrade && matchChapter && matchQuiz;
        });
    }, [results, quizzes, rGradeFilter, rChapterFilter, rQuizFilter]);

    const bankQuestions = useMemo(() => {
        if (!bankModal.type) return [];
        let allQs: Question[] = [];
        quizzes.filter(q => q.grade === grade).forEach(q => allQs = [...allQs, ...q.questions.filter(qu => qu.type === bankModal.type)]);
        return allQs.filter((v, i, a) => a.findIndex(t => t.text === v.text) === i);
    }, [quizzes, grade, bankModal.type]);

    const startEdit = (q: Quiz) => {
        setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setQuizType(q.type);
        setIsPublished(q.isPublished); setDuration(q.durationMinutes); setQuestions(q.questions);
        setCategory(q.category || ''); setStartTime(q.startTime || ''); setEndTime(q.endTime || ''); setActiveMenu('editor');
    };

    const handleSave = async () => {
        if (!title) return alert("Nhập tên đề!");
        const data: Quiz = { 
          id: editingId || uuidv4(), 
          title, 
          description: '', 
          type: quizType, 
          grade, 
          durationMinutes: duration, 
          questions, 
          isPublished, 
          createdAt: new Date().toISOString(), 
          category, 
          startTime: quizType === 'test' ? startTime : undefined, 
          endTime: quizType === 'practice' ? endTime : undefined 
        };
        if (editingId) await updateQuiz(data); else await saveQuiz(data);
        alert("Lưu thành công!"); setActiveMenu('quizzes'); refreshData();
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return alert("Nhập chủ đề!");
        setIsAiLoading(true);
        try {
            const qs = await generateQuizFromPrompt({ grade, topic: aiPrompt, part1Count: aiPart1, part2Count: aiPart2, part3Count: aiPart3 });
            setQuestions(qs); setTitle(`Đề thi AI: ${aiPrompt}`); setActiveMenu('editor');
        } catch (error) { alert("Lỗi AI soạn đề!"); }
        finally { setIsAiLoading(false); }
    };

    const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsAiLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                const newQs = await parseQuestionsFromPDF(base64);
                setQuestions(prev => [...prev, ...newQs]);
                alert("Đã bóc tách thành công!");
            };
            reader.readAsDataURL(file);
        } catch (error) { alert("Lỗi PDF!"); }
        finally { setIsAiLoading(false); }
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-700 font-sans">
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
                <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Cpu size={18}/></div>
                    <span className="font-black text-[11px] tracking-[0.2em] uppercase italic">EduQuiz Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {[
                        { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                        { id: 'editor', icon: Plus, label: 'SOẠN / CHỈNH ĐỀ', action: () => { setEditingId(null); setTitle(''); setQuestions([]); setStartTime(''); setEndTime(''); } },
                        { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                        { id: 'results', icon: BarChart3, label: 'BẢNG ĐIỂM TỔNG' },
                        { id: 'students', icon: Users, label: 'QUẢN LÝ HỌC SINH' },
                        { id: 'chapters', icon: FolderTree, label: 'QUẢN LÝ CHƯƠNG' }
                    ].map(m => (
                        <button key={m.id} onClick={() => { setActiveMenu(m.id as any); if(m.action) m.action(); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}><m.icon size={16}/> {m.label}</button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {activeMenu === 'quizzes' ? 'Quản lý đề thi' : activeMenu === 'editor' ? 'Trình soạn thảo đề' : activeMenu === 'ai' ? 'Trí tuệ nhân tạo' : activeMenu === 'results' ? 'Bảng điểm' : activeMenu === 'students' ? 'Học sinh' : 'Chương học'}
                    </h2>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                    {activeMenu === 'quizzes' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-6 rounded-[2rem] border shadow-sm">
                                <div className="flex-1 w-full flex items-center gap-3 px-4 py-2 bg-slate-50 border rounded-2xl"><Search className="text-slate-300" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-bold w-full" placeholder="Tìm tên đề..." value={qSearch} onChange={e => setQSearch(e.target.value)} /></div>
                                <select className="px-4 py-2 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" value={qGradeFilter} onChange={e => { setQGradeFilter(e.target.value as any); setQChapterFilter('all'); }}><option value="all">KHỐI LỚP</option><option value="12">KHỐI 12</option><option value="11">KHỐI 11</option><option value="10">KHỐI 10</option></select>
                                <select className="px-4 py-2 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" value={qChapterFilter} onChange={e => setQChapterFilter(e.target.value)}><option value="all">CHƯƠNG HỌC</option>{chapters.filter(c => qGradeFilter === 'all' || c.grade === qGradeFilter).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredQuizzesList.map(q => {
                                    const attempts = results.filter(r => r.quizId === q.id).length;
                                    
                                    // MÀU CARD THEO KHỐI
                                    let themeClass = "bg-white border-slate-200 hover:border-slate-400";
                                    let gradeBadge = "bg-slate-100 text-slate-500";
                                    if (q.grade === '12') {
                                        themeClass = "bg-blue-50/20 border-blue-100 hover:border-blue-400 shadow-blue-500/5";
                                        gradeBadge = "bg-blue-600 text-white";
                                    } else if (q.grade === '11') {
                                        themeClass = "bg-purple-50/20 border-purple-100 hover:border-purple-400 shadow-purple-500/5";
                                        gradeBadge = "bg-purple-600 text-white";
                                    } else if (q.grade === '10') {
                                        themeClass = "bg-orange-50/20 border-orange-100 hover:border-orange-400 shadow-orange-500/5";
                                        gradeBadge = "bg-orange-600 text-white";
                                    }

                                    return (
                                        <div key={q.id} className={`rounded-[2.5rem] p-8 border transition-all group flex flex-col shadow-sm ${themeClass}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${gradeBadge}`}>
                                                    {/* Fix: Grade comparison with 'all' literal is now valid as types.ts Grade union includes 'all' */}
                                                    {q.grade === 'all' ? 'CHUNG' : `KHỐI ${q.grade}`}
                                                </span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => startEdit(q)} className="p-2.5 bg-white border rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Edit size={16}/></button>
                                                    <button onClick={async () => { if(confirm('Xóa đề?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                            <h3 className="font-black text-slate-800 text-lg mb-4 line-clamp-2 min-h-[56px] leading-tight">{q.title}</h3>
                                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 grid grid-cols-2 gap-4 mb-6 text-center border shadow-inner">
                                                <div className="border-r border-slate-200/50"><p className="text-[8px] font-black text-slate-400 uppercase">Hình thức</p><p className="text-xs font-black uppercase">{q.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</p></div>
                                                <div><p className="text-[8px] font-black text-slate-400 uppercase">Lượt làm</p><p className="text-xs font-black text-blue-600">{attempts}</p></div>
                                            </div>
                                            <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline"><Eye size={14}/> Xem trước đề</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeMenu === 'editor' && (
                        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
                                    <input type="text" className="text-3xl font-black outline-none bg-transparent w-full" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                                    <label className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:scale-105 transition-all shadow-xl">
                                        {isAiLoading ? <Loader2 className="animate-spin" size={16}/> : <FileUp size={16}/>} NHẬP TỪ PDF <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfExtract}/>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Khối lớp</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none focus:bg-white focus:border-blue-400" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option><option value="all">Chung</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Hình thức</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none focus:bg-white focus:border-blue-400" value={quizType} onChange={e => setQuizType(e.target.value as any)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Trạng thái</label><button onClick={() => setIsPublished(!isPublished)} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{isPublished ? 'CÔNG KHAI' : 'NHÁP'}</button></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Thời gian (Phút)</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none focus:bg-white focus:border-blue-400" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-1"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Chương học</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">Chọn chương</option>{chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                                  {quizType === 'test' ? (
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Thời điểm bắt đầu</label><input type="datetime-local" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                                  ) : (
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-300 uppercase px-1">Hạn nộp luyện tập</label><input type="datetime-local" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50 outline-none" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
                                  )}
                                </div>
                                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl"><Save size={20}/> {editingId ? 'Cập nhật đề thi' : 'Lưu đề thi mới'}</button>
                            </div>
                            <QuestionSection title="PHẦN I. TRẮC NGHIỆM" type="mcq" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(t) => setBankModal({ open: true, type: t })} />
                            <QuestionSection title="PHẦN II. ĐÚNG/SAI" type="group-tf" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(t) => setBankModal({ open: true, type: t })} />
                            <QuestionSection title="PHẦN III. TRẢ LỜI NGẮN" type="short" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(t) => setBankModal({ open: true, t })} />
                        </div>
                    )}

                    {activeMenu === 'ai' && (
                        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm text-center space-y-10">
                                <Sparkles size={64} className="mx-auto text-blue-600 drop-shadow-lg"/>
                                <div>
                                  <h3 className="text-2xl font-black uppercase text-slate-800">Soạn đề bằng Trí tuệ nhân tạo</h3>
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Cung cấp bởi Gemini 3 Pro</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                    <div className="space-y-1"><label className="text-[10px] font-black uppercase ml-2 text-slate-400">Khối lớp mục tiêu</label><select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-black outline-none focus:bg-white focus:border-blue-400" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option><option value="all">Chung</option></select></div>
                                    <div className="flex gap-4 items-end">
                                      <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.I</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={aiPart1} onChange={e => setAiPart1(parseInt(e.target.value))} /></div>
                                      <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.II</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={aiPart2} onChange={e => setAiPart2(parseInt(e.target.value))} /></div>
                                      <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.III</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={aiPart3} onChange={e => setAiPart3(parseInt(e.target.value))} /></div>
                                    </div>
                                </div>
                                <div className="text-left space-y-2">
                                    <div className="flex justify-between items-center px-2"><label className="text-[10px] font-black uppercase text-slate-400">Mô tả nội dung / chủ đề</label><button onClick={() => { setAiPrompt(''); setAiPart1(5); setAiPart2(2); setAiPart3(2); }} className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline"><RotateCcw size={12}/> Khôi phục</button></div>
                                    <textarea className="w-full bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 font-bold min-h-[220px] text-sm outline-none focus:bg-white focus:border-blue-400 shadow-inner" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ví dụ: Đạo hàm và ứng dụng của đạo hàm. Bao gồm các bài toán cực trị và tiệm cận..." />
                                </div>
                                <button onClick={handleAiGenerate} disabled={isAiLoading} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50">
                                    {isAiLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>} {isAiLoading ? 'AI ĐANG SOẠN ĐỀ...' : 'BẮT ĐẦU SOẠN ĐỀ THÔNG MINH'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'results' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                                <h3 className="text-xl font-black uppercase flex items-center gap-3"><BarChart3 className="text-blue-600"/> Bảng điểm tổng quát</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={rGradeFilter} onChange={e => { setRGradeFilter(e.target.value as any); setRChapterFilter('all'); setRQuizFilter('all'); }}><option value="all">Tất cả Khối</option><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={rChapterFilter} onChange={e => { setRChapterFilter(e.target.value); setRQuizFilter('all'); }}><option value="all">Tất cả Chương</option>{chapters.filter(c => rGradeFilter === 'all' || c.grade === rGradeFilter).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                                    <select className="w-full bg-slate-50 border rounded-2xl p-4 text-xs font-black uppercase outline-none" value={rQuizFilter} onChange={e => setRQuizFilter(e.target.value)}><option value="all">Tất cả Đề thi</option>{quizzes.filter(q => (rGradeFilter === 'all' || q.grade === rGradeFilter) && (rChapterFilter === 'all' || q.category === rChapterFilter)).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select>
                                </div>
                            </div>
                            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Đề thi</th><th className="p-6 text-center">Khối</th><th className="p-6 text-center">Điểm số</th><th className="p-6 text-center">Ngày nộp</th><th className="p-6 text-center">Xóa</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredResults.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6 font-bold text-slate-800">{r.studentName}</td>
                                                <td className="p-6 text-sm text-slate-500">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đã xóa'}</td>
                                                <td className="p-6 text-center font-black text-slate-400">{quizzes.find(q=>q.id===r.quizId)?.grade || '-'}</td>
                                                <td className="p-6 text-center font-black text-blue-600">{r.score.toFixed(2)}</td>
                                                <td className="p-6 text-center text-slate-400 text-xs">{format(parseISO(r.submittedAt), 'dd/MM HH:mm')}</td>
                                                <td className="p-6 text-center"><button onClick={() => { if(confirm('Xóa kết quả này?')) { deleteResult(r.id); refreshData(); } }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'students' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-5 rounded-[2.5rem] border shadow-sm gap-5">
                                <div className="flex flex-1 gap-4 items-center">
                                    <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl flex-1"><Search className="text-slate-300" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-black w-full" placeholder="Tìm tên hoặc MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} /></div>
                                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 border rounded-2xl">
                                      <select className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer" value={sGradeFilter} onChange={e => setSGradeFilter(e.target.value as any)}><option value="all">Tất cả khối</option><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                                      <div className="h-4 w-px bg-slate-200"></div>
                                      <span className="text-[10px] font-black text-blue-600 uppercase">SL: {filteredStudents.length}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddStudentOpen(true)} className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all shadow-xl"><UserPlus size={16}/> THÊM MỚI</button>
                                    <button onClick={() => csvInputRef.current?.click()} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl"><FileSpreadsheet size={16}/> NHẬP CSV</button>
                                    <input type="file" className="hidden" ref={csvInputRef} onChange={handleCsvImport} />
                                </div>
                            </div>
                            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Mã số (MAHS)</th><th className="p-6 text-center">Khối</th><th className="p-6 text-center">Tích lũy</th><th className="p-6 text-center">Quản lý</th><th className="p-6 text-center">Xóa</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredStudents.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6 font-bold text-slate-800">{u.fullName}</td>
                                                <td className="p-6 font-black uppercase text-slate-400">{u.studentCode}</td>
                                                <td className="p-6 text-center font-bold text-slate-500">{u.grade}</td>
                                                <td className="p-6 text-center text-blue-600 font-bold">{u.points || 0}</td>
                                                <td className="p-6 text-center"><div className="flex justify-center gap-2"><button onClick={() => setSelectedStudent(u)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye size={14}/></button><button onClick={() => { if(confirm('Reset mật khẩu về 123?')) changePassword(u.id, '123'); refreshData(); }} className="p-2.5 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-600 hover:text-white transition-all"><RefreshCw size={14}/></button></div></td>
                                                <td className="p-6 text-center"><button onClick={() => { if(confirm('Xóa học sinh này?')) { deleteUser(u.id); refreshData(); } }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'chapters' && (
                        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><FolderTree size={16} className="text-blue-600"/> Tạo mới chương học</h4>
                                <div className="flex flex-col gap-4">
                                    <select className="p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none" id="ch-grade"><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option><option value="all">Chung</option></select>
                                    <div className="flex gap-3"><input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-400" placeholder="Tên chương học..." id="ch-name" /><button onClick={async () => { const n = document.getElementById('ch-name') as HTMLInputElement; const g = document.getElementById('ch-grade') as HTMLSelectElement; if(!n.value) return; await saveChapter({ id: uuidv4(), name: n.value, grade: g.value as Grade, order: chapters.length }); n.value=''; refreshData(); }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95">Lưu Chương</button></div>
                                </div>
                            </div>
                            <div className="space-y-10">
                                {['12', '11', '10', 'all'].map(g => (
                                    <div key={g} className="space-y-4">
                                        <h5 className="text-[10px] font-black uppercase px-6 tracking-widest text-slate-400">{g === 'all' ? 'Chung' : `Khối ${g}`}</h5>
                                        <div className="grid grid-cols-1 gap-3">
                                            {chapters.filter(c => c.grade === g).map(c => (
                                                <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border border-slate-100 flex justify-between items-center group shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
                                                    <span className="font-black text-sm text-slate-700">{c.name}</span>
                                                    <button onClick={async () => { if(confirm('Xóa chương này?')) { await deleteChapter(c.id); refreshData(); } }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                                                </div>
                                            ))}
                                            {chapters.filter(c => c.grade === g).length === 0 && <p className="text-center py-8 text-xs text-slate-300 italic bg-white/50 border border-dashed rounded-[2rem]">Chưa có dữ liệu chương học {g === 'all' ? 'chung' : `khối ${g}`}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* MODALS */}
                {previewQuiz && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5"><div className="p-3 bg-blue-600 rounded-2xl"><FileText size={28}/></div><div><h3 className="text-lg font-black uppercase leading-tight tracking-tight">{previewQuiz.title}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{previewQuiz.grade === 'all' ? 'CHUNG' : `Khối ${previewQuiz.grade}`} • {previewQuiz.questions.length} câu hỏi</p></div></div>
                                <div className="flex gap-2"><button onClick={() => exportToDoc(previewQuiz)} className="bg-emerald-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl"><Download size={16}/> Xuất Word</button><button onClick={() => setPreviewQuiz(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button></div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar"><div className="max-w-3xl mx-auto space-y-12">{previewQuiz.questions.map((q, i) => (<div key={q.id} className="bg-white p-10 rounded-[2.5rem] border shadow-sm relative"><div className="absolute top-6 right-8 text-[10px] font-black text-slate-200 uppercase tracking-widest">Phần {q.type === 'mcq' ? 'I' : q.type === 'group-tf' ? 'II' : 'III'}</div><p className="font-bold text-slate-800 text-lg flex gap-4 leading-relaxed"><span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span><LatexText text={q.text}/></p></div>))}</div></div>
                            <div className="p-8 bg-white border-t flex justify-center"><button onClick={() => { startEdit(previewQuiz!); setPreviewQuiz(null); }} className="px-12 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">Vào chỉnh sửa đề thi</button></div>
                        </div>
                    </div>
                )}

                {isAddStudentOpen && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <form onSubmit={handleAddStudentManual} className="bg-white rounded-[3.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up border-8 border-white">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-4"><UserPlus size={24} className="text-blue-500"/><h3 className="text-xl font-black uppercase tracking-tight">Thêm học sinh mới</h3></div><button type="button" onClick={() => setIsAddStudentOpen(false)} className="p-2 hover:text-red-500 transition-colors"><X/></button></div>
                            <div className="p-10 space-y-6">
                                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Họ và tên thí sinh</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:bg-white focus:border-blue-400 transition-all" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="VD: Nguyễn Văn A..." required /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Mã số học sinh (MAHS)</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold uppercase outline-none focus:bg-white focus:border-blue-400 transition-all" value={newStudentCode} onChange={e => setNewStudentCode(e.target.value)} placeholder="VD: HS001..." required /></div>
                                <div className="space-y-1"><label className="text-[9px] font-black uppercase ml-2 text-slate-400">Khối lớp</label><select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-black outline-none" value={newStudentGrade} onChange={e => setNewStudentGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select></div>
                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-[9px] text-blue-600 italic">* Mật khẩu mặc định sau khi tạo là: <span className="font-black">123</span></div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all mt-4">Xác nhận thêm học sinh</button>
                            </div>
                        </form>
                    </div>
                )}

                {selectedStudent && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-5"><div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><History size={32}/></div><div><h3 className="text-xl font-black uppercase tracking-tight">{selectedStudent.fullName}</h3><p className="text-[10px] font-bold text-slate-400 mt-1 tracking-widest uppercase">Lớp {selectedStudent.grade} • MAHS: {selectedStudent.studentCode}</p></div></div><button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button></div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 custom-scrollbar space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2">
                                      <span className="text-[8px] font-black text-slate-300 uppercase">Mật khẩu hiện tại</span>
                                      <span className="text-xl font-black text-orange-600 tracking-[0.2em]">{selectedStudent.password}</span>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2">
                                      <span className="text-[8px] font-black text-slate-300 uppercase">Tích lũy</span>
                                      <span className="text-xl font-black text-blue-600">{selectedStudent.points || 0}</span>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2">
                                      <span className="text-[8px] font-black text-slate-300 uppercase">Khối lớp</span>
                                      <span className="text-xl font-black text-slate-800">{selectedStudent.grade}</span>
                                    </div>
                                </div>
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b flex items-center gap-3"><Clock size={18} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lịch sử thực hiện bài thi</span></div>
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-white border-b text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]"><th className="p-6">Tên đề thi</th><th className="p-6 text-center">Khối</th><th className="p-6 text-center">Điểm số</th><th className="p-6 text-center">Ngày nộp</th></tr></thead>
                                        <tbody className="divide-y">
                                          {results.filter(r => r.studentId === selectedStudent.id).length === 0 ? (
                                            <tr><td colSpan={4} className="p-10 text-center text-xs text-slate-300 italic">Chưa thực hiện bài thi nào</td></tr>
                                          ) : results.filter(r => r.studentId === selectedStudent.id).map(r => (
                                              <tr key={r.id} className="hover:bg-slate-50 transition-colors border-b"><td className="p-6 font-bold text-sm text-slate-700">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề thi cũ'}</td><td className="p-6 text-center font-black text-slate-400 text-xs">{quizzes.find(q=>q.id===r.quizId)?.grade || '-'}</td><td className="p-6 text-center font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td><td className="p-6 text-center text-slate-400 text-[10px]">{format(parseISO(r.submittedAt), 'HH:mm dd/MM/yy')}</td></tr>
                                          ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-white text-center"><button onClick={() => setSelectedStudent(null)} className="px-12 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">Đóng chi tiết</button></div>
                        </div>
                    </div>
                )}

                {bankModal.open && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div className="flex items-center gap-4"><Database size={24} className="text-blue-500"/><h3 className="text-xl font-black uppercase tracking-tight">Ngân hàng câu hỏi {bankModal.type}</h3></div><button onClick={() => setBankModal({ open: false, type: null })} className="p-3 hover:text-red-500 transition-colors"><X size={24}/></button></div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-slate-50 custom-scrollbar">
                                {bankQuestions.length === 0 ? (<p className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest italic">Kho câu hỏi đang trống cho {grade === 'all' ? 'chung' : `khối ${grade}`}</p>) : bankQuestions.map((bq) => (
                                    <div key={bq.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-start gap-6 hover:border-blue-300 transition-all group shadow-sm"><div className="flex-1 font-bold leading-relaxed text-slate-800"><LatexText text={bq.text}/></div><button onClick={() => { setQuestions([...questions, { ...bq, id: uuidv4() }]); alert("Đã thêm câu hỏi!"); }} className="bg-blue-50 text-blue-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">Thêm vào đề</button></div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
