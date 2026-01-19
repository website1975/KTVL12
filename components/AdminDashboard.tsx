
import React, { useState, useEffect, useMemo } from 'react';
import { User, Quiz, Result, Chapter, Grade, QuizType, Question, QuestionType } from '../types';
import { 
    getUsers, getQuizzes, getResults, getChapters, 
    saveUser, deleteUser, saveQuiz, updateQuiz, deleteQuiz, 
    deleteResult, saveChapter, deleteChapter, 
    clearLocalCache, uploadQuizImage, changePassword,
    getBankQuestions, saveBankQuestion
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import StudentManager from './admin/StudentManager';
import ResultsBoard from './admin/ResultsBoard';
import AIRenderer from './admin/AIRenderer';
import QuizList from './admin/QuizList';
import QuizEditor from './admin/QuizEditor';
import ChapterManager from './admin/ChapterManager';
import QuestionBank from './admin/QuestionBank';
import StudentModal from './admin/StudentModal';
import StudentDetailModal from './admin/StudentDetailModal';
import { 
    Users as UsersIcon, ClipboardList, Sparkles, FolderTree, 
    Database, PlusCircle, LayoutDashboard
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const AdminDashboard: React.FC = () => {
    // --- QUẢN LÝ MENU ---
    const [activeMenu, setActiveMenu] = useState<'quizzes' | 'students' | 'results' | 'ai' | 'editor' | 'chapters' | 'bank'>('quizzes');
    
    // --- DỮ LIỆU TỔNG ---
    const [users, setUsers] = useState<User[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [standaloneBank, setStandaloneBank] = useState<Question[]>([]);
    
    // --- TRẠNG THÁI EDITOR ---
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

    // --- TRẠNG THÁI BỘ LỌC ---
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

    // --- TRẠNG THÁI MODALS ---
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [studentModal, setStudentModal] = useState<{ isOpen: boolean, student: User | null }>({ isOpen: false, student: null });
    const [sForm, setSForm] = useState({ fullName: '', studentCode: '', grade: '12' as Grade, password: '123' });
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

    useEffect(() => { refreshData(); }, []);

    const refreshData = async () => {
        const [u, q, r, c, b] = await Promise.all([
            getUsers(), getQuizzes(), getResults(), getChapters(), getBankQuestions()
        ]);
        setUsers(u); setQuizzes(q); setResults(r); setChapters(c); setStandaloneBank(b);
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

    const handleSaveStudent = async () => {
        if (!sForm.fullName || !sForm.studentCode) return alert("Vui lòng nhập đủ thông tin!");
        await saveUser({
            id: studentModal.student?.id || uuidv4(), username: sForm.studentCode.toLowerCase(),
            password: sForm.password || '123', role: 'student', fullName: sForm.fullName,
            studentCode: sForm.studentCode.toUpperCase(), grade: sForm.grade,
            points: studentModal.student?.points || 0
        });
        setStudentModal({ isOpen: false, student: null });
        refreshData();
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
            for (let i = 0; i < lines.length; i++) {
                const row = lines[i].split(',').map(item => item.trim());
                if (row.length < 2) continue;
                const [code, name, g, p] = row;
                if (i === 0 && (code.toLowerCase().includes('mã') || name.toLowerCase().includes('tên'))) continue;
                if (!code || !name) continue;
                await saveUser({
                    id: uuidv4(), username: code.toLowerCase(), password: p || '123',
                    role: 'student', fullName: name, studentCode: code.toUpperCase(),
                    grade: (g || '12') as Grade, points: 0
                });
            }
            alert(`Nhập dữ liệu thành công!`); 
            refreshData();
        };
        reader.readAsText(file);
    };

    // --- XỬ LÝ SOẠN ĐỀ AI ---
    const handleAiGenerate = async (p: string, p1: number, p2: number, p3: number, target: 'editor' | 'bank') => {
        setIsAiLoading(true);
        try {
            const qs = await generateQuizFromPrompt({grade, topic: p, part1Count: p1, part2Count: p2, part3Count: p3});
            
            if (target === 'bank') {
                for (const q of qs) {
                    const questionWithMeta: Question = { 
                        ...q, 
                        quizTitle: 'NGÂN HÀNG AI', 
                        quizGrade: grade 
                    };
                    await saveBankQuestion(questionWithMeta);
                }
                alert(`Đã lưu ${qs.length} câu hỏi vào Ngân hàng thành công!`);
                await refreshData();
                setActiveMenu('bank');
            } else {
                setQuestions(qs);
                setTitle(`Đề AI: ${p}`);
                setActiveMenu('editor');
            }
        } catch (error) {
            alert("Lỗi khi soạn đề bằng AI");
        } finally {
            setIsAiLoading(false);
        }
    };

    // --- GỘP NGÂN HÀNG CÂU HỎI ---
    const allBankQuestions = useMemo(() => {
        const fromQuizzes = quizzes.flatMap(qz => qz.questions.map(q => ({ 
            ...q, 
            quizTitle: qz.title, 
            quizGrade: qz.grade 
        })));
        
        const fromStandalone = standaloneBank.map(q => ({
            ...q,
            quizTitle: q.quizTitle || 'CÂU HỎI TỰ DO',
            quizGrade: q.quizGrade || 'all'
        }));

        return [...fromStandalone, ...fromQuizzes] as Question[];
    }, [quizzes, standaloneBank]);

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
                {activeMenu === 'quizzes' && <QuizList quizzes={quizzes} results={results} chapters={chapters} onEdit={q => { setEditingId(q.id); setTitle(q.title); setGrade(q.grade); setQuizType(q.type); setIsPublished(q.isPublished); setDuration(q.durationMinutes); setQuestions(q.questions); setCategory(q.category || ''); setStartTime(q.startTime || ''); setEndTime(q.endTime || ''); setActiveMenu('editor'); }} onDelete={id => confirm('Xóa đề?') && deleteQuiz(id).then(refreshData)} onPreview={setPreviewQuiz} qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter} qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter} />}
                {activeMenu === 'students' && <StudentManager students={users.filter(u => u.role === 'student')} results={results} quizzes={quizzes} sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter} onAdd={() => { setSForm({fullName: '', studentCode: '', grade: '12', password: '123'}); setStudentModal({isOpen: true, student: null}); }} onImportCsv={handleImportCsv} onViewDetail={setSelectedStudent} onEdit={u => { setSForm({fullName: u.fullName, studentCode: u.studentCode||'', grade: u.grade||'12', password: u.password}); setStudentModal({isOpen: true, student: u}); }} onDelete={(id, n) => confirm(`Xóa ${n}?`) && deleteUser(id).then(refreshData)} onResetPassword={u => confirm('Reset về 123?') && changePassword(u.id, '123').then(() => alert('Xong'))} />}
                {activeMenu === 'results' && <ResultsBoard results={results} quizzes={quizzes} users={users} chapters={chapters} rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter} rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter} rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter} onClearCache={clearLocalCache} onViewHistory={()=>{}} onDeleteResult={h => confirm('Xóa?') && Promise.all(h.map(x => deleteResult(x.id))).then(refreshData)} />}
                {activeMenu === 'editor' && <QuizEditor editingId={editingId} title={title} setTitle={setTitle} grade={grade} setGrade={setGrade} quizType={quizType} setQuizType={setQuizType} isPublished={isPublished} setIsPublished={setIsPublished} duration={duration} setDuration={setDuration} category={category} setCategory={setCategory} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSaveQuiz} onOpenBank={t => { setBGradeFilter(grade); setBTypeFilter(t); setActiveMenu('bank'); }} onPdfExtract={async e => { const f = e.target.files?.[0]; if(!f) return; setIsAiLoading(true); const r = new FileReader(); r.onload = async () => { const qs = await parseQuestionsFromPDF((r.result as string).split(',')[1]); setQuestions([...questions, ...qs]); setIsAiLoading(false); }; r.readAsDataURL(f); }} onUploadImage={async (id, f) => { setUploadingId(id); const url = await uploadQuizImage(f); setQuestions(questions.map(q => q.id === id ? {...q, imageUrl: url} : q)); setUploadingId(null); }} uploadingId={uploadingId} />}
                {activeMenu === 'ai' && <AIRenderer grade={grade} setGrade={setGrade} isLoading={isAiLoading} onGenerate={handleAiGenerate} />}
                {activeMenu === 'chapters' && <ChapterManager chapters={chapters} onSave={c => saveChapter(c).then(refreshData)} onDelete={id => deleteChapter(id).then(refreshData)} />}
                {activeMenu === 'bank' && <QuestionBank questions={allBankQuestions.filter(q => (bGradeFilter === 'all' || q.quizGrade === bGradeFilter) && (bTypeFilter === 'all' || q.type === bTypeFilter) && q.text.toLowerCase().includes(bSearch.toLowerCase()))} bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter} bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter} bSearch={bSearch} setBSearch={setBSearch} onCopy={q => { setQuestions([...questions, {...q, id: uuidv4()}]); setActiveMenu('editor'); alert('Đã thêm!'); }} />}

                <StudentModal isOpen={studentModal.isOpen} student={studentModal.student} form={sForm} setForm={setSForm} onClose={() => setStudentModal({isOpen:false, student:null})} onSave={handleSaveStudent} />
                <StudentDetailModal student={selectedStudent} results={results} quizzes={quizzes} onClose={() => setSelectedStudent(null)} onViewResult={()=>{}} />
            </main>
        </div>
    );
};

export default AdminDashboard;
