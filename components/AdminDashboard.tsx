
import React, { useState, useEffect, useMemo } from 'react';
import { User, Quiz, Result, Chapter, Grade, QuizType, Question, QuestionType } from '../types';
import { 
    getUsers, getQuizzes, getResults, getChapters, 
    saveUser, deleteUser, saveQuiz, updateQuiz, deleteQuiz, 
    deleteResult, saveChapter, deleteChapter, 
    clearLocalCache, uploadQuizImage, changePassword 
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import StudentManager from './admin/StudentManager';
import ResultsBoard from './admin/ResultsBoard';
import AIRenderer from './admin/AIRenderer';
import QuizList from './admin/QuizList';
import QuizEditor from './admin/QuizEditor';
import ChapterManager from './admin/ChapterManager';
import QuestionBank from './admin/QuestionBank';
import LatexText from './LatexText';
import { 
    LayoutDashboard, Users as UsersIcon, ClipboardList, Sparkles, FolderTree, 
    Database, PlusCircle, X, UserPlus, Save, UserCog, BookOpen, Trophy, 
    Clock, Eye, ListChecks, Check, Lightbulb, History, Download, FileText, Trash2, Medal
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isAfter } from 'date-fns';

const AdminDashboard: React.FC = () => {
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'students' | 'results' | 'ai' | 'editor' | 'chapters' | 'bank'>('quizzes');
    const [users, setUsers] = useState<User[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    
    // Quiz Editor State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [grade, setGrade] = useState<Grade>('12');
    const [quizType, setQuizType] = useState<QuizType>('practice');
    const [isPublished, setIsPublished] = useState(false);
    const [duration, setDuration] = useState(45);
    const [category, setCategory] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    // Filters & Modals
    const [sSearch, setSSearch] = useState('');
    const [sGradeFilter, setSGradeFilter] = useState<Grade | 'all'>('all');
    const [qSearch, setQSearch] = useState('');
    const [qGradeFilter, setQGradeFilter] = useState<Grade | 'all'>('all');
    const [qChapterFilter, setQChapterFilter] = useState('all');
    const [rGradeFilter, setRGradeFilter] = useState<Grade | 'all'>('all');
    const [rChapterFilter, setRChapterFilter] = useState('all');
    const [rQuizFilter, setRQuizFilter] = useState('all');
    const [bSearch, setBSearch] = useState('');
    const [bGradeFilter, setBGradeFilter] = useState<Grade | 'all'>('all');
    const [bTypeFilter, setBTypeFilter] = useState<QuestionType | 'all'>('all');

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [studentModal, setStudentModal] = useState<{ isOpen: boolean, student: User | null }>({ isOpen: false, student: null });
    const [sForm, setSForm] = useState({ fullName: '', studentCode: '', grade: '12' as Grade, password: '123' });
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [viewingResult, setViewingResult] = useState<Result | null>(null);
    const [historyModal, setHistoryModal] = useState<{studentName: string, studentCode: string, quizTitle: string, history: Result[]} | null>(null);
    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [u, q, r, c] = await Promise.all([getUsers(), getQuizzes(), getResults(), getChapters()]);
        setUsers(u); setQuizzes(q); setResults(r); setChapters(c);
    };

    const handleSaveQuiz = async () => {
        if (!title) return alert("Vui lòng nhập tiêu đề");
        const quiz: Quiz = {
            id: editingId || uuidv4(), title, grade, type: quizType, category, durationMinutes: duration,
            startTime, endTime, questions, isPublished, createdAt: new Date().toISOString(), description: ''
        };
        if (editingId) await updateQuiz(quiz); else await saveQuiz(quiz);
        alert("Đã lưu đề thi thành công!");
        refreshData(); setActiveMenu('quizzes');
    };

    const startEditQuiz = (q: Quiz) => {
        setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setQuizType(q.type);
        setIsPublished(q.isPublished); setDuration(q.durationMinutes); setQuestions(q.questions);
        setCategory(q.category || ''); setStartTime(q.startTime || ''); setEndTime(q.endTime || '');
        setActiveMenu('editor');
    };

    const handleSaveStudent = async () => {
        if (!sForm.fullName || !sForm.studentCode) return alert("Vui lòng nhập đủ thông tin!");
        const userData: User = {
            id: studentModal.student?.id || uuidv4(),
            username: sForm.studentCode.toLowerCase(),
            password: sForm.password || '123',
            role: 'student',
            fullName: sForm.fullName,
            studentCode: sForm.studentCode.toUpperCase(),
            grade: sForm.grade,
            points: studentModal.student?.points || 0
        };
        await saveUser(userData);
        setStudentModal({ isOpen: false, student: null });
        refreshData();
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const rows = (event.target?.result as string).split('\n').map(r => r.split(','));
            for (const row of rows) {
                const [name, code, g, p] = row;
                if (!name || name.trim() === 'Họ tên') continue;
                await saveUser({
                    id: uuidv4(), username: code.trim().toLowerCase(), password: p?.trim() || '123',
                    role: 'student', fullName: name.trim(), studentCode: code.trim().toUpperCase(),
                    grade: (g?.trim() || '12') as Grade, points: 0
                });
            }
            alert("Đã nhập thành công!"); refreshData();
        };
        reader.readAsText(file);
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
    };

    const checkShortAnswer = (u: string | undefined, c: string | undefined) => {
        if (!u || !c) return false;
        return u.trim().toLowerCase() === c.trim().toLowerCase();
    };

    const exportToDoc = (quiz: Quiz) => {
        let content = `<html><head><meta charset="utf-8"><style>
          img { display: block; margin: 15px auto; max-width: 500px; height: auto; border: 1px solid #ddd; }
          body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 40px; }
          h1, h2, h3 { text-align: center; text-transform: uppercase; }
          .question { margin-top: 20px; font-weight: bold; }
          .options { margin-left: 30px; display: grid; grid-template-columns: 1fr 1fr; }
          .option-item { margin-bottom: 5px; }
          .footer { margin-top: 50px; text-align: center; font-style: italic; }
        </style></head><body>`;
        content += `<h3>SỞ GIÁO DỤC VÀ ĐÀO TẠO</h3>`;
        content += `<h1>${quiz.title}</h1>`;
        content += `<h3>Môn: Toán - Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</h3><hr/>`;
        
        const parts = [
            { title: 'PHẦN I. Câu trắc nghiệm nhiều lựa chọn', type: 'mcq' },
            { title: 'PHẦN II. Câu trắc nghiệm Đúng/Sai', type: 'group-tf' },
            { title: 'PHẦN III. Câu trắc nghiệm Trả lời ngắn', type: 'short' }
        ];

        parts.forEach(part => {
            const partQs = quiz.questions.filter(q => q.type === part.type);
            if (partQs.length > 0) {
                content += `<h2 style="text-align: left;">${part.title}</h2>`;
                partQs.forEach((q, idx) => {
                    content += `<div class="question">Câu ${idx + 1}. ${q.text}</div>`;
                    if (q.imageUrl) content += `<p style="text-align:center"><img src="${q.imageUrl}" width="400" /></p>`;
                    if (q.type === 'mcq' && q.options) {
                        content += `<div class="options">`;
                        q.options.forEach((opt, oi) => { content += `<div class="option-item">${String.fromCharCode(65+oi)}. ${opt}</div>`; });
                        content += `</div>`;
                    } else if (q.type === 'group-tf' && q.subQuestions) {
                        content += `<div style="margin-left: 20px;">`;
                        q.subQuestions.forEach((sq, si) => { content += `<p>${String.fromCharCode(97+si)}) ${sq.text}</p>`; });
                        content += `</div>`;
                    }
                });
            }
        });

        content += `<div class="footer">--- HẾT ---</div></body></html>`;
        const blob = new Blob([content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${quiz.title}.doc`;
        link.click();
    };

    const allBankQuestions = useMemo(() => {
        return quizzes.flatMap(qz => qz.questions.map(q => ({ ...q, quizTitle: qz.title, quizGrade: qz.grade })))
            .filter(q => (bGradeFilter === 'all' || q.quizGrade === bGradeFilter) && (bTypeFilter === 'all' || q.type === bTypeFilter) && q.text.toLowerCase().includes(bSearch.toLowerCase()));
    }, [quizzes, bGradeFilter, bTypeFilter, bSearch]);

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-[#f8fafc]">
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 sticky top-16 h-[calc(100vh-64px)] shadow-2xl z-20">
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {[
                        { id: 'quizzes', icon: ClipboardList, label: 'QUẢN LÝ ĐỀ THI' },
                        { id: 'students', icon: UsersIcon, label: 'QUẢN LÝ HỌC SINH' },
                        { id: 'results', icon: LayoutDashboard, label: 'BẢNG ĐIỂM TỔNG' },
                        { id: 'ai', icon: Sparkles, label: 'SOẠN ĐỀ BẰNG AI' },
                        { id: 'chapters', icon: FolderTree, label: 'QUẢN LÝ CHƯƠNG' },
                        { id: 'bank', icon: Database, label: 'NGÂN HÀNG CÂU HỎI' }
                    ].map(m => (
                        <button key={m.id} onClick={() => setActiveMenu(m.id as any)} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMenu === m.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}><m.icon size={16}/> {m.label}</button>
                    ))}
                    <div className="pt-6 border-t border-slate-800">
                        <button onClick={() => { setEditingId(null); setTitle(''); setQuestions([]); setActiveMenu('editor'); }} className="w-full flex items-center justify-center gap-2 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] shadow-xl hover:bg-blue-50 transition-all"><PlusCircle size={16}/> TẠO ĐỀ MỚI</button>
                    </div>
                </nav>
            </aside>

            <main className="flex-1 p-8 overflow-y-auto">
                {activeMenu === 'quizzes' && <QuizList quizzes={quizzes} results={results} chapters={chapters} onEdit={startEditQuiz} onDelete={id => confirm('Xóa đề?') && deleteQuiz(id).then(refreshData)} onPreview={setPreviewQuiz} qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter} qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter} />}
                {activeMenu === 'students' && <StudentManager students={users.filter(u => u.role === 'student')} sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter} onAdd={() => setStudentModal({isOpen: true, student: null})} onImportCsv={handleImportCsv} onViewDetail={setSelectedStudent} onEdit={u => { setSForm({fullName: u.fullName, studentCode: u.studentCode||'', grade: u.grade||'12', password: u.password}); setStudentModal({isOpen: true, student: u}); }} onDelete={(id, n) => confirm(`Xóa ${n}?`) && deleteUser(id).then(refreshData)} onResetPassword={u => confirm('Reset về 123?') && changePassword(u.id, '123').then(() => alert('Xong'))} />}
                {activeMenu === 'results' && <ResultsBoard results={results} quizzes={quizzes} users={users} chapters={chapters} rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter} rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter} rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter} onClearCache={() => confirm('Xóa cache?') && clearLocalCache()} onViewHistory={(n, c, t, h) => setHistoryModal({studentName: n, studentCode: c, quizTitle: t, history: h})} onDeleteResult={h => confirm('Xóa?') && Promise.all(h.map(x => deleteResult(x.id))).then(refreshData)} />}
                {activeMenu === 'editor' && <QuizEditor editingId={editingId} title={title} setTitle={setTitle} grade={grade} setGrade={setGrade} quizType={quizType} setQuizType={setQuizType} isPublished={isPublished} setIsPublished={setIsPublished} duration={duration} setDuration={setDuration} category={category} setCategory={setCategory} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSaveQuiz} onOpenBank={t => { setBGradeFilter(grade); setBTypeFilter(t); setActiveMenu('bank'); }} onPdfExtract={async e => { const f = e.target.files?.[0]; if(!f) return; setIsAiLoading(true); const r = new FileReader(); r.onload = async () => { const qs = await parseQuestionsFromPDF((r.result as string).split(',')[1]); setQuestions([...questions, ...qs]); setIsAiLoading(false); }; r.readAsDataURL(f); }} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? {...q, imageUrl: url} : q)); setUploadingId(null); }} uploadingId={uploadingId} />}
                {activeMenu === 'ai' && <AIRenderer grade={grade} setGrade={setGrade} isLoading={isAiLoading} onGenerate={async (p, p1, p2, p3) => { setIsAiLoading(true); try { const qs = await generateQuizFromPrompt({grade, topic: p, part1Count: p1, part2Count: p2, part3Count: p3}); setQuestions(qs); setTitle(`Đề AI: ${p}`); setActiveMenu('editor'); } finally { setIsAiLoading(false); } }} />}
                {activeMenu === 'chapters' && <ChapterManager chapters={chapters} onSave={c => saveChapter(c).then(refreshData)} onDelete={id => deleteChapter(id).then(refreshData)} />}
                {activeMenu === 'bank' && <QuestionBank questions={allBankQuestions} bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter} bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter} bSearch={bSearch} setBSearch={setBSearch} onCopy={q => { setQuestions([...questions, {...q, id: uuidv4()}]); setActiveMenu('editor'); alert('Đã thêm câu hỏi vào đề!'); }} />}

                {/* MODAL THÊM / SỬA HỌC SINH */}
                {studentModal.isOpen && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3rem] w-full max-w-md flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                                <div className="flex items-center gap-4"><div className="p-3 bg-blue-600 rounded-2xl"><UserPlus size={24}/></div><h3 className="text-lg font-black uppercase tracking-tight">{studentModal.student ? 'SỬA HỌC SINH' : 'THÊM HỌC SINH'}</h3></div>
                                <button onClick={() => setStudentModal({ isOpen: false, student: null })} className="p-3 hover:bg-red-600 rounded-xl transition-colors"><X/></button>
                            </div>
                            <div className="p-10 space-y-6">
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Họ và tên</label><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none" value={sForm.fullName} onChange={e => setSForm({...sForm, fullName: e.target.value})} /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mã học sinh</label><input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold uppercase" value={sForm.studentCode} onChange={e => setSForm({...sForm, studentCode: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Khối</label><select className="w-full p-4 bg-slate-50 border rounded-2xl font-black" value={sForm.grade} onChange={e => setSForm({...sForm, grade: e.target.value as Grade})}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select></div>
                                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mật khẩu</label><input type="password" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={sForm.password} onChange={e => setSForm({...sForm, password: e.target.value})} /></div>
                                </div>
                                <button onClick={handleSaveStudent} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl mt-4"><Save size={18}/> LƯU THÔNG TIN</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL CHI TIẾT HỌC SINH */}
                {selectedStudent && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                                <div className="flex items-center gap-5"><div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><UserCog size={32}/></div><div><h3 className="text-xl font-black uppercase tracking-tight">{selectedStudent.fullName}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">MAHS: {selectedStudent.studentCode}</p></div></div>
                                <button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-8">
                                {(() => {
                                    const sResults = results.filter(r => r.studentId === selectedStudent.id || r.studentCode === selectedStudent.studentCode);
                                    const totalQuizzes = sResults.length;
                                    const avgScore = totalQuizzes > 0 ? (sResults.reduce((acc, r) => acc + r.score, 0) / totalQuizzes) : 0;
                                    const totalTime = sResults.reduce((acc, r) => acc + r.durationSeconds, 0);
                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="bg-white rounded-[2rem] p-6 border shadow-sm flex items-center gap-4"><div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><BookOpen size={24}/></div><div><p className="text-slate-400 text-[9px] font-black uppercase">Bài hoàn thành</p><h4 className="text-xl font-black">{totalQuizzes} bài</h4></div></div>
                                            <div className="bg-white rounded-[2rem] p-6 border shadow-sm flex items-center gap-4"><div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Trophy size={24}/></div><div><p className="text-slate-400 text-[9px] font-black uppercase">Điểm trung bình</p><h4 className="text-xl font-black text-emerald-600">{avgScore.toFixed(2)}</h4></div></div>
                                            <div className="bg-white rounded-[2rem] p-6 border shadow-sm flex items-center gap-4"><div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center"><Clock size={24}/></div><div><p className="text-slate-400 text-[9px] font-black uppercase">Tổng TG luyện</p><h4 className="text-xl font-black text-orange-600">{formatTime(totalTime)}</h4></div></div>
                                        </div>
                                    );
                                })()}
                                <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-white border-b text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]"><th className="p-6">Đề thi</th><th className="p-6 text-center">Điểm số</th><th className="p-6 text-center">Ngày nộp</th><th className="p-6 text-center">Hành động</th></tr></thead>
                                        <tbody className="divide-y">
                                            {results.filter(r => r.studentId === selectedStudent.id || r.studentCode === selectedStudent.studentCode).sort((a,b)=>isAfter(parseISO(b.submittedAt), parseISO(a.submittedAt))?1:-1).map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50"><td className="p-6 font-bold text-sm text-slate-700 uppercase">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td><td className="p-6 text-center font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td><td className="p-6 text-center text-slate-400 text-[10px]">{format(parseISO(r.submittedAt), 'HH:mm dd/MM/yy')}</td><td className="p-6 text-center"><button onClick={() => setViewingResult(r)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye size={16}/></button></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL XEM CHI TIẾT BÀI LÀM */}
                {viewingResult && (
                    <div className="fixed inset-0 bg-slate-900/95 z-[2000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                                <div className="flex items-center gap-5"><div className="p-4 bg-emerald-600 rounded-[1.5rem]"><ListChecks size={28}/></div><div><h3 className="text-lg font-black uppercase tracking-tight">Review: {quizzes.find(q=>q.id===viewingResult.quizId)?.title || 'Đề đã xóa'}</h3><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">HỌC SINH: {viewingResult.studentName} ({viewingResult.studentCode}) • ĐIỂM: {viewingResult.score.toFixed(2)}</p></div></div>
                                <button onClick={() => setViewingResult(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                                <div className="max-w-4xl mx-auto space-y-12 pb-12">
                                    {(() => {
                                        const quiz = quizzes.find(q => q.id === viewingResult.quizId);
                                        if (!quiz) return <div className="text-center p-20 font-black text-slate-300 uppercase">Dữ liệu đề thi không còn tồn tại</div>;
                                        return quiz.questions.map((q, idx) => {
                                            const uAns = viewingResult.userAnswers?.[q.id];
                                            const isCorrect = q.type === 'mcq' ? (uAns === q.correctAnswer) : (q.type === 'short' ? checkShortAnswer(uAns, q.correctAnswer) : false);
                                            return (
                                                <div key={q.id} className="bg-white p-10 rounded-[2.5rem] border shadow-sm relative">
                                                    <div className={`absolute top-0 right-10 px-6 py-2 rounded-b-2xl font-black text-[10px] uppercase shadow-md ${isCorrect || q.type === 'group-tf' ? 'bg-emerald-600' : 'bg-red-500'} text-white`}>Câu {idx + 1}</div>
                                                    <div className="text-slate-800 text-lg font-bold mb-6 flex gap-4 leading-relaxed"><LatexText text={q.text}/></div>
                                                    {q.imageUrl && <div className="mb-6"><img src={q.imageUrl} className="max-h-[350px] mx-auto rounded-xl border" alt="question"/></div>}
                                                    {q.type === 'mcq' && q.options && (
                                                        <div className="space-y-3 pl-10">
                                                            {q.options.map((opt, oi) => {
                                                                const isSelected = uAns === opt;
                                                                const isCorrectOpt = q.correctAnswer === opt;
                                                                return <div key={oi} className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${isCorrectOpt ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold' : isSelected ? 'bg-red-50 border-red-300 text-red-500 line-through opacity-60' : 'bg-white text-slate-300 opacity-40'}`}><span className="font-black">{String.fromCharCode(65+oi)}.</span><LatexText text={opt}/>{isCorrectOpt && <Check size={16} className="ml-auto text-emerald-600"/>}</div>;
                                                            })}
                                                        </div>
                                                    )}
                                                    {q.type === 'group-tf' && q.subQuestions && (
                                                        <div className="space-y-3 pl-10">
                                                            {q.subQuestions.map((sq, si) => {
                                                                const sqKey = `${q.id}_${sq.id}`;
                                                                const sqUserAns = viewingResult.userAnswers?.[sqKey];
                                                                const sqCorrect = sqUserAns === sq.correctAnswer;
                                                                return <div key={si} className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${sqCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}><div className="flex-1 font-bold text-sm"><span className="text-blue-600 mr-2">{String.fromCharCode(97+si)})</span><LatexText text={sq.text}/></div><div className="flex gap-2">{['True', 'False'].map(v => <div key={v} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase border ${sq.correctAnswer === v ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : (sqUserAns === v ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-300 border-slate-100 opacity-40')}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</div>)}</div></div>;
                                                            })}
                                                        </div>
                                                    )}
                                                    {q.type === 'short' && (
                                                        <div className="pl-10 space-y-4">
                                                            <div className={`p-4 rounded-2xl border font-black text-sm ${isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-red-50 border-red-500 text-red-700'}`}><span className="text-slate-400 mr-2 uppercase text-[10px]">HS Trả lời:</span> {uAns || '(Trống)'}</div>
                                                            <div className="p-4 rounded-2xl border border-blue-500 bg-blue-50 font-black text-sm text-blue-700"><span className="text-slate-400 mr-2 uppercase text-[10px]">Đáp án chuẩn:</span> {q.correctAnswer}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL LỊCH SỬ THI CHI TIẾT (HISTORY) */}
                {historyModal && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><History size={32}/></div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase tracking-tight">{historyModal.studentName}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">MAHS: {historyModal.studentCode} • Đề: {historyModal.quizTitle}</p>
                                    </div>
                                </div>
                                <button onClick={() => setHistoryModal(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-8">
                                <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">
                                                <th className="p-6">STT</th>
                                                <th className="p-6">Thời gian nộp</th>
                                                <th className="p-6 text-center">Điểm số</th>
                                                <th className="p-6 text-center">Thời gian làm</th>
                                                <th className="p-6 text-center">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {historyModal.history.sort((a,b) => isAfter(parseISO(b.submittedAt), parseISO(a.submittedAt)) ? 1 : -1).map((h, idx) => (
                                                <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-6 text-slate-400 font-black">#{(historyModal.history.length - idx).toString().padStart(2, '0')}</td>
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                                                            <Clock size={14} className="text-slate-300"/>
                                                            {format(parseISO(h.submittedAt), 'HH:mm dd/MM/yyyy')}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <span className={`text-lg font-black ${h.score >= 8 ? 'text-emerald-600' : 'text-blue-600'}`}>{h.score.toFixed(2)}</span>
                                                    </td>
                                                    <td className="p-6 text-center font-bold text-slate-500 text-xs">
                                                        {Math.floor(h.durationSeconds / 60)}p {h.durationSeconds % 60}s
                                                    </td>
                                                    <td className="p-6 text-center">
                                                        <button onClick={() => setViewingResult(h)} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye size={16}/></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL XEM TRƯỚC ĐỀ THI (PREVIEW) */}
                {previewQuiz && (
                    <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-blue-600 rounded-2xl"><FileText size={28}/></div>
                                    <div>
                                        <h3 className="text-lg font-black uppercase tracking-tight leading-tight">{previewQuiz.title}</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">LỚP {previewQuiz.grade} • {previewQuiz.questions.length} CÂU HỎI</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => exportToDoc(previewQuiz)} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-xl">
                                        <Download size={16}/> XUẤT WORD
                                    </button>
                                    <button onClick={() => setPreviewQuiz(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                                <div className="max-w-3xl mx-auto space-y-12 pb-12">
                                    {['mcq', 'group-tf', 'short'].map((type) => {
                                        const typeQs = previewQuiz.questions.filter(q => q.type === type);
                                        if (typeQs.length === 0) return null;
                                        return (
                                            <div key={type} className="space-y-8">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-200 pb-2">
                                                    {type === 'mcq' ? 'PHẦN I. TRẮC NGHIỆM' : type === 'group-tf' ? 'PHẦN II. ĐÚNG/SAI' : 'PHẦN III. TRẢ LỜI NGẮN'}
                                                </h4>
                                                {typeQs.map((q, idx) => (
                                                    <div key={q.id} className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                                                        <div className="text-slate-800 text-lg font-bold mb-6 flex gap-4 leading-relaxed">
                                                            <span className="text-blue-600 shrink-0 font-black italic underline uppercase">Câu {idx + 1}.</span>
                                                            <LatexText text={q.text}/>
                                                        </div>
                                                        {q.imageUrl && <div className="mb-6 flex justify-center"><img src={q.imageUrl} className="max-h-[350px] mx-auto rounded-xl border" alt="question"/></div>}
                                                        {q.type === 'mcq' && q.options && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-10">
                                                                {q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium"><span className="text-slate-300 mr-2 font-black">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                                            </div>
                                                        )}
                                                        {q.type === 'group-tf' && q.subQuestions && (
                                                            <div className="space-y-4 pl-12">
                                                                {q.subQuestions.map((sq, si) => (
                                                                    <div key={si} className="text-sm font-medium text-slate-600 flex items-start gap-3">
                                                                        <span className="text-slate-400 font-black">{String.fromCharCode(97+si)})</span>
                                                                        <LatexText text={sq.text}/>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-8 bg-white border-t flex justify-center shrink-0"><button onClick={() => { startEditQuiz(previewQuiz!); setPreviewQuiz(null); }} className="px-12 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">SỬA ĐỀ NÀY</button></div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
