
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, QuizType } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, getChapters, saveChapter, deleteChapter, uploadQuizImage, deleteResult, deleteUser, saveUser, changePassword, clearLocalCache
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, BarChart3, Edit, Cpu, 
    LayoutDashboard, Users, FolderTree, Clock, 
    Search, X, CheckCircle2, 
    HelpCircle, AlignLeft, Eye, Target, FileText, ImageIcon, Loader2, Database,
    Sparkles, FileUp, CheckCircle, AlertCircle, Filter, ChevronRight, Info, Calendar, History, TrendingUp, Trophy, UserPlus, Lightbulb, Medal, Target as TargetIcon, CopyCheck, RefreshCw, UserCog, FileSpreadsheet, Download, XCircle, RotateCcw, Check, List, ListChecks, Eraser, Calculator
} from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';
import LatexText from './LatexText';

// Helper to safe parse points
const safeParseScore = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    try {
        const str = String(val).replace(',', '.').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    } catch (e) {
        return 0;
    }
};

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
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm group">
                        <Database size={14} className="group-hover:animate-bounce"/> Ngân hàng
                    </button>
                    <button onClick={addManual} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all">
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

                        <div className="pt-8 border-t border-slate-100">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2 px-1">
                                        <Lightbulb size={16} className="text-yellow-500"/> Hướng dẫn giải (LaTeX: $...$)
                                    </label>
                                    <textarea 
                                        className="w-full p-6 bg-yellow-50/20 border border-yellow-100 rounded-3xl text-sm outline-none min-h-[120px] focus:bg-yellow-50/50 transition-all font-medium" 
                                        value={q.solution} 
                                        onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} 
                                        placeholder="Nhập hướng dẫn giải..." 
                                    />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-yellow-600 uppercase flex items-center gap-2 px-1">
                                        <Eye size={16} className="text-yellow-500"/> Xem trước lời giải
                                    </label>
                                    <div className="w-full p-6 bg-yellow-50/10 rounded-3xl border border-yellow-100/50 min-h-[120px] text-sm overflow-auto text-slate-600 italic">
                                        <LatexText text={q.solution || '*Chưa có lời giải chi tiết*'} />
                                    </div>
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
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'editor' | 'ai' | 'results' | 'students' | 'chapters' | 'bank'>('quizzes');
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

    const [bGradeFilter, setBGradeFilter] = useState<Grade | 'all'>('all');
    const [bTypeFilter, setBTypeFilter] = useState<QuestionType | 'all'>('all');
    const [bSearch, setBSearch] = useState('');

    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    const [bankModal, setBankModal] = useState<{ open: boolean, type: QuestionType | null }>({ open: false, type: null });
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    
    const [attemptDetail, setAttemptDetail] = useState<{ studentName: string, quizTitle: string, history: Result[] } | null>(null);
    const [selectedResultForReview, setSelectedResultForReview] = useState<Result | null>(null);

    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentCode, setNewStudentCode] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState<Grade>('12');

    const csvInputRef = useRef<HTMLInputElement>(null);

    const currentTotalPoints = useMemo(() => {
        return questions.reduce((acc, q) => acc + safeParseScore(q.points), 0);
    }, [questions]);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    };

    const handleClearLocal = async () => {
        if (confirm("Dọn dẹp bộ nhớ đệm?")) {
            clearLocalCache();
            alert("Đã dọn dẹp!");
            await refreshData();
        }
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
        alert("Thêm học sinh thành công!");
        setIsAddStudentOpen(false);
        setNewStudentName(''); setNewStudentCode('');
        await refreshData();
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
              await refreshData();
            }
        };
        reader.readAsText(file);
    };

    const formatStudyTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h} giờ ${m} phút`;
        return `${m} phút`;
    };

    const exportToDoc = (quiz: Quiz) => {
        let content = `<html><head><meta charset="utf-8"></head><body><h1>${quiz.title}</h1></body></html>`;
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

    const groupedResults = useMemo(() => {
        const filtered = results.filter(r => {
            const quiz = quizzes.find(q => q.id === r.quizId);
            const matchGrade = rGradeFilter === 'all' || (quiz && quiz.grade === rGradeFilter);
            const matchChapter = rChapterFilter === 'all' || (quiz && quiz.category === rChapterFilter);
            const matchQuiz = rQuizFilter === 'all' || r.quizId === rQuizFilter;
            return matchGrade && matchChapter && matchQuiz;
        });

        const groups: Record<string, { latest: Result, history: Result[] }> = {};
        filtered.forEach(r => {
            const key = r.studentCode ? `${r.studentCode}_${r.quizId}` : `${r.studentId}_${r.quizId}`;
            if (!groups[key]) {
                groups[key] = { latest: r, history: [r] };
            } else {
                groups[key].history.push(r);
                if (isAfter(parseISO(r.submittedAt), parseISO(groups[key].latest.submittedAt))) {
                    groups[key].latest = r;
                }
            }
        });
        
        return Object.values(groups).sort((a, b) => isAfter(parseISO(b.latest.submittedAt), parseISO(a.latest.submittedAt)) ? 1 : -1);
    }, [results, quizzes, rGradeFilter, rChapterFilter, rQuizFilter]);

    const bankQuestions = useMemo(() => {
        if (!bankModal.type) return [];
        let allQs: Question[] = [];
        quizzes.filter(q => q.grade === grade).forEach(q => allQs = [...allQs, ...q.questions.filter(qu => qu.type === bankModal.type)]);
        return allQs.filter((v, i, a) => a.findIndex(t => t.text === v.text) === i);
    }, [quizzes, grade, bankModal.type]);

    const allBankQuestions = useMemo(() => {
        let all: (Question & { quizTitle: string, quizGrade: Grade })[] = [];
        quizzes.forEach(q => {
            q.questions.forEach(qu => {
                all.push({ ...qu, quizTitle: q.title, quizGrade: q.grade });
            });
        });
        return all.filter((v, i, a) => a.findIndex(t => t.text === v.text) === i)
                  .filter(q => (bGradeFilter === 'all' || q.quizGrade === bGradeFilter) && (bTypeFilter === 'all' || q.type === bTypeFilter) && q.text.toLowerCase().includes(bSearch.toLowerCase()));
    }, [quizzes, bGradeFilter, bTypeFilter, bSearch]);

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
        alert("Lưu thành công!"); setActiveMenu('quizzes'); await refreshData();
    };

    const handleAiGenerate = async () => {
        if (!aiPrompt) return alert("Nhập chủ đề!");
        setIsAiLoading(true);
        try {
            const qs = await generateQuizFromPrompt({ grade, topic: aiPrompt, part1Count: aiPart1, part2Count: aiPart2, part3Count: aiPart3 });
            setQuestions(qs); setTitle(`Đề AI: ${aiPrompt}`); setActiveMenu('editor');
        } catch (error) { alert("Lỗi AI soạn đề!"); }
        finally { setIsAiLoading(false); }
    };

    const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setIsAiLoading(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            const newQs = await parseQuestionsFromPDF(base64);
            if (newQs) setQuestions(prev => [...prev, ...newQs]);
        } catch (error) { alert("Lỗi xử lý PDF."); } finally { setIsAiLoading(false); }
    };

    const checkShortAnswer = (userAns: string | undefined, correctAns: string | undefined): boolean => {
        if (!userAns || !correctAns) return false;
        return userAns.trim().toLowerCase() === correctAns.trim().toLowerCase();
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-700 font-sans">
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
                <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Cpu size={18}/></div>
                    <span className="font-black text-[11px] tracking-[0.2em] uppercase italic">EduQuiz Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {[
                        { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                        { id: 'bank', icon: Database, label: 'NGÂN HÀNG CÂU HỎI' },
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
                        {activeMenu === 'quizzes' ? 'Quản lý đề thi' : activeMenu === 'editor' ? 'Trình soạn thảo đề' : activeMenu === 'ai' ? 'Trí tuệ nhân tạo' : activeMenu === 'results' ? 'Bảng điểm' : activeMenu === 'students' ? 'Học sinh' : activeMenu === 'bank' ? 'Ngân hàng' : 'Chương học'}
                    </h2>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                    {activeMenu === 'quizzes' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                            {filteredQuizzesList.map(q => (
                                <div key={q.id} className="bg-white rounded-[2.5rem] p-8 border shadow-sm flex flex-col group">
                                    <div className="flex justify-between items-start mb-6">
                                        <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-500 tracking-widest">KHỐI {q.grade}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => startEdit(q)} className="p-2.5 bg-white border rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit size={16}/></button>
                                            <button onClick={async () => { if(confirm('Xóa đề?')) { await deleteQuiz(q.id); await refreshData(); } }} className="p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-lg mb-4 line-clamp-2 min-h-[56px] leading-tight uppercase tracking-tight">{q.title}</h3>
                                    <button onClick={() => setPreviewQuiz(q)} className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:underline"><Eye size={14}/> Xem trước đề</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeMenu === 'bank' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white p-6 rounded-3xl border shadow-sm flex gap-4">
                                <select className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase" value={bGradeFilter} onChange={e => setBGradeFilter(e.target.value as any)}><option value="all">TẤT CẢ KHỐI</option><option value="12">KHỐI 12</option><option value="11">KHỐI 11</option><option value="10">KHỐI 10</option></select>
                                <select className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase" value={bTypeFilter} onChange={e => setBTypeFilter(e.target.value as any)}><option value="all">TẤT CẢ DẠNG</option><option value="mcq">TRẮC NGHIỆM</option><option value="group-tf">ĐÚNG/SAI</option><option value="short">TRẢ LỜI NGẮN</option></select>
                                <input type="text" className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs font-bold" placeholder="Tìm câu hỏi..." value={bSearch} onChange={e => setBSearch(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {allBankQuestions.map((bq, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-3xl border shadow-sm flex items-center justify-between group hover:border-blue-300">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[8px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-600 uppercase">{bq.type}</span>
                                                <span className="text-[8px] text-slate-400 font-bold uppercase">Nguồn: {bq.quizTitle}</span>
                                            </div>
                                            <div className="font-bold text-slate-800"><LatexText text={bq.text}/></div>
                                        </div>
                                        <button onClick={() => { setQuestions(prev => [...prev, { ...bq, id: uuidv4() }]); setActiveMenu('editor'); }} className="p-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all">Sao chép</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeMenu === 'editor' && (
                        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8 relative overflow-hidden">
                                <div className={`absolute top-0 right-10 px-6 py-2 rounded-b-2xl font-black text-[10px] uppercase shadow-lg z-10 transition-colors ${currentTotalPoints === 10 ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'}`}>
                                    Tổng điểm đề: {currentTotalPoints.toFixed(2)}đ
                                </div>
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
                                    <input type="text" className="text-3xl font-black outline-none bg-transparent w-full uppercase" placeholder="Tên đề thi..." value={title} onChange={e => setTitle(e.target.value)} />
                                    <label className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:bg-black transition-all">
                                        <FileUp size={16}/> NHẬP TỪ PDF
                                        <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfExtract}/>
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Khối lớp</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Hình thức</label><select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={quizType} onChange={e => setQuizType(e.target.value as any)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Trạng thái</label><button onClick={() => setIsPublished(!isPublished)} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase border transition-all ${isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>{isPublished ? 'CÔNG KHAI' : 'NHÁP'}</button></div>
                                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase">Thời gian</label><input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={duration} onChange={e => setDuration(parseInt(e.target.value))} /></div>
                                </div>
                                <button onClick={handleSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl"><Save size={20}/> LƯU ĐỀ THI</button>
                            </div>
                            <QuestionSection title="PHẦN I. TRẮC NGHIỆM" type="mcq" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(type) => setBankModal({ open: true, type })} />
                            <QuestionSection title="PHẦN II. ĐÚNG/SAI" type="group-tf" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(type) => setBankModal({ open: true, type })} />
                            <QuestionSection title="PHẦN III. TRẢ LỜI NGẮN" type="short" questions={questions} setQuestions={setQuestions} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q)); setUploadingId(null); }} uploadingId={uploadingId} onOpenBank={(type) => setBankModal({ open: true, type })} />
                        </div>
                    )}

                    {activeMenu === 'results' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex justify-between items-center">
                                <h3 className="text-xl font-black uppercase flex items-center gap-3"><BarChart3 className="text-blue-600"/> Bảng điểm tổng quát</h3>
                                <button onClick={handleClearLocal} className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"><Eraser size={14}/></button>
                            </div>
                            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Đề thi</th><th className="p-6 text-center">Lượt làm</th><th className="p-6 text-center">Điểm</th><th className="p-6 text-center">Xóa</th></tr></thead>
                                    <tbody className="divide-y">
                                        {groupedResults.map((group, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6 font-bold text-slate-800 uppercase">{group.latest.studentName}</td>
                                                <td className="p-6 text-sm text-slate-500 uppercase">{quizzes.find(q => q.id === group.latest.quizId)?.title || 'Đề đã xóa'}</td>
                                                <td className="p-6 text-center font-black text-blue-600">{group.history.length}</td>
                                                <td className="p-6 text-center font-black text-emerald-600">{group.latest.score.toFixed(2)}</td>
                                                <td className="p-6 text-center"><button onClick={async () => { if(confirm('Xóa?')) { await Promise.all(group.history.map(h => deleteResult(h.id))); await refreshData(); } }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'students' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex justify-between items-center bg-white p-5 rounded-[2.5rem] border shadow-sm">
                                <div className="flex-1 flex gap-4 px-5 py-2 items-center bg-slate-50 border rounded-2xl"><Search className="text-slate-300" size={18}/><input type="text" className="bg-transparent outline-none text-xs font-black w-full" placeholder="Tìm tên hoặc MAHS..." value={sSearch} onChange={e => setSSearch(e.target.value)} /></div>
                                <button onClick={() => setIsAddStudentOpen(true)} className="ml-4 bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all shadow-xl"><UserPlus size={16}/> THÊM MỚI</button>
                            </div>
                            <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-slate-50 border-b text-[10px] font-black uppercase tracking-widest text-slate-400"><th className="p-6">Học sinh</th><th className="p-6">Mã số</th><th className="p-6 text-center">Khối</th><th className="p-6 text-center">Hành động</th><th className="p-6 text-center">Xóa</th></tr></thead>
                                    <tbody className="divide-y">
                                        {filteredStudents.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-6 font-bold text-slate-800 uppercase">{u.fullName}</td>
                                                <td className="p-6 font-black uppercase text-slate-400">{u.studentCode}</td>
                                                <td className="p-6 text-center font-bold text-slate-500">{u.grade}</td>
                                                <td className="p-6 text-center">
                                                    <button onClick={() => setSelectedStudent(u)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                                        <Eye size={16}/>
                                                    </button>
                                                </td>
                                                <td className="p-6 text-center"><button onClick={async () => { if(confirm(`Xóa học sinh ${u.fullName}?`)) { await deleteUser(u.id); await refreshData(); } }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeMenu === 'chapters' && (
                        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-6">
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><FolderTree size={16} className="text-blue-600"/> Tạo chương học</h4>
                                <div className="flex gap-3"><input type="text" className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none uppercase" placeholder="Tên chương..." id="ch-name" /><button onClick={async () => { const n = document.getElementById('ch-name') as HTMLInputElement; if(!n.value) return; await saveChapter({ id: uuidv4(), name: n.value, grade: '12', order: chapters.length }); n.value=''; await refreshData(); }} className="bg-blue-600 text-white px-10 rounded-2xl font-black text-xs uppercase hover:bg-blue-700 transition-all">Lưu Chương</button></div>
                            </div>
                            <div className="space-y-4">
                                {chapters.map(c => (
                                    <div key={c.id} className="bg-white p-6 px-10 rounded-[2rem] border flex justify-between items-center group shadow-sm">
                                        <span className="font-black text-sm text-slate-700 uppercase">{c.name}</span>
                                        <button onClick={async () => { if(confirm('Xóa?')) { await deleteChapter(c.id); await refreshData(); } }} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {bankModal.open && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-4"><Database size={24} className="text-blue-500"/><h3 className="text-xl font-black uppercase tracking-tight">Ngân hàng câu hỏi {bankModal.type}</h3></div>
                                <button onClick={() => setBankModal({ open: false, type: null })} className="p-3 hover:text-red-500 transition-colors"><X size={24}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-slate-50 custom-scrollbar">
                                {bankQuestions.length === 0 ? (
                                    <p className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest italic">Kho câu hỏi đang trống cho khối {grade}</p>
                                ) : (
                                    bankQuestions.map((bq) => (
                                        <div key={bq.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-start gap-6 hover:border-blue-300 transition-all group shadow-sm">
                                            <div className="flex-1 font-bold leading-relaxed text-slate-800"><LatexText text={bq.text}/></div>
                                            <button onClick={() => { setQuestions([...questions, { ...bq, id: uuidv4() }]); setBankModal({ open: false, type: null }); alert("Đã thêm!"); }} className="bg-blue-50 text-blue-600 px-8 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm">Thêm vào đề</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedStudent && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl animate-fade-in-up">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><UserCog size={32}/></div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight">{selectedStudent.fullName}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 tracking-widest uppercase">MAHS: {selectedStudent.studentCode}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 custom-scrollbar space-y-8">
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b flex items-center gap-3"><Clock size={18} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lịch sử làm bài</span></div>
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-white border-b text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]"><th className="p-6">Đề thi</th><th className="p-6 text-center">Điểm</th><th className="p-6 text-center">Ngày nộp</th></tr></thead>
                                        <tbody className="divide-y">
                                          {results.filter(r => r.studentCode === selectedStudent.studentCode).sort((a,b)=>isAfter(parseISO(b.submittedAt), parseISO(a.submittedAt))?1:-1).map(r => (
                                              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                  <td className="p-6 font-bold text-sm text-slate-700 uppercase">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td>
                                                  <td className="p-6 text-center font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td>
                                                  <td className="p-6 text-center text-slate-400 text-[10px]">{format(parseISO(r.submittedAt), 'HH:mm dd/MM/yy')}</td>
                                              </tr>
                                          ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="p-6 border-t bg-white text-center shrink-0"><button onClick={() => setSelectedStudent(null)} className="px-12 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200">Đóng</button></div>
                        </div>
                    </div>
                )}

                {previewQuiz && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5"><div className="p-3 bg-blue-600 rounded-2xl"><FileText size={28}/></div><div><h3 className="text-lg font-black uppercase tracking-tight">{previewQuiz.title}</h3></div></div>
                                <button onClick={() => setPreviewQuiz(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                                <div className="max-w-3xl mx-auto space-y-12">
                                    {previewQuiz.questions.map((q, idx) => (
                                        <div key={q.id} className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                                            <p className="font-bold text-slate-800 text-lg flex gap-4 leading-relaxed mb-6"><span className="text-blue-600 shrink-0 font-black italic underline uppercase">Câu {idx + 1}.</span><LatexText text={q.text}/></p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-8 bg-white border-t flex justify-center shrink-0"><button onClick={() => { startEdit(previewQuiz!); setPreviewQuiz(null); }} className="px-12 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">Sửa đề này</button></div>
                        </div>
                    </div>
                )}

                {isAddStudentOpen && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <form onSubmit={handleAddStudentManual} className="bg-white rounded-[3.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up border-8 border-white">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-xl font-black uppercase tracking-tight">Thêm học sinh</h3><button type="button" onClick={() => setIsAddStudentOpen(false)}><X/></button></div>
                            <div className="p-10 space-y-6">
                                <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none uppercase" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Tên học sinh..." required />
                                <input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold uppercase outline-none" value={newStudentCode} onChange={e => setNewStudentCode(e.target.value)} placeholder="Mã học sinh..." required />
                                <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Thêm mới</button>
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
