
import React, { useState, useEffect } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, SubQuestion, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { generateQuestions, parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Sparkles, Save, List, Upload, FileText, Image as ImageIcon, BarChart3, Eye, Edit, Calendar, Clock, CheckCircle, XCircle, Filter, History, Search, BookOpen, GraduationCap, Lightbulb, Users, UserPlus, Key } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // List Filter State (NEW)
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');

  // Result Filter State
  const [resultFilterGrade, setResultFilterGrade] = useState<Grade | 'all'>('all');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');

  // Create/Edit Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('10');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  // Generator & Import State
  const [genTopic, setGenTopic] = useState('');
  const [genCount, setGenCount] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Detail Modal State
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  
  // Result History Modal State
  const [viewHistoryData, setViewHistoryData] = useState<{ studentName: string, quizTitle: string, items: Result[] } | null>(null);

  // Student Management State
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
      fullName: '',
      username: '',
      password: '',
      grade: '10' as Grade,
      role: 'student' as Role
  });

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    // Supabase calls are async
    const qData = await getQuizzes();
    setQuizzes(qData);
    
    const rData = await getResults();
    setResults(rData);

    if (activeTab === 'students') {
        const uData = await getUsers();
        setUsers(uData);
    }
  };

  const handleSaveQuiz = async () => {
    // 1. Validation
    if (!title.trim()) {
      alert("Vui lòng nhập tên đề thi.");
      return;
    }
    if (questions.length === 0) {
      alert("Đề thi cần ít nhất 1 câu hỏi.");
      return;
    }
    if (quizType === 'test' && !startTime) {
      alert("Bài kiểm tra bắt buộc phải có 'Thời gian bắt đầu'.");
      return;
    }

    // 2. Clean Data
    const cleanQuestions = questions.map(q => ({
        ...q,
        points: typeof q.points === 'string' 
            ? parseFloat(q.points.replace(',', '.')) || 0 
            : q.points
    }));

    // 3. Construct Quiz Object
    const quizData: Quiz = {
      id: editingId || uuidv4(),
      title,
      description,
      type: quizType,
      grade,
      startTime: quizType === 'test' ? startTime : undefined,
      durationMinutes: duration,
      questions: cleanQuestions,
      createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      isPublished: isPublished
    };

    // 4. Save or Update (Async)
    if (editingId) {
      await updateQuiz(quizData);
    } else {
      await saveQuiz(quizData);
    }

    // 5. Redirect immediately
    await refreshData();
    setActiveTab('list');
    resetForm();
  };

  const handleTogglePublish = async (quiz: Quiz) => {
    const updated = { ...quiz, isPublished: !quiz.isPublished };
    await updateQuiz(updated);
    refreshData();
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingId(quiz.id);
    setTitle(quiz.title);
    setDescription(quiz.description);
    setQuizType(quiz.type);
    setGrade(quiz.grade);
    setStartTime(quiz.startTime || '');
    setDuration(quiz.durationMinutes);
    setQuestions(quiz.questions);
    setIsPublished(quiz.isPublished);
    setActiveTab('create');
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setQuestions([]);
    setStartTime('');
    setDuration(30);
    setFile(null);
    setIsPublished(false);
  };

  const handleGenerateAI = async () => {
    setIsProcessing(true);
    try {
      const newQuestions = await generateQuestions(genTopic, grade, genCount, 'Medium');
      setQuestions([...questions, ...newQuestions]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async () => {
      if (!file) return;
      setIsProcessing(true);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
          const base64Str = (reader.result as string).split(',')[1];
          try {
              const extractedQuestions = await parseQuestionsFromPDF(base64Str);
              setQuestions([...questions, ...extractedQuestions]);
              alert(`Đã trích xuất thành công ${extractedQuestions.length} câu hỏi!`);
              setActiveTab('create');
          } catch (e: any) {
              alert(e.message);
          } finally {
              setIsProcessing(false);
          }
      };
      reader.onerror = () => {
          alert("Lỗi đọc file");
          setIsProcessing(false);
      }
  };

  const addManualQuestion = () => {
    const q: Question = {
      id: uuidv4(),
      type: 'mcq',
      text: 'Câu hỏi mới... <br/> (Công thức: $\\sqrt{x}$)',
      points: 0.25,
      options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
      correctAnswer: 'Lựa chọn A',
      solution: ''
    };
    setQuestions([...questions, q]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const onSelectImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      // Upload
      const url = await uploadImage(file);
      if (url) {
          updateQuestion(index, 'imageUrl', url);
      } else {
          alert("Không thể upload ảnh. Hãy đảm bảo bạn đã tạo Bucket 'quiz-images' trên Supabase và đặt chế độ Public.");
      }
  };

  const changeQuestionType = (index: number, type: QuestionType) => {
    const updated = [...questions];
    const q = updated[index];
    q.type = type;
    
    if (type === 'mcq') {
      q.points = 0.25;
      q.options = ['A', 'B', 'C', 'D'];
      q.correctAnswer = 'A';
      q.subQuestions = undefined;
    } else if (type === 'group-tf') {
      q.points = 1.0;
      q.options = undefined;
      q.correctAnswer = undefined;
      q.subQuestions = [
        { id: uuidv4(), text: 'Ý a)', correctAnswer: 'True' },
        { id: uuidv4(), text: 'Ý b)', correctAnswer: 'False' },
        { id: uuidv4(), text: 'Ý c)', correctAnswer: 'True' },
        { id: uuidv4(), text: 'Ý d)', correctAnswer: 'False' },
      ];
    } else if (type === 'short') {
      q.points = 0.5;
      q.options = undefined;
      q.subQuestions = undefined;
      q.correctAnswer = '';
    }
    setQuestions(updated);
  };

  const updateSubQuestion = (qIndex: number, subIndex: number, field: keyof SubQuestion, value: any) => {
      const updated = [...questions];
      if (updated[qIndex].subQuestions) {
          updated[qIndex].subQuestions![subIndex] = { 
              ...updated[qIndex].subQuestions![subIndex], 
              [field]: value 
          };
          setQuestions(updated);
      }
  };

  const getGroupedResults = () => {
      const groups: Record<string, {
          studentName: string,
          quizTitle: string,
          quizGrade: string,
          attempts: number,
          maxScore: number,
          items: Result[]
      }> = {};

      results.forEach(r => {
          const quiz = quizzes.find(q => q.id === r.quizId);
          if (resultFilterGrade !== 'all') {
              if (quiz?.grade !== resultFilterGrade) return;
              if (selectedQuizId && r.quizId !== selectedQuizId) return;
          }
          
          if (!quiz) return; 

          const key = `${r.studentId}_${r.quizId}`;
          if (!groups[key]) {
              groups[key] = {
                  studentName: r.studentName,
                  quizTitle: quiz.title,
                  quizGrade: quiz.grade,
                  attempts: 0,
                  maxScore: 0,
                  items: []
              };
          }
          groups[key].attempts += 1;
          groups[key].maxScore = Math.max(groups[key].maxScore, r.score);
          groups[key].items.push(r);
      });

      Object.values(groups).forEach(g => {
          g.items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      });

      return Object.values(groups);
  };
  
  const groupedResults = activeTab === 'results' ? getGroupedResults() : [];

  const getFilteredQuizzes = () => {
      return quizzes.filter(q => q.grade === resultFilterGrade);
  };
  const practiceQuizzes = getFilteredQuizzes().filter(q => q.type === 'practice');
  const testQuizzes = getFilteredQuizzes().filter(q => q.type === 'test');

  const formatDurationSimple = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}p ${s}s`;
  };

  const getListViewQuizzes = () => {
    let filtered = quizzes;
    if (quizFilterGrade !== 'all') {
      filtered = filtered.filter(q => q.grade === quizFilterGrade);
    }
    return {
      tests: filtered.filter(q => q.type === 'test'),
      practices: filtered.filter(q => q.type === 'practice')
    };
  };

  const { tests: listTests, practices: listPractices } = getListViewQuizzes();

  // --- STUDENT MANAGEMENT LOGIC ---
  const handleEditUser = (user: User) => {
      setEditingUser(user);
      setUserForm({
          fullName: user.fullName,
          username: user.username,
          password: user.password,
          grade: user.grade || '10',
          role: user.role
      });
      setShowUserModal(true);
  };

  const handleCreateUser = () => {
      setEditingUser(null);
      setUserForm({
          fullName: '',
          username: '',
          password: '',
          grade: '10',
          role: 'student'
      });
      setShowUserModal(true);
  };

  const handleDeleteUser = async (id: string) => {
      if (window.confirm('Cảnh báo: Xóa học sinh này sẽ xóa toàn bộ lịch sử thi của họ. Bạn có chắc không?')) {
          await deleteUser(id);
          refreshData(); // Reload user list
      }
  };

  const handleSaveUser = async () => {
      if (!userForm.username || !userForm.password || !userForm.fullName) {
          alert("Vui lòng nhập đầy đủ thông tin.");
          return;
      }

      const userData: User = {
          id: editingUser ? editingUser.id : uuidv4(),
          username: userForm.username,
          password: userForm.password,
          fullName: userForm.fullName,
          grade: userForm.role === 'student' ? userForm.grade : undefined,
          role: userForm.role
      };

      if (editingUser) {
          await updateUser(userData);
      } else {
          // Check exist
          const exists = users.find(u => u.username === userData.username);
          if (exists) {
              alert("Tên đăng nhập đã tồn tại!");
              return;
          }
          await saveUser(userData);
      }
      setShowUserModal(false);
      refreshData();
  };

  const handleDeleteResult = async (resultId: string) => {
      if (window.confirm("Bạn có chắc chắn muốn XÓA kết quả bài thi này không? Hành động này không thể hoàn tác.")) {
          await deleteResult(resultId);
          
          // Cập nhật lại viewHistoryData bằng cách xóa item vừa xóa khỏi mảng
          if (viewHistoryData) {
              const updatedItems = viewHistoryData.items.filter(item => item.id !== resultId);
              if (updatedItems.length === 0) {
                  setViewHistoryData(null); // Close if no items left
              } else {
                  setViewHistoryData({ ...viewHistoryData, items: updatedItems });
              }
          }
          
          // Refresh toàn bộ dữ liệu nền
          refreshData();
      }
  };

  const filteredUsers = users.filter(u => 
      u.role === 'student' && 
      (u.fullName.toLowerCase().includes(searchUser.toLowerCase()) || u.username.toLowerCase().includes(searchUser.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
         Quản Lý Đề Thi (Online)
      </h1>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><List size={20} /> Danh Sách Đề</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
          {editingId ? <Edit size={20} /> : <Plus size={20} />} 
          {editingId ? 'Sửa Đề Thi' : 'Soạn Đề Mới'}
        </button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'import' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Upload size={20} /> Nhập File PDF</button>
        <button onClick={() => { setActiveTab('results'); resetForm(); setSelectedQuizId(''); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><BarChart3 size={20} /> Kết Quả Thi</button>
        <button onClick={() => { setActiveTab('students'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Users size={20} /> Quản Lý Học Sinh</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
             <span className="flex items-center gap-2 text-gray-700 font-bold"><Filter size={18}/> Lọc theo khối:</span>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['all', '10', '11', '12'] as const).map(g => (
                    <button 
                        key={g} 
                        onClick={() => setQuizFilterGrade(g)} 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${quizFilterGrade === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {g === 'all' ? 'Tất cả' : `Khối ${g}`}
                    </button>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Cột Đề Kiểm Tra */}
            <div className="space-y-4">
               <h2 className="text-lg font-bold text-red-700 flex items-center gap-2 uppercase border-b border-red-200 pb-2">
                 <GraduationCap className="text-red-600"/> Đề Kiểm Tra ({listTests.length})
               </h2>
               <div className="space-y-3">
                 {listTests.length === 0 ? <p className="text-gray-400 italic text-sm">Chưa có đề kiểm tra nào.</p> : listTests.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-red-300 transition group relative">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <h3 className="font-bold text-gray-800">{q.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">K{q.grade}</span>
                                <span className="flex items-center gap-1"><Clock size={12}/> {q.durationMinutes}p</span>
                                <span className="flex items-center gap-1"><Calendar size={12}/> {q.startTime ? format(parseISO(q.startTime), "dd/MM/yyyy HH:mm") : '---'}</span>
                              </div>
                           </div>
                           <button 
                              onClick={() => handleTogglePublish(q)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-full border ${q.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                            >
                              {q.isPublished ? 'ĐÃ GIAO' : 'NHÁP'}
                           </button>
                        </div>
                        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-dashed">
                            <button onClick={() => setPreviewQuiz(q)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Xem"><Eye size={16}/></button>
                            <button onClick={() => handleEditQuiz(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={16}/></button>
                            <button onClick={async () => { if(window.confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                        </div>
                    </div>
                 ))}
               </div>
            </div>

            {/* Cột Đề Luyện Tập */}
            <div className="space-y-4">
               <h2 className="text-lg font-bold text-green-700 flex items-center gap-2 uppercase border-b border-green-200 pb-2">
                 <BookOpen className="text-green-600"/> Đề Luyện Tập ({listPractices.length})
               </h2>
               <div className="space-y-3">
                 {listPractices.length === 0 ? <p className="text-gray-400 italic text-sm">Chưa có đề luyện tập nào.</p> : listPractices.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-green-300 transition group relative">
                        <div className="flex justify-between items-start mb-2">
                           <div>
                              <h3 className="font-bold text-gray-800">{q.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <span className="bg-gray-100 px-2 py-0.5 rounded">K{q.grade}</span>
                                <span className="flex items-center gap-1"><Clock size={12}/> {q.durationMinutes}p</span>
                                <span className="flex items-center gap-1"><List size={12}/> {q.questions.length} câu</span>
                              </div>
                           </div>
                           <button 
                              onClick={() => handleTogglePublish(q)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-full border ${q.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                            >
                              {q.isPublished ? 'ĐÃ GIAO' : 'NHÁP'}
                           </button>
                        </div>
                        <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-dashed">
                            <button onClick={() => setPreviewQuiz(q)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Xem"><Eye size={16}/></button>
                            <button onClick={() => handleEditQuiz(q)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={16}/></button>
                            <button onClick={async () => { if(window.confirm('Xóa đề này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                        </div>
                    </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-semibold mb-4 text-gray-800">{editingId ? 'Chỉnh Sửa Đề Thi' : 'Thông Tin Đề Thi Mới'}</h3>
               <div className="space-y-4">
                 <div><label className="block text-sm font-medium mb-1">Tên đề thi <span className="text-red-500">*</span></label><input type="text" className="w-full border rounded-lg p-2" value={title} onChange={e => setTitle(e.target.value)}/></div>
                 <div><label className="block text-sm font-medium mb-1">Mô tả</label><textarea className="w-full border rounded-lg p-2" value={description} onChange={e => setDescription(e.target.value)}/></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium mb-1">Hình thức</label><select className="w-full border rounded-lg p-2" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select></div>
                    <div><label className="block text-sm font-medium mb-1">Khối Lớp</label><select className="w-full border rounded-lg p-2" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-medium mb-1">Thời lượng (phút)</label><input type="number" className="w-full border rounded-lg p-2" value={duration} onChange={e => setDuration(Number(e.target.value))}/></div>
                   {quizType === 'test' && <div><label className="block text-sm font-medium mb-1">Thời gian bắt đầu <span className="text-red-500">*</span></label><input type="datetime-local" className="w-full border rounded-lg p-2" value={startTime} onChange={e => setStartTime(e.target.value)}/></div>}
                 </div>
               </div>
             </div>
             
             <div className="space-y-4">
               {questions.map((q, idx) => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                         <div className="flex items-center gap-3"><span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {idx + 1}</span><select className="border rounded px-2 py-1 text-sm bg-white font-medium text-blue-600" value={q.type} onChange={(e) => changeQuestionType(idx, e.target.value as QuestionType)}><option value="mcq">Phần I (MCQ)</option><option value="group-tf">Phần II (Đúng/Sai Chùm)</option><option value="short">Phần III (Trả lời ngắn)</option></select></div>
                         <div className="flex items-center gap-4"><div className="flex items-center gap-1"><span className="text-sm text-gray-500">Điểm:</span><input type="text" inputMode="decimal" className="w-16 border rounded p-1 text-center font-bold text-gray-700" value={q.points} onChange={(e) => { let val = e.target.value.replace(/[^0-9.,]/g, ''); val = val.replace(',', '.'); updateQuestion(idx, 'points', val); }} /></div><button onClick={() => { const newQs = [...questions]; newQs.splice(idx, 1); setQuestions(newQs); }} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-full"><Trash2 size={16}/></button></div>
                      </div>
                      <div className="space-y-3">
                         <textarea className="w-full border rounded p-3 font-medium focus:ring-2 focus:ring-blue-100 outline-none font-mono text-sm" value={q.text} rows={3} onChange={e => updateQuestion(idx, 'text', e.target.value)} placeholder="Nhập nội dung câu hỏi..."/>
                         
                         {/* IMAGE UPLOAD SECTION */}
                         <div className="flex gap-4 items-start">
                             <div className="flex-1">
                                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hình ảnh đính kèm:</label>
                                 <div className="flex gap-2">
                                     <input 
                                        type="text" 
                                        className="flex-1 border rounded p-2 text-sm text-gray-600 bg-gray-50" 
                                        placeholder="Dán link ảnh hoặc upload..."
                                        value={q.imageUrl || ''}
                                        onChange={e => updateQuestion(idx, 'imageUrl', e.target.value)}
                                     />
                                     <label className="cursor-pointer bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition flex items-center gap-2 text-sm font-bold whitespace-nowrap">
                                         <ImageIcon size={16}/> Upload
                                         <input type="file" className="hidden" accept="image/*" onChange={(e) => onSelectImage(e, idx)} />
                                     </label>
                                 </div>
                             </div>
                             {q.imageUrl && (
                                 <div className="shrink-0 w-20 h-20 border rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                                     <img src={q.imageUrl} alt="preview" className="w-full h-full object-contain" />
                                 </div>
                             )}
                         </div>

                         <div className="mt-1 p-2 bg-gray-50 border rounded text-sm text-gray-700"><span className="text-xs font-bold text-blue-500 uppercase mr-2">Xem trước:</span><LatexText text={q.text} /></div>
                         
                         {q.type === 'mcq' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                 {q.options?.map((opt, optIdx) => (
                                     <div key={optIdx} className="border p-2 rounded-lg bg-gray-50 hover:border-blue-300 transition-colors flex flex-col gap-1">
                                         <div className="flex items-center gap-2">
                                             <input 
                                                type="radio" 
                                                checked={q.correctAnswer === opt} 
                                                onChange={() => updateQuestion(idx, 'correctAnswer', opt)} 
                                                className="cursor-pointer"
                                             />
                                             <span className="font-bold text-gray-500 text-sm w-4">{String.fromCharCode(65+optIdx)}.</span>
                                             <input 
                                                className="bg-white border border-gray-200 rounded px-2 py-1.5 w-full text-sm outline-none focus:border-blue-500" 
                                                value={opt} 
                                                onChange={e => { 
                                                    const newOpts = [...(q.options||[])]; 
                                                    newOpts[optIdx] = e.target.value; 
                                                    updateQuestion(idx, 'options', newOpts); 
                                                    if(q.correctAnswer===opt) updateQuestion(idx, 'correctAnswer', e.target.value); 
                                                }} 
                                                placeholder={`Đáp án ${String.fromCharCode(65+optIdx)}`}
                                             />
                                         </div>
                                         {/* PREVIEW LINE FOR OPTION */}
                                         <div className="ml-8 pl-2 border-l-2 border-blue-200 text-sm text-gray-600 min-h-[1.25rem]">
                                             <LatexText text={opt || '...'} />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}

                         {q.type === 'short' && (<div className="flex items-center gap-3"><label>Đáp án:</label><input type="text" className="border p-2 rounded bg-green-50 font-bold" value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)}/></div>)}
                         
                         {q.type === 'group-tf' && (
                             <div className="space-y-2 mt-2">
                                 {q.subQuestions?.map((sq, sqIdx) => (
                                     <div key={sqIdx} className="bg-gray-50 p-2 rounded border">
                                         <div className="flex gap-2 items-center mb-1">
                                             <span className="font-bold text-gray-500 text-sm">{String.fromCharCode(97+sqIdx)})</span>
                                             <input 
                                                className="flex-1 bg-white border px-2 py-1 rounded text-sm outline-none focus:border-blue-500" 
                                                value={sq.text} 
                                                onChange={e=>updateSubQuestion(idx,sqIdx,'text',e.target.value)} 
                                                placeholder="Nhập nội dung ý..."
                                             />
                                             <button onClick={()=>updateSubQuestion(idx,sqIdx,'correctAnswer','True')} className={`px-2 py-1 text-xs rounded border ${sq.correctAnswer==='True'?'bg-green-500 text-white border-green-600':'bg-white text-gray-400'}`}>Đ</button>
                                             <button onClick={()=>updateSubQuestion(idx,sqIdx,'correctAnswer','False')} className={`px-2 py-1 text-xs rounded border ${sq.correctAnswer==='False'?'bg-red-500 text-white border-red-600':'bg-white text-gray-400'}`}>S</button>
                                         </div>
                                         {/* PREVIEW LINE FOR SUB-QUESTION */}
                                         <div className="ml-6 pl-2 border-l-2 border-blue-200 text-sm text-gray-600">
                                              <LatexText text={sq.text || '...'} />
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}

                         {/* SOLUTION FIELD (NEW) */}
                         <div className="mt-4 pt-4 border-t border-dashed">
                             <div className="flex items-center gap-2 mb-2 text-yellow-600 font-bold text-sm">
                                 <Lightbulb size={16} /> Lời giải / Gợi ý chi tiết (Hiển thị sau khi thi):
                             </div>
                             <textarea 
                                className="w-full border border-yellow-200 bg-yellow-50 rounded p-3 text-sm focus:ring-2 focus:ring-yellow-200 outline-none"
                                rows={4}
                                placeholder="Nhập gợi ý phương pháp, công thức, lời giải chi tiết (hỗ trợ Latex $...$)..."
                                value={q.solution || ''}
                                onChange={e => updateQuestion(idx, 'solution', e.target.value)}
                             />
                             <div className="mt-1 p-2 bg-white border border-gray-100 rounded text-sm text-gray-600">
                                <span className="text-xs font-bold text-gray-400 uppercase mr-2">Preview Lời giải:</span>
                                <LatexText text={q.solution || 'Chưa có lời giải'} />
                             </div>
                         </div>
                      </div>
                  </div>
               ))}
               <button onClick={addManualQuestion} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-500 transition">+ Thêm câu hỏi mới</button>
             </div>
           </div>
           
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl border border-gray-200 sticky top-6">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b"><span className="text-gray-600">Tổng số câu:</span><span className="font-bold text-xl">{questions.length}</span></div>
                  <div className="flex justify-between items-center mb-6"><span className="text-gray-600">Tổng điểm:</span><span className="font-bold text-xl text-blue-600">{questions.reduce((sum, q) => sum + (parseFloat(String(q.points).replace(',','.')) || 0), 0)}</span></div>
                  <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg"><span className="text-sm font-medium text-gray-700">Trạng thái:</span><button onClick={() => setIsPublished(!isPublished)} className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition ${isPublished ? 'bg-green-100 text-green-700 border-green-200 border' : 'bg-gray-200 text-gray-500'}`}>{isPublished ? <CheckCircle size={14}/> : <XCircle size={14}/>}{isPublished ? 'Giao Ngay' : 'Lưu Nháp'}</button></div>
                  <button onClick={handleSaveQuiz} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg shadow-green-200 flex justify-center items-center gap-2"><Save size={20} /> {editingId ? 'Cập Nhật Đề' : 'Lưu Đề Thi'}</button>
                  {editingId && <button onClick={() => { resetForm(); setActiveTab('list'); }} className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium">Hủy Bỏ</button>}
               </div>
           </div>
        </div>
      )}

      {/* IMPORT TAB */}
      {activeTab === 'import' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><FileText className="text-blue-600" /> Nhập Đề Từ PDF (Mẫu Mới)</h3>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition cursor-pointer bg-gray-50">
                      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="pdf-upload" />
                      <label htmlFor="pdf-upload" className="cursor-pointer block"><Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" /><span className="block font-medium text-gray-700">{file ? file.name : 'Click để chọn file PDF'}</span></label>
                  </div>
                  <div className="mt-6"><button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50">{isProcessing ? 'Đang phân tích cấu trúc & lời giải...' : 'Trích xuất đề thi'}{isProcessing && <Sparkles className="animate-spin" size={16} />}</button></div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold mb-4">Quy ước mẫu file (Gọn nhẹ)</h3>
                  <div className="text-xs text-gray-700 font-mono bg-white p-4 rounded border space-y-3">
                      <div>
                          <p className="font-bold text-blue-600">PHẦN I. TRẮC NGHIỆM (Đánh dấu * trước đáp án đúng)</p>
                          <p>Câu 1: $1+1=?$</p>
                          <p>A. 1 &nbsp; *B. 2 &nbsp; C. 3 &nbsp; D. 4</p>
                      </div>
                      <hr/>
                      <div>
                          <p className="font-bold text-blue-600">PHẦN II. ĐÚNG SAI (Dùng Đ/S hoặc True/False)</p>
                          <p>Câu 2: Hàm số $y=x^2$...</p>
                          <p>a) Đồng biến trên R (S)</p>
                          <p>b) Có cực tiểu tại x=0 (Đ)</p>
                      </div>
                      <hr/>
                      <div>
                          <p className="font-bold text-blue-600">PHẦN III. TRẢ LỜI NGẮN (Ghi rõ Đáp án: ...)</p>
                          <p>Câu 3: $\sqrt{4}$ bằng bao nhiêu?</p>
                          <p>Đáp án: 2</p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'students' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                              type="text" 
                              placeholder="Tìm tên hoặc username..." 
                              className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-200 outline-none"
                              value={searchUser}
                              onChange={(e) => setSearchUser(e.target.value)}
                          />
                      </div>
                  </div>
                  <button onClick={handleCreateUser} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
                      <UserPlus size={18} /> Thêm Học Sinh
                  </button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b text-gray-500 text-sm uppercase">
                          <tr>
                              <th className="p-4">Họ và Tên</th>
                              <th className="p-4">Tên đăng nhập</th>
                              <th className="p-4">Mật khẩu</th>
                              <th className="p-4 text-center">Khối</th>
                              <th className="p-4 text-right">Hành động</th>
                          </tr>
                      </thead>
                      <tbody>
                          {filteredUsers.length === 0 ? (
                              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Không tìm thấy học sinh nào.</td></tr>
                          ) : (
                              filteredUsers.map(u => (
                                  <tr key={u.id} className="border-b hover:bg-gray-50">
                                      <td className="p-4 font-bold text-gray-800">{u.fullName}</td>
                                      <td className="p-4 text-blue-600 font-mono">{u.username}</td>
                                      <td className="p-4 text-gray-500 font-mono text-xs">******</td>
                                      <td className="p-4 text-center"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">K{u.grade}</span></td>
                                      <td className="p-4 text-right flex justify-end gap-2">
                                          <button onClick={() => handleEditUser(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={16}/></button>
                                          <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={16}/></button>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
      
      {/* PREVIEW MODAL */}
      {previewQuiz && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold">{previewQuiz.title}</h2>
                        <p className="text-sm text-gray-500">Dành cho Khối {previewQuiz.grade} • {previewQuiz.durationMinutes} phút</p>
                    </div>
                    <button onClick={() => setPreviewQuiz(null)} className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 p-2 rounded-full"><XCircle size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {previewQuiz.questions.map((q, idx) => (
                        <div key={q.id} className="border-b pb-4 last:border-0">
                            <div className="font-bold text-gray-800 mb-2 flex justify-between">
                                <span>Câu {idx+1} <span className="text-xs font-normal text-gray-500 ml-2">({q.points} điểm)</span></span>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded uppercase text-gray-500">{q.type}</span>
                            </div>
                            <div className="mb-2"><LatexText text={q.text}/></div>
                            {q.imageUrl && <img src={q.imageUrl} alt="img" className="max-h-40 rounded border mb-2"/>}
                            {/* Render Options */}
                            {q.type === 'mcq' && (
                                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                                    {q.options?.map((opt, i) => (
                                        <div key={i} className={`p-2 border rounded ${opt === q.correctAnswer ? 'bg-green-50 border-green-200 font-medium text-green-800' : ''}`}>
                                            {String.fromCharCode(65+i)}. <LatexText text={opt}/>
                                        </div>
                                    ))}
                                </div>
                            )}
                             {q.type === 'group-tf' && (
                                <div className="space-y-1 text-sm">
                                    {q.subQuestions?.map((sq, i) => (
                                        <div key={i} className="flex justify-between border-b border-dashed pb-1">
                                            <span>{String.fromCharCode(97+i)}) <LatexText text={sq.text}/></span>
                                            <span className={sq.correctAnswer === 'True' ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                                {sq.correctAnswer === 'True' ? 'ĐÚNG' : 'SAI'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                             {q.type === 'short' && (
                                <div className="text-sm bg-green-50 text-green-800 p-2 rounded inline-block font-mono">
                                    Đáp án: {q.correctAnswer}
                                </div>
                            )}
                            
                            {/* SOLUTION PREVIEW */}
                            {q.solution && (
                                <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                                    <div className="font-bold text-yellow-700 mb-1 flex items-center gap-1"><Lightbulb size={12}/> Lời giải:</div>
                                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed"><LatexText text={q.solution}/></div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button onClick={() => setPreviewQuiz(null)} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-black">Đóng</button>
                </div>
            </div>
        </div>
      )}
      
      {/* HISTORY & RESULTS (Updated with Delete Button) */}
      {viewHistoryData && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-gray-800">Lịch sử làm bài</h3>
                          <p className="text-xs text-gray-500">{viewHistoryData.studentName} - {viewHistoryData.quizTitle}</p>
                      </div>
                      <button onClick={() => setViewHistoryData(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-full"><XCircle size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-100 text-gray-500 sticky top-0">
                              <tr>
                                  <th className="p-3 border-b">Lần</th>
                                  <th className="p-3 border-b">Ngày nộp</th>
                                  <th className="p-3 border-b">Điểm</th>
                                  <th className="p-3 border-b text-right">Xóa</th>
                              </tr>
                          </thead>
                          <tbody>
                              {viewHistoryData.items.map((item, idx) => (
                                  <tr key={item.id} className="border-b hover:bg-blue-50 group">
                                      <td className="p-3 text-gray-500">#{viewHistoryData.items.length - idx}</td>
                                      <td className="p-3">
                                          <div className="font-medium text-gray-800">{format(parseISO(item.submittedAt), "dd/MM/yyyy HH:mm")}</div>
                                      </td>
                                      <td className="p-3">
                                          <span className={`font-bold ${item.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{item.score.toFixed(2)}</span>
                                      </td>
                                      <td className="p-3 text-right">
                                          <button 
                                              onClick={() => handleDeleteResult(item.id)}
                                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition" 
                                              title="Xóa kết quả thi này"
                                          >
                                              <Trash2 size={14}/>
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div className="p-3 border-t bg-gray-50 text-right">
                      <button onClick={() => setViewHistoryData(null)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100">Đóng</button>
                  </div>
              </div>
          </div>
      )}
      
      {activeTab === 'results' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
           <div className="p-4 border-b bg-gray-50 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                  <Filter size={18} />
                  <span>Chọn khối lớp cần xem:</span>
                  <div className="flex bg-white p-1 rounded-lg border shadow-sm ml-2">
                      {(['all', '10', '11', '12'] as const).map(g => (
                          <button key={g} onClick={() => { setResultFilterGrade(g); setSelectedQuizId(''); }} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${resultFilterGrade === g ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}>
                              {g === 'all' ? 'Tổng quan' : `Khối ${g}`}
                          </button>
                      ))}
                  </div>
              </div>
              {resultFilterGrade !== 'all' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đề Luyện Tập</label>
                          <select className="w-full border rounded-lg p-2.5 bg-gray-50" value={quizzes.find(q => q.id === selectedQuizId)?.type === 'practice' ? selectedQuizId : ''} onChange={(e) => setSelectedQuizId(e.target.value)}>
                              <option value="">-- Chọn đề luyện tập --</option>
                              {practiceQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Đề Kiểm Tra</label>
                          <select className="w-full border rounded-lg p-2.5 bg-gray-50" value={quizzes.find(q => q.id === selectedQuizId)?.type === 'test' ? selectedQuizId : ''} onChange={(e) => setSelectedQuizId(e.target.value)}>
                              <option value="">-- Chọn bài kiểm tra --</option>
                              {testQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                          </select>
                      </div>
                  </div>
              )}
           </div>
           <div className="overflow-hidden min-h-[300px]">
                {resultFilterGrade !== 'all' && !selectedQuizId && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <List size={48} className="mb-4 opacity-20"/>
                        <p className="font-medium">Vui lòng chọn một đề thi ở trên để xem danh sách học sinh.</p>
                    </div>
                )}
                {(resultFilterGrade === 'all' || selectedQuizId) && (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Học Sinh</th>
                            <th className="p-4 font-semibold text-gray-600">Bài Thi</th>
                            <th className="p-4 font-semibold text-gray-600">Khối</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Số Lần Thi</th>
                            <th className="p-4 font-semibold text-gray-600 text-center">Điểm Cao Nhất</th>
                            <th className="p-4 font-semibold text-gray-600 text-right">Chi tiết</th>
                        </tr>
                        </thead>
                        <tbody>
                        {groupedResults.map((group, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                                <td className="p-4 font-bold text-gray-800">{group.studentName}</td>
                                <td className="p-4 text-gray-600">{group.quizTitle}</td>
                                <td className="p-4"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">K{group.quizGrade}</span></td>
                                <td className="p-4 text-center"><span className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{group.attempts} lần</span></td>
                                <td className="p-4 text-center"><span className={`font-bold text-lg ${group.maxScore >= 5 ? 'text-green-600' : 'text-red-500'}`}>{group.maxScore.toFixed(2)}</span></td>
                                <td className="p-4 text-right">
                                    <button onClick={() => setViewHistoryData({ studentName: group.studentName, quizTitle: group.quizTitle, items: group.items })} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition flex items-center gap-1 ml-auto text-sm font-medium"><History size={16}/> Xem lịch sử</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
           </div>
        </div>
      )}

      {/* USER MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
                <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><UserPlus size={20}/> {editingUser ? 'Sửa Thông Tin Học Sinh' : 'Thêm Học Sinh Mới'}</h3>
                    <button onClick={() => setShowUserModal(false)} className="text-blue-100 hover:text-white rounded-full p-1"><XCircle size={24}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Họ và Tên</label>
                        <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nguyễn Văn A" value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Tên đăng nhập (Viết liền)</label>
                        <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="nguyenvana" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} disabled={!!editingUser} />
                        {editingUser && <p className="text-xs text-gray-500 mt-1">* Không thể đổi tên đăng nhập</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Mật khẩu</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            <input type="text" className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="******" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Khối Lớp</label>
                        <select className="w-full border rounded-lg p-2.5 bg-white" value={userForm.grade} onChange={e => setUserForm({...userForm, grade: e.target.value as Grade})}>
                            <option value="10">Lớp 10</option>
                            <option value="11">Lớp 11</option>
                            <option value="12">Lớp 12</option>
                        </select>
                    </div>
                    <div className="pt-4">
                        <button onClick={handleSaveUser} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 transition">
                            {editingUser ? 'Lưu Thay Đổi' : 'Tạo Tài Khoản'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
