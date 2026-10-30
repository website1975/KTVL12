import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Quiz, Question, Grade, QuestionType, QuestionLevel 
} from '../../types';
import { 
  Pencil, Highlighter, Eraser, Move, Type, Square, Circle, ArrowRight,
  RotateCcw, RotateCw, Trash2, Download, Maximize2, Minimize2, ChevronLeft, ChevronRight,
  FileUp, BookOpen, Database, Sparkles, Eye, EyeOff, Layers, CheckCircle2,
  AlertCircle, HelpCircle, Share2, Copy, Save, Check, RefreshCw, X, Sliders, Image as ImageIcon, Loader2
} from 'lucide-react';
import LatexText from '../LatexText';
import { parseQuestionsFromPDF, parseQuestionsFromText, generateSolutionForQuestionWithAI, safeJsonParse } from '../../services/gemini';
import { getQuizById } from '../../services/storage';

interface QuestionReviewBoardProps {
  quizzes: Quiz[];
  bankQuestions?: Question[];
  initialQuizId?: string | null;
  onClose?: () => void;
}

type DrawTool = 'pen' | 'highlighter' | 'laser' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'text';

interface DrawingStroke {
  id: string;
  tool: DrawTool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
}

export default function QuestionReviewBoard({
  quizzes,
  bankQuestions = [],
  initialQuizId = null,
  onClose
}: QuestionReviewBoardProps) {
  // Source State
  const [sourceType, setSourceType] = useState<'quiz' | 'file' | 'bank'>('quiz');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    initialQuizId || (quizzes.length > 0 ? quizzes[0].id : '')
  );
  
  // Loaded Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState<boolean>(false);
  const [titleName, setTitleName] = useState<string>('Không gian sửa bài');

  // Interactive View Settings
  const [showSolution, setShowSolution] = useState<boolean>(true);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');

  // Drawing Canvas State
  const [activeTool, setActiveTool] = useState<DrawTool>('pen');
  const [penColor, setPenColor] = useState<string>('#ef4444'); // Red default
  const [penWidth, setPenWidth] = useState<number>(1.5);
  const [drawingsPerQuestion, setDrawingsPerQuestion] = useState<{ [qIdx: number]: DrawingStroke[] }>({});
  const [redoStackPerQuestion, setRedoStackPerQuestion] = useState<{ [qIdx: number]: DrawingStroke[] }>({});
  
  // Floating Tool Cursor position (Pen, Highlighter, Eraser, Laser)
  const [hoverCursorPos, setHoverCursorPos] = useState<{ x: number; y: number } | null>(null);

  // AI Explanation State
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Copy Zalo Toast
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // Canvas Refs & Drawing Logic
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);

  // Load questions when selectedQuizId changes or sourceType changes
  useEffect(() => {
    let isMounted = true;
    if (sourceType === 'quiz' && selectedQuizId) {
      const qz = quizzes.find(q => q.id === selectedQuizId);
      if (qz) {
        setTitleName(qz.title);
        if (qz.questions && qz.questions.length > 0) {
          setQuestions(qz.questions);
          setCurrentIdx(0);
        } else {
          setIsLoadingQuiz(true);
          getQuizById(selectedQuizId, true).then(fullQuiz => {
            if (isMounted) {
              if (fullQuiz && fullQuiz.questions && fullQuiz.questions.length > 0) {
                setQuestions(fullQuiz.questions);
              } else {
                setQuestions([]);
              }
              setCurrentIdx(0);
              setIsLoadingQuiz(false);
            }
          }).catch(err => {
            console.error("Lỗi tải chi tiết đề thi:", err);
            if (isMounted) setIsLoadingQuiz(false);
          });
        }
      }
    } else if (sourceType === 'bank' && bankQuestions.length > 0) {
      setQuestions(bankQuestions);
      setTitleName('Ngân hàng câu hỏi chọn lọc');
      setCurrentIdx(0);
    }
    return () => { isMounted = false; };
  }, [sourceType, selectedQuizId, quizzes, bankQuestions]);

  // Set initial quiz if passed via props
  useEffect(() => {
    let isMounted = true;
    if (initialQuizId && quizzes.length > 0) {
      const matched = quizzes.find(q => q.id === initialQuizId);
      if (matched) {
        setSelectedQuizId(matched.id);
        setSourceType('quiz');
        setTitleName(matched.title);
        if (matched.questions && matched.questions.length > 0) {
          setQuestions(matched.questions);
          setCurrentIdx(0);
        } else {
          setIsLoadingQuiz(true);
          getQuizById(matched.id, true).then(full => {
            if (isMounted) {
              if (full && full.questions) {
                setQuestions(full.questions);
              }
              setCurrentIdx(0);
              setIsLoadingQuiz(false);
            }
          }).catch(() => {
            if (isMounted) setIsLoadingQuiz(false);
          });
        }
      }
    }
    return () => { isMounted = false; };
  }, [initialQuizId, quizzes]);

  // Current Question
  const currentQ = questions[currentIdx] || null;

  // Helper to render any stroke accurately on canvas
  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (!stroke || !stroke.points || !Array.isArray(stroke.points) || stroke.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke.color || '#ef4444';
    ctx.lineWidth = stroke.width || 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'source-over';
    } else if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = (stroke.width || 1.5) * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
    }

    const p0 = stroke.points[0];
    if (!p0) {
      ctx.restore();
      return;
    }

    if (stroke.tool === 'pen' || stroke.tool === 'highlighter' || stroke.tool === 'eraser') {
      const isSinglePoint = stroke.points.length === 1 || (
        stroke.points.length === 2 && 
        Math.abs(stroke.points[0].x - stroke.points[1].x) < 1 && 
        Math.abs(stroke.points[0].y - stroke.points[1].y) < 1
      );

      if (isSinglePoint) {
        // Draw solid circular dot for quick taps / accent marks / dots so they never disappear
        ctx.beginPath();
        ctx.arc(p0.x, p0.y, Math.max(ctx.lineWidth / 2, 0.75), 0, Math.PI * 2);
        if (stroke.tool === 'eraser') {
          ctx.fill();
        } else {
          ctx.fillStyle = stroke.color || '#ef4444';
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          if (pt) ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    } else if (stroke.tool === 'line') {
      ctx.globalCompositeOperation = 'source-over';
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    } else if (stroke.tool === 'arrow') {
      ctx.globalCompositeOperation = 'source-over';
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Arrow head
        const headlen = 14;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    } else if (stroke.tool === 'rect') {
      ctx.globalCompositeOperation = 'source-over';
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      if (start && end) {
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
      }
    } else if (stroke.tool === 'circle') {
      ctx.globalCompositeOperation = 'source-over';
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      if (start && end) {
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        const cx = Math.min(start.x, end.x) + rx;
        const cy = Math.min(start.y, end.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
    } else if (stroke.tool === 'text' && stroke.text) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = stroke.color || '#ef4444';
      if (p0) ctx.fillText(stroke.text, p0.x, p0.y);
    }

    ctx.restore();
  };

  // Handle Canvas Resize and Redraw
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas display size
    const parent = canvas.parentElement;
    if (parent) {
      if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const strokes = (drawingsPerQuestion && drawingsPerQuestion[currentIdx]) ? drawingsPerQuestion[currentIdx] : [];
    if (!Array.isArray(strokes) || strokes.length === 0) return;

    strokes.forEach(stroke => {
      renderStroke(ctx, stroke);
    });
  }, [drawingsPerQuestion, currentIdx]);

  useEffect(() => {
    redrawCanvas();
  }, [currentIdx, drawingsPerQuestion, redrawCanvas]);

  // Window resize re-aligns canvas
  useEffect(() => {
    const handleResize = () => redrawCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Handle Pointer Drawing Events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverCursorPos({ x, y });

    if (activeTool === 'laser') {
      return;
    }

    if (activeTool === 'text') {
      const userText = prompt('Nhập chữ/ghi chú muốn dán vào bảng:');
      if (userText && userText.trim()) {
        const newStroke: DrawingStroke = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tool: 'text',
          color: penColor,
          width: penWidth,
          points: [{ x, y }],
          text: userText.trim()
        };
        setDrawingsPerQuestion(prev => ({
          ...prev,
          [currentIdx]: [...((prev && prev[currentIdx]) || []), newStroke]
        }));
      }
      return;
    }

    isDrawingRef.current = true;
    const stroke: DrawingStroke = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tool: activeTool,
      color: penColor,
      width: penWidth,
      points: [{ x, y }]
    };
    currentStrokeRef.current = stroke;

    // Immediate visual feedback on canvas
    const ctx = canvas.getContext('2d');
    if (ctx && (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser')) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.color;
      if (activeTool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'source-over';
      } else if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.width * 4;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
      }
      ctx.beginPath();
      ctx.arc(x, y, Math.max(ctx.lineWidth / 2, 0.75), 0, Math.PI * 2);
      if (activeTool === 'eraser') {
        ctx.fill();
      } else {
        ctx.fillStyle = stroke.color;
        ctx.fill();
      }
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHoverCursorPos({ x, y });

    if (activeTool === 'laser') {
      return;
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    const stroke = currentStrokeRef.current;
    const pts = stroke.points;
    const prevPt = pts[pts.length - 1];

    // Minimal distance threshold to avoid redundant duplicate points
    if (prevPt && Math.hypot(x - prevPt.x, y - prevPt.y) < 0.5) {
      return;
    }

    pts.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (stroke.tool === 'pen' || stroke.tool === 'highlighter' || stroke.tool === 'eraser') {
      // 0ms latency hardware-accelerated direct line segment rendering
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width;
      ctx.strokeStyle = stroke.color;

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'source-over';
      } else if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = stroke.width * 4;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
      }

      ctx.beginPath();
      if (prevPt) {
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // For shapes (line, arrow, rect, circle), redraw saved strokes + preview
      redrawCanvas();
      renderStroke(ctx, stroke);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (!isDrawingRef.current || !currentStrokeRef.current) {
      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      return;
    }

    // Safely snapshot completed stroke BEFORE resetting ref
    const finishedStroke: DrawingStroke = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points]
    };

    // Ensure single points (fast tap, dots, accents) have at least two points or are clearly registered
    if (finishedStroke.points.length === 1) {
      const p0 = finishedStroke.points[0];
      finishedStroke.points.push({ x: p0.x + 0.1, y: p0.y + 0.1 });
    }

    isDrawingRef.current = false;
    currentStrokeRef.current = null;

    // Persist completed stroke to React state
    setDrawingsPerQuestion(prev => ({
      ...prev,
      [currentIdx]: [...((prev && prev[currentIdx]) || []), finishedStroke]
    }));

    // Clear redo stack on new stroke
    setRedoStackPerQuestion(prev => ({ ...prev, [currentIdx]: [] }));
  };

  // Undo / Redo
  const handleUndo = () => {
    setDrawingsPerQuestion(prev => {
      const currentList = (prev && prev[currentIdx]) ? prev[currentIdx] : [];
      if (!Array.isArray(currentList) || currentList.length === 0) return prev;
      const popped = currentList[currentList.length - 1];
      const nextList = currentList.slice(0, -1);

      setRedoStackPerQuestion(rPrev => ({
        ...rPrev,
        [currentIdx]: [...((rPrev && rPrev[currentIdx]) || []), popped]
      }));

      return { ...prev, [currentIdx]: nextList };
    });
  };

  const handleRedo = () => {
    setRedoStackPerQuestion(prev => {
      const currentRedo = (prev && prev[currentIdx]) ? prev[currentIdx] : [];
      if (!Array.isArray(currentRedo) || currentRedo.length === 0) return prev;
      const popped = currentRedo[currentRedo.length - 1];
      const nextRedo = currentRedo.slice(0, -1);

      setDrawingsPerQuestion(dPrev => ({
        ...dPrev,
        [currentIdx]: [...((dPrev && dPrev[currentIdx]) || []), popped]
      }));

      return { ...prev, [currentIdx]: nextRedo };
    });
  };

  const handleClearCanvas = () => {
    if (confirm('Xóa tất cả các ghi chú vẽ trên câu này?')) {
      setDrawingsPerQuestion(prev => ({ ...prev, [currentIdx]: [] }));
      setRedoStackPerQuestion(prev => ({ ...prev, [currentIdx]: [] }));
    }
  };

  // Upload File (PDF, Word, TXT, JSON)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = safeJsonParse(text, []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuestions(parsed);
          setTitleName(file.name.replace('.json', ''));
          setSourceType('file');
          setCurrentIdx(0);
        } else if (parsed?.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
          setTitleName(parsed.title || file.name.replace('.json', ''));
          setSourceType('file');
          setCurrentIdx(0);
        } else {
          alert('File JSON không đúng cấu trúc đề thi');
        }
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            resolve(res.split(',')[1] || res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const parsedQs = await parseQuestionsFromPDF(base64);
        if (parsedQs && parsedQs.length > 0) {
          setQuestions(parsedQs);
          setTitleName(file.name.replace('.pdf', ''));
          setSourceType('file');
          setCurrentIdx(0);
        } else {
          alert('Không tìm thấy câu hỏi từ file PDF này');
        }
      } else {
        // Raw text / Word text
        const text = await file.text();
        const parsedQs = await parseQuestionsFromText(text);
        if (parsedQs && parsedQs.length > 0) {
          setQuestions(parsedQs);
          setTitleName(file.name);
          setSourceType('file');
          setCurrentIdx(0);
        } else {
          alert('Không trích xuất được câu hỏi từ tệp tin');
        }
      }
    } catch (err) {
      console.error("Lỗi đọc file:", err);
      alert('Đã xảy ra lỗi khi bóc tách đề từ file này.');
    } finally {
      setIsLoadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Download Current Slide Screenshot as PNG
  const handleDownloadSlide = () => {
    const canvas = canvasRef.current;
    const parent = containerRef.current;
    if (!canvas || !parent) return;

    // Create a composite canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = parent.clientWidth;
    exportCanvas.height = parent.clientHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Render HTML content via drawing or trigger canvas capture
    const imageUri = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `SuaBai_Cau_${currentIdx + 1}_${titleName.slice(0, 20)}.png`;
    link.href = imageUri;
    link.click();
  };

  // Generate AI Explanation / Solution notes
  const handleGenerateAiNotes = async () => {
    if (!currentQ) return;
    setIsGeneratingAi(true);
    setAiExplanation(null);

    try {
      const res = await generateSolutionForQuestionWithAI(currentQ, '12');
      if (res) {
        setAiExplanation(res);
      } else {
        setAiExplanation(`💡 **Phương pháp giải & Lưu ý cốt lõi:**\n• Xem xét kỹ dữ liệu đề bài đưa ra và đơn vị đo.\n• Áp dụng đúng công thức lý thuyết nền tảng.\n• Chú ý loại trừ các phương án gây nhiễu.`);
      }
    } catch (e) {
      setAiExplanation(`💡 **Lưu ý giảng bài:**\n- Hướng dẫn học sinh gạch chân từ khóa quan trọng trong câu hỏi.\n- Phân tích cẩn thận các phương án sai để tránh nhầm lẫn.`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Copy Question Text & Drawings info to Zalo
  const handleCopyZaloNotice = () => {
    if (!currentQ) return;
    const text = `📢 [GHI CHÚ SỬA BÀI - CÂU ${currentIdx + 1}]
━━━━━━━━━━━━━━━━━━━━
📝 Đề thi: ${titleName}
📌 Nội dung câu hỏi: ${currentQ.text}
${currentQ.options ? currentQ.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n') : ''}
${currentQ.correctAnswer ? `✅ Đáp án đúng: ${currentQ.correctAnswer}` : ''}
${currentQ.solution ? `💡 Lời giải: ${currentQ.solution}` : ''}
━━━━━━━━━━━━━━━━━━━━
👉 Thầy/Cô chúc các em ôn tập tốt và ghi nhớ các dạng câu này!`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Keyboard Navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
      } else if (e.key === 'Escape') {
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, questions.length, onClose]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[100] w-screen h-screen flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden shadow-2xl animate-fade-in"
    >
      {/* 🔴 TOP NAVBAR TOOLBAR */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Title & Source Picker */}
        <div className="flex items-center gap-3">
          {onClose && (
            <button 
              onClick={onClose}
              className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 hover:text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition shadow"
              title="Thoát không gian sửa bài (phím ESC)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Thoát Bảng</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">Không Gian Sửa Bài</span>
          </div>

          {/* Source Tabs */}
          <div className="hidden md:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setSourceType('quiz')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
                sourceType === 'quiz' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Đề từ hệ thống
            </button>
            <button
              onClick={() => setSourceType('file')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
                sourceType === 'file' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" /> Tải tệp (PDF/Word)
            </button>
            <button
              onClick={() => setSourceType('bank')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
                sourceType === 'bank' ? 'bg-blue-600 text-white font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Ngân hàng câu
            </button>
          </div>

          {/* Quiz Selector Dropdown */}
          {sourceType === 'quiz' && (
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 max-w-[220px] lg:max-w-[320px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {quizzes.length === 0 ? (
                <option value="">Chưa có đề thi nào</option>
              ) : (
                quizzes.map(q => (
                  <option key={q.id} value={q.id}>
                    [{q.grade ? `K${q.grade}` : 'Chung'}] {q.title} ({q.questionCount ?? q.questions?.length ?? 0} câu)
                  </option>
                ))
              )}
            </select>
          )}

          {/* File Upload Input */}
          {sourceType === 'file' && (
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow">
              <FileUp className="w-4 h-4" />
              <span>{isLoadingFile ? 'Đang đọc file...' : 'Chọn file PDF / Word / JSON'}</span>
              <input 
                type="file" 
                accept=".pdf,.doc,.docx,.txt,.json" 
                onChange={handleFileUpload} 
                className="hidden" 
                disabled={isLoadingFile}
              />
            </label>
          )}
        </div>

        {/* Right Controls: Question Navigation & Display Options */}
        <div className="flex items-center gap-2">
          {/* AI Phân Tích Bẫy Button */}
          <button
            onClick={handleGenerateAiNotes}
            disabled={isGeneratingAi || !currentQ}
            className="px-3 py-1.5 bg-purple-900/90 hover:bg-purple-800 border border-purple-600 text-purple-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-40 cursor-pointer"
            title="Bấm để AI phân tích phương pháp giải & các bẫy học sinh dễ sai"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span className="hidden sm:inline">{isGeneratingAi ? 'AI đang phân tích...' : 'AI Phân Tích Bẫy'}</span>
          </button>

          {/* Answer Toggle */}
          <button
            onClick={() => setShowCorrectAnswer(!showCorrectAnswer)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              showCorrectAnswer 
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700' 
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Hiện/Ẩn đáp án đúng"
          >
            {showCorrectAnswer ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showCorrectAnswer ? 'Đã hiện đáp án' : 'Ẩn đáp án'}</span>
          </button>

          {/* Solution Toggle */}
          <button
            onClick={() => setShowSolution(!showSolution)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
              showSolution 
                ? 'bg-amber-950/80 text-amber-300 border-amber-700' 
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Hiện/Ẩn lời giải chi tiết"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showSolution ? 'Hiện lời giải' : 'Ẩn lời giải'}</span>
          </button>

          {/* Text Size Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs text-slate-300">
            <button 
              onClick={() => setFontSize('normal')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'normal' ? 'bg-slate-700 text-white font-bold' : 'hover:bg-slate-800'}`}
              title="Cỡ chữ vừa"
            >
              A
            </button>
            <button 
              onClick={() => setFontSize('large')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'large' ? 'bg-slate-700 text-white font-bold' : 'hover:bg-slate-800'}`}
              title="Cỡ chữ to"
            >
              A+
            </button>
            <button 
              onClick={() => setFontSize('xlarge')}
              className={`px-2 py-1 rounded-lg ${fontSize === 'xlarge' ? 'bg-slate-700 text-white font-bold' : 'hover:bg-slate-800'}`}
              title="Cỡ chữ rất to (Cho Máy Chiếu)"
            >
              A++
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình trình chiếu'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 🟢 SECONDARY TOOLBAR: INTERACTIVE DRAWING TOOLS BAR */}
      <div className="bg-slate-950/90 backdrop-blur border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0 z-20">
        {/* Drawing Tools Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold uppercase text-slate-500 mr-1 hidden lg:inline">Công cụ vẽ:</span>
          
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition ${
              activeTool === 'pen' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 ring-2 ring-red-400' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
            title="Bút vẽ tự do"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden md:inline">Bút vẽ</span>
          </button>

          <button
            onClick={() => setActiveTool('highlighter')}
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition ${
              activeTool === 'highlighter' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
            title="Bút tô sáng (Dạ quang)"
          >
            <Highlighter className="w-4 h-4" />
            <span className="hidden md:inline">Tô sáng</span>
          </button>

          <button
            onClick={() => setActiveTool('laser')}
            className={`p-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition ${
              activeTool === 'laser' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-300 animate-pulse' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
            title="Đèn Laser chỉ điểm"
          >
            <span className="w-2.5 h-2.5 bg-rose-400 rounded-full animate-ping"></span>
            <span className="hidden md:inline">Đèn Laser</span>
          </button>

          <div className="w-px h-5 bg-slate-800 my-auto mx-1"></div>

          <button
            onClick={() => setActiveTool('line')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'line' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Thước kẻ đường thẳng"
          >
            /
          </button>

          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'arrow' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Mũi tên chỉ hướng"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'rect' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Khung chữ nhật"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'circle' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Hình tròn / OVAL"
          >
            <Circle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Dán chữ/Ghi chú lên bảng"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              activeTool === 'eraser' ? 'bg-slate-700 text-amber-300 ring-2 ring-amber-400' : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title="Tẩy xóa nét vẽ"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette & Stroke Width */}
        <div className="flex items-center gap-2">
          {/* Colors */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            {[
              { color: '#ef4444', name: 'Đỏ' },
              { color: '#f97316', name: 'Cam' },
              { color: '#facc15', name: 'Vàng' },
              { color: '#10b981', name: 'Xanh lá' },
              { color: '#06b6d4', name: 'Xanh ngọc' },
              { color: '#3b82f6', name: 'Xanh dương' },
              { color: '#ec4899', name: 'Hồng' },
              { color: '#ffffff', name: 'Trắng' },
              { color: '#000000', name: 'Đen' }
            ].map(({ color: c, name }) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                title={`Màu ${name}`}
                className={`w-5 h-5 rounded-full border border-slate-700 transition transform ${
                  penColor === c ? 'scale-125 ring-2 ring-white shadow-md' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Pen Width */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs text-slate-300">
            {[0.75, 1, 1.5, 2, 4, 8].map(w => (
              <button
                key={w}
                onClick={() => setPenWidth(w)}
                className={`px-2 py-0.5 rounded-md font-mono ${penWidth === w ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-800'}`}
              >
                {w}px
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-800 my-auto mx-0.5"></div>

          {/* Action Tools: Undo, Redo, Clear */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!(drawingsPerQuestion[currentIdx] && drawingsPerQuestion[currentIdx].length > 0)}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-30 transition"
              title="Hoàn tác (Undo)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleRedo}
              disabled={!(redoStackPerQuestion[currentIdx] && redoStackPerQuestion[currentIdx].length > 0)}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-30 transition"
              title="Làm lại (Redo)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClearCanvas}
              className="p-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              title="Xóa tất cả vẽ trên câu này"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Xóa vẽ</span>
            </button>

            {/* Download Screenshot */}
            <button
              onClick={handleDownloadSlide}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow"
              title="Chụp ảnh slide sửa bài"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Tải ảnh slide</span>
            </button>

            {/* Copy Zalo Notice */}
            <button
              onClick={handleCopyZaloNotice}
              className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow"
              title="Copy tóm tắt câu này dán Zalo"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Gửi Zalo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Copy Zalo Toast Notification */}
      {copiedToast && (
        <div className="absolute top-24 right-6 z-50 bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4" /> Đã copy tóm tắt câu hỏi vào Khay nhớ tạm (Zalo)!
        </div>
      )}

      {/* 🟡 MAIN CONTENT WORKSPACE: SIDEBAR & CANVAS ARENA */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT SIDEBAR: QUESTION LIST & SELECTOR */}
        <div 
          className={`bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 z-10 shrink-0 ${
            sidebarOpen ? 'w-64 sm:w-72' : 'w-12'
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider truncate">
                  Danh sách ({questions.length} câu)
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1 text-slate-400 hover:text-white rounded-lg mx-auto"
                title="Mở danh sách câu"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Question Grid List */}
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoadingQuiz ? (
                <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span>Đang tải danh sách câu hỏi...</span>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Chưa có câu hỏi nào.
                  <br />
                  Vui lòng chọn đề hoặc tải tệp PDF/Word.
                </div>
              ) : (
                questions.map((q, idx) => {
                  const isCurrent = idx === currentIdx;
                  const hasDrawing = (drawingsPerQuestion[idx] || []).length > 0;

                  return (
                    <button
                      key={q.id || idx}
                      onClick={() => setCurrentIdx(idx)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                        isCurrent 
                          ? 'bg-blue-900/60 border-blue-500 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400' 
                          : 'bg-slate-900/80 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCurrent ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {q.type === 'mcq' && (
                            <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.2 rounded font-mono">
                              Trắc nghiệm
                            </span>
                          )}
                          {q.type === 'group-tf' && (
                            <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-mono">
                              Đúng/Sai
                            </span>
                          )}
                          {q.type === 'short' && (
                            <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-mono">
                              Trả lời ngắn
                            </span>
                          )}

                          {q.level && (
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-1 rounded font-bold">
                              {q.level}
                            </span>
                          )}

                          {hasDrawing && (
                            <span className="text-[10px] bg-red-950 text-red-300 border border-red-800 px-1 rounded flex items-center gap-0.5">
                              <Pencil className="w-2.5 h-2.5" /> Có vẽ
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {q.text || 'Nội dung câu hỏi...'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* CENTER MAIN INTERACTIVE REVIEW ARENA */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
          {/* Main Question Display Area with Canvas Overlay */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
            {isLoadingQuiz ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-4 py-20">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                <h3 className="text-base font-bold text-slate-200">Đang tải toàn bộ câu hỏi của đề thi...</h3>
                <p className="text-xs text-slate-500">Vui lòng chờ trong giây lát</p>
              </div>
            ) : !currentQ ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-4">
                <HelpCircle className="w-16 h-16 text-slate-700 animate-bounce" />
                <h3 className="text-base font-bold text-slate-400">Chưa chọn câu hỏi nào để sửa bài</h3>
                <p className="text-xs max-w-md text-slate-500">
                  Vui lòng chọn đề thi từ danh sách phía trên hoặc tải tệp PDF/Word câu hỏi lên để bắt đầu giảng bài.
                </p>
              </div>
            ) : (
              <div className={`max-w-4xl mx-auto space-y-8 relative ${
                fontSize === 'large' ? 'text-lg' : fontSize === 'xlarge' ? 'text-xl' : 'text-base'
              }`}>
                {/* INTERACTIVE CANVAS OVERLAY (LỚP BẢNG VẼ TƯƠNG TÁC) */}
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className={`absolute inset-0 z-30 touch-none w-full h-full pointer-events-auto ${
                    activeTool === 'laser' ? 'cursor-none' : activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair'
                  }`}
                />

                {/* Laser Pointer Glow Effect */}
                {hoverCursorPos && activeTool === 'laser' && (
                  <div 
                    className="absolute z-40 w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_20px_10px_rgba(244,63,94,0.9)] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{ left: hoverCursorPos.x, top: hoverCursorPos.y }}
                  />
                )}

                {/* Context Text (If present) */}
                {currentQ.context && (
                  <div className="bg-slate-800/80 border-l-4 border-amber-500 p-4 rounded-r-2xl text-slate-200 text-sm leading-relaxed mb-4 relative z-10 pointer-events-none">
                    <span className="font-bold text-amber-400 block mb-1">📌 Dữ liệu dùng chung:</span>
                    <LatexText text={currentQ.context} />
                  </div>
                )}

                {/* Question Header Card */}
                <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl relative z-10 pointer-events-none space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white font-extrabold text-sm px-3 py-1 rounded-xl shadow">
                        CÂU {currentIdx + 1}
                      </span>
                      {currentQ.level && (
                        <span className="bg-slate-700 text-slate-200 text-xs font-bold px-2.5 py-1 rounded-xl">
                          Mức độ: {currentQ.level}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        ({currentQ.type === 'mcq' ? 'Trắc nghiệm 4 đáp án' : currentQ.type === 'group-tf' ? 'Đúng / Sai' : 'Trả lời ngắn'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 relative z-40 pointer-events-auto">
                      <button
                        onClick={handleGenerateAiNotes}
                        disabled={isGeneratingAi}
                        className="bg-purple-950/90 hover:bg-purple-900 border border-purple-700 text-purple-200 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>{isGeneratingAi ? 'AI đang phân tích...' : 'AI Phân Tích Bẫy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-slate-100 font-medium leading-relaxed">
                    <LatexText text={currentQ.text} />
                  </div>

                  {/* Question Image if present */}
                  {currentQ.imageUrl && (
                    <div className="my-4 text-center">
                      <img 
                        src={currentQ.imageUrl} 
                        alt="Hình vẽ câu hỏi" 
                        className="max-h-80 mx-auto rounded-xl border border-slate-700 shadow-lg object-contain" 
                      />
                    </div>
                  )}

                  {/* Options Display (For MCQ) */}
                  {currentQ.type === 'mcq' && currentQ.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {currentQ.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = showCorrectAnswer && currentQ.correctAnswer && (
                          currentQ.correctAnswer.trim().toUpperCase() === letter || 
                          currentQ.correctAnswer.trim() === opt.trim()
                        );

                        return (
                          <div
                            key={optIdx}
                            className={`p-3.5 rounded-xl border transition flex items-start gap-3 ${
                              isCorrect 
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50 shadow-lg' 
                                : 'bg-slate-900/80 border-slate-700/60 text-slate-200'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCorrect ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {letter}
                            </span>
                            <div className="flex-1 text-sm pt-0.5">
                              <LatexText text={opt} />
                            </div>
                            {isCorrect && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SubQuestions Display (For Group True/False) */}
                  {currentQ.type === 'group-tf' && currentQ.subQuestions && (
                    <div className="space-y-2 pt-2">
                      {currentQ.subQuestions.map((sub, sIdx) => {
                        const subLetter = String.fromCharCode(97 + sIdx); // a), b), c), d)
                        return (
                          <div 
                            key={sub.id || sIdx}
                            className="bg-slate-900/90 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-2 flex-1 text-sm text-slate-200">
                              <span className="font-bold text-amber-400 shrink-0">{subLetter})</span>
                              <LatexText text={sub.text} />
                            </div>
                            {showCorrectAnswer && (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${
                                sub.correctAnswer === 'True' 
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                                  : 'bg-rose-950 text-rose-300 border-rose-700'
                              }`}>
                                {sub.correctAnswer === 'True' ? 'ĐÚNG' : 'SAI'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Short Answer Display */}
                  {currentQ.type === 'short' && (
                    <div className="bg-slate-900/90 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between gap-3 mt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Đáp án ngắn:</span>
                      {showCorrectAnswer ? (
                        <span className="font-mono text-emerald-300 font-bold bg-emerald-950 border border-emerald-700 px-3 py-1 rounded-lg">
                          {currentQ.correctAnswer || 'Chưa cập nhật'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">[Đã ẩn đáp án]</span>
                      )}
                    </div>
                  )}
                </div>

                {/* AI Explanation / Trap Analysis Box */}
                {aiExplanation && (
                  <div className="bg-purple-950/95 border-2 border-purple-600 rounded-2xl p-5 shadow-2xl space-y-2 relative z-50 pointer-events-auto animate-fade-in">
                    <div className="flex items-center justify-between border-b border-purple-800/80 pb-2">
                      <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wide">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>AI Trợ Lý Phân Tích Bẫy & Hướng Dẫn Giảng</span>
                      </div>
                      <button onClick={() => setAiExplanation(null)} className="text-purple-300 hover:text-white p-1.5 rounded-xl hover:bg-purple-900 cursor-pointer pointer-events-auto">
                        <X className="w-5 h-5 font-black" />
                      </button>
                    </div>
                    <div className="text-sm text-purple-100 leading-relaxed whitespace-pre-wrap font-sans pt-1">
                      {aiExplanation}
                    </div>
                  </div>
                )}

                {/* Solution & Explanation Card (Always visible writing frame box) */}
                {currentQ && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        ✍️ Vùng viết
                      </span>
                      <button
                        onClick={() => setShowSolution(!showSolution)}
                        className="text-[11px] text-amber-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700 transition cursor-pointer flex items-center gap-1 shadow-xs"
                        title={showSolution ? "Ẩn chữ lời giải để lấy không gian viết rộng" : "Hiện lại chữ lời giải chi tiết"}
                      >
                        {showSolution ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{showSolution ? 'Ẩn lời giải' : 'Hiện lời giải'}</span>
                      </button>
                    </div>

                    <div className="bg-slate-900/60 border-2 border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-3 relative z-10 pointer-events-auto min-h-[160px]">
                      {showSolution ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wide border-b border-slate-800 pb-2.5">
                            <Eye className="w-4 h-4" />
                            <span>Lời Giải Chi Tiết</span>
                          </div>
                          <div className="text-amber-100/90 text-sm leading-relaxed">
                            {currentQ.solution ? (
                              <LatexText text={currentQ.solution} />
                            ) : (
                              <p className="italic text-slate-400 text-xs">
                                Chưa có câu văn lời giải chi tiết. Giáo viên có thể viết trực tiếp lên khung bảng này.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-600 text-xs italic select-none py-8">
                          <span className="opacity-30 font-semibold tracking-wider uppercase text-[11px]">Vùng bảng trống (Sẵn sàng viết / vẽ)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM NAVIGATION FOOTER BAR */}
          <div className="bg-slate-950 border-t border-slate-800 px-6 py-3 flex items-center justify-between gap-4 shrink-0 z-20">
            {/* Prev Question */}
            <button
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-200 disabled:opacity-30 text-xs font-bold flex items-center gap-2 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Câu Trước</span>
            </button>

            {/* Question Counter Indicator */}
            <div className="text-center">
              <span className="text-xs font-bold text-slate-300">
                Câu <span className="text-blue-400 text-sm font-extrabold">{currentIdx + 1}</span> / {questions.length}
              </span>
              <p className="text-[10px] text-slate-500 truncate max-w-[200px] sm:max-w-xs mx-auto">
                {titleName}
              </p>
            </div>

            {/* Next Question */}
            <button
              onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIdx >= questions.length - 1}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-30 transition"
            >
              <span>Câu Tiếp Theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
