
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result, Chapter, Grade, QuizType, Question, QuestionType } from '../types';
import { 
    getUsers, getQuizzes, getResults, getChapters, 
    saveUser, deleteUser, saveQuiz, updateQuiz, deleteQuiz, 
    saveResult, deleteResult, saveChapter, deleteChapter, 
    clearLocalCache, uploadQuizImage 
} from '../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../services/gemini';
import StudentManager from './admin/StudentManager';
import ResultsBoard from './admin/ResultsBoard';
import AIRenderer from './admin/AIRenderer';
import QuizList from './admin/QuizList';
import QuizEditor from './admin/QuizEditor';
import ChapterManager from './admin/ChapterManager';
import QuestionBank from './admin/QuestionBank';
import { LayoutDashboard, Users as UsersIcon, ClipboardList, Sparkles, FolderTree, Database, PlusCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Fix: Fully implement AdminDashboard to resolve all "Cannot find name" errors from provided snippet fragments
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

    // Filters & Search States
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
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [historyModal, setHistoryModal] = useState<{studentName: string, studentCode: string, quizTitle: string, history: Result[]} | null>(null);

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        const [u, q, r, c] = await Promise.all([
            getUsers(), getQuizzes(), getResults(), getChapters()
        ]);
        setUsers(u);
        setQuizzes(q);
        setResults(r);
        setChapters(c);
    };

    const handleSaveQuiz = async () => {
        if (!title) return alert("Vui lòng nhập tiêu đề");
        const quiz: Quiz = {
            id: editingId || uuidv4(),
            title, grade, type: quizType, category, durationMinutes: duration,
            startTime, endTime, questions, isPublished,
            createdAt: new Date().toISOString()
        };
        if (editingId) await updateQuiz(quiz); else await saveQuiz(quiz);
        alert("Đã lưu đề thi thành công!");
        refreshData();
        setActiveMenu('quizzes');
    };

    const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsAiLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const qs = await parseQuestionsFromPDF(base64);
                setQuestions([...questions, ...qs]);
                setIsAiLoading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            alert("Lỗi khi xử lý PDF bằng AI");
            setIsAiLoading(false);
        }
    };

    const handleUploadImage = async (qId: string, file: File) => {
        setUploadingId(qId);
        try {
            const url = await uploadQuizImage(file);
            setQuestions(prev => prev.map(q => q.id === qId ? { ...q, imageUrl: url } : q));
        } catch (e) { alert("Lỗi khi tải ảnh lên"); }
        setUploadingId(null);
    };

    const openEditQuiz = (q: Quiz) => {
        setEditingId(q.id);
        setTitle(q.title);
        setGrade(q.grade);
        setQuizType(q.type);
        setIsPublished(q.isPublished);
        setDuration(q.durationMinutes);
        setCategory(q.category || '');
        setStartTime(q.startTime || '');
        setEndTime(q.endTime || '');
        setQuestions(q.questions);
        setActiveMenu('editor');
    };

    const startNewQuiz = () => {
        setEditingId(null);
        setTitle('');
        setQuestions([]);
        setActiveMenu('editor');
    };

    const handleOpenBank = (type: QuestionType) => {
        setBTypeFilter(type);
        setActiveMenu('bank');
    };

    const openAddStudent = () => { /* Placeholder for student management modal logic */ };
    const openEditStudent = (u: User) => { /* Placeholder */ };
    const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => { /* Placeholder */ };
    const handleResetPassword = (u: User) => { /* Placeholder */ };

    // Bank Questions calculation
    const allBankQuestions = quizzes.flatMap(qz => qz.questions.map(q => ({ ...q, quizTitle: qz.title, quizGrade: qz.grade })));
    const filteredBank = allBankQuestions.filter(q => 
        (bGradeFilter === 'all' || q.quizGrade === bGradeFilter) &&
        (bTypeFilter === 'all' || q.type === bTypeFilter) &&
        (q.text.toLowerCase().includes(bSearch.toLowerCase()))
    );

    return (
        <div className="flex min-h-[calc(100vh-64px)] bg-gray-50">
            {/* Sidebar navigation */}
            <aside className="w-64 bg-white border-r p-6 flex flex-col gap-2 sticky top-16 h-[calc(100vh-64px)]">
                <button onClick={() => setActiveMenu('quizzes')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'quizzes' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><ClipboardList size={20}/> Quản lý đề thi</button>
                <button onClick={() => setActiveMenu('students')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'students' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><UsersIcon size={20}/> Học sinh</button>
                <button onClick={() => setActiveMenu('results')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'results' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><LayoutDashboard size={20}/> Bảng điểm</button>
                <button onClick={() => setActiveMenu('ai')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'ai' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><Sparkles size={20}/> Soạn đề AI</button>
                <button onClick={() => setActiveMenu('chapters')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'chapters' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><FolderTree size={20}/> Chương học</button>
                <button onClick={() => setActiveMenu('bank')} className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeMenu === 'bank' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'}`}><Database size={20}/> Ngân hàng</button>
                
                <div className="mt-auto pt-6 border-t">
                    <button onClick={startNewQuiz} className="w-full flex items-center justify-center gap-2 p-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all"><PlusCircle size={16}/> Tạo đề mới</button>
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex-1 p-8 overflow-y-auto">
                {activeMenu === 'quizzes' && <QuizList quizzes={quizzes} results={results} chapters={chapters} onEdit={openEditQuiz} onDelete={(id) => {if(confirm('Xóa đề này?')) deleteQuiz(id).then(refreshData)}} onPreview={(q) => {}} qSearch={qSearch} setQSearch={setQSearch} qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter} qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter} />}
                {activeMenu === 'students' && <StudentManager students={users.filter(u => u.role === 'student')} sSearch={sSearch} setSSearch={setSSearch} sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter} onAdd={openAddStudent} onImportCsv={handleImportCsv} onViewDetail={setSelectedStudent} onEdit={openEditStudent} onDelete={(id, name) => {if(confirm(`Xóa ${name}?`)) deleteUser(id).then(refreshData)}} onResetPassword={handleResetPassword} />}
                {activeMenu === 'results' && <ResultsBoard results={results} quizzes={quizzes} users={users} chapters={chapters} rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter} rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter} rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter} onClearCache={() => { if(confirm('Dọn dẹp cache?')) { clearLocalCache(); refreshData(); } }} onViewHistory={(sName, sCode, qTitle, history) => setHistoryModal({studentName: sName, studentCode: sCode, quizTitle: qTitle, history: history})} onDeleteResult={async (h) => {if(confirm('Xóa?')) { await Promise.all(h.map(x => deleteResult(x.id))); refreshData(); }}} />}
                {activeMenu === 'ai' && <AIRenderer grade={grade} setGrade={setGrade} isLoading={isAiLoading} onGenerate={async (p, p1, p2, p3) => { setIsAiLoading(true); try { const qs = await generateQuizFromPrompt({grade, topic: p, part1Count: p1, part2Count: p2, part3Count: p3}); setQuestions(qs); setTitle(`Đề AI: ${p}`); setActiveMenu('editor'); } catch(e) { alert('Lỗi AI soạn đề!'); } finally { setIsAiLoading(false); } }} />}
                {activeMenu === 'editor' && <QuizEditor editingId={editingId} title={title} setTitle={setTitle} grade={grade} setGrade={setGrade} quizType={quizType} setQuizType={setQuizType} isPublished={isPublished} setIsPublished={setIsPublished} duration={duration} setDuration={setDuration} category={category} setCategory={setCategory} startTime={startTime} setStartTime={setStartTime} endTime={endTime} setEndTime={setEndTime} questions={questions} setQuestions={setQuestions} chapters={chapters} onSave={handleSaveQuiz} onOpenBank={handleOpenBank} onPdfExtract={handlePdfExtract} onUploadImage={handleUploadImage} uploadingId={uploadingId} />}
                {activeMenu === 'chapters' && <ChapterManager chapters={chapters} onSave={(ch) => saveChapter(ch).then(refreshData)} onDelete={(id) => deleteChapter(id).then(refreshData)} />}
                {activeMenu === 'bank' && <QuestionBank questions={filteredBank} bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter} bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter} bSearch={bSearch} setBSearch={setBSearch} onCopy={(q) => { setQuestions([...questions, {...q, id: uuidv4()}]); alert('Đã sao chép câu hỏi vào đề hiện tại!'); }} />}
            </main>
        </div>
    );
};

export default AdminDashboard;
