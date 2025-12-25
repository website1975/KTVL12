
import React, { useState, useEffect, useRef } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, SubQuestion, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, List, Upload, FileText, Image as ImageIcon, BarChart3, Eye, Edit, CheckCircle, XCircle, Filter, History, Search, BookOpen, GraduationCap, Lightbulb, UserPlus, Users, ChevronUp, ChevronDown, SortAsc, Database, SearchCode, Bold, Italic, Underline, CornerDownLeft, Sigma } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER COMPONENTS ---

interface ToolbarButtonProps {
    onClick: () => void;
    icon?: React.ReactNode;
    label?: string;
    tooltip: string;
}

const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button 
        type="button"
        onClick={onClick}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-medium text-xs flex items-center gap-1 border border-transparent hover:border-gray-300 transition-all min-w-[24px] justify-center"
        title={tooltip}
    >
        {icon}
        {label && <span>{label}</span>}
    </button>
);

interface RichTextEditorProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, rows, className }) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const text = el.value;
        const before = text.substring(0, start);
        const selected = text.substring(start, end);
        const after = text.substring(end);
        const newVal = before + prefix + selected + suffix + after;
        onChange(newVal);
        setTimeout(() => {
            el.focus();
            const newCursorPos = start + prefix.length + selected.length;
            el.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="flex flex-col border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border-b border-gray-100">
                <ToolbarBtn onClick={() => insertTag('<b>', '</b>')} icon={<Bold size={14}/>} tooltip="In đậm" />
                <ToolbarBtn onClick={() => insertTag('<i>', '</i>')} icon={<Italic size={14}/>} tooltip="In nghiêng" />
                <ToolbarBtn onClick={() => insertTag('<u>', '</u>')} icon={<Underline size={14}/>} tooltip="Gạch chân" />
                <ToolbarBtn onClick={() => insertTag('<br/>')} icon={<CornerDownLeft size={14}/>} tooltip="Xuống dòng" />
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <ToolbarBtn onClick={() => insertTag('$', '$')} icon={<Sigma size={14}/>} tooltip="Công thức toán" />
                <ToolbarBtn onClick={() => insertTag('$\\frac{', '}$') } label="a/b" tooltip="Phân số" />
                <ToolbarBtn onClick={() => insertTag('$^{', '}$') } label="x²" tooltip="Số mũ" />
                <ToolbarBtn onClick={() => insertTag('$_{', '}$') } label="x₁" tooltip="Chỉ số" />
            </div>
            {rows ? (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className={`w-full p-3 outline-none text-sm font-mono leading-relaxed resize-y ${className}`}
                    rows={rows}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            ) : (
                <input
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    className={`w-full p-2 outline-none text-sm font-medium ${className}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                />
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterGrade, setResultFilterGrade] = useState<Grade | 'all'>('all');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12'); // Mặc định lớp 12
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [viewHistoryData, setViewHistoryData] = useState<{ studentName: string, quizTitle: string, items: Result[] } | null>(null);

  // Question Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ fullName: '', username: '', password: '', grade: '12' as Grade, role: 'student' as Role });

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    const qData = await getQuizzes();
    setQuizzes(qData);
    const rData = await getResults();
    setResults(rData);
    const uData = await getUsers();
    setUsers(uData);
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tên đề thi."); return; }
    if (questions.length === 0) { alert("Đề thi cần ít nhất 1 câu hỏi."); return; }
    
    const quizData: Quiz = {
      id: editingId || uuidv4(),
      title,
      description,
      type: quizType,
      grade,
      startTime: quizType === 'test' ? startTime : undefined,
      durationMinutes: duration,
      questions,
      createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      isPublished: isPublished
    };

    if (editingId) await updateQuiz(quizData);
    else await saveQuiz(quizData);

    await refreshData();
    setActiveTab('list');
    resetForm();
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
    setDuration(90);
    setFile(null);
    setIsPublished(false);
  };

  const addManualQuestion = (type: QuestionType = 'mcq') => {
    let q: Question;
    if (type === 'mcq') {
      q = { id: uuidv4(), type: 'mcq', text: '', points: 0.25, options: ['', '', '', ''], correctAnswer: '', solution: '' };
    } else if (type === 'group-tf') {
      q = { id: uuidv4(), type: 'group-tf', text: '', points: 1.0, subQuestions: [{ id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }, { id: uuidv4(), text: '', correctAnswer: 'True' }], solution: '' };
    } else {
      q = { id: uuidv4(), type: 'short', text: '', points: 0.5, correctAnswer: '', solution: '' };
    }

    const lastIdx = [...questions].reverse().findIndex(x => x.type === type);
    const newQs = [...questions];
    if (lastIdx === -1) {
        if (type === 'mcq') newQs.unshift(q);
        else if (type === 'group-tf') {
            const firstShort = newQs.findIndex(x => x.type === 'short');
            if (firstShort === -1) newQs.push(q);
            else newQs.splice(firstShort, 0, q);
        } else newQs.push(q);
    } else {
        newQs.splice(questions.length - lastIdx, 0, q);
    }
    setQuestions(newQs);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const onSelectImage = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
      if (!e.target.files?.[0]) return;
      const url = await uploadImage(e.target.files[0]);
      if (url) updateQuestion(index, 'imageUrl', url);
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
      return (
          <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                  <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2">{label}</h3>
                  <div className="flex gap-2">
                      <button onClick={() => { setBankTargetType(type); setShowBankModal(true); setBankSelectedQuizId(''); }} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1"><Database size={14}/> Ngân hàng</button>
                      <button onClick={() => addManualQuestion(type)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"><Plus size={14}/> Thêm câu</button>
                  </div>
              </div>
              <div className="p-4 space-y-4">
                  {questions.map((q, idx) => {
                      if (q.type !== type) return null;
                      return (
                        <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-dashed">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {idx + 1}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={18}/></button>
                                        <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={18}/></button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input type="text" className="w-14 border rounded p-1 text-center font-bold text-xs bg-gray-50" value={q.points} onChange={(e) => updateQuestion(idx, 'points', e.target.value.replace(',', '.'))} />
                                    <button onClick={() => { if(window.confirm('Xóa câu này?')) { const n = [...questions]; n.splice(idx, 1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <RichTextEditor rows={2} value={q.text} onChange={(val) => updateQuestion(idx, 'text', val)} placeholder="Nội dung câu hỏi..." />
                                    <div className="mt-2 p-3 bg-blue-50/30 rounded border border-blue-100 text-sm"><LatexText text={q.text || '...'} /></div>
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" className="flex-1 border rounded p-2 text-xs" placeholder="Link ảnh..." value={q.imageUrl || ''} onChange={e => updateQuestion(idx, 'imageUrl', e.target.value)}/>
                                    <label className="cursor-pointer bg-gray-100 px-3 py-2 rounded border hover:bg-gray-200 transition text-xs font-bold flex items-center gap-1"><ImageIcon size={14}/> Upload<input type="file" className="hidden" accept="image/*" onChange={(e) => onSelectImage(e, idx)} /></label>
                                </div>
                                {q.type === 'mcq' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options?.map((opt, optIdx) => (
                                            <div key={optIdx} className="space-y-1">
                                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border">
                                                    <input type="radio" name={`correct-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => updateQuestion(idx, 'correctAnswer', opt)} />
                                                    <span className="font-bold text-gray-400 w-4">{String.fromCharCode(65+optIdx)}.</span>
                                                    <RichTextEditor className="flex-1 border-none" value={opt} onChange={(val) => { const o = [...(q.options||[])]; o[optIdx]=val; updateQuestion(idx, 'options', o); if(q.correctAnswer===opt) updateQuestion(idx, 'correctAnswer', val); }} />
                                                </div>
                                                <div className="pl-8 text-xs text-gray-500 italic"><LatexText text={opt || '...'} /></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'short' && (
                                    <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg border border-green-100">
                                        <span className="text-xs font-bold text-green-700 uppercase">Đáp số:</span>
                                        <input type="text" className="flex-1 border-2 border-green-200 rounded p-2 font-bold" value={q.correctAnswer} onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)} />
                                    </div>
                                )}
                                {q.type === 'group-tf' && (
                                    <div className="space-y-2">
                                        {q.subQuestions?.map((sq, sqIdx) => (
                                            <div key={sqIdx} className="bg-gray-50 p-2 rounded border border-gray-100">
                                                <div className="flex gap-2 items-center">
                                                    <span className="font-bold text-gray-400 w-4">{String.fromCharCode(97+sqIdx)})</span>
                                                    <RichTextEditor className="flex-1" value={sq.text} onChange={(val) => { const s = [...(q.subQuestions||[])]; s[sqIdx].text = val; updateQuestion(idx, 'subQuestions', s); }} />
                                                    <div className="flex gap-1 shrink-0">
                                                        <button onClick={()=>{const s=[...(q.subQuestions||[])]; s[sqIdx].correctAnswer='True'; updateQuestion(idx,'subQuestions',s);}} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='True'?'bg-green-600 text-white':'bg-white text-gray-300'}`}>Đ</button>
                                                        <button onClick={()=>{const s=[...(q.subQuestions||[])]; s[sqIdx].correctAnswer='False'; updateQuestion(idx,'subQuestions',s);}} className={`px-2 py-1 text-[10px] rounded border ${sq.correctAnswer==='False'?'bg-red-600 text-white':'bg-white text-gray-300'}`}>S</button>
                                                    </div>
                                                </div>
                                                <div className="pl-8 text-xs text-gray-500 italic mt-1"><LatexText text={sq.text || '...'} /></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-4 pt-4 border-t border-dashed">
                                    <div className="flex items-center gap-1 mb-2 text-yellow-600 font-bold text-[10px] uppercase"><Lightbulb size={14} /> Lời giải chi tiết:</div>
                                    <RichTextEditor rows={3} className="bg-yellow-50/50 border-yellow-100" value={q.solution || ''} onChange={(val) => updateQuestion(idx, 'solution', val)} />
                                    <div className="mt-1 p-2 bg-yellow-50/30 rounded border border-yellow-50 text-xs text-yellow-800 italic"><LatexText text={q.solution || 'Chưa có lời giải'} /></div>
                                </div>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </div>
      );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2"><Database className="text-blue-600" /> Quản Lý Đề Thi Online</h1>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><List size={20} /> Danh Sách</button>
        <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{editingId ? <Edit size={20} /> : <Plus size={20} />} {editingId ? 'Sửa Đề' : 'Soạn Đề'}</button>
        <button onClick={() => { setActiveTab('import'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'import' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Upload size={20} /> Nhập PDF</button>
        <button onClick={() => { setActiveTab('results'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'results' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><BarChart3 size={20} /> Kết Quả</button>
        <button onClick={() => { setActiveTab('students'); resetForm(); }} className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><Users size={20} /> Học Sinh</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3">
             <span className="font-bold text-gray-700 flex items-center gap-1"><Filter size={18}/> Lọc Khối:</span>
             <div className="flex bg-gray-100 p-1 rounded-lg">
                {(['all', '10', '11', '12'] as const).map(g => (
                    <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${quizFilterGrade === g ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>{g === 'all' ? 'Tất cả' : `Lớp ${g}`}</button>
                ))}
             </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
               <h2 className="text-lg font-bold text-red-700 uppercase border-b border-red-200 pb-2">Đề Kiểm Tra</h2>
               {quizzes.filter(q => q.type === 'test' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade)).map(q => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-red-300 transition flex justify-between items-center group">
                      <div><h3 className="font-bold text-gray-800">{q.title}</h3><div className="text-xs text-gray-500 mt-1">Lớp {q.grade} • {q.durationMinutes} phút • {q.isPublished ? 'Đã đăng' : 'Nháp'}</div></div>
                      <div className="flex gap-2">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                      </div>
                  </div>
               ))}
            </div>
            <div className="space-y-3">
               <h2 className="text-lg font-bold text-green-700 uppercase border-b border-green-200 pb-2">Đề Luyện Tập</h2>
               {quizzes.filter(q => q.type === 'practice' && (quizFilterGrade === 'all' || q.grade === quizFilterGrade)).map(q => (
                  <div key={q.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-green-300 transition flex justify-between items-center group">
                      <div><h3 className="font-bold text-gray-800">{q.title}</h3><div className="text-xs text-gray-500 mt-1">Lớp {q.grade} • {q.questions.length} câu</div></div>
                      <div className="flex gap-2">
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                      </div>
                  </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h3 className="text-xl font-semibold mb-4 text-gray-800">Thông Tin Chung</h3>
               <div className="space-y-4">
                 <input type="text" className="w-full border rounded-lg p-2.5" placeholder="Tên đề thi" value={title} onChange={e => setTitle(e.target.value)}/>
                 <textarea className="w-full border rounded-lg p-2.5" placeholder="Mô tả" value={description} onChange={e => setDescription(e.target.value)}/>
                 <div className="grid grid-cols-2 gap-4">
                    <select className="border rounded-lg p-2.5" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select>
                    <select className="border rounded-lg p-2.5" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" className="border rounded-lg p-2.5" value={duration} onChange={e => setDuration(Number(e.target.value))} placeholder="Phút"/>
                    {quizType === 'test' && <input type="datetime-local" className="border rounded-lg p-2.5" value={startTime} onChange={e => setStartTime(e.target.value)}/>}
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Câu hỏi trắc nghiệm', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi đúng sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Câu hỏi trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-6 rounded-xl border shadow-lg sticky top-6">
                  <div className="flex justify-between items-center mb-2 font-bold text-gray-500 uppercase text-xs"><span>Tổng câu:</span><span>{questions.length}</span></div>
                  <div className="flex justify-between items-center mb-6 font-bold text-gray-500 uppercase text-xs"><span>Tổng điểm:</span><span className="text-blue-600 text-lg">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</span></div>
                  <div className="mb-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg"><span className="text-sm font-bold text-gray-700">Trạng thái:</span><button onClick={() => setIsPublished(!isPublished)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition ${isPublished ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-200 text-gray-500 border-gray-300'}`}>{isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</button></div>
                  <button onClick={handleSaveQuiz} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-extrabold shadow-lg flex justify-center items-center gap-2 transition transform active:scale-95"><Save size={20} /> LƯU ĐỀ THI</button>
               </div>
           </div>
        </div>
      )}

      {/* QUESTION BANK MODAL */}
      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div><h3 className="text-xl font-bold flex items-center gap-2"><Database size={24}/> Ngân hàng câu hỏi Lớp {grade}</h3></div>
                      <button onClick={() => setShowBankModal(false)}><XCircle size={28}/></button>
                  </div>
                  <div className="p-6 border-b bg-gray-50 shrink-0 flex gap-4">
                      <select className="flex-1 border rounded-lg p-2.5 shadow-sm" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}>
                          <option value="">-- Chọn đề thi cùng khối {grade} --</option>
                          {quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                          <option disabled>──────────</option>
                          <option value="ALL">Xem tất cả các khối</option>
                      </select>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-100">
                      {bankSelectedQuizId === '' ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60"><SearchCode size={64} className="mb-4"/><p className="font-bold">Vui lòng chọn đề thi nguồn</p></div>
                      ) : (
                          <>
                            {(() => {
                                let sourceQuizzes = bankSelectedQuizId === 'ALL' ? quizzes : quizzes.filter(q => q.id === bankSelectedQuizId);
                                let allQs: Question[] = [];
                                sourceQuizzes.forEach(sq => sq.questions.filter(q => q.type === bankTargetType).forEach(q => allQs.push(q)));
                                
                                // Lọc bỏ câu trùng nội dung
                                const availableQs = allQs.filter(sq => !questions.some(currQ => currQ.text.trim() === sq.text.trim()));
                                
                                if (availableQs.length === 0) return <p className="text-center p-10 text-gray-500 font-bold">Không còn câu hỏi mới nào để thêm!</p>;
                                
                                return availableQs.map((q, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-indigo-400 transition-colors flex justify-between items-start gap-4">
                                        <div className="flex-1 overflow-hidden">
                                            <div className="text-sm font-bold text-indigo-600 mb-1">Loại: {q.type}</div>
                                            <div className="text-sm text-gray-800"><LatexText text={q.text}/></div>
                                        </div>
                                        <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-md"><Plus size={18}/></button>
                                    </div>
                                ));
                            })()}
                          </>
                      )}
                  </div>
                  <div className="p-4 bg-gray-50 border-t text-right shrink-0"><button onClick={() => setShowBankModal(false)} className="px-10 py-2 bg-gray-800 text-white rounded-lg font-bold">XONG</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
