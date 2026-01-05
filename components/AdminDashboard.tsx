
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
    Sparkles, FileUp, CheckCircle, AlertCircle, Filter, ChevronRight, Info, Calendar, History, TrendingUp, Trophy, UserPlus, Lightbulb, Medal, Target as TargetIcon, CopyCheck, RefreshCw, UserCog, FileSpreadsheet, Download
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
            <div className="flex items-center justify-between bg-white p-6 rounded-none border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-none border-2 border-gray-800 ${type === 'mcq' ? 'bg-blue-100 text-blue-700' : type === 'group-tf' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900 uppercase tracking-tight">{title}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{sectionQuestions.length} câu</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-gray-800 text-gray-700 text-[10px] font-black uppercase hover:bg-gray-50 transition-all rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5">
                        <Database size={14}/> Ngân hàng đề
                    </button>
                    <button onClick={addManual} className="flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-none text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]">
                        <Plus size={14}/> Thêm mới
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {sectionQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-none border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative group animate-fade-in-up">
                        <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <span className="text-[10px] font-black px-4 py-1.5 border-2 border-gray-800 rounded-none uppercase tracking-widest bg-gray-50 text-gray-700 inline-block">Câu {idx + 1}</span>
                            <div className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 border-2 border-blue-200 rounded-none">
                                <TargetIcon size={14} className="text-blue-500" />
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Điểm:</span>
                                <input 
                                    type="text" 
                                    className="bg-transparent text-xs font-black text-blue-700 outline-none w-14 text-center border-b-2 border-blue-200 focus:border-blue-500 transition-colors" 
                                    value={q.points} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        const nl = [...questions];
                                        const i = nl.findIndex(x => x.id === q.id);
                                        nl[i].points = val;
                                        setQuestions(nl);
                                    }}
                                />
                                {idx === 0 && sectionQuestions.length > 1 && (
                                    <button 
                                        onClick={() => applyPointsToAll(q.points)}
                                        title="Áp dụng cho tất cả"
                                        className="ml-2 p-1.5 bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-all flex items-center gap-1.5"
                                    >
                                        <CopyCheck size={12} />
                                        <span className="text-[8px] font-black uppercase">Áp dụng hết</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Nội dung câu hỏi (Markdown + LaTeX)</label>
                                <textarea className="w-full p-6 bg-gray-50 border-2 border-gray-200 rounded-none text-sm font-bold outline-none min-h-[120px] focus:border-blue-400 transition-colors" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="Nhập câu hỏi..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-blue-400 uppercase ml-1">Xem trước sắc nét</label>
                                <div className="w-full p-6 bg-blue-50/20 rounded-none border-2 border-blue-100 min-h-[120px] text-sm overflow-auto"><LatexText text={q.text || '*Đang nhập liệu...*'} /></div>
                            </div>
                        </div>

                        <div className="mb-8 flex items-center gap-6 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-none">
                            <div className="shrink-0">{q.imageUrl ? <img src={q.imageUrl} className="w-24 h-24 object-cover border-2 border-gray-800" alt="q" /> : <div className="w-24 h-24 bg-white border-2 border-gray-200 flex items-center justify-center text-gray-300">{uploadingId === q.id ? <Loader2 className="animate-spin" size={20}/> : <ImageIcon size={24}/>}</div>}</div>
                            <div><input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} /><label htmlFor={`img-${q.id}`} className="px-5 py-2.5 bg-white border-2 border-gray-800 text-[10px] font-black uppercase cursor-pointer hover:bg-gray-100 transition-colors rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none">Tải ảnh minh họa</label></div>
                        </div>

                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-4 bg-gray-50 p-5 border-2 border-gray-200 rounded-none"><input type="radio" name={`ans-${q.id}`} className="w-5 h-5 accent-blue-600" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} /><input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} /></div>
                                ))}
                            </div>
                        )}
                        {type === 'group-tf' && (
                            <div className="space-y-4 mb-8">
                                {q.subQuestions?.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-gray-50 p-5 border-2 border-gray-200 rounded-none"><span className="text-xs font-black text-blue-700 w-8">{String.fromCharCode(97+si)})</span><input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý..." /><div className="flex bg-white border-2 border-gray-800 rounded-none p-1">{['True', 'False'].map(v => <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-4 py-1.5 text-[10px] font-black transition-all ${sq.correctAnswer === v ? 'bg-gray-800 text-white' : 'text-gray-400'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>)}</div></div>
                                ))}
                            </div>
                        )}
                        {type === 'short' && (
                            <div className="mb-8 flex items-center gap-4 bg-gray-50 p-5 border-2 border-gray-200 rounded-none"><span className="text-[10px] font-black text-orange-700 uppercase">Đáp án đúng:</span><input type="text" className="flex-1 bg-transparent text-sm font-black outline-none border-b-2 border-gray-300 focus:border-orange-500" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả..." /></div>
                        )}

                        <div className="pt-8 border-t-2 border-gray-100 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb size={16} className="text-yellow-600" />
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lời giải chi tiết (Hiện sau khi nộp)</label>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <textarea 
                                    className="w-full p-6 bg-yellow-50/20 border-2 border-yellow-100 rounded-none text-sm outline-none min-h-[140px] focus:bg-yellow-50/40 focus:border-yellow-400 transition-all font-bold" 
                                    value={q.solution} 
                                    onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} 
                                    placeholder="Nhập hướng dẫn giải chi tiết..." 
                                />
                                <div className="w-full p-6 bg-white border-2 border-gray-100 rounded-none text-sm min-h-[140px] overflow-auto italic">
                                    <LatexText text={q.solution || '*Chưa có lời giải chi tiết.*'} />
                                </div>
                            </div>
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

    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [editStudent, setEditStudent] = useState<User | null>(null);
    const [historyView, setHistoryView] = useState<{ student: User, quizId: string, attempts: Result[] } | null>(null);
    const [showBank, setShowBank] = useState<{ type: QuestionType, open: boolean }>({ type: 'mcq', open: false });
    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentCode, setNewStudentCode] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState<Grade>('12');
    const [newStudentPass, setNewStudentPass] = useState('123456');

    const csvInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    };

    const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/);
            const newUsers: User[] = [];
            let importCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                let cols: string[] = [];
                if (line.includes('\t')) cols = line.split('\t');
                else if (line.includes(';')) cols = line.split(';');
                else if (line.includes(',')) cols = line.split(',');
                else cols = line.split(/\s{2,}/);

                const lineUpper = line.toUpperCase();
                if (lineUpper.includes('MAHS') || lineUpper.includes('HOTEN')) continue;

                if (cols.length < 2) continue;

                const mahs = cols[0]?.trim().toUpperCase();
                const ten = cols[1]?.trim();
                const lop = (cols[2]?.trim() || '12') as Grade;
                const pass = cols[3]?.trim() || '123456';

                if (!mahs || !ten) continue;

                const newUser: User = {
                    id: uuidv4(),
                    username: mahs.toLowerCase(),
                    password: pass,
                    role: 'student',
                    fullName: ten,
                    studentCode: mahs,
                    grade: lop,
                    points: 0
                };
                newUsers.push(newUser);
                importCount++;
            }

            if (newUsers.length > 0) {
                if (confirm(`Tìm thấy ${importCount} học sinh. Nhập vào hệ thống?`)) {
                    for (const u of newUsers) {
                        await saveUser(u);
                    }
                    alert(`Đã nhập thành công ${importCount} học sinh!`);
                    refreshData();
                }
            } else {
                alert("Không có dữ liệu hợp lệ. Mẫu: MAHS [tab] Hoten [tab] Khoi [tab] pass");
            }
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    const filteredQuizzesList = useMemo(() => {
        return quizzes.filter(q => {
            const matchesSearch = q.title.toLowerCase().includes(qSearch.toLowerCase());
            const matchesGrade = qGradeFilter === 'all' || q.grade === qGradeFilter;
            const matchesChapter = qChapterFilter === 'all' || q.category === qChapterFilter;
            return matchesSearch && matchesGrade && matchesChapter;
        });
    }, [quizzes, qSearch, qGradeFilter, qChapterFilter]);

    const filteredStudents = useMemo(() => {
        return users.filter(u => 
            u.role === 'student' && 
            (sGradeFilter === 'all' || u.grade === sGradeFilter) && 
            (u.fullName.toLowerCase().includes(sSearch.toLowerCase()) || (u.studentCode && u.studentCode.toLowerCase().includes(sSearch.toLowerCase())))
        );
    }, [users, sSearch, sGradeFilter]);

    const latestResultsForTable = useMemo(() => {
        const filtered = results.filter(r => {
            const q = quizzes.find(qx => qx.id === r.quizId);
            const matchesGrade = rGradeFilter === 'all' || q?.grade === rGradeFilter;
            const matchesChapter = rChapterFilter === 'all' || q?.category === rChapterFilter;
            const matchesQuiz = rQuizFilter === 'all' || r.quizId === rQuizFilter;
            return matchesGrade && matchesChapter && matchesQuiz;
        });
        const grouped = filtered.reduce((acc, curr) => {
            if (!acc[curr.studentId] || isAfter(parseISO(curr.submittedAt), parseISO(acc[curr.studentId].submittedAt))) {
                acc[curr.studentId] = curr;
            }
            return acc;
        }, {} as Record<string, Result>);
        return Object.values(grouped);
    }, [results, quizzes, rGradeFilter, rChapterFilter, rQuizFilter]);

    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStudentName || !newStudentCode) return alert("Điền đủ thông tin!");
        const existing = users.find(u => u.studentCode === newStudentCode.toUpperCase());
        if (existing) return alert("Mã số học sinh này đã tồn tại!");
        const newUser: User = {
            id: uuidv4(),
            username: newStudentCode.toLowerCase(),
            password: newStudentPass,
            role: 'student',
            fullName: newStudentName,
            studentCode: newStudentCode.toUpperCase(),
            grade: newStudentGrade,
            points: 0
        };
        await saveUser(newUser);
        alert("Thêm học sinh thành công!");
        setNewStudentName(''); setNewStudentCode(''); setNewStudentPass('123456'); setIsAddStudentOpen(false);
        refreshData();
    };

    const handleResetPassword = async (studentId: string) => {
        if (!confirm('Đặt lại mật khẩu về "123456"?')) return;
        const success = await changePassword(studentId, '123456');
        if (success) { alert('Thành công!'); refreshData(); }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Xóa học sinh này?')) return;
        await deleteUser(id);
        refreshData();
    };

    const startEdit = (q: Quiz) => {
        setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setQuizType(q.type);
        setIsPublished(q.isPublished); setDuration(q.durationMinutes); setQuestions(q.questions);
        setCategory(q.category || ''); setStartTime(q.startTime || ''); setActiveMenu('editor');
    };

    const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAiLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                try {
                    const newQs = await parseQuestionsFromPDF(base64);
                    setQuestions(prev => [...prev, ...newQs]);
                    alert(`Đã trích xuất thành công ${newQs.length} câu hỏi!`);
                } catch (err: any) {
                    alert("Lỗi khi bóc tách PDF: " + (err.message || "Đã có lỗi xảy ra"));
                } finally {
                    setIsAiLoading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error(error);
            setIsAiLoading(false);
        }
        e.target.value = '';
    };

    const handleSave = async () => {
        if (!title) return alert("Nhập tên đề!");
        const data: Quiz = {
            id: editingId || uuidv4(), title, description: '', type: quizType,
            grade, durationMinutes: duration, questions, isPublished,
            createdAt: new Date().toISOString(), category,
            startTime: quizType === 'test' ? startTime : undefined
        };
        if (editingId) await updateQuiz(data); else await saveQuiz(data);
        alert("Lưu thành công!"); setEditingId(null); setActiveMenu('quizzes'); refreshData();
    };

    const handleDeleteResult = async (id: string) => {
        if (!confirm('Xóa kết quả này?')) return;
        await deleteResult(id);
        refreshData();
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden text-gray-800 font-sans antialiased">
            <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0 z-20 border-r-2 border-black">
                <div className="p-8 border-b-2 border-gray-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 flex items-center justify-center border-2 border-white shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"><Cpu size={18}/></div>
                    <span className="font-black text-[12px] tracking-[0.1em] uppercase">EduQuiz Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'quizzes', icon: LayoutDashboard, label: '1. QUẢN LÝ ĐỀ THI' },
                        { id: 'editor', icon: Plus, label: '2. SOẠN / CHỈNH ĐỀ', action: () => { setEditingId(null); setTitle(''); setQuestions([]); setStartTime(''); } },
                        { id: 'ai', icon: Sparkles, label: '3. SOẠN ĐỀ BẰNG AI' },
                        { id: 'results', icon: BarChart3, label: '4. BẢNG ĐIỂM TỔNG' },
                        { id: 'students', icon: Users, label: '5. QUẢN LÝ HỌC SINH' },
                        { id: 'chapters', icon: FolderTree, label: '6. QUẢN LÝ CHƯƠNG' }
                    ].map(m => (
                        <button key={m.id} onClick={() => { setActiveMenu(m.id as any); if(m.action) m.action(); }} className={`w-full flex items-center gap-3 px-5 py-4 rounded-none text-[10px] font-black uppercase tracking-widest transition-all ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}><m.icon size={16}/> {m.label}</button>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b-2 border-gray-800 px-8 flex items-center justify-between shrink-0 shadow-sm z-10"><h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{activeMenu}</h2></header>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    {activeMenu === 'quizzes' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-6 border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                                <div className="flex-1 w-full flex items-center gap-3 px-4 py-2 bg-gray-50 border-2 border-gray-200 rounded-none"><Search className="text-gray-400" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-black w-full" placeholder="Tìm tên đề..." value={qSearch} onChange={e => setQSearch(e.target.value)} /></div>
                                <select className="px-4 py-3 bg-white border-2 border-gray-800 rounded-none text-[10px] font-black uppercase" value={qGradeFilter} onChange={e => { setQGradeFilter(e.target.value as any); setQChapterFilter('all'); }}><option value="all">KHỐI LỚP</option><option value="12">KHỐI 12</option><option value="11">KHỐI 11</option><option value="10">KHỐI 10</option></select>
                                <select className="px-4 py-3 bg-white border-2 border-gray-800 rounded-none text-[10px] font-black uppercase" value={qChapterFilter} onChange={e => setQChapterFilter(e.target.value)}><option value="all">CHƯƠNG HỌC</option>{chapters.filter(c => qGradeFilter === 'all' || c.grade === qGradeFilter).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {filteredQuizzesList.map(q => {
                                    const stats = { count: results.filter(r => r.quizId === q.id).length, max: Math.max(0, ...results.filter(r => r.quizId === q.id).map(r => r.score)) };
                                    return (
                                        <div key={q.id} className="bg-white rounded-none p-8 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:border-blue-600 transition-all group relative flex flex-col">
                                            <div className="flex justify-between items-start mb-6">
                                                <span className={`px-4 py-1.5 border-2 border-gray-800 rounded-none text-[9px] font-black uppercase tracking-widest ${q.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400'}`}>{q.isPublished ? 'CÔNG KHAI' : 'NHÁP'}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => startEdit(q)} className="p-2.5 bg-blue-50 text-blue-600 border border-blue-200"><Edit size={16}/></button>
                                                    <button onClick={async () => { if(confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2.5 bg-red-50 text-red-500 border border-red-200"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                            <h3 className="font-black text-gray-900 text-lg mb-6 leading-tight min-h-[56px]">{q.title}</h3>
                                            <div className="bg-gray-50 border-2 border-gray-100 p-5 grid grid-cols-3 gap-2 mb-6 text-center">
                                                <div><p className="text-[8px] font-black text-gray-300 uppercase">Câu hỏi</p><p className="text-xs font-black">{q.questions.length}</p></div>
                                                <div className="border-l-2 border-gray-100"><p className="text-[8px] font-black text-gray-300 uppercase">Lượt làm</p><p className="text-xs font-black">{stats.count}</p></div>
                                                <div className="border-l-2 border-gray-100"><p className="text-[8px] font-black text-gray-300 uppercase">Điểm cao</p><p className="text-xs font-black text-blue-600">{stats.max.toFixed(1)}</p></div>
                                            </div>
                                            <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-4 border-t-2 border-gray-100 flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline"><Eye size={14}/> XEM TRƯỚC ĐỀ</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeMenu === 'students' && (
                        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                            {/* THANH CÔNG CỤ THEO THỨ TỰ YÊU CẦU: MAHS -> KHOI -> SOLUONG */}
                            <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-5 border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none gap-5">
                                <div className="flex flex-1 flex-col sm:flex-row gap-4 items-center w-full">
                                    {/* 1. Tìm theo MAHS */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-none flex-1 w-full sm:max-w-xs">
                                        <Search className="text-gray-400" size={18}/>
                                        <input type="text" className="bg-transparent outline-none text-xs font-black w-full" placeholder="Tìm theo MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} />
                                    </div>
                                    
                                    {/* 2. Chọn Khối */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <select className="px-4 py-3 bg-white border-2 border-gray-800 rounded-none text-[10px] font-black uppercase outline-none min-w-[120px]" value={sGradeFilter} onChange={e => setSGradeFilter(e.target.value as any)}>
                                            <option value="all">TẤT CẢ KHỐI</option>
                                            <option value="12">KHỐI 12</option>
                                            <option value="11">KHỐI 11</option>
                                            <option value="10">KHỐI 10</option>
                                        </select>
                                    </div>

                                    {/* 3. Textbox số lượng học sinh */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-600 rounded-none shrink-0">
                                        <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">SỐ LƯỢNG:</span>
                                        <input 
                                          type="text" 
                                          readOnly 
                                          className="w-12 bg-transparent text-center font-black text-blue-700 outline-none border-none text-sm" 
                                          value={filteredStudents.length} 
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 w-full lg:w-auto">
                                    <input type="file" accept=".csv,.txt" className="hidden" ref={csvInputRef} onChange={handleCsvImport} />
                                    <button onClick={() => csvInputRef.current?.click()} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border-2 border-gray-800 px-6 py-3 rounded-none text-[10px] font-black uppercase hover:bg-gray-50 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none"><FileSpreadsheet size={16}/> Nhập CSV</button>
                                    <button onClick={() => setIsAddStudentOpen(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-none text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-700 active:translate-y-0.5"><UserPlus size={16}/> Thêm mới</button>
                                </div>
                            </div>
                            
                            <div className="bg-white rounded-none border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-900 border-b-2 border-gray-800 text-[10px] font-black text-white uppercase tracking-widest">
                                            <th className="p-6">Học sinh</th>
                                            <th className="p-6">Mã số (MAHS)</th>
                                            <th className="p-6 text-center">Khối</th>
                                            <th className="p-6 text-center">Tích lũy</th>
                                            <th className="p-6 text-center">Quản lý</th>
                                            <th className="p-6 text-center">Xóa</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-gray-100">
                                        {filteredStudents.map(u => (
                                            <tr key={u.id} className="group hover:bg-gray-50">
                                                <td className="p-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gray-800 text-white rounded-none flex items-center justify-center font-black text-sm border-2 border-gray-800 shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]">{u.fullName.charAt(0)}</div>
                                                        <span className="font-black text-gray-800">{u.fullName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6 font-black text-gray-400 uppercase">{u.studentCode}</td>
                                                <td className="p-6 text-center font-bold text-gray-500">{u.grade}</td>
                                                <td className="p-6 text-center"><span className="px-3 py-1 bg-yellow-100 text-yellow-800 border-2 border-yellow-300 font-black text-[10px]">+{u.points || 0}</span></td>
                                                <td className="p-6 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleResetPassword(u.id)} className="p-2.5 bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-600 hover:text-white transition-all" title="Reset PW"><RefreshCw size={14}/></button>
                                                        <button onClick={() => setEditStudent(u)} className="p-2.5 bg-white border-2 border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"><UserCog size={14}/></button>
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center">
                                                    <button onClick={() => handleDeleteUser(u.id)} className="p-2.5 text-gray-200 hover:text-red-500"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'editor' && (
                        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
                           <div className="bg-white p-10 rounded-none border-2 border-gray-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-2 border-gray-100 pb-8">
                                    <input type="text" className="text-3xl font-black outline-none bg-transparent placeholder-gray-200 w-full" placeholder="Tên đề thi mới..." value={title} onChange={e => setTitle(e.target.value)} />
                                    <label className="flex items-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-none text-[10px] font-black uppercase cursor-pointer hover:bg-black transition-all relative shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] active:translate-y-0.5">
                                        {isAiLoading && <Loader2 className="animate-spin" size={16}/>}
                                        <FileUp size={16}/> {isAiLoading ? 'XỬ LÝ AI...' : 'NHẬP TỪ PDF'}
                                        <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfExtract}/>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Khối lớp</label><select className="w-full border-2 border-gray-800 rounded-none p-4 text-xs font-black bg-white outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Hình thức</label><select className="w-full border-2 border-gray-800 rounded-none p-4 text-xs font-black bg-white outline-none" value={quizType} onChange={e => setQuizType(e.target.value as any)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Trạng thái</label><button onClick={() => setIsPublished(!isPublished)} className={`w-full p-4 rounded-none font-black text-[10px] uppercase border-2 transition-all ${isPublished ? 'bg-emerald-600 text-white border-gray-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-gray-400 border-gray-200'}`}>{isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</button></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Thời gian (Phút)</label><input type="number" className="w-full border-2 border-gray-800 rounded-none p-4 text-xs font-black bg-white outline-none" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Chương học</label><select className="w-full border-2 border-gray-800 rounded-none p-4 text-xs font-black bg-white outline-none" value={category} onChange={e => setCategory(e.target.value)}><option value="">Chọn chương học</option>{chapters.filter(c => c.grade === grade).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                                    {quizType === 'test' && (
                                        <div className="space-y-1 animate-fade-in"><label className="text-[9px] font-black text-gray-400 uppercase px-1">Lịch bắt đầu</label><input type="datetime-local" className="w-full border-2 border-gray-800 rounded-none p-4 text-xs font-black bg-white outline-none" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
                                    )}
                                </div>
                                <button onClick={handleSave} className="w-full bg-blue-600 text-white py-6 rounded-none font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-[6px_6px_0px_0px_rgba(31,41,55,1)] active:shadow-none active:translate-y-1"><Save size={20}/> {editingId ? 'CẬP NHẬT ĐỀ THI' : 'LƯU ĐỀ THI MỚI'}</button>
                            </div>
                            <QuestionSection title="PHẦN I. Câu trắc nghiệm" type="mcq" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(t) => setShowBank({ type: t, open: true })} />
                        </div>
                    )}

                    {/* CHAPTERS MENU */}
                    {activeMenu === 'chapters' && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                             <div className="bg-white p-10 rounded-none border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-6">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Tạo mới chương học</h4>
                                <div className="flex flex-col gap-4">
                                    <select className="p-5 bg-white border-2 border-gray-800 rounded-none text-sm font-black outline-none" id="ch-grade"><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                                    <div className="flex gap-3">
                                        <input type="text" className="flex-1 p-5 bg-white border-2 border-gray-800 rounded-none text-sm font-bold outline-none" placeholder="Tên chương học..." id="ch-name" />
                                        <button onClick={async () => { const n = document.getElementById('ch-name') as HTMLInputElement; const g = document.getElementById('ch-grade') as HTMLSelectElement; if(!n.value) return; await saveChapter({ id: uuidv4(), name: n.value, grade: g.value as Grade, order: chapters.length }); n.value = ''; refreshData(); }} className="bg-blue-600 text-white px-10 rounded-none font-black text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5">Lưu Chương</button>
                                    </div>
                                </div>
                            </div>
                            {['12', '11', '10'].map(g => (
                                <div key={g} className="space-y-3">
                                    <h5 className="text-[10px] font-black text-gray-400 uppercase px-6 tracking-[0.2em]">Danh sách chương Khối {g}</h5>
                                    {chapters.filter(c => c.grade === g).map(c => (
                                        <div key={c.id} className="bg-white p-6 px-10 rounded-none border-2 border-gray-800 flex justify-between items-center group hover:border-blue-500 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                            <span className="font-black text-sm text-gray-800">{c.name}</span>
                                            <button onClick={async () => { if(confirm('Xóa?')) { await deleteChapter(c.id); refreshData(); } }} className="p-3 text-gray-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Thêm học sinh thủ công */}
            {isAddStudentOpen && (
                <div className="fixed inset-0 bg-gray-900/90 z-[1200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-none border-4 border-gray-800 w-full max-w-md p-10 shadow-[10px_10px_0px_0px_rgba(59,130,246,1)] relative">
                        <button onClick={() => setIsAddStudentOpen(false)} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-red-500 transition-colors"><X size={24}/></button>
                        <h3 className="text-xl font-black uppercase text-gray-900 mb-8 flex items-center gap-3 underline decoration-blue-600 decoration-4"><UserPlus size={24}/> Thêm học sinh</h3>
                        <form onSubmit={handleAddStudent} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Họ và Tên học sinh</label>
                                <input type="text" className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-bold outline-none focus:bg-blue-50 transition-all" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required placeholder="Nguyễn Văn A" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Mã định danh (MAHS)</label>
                                <input type="text" className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-black outline-none focus:bg-blue-50 transition-all uppercase" value={newStudentCode} onChange={e => setNewStudentCode(e.target.value)} required placeholder="HS24001" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Khối lớp</label>
                                    <select className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-black outline-none" value={newStudentGrade} onChange={e => setNewStudentGrade(e.target.value as Grade)}>
                                        <option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Mật khẩu</label>
                                    <input type="text" className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-bold outline-none" value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} required />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-gray-800 text-white py-5 rounded-none font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(59,130,246,1)] mt-4 active:translate-y-1 active:shadow-none">Lưu Học Sinh</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Sửa học sinh */}
            {editStudent && (
                <div className="fixed inset-0 bg-gray-900/90 z-[1200] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-none border-4 border-gray-800 w-full max-w-md p-10 shadow-[10px_10px_0px_0px_rgba(245,158,11,1)] relative">
                        <button onClick={() => setEditStudent(null)} className="absolute top-6 right-6 p-2 text-gray-300 hover:text-red-500 transition-colors"><X size={24}/></button>
                        <h3 className="text-xl font-black uppercase text-gray-900 mb-8 flex items-center gap-3"><UserCog className="text-orange-600"/> Cập nhật thông tin</h3>
                        <form onSubmit={(e) => { e.preventDefault(); if(editStudent) { saveUser(editStudent); setEditStudent(null); refreshData(); } }} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Họ và Tên</label>
                                <input type="text" className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-bold outline-none" value={editStudent.fullName} onChange={e => setEditStudent({...editStudent, fullName: e.target.value})} required />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Mã số (Không thể sửa)</label>
                                <input type="text" className="w-full bg-gray-100 border-2 border-gray-300 rounded-none p-4 font-black outline-none opacity-50 uppercase" value={editStudent.studentCode} readOnly />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Khối lớp</label>
                                <select className="w-full bg-white border-2 border-gray-800 rounded-none p-4 font-black outline-none" value={editStudent.grade} onChange={e => setEditStudent({...editStudent, grade: e.target.value as Grade})}>
                                    <option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-orange-600 text-white py-5 rounded-none font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(31,41,55,1)] mt-4 active:translate-y-1 active:shadow-none transition-all">Lưu Thay Đổi</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
