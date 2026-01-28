
import React, { useState, useEffect, useCallback } from 'react';
import { 
  getQuizzes, deleteQuiz, saveQuiz, updateQuiz, uploadQuizImage,
  getUsers, saveUser, deleteUser, changePassword,
  getResults, deleteResult,
  getChapters, saveChapter, deleteChapter,
  getBankQuestions, saveBankQuestion,
  clearLocalCache,
  isDatabaseConnected
} from '../../services/storage';
import { generateQuizFromPrompt, parseQuestionsFromPDF } from '../../services/gemini';
import { Quiz, User, Result, Chapter, Question, QuestionType, Grade, QuizType } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  LayoutDashboard, Users, BarChart3, ShieldAlert, Sparkles, FolderTree, 
  Plus, Database, Loader2, X 
} from 'lucide-react';

import QuizList from './QuizList';
import QuizEditor from './QuizEditor';
import StudentManager from './StudentManager';
import ResultsBoard from './ResultsBoard';
import ExamMonitor from './ExamMonitor';
import AIRenderer from './AIRenderer';
import ChapterManager from './ChapterManager';
import QuestionBank from './QuestionBank';

import StudentModal from './StudentModal';
import StudentDetailModal from './StudentDetailModal';
import ResultHistoryModal from './ResultHistoryModal';
import ResultDetailModal from './ResultDetailModal';
import QuizPreviewModal from './QuizPreviewModal';

type AdminTab = 'quizzes' | 'students' | 'results' | 'monitor' | 'ai' | 'chapters' | 'bank';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('quizzes');
  const [isLoading, setIsLoading] = useState(false);

  // Data
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);

  // Quiz Editing
  const [isEditingQuiz, setIsEditingQuiz] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizGrade, setQuizGrade] = useState<Grade>('12');
  const [quizType, setQuizType] = useState<QuizType>('test');
  const [isPublished, setIsPublished] = useState(false);
  const [isMonitored, setIsMonitored] = useState(false);
  const [duration, setDuration] = useState(45);
  const [category, setCategory] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Filters/Search
  const [qSearch, setQSearch] = useState('');
  const [qGradeFilter, setQGradeFilter] = useState<Grade | 'all'>('all');
  const [qChapterFilter, setQChapterFilter] = useState('all');
  const [sSearch, setSSearch] = useState('');
  const [sGradeFilter, setSGradeFilter] = useState<Grade | 'all'>('all');
  const [rGradeFilter, setRGradeFilter] = useState<Grade | 'all'>('all');
  const [rChapterFilter, setRChapterFilter] = useState('all');
  const [rQuizFilter, setRQuizFilter] = useState('all');
  const [bGradeFilter, setBGradeFilter] = useState<Grade | 'all'>('all');
  const [bTypeFilter, setBTypeFilter] = useState<QuestionType | 'all'>('all');
  const [bSearch, setBSearch] = useState('');

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentForm, setStudentForm] = useState({ fullName: '', studentCode: '', grade: '12' as Grade, password: '123' });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [historyData, setHistoryData] = useState<{ studentName: string, studentCode: string, quizTitle: string, history: Result[] } | null>(null);
  const [selectedResultDetail, setSelectedResultDetail] = useState<{ result: Result, quiz: Quiz } | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType | 'all'>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [q, u, r, c, b] = await Promise.all([
        getQuizzes(), getUsers(), getResults(), getChapters(), getBankQuestions()
      ]);
      setQuizzes(q);
      setStudents(u.filter(user => user.role === 'student'));
      setResults(r);
      setChapters(c);
      setBankQuestions(b);
    } catch (error) {
      console.error("Fetch data error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Quiz Handlers
  const handleCreateQuiz = () => {
    setEditingQuizId(null);
    setQuizTitle('');
    setQuizGrade('12');
    setQuizType('test');
    setIsPublished(false);
    setIsMonitored(false);
    setDuration(45);
    setCategory('');
    setStartTime('');
    setEndTime('');
    setQuestions([]);
    setIsEditingQuiz(true);
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setQuizTitle(quiz.title);
    setQuizGrade(quiz.grade);
    setQuizType(quiz.type);
    setIsPublished(quiz.isPublished);
    setIsMonitored(quiz.isMonitored || false);
    setDuration(quiz.durationMinutes);
    setCategory(quiz.category || '');
    setStartTime(quiz.startTime || '');
    setEndTime(quiz.endTime || '');
    setQuestions(quiz.questions);
    setIsEditingQuiz(true);
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle) return alert("Vui lòng nhập tiêu đề đề thi!");
    const quiz: Quiz = {
      id: editingQuizId || uuidv4(),
      title: quizTitle,
      grade: quizGrade,
      type: quizType,
      isPublished,
      isMonitored,
      durationMinutes: duration,
      category,
      startTime,
      endTime,
      questions,
      createdAt: new Date().toISOString(),
      description: ''
    };
    try {
      if (editingQuizId) await updateQuiz(quiz);
      else await saveQuiz(quiz);
      setIsEditingQuiz(false);
      fetchData();
    } catch (e) {
      alert("Lỗi lưu đề thi");
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("Xóa đề thi này?")) {
      await deleteQuiz(id);
      fetchData();
    }
  };

  const handlePdfExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let append = false;
    if (questions.length > 0) {
        const choice = confirm("Đề hiện tại đã có câu hỏi. Bạn muốn THAY THẾ TOÀN BỘ (OK) hay CHÈN THÊM VÀO CUỐI (Cancel)?");
        append = !choice;
    }

    setIsAiLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newQs = await parseQuestionsFromPDF(base64);
        if (append) setQuestions([...questions, ...newQs]);
        else setQuestions(newQs);
        setIsAiLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      alert(error.message);
      setIsAiLoading(false);
    }
  };

  const handleUploadImage = async (id: string, f: File) => {
    setUploadingId(id);
    const url = await uploadQuizImage(f);
    if (url) {
      setQuestions(questions.map(q => q.id === id ? { ...q, imageUrl: url } : q));
    } else {
      alert("Lỗi khi tải ảnh.");
    }
    setUploadingId(null);
  };

  const handleAiGenerate = async (p: string, p1: number, p2: number, p3: number, target: 'editor' | 'bank') => {
    setIsAiLoading(true);
    try {
      const newQs = await generateQuizFromPrompt({ topic: p, grade: quizGrade, part1Count: p1, part2Count: p2, part3Count: p3 });
      if (target === 'editor') {
        setQuestions([...questions, ...newQs]);
        setActiveTab('quizzes');
        setIsEditingQuiz(true);
      } else {
        for (const q of newQs) await saveBankQuestion({ ...q, quizTitle: 'AI Generated', quizGrade: quizGrade });
        fetchData();
        alert("Đã lưu vào ngân hàng câu hỏi!");
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Student Handlers
  // Fix: Added handleSaveStudent to correctly process user creation/updates in the student modal
  const handleSaveStudent = async () => {
    if (!studentForm.fullName || !studentForm.studentCode) {
      return alert("Vui lòng điền đủ Họ tên và MAHS!");
    }
    setIsSavingStudent(true);
    try {
      const newUser: User = {
        id: selectedStudent?.id || uuidv4(),
        username: studentForm.studentCode.toLowerCase().trim(),
        password: studentForm.password,
        role: 'student',
        fullName: studentForm.fullName,
        studentCode: studentForm.studentCode.trim().toUpperCase(),
        grade: studentForm.grade,
        points: selectedStudent?.points || 0
      };
      await saveUser(newUser);
      setIsStudentModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert("Lỗi lưu học sinh: " + (e as Error).message);
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Fix: Added handleDeleteStudent to remove student records from the database
  const handleDeleteStudent = async (id: string, name: string) => {
    if (confirm(`Xóa học sinh ${name}?`)) {
      try {
        await deleteUser(id);
        fetchData();
      } catch (e) {
        alert("Lỗi khi xóa học sinh");
      }
    }
  };

  // Fix: Added handleResetPassword to allow administrators to reset student passwords
  const handleResetPassword = async (user: User) => {
    const newPass = prompt(`Nhập mật khẩu mới cho ${user.fullName}:`, "123");
    if (newPass) {
      try {
        const success = await changePassword(user.id, newPass);
        if (success) {
          alert("Đổi mật khẩu thành công!");
          fetchData();
        } else {
          alert("Lỗi khi đổi mật khẩu.");
        }
      } catch (e) {
        alert("Lỗi kết nối.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-8 border-b border-white/10">
          <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 italic">
            <LayoutDashboard className="text-blue-500"/> EduQuiz <span className="text-blue-500">PRO</span>
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {[
            { id: 'quizzes', icon: LayoutDashboard, label: 'Đề thi' },
            { id: 'students', icon: Users, label: 'Học sinh' },
            { id: 'results', icon: BarChart3, label: 'Bảng điểm' },
            { id: 'monitor', icon: ShieldAlert, label: 'Giám sát' },
            { id: 'ai', icon: Sparkles, label: 'Soạn đề AI' },
            { id: 'chapters', icon: FolderTree, label: 'Chương học' },
            { id: 'bank', icon: Database, label: 'Ngân hàng' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as AdminTab); setIsEditingQuiz(false); }}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/50' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <tab.icon size={18}/> {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => clearLocalCache()} className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase text-red-400 hover:bg-red-400/10 transition-all">
             Xóa Cache & Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto custom-scrollbar">
        <div className="p-10">
          {activeTab === 'quizzes' && (
            isEditingQuiz ? (
              <QuizEditor
                editingId={editingQuizId}
                title={quizTitle} setTitle={setQuizTitle}
                grade={quizGrade} setGrade={setQuizGrade}
                quizType={quizType} setQuizType={setQuizType}
                isPublished={isPublished} setIsPublished={setIsPublished}
                isMonitored={isMonitored} setIsMonitored={setIsMonitored}
                duration={duration} setDuration={setDuration}
                category={category} setCategory={setCategory}
                startTime={startTime} setStartTime={setStartTime}
                endTime={endTime} setEndTime={setEndTime}
                questions={questions} setQuestions={setQuestions}
                chapters={chapters}
                onSave={handleSaveQuiz}
                onOpenBank={(type) => { 
                    setBankTargetType(type); 
                    setBGradeFilter(quizGrade); // Tự động lọc theo khối đang soạn
                    setIsBankOpen(true); 
                }}
                onPdfExtract={handlePdfExtract}
                onUploadImage={handleUploadImage}
                uploadingId={uploadingId}
                isAiLoading={isAiLoading}
              />
            ) : (
              <div className="space-y-10">
                <div className="flex justify-between items-center">
                   <h1 className="text-3xl font-black text-slate-800 uppercase italic">Quản lý Đề thi</h1>
                   <button onClick={handleCreateQuiz} className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-xl hover:bg-black transition-all">
                      <Plus size={20}/> Tạo đề thi mới
                   </button>
                </div>
                <QuizList 
                  quizzes={quizzes} results={results} chapters={chapters}
                  onEdit={handleEditQuiz} onDelete={handleDeleteQuiz} onPreview={setPreviewQuiz}
                  qSearch={qSearch} setQSearch={setQSearch}
                  qGradeFilter={qGradeFilter} setQGradeFilter={setQGradeFilter}
                  qChapterFilter={qChapterFilter} setQChapterFilter={setQChapterFilter}
                />
              </div>
            )
          )}

          {activeTab === 'students' && (
            <div className="space-y-10">
                <h1 className="text-3xl font-black text-slate-800 uppercase italic">Danh sách Học sinh</h1>
                <StudentManager 
                    students={students} results={results} quizzes={quizzes}
                    sSearch={sSearch} setSSearch={setSSearch}
                    sGradeFilter={sGradeFilter} setSGradeFilter={setSGradeFilter}
                    onAdd={() => { setSelectedStudent(null); setStudentForm({fullName: '', studentCode: '', grade: '12', password: '123'}); setIsStudentModalOpen(true); }}
                    onImportCsv={() => alert("Chức năng import CSV đang được nâng cấp!")}
                    onViewDetail={setViewingStudent}
                    onEdit={(u) => { setSelectedStudent(u); setStudentForm({fullName: u.fullName, studentCode: u.studentCode || '', grade: u.grade || '12', password: u.password}); setIsStudentModalOpen(true); }}
                    onDelete={handleDeleteStudent}
                    onResetPassword={handleResetPassword}
                />
            </div>
          )}

          {activeTab === 'results' && (
             <div className="space-y-10">
                <h1 className="text-3xl font-black text-slate-800 uppercase italic">Kết quả học tập</h1>
                <ResultsBoard 
                    results={results} quizzes={quizzes} users={students} chapters={chapters}
                    rGradeFilter={rGradeFilter} setRGradeFilter={setRGradeFilter}
                    rChapterFilter={rChapterFilter} setRChapterFilter={setRChapterFilter}
                    rQuizFilter={rQuizFilter} setRQuizFilter={setRQuizFilter}
                    onClearCache={clearLocalCache}
                    onViewHistory={(name, code, title, history) => setHistoryData({ studentName: name, studentCode: code, quizTitle: title, history })}
                    onDeleteResult={(history) => history.forEach(r => deleteResult(r.id).then(() => fetchData()))}
                />
             </div>
          )}

          {activeTab === 'monitor' && <ExamMonitor />}
          {activeTab === 'ai' && (
            <AIRenderer 
                grade={quizGrade} setGrade={setQuizGrade} 
                onGenerate={handleAiGenerate} isLoading={isAiLoading} 
                hasQuestionsInEditor={questions.length > 0} 
            />
          )}
          {activeTab === 'chapters' && (
            <ChapterManager chapters={chapters} onSave={async (c) => { await saveChapter(c); fetchData(); }} onDelete={async (id) => { await deleteChapter(id); fetchData(); }} />
          )}
          {activeTab === 'bank' && (
            <div className="space-y-10">
                <h1 className="text-3xl font-black text-slate-800 uppercase italic">Ngân hàng câu hỏi</h1>
                <QuestionBank 
                    questions={bankQuestions}
                    bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter}
                    bTypeFilter={bTypeFilter} setBTypeFilter={setBTypeFilter}
                    bSearch={bSearch} setBSearch={setBSearch}
                    onAddMultiple={(qs) => { alert(`Đã nạp ${qs.length} câu vào đề hiện tại!`); setQuestions([...questions, ...qs]); setActiveTab('quizzes'); setIsEditingQuiz(true); }}
                />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {isStudentModalOpen && <StudentModal isOpen={isStudentModalOpen} student={selectedStudent} form={studentForm} setForm={setStudentForm} onClose={() => setIsStudentModalOpen(false)} onSave={handleSaveStudent} isSaving={isSavingStudent} />}
      {viewingStudent && <StudentDetailModal student={viewingStudent} results={results} quizzes={quizzes} onClose={() => setViewingStudent(null)} onViewResult={(r) => setSelectedResultDetail({ result: r, quiz: quizzes.find(q => q.id === r.quizId)! })} />}
      {historyData && <ResultHistoryModal isOpen={true} {...historyData} onClose={() => setHistoryData(null)} onViewDetail={(r) => setSelectedResultDetail({ result: r, quiz: quizzes.find(q => q.id === r.quizId)! })} onDeleteOne={(r) => deleteResult(r.id).then(() => fetchData())} />}
      {selectedResultDetail && <ResultDetailModal isOpen={true} result={selectedResultDetail.result} quiz={selectedResultDetail.quiz} onClose={() => setSelectedResultDetail(null)} />}
      {previewQuiz && <QuizPreviewModal quiz={previewQuiz} onClose={() => setPreviewQuiz(null)} />}
      
      {/* Cập nhật Ngân hàng dạng Full-screen để bác duyệt đề rộng rãi - TỐI ƯU DIỆN TÍCH */}
      {isBankOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[2000] flex items-stretch justify-end animate-fade-in">
             <div className="bg-white w-full h-full flex flex-col overflow-hidden shadow-2xl animate-slide-in-right">
                <div className="px-6 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Database size={18}/></div>
                        <h3 className="text-sm font-black uppercase tracking-tight italic">Ngân hàng: {bankTargetType === 'all' ? 'Tất cả' : bankTargetType.toUpperCase()} - KHỐI {bGradeFilter}</h3>
                    </div>
                    <button onClick={() => setIsBankOpen(false)} className="px-4 py-2 bg-slate-800 rounded-xl hover:bg-red-600 transition-all flex items-center gap-2 group">
                        <span className="text-[10px] font-black uppercase">Đóng</span>
                        <X size={16}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
                    <div className="w-full">
                        <QuestionBank 
                            questions={bankQuestions}
                            bGradeFilter={bGradeFilter} setBGradeFilter={setBGradeFilter}
                            bTypeFilter={bankTargetType !== 'all' ? bankTargetType : bTypeFilter} 
                            setBTypeFilter={setBTypeFilter}
                            bSearch={bSearch} setBSearch={setBSearch}
                            onAddMultiple={(qs) => { setQuestions([...questions, ...qs]); setIsBankOpen(false); }}
                        />
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
