
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User } from '../types';
import { 
    saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, 
    uploadImage, getUsers, deleteUser, deleteResult 
} from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { 
    Plus, Trash2, Save, List, Upload, FileText, BarChart3, Edit, 
    XCircle, BookOpen, Lightbulb, Users, ChevronRight, Database, 
    Bold, Italic, Underline, CornerDownLeft, Sigma, Info, Settings2, 
    FolderTree, Layers, Sparkles, Zap, BrainCircuit, Loader2, PieChart, 
    TrendingUp, Calendar, Trophy, Eye, Image as ImageIcon, X, Link as LinkIcon, 
    FileDown, Shuffle, CheckSquare, Clock as ClockIcon, Send 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPERS ---
const shuffleArray = <T,>(array: T[]): T[] => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
};

const sortQuestionsByType = (qs: Question[]): Question[] => {
    const typeOrder: Record<QuestionType, number> = { 'mcq': 1, 'group-tf': 2, 'short': 3 };
    return [...qs].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
};

// --- COMPONENTS ---
interface ToolbarButtonProps { onClick: () => void; icon?: React.ReactNode; label?: string; tooltip: string; }
const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button type="button" onClick={onClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 text-xs flex items-center gap-1 border border-transparent transition-all min-w-[24px]" title={tooltip}>
        {icon} {label && <span>{label}</span>}
    </button>
);

interface RichTextEditorProps { value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; className?: string; }
const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, rows, className }) => {
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
    const insertTag = (prefix: string, suffix: string = '') => {
        const el = inputRef.current;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const text = el.value;
        const newVal = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        onChange(newVal);
    };
    return (
        <div className="flex flex-col border rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-50 border-b border-gray-100">
                <ToolbarBtn onClick={() => insertTag('<b>', '</b>')} icon={<Bold size={14}/>} tooltip="In đậm" />
                <ToolbarBtn onClick={() => insertTag('<i>', '</i>')} icon={<Italic size={14}/>} tooltip="In nghiêng" />
                <ToolbarBtn onClick={() => insertTag('$ ', ' $')} icon={<Sigma size={14}/>} tooltip="Công thức toán" />
                <ToolbarBtn onClick={() => insertTag('<br/>')} icon={<CornerDownLeft size={14}/>} tooltip="Xuống dòng" />
            </div>
            {rows ? (
                <textarea ref={inputRef as any} className={`w-full p-3 outline-none text-sm leading-relaxed resize-y ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as any} type="text" className={`w-full p-2 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            )}
        </div>
    );
};

// --- MAIN ---
const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students' | 'auto'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterQuizId, setResultFilterQuizId] = useState<string>('all');
  const [studentFilterGrade, setStudentFilterGrade] = useState<Grade | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('practice');
  const [grade, setGrade] = useState<Grade>('12');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isPublished, setIsPublished] = useState(false); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Đang khởi tạo...');
  const [file, setFile] = useState<File | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankTargetType, setBankTargetType] = useState<QuestionType>('mcq');
  const [bankSelectedQuizId, setBankSelectedQuizId] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [batchPoints, setBatchPoints] = useState<Record<QuestionType, string>>({ 'mcq': '0.25', 'group-tf': '1.0', 'short': '0.5' });
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<User | null>(null);
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 10, p2: 4, p3: 6, diff: 'Thông hiểu' });

  useEffect(() => { refreshData(); }, [activeTab]);

  const refreshData = async () => {
    setQuizzes(await getQuizzes());
    setResults(await getResults());
    setUsers(await getUsers());
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setCategory(''); setQuestions([]); setStartTime(''); setDuration(90); setIsPublished(false);
  };

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    const filtered = quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade);
    filtered.forEach(q => {
      const cat = q.category || 'Chưa phân loại';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(q);
    });
    return groups;
  }, [quizzes, quizFilterGrade]);

  const stats = useMemo(() => {
    const filtered = results.filter(r => resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId);
    const total = filtered.length;
    const avg = total > 0 ? filtered.reduce((acc, curr) => acc + curr.score, 0) / total : 0;
    return { total, avg };
  }, [results, resultFilterQuizId]);

  const handleSaveQuiz = async () => {
    if (!title.trim()) return alert("Vui lòng nhập tên đề thi.");
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description: '', category: category.trim(), type: quizType, grade, startTime, durationMinutes: duration, questions, createdAt: new Date().toISOString(), isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    await refreshData(); setActiveTab('list'); resetForm();
  };

  const handleEditQuiz = (q: Quiz) => {
    setEditingId(q.id); setTitle(q.title); setCategory(q.category || ''); setQuizType(q.type); setGrade(q.grade); setStartTime(q.startTime || ''); setDuration(q.durationMinutes); setQuestions(q.questions); setIsPublished(q.isPublished); setActiveTab('create');
  };

  const handleFileUpload = async () => {
    if (!file) return alert("Chọn file PDF.");
    setIsProcessing(true);
    setLoadingMsg("AI đang bóc tách 3 phần đề thi...");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await parseQuestionsFromPDF(base64);
        setQuestions(sortQuestionsByType([...questions, ...extracted]));
        alert(`Thành công! Trích xuất ${extracted.length} câu.`);
        setActiveTab('create');
      } catch (e) { alert("Lỗi xử lý."); } finally { setIsProcessing(false); }
    };
  };

  const handleAutoGenerate = async () => {
    if (!aiTopic.trim()) return alert("Nhập chủ đề.");
    setIsProcessing(true);
    try {
        const generated = await generateQuizFromPrompt({
            grade, category: "Chung", topic: aiTopic, part1Count: aiConfig.p1, part2Count: aiConfig.p2, part3Count: aiConfig.p3, difficulty: aiConfig.diff
        });
        setQuestions(sortQuestionsByType([...questions, ...generated]));
        alert("Đã soạn thêm câu hỏi bằng AI.");
        setActiveTab('create');
    } catch (e) { alert("Lỗi soạn AI."); } finally { setIsProcessing(false); }
  };

  const handleExportWord = (quiz: Quiz, qs: Question[]) => {
    const blob = new Blob(['File Word Content...'], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title}.doc`;
    link.click();
  };

  const renderEditorPart = (type: QuestionType, label: string) => (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
            <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest">{label}</h3>
            <div className="flex gap-2">
                <button onClick={() => {
                    let q: Question = { id: uuidv4(), type, text: '', points: batchPoints[type], solution: '' };
                    if (type === 'mcq') q.options = ['', '', '', ''];
                    if (type === 'group-tf') q.subQuestions = [{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'}];
                    setQuestions(sortQuestionsByType([...questions, q]));
                }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">+ Thêm câu</button>
            </div>
        </div>
        <div className="p-4 space-y-4">
            {questions.filter(q => q.type === type).map((q, idx) => {
                const gIdx = questions.findIndex(item => item.id === q.id);
                return (
                    <div key={q.id} className="border rounded-lg p-4 space-y-3 bg-white hover:border-blue-200 transition-all shadow-sm">
                        <div className="flex justify-between items-center text-xs font-bold">
                            <span className="bg-gray-100 px-2 py-1 rounded">CÂU {gIdx + 1}</span>
                            <div className="flex items-center gap-3">
                                <span>ĐIỂM:</span>
                                <input type="text" className="w-10 border rounded text-center" value={q.points} onChange={e => {
                                    const n = [...questions]; n[gIdx].points = e.target.value; setQuestions(n);
                                }} />
                                <button onClick={() => {
                                    const n = [...questions]; n.splice(gIdx, 1); setQuestions(n);
                                }} className="text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <RichTextEditor rows={3} value={q.text} onChange={v => {
                            const n = [...questions]; n[gIdx].text = v; setQuestions(n);
                        }} placeholder="Nội dung câu hỏi..." />
                        
                        {type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {q.options.map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-2">
                                        <input type="radio" checked={q.correctAnswer === opt} onChange={() => {
                                            const n = [...questions]; n[gIdx].correctAnswer = opt; setQuestions(n);
                                        }} />
                                        <input type="text" className="flex-1 border-b text-sm" value={opt} onChange={e => {
                                            const n = [...questions]; const o = [...(n[gIdx].options||[])]; o[oi] = e.target.value; n[gIdx].options = o; setQuestions(n);
                                        }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}`} />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === 'short' && (
                            <div className="flex items-center gap-2 bg-green-50 p-2 rounded">
                                <span className="text-xs font-bold">ĐÁP ÁN:</span>
                                <input type="text" className="flex-1 border rounded p-1 text-sm font-bold" value={q.correctAnswer} onChange={e => {
                                    const n = [...questions]; n[gIdx].correctAnswer = e.target.value; setQuestions(n);
                                }} />
                            </div>
                        )}

                        <RichTextEditor rows={2} className="bg-yellow-50/50" value={q.solution || ''} onChange={v => {
                            const n = [...questions]; n[gIdx].solution = v; setQuestions(n);
                        }} placeholder="Lời giải chi tiết..." />
                    </div>
                );
            })}
        </div>
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Settings2 className="text-blue-600"/> QUẢN TRỊ VIÊN</h1>
          <div className="flex gap-2">
              <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>DANH SÁCH</button>
              <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>SOẠN ĐỀ</button>
              <button onClick={() => setActiveTab('auto')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'auto' ? 'bg-purple-600 text-white' : 'bg-white border'}`}>AI SOẠN</button>
              <button onClick={() => setActiveTab('import')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'import' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>NHẬP PDF</button>
              <button onClick={() => setActiveTab('results')} className={`px-4 py-2 rounded-lg font-bold text-sm ${activeTab === 'results' ? 'bg-green-600 text-white' : 'bg-white border'}`}>KẾT QUẢ</button>
          </div>
      </div>

      {activeTab === 'list' && (
          <div className="space-y-4">
              {Object.keys(groupedQuizzes).map(cat => (
                  <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <h2 className="font-bold text-gray-700 mb-4 uppercase text-xs tracking-widest">{cat}</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {groupedQuizzes[cat].map(q => (
                              <div key={q.id} className="flex justify-between items-center p-3 border rounded-lg hover:border-blue-300">
                                  <div>
                                      <p className="font-bold text-sm">{q.title}</p>
                                      <p className="text-[10px] text-gray-400">LỚP {q.grade} | {q.questions.length} CÂU</p>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => handleEditQuiz(q)} className="text-blue-500"><Edit size={16}/></button>
                                      <button onClick={async () => { if(confirm('Xóa?')) { await deleteQuiz(q.id); refreshData(); } }} className="text-red-400"><Trash2 size={16}/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      )}

      {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
                      <input type="text" className="w-full text-xl font-black border-b py-2 focus:border-blue-500 outline-none" placeholder="TÊN ĐỀ THI" value={title} onChange={e => setTitle(e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                          <input type="text" className="border rounded p-2 text-sm" placeholder="Chương/Mục" value={category} onChange={e => setCategory(e.target.value)} />
                          <select className="border rounded p-2 text-sm font-bold" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <select className="border rounded p-2 text-sm" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện tập</option><option value="test">Kiểm tra</option></select>
                          <input type="number" className="border rounded p-2 text-sm" placeholder="Thời gian (phút)" value={duration} onChange={e => setDuration(parseInt(e.target.value))} />
                      </div>
                  </div>
                  {renderEditorPart('mcq', 'Phần I: Trắc nghiệm 4 lựa chọn')}
                  {renderEditorPart('group-tf', 'Phần II: Câu hỏi Đúng/Sai')}
                  {renderEditorPart('short', 'Phần III: Trả lời ngắn')}
              </div>
              <div className="sticky top-20 bg-white p-6 rounded-xl shadow-lg border border-blue-50 h-max space-y-6">
                  <h4 className="font-black text-center text-xs uppercase tracking-widest text-gray-400">TỔNG QUAN ĐỀ</h4>
                  <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500">Số câu:</span>
                      <span className="text-xl font-black text-blue-600">{questions.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500">Thang điểm:</span>
                      <span className="text-xl font-black text-blue-600">{questions.reduce((acc, curr) => acc + (parseFloat(curr.points as string) || 0), 0).toFixed(2)}</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                      <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} /> CÔNG KHAI ĐỀ THI
                  </label>
                  <button onClick={handleSaveQuiz} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl transition-all">LƯU ĐỀ THI</button>
              </div>
          </div>
      )}

      {activeTab === 'auto' && (
          <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl space-y-6">
              <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Sparkles className="text-purple-500"/> SOẠN ĐỀ BẰNG TRÍ TUỆ NHÂN TẠO</h2>
              <textarea className="w-full h-40 p-4 border-2 rounded-xl focus:border-purple-400 outline-none" placeholder="Ví dụ: Đề kiểm tra 1 tiết chương Đạo Hàm lớp 11, mức độ Thông hiểu..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} />
              <button onClick={handleAutoGenerate} disabled={isProcessing} className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-100">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Zap />} BẮT ĐẦU SOẠN
              </button>
          </div>
      )}

      {activeTab === 'import' && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-xl space-y-6 border-2 border-dashed border-indigo-100 flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><Upload size={32}/></div>
              <h2 className="text-xl font-black">NHẬP FILE PDF</h2>
              <input type="file" accept=".pdf" className="text-sm" onChange={e => setFile(e.target.files?.[0] || null)} />
              <button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                  {isProcessing ? <Loader2 className="animate-spin" /> : <FileText />} PHÂN TÍCH PDF
              </button>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/90 z-50 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
              <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <h3 className="text-xl font-black text-gray-800">{loadingMsg}</h3>
              <p className="text-gray-400 text-xs font-bold uppercase mt-2 tracking-widest">Hệ thống đang làm việc...</p>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
