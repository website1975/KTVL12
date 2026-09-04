
import React, { useState, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, Chapter, QuizType, ClassRoom } from '../../types';
import { 
  Save, FileUp, Database, CheckCircle2, HelpCircle, AlignLeft, Trash2, 
  Target as TargetIcon, Plus, ImageIcon, Loader2, Lightbulb, Eye, ImageMinus, 
  ShieldAlert, ShieldCheck, Sparkles, Zap, Type as TypeIcon, X, Link as LinkIcon, 
  EyeOff, FileCode, GraduationCap, CheckSquare, Square, Users, Copy, Check,
  Link2, Layers, Image as ImageLucide, FileText, Bookmark, Quote, ClipboardPaste,
  FolderTree, AlertTriangle, ArrowLeft, RotateCcw
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from '../LatexText';
import { parseQuestionsFromJSON, autoCategorizeChaptersWithAI } from '../../services/gemini';
import QuizImageGalleryModal from './QuizImageGalleryModal';
import LatexHelperModal from './LatexHelperModal';
import { extractTextFromDocx } from '../../services/docxExtractor';
import { exportQuizToJson } from '../../services/quizExport';

interface QuizEditorProps {
    editingId: string | null;
    title: string;
    setTitle: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    grade: Grade;
    setGrade: React.Dispatch<React.SetStateAction<Grade>> | ((val: Grade) => void);
    academicYear?: string;
    setAcademicYear?: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    quizType: QuizType;
    setQuizType: React.Dispatch<React.SetStateAction<QuizType>> | ((val: QuizType) => void);
    isPublished: boolean;
    setIsPublished: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);
    isMonitored?: boolean;
    setIsMonitored: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);
    isUnlisted?: boolean;
    setIsUnlisted: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);
    duration: number;
    setDuration: React.Dispatch<React.SetStateAction<number>> | ((val: number) => void);
    category: string;
    setCategory: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    startTime: string;
    setStartTime: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    endTime: string;
    setEndTime: React.Dispatch<React.SetStateAction<string>> | ((val: string) => void);
    questions: Question[];
    setQuestions: React.Dispatch<React.SetStateAction<Question[]>> | ((val: Question[]) => void);
    chapters: Chapter[];
    classes?: ClassRoom[];
    targetType?: 'all' | 'classes';
    setTargetType?: React.Dispatch<React.SetStateAction<'all' | 'classes'>> | ((val: 'all' | 'classes') => void);
    assignedClassIds?: string[];
    setAssignedClassIds?: React.Dispatch<React.SetStateAction<string[]>> | ((val: string[]) => void);
    maxAttempts?: number;
    setMaxAttempts?: React.Dispatch<React.SetStateAction<number>> | ((val: number) => void);
    allowReview?: boolean;
    setAllowReview?: React.Dispatch<React.SetStateAction<boolean>> | ((val: boolean) => void);
    onSave: () => void;
    onCleanLabels: () => void;
    onOpenBank: (type: QuestionType) => void;
    orderIndex: number;
    setOrderIndex: React.Dispatch<React.SetStateAction<number>> | ((val: number) => void);
    onPdfExtract: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTextExtract: (text: string) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
    isAiLoading?: boolean;
    onCancel?: () => void;
    onResetQuiz?: () => void;
}

const safeParseScore = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    try {
        const num = parseFloat(String(val).replace(',', '.'));
        return isNaN(num) ? 0 : num;
    } catch { return 0; }
};

interface QuestionSectionProps {
    sectionTitle: string;
    type: QuestionType;
    questions: Question[];
    setQuestions: (qs: Question[]) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
    onOpenBank: (type: QuestionType) => void;
    onOpenGalleryForQuestion?: (qId: string) => void;
    onOpenBatchForImage?: (imageUrl: string) => void;
    uniqueImagesCount?: number;
    onOpenLatexHelper?: (qId: string, qLabel?: string) => void;
    relevantChapters?: Chapter[];
}

const QuestionSection: React.FC<QuestionSectionProps> = ({ 
    sectionTitle, 
    type, 
    questions, 
    setQuestions, 
    onUploadImage, 
    uploadingId, 
    onOpenBank,
    onOpenGalleryForQuestion,
    onOpenBatchForImage,
    uniqueImagesCount = 0,
    onOpenLatexHelper,
    relevantChapters = []
}) => {
    const [quickPoints, setQuickPoints] = useState(type === 'mcq' ? "0.25" : "1.0");
    const [copiedUrlQId, setCopiedUrlQId] = useState<string | null>(null);
    const sectionQuestions = questions.filter(q => q.type === type);
    const Icon = type === 'mcq' ? CheckCircle2 : type === 'group-tf' ? HelpCircle : AlignLeft;

    const handleCopyImageUrl = (qId: string, url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrlQId(qId);
        setTimeout(() => setCopiedUrlQId(null), 2000);
    };

    const handleSetAllPoints = () => {
        const val = quickPoints.replace(',', '.');
        const newList = questions.map(q => q.type === type ? { ...q, points: val } : q);
        setQuestions(newList);
        alert(`Đã cập nhật ${val} điểm cho tất cả câu ở ${sectionTitle}`);
    };

    const addManual = () => {
        const newQ: Question = {
            id: uuidv4(), type, text: '', points: quickPoints,
            options: type === 'mcq' ? ['', '', '', ''] : undefined,
            correctAnswer: '', solution: '',
            subQuestions: type === 'group-tf' ? [
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' },
                { id: uuidv4(), text: '', correctAnswer: 'True' }
            ] : undefined
        };
        setQuestions([...questions, newQ]);
    };

    const handleRemoveImage = (qId: string) => {
        const nl = [...questions];
        const i = nl.findIndex(x => x.id === qId);
        if (i !== -1) {
            nl[i].imageUrl = undefined;
            setQuestions(nl);
        }
    };

    // Xử lý Dán ảnh trực tiếp từ Clipboard khi bấm nút
    const handlePasteClipboardImage = async (qId: string) => {
        try {
            if (!navigator.clipboard) {
                alert("Trình duyệt không hỗ trợ đọc Clipboard tự động. Bạn chỉ cần click vào khung câu hỏi này và bấm tổ hợp phím Ctrl + V!");
                return;
            }

            let foundFile: File | null = null;
            if (navigator.clipboard.read) {
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    for (const item of clipboardItems) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                            const blob = await item.getType(imageType);
                            foundFile = new File([blob], `paste_${Date.now()}.${imageType.split('/')[1] || 'png'}`, { type: imageType });
                            break;
                        }
                    }
                } catch (permErr) {
                    console.warn("Clipboard read permission issue:", permErr);
                }
            }

            if (foundFile) {
                onUploadImage(qId, foundFile);
                return;
            }

            alert("⚠️ Không tìm thấy hình ảnh nào trong Clipboard!\n\nCách dùng siêu nhanh:\n1. Quét chụp vùng hình ảnh trên màn hình (Bấm Win + Shift + S trên Windows hoặc Cmd + Shift + 4 trên Mac).\n2. Quay lại đây và bấm nút \"DÁN ẢNH (CTRL + V)\" hoặc bấm phím Ctrl + V — Ảnh sẽ tự động được gán ngay lập tức mà không cần lưu file!");
        } catch (err: any) {
            console.warn("Lỗi đọc clipboard:", err);
            alert("Để dán ảnh nhanh: Hãy click vào khung câu hỏi này và bấm Ctrl + V trên bàn phím nhé!");
        }
    };

    // Bắt sự kiện Paste (Ctrl + V) trên toàn bộ khung câu hỏi
    const handleQuestionPaste = (e: React.ClipboardEvent, qId: string) => {
        const items = e.clipboardData?.items;
        if (!items || items.length === 0) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    e.stopPropagation();
                    onUploadImage(qId, file);
                    return;
                }
            }
        }
    };

    // Bắt sự kiện kéo thả (Drag & Drop) ảnh vào khung
    const handleImageDrop = (e: React.DragEvent, qId: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                onUploadImage(qId, file);
            }
        }
    };

    const stripLabel = (text: string): string => {
        if (!text) return "";
        let cleaned = text.trim();
        const labelRegex = /^(\*?[A-Za-z0-9][\.\)\/\-:\s]\s*)/g;
        while (labelRegex.test(cleaned)) {
            cleaned = cleaned.replace(labelRegex, "").trim();
        }
        return cleaned;
    };

    const isCorrectMCQ = (q: Question, opt: string) => {
        if (!q.correctAnswer || !opt) return false;
        return stripLabel(q.correctAnswer) === stripLabel(opt);
    };

    return (
        <div className="space-y-6 mt-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-2xl ${type === 'mcq' ? 'bg-blue-600 text-white' : type === 'group-tf' ? 'bg-purple-600 text-white' : 'bg-orange-600 text-white shadow-lg'}`}>
                        <Icon size={24}/>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">{sectionTitle}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sectionQuestions.length} câu đã soạn</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 px-4 py-2 rounded-2xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase">Sét điểm nhanh:</span>
                        <input 
                            type="text" 
                            className="w-12 bg-white border border-slate-200 rounded-lg text-center font-black text-blue-600 outline-none text-xs p-1" 
                            value={quickPoints} 
                            onChange={e => setQuickPoints(e.target.value)} 
                        />
                        <button onClick={handleSetAllPoints} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-black transition-all shadow-md active:scale-90" title="Gán điểm cho toàn bộ phần này">
                            <Zap size={14}/>
                        </button>
                    </div>
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-50 transition-colors"><Database size={14}/> Ngân hàng</button>
                    <button onClick={addManual} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-xl active:scale-95"><Plus size={14}/> Thêm câu mới</button>
                </div>
            </div>

            {sectionQuestions.map((q, idx) => (
                <div 
                    key={q.id} 
                    onPaste={(e) => handleQuestionPaste(e, q.id)}
                    className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 shadow-sm relative group animate-fade-in-up focus-within:border-blue-200 transition-colors"
                >
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"><Trash2 size={24}/></button>
                    
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <span className="text-[11px] font-black px-5 py-2 rounded-xl uppercase bg-slate-900 text-white">Câu {idx + 1}</span>
                        
                        {/* MỨC ĐỘ NHẬN THỨC CÂU HỎI */}
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <span className="text-[9px] font-black text-slate-400 uppercase px-2">Mức độ:</span>
                            {(['B', 'H', 'VD', 'VDC'] as const).map(lvl => {
                                const isSelected = q.level === lvl;
                                const colors = {
                                    B: isSelected ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-700 hover:bg-emerald-50',
                                    H: isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-blue-700 hover:bg-blue-50',
                                    VD: isSelected ? 'bg-amber-600 text-white shadow-md' : 'text-amber-700 hover:bg-amber-50',
                                    VDC: isSelected ? 'bg-red-600 text-white shadow-md' : 'text-red-700 hover:bg-red-50'
                                };
                                const labels = { B: 'Biết', H: 'Hiểu', VD: 'V.Dụng', VDC: 'VDC' };
                                return (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => {
                                            const nl = [...questions];
                                            const i = nl.findIndex(x => x.id === q.id);
                                            nl[i].level = isSelected ? undefined : lvl;
                                            setQuestions(nl);
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${colors[lvl]}`}
                                    >
                                        [{lvl}] {labels[lvl]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CHỌN CHƯƠNG HỌC CHO TỪNG CÂU HỎI (HỖ TRỢ ĐỀ KTTX, KTGK, CUỐI KỲ) */}
                        {relevantChapters && relevantChapters.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 px-3 rounded-2xl border border-slate-200">
                                <FolderTree size={13} className="text-purple-600 shrink-0" />
                                <span className="text-[9px] font-black text-slate-400 uppercase">Chương:</span>
                                <select
                                    value={q.chapterName || ''}
                                    onChange={(e) => {
                                        const selectedName = e.target.value;
                                        const matched = relevantChapters.find(c => c.name === selectedName);
                                        const nl = [...questions];
                                        const i = nl.findIndex(x => x.id === q.id);
                                        if (i !== -1) {
                                            nl[i].chapterName = selectedName || undefined;
                                            nl[i].chapterId = matched?.id || undefined;
                                            setQuestions(nl);
                                        }
                                    }}
                                    className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer max-w-[180px] truncate"
                                    title={q.chapterName ? `Chương: ${q.chapterName}` : 'Chưa gán riêng (mặc định lấy theo chuyên đề đề thi)'}
                                >
                                    <option value="">(Theo chuyên đề của đề)</option>
                                    {relevantChapters.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border-2 border-blue-100 ml-auto">
                            <TargetIcon size={14} className="text-blue-500" />
                            <input type="text" className="bg-transparent text-sm font-black text-blue-700 outline-none w-14 text-center" value={q.points} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].points = e.target.value; setQuestions(nl); }} />
                        </div>
                    </div>

                    {/* MỤC LỜI DẪN / DỮ LIỆU DÙNG CHUNG CHO CHÙM CÂU HỎI */}
                    <div className="mb-6 bg-amber-50/60 border-2 border-amber-200/80 rounded-[2rem] p-5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Bookmark size={15} className="text-amber-600 shrink-0"/>
                                <label className="text-[11px] font-black text-amber-900 uppercase tracking-tight">
                                    Lời dẫn / Dữ liệu dùng chung (Tùy chọn)
                                </label>
                                <span className="text-[9px] text-amber-700/80 font-bold hidden sm:inline">
                                    — Dùng khi có đoạn văn/bảng số liệu chung cho nhiều câu
                                </span>
                            </div>
                            {q.context && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nl = [...questions];
                                        const i = nl.findIndex(x => x.id === q.id);
                                        nl[i].context = undefined;
                                        setQuestions(nl);
                                    }}
                                    className="text-[9px] font-black text-amber-700 hover:text-red-600 uppercase px-2 py-0.5 rounded-lg hover:bg-amber-100/50 transition-colors"
                                >
                                    Xóa lời dẫn
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <textarea
                                    className="w-full p-4 bg-white border border-amber-200 rounded-2xl text-xs font-semibold text-slate-800 outline-none min-h-[60px] focus:border-amber-400 transition-colors"
                                    value={q.context || ''}
                                    onChange={e => {
                                        const nl = [...questions];
                                        const i = nl.findIndex(x => x.id === q.id);
                                        nl[i].context = e.target.value || undefined;
                                        setQuestions(nl);
                                    }}
                                    placeholder="VD: Dữ liệu dùng chung cho câu 3 và 4: Cho hàm số f(x) liên tục trên đoạn [-2; 4] có đồ thị như sau..."
                                />
                            </div>
                            <div className="p-4 bg-amber-100/40 border border-amber-200/60 rounded-2xl text-xs min-h-[60px] overflow-auto">
                                {q.context ? (
                                    <div className="text-amber-950 font-medium leading-relaxed">
                                        <span className="font-bold text-amber-800 uppercase text-[10px] block mb-1">Xem trước lời dẫn:</span>
                                        <LatexText text={q.context} />
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-bold text-amber-600/70 italic">Chưa nhập lời dẫn (câu hỏi này sẽ hiển thị độc lập bình thường)</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Nội dung đề (LaTeX: $...$)</label>
                                {onOpenLatexHelper && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenLatexHelper(q.id, `Câu ${idx + 1}`)}
                                        className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 px-2 py-0.5 rounded-lg border border-blue-200 transition-all shadow-xs"
                                        title="Mở bảng hỗ trợ chèn công thức Toán & ký hiệu LaTeX"
                                    >
                                        <Sparkles size={11} /> Hỗ trợ LaTeX
                                    </button>
                                )}
                            </div>
                            <textarea className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-bold outline-none min-h-[120px] focus:border-blue-300 transition-colors" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="VD: Tìm $x$ biết $x^2 = 4$..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-500 uppercase ml-2">Xem trước hiển thị</label>
                            <div className="w-full p-6 bg-blue-50/20 rounded-[2rem] border-2 border-blue-100/50 min-h-[120px] text-sm overflow-auto"><LatexText text={q.text || '*Đề trống*'} /></div>
                        </div>
                    </div>

                    {/* KHUNG ĐÍNH KÈM VÀ TÁI SỬ DỤNG HÌNH ẢNH */}
                    <div 
                        onDrop={(e) => handleImageDrop(e, q.id)}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="mb-8 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 hover:border-blue-300 transition-all flex flex-col md:flex-row items-center gap-8"
                    >
                        <div className="shrink-0 relative">
                            {q.imageUrl ? (
                                <img src={q.imageUrl} className="w-32 h-32 object-cover rounded-[1.5rem] border-4 border-white shadow-lg" alt="q" />
                            ) : (
                                <div 
                                    onClick={() => handlePasteClipboardImage(q.id)}
                                    className={`w-32 h-32 bg-white border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-[1.5rem] flex flex-col items-center justify-center text-slate-400 hover:text-emerald-700 cursor-pointer group shadow-sm transition-all ${uploadingId === q.id ? 'opacity-50 pointer-events-none' : ''}`}
                                    title="Click để dán ảnh từ Clipboard (Ctrl + V) hoặc kéo thả file ảnh vào đây"
                                >
                                    {uploadingId === q.id ? <Loader2 className="animate-spin text-blue-500" size={32}/> : <ClipboardPaste size={30} className="group-hover:scale-110 transition-transform text-emerald-600"/>}
                                    <span className="text-[9px] font-black uppercase mt-1.5 text-center px-2">
                                        {uploadingId === q.id ? 'Đang tải...' : 'Click dán ảnh (Ctrl+V)'}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 flex-1">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight">
                                    Đính kèm hình ảnh minh họa
                                </h4>
                                {q.imageUrl && (
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                        ✓ Đã gán ảnh
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} />
                                
                                {/* NÚT DÁN ẢNH TỪ CLIPBOARD (Ctrl + V) */}
                                <button
                                    type="button"
                                    onClick={() => handlePasteClipboardImage(q.id)}
                                    disabled={uploadingId === q.id}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                                        uploadingId === q.id 
                                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 ring-2 ring-emerald-400/30'
                                    }`}
                                    title="Chụp ảnh (Win + Shift + S) hoặc Copy ảnh rồi bấm vào đây để dán ngay lập tức!"
                                >
                                    {uploadingId === q.id ? <Loader2 className="animate-spin" size={14}/> : <ClipboardPaste size={14}/>}
                                    {uploadingId === q.id ? 'ĐANG DÁN...' : 'DÁN ẢNH (CTRL + V)'}
                                </button>

                                {/* Nút tải ảnh từ máy tính */}
                                <label htmlFor={`img-${q.id}`} className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5 transition-all ${uploadingId === q.id ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-black shadow-md shadow-blue-100'}`}>
                                    {uploadingId === q.id ? <Loader2 className="animate-spin" size={14}/> : <ImageIcon size={14}/>} 
                                    {uploadingId === q.id ? 'ĐANG XỬ LÝ...' : (q.imageUrl ? 'TẢI ẢNH MỚI' : 'TẢI ẢNH LÊN')}
                                </label>

                                {/* Nút chọn ảnh từ kho ảnh của đề hoặc dán link */}
                                <button
                                    type="button"
                                    onClick={() => onOpenGalleryForQuestion && onOpenGalleryForQuestion(q.id)}
                                    className="px-4 py-2.5 bg-white border-2 border-slate-200 hover:border-blue-400 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm"
                                    title="Chọn ảnh đã có trong đề hoặc dán link URL"
                                >
                                    <Link2 size={14} className="text-blue-600" />
                                    {uniqueImagesCount > 0 ? `CHỌN TỪ ĐỀ (${uniqueImagesCount}) / DÁN LINK` : 'DÁN LINK ẢNH'}
                                </button>

                                {/* Nếu câu đã có ảnh: Nút copy link ảnh */}
                                {q.imageUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => handleCopyImageUrl(q.id, q.imageUrl!)}
                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                                            copiedUrlQId === q.id 
                                                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                        }`}
                                        title="Sao chép link ảnh này để dùng cho câu khác"
                                    >
                                        {copiedUrlQId === q.id ? <Check size={14} /> : <Copy size={14} />}
                                        {copiedUrlQId === q.id ? 'ĐÃ COPY LINK!' : 'COPY LINK ẢNH'}
                                    </button>
                                )}

                                {/* Nút gán ảnh này cho các câu khác trong đề */}
                                {q.imageUrl && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenBatchForImage && onOpenBatchForImage(q.imageUrl!)}
                                        className="px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm"
                                        title="Dùng chung ảnh này cho các câu hỏi khác trong đề thi"
                                    >
                                        <Layers size={14} /> DÙNG CHO CÂU KHÁC...
                                    </button>
                                )}

                                {/* Nút gỡ ảnh */}
                                {q.imageUrl && (
                                    <button 
                                        type="button"
                                        onClick={() => handleRemoveImage(q.id)}
                                        className="px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5"
                                    >
                                        <ImageMinus size={14}/> Gỡ ảnh
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-500 bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60 w-fit">
                                <Sparkles size={12} className="text-amber-500 shrink-0" />
                                <span>
                                    <strong className="text-emerald-700 font-black">Mẹo siêu tốc:</strong> Chụp vùng hình (<kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[9px] text-slate-800 font-bold">Win + Shift + S</kbd>) rồi bấm <strong className="text-emerald-700 font-black">"DÁN ẢNH (CTRL + V)"</strong> hoặc bấm phím <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[9px] text-slate-800 font-bold">Ctrl + V</kbd> — Không cần lưu file!
                                </span>
                            </div>
                        </div>
                    </div>

                    {type === 'mcq' && q.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {q.options.map((opt, oi) => (
                                <div key={oi} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${isCorrectMCQ(q, opt) && opt !== '' ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-100'}`}>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <input type="radio" name={`ans-${q.id}`} className="w-5 h-5 accent-emerald-600" checked={isCorrectMCQ(q, opt) && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} />
                                        <span className="text-xs font-black text-slate-400">{String.fromCharCode(65+oi)}.</span>
                                    </div>
                                    <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Nhập phương án ${String.fromCharCode(65+oi)}...`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {type === 'group-tf' && q.subQuestions && (
                        <div className="space-y-3 mb-8">
                            {q.subQuestions.map((sq, si) => (
                                <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs font-black text-blue-600">{String.fromCharCode(97+si)})</span>
                                        <div className="flex items-center bg-white rounded-lg p-0.5 border border-slate-200">
                                            {(['B', 'H', 'VD', 'VDC'] as const).map(lvl => (
                                                <button
                                                    key={lvl}
                                                    type="button"
                                                    onClick={() => {
                                                        const nl = [...questions];
                                                        const i = nl.findIndex(x => x.id === q.id);
                                                        nl[i].subQuestions![si].level = sq.level === lvl ? undefined : lvl;
                                                        setQuestions(nl);
                                                    }}
                                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all ${sq.level === lvl ? (lvl === 'B' ? 'bg-emerald-600 text-white' : lvl === 'H' ? 'bg-blue-600 text-white' : lvl === 'VD' ? 'bg-amber-600 text-white' : 'bg-red-600 text-white') : 'text-slate-400 hover:text-slate-700'}`}
                                                >
                                                    {lvl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý trắc nghiệm..." />
                                    <div className="flex bg-white rounded-xl p-1 border-2 border-slate-200 shrink-0">
                                        {['True', 'False'].map(v => (
                                            <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-5 py-1.5 text-[10px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {type === 'short' && (
                        <div className="mb-8 flex items-center gap-4 bg-blue-50/50 p-6 rounded-[2rem] border-2 border-blue-100">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm">Đáp số đúng:</span>
                            <input type="text" className="flex-1 bg-transparent text-lg font-black text-blue-700 outline-none border-b-2 border-blue-200 focus:border-blue-600 transition-colors" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả con số..." />
                        </div>
                    )}

                    <div className="pt-8 border-t-2 border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 ml-2">
                                <Lightbulb size={16} className="text-orange-500"/>
                                <label className="text-[10px] font-black text-slate-400 uppercase">Hướng dẫn giải (LaTeX: $...$)</label>
                            </div>
                            <textarea className="w-full p-5 bg-orange-50/20 border-2 border-orange-100 rounded-[2rem] text-sm font-medium outline-none min-h-[100px] focus:border-orange-300" value={q.solution} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} placeholder="Viết lời giải chi tiết tại đây để hỗ trợ học sinh..." />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 ml-2">
                                <Eye size={16} className="text-blue-500"/>
                                <label className="text-[10px] font-black text-blue-400 uppercase">Xem trước lời giải</label>
                            </div>
                            <div className="w-full p-5 bg-white rounded-[2rem] border-2 border-slate-100 min-h-[100px] text-sm italic text-slate-500 overflow-auto shadow-inner"><LatexText text={q.solution || '*Chưa có lời giải*'} /></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function QuizEditor(props: QuizEditorProps) {
    const [isTextInputOpen, setIsTextInputOpen] = useState(false);
    const [pastedText, setPastedText] = useState('');
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryTargetQId, setGalleryTargetQId] = useState<string | null>(null);
    const [isLatexHelperOpen, setIsLatexHelperOpen] = useState(false);
    const [latexTargetQId, setLatexTargetQId] = useState<string | null>(null);
    const [latexTargetLabel, setLatexTargetLabel] = useState<string | null>(null);

    const [latexInitialCode, setLatexInitialCode] = useState<string>('');

    const totalPoints = props.questions.reduce((acc, q) => acc + safeParseScore(q.points), 0);
    
    // Danh sách chương phù hợp: lọc theo khối của đề thi, hoặc lấy toàn bộ nếu không khớp hoặc grade là 'all'
    const relevantChapters = useMemo(() => {
        let list = props.chapters.filter(c => String(c.grade) === String(props.grade));
        if (list.length === 0) {
            list = props.chapters;
        }
        return list;
    }, [props.chapters, props.grade]);

    // Danh sách chương chuyên môn gửi cho AI (ưu tiên các chương kiến thức cụ thể thay vì mục chung 'Ôn thi TX-CK')
    const aiTargetChapters = useMemo(() => {
        const knowledgeOnly = relevantChapters.filter(c => {
            const lower = (c.name || '').toLowerCase();
            return !lower.includes('ôn thi tx') && !lower.includes('ôn gk') && !lower.includes('luyện thi');
        });
        return knowledgeOnly.length > 0 ? knowledgeOnly : relevantChapters;
    }, [relevantChapters]);

    // Quản lý Chương học cho câu hỏi (Hỗ trợ đề KTTX, KTGK, Cuối kỳ)
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
    const [categorizeMessage, setCategorizeMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [batchRangeFrom, setBatchRangeFrom] = useState(1);
    const [batchRangeTo, setBatchRangeTo] = useState(props.questions.length || 1);
    const [batchTargetChapter, setBatchTargetChapter] = useState('');
    const [showBatchAssignBar, setShowBatchAssignBar] = useState(false);

    // Tính phân bố số lượng câu hỏi theo chương trong đề
    const chapterDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        props.questions.forEach(q => {
            const ch = q.chapterName || (props.category && props.category !== 'KTGK' && props.category !== 'KTTX' ? props.category : 'Chưa gán chương');
            counts[ch] = (counts[ch] || 0) + 1;
        });
        return counts;
    }, [props.questions, props.category]);

    // AI Phân loại chương tự động cho tất cả câu hỏi
    const handleAutoCategorizeChapters = async () => {
        if (props.questions.length === 0) {
            setCategorizeMessage({ type: 'error', text: "Đề thi chưa có câu hỏi nào để phân loại!" });
            return;
        }
        if (aiTargetChapters.length === 0) {
            setCategorizeMessage({ 
                type: 'error', 
                text: `Hệ thống chưa tìm thấy danh mục chương học nào cho Khối ${props.grade}! Vui lòng vào tab 'Chương' để tạo danh mục chương trước.` 
            });
            return;
        }
        setIsAutoCategorizing(true);
        setCategorizeMessage({ 
            type: 'info', 
            text: `🤖 AI đang đọc và phân loại ${props.questions.length} câu hỏi theo kiến thức các chương... Vui lòng đợi trong giây lát.` 
        });
        try {
            const results = await autoCategorizeChaptersWithAI(
                props.questions,
                aiTargetChapters.map(c => ({ id: c.id, name: c.name }))
            );
            if (results && results.length > 0) {
                const map = new Map(results.map(r => [r.id, r]));
                let count = 0;
                const updated = props.questions.map(q => {
                    const match = map.get(q.id);
                    if (match && match.chapterName) {
                        count++;
                        return {
                            ...q,
                            chapterName: match.chapterName,
                            chapterId: match.chapterId || relevantChapters.find(c => c.name === match.chapterName)?.id
                        };
                    }
                    return q;
                });
                props.setQuestions(updated);
                setCategorizeMessage({
                    type: 'success',
                    text: `🎉 AI đã tự động phân loại thành công ${count}/${props.questions.length} câu hỏi vào đúng các chương tương ứng!`
                });
            } else {
                setCategorizeMessage({
                    type: 'error',
                    text: "AI chưa phân loại được chương phù hợp cho danh sách câu hỏi này. Bạn có thể chọn chương thủ công hoặc gán theo dải câu."
                });
            }
        } catch (err: any) {
            setCategorizeMessage({
                type: 'error',
                text: "Lỗi phân loại chương bằng AI: " + (err.message || 'Lỗi xử lý')
            });
        } finally {
            setIsAutoCategorizing(false);
        }
    };

    // Gán nhanh chương theo dải số câu (VD: câu 1 đến câu 10)
    const handleApplyBatchChapterRange = () => {
        if (!batchTargetChapter) {
            setCategorizeMessage({ type: 'error', text: "Vui lòng chọn chương muốn gán trước!" });
            return;
        }
        const from = Math.max(1, Number(batchRangeFrom)) - 1;
        const to = Math.min(props.questions.length, Number(batchRangeTo)) - 1;
        if (from > to) {
            setCategorizeMessage({ type: 'error', text: "Khoảng câu hỏi không hợp lệ (từ câu phải nhỏ hơn hoặc bằng đến câu)!" });
            return;
        }
        const matched = relevantChapters.find(c => c.name === batchTargetChapter);
        const updated = [...props.questions];
        for (let i = from; i <= to; i++) {
            updated[i].chapterName = batchTargetChapter;
            updated[i].chapterId = matched?.id;
        }
        props.setQuestions(updated);
        setCategorizeMessage({
            type: 'success',
            text: `Đã gán thành công Chương "${batchTargetChapter}" cho ${to - from + 1} câu hỏi (Từ câu ${from + 1} đến câu ${to + 1})!`
        });
    };

    // Đếm tổng số ảnh phân biệt trong đề
    const uniqueImagesCount = useMemo(() => {
        const set = new Set<string>();
        props.questions.forEach(q => {
            if (q.imageUrl && q.imageUrl.trim()) set.add(q.imageUrl.trim());
        });
        return set.size;
    }, [props.questions]);

    const handleSelectImageForQuestion = (qId: string, imageUrl: string) => {
        const nl = [...props.questions];
        const i = nl.findIndex(x => x.id === qId);
        if (i !== -1) {
            nl[i].imageUrl = imageUrl;
            props.setQuestions(nl);
        }
    };

    const handleBatchApplyImage = (sourceImageUrl: string, targetQuestionIds: string[]) => {
        const targetSet = new Set(targetQuestionIds);
        const nl = props.questions.map(q => {
            if (targetSet.has(q.id)) {
                return { ...q, imageUrl: sourceImageUrl };
            }
            return q;
        });
        props.setQuestions(nl);
    };

    const handleOpenGalleryForQuestion = (qId: string) => {
        setGalleryTargetQId(qId);
        setIsGalleryOpen(true);
    };

    const handleOpenBatchForImage = (imageUrl: string) => {
        setGalleryTargetQId(null);
        setIsGalleryOpen(true);
    };

    const handleOpenLatexHelper = (qId?: string, qLabel?: string) => {
        setLatexTargetQId(qId || null);
        setLatexTargetLabel(qLabel || (qId ? 'Câu hỏi' : null));
        if (qId) {
            const foundQ = props.questions.find(q => q.id === qId);
            setLatexInitialCode(foundQ?.text || '');
        } else {
            setLatexInitialCode('$\\dfrac{a}{b}$');
        }
        setIsLatexHelperOpen(true);
    };

    const handleInsertLatexSnippet = (code: string) => {
        if (!latexTargetQId) return;
        const nl = [...props.questions];
        const i = nl.findIndex(x => x.id === latexTargetQId);
        if (i !== -1) {
            nl[i].text = code;
            props.setQuestions(nl);
        }
    };

    const handleConfirmTextExtract = () => {
        if (!pastedText.trim()) return;
        const trimmed = pastedText.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const result = parseQuestionsFromJSON(trimmed);
                props.setQuestions([...props.questions, ...result.questions]);
                if (result.quizTitle && !props.title) props.setTitle(result.quizTitle);
                if (result.grade) props.setGrade(result.grade);
                if (result.category) props.setCategory(result.category);
                if (result.durationMinutes) props.setDuration(result.durationMinutes);
                setPastedText('');
                setIsTextInputOpen(false);
                alert(`🎉 Phát hiện chuỗi JSON! Đã nhập thành công ${result.questions.length} câu hỏi (0% AI, đầy đủ đáp án & lời giải).`);
                return;
            } catch (jsonErr: any) {
                console.warn("Thử parse JSON thất bại, tiếp tục bóc tách qua AI:", jsonErr);
            }
        }
        props.onTextExtract(pastedText);
        setPastedText('');
        setIsTextInputOpen(false);
    };

    const handleJsonFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const content = reader.result as string;
                    const result = parseQuestionsFromJSON(content);
                    props.setQuestions([...props.questions, ...result.questions]);
                    if (result.quizTitle && !props.title) props.setTitle(result.quizTitle);
                    if (result.grade) props.setGrade(result.grade);
                    if (result.category) props.setCategory(result.category);
                    if (result.durationMinutes) props.setDuration(result.durationMinutes);
                    alert(`🎉 Đã bóc tách thành công ${result.questions.length} câu hỏi từ file JSON mà KHÔNG tốn lượt AI nào! (Bao gồm đầy đủ đáp án & lời giải chi tiết)`);
                } catch (err: any) {
                    alert("❌ Lỗi cấu trúc JSON: " + err.message);
                }
            };
            reader.readAsText(file, "UTF-8");
        } catch (err: any) {
            alert("Lỗi đọc file JSON: " + err.message);
        }
        e.target.value = '';
    };

    const handleDocxFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                if (!arrayBuffer) return;
                try {
                    const extractedText = await extractTextFromDocx(arrayBuffer);
                    if (!extractedText || !extractedText.trim()) {
                        alert("Không thể đọc được văn bản trong file Word này. Vui lòng kiểm tra lại nội dung file.");
                        return;
                    }
                    // Tự động chuyển văn bản vừa trích xuất từ DOCX cho AI bóc tách
                    props.onTextExtract(extractedText);
                } catch (err: any) {
                    alert("Lỗi khi đọc file Word (.docx): " + (err.message || "Định dạng không được hỗ trợ"));
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (err: any) {
            alert("Lỗi tải file Word: " + err.message);
        }
        e.target.value = '';
    };

    const handleExportCurrentQuizJson = () => {
        if (!props.questions || props.questions.length === 0) {
            alert("Đề thi chưa có câu hỏi nào để xuất!");
            return;
        }
        const currentQuiz: Quiz = {
            id: props.editingId || uuidv4(),
            title: props.title || 'Đề thi mới',
            grade: props.grade,
            type: props.quizType,
            isPublished: props.isPublished,
            isMonitored: props.isMonitored,
            isUnlisted: props.isUnlisted,
            targetType: props.targetType || 'all',
            assignedClassIds: props.assignedClassIds || [],
            durationMinutes: props.duration,
            orderIndex: props.orderIndex,
            category: props.category,
            startTime: props.startTime,
            endTime: props.endTime,
            questions: props.questions,
            createdAt: new Date().toISOString(),
            description: ''
        };
        exportQuizToJson(currentQuiz);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in relative">
            {props.isAiLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2100] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center space-y-8 max-w-sm w-full border-8 border-blue-100">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 border-8 border-blue-50 rounded-full"></div>
                            <div className="absolute inset-0 border-8 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="text-blue-600 animate-pulse" size={32}/>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-xl font-black uppercase text-slate-800 tracking-tight leading-none">AI Đang bóc tách...</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed px-4">Đang trích xuất câu hỏi, đáp án và lời giải bằng Gemini 3 Flash.</p>
                        </div>
                    </div>
                </div>
            )}

            {isTextInputOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[2000] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-8 border-white">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <TypeIcon size={24} className="text-blue-500"/>
                                <h3 className="text-lg font-black uppercase tracking-tight">Dán văn bản đề thi</h3>
                            </div>
                            <button onClick={() => setIsTextInputOpen(false)} className="p-3 hover:bg-red-600 rounded-xl transition-colors"><X/></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Copy nội dung đề từ Word/Web dán vào đây (Nếu dán chuỗi JSON hệ thống sẽ tự động tách câu hỏi 0% AI, nếu dán văn bản thường AI sẽ bóc tách).
                            </p>
                            <textarea 
                                className="w-full h-80 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-medium text-sm focus:border-blue-400 transition-all"
                                placeholder="Dán nội dung văn bản hoặc chuỗi JSON tại đây..."
                                value={pastedText}
                                onChange={e => setPastedText(e.target.value)}
                            />
                            <div className="flex gap-4">
                                <button onClick={() => setIsTextInputOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all">Hủy bỏ</button>
                                <button onClick={handleConfirmTextExtract} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-200 hover:bg-black transition-all">Bắt đầu bóc tách</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* THANH ĐIỀU HƯỚNG & TRẠNG THÁI ĐỀ THI */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-6 py-4 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex flex-wrap items-center gap-3">
                    {props.onCancel && (
                        <button
                            type="button"
                            onClick={props.onCancel}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase transition-all"
                        >
                            <ArrowLeft size={14} /> Quay lại danh sách
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            props.editingId ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                            {props.editingId ? 'Đang chỉnh sửa đề đã lưu' : 'Đề thi mới'}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                            • {props.questions.length} câu hỏi
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {props.onResetQuiz && (
                        <button
                            type="button"
                            onClick={props.onResetQuiz}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 rounded-xl text-[10px] font-black uppercase transition-all shadow-2xs"
                            title="Xóa toàn bộ câu hỏi và thông tin đề hiện tại để làm lại đề mới hoàn toàn"
                        >
                            <RotateCcw size={12} /> Làm trống đề (Tạo mới)
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-sm space-y-8 relative overflow-hidden">
                <div className={`absolute top-0 right-16 px-8 py-3 rounded-b-3xl font-black text-xs uppercase shadow-xl z-10 transition-colors ${totalPoints === 10 ? 'bg-emerald-600' : 'bg-orange-500'} text-white`}>
                    Tổng điểm đề: {totalPoints.toFixed(2)}đ
                </div>
                
                {/* THANH CÔNG CỤ: KHO ẢNH, HỖ TRỢ LATEX & BÓC TÁCH NHẬP ĐỀ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-100 pb-5 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Công cụ nhập liệu & Hỗ trợ:
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Nút mở Thư viện ảnh đề thi */}
                        <button
                            type="button"
                            onClick={() => {
                                setGalleryTargetQId(null);
                                setIsGalleryOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Quản lý và tái sử dụng kho ảnh của đề thi"
                        >
                            <ImageLucide size={13}/> Kho ảnh ({uniqueImagesCount})
                        </button>
                        {/* Nút mở Bảng hỗ trợ công thức Toán & LaTeX */}
                        <button
                            type="button"
                            onClick={() => handleOpenLatexHelper()}
                            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-[10px] font-black uppercase hover:bg-cyan-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Tra cứu nhanh và chèn công thức Toán, tích phân, phân số, ký hiệu LaTeX"
                        >
                            <Sparkles size={13}/> Hỗ trợ LaTeX
                        </button>
                        <label 
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-amber-600 transition-all shadow-xs active:scale-95 whitespace-nowrap" 
                            title="Nhập trực tiếp file .json (Không tốn lượt AI)"
                        >
                            <FileCode size={13}/> Nhập JSON
                            <input type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFileSelect}/>
                        </label>
                        <button
                            type="button"
                            onClick={handleExportCurrentQuizJson}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Tải về file JSON đề thi hiện tại"
                        >
                            <FileCode size={13}/> Xuất JSON
                        </button>
                        <button 
                            onClick={props.onCleanLabels}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Xóa bỏ các nhãn A., B., a), b) dư thừa trong nội dung câu hỏi"
                        >
                            <Zap size={13}/> Dọn nhãn
                        </button>
                        <button 
                            onClick={() => setIsTextInputOpen(true)}
                            className={`flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-xs active:scale-95 whitespace-nowrap ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <TypeIcon size={13}/> Nhập văn bản (AI)
                        </button>
                        <label className={`flex items-center gap-1.5 px-3 py-2 bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-blue-800 transition-all shadow-xs active:scale-95 whitespace-nowrap ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Nhập trực tiếp từ file Word (.docx)">
                            <FileText size={13}/> Nhập DOCX (AI)
                            <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={props.isAiLoading} onChange={handleDocxFileSelect}/>
                        </label>
                        <label className={`flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-black transition-all shadow-xs active:scale-95 whitespace-nowrap ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileUp size={13}/> Nhập PDF (AI)
                            <input type="file" accept="application/pdf" className="hidden" disabled={props.isAiLoading} onChange={props.onPdfExtract}/>
                        </label>
                    </div>
                </div>

                {/* Ô NHẬP TIÊU ĐỀ ĐỀ THI (RIÊNG BIỆT, RỘNG RÃI & NỔI BẬT) */}
                <div className="space-y-2 bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:shadow-md transition-all">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                            Tiêu đề đề thi
                        </label>
                        <span className="text-[10px] font-bold text-slate-400">
                            {props.title ? `${props.title.length} ký tự` : 'Chưa nhập tiêu đề'}
                        </span>
                    </div>
                    <input 
                        type="text" 
                        className="text-lg md:text-xl font-black outline-none bg-transparent w-full uppercase placeholder:text-slate-300 text-slate-900 focus:text-blue-600 transition-colors px-1 py-1" 
                        placeholder="VD: KIỂM TRA 1 TIẾT CHƯƠNG I ĐẠO HÀM..." 
                        value={props.title} 
                        onChange={e => props.setTitle(e.target.value)} 
                    />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Khối lớp</label>
                        <select className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.grade} onChange={e => { props.setGrade(e.target.value as Grade); props.setCategory(''); }}>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Niên khóa / Năm học</label>
                        <select 
                            className="w-full border-2 border-amber-200 rounded-[1.5rem] p-4 text-xs font-black bg-amber-50/50 text-amber-900 focus:border-amber-400 outline-none" 
                            value={props.academicYear || '2025-2026'} 
                            onChange={e => props.setAcademicYear && props.setAcademicYear(e.target.value)}
                        >
                            <option value="2025-2026">2025-2026 (Hiện tại)</option>
                            <option value="2024-2025">2024-2025</option>
                            <option value="2026-2027">2026-2027</option>
                            <option value="2027-2028">2027-2028</option>
                            <option value="2028-2029">2028-2029</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Chương học</label>
                        <select className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.category} onChange={e => props.setCategory(e.target.value)}>
                            <option value="">Chọn chương...</option>
                            {relevantChapters.map(c => <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Thời lượng làm bài (phút)</label>
                        <input type="number" min="1" className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.duration} onChange={e => props.setDuration(parseInt(e.target.value) || 45)} />
                    </div>
                </div>

                {/* CẦN GẠT CHỦ ĐỘNG PHÂN LOẠI: LUYỆN TẬP HOẶC LÀM BÀI THI */}
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap size={18} className="text-blue-600" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                Phân loại đề: Luyện tập hay Làm bài thi (GV chủ động phân quyền)
                            </h4>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${props.quizType === 'practice' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                            {props.quizType === 'practice' ? '⚡ Chế độ Luyện tập' : '📝 Chế độ Làm bài thi'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Option 1: Luyện tập */}
                        <div 
                            onClick={() => {
                                props.setQuizType('practice');
                                props.setIsMonitored(false);
                            }}
                            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${props.quizType === 'practice' ? 'bg-amber-50/80 border-amber-500 shadow-md ring-2 ring-amber-400/30' : 'bg-white border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'}`}
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${props.quizType === 'practice' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            <Zap size={16} />
                                        </div>
                                        <h5 className="font-black text-slate-900 text-sm uppercase">Đề Luyện tập</h5>
                                    </div>
                                    <input 
                                        type="radio" 
                                        name="quizTypeToggle"
                                        checked={props.quizType === 'practice'} 
                                        onChange={() => {}}
                                        className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Học sinh ôn tập tự do từng câu, xem ngay đáp án đúng/sai & lời giải chi tiết.
                                </p>
                            </div>
                            <div className="mt-3 pt-3 border-t border-amber-200/60 text-[10px] font-bold text-amber-800 flex items-center gap-1.5">
                                <span>🔒 <b>Phía Học sinh:</b> Nút <b>Làm bài thi</b> sẽ tự động <b>MỜ / KHÓA</b>.</span>
                            </div>
                        </div>

                        {/* Option 2: Làm bài thi */}
                        <div 
                            onClick={() => props.setQuizType('test')}
                            className={`cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${props.quizType === 'test' ? 'bg-blue-50/80 border-blue-600 shadow-md ring-2 ring-blue-500/30' : 'bg-white border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'}`}
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-xl ${props.quizType === 'test' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <h5 className="font-black text-slate-900 text-sm uppercase">Đề Làm bài thi</h5>
                                    </div>
                                    <input 
                                        type="radio" 
                                        name="quizTypeToggle"
                                        checked={props.quizType === 'test'} 
                                        onChange={() => {}}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                    Tính điểm chính thức & thời gian làm bài, lưu vào Bảng xếp hạng. Chống gian lận xem trước đáp án.
                                </p>
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-200/60 text-[10px] font-bold text-blue-800 flex items-center gap-1.5">
                                <span>🛡️ <b>Phía Học sinh:</b> Nút <b>Luyện tập</b> sẽ tự động <b>MỜ / KHÓA</b> (Tối đa 2 lần làm bài).</span>
                            </div>
                        </div>
                    </div>

                    {/* Cài đặt chi tiết số lần làm bài nếu là Đề thi */}
                    {props.quizType === 'test' && (
                        <div className="bg-white p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs">
                                <p className="font-black text-slate-800 uppercase">Giới hạn số lần làm bài thi</p>
                                <p className="text-[11px] text-slate-500">Mặc định 2 lần làm bài. Sau khi làm đủ số lần, nút làm bài sẽ đóng băng.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3].map(cnt => (
                                    <button
                                        key={cnt}
                                        type="button"
                                        onClick={() => props.setMaxAttempts && props.setMaxAttempts(cnt)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${(props.maxAttempts ?? 2) === cnt ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                    >
                                        {cnt} lần
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={props.maxAttempts ?? 2}
                                    onChange={e => props.setMaxAttempts && props.setMaxAttempts(Math.max(1, parseInt(e.target.value) || 2))}
                                    className="w-16 border-2 border-slate-200 rounded-xl p-1.5 text-center text-xs font-black bg-slate-50 focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Thứ tự luyện tập nếu là Luyện tập */}
                    {props.quizType === 'practice' && (
                        <div className="bg-white p-4 rounded-2xl border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs">
                                <p className="font-black text-slate-800 uppercase">Thứ tự luyện tập</p>
                                <p className="text-[11px] text-slate-500">0: Tự do chọn đề • 1, 2, 3...: Yêu cầu luyện tuần tự theo thứ tự</p>
                            </div>
                            <input 
                                type="number" 
                                min="0"
                                className="w-24 border-2 border-slate-200 rounded-xl p-2 text-center text-xs font-black bg-slate-50 focus:border-amber-400 outline-none" 
                                value={props.orderIndex} 
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    props.setOrderIndex(isNaN(val) ? 0 : val);
                                }} 
                            />
                        </div>
                    )}
                </div>

                {/* Khung thời gian và cài đặt kỳ thi */}
                <div className="bg-slate-50/70 p-6 rounded-[2.5rem] border-2 border-slate-100 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Zap size={18} className="text-blue-600" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {props.quizType === 'test' ? 'Khung thời gian mở đề & Quy chế thi' : 'Thời hạn luyện tập'}
                            </h4>
                        </div>
                        {props.quizType === 'test' && props.startTime && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => props.setEndTime(props.startTime)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${props.endTime === props.startTime ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    title="Tất cả học sinh vào làm cùng lúc và hết giờ cùng lúc"
                                >
                                    🎯 Đặt X = Y (Thi đồng loạt)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(props.startTime);
                                        d.setMinutes(d.getMinutes() + 30);
                                        const tzOffset = d.getTimezoneOffset() * 60000;
                                        props.setEndTime(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    +30 phút mở
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(props.startTime);
                                        d.setHours(d.getHours() + 1);
                                        const tzOffset = d.getTimezoneOffset() * 60000;
                                        props.setEndTime(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    +1 giờ mở
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(props.startTime);
                                        d.setHours(d.getHours() + 2);
                                        const tzOffset = d.getTimezoneOffset() * 60000;
                                        props.setEndTime(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    +2 giờ mở
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const d = new Date(props.startTime);
                                        d.setHours(23, 59, 0, 0);
                                        const tzOffset = d.getTimezoneOffset() * 60000;
                                        props.setEndTime(new Date(d.getTime() - tzOffset).toISOString().slice(0, 16));
                                    }}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase transition-all"
                                >
                                    Hết ngày (23:59)
                                </button>
                            </div>
                        )}
                    </div>

                    {props.quizType === 'test' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-blue-600 uppercase ml-2 flex items-center gap-1.5">
                                        <span>📅 Giờ mở đề (Mốc X - Bắt đầu cho vào thi)</span>
                                    </label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full border-2 border-blue-200 rounded-[1.5rem] p-4 text-xs font-black bg-white focus:border-blue-500 outline-none shadow-sm" 
                                        value={props.startTime} 
                                        onChange={e => {
                                            props.setStartTime(e.target.value);
                                            // Nếu chưa có endTime thì gán tạm endTime = startTime
                                            if (!props.endTime) props.setEndTime(e.target.value);
                                        }} 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-indigo-600 uppercase ml-2 flex items-center gap-1.5">
                                        <span>⏳ Giờ đóng mở đề (Mốc Y - Hết hạn vào thi)</span>
                                    </label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full border-2 border-indigo-200 rounded-[1.5rem] p-4 text-xs font-black bg-white focus:border-indigo-500 outline-none shadow-sm" 
                                        value={props.endTime} 
                                        onChange={e => props.setEndTime(e.target.value)} 
                                    />
                                </div>
                            </div>

                            {/* Banner giải thích quy tắc thời gian làm bài */}
                            {props.startTime ? (
                                props.endTime && props.startTime !== props.endTime && new Date(props.endTime) > new Date(props.startTime) ? (
                                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                                        <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                                            <Zap size={14} />
                                        </div>
                                        <div className="text-xs text-emerald-900 leading-relaxed">
                                            <p className="font-black uppercase text-[11px] text-emerald-800 mb-0.5">
                                                Chế độ Khung giờ mở đề linh hoạt (Mở từ X đến Y)
                                            </p>
                                            <p className="font-medium text-emerald-700">
                                                Học sinh vào làm bài tại bất kỳ thời điểm nào trong khung giờ 
                                                từ <b>{new Date(props.startTime).toLocaleString('vi-VN')}</b> đến <b>{new Date(props.endTime).toLocaleString('vi-VN')}</b> đều 
                                                được <b>tính trọn vẹn {props.duration} phút làm bài</b> kể từ lúc bấm vào thi.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                                        <div className="p-2 bg-amber-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                                            <ShieldAlert size={14} />
                                        </div>
                                        <div className="text-xs text-amber-900 leading-relaxed">
                                            <p className="font-black uppercase text-[11px] text-amber-800 mb-0.5">
                                                Chế độ Thi đồng loạt (X = Y)
                                            </p>
                                            <p className="font-medium text-amber-700">
                                                Đề thi mở vào lúc <b>{new Date(props.startTime).toLocaleString('vi-VN')}</b>. Tất cả học sinh 
                                                phải <b>nộp bài đồng thời trước hạn chót</b> (sau {props.duration} phút). Nếu học sinh vào trễ sau giờ mở đề, thời gian làm bài sẽ bị rút ngắn tương ứng.
                                            </p>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-[11px] font-bold text-slate-400 italic">
                                    💡 Để trống nếu muốn mở đề tự do bất kỳ lúc nào sau khi công khai.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-600 uppercase ml-2">
                                Hạn chót luyện tập (Để trống nếu mở vĩnh viễn)
                            </label>
                            <input 
                                type="datetime-local" 
                                className="w-full border-2 border-slate-200 rounded-[1.5rem] p-4 text-xs font-black bg-white focus:border-blue-300 outline-none" 
                                value={props.endTime} 
                                onChange={e => props.setEndTime(e.target.value)} 
                            />
                        </div>
                    )}
                </div>

                {/* GIAO ĐỀ CHO LỚP VÀ PHÂN HÓA ĐỐI TƯỢNG HỌC SINH */}
                <div className="bg-indigo-50/40 border-2 border-indigo-100 p-6 rounded-[2.5rem] space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                                <GraduationCap size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                    Đối tượng giao đề & Phân hóa lớp học
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold">
                                    Chỉ định lớp nào được quyền nhìn thấy và làm đề thi này
                                </p>
                            </div>
                        </div>

                        {/* Switch giữa Toàn khối và Giao cho Lớp chỉ định */}
                        <div className="flex bg-white p-1 rounded-2xl border shadow-sm shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    if (props.setTargetType) props.setTargetType('all');
                                    if (props.setAssignedClassIds) props.setAssignedClassIds([]);
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${(!props.targetType || props.targetType === 'all') ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                🌐 Toàn khối {props.grade}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (props.setTargetType) props.setTargetType('classes');
                                }}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${props.targetType === 'classes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                🎯 Giao lớp chỉ định
                            </button>
                        </div>
                    </div>

                    {props.targetType === 'classes' ? (
                        <div className="space-y-4 pt-2">
                            <div className="flex flex-wrap justify-between items-center gap-2 bg-white/80 p-3 rounded-2xl border border-indigo-100">
                                <span className="text-[11px] font-black text-indigo-900">
                                    Danh sách Lớp học ({props.assignedClassIds?.length || 0} lớp được chọn):
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (props.classes && props.setAssignedClassIds) {
                                                const relevantIds = props.classes
                                                    .filter(c => props.grade === 'all' || String(c.grade) === String(props.grade))
                                                    .map(c => c.id);
                                                props.setAssignedClassIds(relevantIds);
                                            }
                                        }}
                                        className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (props.setAssignedClassIds) props.setAssignedClassIds([]);
                                        }}
                                        className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            {props.classes && props.classes.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {props.classes
                                        .filter(c => props.grade === 'all' || String(c.grade) === String(props.grade))
                                        .map(c => {
                                            const isChecked = Boolean(props.assignedClassIds?.includes(c.id));
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        if (!props.setAssignedClassIds) return;
                                                        const current = props.assignedClassIds || [];
                                                        if (isChecked) {
                                                            props.setAssignedClassIds(current.filter(id => id !== c.id));
                                                        } else {
                                                            props.setAssignedClassIds([...current, c.id]);
                                                        }
                                                    }}
                                                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${isChecked ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        {isChecked ? <CheckSquare size={16} className="text-white" /> : <Square size={16} className="text-slate-300" />}
                                                        <div>
                                                            <p className="font-black text-xs uppercase leading-tight">
                                                                {c.name}
                                                            </p>
                                                            <p className={`text-[9px] font-bold ${isChecked ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                Niên khóa {c.academicYear} • Khối {c.grade}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <div className="p-4 bg-white rounded-2xl border border-dashed text-center text-xs text-slate-400 font-bold">
                                    Chưa có lớp nào được tạo cho Khối {props.grade}. Hãy vào tab <strong>"LỚP & NIÊN KHÓA"</strong> để tạo lớp trước.
                                </div>
                            )}

                            {(props.assignedClassIds?.length || 0) === 0 && (
                                <p className="text-[10px] text-amber-600 font-bold italic">
                                    ⚠️ Chú ý: Bạn chưa chọn lớp nào! Nếu lưu bây giờ, chưa học sinh nào có thể thấy đề này.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] text-slate-500 font-medium">
                            Đề thi này sẽ hiển thị công khai cho <strong>tất cả học sinh thuộc Khối {props.grade}</strong>.
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-amber-600 uppercase ml-2 flex items-center gap-1"><Eye size={12}/> Xem đáp án & Lời giải</label>
                        <button 
                            type="button"
                            onClick={() => props.setAllowReview && props.setAllowReview(!props.allowReview)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all flex items-center justify-center gap-2 ${props.allowReview ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-md shadow-amber-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                            title={props.allowReview ? "Học sinh được xem đáp án đúng và lời giải chi tiết" : "Đã khóa đáp án: Học sinh chỉ thấy điểm tổng kết, chống lộ đề"}
                        >
                            {props.allowReview ? <Eye size={16}/> : <EyeOff size={16}/>}
                            {props.allowReview ? 'CHO XEM ĐÁP ÁN' : 'KHÓA ĐÁP ÁN (ẨN GIẢI)'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-red-600 uppercase ml-2 flex items-center gap-1"><ShieldAlert size={12}/> Chế độ bảo mật</label>
                        <button 
                            type="button"
                            onClick={() => props.setIsMonitored(!props.isMonitored)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all flex items-center justify-center gap-2 ${props.isMonitored ? 'bg-red-50 text-red-600 border-red-200 shadow-md shadow-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                        >
                            {props.isMonitored ? <ShieldCheck size={16}/> : <ShieldAlert size={16}/>}
                            {props.isMonitored ? 'BẬT CHỐNG GIAN LẬN' : 'KHÔNG GIÁM SÁT'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase ml-2 flex items-center gap-1"><EyeOff size={12}/> Chế độ riêng tư</label>
                        <button 
                            type="button"
                            onClick={() => props.setIsUnlisted(!props.isUnlisted)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all flex items-center justify-center gap-2 ${props.isUnlisted ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-md shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                        >
                            {props.isUnlisted ? <LinkIcon size={16}/> : <Eye size={16}/>}
                            {props.isUnlisted ? 'CHỈ LÀM QUA LINK' : 'HIỆN CÔNG KHAI'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Trạng thái phát hành</label>
                        <button 
                            type="button"
                            onClick={() => props.setIsPublished(!props.isPublished)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all shadow-md ${props.isPublished ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-200 text-slate-500 border-slate-300'}`}
                        >
                            {props.isPublished ? 'ĐÃ CÔNG KHAI' : 'BẢN NHÁP (ẨN)'}
                        </button>
                    </div>
                </div>

                <button onClick={props.onSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-sm flex items-center justify-center gap-4 hover:bg-black transition-all shadow-2xl active:scale-[0.98] mt-6"><Save size={24}/> LƯU TOÀN BỘ ĐỀ THI VÀO DATABASE</button>
            </div>

            {/* THỐNG KÊ MA TRẬN MỨC ĐỘ NHẬN THỨC CỦA ĐỀ THI */}
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl shadow-md">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                Ma trận phân bố mức độ nhận thức ({props.questions.length} câu)
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold">
                                Phân loại chuẩn theo 4 mức độ: Biết [B], Hiểu [H], Vận dụng [VD], Vận dụng cao [VDC]
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {/* Mức 1: Biết */}
                    {(() => {
                        const countB = props.questions.filter(q => q.level === 'B').length;
                        const pctB = props.questions.length > 0 ? Math.round((countB / props.questions.length) * 100) : 0;
                        return (
                            <div className="bg-emerald-50/70 border-2 border-emerald-200/80 p-4 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-emerald-800 uppercase">[B] Biết</span>
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{pctB}%</span>
                                </div>
                                <div className="text-2xl font-black text-emerald-700">{countB} <span className="text-xs font-bold text-emerald-600">câu</span></div>
                                <div className="text-[9px] text-emerald-600/80 font-bold truncate">Nhận diện / Định nghĩa</div>
                            </div>
                        );
                    })()}

                    {/* Mức 2: Hiểu */}
                    {(() => {
                        const countH = props.questions.filter(q => q.level === 'H').length;
                        const pctH = props.questions.length > 0 ? Math.round((countH / props.questions.length) * 100) : 0;
                        return (
                            <div className="bg-blue-50/70 border-2 border-blue-200/80 p-4 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-blue-800 uppercase">[H] Hiểu</span>
                                    <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{pctH}%</span>
                                </div>
                                <div className="text-2xl font-black text-blue-700">{countH} <span className="text-xs font-bold text-blue-600">câu</span></div>
                                <div className="text-[9px] text-blue-600/80 font-bold truncate">Thông hiểu / Đọc đồ thị</div>
                            </div>
                        );
                    })()}

                    {/* Mức 3: Vận dụng */}
                    {(() => {
                        const countVD = props.questions.filter(q => q.level === 'VD').length;
                        const pctVD = props.questions.length > 0 ? Math.round((countVD / props.questions.length) * 100) : 0;
                        return (
                            <div className="bg-amber-50/70 border-2 border-amber-200/80 p-4 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-amber-800 uppercase">[VD] Vận dụng</span>
                                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{pctVD}%</span>
                                </div>
                                <div className="text-2xl font-black text-amber-700">{countVD} <span className="text-xs font-bold text-amber-600">câu</span></div>
                                <div className="text-[9px] text-amber-600/80 font-bold truncate">Biến đổi / Tính toán</div>
                            </div>
                        );
                    })()}

                    {/* Mức 4: Vận dụng cao */}
                    {(() => {
                        const countVDC = props.questions.filter(q => q.level === 'VDC').length;
                        const pctVDC = props.questions.length > 0 ? Math.round((countVDC / props.questions.length) * 100) : 0;
                        return (
                            <div className="bg-red-50/70 border-2 border-red-200/80 p-4 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-red-800 uppercase">[VDC] V.Dụng cao</span>
                                    <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{pctVDC}%</span>
                                </div>
                                <div className="text-2xl font-black text-red-700">{countVDC} <span className="text-xs font-bold text-red-600">câu</span></div>
                                <div className="text-[9px] text-red-600/80 font-bold truncate">Cực trị / Phân hóa 9-10</div>
                            </div>
                        );
                    })()}

                    {/* Chưa phân loại nếu có */}
                    {(() => {
                        const countNone = props.questions.filter(q => !q.level).length;
                        if (countNone === 0) return null;
                        const pctNone = Math.round((countNone / props.questions.length) * 100);
                        return (
                            <div className="bg-slate-100 border-2 border-slate-200 p-4 rounded-2xl space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-600 uppercase">Chưa gán</span>
                                    <span className="text-[10px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{pctNone}%</span>
                                </div>
                                <div className="text-2xl font-black text-slate-700">{countNone} <span className="text-xs font-bold text-slate-500">câu</span></div>
                                <div className="text-[9px] text-slate-500 font-bold truncate">Click chọn mức độ dưới</div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* THANH QUẢN LÝ PHÂN LOẠI CHƯƠNG & MA TRẬN ĐỀ THI (HỖ TRỢ ĐỀ KTTX, KTGK, CUỐI KỲ) */}
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                            <FolderTree size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                Phân loại Chương câu hỏi & Ma trận đề
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">KTTX / KTGK / Cuối kỳ</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 font-bold">
                                Gán từng câu hỏi vào đúng chương để khi lưu vào Ngân hàng hoặc xuất JSON, câu hỏi sẽ tự về đúng danh mục kiến thức.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {/* Nút AI tự động nhận diện chương */}
                        <button
                            type="button"
                            onClick={handleAutoCategorizeChapters}
                            disabled={isAutoCategorizing || props.questions.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-xs font-black uppercase hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            title="AI sẽ đọc toàn bộ câu hỏi và tự động đối chiếu ghép vào chương tương ứng"
                        >
                            {isAutoCategorizing ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>AI đang phân loại...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    <span>AI nhận diện chương</span>
                                </>
                            )}
                        </button>

                        {/* Nút bật thanh gán nhanh theo dải câu */}
                        <button
                            type="button"
                            onClick={() => setShowBatchAssignBar(!showBatchAssignBar)}
                            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-2 rounded-2xl text-xs font-black uppercase transition-all ${
                                showBatchAssignBar ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Zap size={14} />
                            <span>Gán theo dải câu</span>
                        </button>
                    </div>
                </div>

                {/* THÔNG BÁO TRẠNG THÁI AI / GÁN CHƯƠNG */}
                {categorizeMessage && (
                    <div className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 text-xs font-bold animate-fade-in ${
                        categorizeMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                        categorizeMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                        <div className="flex items-center gap-2.5">
                            {categorizeMessage.type === 'info' && <Loader2 size={16} className="animate-spin text-blue-600 shrink-0" />}
                            {categorizeMessage.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                            {categorizeMessage.type === 'error' && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                            <span>{categorizeMessage.text}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setCategorizeMessage(null)}
                            className="p-1 hover:bg-black/5 rounded-lg transition-colors shrink-0"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Phân bố các chương hiện tại */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Phân bố chương:</span>
                    {Object.entries(chapterDistribution).map(([chName, count]) => (
                        <div key={chName} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-[11px] font-bold text-slate-700">
                            <span className="truncate max-w-[200px]">{chName}:</span>
                            <span className="bg-purple-100 text-purple-800 font-black px-1.5 py-0.2 rounded-md text-[10px]">{count} câu</span>
                        </div>
                    ))}
                </div>

                {/* Thanh công cụ gán nhanh theo dải câu */}
                {showBatchAssignBar && (
                    <div className="bg-purple-50/70 border-2 border-purple-200 p-4 rounded-2xl flex flex-wrap items-center gap-3 animate-fade-in">
                        <span className="text-xs font-black text-purple-900 uppercase">Gán nhanh:</span>
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                            <span>Từ câu</span>
                            <input
                                type="number"
                                min={1}
                                max={props.questions.length}
                                value={batchRangeFrom}
                                onChange={(e) => setBatchRangeFrom(Number(e.target.value))}
                                className="w-14 bg-white border border-purple-200 rounded-lg px-2 py-1 text-center font-black text-purple-700 outline-none"
                            />
                            <span>đến câu</span>
                            <input
                                type="number"
                                min={1}
                                max={props.questions.length}
                                value={batchRangeTo}
                                onChange={(e) => setBatchRangeTo(Number(e.target.value))}
                                className="w-14 bg-white border border-purple-200 rounded-lg px-2 py-1 text-center font-black text-purple-700 outline-none"
                            />
                        </div>

                        <span className="text-xs font-bold text-slate-600">vào</span>
                        <select
                            value={batchTargetChapter}
                            onChange={(e) => setBatchTargetChapter(e.target.value)}
                            className="bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none max-w-[260px]"
                        >
                            <option value="">-- Chọn Chương muốn gán --</option>
                            {relevantChapters.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={handleApplyBatchChapterRange}
                            className="px-4 py-1.5 bg-purple-700 text-white rounded-xl text-xs font-black uppercase hover:bg-purple-800 transition-all shadow-sm active:scale-95"
                        >
                            Áp dụng gán
                        </button>
                    </div>
                )}
            </div>

            <QuestionSection 
                sectionTitle="PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN" 
                type="mcq" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank}
                onOpenGalleryForQuestion={handleOpenGalleryForQuestion}
                onOpenBatchForImage={handleOpenBatchForImage}
                uniqueImagesCount={uniqueImagesCount}
                onOpenLatexHelper={handleOpenLatexHelper}
                relevantChapters={relevantChapters}
            />
            <QuestionSection 
                sectionTitle="PHẦN II. TRẮC NGHIỆM ĐÚNG SAI" 
                type="group-tf" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank}
                onOpenGalleryForQuestion={handleOpenGalleryForQuestion}
                onOpenBatchForImage={handleOpenBatchForImage}
                uniqueImagesCount={uniqueImagesCount}
                onOpenLatexHelper={handleOpenLatexHelper}
                relevantChapters={relevantChapters}
            />
            <QuestionSection 
                sectionTitle="PHẦN III. TRẢ LỜI NGẮN" 
                type="short" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank}
                onOpenGalleryForQuestion={handleOpenGalleryForQuestion}
                onOpenBatchForImage={handleOpenBatchForImage}
                uniqueImagesCount={uniqueImagesCount}
                onOpenLatexHelper={handleOpenLatexHelper}
                relevantChapters={relevantChapters}
            />

            {/* Modal Quản lý và Tái sử dụng kho ảnh đề thi */}
            <QuizImageGalleryModal
                isOpen={isGalleryOpen}
                onClose={() => {
                    setIsGalleryOpen(false);
                    setGalleryTargetQId(null);
                }}
                questions={props.questions}
                targetQuestionId={galleryTargetQId}
                onSelectImageForQuestion={handleSelectImageForQuestion}
                onBatchApplyImage={handleBatchApplyImage}
            />

            {/* Modal Hỗ trợ công thức Toán & Ký hiệu LaTeX */}
            <LatexHelperModal
                isOpen={isLatexHelperOpen}
                onClose={() => {
                    setIsLatexHelperOpen(false);
                    setLatexTargetQId(null);
                    setLatexTargetLabel(null);
                    setLatexInitialCode('');
                }}
                onInsertCode={latexTargetQId ? handleInsertLatexSnippet : undefined}
                targetQuestionLabel={latexTargetLabel}
                initialCode={latexInitialCode}
            />
        </div>
    );
}
