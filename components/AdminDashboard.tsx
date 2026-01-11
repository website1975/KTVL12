
import React, { useState, useEffect, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, Result, User, Chapter, QuizType } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    getUsers, getChapters, saveChapter, deleteChapter, uploadQuizImage, deleteResult, deleteUser, saveUser, changePassword, clearLocalCache
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { LayoutDashboard, Database, Plus, Sparkles, BarChart3, Users, FolderTree, Cpu, History, UserCog, Clock, X, FileText, ListChecks, Download } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';

// Import sub-components
import QuizList from './admin/QuizList';
import QuizEditor from './admin/QuizEditor';
import QuestionBank from './admin/QuestionBank';
import StudentManager from './admin/StudentManager';
import ResultsBoard from './admin/ResultsBoard';
import AIRenderer from './admin/AIRenderer';
import ChapterManager from './admin/ChapterManager';
import LatexText from './LatexText';

const AdminDashboard = () => {
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'editor' | 'ai' | 'results' | 'students' | 'chapters' | 'bank'>('quizzes');
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);

    // Shared editor state
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

    // Shared UI state
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
    const [historyModal, setHistoryModal] = useState<{ studentName: string, quizTitle: string, history: Result[] } | null>(null);

    // Filters
    const [qSearch, setQSearch] = useState('');
    const [qGradeFilter, setQGradeFilter] = useState<Grade | 'all'>('all');
    const [qChapterFilter, setQChapterFilter] = useState('all');
    const [bSearch, setBSearch] = useState('');
    const [bGradeFilter, setBGradeFilter] = useState<Grade | 'all'>('all');
    const [bTypeFilter, setBTypeFilter] = useState<QuestionType | 'all'>('all');
    const [sSearch, setSSearch] = useState('');
    const [sGradeFilter, setSGradeFilter] = useState<Grade | 'all'>('all');
    const [rGradeFilter, setRGradeFilter] = useState<Grade | 'all'>('all');
    const [rChapterFilter, setRChapterFilter] = useState('all');
    const [rQuizFilter, setRQuizFilter] = useState('all');

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [qs, rs, us, chs] = await Promise.all([getQuizzes(), getResults(), getUsers(), getChapters()]);
        setQuizzes(qs); setResults(rs); setUsers(us); setChapters(chs);
    };

    const handleSave = async () => {
        if (!title) return alert("Nhập tên đề!");
        const data: Quiz = { 
          id: editingId || uuidv4(), title, description: '', type: quizType, grade, durationMinutes: duration, 
          questions, isPublished, createdAt: new Date().toISOString(), category, 
          startTime: quizType === 'test' ? startTime : undefined, 
          endTime: quizType === 'practice' ? endTime : undefined 
        };
        if (editingId) await updateQuiz(data); else await saveQuiz(data);
        alert("Lưu thành công!"); setActiveMenu('quizzes'); await refreshData();
    };

    const startEdit = (q: Quiz) => {
        setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setQuizType(q.type);
        setIsPublished(q.isPublished); setDuration(q.durationMinutes); setQuestions(q.questions);
        setCategory(q.category || ''); 
        setStartTime(q.startTime || '');
        setEndTime(q.endTime || '');
        setActiveMenu('editor');
    };

    const exportToDoc = (quiz: Quiz) => {
        let content = `<html><head><meta charset="utf-8"><style>
          img { display: block; margin: 15px auto; max-width: 500px; height: auto; border: 1px solid #ddd; }
          body { font-family: 'Times New Roman', serif; line-height: 1.6; }
          h1, h2, h3 { text-align: center; }
          .question { margin-top: 20px; font-weight: bold; }
          .options { margin-left: 30px; }
        </style></head><body>`;
        content += `<h1>${quiz.title}</h1>`;
        content += `<h3>Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</h3><hr/>`;
        
        const parts = [
            { title: 'PHẦN I. Câu trắc nghiệm nhiều lựa chọn', type: 'mcq' },
            { title: 'PHẦN II. Câu trắc nghiệm Đúng/Sai', type: 'group-tf' },
            { title: 'PHẦN III. Câu trắc nghiệm Trả lời ngắn', type: 'short' }
        ];

        parts.forEach(part => {
            const partQs = quiz.questions.filter(q => q.type === part.type);
            if (partQs.length > 0) {
                content += `<h2>${part.title}</h2>`;
                partQs.forEach((q, idx) => {
                    content += `<div class="question">Câu ${idx + 1}. ${q.text}</div>`;
                    
                    if (q.imageUrl) {
                        content += `<p style="text-align:center"><img src="${q.imageUrl}" width="400" /></p>`;
                    }

                    if (q.type === 'mcq' && q.options) {
                        content += `<div class="options">`;
                        q.options.forEach((opt, oi) => {
                            content += `<p>${String.fromCharCode(65+oi)}. ${opt}</p>`;
                        });
                        content += `</div>`;
                    } else if (q.type === 'group-tf' && q.subQuestions) {
                        content += `<div class="options">`;
                        q.subQuestions.forEach((sq, si) => {
                            content += `<p>${String.fromCharCode(97+si)}) ${sq.text}</p>`;
                        });
                        content += `</div>`;
                    }
                });
            }
        });

        content += `</body></html>`;
        const blob = new Blob([content], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${quiz.title}.doc`;
        link.click();
    };

    const allBankQuestions = useMemo(() => {
        let all: (Question & { quizTitle: string, quizGrade: Grade })[] = [];
        quizzes.forEach(q => q.questions.forEach(qu => all.push({ ...qu, quizTitle: q.title, quizGrade: q.grade })));
        return all.filter((v, i, a) => a.findIndex(t => t.text === v.text) === i)
                  .filter(q => (bGradeFilter === 'all' || q.quizGrade === bGradeFilter) && (bTypeFilter === 'all' || q.type === bTypeFilter) && q.text.toLowerCase().includes(bSearch.toLowerCase()));
    }, [quizzes, bGradeFilter, bTypeFilter, bSearch]);

    return (
        <div className="flex h-screen bg-[#f8fafc] overflow-hidden text-slate-700 font-sans">
            <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 z-20 shadow-2xl">
                <div className="p-8 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg"><Cpu size={18}/></div>
                    <span className="font-black text-[11px] uppercase italic">EduQuiz Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {[
                        { id: 'quizzes', icon: LayoutDashboard, label: 'QUẢN LÝ ĐỀ THI' },
                        { id: 'bank', icon: Database, label: 'NGÂN HÀNG CÂU HỎI' },
                        { id: 'editor', icon: Plus, label: 'SOẠN / CHỈNH ĐỀ', action: () => { setEditingId(null); setTitle(''); setQuestions([]); setStartTime(''); setEndTime(''); setCategory(''); } },
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
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{activeMenu.toUpperCase()}</h2>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
                    {activeMenu === 'quizzes' && <QuizList quizzes={quizzes} results={results} chapters={chapters} onEdit={startEdit} onDelete={id => {if(confirm('Xóa đề?')) deleteQuiz(id).then(refreshData)}} onPreview={setPreviewQuiz} qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter} qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter} />}
                    {activeMenu === 'bank' && <QuestionBank questions={allBankQuestions} bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter} bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter} bSearch={bSearch} setBSearch={setBSearch} onCopy={q => {setQuestions([...questions, {...q, id: uuidv4()}]); setActiveMenu('editor'); alert('Đã chép!');}} />}
                    {activeMenu === 'editor' && <QuizEditor editingId={editingId} title={title} setTitle={setTitle} grade={grade} setGrade={setGrade} quizType={quizType} setQuizType={setQuizType} isPublished={isPublished} setIsPublished={setIsPublished} duration={duration} setDuration={setDuration} category={category} setCategory={setCategory} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSave} onOpenBank={type => { setActiveMenu('bank'); setBTypeFilter(type); }} onPdfExtract={async (e) => { const file = e.target.files?.[0]; if(!file) return; setIsAiLoading(true); const reader = new FileReader(); reader.onload = async () => { const newQs = await parseQuestionsFromPDF((reader.result as string).split(',')[1]); setQuestions([...questions, ...newQs]); setIsAiLoading(false); }; reader.readAsDataURL(file); }} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? {...q, imageUrl: url} : q)); setUploadingId(null); }} uploadingId={uploadingId} />}
                    {activeMenu === 'students' && <StudentManager students={users.filter(u => u.role === 'student')} sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter} onAdd={() => {}} onViewDetail={setSelectedStudent} onDelete={(id, name) => {if(confirm(`Xóa ${name}?`)) deleteUser(id).then(refreshData)}} />}
                    {activeMenu === 'results' && <ResultsBoard results={results} quizzes={quizzes} chapters={chapters} rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter} rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter} rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter} onClearCache={() => { if(confirm('Dọn dẹp cache?')) { clearLocalCache(); refreshData(); } }} onViewHistory={(s, q, h) => setHistoryModal({studentName: s, quizTitle: q, history: h})} onDeleteResult={async (h) => {if(confirm('Xóa?')) { await Promise.all(h.map(x => deleteResult(x.id))); refreshData(); }}} />}
                    {activeMenu === 'ai' && <AIRenderer grade={grade} setGrade={setGrade} isLoading={isAiLoading} onGenerate={async (p, p1, p2, p3) => { setIsAiLoading(true); try { const qs = await generateQuizFromPrompt({grade, topic: p, part1Count: p1, part2Count: p2, part3Count: p3}); setQuestions(qs); setTitle(`Đề AI: ${p}`); setActiveMenu('editor'); } catch(e) { alert('Lỗi AI!'); } finally { setIsAiLoading(false); } }} />}
                    {activeMenu === 'chapters' && <ChapterManager chapters={chapters} onSave={async ch => { await saveChapter(ch); refreshData(); }} onDelete={async id => { if(confirm('Xóa?')) { await deleteChapter(id); refreshData(); } }} />}
                </div>

                {selectedStudent && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
                            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-xl"><UserCog size={32}/></div>
                                    <div><h3 className="text-xl font-black uppercase tracking-tight">{selectedStudent.fullName}</h3><p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">MAHS: {selectedStudent.studentCode}</p></div>
                                </div>
                                <button onClick={() => setSelectedStudent(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 bg-slate-50 space-y-8">
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                                    <div className="p-6 bg-slate-50 border-b flex items-center gap-3"><Clock size={18} className="text-slate-400"/><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Lịch sử thi cử</span></div>
                                    <table className="w-full text-left">
                                        <thead><tr className="bg-white border-b text-[8px] font-black uppercase text-slate-300 tracking-[0.2em]"><th className="p-6">Đề thi</th><th className="p-6 text-center">Điểm số</th><th className="p-6 text-center">Ngày nộp</th></tr></thead>
                                        <tbody className="divide-y">
                                          {results.filter(r => r.studentCode === selectedStudent.studentCode).sort((a,b)=>isAfter(parseISO(b.submittedAt), parseISO(a.submittedAt))?1:-1).map(r => (
                                              <tr key={r.id} className="hover:bg-slate-50">
                                                  <td className="p-6 font-bold text-sm text-slate-700 uppercase">{quizzes.find(q=>q.id===r.quizId)?.title || 'Đề đã xóa'}</td>
                                                  <td className="p-6 text-center font-black text-blue-600 text-sm">{r.score.toFixed(2)}</td>
                                                  <td className="p-6 text-center text-slate-400 text-[10px]">{format(parseISO(r.submittedAt), 'HH:mm dd/MM/yy')}</td>
                                              </tr>
                                          ))}
                                          {results.filter(r => r.studentCode === selectedStudent.studentCode).length === 0 && (
                                              <tr><td colSpan={3} className="p-10 text-center text-xs text-slate-300 italic">Chưa có dữ liệu thi cử</td></tr>
                                          )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {previewQuiz && (
                    <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
                        <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white animate-fade-in-up shadow-2xl">
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
                                        <Download size={16}/> TẢI WORD
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
                                                        {q.imageUrl && <div className="mb-6"><img src={q.imageUrl} className="max-h-[350px] mx-auto rounded-xl border" alt="question"/></div>}
                                                        {q.type === 'mcq' && q.options && (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-10">
                                                                {q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium"><span className="text-slate-300 mr-2 font-black">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="p-8 bg-white border-t flex justify-center shrink-0"><button onClick={() => { startEdit(previewQuiz!); setPreviewQuiz(null); }} className="px-12 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-2xl hover:scale-105 transition-all">SỬA ĐỀ NÀY</button></div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
