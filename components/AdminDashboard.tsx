
import { useState, useEffect, useRef, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, QuizType, Result, User, Role } from '../types';
import { saveQuiz, updateQuiz, getQuizzes, deleteQuiz, getResults, uploadImage, getUsers, saveUser, deleteUser, updateUser, deleteResult } from '../services/storage';
import { parseQuestionsFromPDF, generateQuizFromPrompt } from '../services/gemini';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, List, Upload, FileText, BarChart3, Edit, XCircle, Filter, BookOpen, Lightbulb, Users, ChevronRight, Database, Bold, Italic, Underline, CornerDownLeft, Sigma, Info, Settings2, FolderTree, Layers, Sparkles, Zap, BrainCircuit, RefreshCw, Loader2, PieChart, TrendingUp, UserCheck, Calendar, ListChecks, Search, GraduationCap, CheckCircle, Trophy, HelpCircle, Download, ExternalLink, Eye, Image as ImageIcon, X, Link as LinkIcon, Printer, FileDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import LatexText from './LatexText';

// --- HELPER COMPONENTS ---
interface ToolbarButtonProps { onClick: () => void; icon?: React.ReactNode; label?: string; tooltip: string; }
const ToolbarBtn: React.FC<ToolbarButtonProps> = ({ onClick, icon, label, tooltip }) => (
    <button type="button" onClick={onClick} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-medium text-xs flex items-center gap-1 border border-transparent hover:border-gray-300 transition-all min-w-[24px] justify-center" title={tooltip}>
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
                <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} className={`w-full p-3 outline-none text-sm font-mono leading-relaxed resize-y ${className}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            ) : (
                <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" className={`w-full p-2 outline-none text-sm font-medium ${className}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import' | 'results' | 'students' | 'auto'>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Filters
  const [quizFilterGrade, setQuizFilterGrade] = useState<Grade | 'all'>('all');
  const [resultFilterQuizId, setResultFilterQuizId] = useState<string>('all');
  const [studentFilterGrade, setStudentFilterGrade] = useState<Grade | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  // Modal states
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<User | null>(null);
  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);

  // AI Auto Gen State
  const [aiTopic, setAiTopic] = useState('');
  const [aiConfig, setAiConfig] = useState({ p1: 10, p2: 4, p3: 6, diff: 'Thông hiểu' });

  const loadingMessages = ['Đang trích xuất dữ liệu...', 'Đang nhận diện công thức toán học...', 'Đang phân tích lời giải chi tiết...', 'Đang hoàn tất cấu trúc đề thi...'];

  const groupedQuizzes = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    const filtered = quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade);
    
    filtered.forEach((q: Quiz) => {
      const catName = q.category || 'Chưa phân loại';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(q);
    });
    return groups;
  }, [quizzes, quizFilterGrade]);

  const filteredResults = useMemo(() => {
    return results.filter(r => {
        const quiz = quizzes.find(q => q.id === r.quizId);
        const matchesQuiz = resultFilterQuizId === 'all' || r.quizId === resultFilterQuizId;
        const matchesGrade = quizFilterGrade === 'all' || (quiz && quiz.grade === quizFilterGrade);
        return matchesQuiz && matchesGrade;
    }).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [results, resultFilterQuizId, quizFilterGrade, quizzes]);

  const stats = useMemo(() => {
    const totalResults = filteredResults.length;
    const avgScore = totalResults > 0 ? filteredResults.reduce((sum, r) => sum + r.score, 0) / totalResults : 0;
    const topScore = totalResults > 0 ? Math.max(...filteredResults.map(r => r.score)) : 0;
    return { totalResults, avgScore, topScore };
  }, [filteredResults]);

  const filteredStudents = useMemo(() => {
      return users.filter(u => u.role === 'student' && (studentFilterGrade === 'all' || u.grade === studentFilterGrade));
  }, [users, studentFilterGrade]);

  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    quizzes.forEach((q: Quiz) => { if (q.category) cats.add(q.category); });
    return Array.from(cats).sort();
  }, [quizzes]);

  useEffect(() => { refreshData(); }, [activeTab]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      let step = 0;
      interval = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        setLoadingMsg(loadingMessages[step]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const refreshData = async () => {
    const qData = await getQuizzes();
    setQuizzes(qData);
    const rData = await getResults();
    setResults(rData);
    const uData = await getUsers();
    setUsers(uData);
  };

  const resetForm = () => {
    setEditingId(null); setTitle(''); setDescription(''); setCategory(''); setQuestions([]); setStartTime(''); setDuration(90); setFile(null); setIsPublished(false);
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: prev[cat] === false ? true : false
    }));
  };

  const handleSaveQuiz = async () => {
    if (!title.trim()) { alert("Vui lòng nhập tên đề thi."); return; }
    if (questions.length === 0) { alert("Đề thi cần ít nhất 1 câu hỏi."); return; }
    const quizData: Quiz = {
      id: editingId || uuidv4(), title, description, category: category.trim() || undefined, type: quizType, grade, startTime: quizType === 'test' ? startTime : undefined, durationMinutes: duration, questions, createdAt: editingId ? (quizzes.find(q => q.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(), isPublished: isPublished
    };
    if (editingId) await updateQuiz(quizData); else await saveQuiz(quizData);
    await refreshData(); setActiveTab('list'); resetForm();
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingId(quiz.id); setTitle(quiz.title); setDescription(quiz.description); setCategory(quiz.category || ''); setQuizType(quiz.type); setGrade(quiz.grade); setStartTime(quiz.startTime || ''); setDuration(quiz.durationMinutes); setQuestions(quiz.questions); setIsPublished(quiz.isPublished); setActiveTab('create');
  };

  const handleAutoGenerate = async () => {
      if (!aiTopic.trim()) { alert("Vui lòng nhập chủ đề."); return; }
      setIsProcessing(true);
      try {
          const generated = await generateQuizFromPrompt({
              grade,
              category: category || "Chung",
              topic: aiTopic,
              part1Count: aiConfig.p1,
              part2Count: aiConfig.p2,
              part3Count: aiConfig.p3,
              difficulty: aiConfig.diff
          });
          setQuestions(prev => [...prev, ...generated]);
          if (!title.trim()) setTitle(`Đề thi AI - ${aiTopic}`);
          alert(`Đã soạn thêm ${generated.length} câu hỏi. Hãy kiểm tra lại ở Tab Soạn Đề!`);
          setActiveTab('create');
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleFileUpload = async () => {
    if (!file) { alert("Vui lòng chọn file PDF."); return; }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Str = (reader.result as string).split(',')[1];
      try {
        const extracted = await parseQuestionsFromPDF(base64Str);
        setQuestions(prev => [...prev, ...extracted]);
        alert(`Đã phân tích và thêm ${extracted.length} câu hỏi từ PDF!`);
        setActiveTab('create');
      } catch (e: any) { alert(e.message); } finally { setIsProcessing(false); }
    };
  };

  const exportResultsToCSV = () => {
    if (filteredResults.length === 0) return;
    const header = "Học sinh,Đề thi,Ngày nộp,Điểm số,Thời gian (giây)\n";
    const rows = filteredResults.map(r => {
        const qTitle = quizzes.find(q => q.id === r.quizId)?.title || "N/A";
        return `"${r.studentName}","${qTitle}","${format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm")}","${r.score}","${r.durationSeconds}"`;
    }).join("\n");
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + header + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ket_qua_thi_khoi_${quizFilterGrade}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, questionIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLoadingMsg("Đang tải ảnh lên...");
    try {
        const url = await uploadImage(file);
        if (url) {
            const n = [...questions];
            n[questionIndex].imageUrl = url;
            setQuestions(n);
        }
    } catch (err) {
        alert("Lỗi khi tải ảnh lên.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleExportWord = (quiz: Quiz) => {
    if (!quiz) return;

    const getOptionChar = (i: number) => String.fromCharCode(65 + i);

    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.4; font-size: 12pt; margin: 1in; }
          .header { text-align: center; margin-bottom: 24px; }
          .title { font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
          .subtitle { font-size: 12pt; margin-bottom: 15px; }
          .student-info { text-align: left; margin-bottom: 20px; font-weight: normal; }
          .section-header { font-weight: bold; margin-top: 15px; margin-bottom: 8px; text-decoration: none; }
          .question { margin-top: 10px; margin-bottom: 5px; }
          .question-num { font-weight: bold; }
          .options { margin-left: 25px; margin-bottom: 10px; }
          .image-container { text-align: center; margin: 10px 0; }
          .image-container img { max-width: 4in; height: auto; border: 1pt solid #eee; }
          .ans-table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          .ans-table th, .ans-table td { border: 1pt solid black; padding: 4px; text-align: center; font-size: 10pt; }
          .footer-note { font-style: italic; text-align: center; margin-top: 30px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${quiz.title}</div>
          <div class="subtitle">Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</div>
        </div>
        
        <div class="student-info">
          Họ và tên thí sinh: ............................................................................................ <br/>
          Số báo danh: .......................................................................................................
        </div>
    `;

    // Phần I: MCQ
    const mcqQuestions = quiz.questions.filter(q => q.type === 'mcq');
    if (mcqQuestions.length > 0) {
      content += `<div class="section-header">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu ${mcqQuestions.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.</div>`;
      mcqQuestions.forEach((q, i) => {
        content += `<div class="question"><span class="question-num">Câu ${i + 1}.</span> ${q.text}</div>`;
        if (q.imageUrl) content += `<div class="image-container"><img src="${q.imageUrl}" /></div>`;
        if (q.options) {
          content += `<div class="options">`;
          q.options.forEach((opt, oi) => {
            content += `<div><b>${getOptionChar(oi)}.</b> ${opt}</div>`;
          });
          content += `</div>`;
        }
      });
    }

    // Phần II: True/False
    const tfQuestions = quiz.questions.filter(q => q.type === 'group-tf');
    if (tfQuestions.length > 0) {
      content += `<div class="section-header">PHẦN II. Câu trắc nghiệm đúng sai. Thí sinh trả lời từ câu 1 đến câu ${tfQuestions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.</div>`;
      tfQuestions.forEach((q, i) => {
        content += `<div class="question"><span class="question-num">Câu ${i + 1}.</span> ${q.text}</div>`;
        if (q.imageUrl) content += `<div class="image-container"><img src="${q.imageUrl}" /></div>`;
        if (q.subQuestions) {
          content += `<div class="options">`;
          q.subQuestions.forEach((sq, si) => {
            content += `<div><b>${String.fromCharCode(97 + si)})</b> ${sq.text}</div>`;
          });
          content += `</div>`;
        }
      });
    }

    // Phần III: Short
    const shortQuestions = quiz.questions.filter(q => q.type === 'short');
    if (shortQuestions.length > 0) {
      content += `<div class="section-header">PHẦN III. Câu trắc nghiệm trả lời ngắn. Thí sinh trả lời từ câu 1 đến câu ${shortQuestions.length}.</div>`;
      shortQuestions.forEach((q, i) => {
        content += `<div class="question"><span class="question-num">Câu ${i + 1}.</span> ${q.text}</div>`;
        if (q.imageUrl) content += `<div class="image-container"><img src="${q.imageUrl}" /></div>`;
      });
    }

    // Bảng đáp án gọn gàng (Nhiều cột)
    content += `
      <div style="page-break-before: always;"></div>
      <div class="section-header" style="text-align: center;">BẢNG ĐÁP ÁN</div>
      <table class="ans-table">
        <tr>
          <th>Câu</th><th>Đáp án</th>
          <th>Câu</th><th>Đáp án</th>
          <th>Câu</th><th>Đáp án</th>
        </tr>
    `;
    
    for (let i = 0; i < quiz.questions.length; i += 3) {
      content += '<tr>';
      for (let j = 0; j < 3; j++) {
        const qIdx = i + j;
        if (qIdx < quiz.questions.length) {
          const q = quiz.questions[qIdx];
          let ans = "";
          if (q.type === 'mcq') {
              const optIdx = q.options?.indexOf(q.correctAnswer || "");
              ans = optIdx !== undefined && optIdx >= 0 ? getOptionChar(optIdx) : (q.correctAnswer || "");
          } else if (q.type === 'short') {
              ans = q.correctAnswer || "";
          } else if (q.type === 'group-tf' && q.subQuestions) {
              ans = q.subQuestions.map((sq, si) => `${String.fromCharCode(97+si)}:${sq.correctAnswer === 'True' ? 'Đ' : 'S'}`).join(' ');
          }
          content += `<td style="font-weight:bold">${qIdx + 1}</td><td>${ans}</td>`;
        } else {
          content += '<td></td><td></td>';
        }
      }
      content += '</tr>';
    }

    content += `
      </table>
      <div class="footer-note">--- HẾT ---</div>
      </body></html>
    `;

    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_thi_${quiz.title.replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPartEditor = (type: QuestionType, label: string, colorClass: string) => {
    return (
      <div className={`mt-8 border-l-4 ${colorClass} bg-white rounded-r-xl shadow-sm overflow-hidden`}>
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="font-extrabold text-gray-800 uppercase flex items-center gap-2">{label}</h3>
          <div className="flex gap-2">
            <button onClick={() => { setBankTargetType(type); setShowBankModal(true); setBankSelectedQuizId(''); }} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 transition-all"><Database size={14}/> Ngân hàng</button>
            <button onClick={() => {
                let q: Question;
                if (type === 'mcq') q = { id: uuidv4(), type: 'mcq', text: '', points: 0.25, options: ['', '', '', ''], correctAnswer: '', solution: '' };
                else if (type === 'group-tf') q = { id: uuidv4(), type: 'group-tf', text: '', points: 1.0, subQuestions: [{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'},{id:uuidv4(),text:'',correctAnswer:'True'}], solution: '' };
                else q = { id: uuidv4(), type: 'short', text: '', points: 0.5, correctAnswer: '', solution: '' };
                setQuestions([...questions, q]);
            }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm transition-all"><Plus size={14}/> Thêm câu</button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {questions.filter(q => q.type === type).map((q, idx) => {
            const actualIdx = questions.findIndex(item => item.id === q.id);
            return (
              <div key={q.id} className="border rounded-xl p-4 bg-white hover:border-gray-300 transition-colors shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-dashed text-sm">
                    <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Câu {actualIdx + 1}</span>
                    <div className="flex items-center gap-3">
                        <input type="text" className="w-14 border rounded p-1 text-center font-bold text-xs bg-gray-50" value={q.points} onChange={(e) => {
                            const n = [...questions]; n[actualIdx].points = e.target.value; setQuestions(n);
                        }} />
                        <button onClick={() => { if(window.confirm('Xóa câu hỏi này?')) { const n = [...questions]; n.splice(actualIdx,1); setQuestions(n); }}} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded-full transition-all"><Trash2 size={16}/></button>
                    </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1 tracking-tight">Câu {actualIdx + 1}: Nội dung chính</label>
                    <RichTextEditor rows={3} value={q.text} onChange={(val) => { const n = [...questions]; n[actualIdx].text = val; setQuestions(n); }} placeholder="Nhập nội dung câu hỏi..." />
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <input type="file" accept="image/*" className="hidden" id={`img-upload-${q.id}`} onChange={(e) => handleQuestionImageUpload(e, actualIdx)} />
                        <label htmlFor={`img-upload-${q.id}`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase cursor-pointer hover:bg-blue-700 transition-all shadow-md">
                            <ImageIcon size={16}/> {q.imageUrl ? "Đổi hình ảnh" : "Tải hình ảnh lên"}
                        </label>
                        {q.imageUrl && (
                            <button onClick={() => { const n = [...questions]; n[actualIdx].imageUrl = undefined; setQuestions(n); }} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-all border border-red-100">
                                <X size={16}/>
                            </button>
                        )}
                    </div>

                    {q.imageUrl && (
                        <div className="flex items-center gap-2 text-xs text-blue-500 font-medium p-2 bg-blue-50 rounded-lg border border-blue-100 overflow-hidden">
                            <LinkIcon size={14} className="shrink-0"/>
                            <span className="truncate">{q.imageUrl}</span>
                        </div>
                    )}

                    {(q.text.trim() || q.imageUrl) && (
                        <div className="p-4 bg-blue-50/20 border border-blue-200 rounded-2xl relative shadow-inner overflow-hidden">
                           <span className="absolute top-2 right-2 text-[9px] font-black text-blue-400 uppercase flex items-center gap-1 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100"><Eye size={10}/> Preview Hiển Thị</span>
                           <div className="text-sm text-gray-800 leading-relaxed font-medium">
                               <LatexText text={q.text || '...'}/>
                               {q.imageUrl && (
                                    <div className="mt-4 flex justify-center bg-white p-2 rounded-xl border">
                                        <img src={q.imageUrl} className="max-h-64 object-contain rounded-lg" alt="Preview" />
                                    </div>
                               )}
                           </div>
                        </div>
                    )}
                  </div>

                  {q.type === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="space-y-2">
                            <div className="flex items-center gap-2 bg-gray-100/50 p-2 rounded-xl border border-gray-200">
                                <input type="radio" name={`correct-${q.id}`} className="w-5 h-5 accent-blue-600" checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const n = [...questions]; n[actualIdx].correctAnswer = opt; setQuestions(n); }} />
                                <RichTextEditor className="flex-1 border-none bg-transparent" value={opt} onChange={(val) => { const o = [...(q.options||[])]; o[optIdx]=val; const n = [...questions]; n[actualIdx].options=o; setQuestions(n); }} placeholder={`Đáp án ${String.fromCharCode(65+optIdx)}...`} />
                            </div>
                            {opt.trim() && (
                                <div className="text-[11px] bg-white px-3 py-1 border rounded-lg text-gray-500 font-medium"><LatexText text={opt}/></div>
                            )}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === 'group-tf' && q.subQuestions && (
                      <div className="space-y-6">
                          {q.subQuestions.map((sq, sqIdx) => (
                              <div key={sq.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner space-y-3">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                      <span className="text-xs font-black text-blue-600 w-6 uppercase tracking-widest">{String.fromCharCode(97+sqIdx)})</span>
                                      <input type="text" className="flex-1 w-full border-2 border-white rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 shadow-sm transition-all" value={sq.text} onChange={(e) => {
                                          const n = [...questions];
                                          const sub = [...(q.subQuestions||[])];
                                          sub[sqIdx] = {...sub[sqIdx], text: e.target.value};
                                          n[actualIdx].subQuestions = sub;
                                          setQuestions(n);
                                      }} placeholder={`Nội dung ý ${String.fromCharCode(97+sqIdx)}...`}/>
                                      
                                      <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                const n = [...questions];
                                                const sub = [...(q.subQuestions||[])];
                                                sub[sqIdx] = {...sub[sqIdx], correctAnswer: 'True'};
                                                n[actualIdx].subQuestions = sub;
                                                setQuestions(n);
                                            }}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${sq.correctAnswer === 'True' ? 'bg-green-600 border-green-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
                                        >
                                            ĐÚNG
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const n = [...questions];
                                                const sub = [...(q.subQuestions||[])];
                                                sub[sqIdx] = {...sub[sqIdx], correctAnswer: 'False'};
                                                n[actualIdx].subQuestions = sub;
                                                setQuestions(n);
                                            }}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${sq.correctAnswer === 'False' ? 'bg-orange-600 border-orange-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-400'}`}
                                        >
                                            SAI
                                        </button>
                                      </div>
                                  </div>

                                  {sq.text.trim() && (
                                      <div className="ml-9 p-3 bg-white/60 border border-white rounded-xl text-xs font-medium text-gray-600 relative">
                                          <span className="absolute top-1 right-2 text-[8px] font-black text-gray-300 uppercase tracking-widest">Preview {String.fromCharCode(97+sqIdx)}</span>
                                          <LatexText text={sq.text}/>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  )}

                  {q.type === 'short' && (
                      <div className="flex items-center gap-3 bg-green-50/50 p-4 rounded-2xl border border-green-100 shadow-inner">
                          <span className="text-sm font-bold text-green-700 whitespace-nowrap">Đáp án đúng (số):</span>
                          <input type="text" className="border-2 border-green-100 rounded-xl p-3 flex-1 focus:border-green-400 outline-none font-black text-lg bg-white shadow-sm" value={q.correctAnswer || ''} onChange={(e) => { const n = [...questions]; n[actualIdx].correctAnswer = e.target.value; setQuestions(n); }} placeholder="Ví dụ: 6.5" />
                      </div>
                  )}

                  <div className="mt-6 p-4 bg-yellow-50 rounded-2xl border-2 border-yellow-100 relative overflow-hidden group">
                    <h5 className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1 mb-3 tracking-widest"><Lightbulb size={12}/> Giải chi tiết câu {actualIdx + 1}:</h5>
                    <RichTextEditor rows={3} value={q.solution || ''} onChange={(val) => { const n = [...questions]; n[actualIdx].solution = val; setQuestions(n); }} placeholder="Hướng dẫn giải cho câu này..." />
                    
                    {q.solution && q.solution.trim() && (
                        <div className="mt-3 p-4 bg-white/80 border border-yellow-200 rounded-xl shadow-sm relative backdrop-blur-sm">
                            <span className="absolute top-2 right-2 text-[9px] font-black text-yellow-300 uppercase flex items-center gap-1 px-1.5 py-0.5 rounded border border-yellow-100 bg-white"><Eye size={10}/> Preview Giải</span>
                            <div className="text-sm text-gray-700 leading-relaxed"><LatexText text={q.solution}/></div>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-black text-gray-800 flex items-center gap-2 tracking-tight"><Settings2 className="text-blue-600" size={32} /> EDUQUIZ <span className="text-blue-600">ADMIN</span></h1>
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border">
              {(['all', '10', '11', '12'] as const).map(g => (
                  <button key={g} onClick={() => setQuizFilterGrade(g)} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizFilterGrade === g ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ KHỐI' : `LỚP ${g}`}</button>
              ))}
          </div>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        <button onClick={() => { setActiveTab('list'); resetForm(); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'list' ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><List size={18} /> QUẢN LÝ ĐỀ</button>
        <button onClick={() => { setActiveTab('create'); if(!editingId && questions.length === 0) resetForm(); }} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'create' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Plus size={18} /> SOẠN ĐỀ MỚI</button>
        <button onClick={() => setActiveTab('auto')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'auto' ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BrainCircuit size={18} /> SOẠN ĐỀ AI</button>
        <button onClick={() => setActiveTab('import')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'import' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Upload size={18} /> NHẬP TỪ PDF</button>
        <button onClick={() => setActiveTab('results')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'results' ? 'bg-green-600 text-white border-green-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><BarChart3 size={18} /> KẾT QUẢ</button>
        <button onClick={() => setActiveTab('students')} className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 whitespace-nowrap transition-all border ${activeTab === 'students' ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white text-gray-500 hover:bg-gray-50'}`}><Users size={18} /> HỌC SINH</button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-fade-in">
          {Object.keys(groupedQuizzes).length === 0 ? (
              <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-gray-200 text-center flex flex-col items-center">
                  <div className="p-6 bg-gray-50 rounded-full text-gray-300 mb-4"><Database size={48}/></div>
                  <h3 className="text-xl font-bold text-gray-400">Không tìm thấy đề thi cho khối này.</h3>
                  <button onClick={() => setActiveTab('create')} className="mt-4 text-blue-600 font-bold hover:underline">Tạo đề ngay!</button>
              </div>
          ) : (
            Object.keys(groupedQuizzes).sort().map(cat => (
              <div key={cat} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <button onClick={() => toggleCategory(cat)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50/50 hover:bg-gray-100/50 transition-all border-b text-left">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg"><FolderTree size={20}/></div>
                    <div><h3 className="font-bold text-gray-800 uppercase text-sm tracking-wide">{cat}</h3><p className="text-[10px] text-gray-400 font-bold uppercase">{groupedQuizzes[cat].length} bài đăng</p></div>
                  </div>
                  <ChevronRight size={20} className={`text-gray-400 transition-transform ${expandedCategories[cat] === false ? '' : 'rotate-90'}`}/>
                </button>
                {(expandedCategories[cat] !== false) && (
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
                    {groupedQuizzes[cat].map(q => (
                      <div key={q.id} className="bg-white p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex justify-between items-center group">
                        <div className="flex items-center gap-4 overflow-hidden">
                          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${q.type === 'test' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                            {q.type === 'test' ? <FileText size={24}/> : <BookOpen size={24}/>}
                          </div>
                          <div className="overflow-hidden"><h3 className="font-bold text-gray-800 truncate">{q.title}</h3><div className="flex gap-2 items-center mt-1"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${q.isPublished ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>{q.isPublished ? 'CÔNG KHAI' : 'BẢN NHÁP'}</span><span className="text-[9px] text-gray-400 font-bold">LỚP {q.grade} | {q.questions.length} CÂU</span></div></div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setViewingQuiz(q)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all" title="Xem đề & Xuất file"><Eye size={18}/></button>
                          <button onClick={() => handleEditQuiz(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chỉnh sửa"><Edit size={18}/></button>
                          <button onClick={async () => { if(window.confirm('Xóa đề thi này?')) { await deleteQuiz(q.id); refreshData(); } }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="Xóa"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {viewingQuiz && (
          <div className="fixed inset-0 bg-black/70 z-[400] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg"><BookOpen size={24}/></div>
                          <div>
                              <h3 className="text-xl font-black uppercase tracking-tight">Xem trước đề thi</h3>
                              <p className="text-[10px] font-bold text-blue-300">NỘI DUNG HIỂN THỊ CHUẨN</p>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => handleExportWord(viewingQuiz)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"><FileDown size={18}/> Xuất File Word (.doc)</button>
                          <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all"><Printer size={18}/> In nhanh</button>
                          <button onClick={() => setViewingQuiz(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><XCircle size={28}/></button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 bg-gray-50 print-area">
                      <div className="max-w-3xl mx-auto bg-white p-10 shadow-xl rounded-2xl min-h-screen border">
                          <div className="text-center mb-10 pb-6 border-b-2 border-slate-100">
                              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">{viewingQuiz.title}</h2>
                              <div className="text-gray-500 font-bold uppercase text-xs tracking-[0.2em]">Khối {viewingQuiz.grade} | {viewingQuiz.durationMinutes} Phút | {viewingQuiz.questions.length} Câu hỏi</div>
                          </div>

                          <div className="space-y-12">
                              {/* PHẦN I */}
                              {viewingQuiz.questions.filter(q => q.type === 'mcq').length > 0 && (
                                  <div>
                                      <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 border-l-4 border-blue-500 pl-3 uppercase text-sm tracking-widest bg-blue-50 py-2">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn</h4>
                                      <div className="space-y-8">
                                          {viewingQuiz.questions.filter(q => q.type === 'mcq').map((q, i) => (
                                              <div key={q.id}>
                                                  <div className="font-bold text-gray-800 mb-3"><span className="text-blue-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                                  {q.imageUrl && <img src={q.imageUrl} className="max-h-64 mx-auto my-4 rounded border block" />}
                                                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 ml-6">
                                                      {q.options?.map((opt, oi) => (
                                                          <div key={oi} className="text-sm text-gray-700"><span className="font-bold mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>
                                                      ))}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {/* PHẦN II */}
                              {viewingQuiz.questions.filter(q => q.type === 'group-tf').length > 0 && (
                                  <div>
                                      <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 border-l-4 border-purple-500 pl-3 uppercase text-sm tracking-widest bg-purple-50 py-2">PHẦN II. Câu trắc nghiệm đúng sai</h4>
                                      <div className="space-y-8">
                                          {viewingQuiz.questions.filter(q => q.type === 'group-tf').map((q, i) => (
                                              <div key={q.id}>
                                                  <div className="font-bold text-gray-800 mb-4"><span className="text-purple-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                                  {q.imageUrl && <img src={q.imageUrl} className="max-h-64 mx-auto my-4 rounded border block" />}
                                                  <div className="space-y-2 ml-6">
                                                      {q.subQuestions?.map((sq, si) => (
                                                          <div key={sq.id} className="text-sm text-gray-700 flex gap-2">
                                                              <span className="font-bold text-gray-400 shrink-0">{String.fromCharCode(97+si)})</span>
                                                              <LatexText text={sq.text}/>
                                                          </div>
                                                      ))}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {/* PHẦN III */}
                              {viewingQuiz.questions.filter(q => q.type === 'short').length > 0 && (
                                  <div>
                                      <h4 className="font-black text-slate-900 mb-6 flex items-center gap-2 border-l-4 border-green-500 pl-3 uppercase text-sm tracking-widest bg-green-50 py-2">PHẦN III. Câu trắc nghiệm trả lời ngắn</h4>
                                      <div className="space-y-8">
                                          {viewingQuiz.questions.filter(q => q.type === 'short').map((q, i) => (
                                              <div key={q.id}>
                                                  <div className="font-bold text-gray-800 mb-3"><span className="text-green-600 mr-2">Câu {i+1}.</span> <LatexText text={q.text}/></div>
                                                  {q.imageUrl && <img src={q.imageUrl} className="max-h-64 mx-auto my-4 rounded border block" />}
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'import' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Upload size={32}/></div>
                      <div><h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Nhập đề từ PDF thông minh</h2><p className="text-gray-400 text-sm font-medium">Hệ thống AI tự động bóc tách Câu hỏi, Đáp án và Lời giải.</p></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                          <h4 className="text-xs font-black text-blue-600 uppercase mb-4 tracking-widest flex items-center gap-2"><HelpCircle size={14}/> Mẫu cấu trúc file PDF chuẩn</h4>
                          <div className="space-y-4">
                              <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] leading-relaxed shadow-sm font-mono">
                                  <p className="font-bold text-slate-800">Câu 1. Nội dung câu hỏi...</p>
                                  <p className="ml-2">A. Phương án 1</p>
                                  <p className="ml-2">B. Phương án 2 *</p>
                                  <p className="ml-2">C. Phương án 3</p>
                                  <p className="ml-2">D. Phương án 4</p>
                                  <div className="mt-2 pt-2 border-t border-dashed border-slate-100 text-blue-600 italic">
                                      <p>HƯỚNG DẪN GIẢI</p>
                                      <p>Bước 1: ... Kết quả chọn B.</p>
                                  </div>
                              </div>
                              <ul className="text-[10px] text-slate-500 space-y-2 font-bold uppercase">
                                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Đánh dấu * vào đáp án đúng (Phần I).</li>
                                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Đặt từ khóa "LỜI GIẢI" hoặc "HƯỚNG DẪN GIẢI".</li>
                              </ul>
                          </div>
                      </div>
                      <div className="flex flex-col justify-center items-center p-8 bg-blue-50/20 rounded-3xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden">
                          <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform"><FileText size={40}/></div>
                          <span className="font-black text-blue-600 text-lg">{file ? file.name : "KÉO THẢ FILE PDF VÀO ĐÂY"}</span>
                      </div>
                  </div>
                  <button onClick={handleFileUpload} disabled={!file || isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 disabled:opacity-50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                      {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={24}/>}
                      {isProcessing ? "ĐANG PHÂN TÍCH FILE..." : "BẮT ĐẦU TRÍCH XUẤT CÂU HỎI"}
                  </button>
              </div>
          </div>
      )}

      {activeTab === 'results' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lượt thi khối {quizFilterGrade}</p><p className="text-2xl font-black">{stats.totalResults}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-green-50 text-green-600 rounded-xl"><PieChart size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm trung bình</p><p className="text-2xl font-black">{stats.avgScore.toFixed(2)}</p></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Trophy size={24}/></div>
                      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Điểm cao nhất</p><p className="text-2xl font-black">{stats.topScore.toFixed(2)}</p></div>
                  </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 w-full">
                      <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Lọc theo đề thi (Khối {quizFilterGrade})</label>
                      <select className="w-full border rounded-xl p-3 font-bold text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-100" value={resultFilterQuizId} onChange={e => setResultFilterQuizId(e.target.value)}>
                          <option value="all">Tất cả bài thi</option>
                          {quizzes.filter(q => quizFilterGrade === 'all' || q.grade === quizFilterGrade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                      </select>
                  </div>
                  <div className="flex gap-2 self-end">
                    <button onClick={exportResultsToCSV} className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Download size={18}/> Xuất Excel (CSV)</button>
                    <button onClick={refreshData} className="p-3 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-all shadow-inner"><RefreshCw size={18}/></button>
                  </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest border-b">
                              <tr>
                                  <th className="px-6 py-5">Thí sinh</th>
                                  <th className="px-6 py-5">Đề thi</th>
                                  <th className="px-6 py-5">Ngày nộp</th>
                                  <th className="px-6 py-5 text-center">Thời gian</th>
                                  <th className="px-6 py-5 text-right">Điểm số</th>
                                  <th className="px-6 py-5 text-center">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {filteredResults.length === 0 ? (
                                  <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-bold">Chưa có kết quả nào.</td></tr>
                              ) : (
                                filteredResults.map(r => (
                                    <tr key={r.id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="px-6 py-4 font-bold text-gray-800">{r.studentName}</td>
                                        <td className="px-6 py-4 font-medium text-gray-500 truncate max-w-[200px]">{quizzes.find(q => q.id === r.quizId)?.title || "Đề đã xóa"}</td>
                                        <td className="px-6 py-4 text-gray-400 font-medium">{format(parseISO(r.submittedAt), "HH:mm dd/MM")}</td>
                                        <td className="px-6 py-4 text-center text-gray-500 font-mono">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                        <td className="px-6 py-4 text-right"><span className={`font-black text-xl ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{r.score.toFixed(2)}</span></td>
                                        <td className="px-6 py-4 text-center"><button onClick={async () => { if(window.confirm('Xóa vĩnh viễn kết quả này?')) { await deleteResult(r.id); refreshData(); } }} className="p-2 text-gray-300 group-hover:text-red-500 transition-all"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'students' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                      {(['all', '10', '11', '12'] as const).map(g => (
                          <button key={g} onClick={() => setStudentFilterGrade(g)} className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${studentFilterGrade === g ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{g === 'all' ? 'TẤT CẢ' : `KHỐI ${g}`}</button>
                      ))}
                  </div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tổng số: {filteredStudents.length} học sinh</div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                              <tr>
                                  <th className="px-6 py-5">Học sinh</th>
                                  <th className="px-6 py-5">Tên đăng nhập</th>
                                  <th className="px-6 py-5">Khối</th>
                                  <th className="px-6 py-5 text-center">Thống kê rèn luyện</th>
                                  <th className="px-6 py-5 text-center">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y text-sm">
                              {filteredStudents.length === 0 ? (
                                  <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold">Không có học sinh nào.</td></tr>
                              ) : (
                                filteredStudents.map(u => {
                                    const studentResults = results.filter(r => r.studentId === u.id);
                                    const avg = studentResults.length > 0 ? (studentResults.reduce((s,r) => s+r.score, 0) / studentResults.length).toFixed(2) : "0.00";
                                    return (
                                        <tr key={u.id} className="hover:bg-indigo-50/20 transition-all group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black"><GraduationCap size={20}/></div>
                                                    <span className="font-bold text-gray-800">{u.fullName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-gray-500">{u.username}</td>
                                            <td className="px-6 py-4"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">Lớp {u.grade}</span></td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => setSelectedStudentForDetails(u)} className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">
                                                    <Trophy size={14}/> {studentResults.length} Đề | Avg: {avg}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => { if(window.confirm('Xóa tài khoản này khỏi hệ thống?')) { deleteUser(u.id); refreshData(); } }} className="p-2.5 text-gray-300 group-hover:text-red-500 transition-all"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    );
                                })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'auto' && (
          <div className="max-w-5xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                          <div className="flex items-center gap-2 mb-6 text-purple-600 font-black uppercase text-xs tracking-widest"><Zap size={20}/> Cấu hình AI</div>
                          <div className="space-y-4">
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khối lớp</label><select className="w-full border-2 rounded-xl p-3 bg-gray-50 font-bold focus:border-purple-300 outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                              <div><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Độ khó</label><select className="w-full border-2 rounded-xl p-3 bg-gray-50 font-bold focus:border-purple-300 outline-none" value={aiConfig.diff} onChange={e=>setAiConfig({...aiConfig, diff:e.target.value})}><option value="Nhận biết">Nhận biết</option><option value="Thông hiểu">Thông hiểu</option><option value="Vận dụng">Vận dụng</option><option value="Vận dụng cao">Vận dụng cao</option></select></div>
                              <div className="pt-4 border-t border-dashed">
                                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-3">Số lượng câu cần soạn</label>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">Phần I</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p1} onChange={e=>setAiConfig({...aiConfig, p1:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">Phần II</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p2} onChange={e=>setAiConfig({...aiConfig, p2:Number(e.target.value)})}/></div>
                                      <div><span className="text-[9px] text-gray-400 font-bold uppercase">Phần III</span><input type="number" className="w-full border rounded-lg p-2 text-center font-bold" value={aiConfig.p3} onChange={e=>setAiConfig({...aiConfig, p3:Number(e.target.value)})}/></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-3xl shadow-xl border border-purple-100 relative overflow-hidden group">
                          <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tighter">Bạn muốn AI soạn đề gì?</h3>
                          <p className="text-gray-400 text-sm mb-6 font-medium">Nhập chi tiết yêu cầu về kiến thức. AI sẽ tự động thêm vào danh sách đang soạn.</p>
                          <textarea className="w-full border-2 border-purple-50 rounded-2xl p-6 text-lg focus:border-purple-300 outline-none transition-all bg-purple-50/5 min-h-[220px]" placeholder="Ví dụ: Đề cương ôn tập Chương 1: Hàm số lớp 12..." value={aiTopic} onChange={e=>setAiTopic(e.target.value)} />
                          <div className="mt-8 flex flex-col md:flex-row gap-4">
                              <button onClick={()=>{setAiTopic(''); setQuestions([]);}} className="px-8 py-4 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-all uppercase text-xs tracking-widest flex items-center justify-center gap-2"><RefreshCw size={18}/> Làm lại</button>
                              <button onClick={handleAutoGenerate} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-lg py-5 rounded-2xl shadow-2xl transform active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 tracking-widest">
                                  {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles />} {isProcessing ? "ĐANG SOẠN THÊM..." : "BẮT ĐẦU SOẠN THÊM BẰNG AI"}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
               <h3 className="text-xl font-black mb-6 text-gray-800 flex items-center gap-2 border-b pb-4 uppercase tracking-tighter"><Info className="text-blue-500"/> {editingId ? 'Sửa thông tin đề' : 'Cài đặt đề mới'}</h3>
               <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tên bài thi / Đề kiểm tra</label>
                    <input type="text" className="w-full border-2 border-gray-100 rounded-2xl p-4 focus:border-blue-500 outline-none transition font-black text-xl bg-gray-50/30" placeholder="VD: Kiểm tra cuối kỳ 1..." value={title} onChange={e => setTitle(e.target.value)}/>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Chương / Mục kiến thức</label>
                        <div className="relative"><Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/><input list="cat-list" type="text" className="w-full border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-3 focus:border-blue-500 outline-none transition bg-white font-bold" placeholder="VD: Chương 2..." value={category} onChange={e => setCategory(e.target.value)}/><datalist id="cat-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist></div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Hình thức</label><select className="w-full border-2 border-gray-100 rounded-2xl p-3 bg-white font-bold outline-none focus:border-blue-500" value={quizType} onChange={e => setQuizType(e.target.value as QuizType)}><option value="practice">Luyện Tập</option><option value="test">Kiểm Tra</option></select></div>
                        <div className="flex-1"><label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Khối lớp</label><select className="w-full border-2 border-gray-100 rounded-2xl p-3 bg-white font-bold outline-none focus:border-blue-500" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="10">Lớp 10</option><option value="11">Lớp 11</option><option value="12">Lớp 12</option></select></div>
                    </div>
                 </div>
               </div>
             </div>
             {renderPartEditor('mcq', 'Phần I: Lựa chọn 4 đáp án', 'border-blue-500')}
             {renderPartEditor('group-tf', 'Phần II: Câu hỏi Đúng/Sai', 'border-purple-500')}
             {renderPartEditor('short', 'Phần III: Trả lời ngắn', 'border-green-500')}
           </div>
           <div className="space-y-6">
               <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-2xl sticky top-24 text-center">
                  <div className="flex justify-center mb-6"><div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><Sparkles size={32}/></div></div>
                  <h4 className="text-[10px] font-black text-gray-400 uppercase mb-8 tracking-widest">Tóm tắt đề thi</h4>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase mb-1">Câu hỏi</p><p className="text-2xl font-black text-blue-600">{questions.length}</p></div>
                    <div className="p-4 bg-gray-50 rounded-2xl"><p className="text-[9px] font-black text-gray-400 uppercase mb-1">Thang điểm</p><p className="text-2xl font-black text-blue-600">{questions.reduce((s, q) => s + (parseFloat(String(q.points)) || 0), 0).toFixed(2)}</p></div>
                  </div>
                  <div className="mb-8">
                      <label className="flex items-center justify-center gap-3 cursor-pointer p-4 bg-blue-50 rounded-2xl font-bold text-sm text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all">
                          <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500" />
                          Công bố công khai
                      </label>
                  </div>
                  <button onClick={handleSaveQuiz} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black shadow-2xl transform active:scale-95 transition-all flex items-center justify-center gap-2 tracking-widest uppercase text-sm"><Save size={20} /> HOÀN TẤT & LƯU ĐỀ</button>
               </div>
           </div>
        </div>
      )}

      {selectedStudentForDetails && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
              <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg"><Users size={24}/></div>
                    <div><h3 className="text-xl font-black uppercase tracking-tight">Chi tiết rèn luyện: {selectedStudentForDetails.fullName}</h3><p className="text-[10px] font-bold text-indigo-200">KẾT QUẢ TỪNG BÀI THI</p></div>
                </div>
                <button onClick={() => setSelectedStudentForDetails(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><XCircle size={28}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                  <table className="w-full text-left border-collapse bg-white rounded-2xl overflow-hidden shadow-sm">
                      <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500 tracking-widest border-b">
                          <tr>
                              <th className="px-6 py-4">Tên bài thi</th>
                              <th className="px-6 py-4">Khối</th>
                              <th className="px-6 py-4">Ngày thi</th>
                              <th className="px-6 py-4 text-center">Thời gian làm</th>
                              <th className="px-6 py-4 text-right">Điểm</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                          {results.filter(r => r.studentId === selectedStudentForDetails.id).length === 0 ? (
                              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">Chưa có dữ liệu rèn luyện</td></tr>
                          ) : (
                            results.filter(r => r.studentId === selectedStudentForDetails.id)
                              .sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                              .map(r => {
                                  const quizObj = quizzes.find(q => q.id === r.quizId);
                                  return (
                                    <tr key={r.id} className="hover:bg-indigo-50/30 transition-all">
                                        <td className="px-6 py-4 font-bold text-gray-800">{quizObj?.title || "Đề đã xóa"}</td>
                                        <td className="px-6 py-4"><span className="text-[10px] font-black bg-gray-100 px-2 py-0.5 rounded">KHỐI {quizObj?.grade || "?"}</span></td>
                                        <td className="px-6 py-4 text-gray-400 font-medium">{format(parseISO(r.submittedAt), "dd/MM/yyyy HH:mm")}</td>
                                        <td className="px-6 py-4 text-center text-gray-500 font-mono">{Math.floor(r.durationSeconds/60)}p {r.durationSeconds%60}s</td>
                                        <td className="px-6 py-4 text-right"><span className={`font-black text-lg ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>{r.score.toFixed(2)}</span></td>
                                    </tr>
                                  );
                              })
                          )}
                      </tbody>
                  </table>
              </div>
              <div className="p-4 bg-gray-100 border-t flex justify-end">
                <button onClick={() => setSelectedStudentForDetails(null)} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-black transition-all">Đóng cửa sổ</button>
              </div>
            </div>
          </div>
      )}

      {showBankModal && (
          <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                  <div className="p-6 bg-indigo-600 text-white flex justify-between items-center"><h3 className="text-xl font-black flex items-center gap-2 tracking-tight uppercase"><Database size={24}/> NGÂN HÀNG LỚP {grade}</h3><button onClick={() => setShowBankModal(false)}><XCircle size={28}/></button></div>
                  <div className="p-4 border-b bg-slate-50"><select className="w-full border-2 border-indigo-100 rounded-xl p-3 font-bold text-sm outline-none focus:border-indigo-500" value={bankSelectedQuizId} onChange={e => setBankSelectedQuizId(e.target.value)}><option value="">-- Chọn đề gốc --</option>{quizzes.filter(q => q.grade === grade).map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></div>
                  <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-4">
                    {bankSelectedQuizId && quizzes.find(q => q.id === bankSelectedQuizId)?.questions.filter(q => q.type === bankTargetType).map((q: Question, i: number) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-indigo-400 flex justify-between items-start gap-4 transition-all group">
                            <div className="flex-1 text-sm font-medium leading-relaxed"><LatexText text={q.text}/></div>
                            <button onClick={() => { setQuestions([...questions, { ...q, id: uuidv4() }]); }} className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg group-active:scale-90 transition-all"><Plus size={20}/></button>
                        </div>
                    ))}
                  </div>
              </div>
          </div>
      )}

      {isProcessing && (
          <div className="fixed inset-0 bg-white/95 z-[1000] flex flex-col items-center justify-center animate-fade-in backdrop-blur-md">
              <div className="relative">
                  <div className="w-32 h-32 border-[12px] border-blue-50 border-t-blue-600 rounded-full animate-spin shadow-inner"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600"><Sparkles size={36}/></div>
              </div>
              <h2 className="text-3xl font-black text-gray-800 mt-12 mb-4 uppercase tracking-tighter text-center max-w-xl">{loadingMsg}</h2>
              <p className="mt-8 text-gray-400 font-black animate-pulse text-[10px] tracking-[0.2em] uppercase text-center">Hệ thống AI đang xử lý dữ liệu phức tạp...</p>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
