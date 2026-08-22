
import React, { useState, useMemo } from 'react';
import { Quiz, Question, Grade, QuestionType, Chapter, QuizType, ClassRoom } from '../../types';
import { 
  Save, FileUp, Database, CheckCircle2, HelpCircle, AlignLeft, Trash2, 
  Target as TargetIcon, Plus, ImageIcon, Loader2, Lightbulb, Eye, ImageMinus, 
  ShieldAlert, ShieldCheck, Sparkles, Zap, Type as TypeIcon, X, Link as LinkIcon, 
  EyeOff, FileCode, GraduationCap, CheckSquare, Square, Users, Copy, Check,
  Link2, Layers, Image as ImageLucide, FileText, Bookmark, Quote
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from '../LatexText';
import { parseQuestionsFromJSON } from '../../services/gemini';
import QuizImageGalleryModal from './QuizImageGalleryModal';
import LatexHelperModal from './LatexHelperModal';

interface QuizEditorProps {
    editingId: string | null;
    title: string;
    setTitle: (val: string) => void;
    grade: Grade;
    setGrade: (val: Grade) => void;
    quizType: QuizType;
    setQuizType: (val: QuizType) => void;
    isPublished: boolean;
    setIsPublished: (val: boolean) => void;
    isMonitored?: boolean;
    setIsMonitored: (val: boolean) => void;
    isUnlisted?: boolean;
    setIsUnlisted: (val: boolean) => void;
    duration: number;
    setDuration: (val: number) => void;
    category: string;
    setCategory: (val: string) => void;
    startTime: string;
    setStartTime: (val: string) => void;
    endTime: string;
    setEndTime: (val: string) => void;
    questions: Question[];
    setQuestions: (val: Question[]) => void;
    chapters: Chapter[];
    classes?: ClassRoom[];
    targetType?: 'all' | 'classes';
    setTargetType?: (val: 'all' | 'classes') => void;
    assignedClassIds?: string[];
    setAssignedClassIds?: (val: string[]) => void;
    onSave: () => void;
    onCleanLabels: () => void;
    onOpenBank: (type: QuestionType) => void;
    orderIndex: number;
    setOrderIndex: (val: number) => void;
    onPdfExtract: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTextExtract: (text: string) => void;
    onUploadImage: (qId: string, file: File) => void;
    uploadingId: string | null;
    isAiLoading?: boolean;
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
    onOpenLatexHelper
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
                <div key={q.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 shadow-sm relative group animate-fade-in-up">
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
                    <div className="mb-8 p-6 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col md:flex-row items-center gap-8">
                        <div className="shrink-0 relative">
                            {q.imageUrl ? (
                                <img src={q.imageUrl} className="w-32 h-32 object-cover rounded-[1.5rem] border-4 border-white shadow-lg" alt="q" />
                            ) : (
                                <div className="w-32 h-32 bg-white border-2 border-slate-100 rounded-[1.5rem] flex flex-col items-center justify-center text-slate-300">
                                    {uploadingId === q.id ? <Loader2 className="animate-spin text-blue-500" size={32}/> : <ImageIcon size={32}/>}
                                    <span className="text-[9px] font-black uppercase mt-2">{uploadingId === q.id ? 'Đang tải...' : 'Chưa có ảnh'}</span>
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
                            
                            <p className="text-[9px] font-bold text-slate-400 uppercase italic">
                                {q.imageUrl 
                                    ? '💡 Mẹo: Bấm "Copy link ảnh" hoặc "Dùng cho câu khác" để tái sử dụng hình này cho các câu cùng bảng/đồ thị mà không cần tải lại.' 
                                    : 'Tải ảnh từ máy tính hoặc bấm "Chọn từ đề / Dán link" để dùng chung ảnh với các câu khác.'}
                            </p>
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
    const relevantChapters = props.chapters.filter(c => String(c.grade) === String(props.grade));

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

            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-sm space-y-10 relative overflow-hidden">
                <div className={`absolute top-0 right-16 px-8 py-3 rounded-b-3xl font-black text-xs uppercase shadow-xl z-10 transition-colors ${totalPoints === 10 ? 'bg-emerald-600' : 'bg-orange-500'} text-white`}>
                    Tổng điểm đề: {totalPoints.toFixed(2)}đ
                </div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-slate-50 pb-6">
                    <div className="flex-1 min-w-0 space-y-1 pr-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest whitespace-nowrap block">
                            Tiêu đề đề thi
                        </label>
                        <input 
                            type="text" 
                            className="text-lg md:text-xl lg:text-2xl font-black outline-none bg-transparent w-full uppercase placeholder:text-slate-300 focus:text-blue-600 transition-colors" 
                            placeholder="VD: KIỂM TRA CHƯƠNG I ĐẠO HÀM..." 
                            value={props.title} 
                            onChange={e => props.setTitle(e.target.value)} 
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {/* Nút mở Thư viện ảnh đề thi */}
                        <button
                            type="button"
                            onClick={() => {
                                setGalleryTargetQId(null);
                                setIsGalleryOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Quản lý và tái sử dụng kho ảnh của đề thi"
                        >
                            <ImageLucide size={13}/> Kho ảnh ({uniqueImagesCount})
                        </button>
                        {/* Nút mở Bảng hỗ trợ công thức Toán & LaTeX */}
                        <button
                            type="button"
                            onClick={() => handleOpenLatexHelper()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-[10px] font-black uppercase hover:bg-cyan-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Tra cứu nhanh và chèn công thức Toán, tích phân, phân số, ký hiệu LaTeX"
                        >
                            <Sparkles size={13}/> Hỗ trợ LaTeX
                        </button>
                        <label 
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-amber-600 transition-all shadow-xs active:scale-95 whitespace-nowrap" 
                            title="Nhập trực tiếp file .json (Không tốn lượt AI)"
                        >
                            <FileCode size={13}/> Nhập JSON
                            <input type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFileSelect}/>
                        </label>
                        <button 
                            onClick={props.onCleanLabels}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-xs active:scale-95 whitespace-nowrap"
                            title="Xóa bỏ các nhãn A., B., a), b) dư thừa trong nội dung câu hỏi"
                        >
                            <Zap size={13}/> Dọn nhãn
                        </button>
                        <button 
                            onClick={() => setIsTextInputOpen(true)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-black transition-all shadow-xs active:scale-95 whitespace-nowrap ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <TypeIcon size={13}/> Nhập văn bản (AI)
                        </button>
                        <label className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-black transition-all shadow-xs active:scale-95 whitespace-nowrap ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileUp size={13}/> Nhập PDF (AI)
                            <input type="file" accept="application/pdf" className="hidden" disabled={props.isAiLoading} onChange={props.onPdfExtract}/>
                        </label>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Khối lớp</label>
                        <select className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.grade} onChange={e => { props.setGrade(e.target.value as Grade); props.setCategory(''); }}>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
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
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Hình thức</label>
                        <select className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.quizType} onChange={e => {
                            const val = e.target.value as any;
                            props.setQuizType(val);
                            if (val === 'practice') props.setIsMonitored(false);
                        }}>
                            <option value="practice">Luyện tập (Tự do)</option>
                            <option value="test">Kiểm tra (Hẹn giờ)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Thứ tự luyện (0: Tự do, 1-N: Trình tự)</label>
                        <input 
                            type="number" 
                            min="0"
                            className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" 
                            value={props.orderIndex} 
                            onChange={e => {
                                const val = parseInt(e.target.value);
                                props.setOrderIndex(isNaN(val) ? 0 : val);
                            }} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Thời lượng (phút)</label>
                        <input type="number" className="w-full border-2 border-slate-100 rounded-[1.5rem] p-4 text-xs font-black bg-slate-50 focus:border-blue-300 outline-none" value={props.duration} onChange={e => props.setDuration(parseInt(e.target.value))} />
                    </div>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-red-600 uppercase ml-2 flex items-center gap-1"><ShieldAlert size={12}/> Chế độ bảo mật</label>
                        <button 
                            onClick={() => props.setIsMonitored(!props.isMonitored)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all flex items-center justify-center gap-3 ${props.isMonitored ? 'bg-red-50 text-red-600 border-red-200 shadow-lg shadow-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                        >
                            {props.isMonitored ? <ShieldCheck size={16}/> : <ShieldAlert size={16}/>}
                            {props.isMonitored ? 'ĐÃ BẬT CHỐNG GIAN LẬN' : 'KHÔNG GIÁM SÁT'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase ml-2 flex items-center gap-1"><EyeOff size={12}/> Chế độ riêng tư</label>
                        <button 
                            onClick={() => props.setIsUnlisted(!props.isUnlisted)} 
                            className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all flex items-center justify-center gap-3 ${props.isUnlisted ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                        >
                            {props.isUnlisted ? <LinkIcon size={16}/> : <Eye size={16}/>}
                            {props.isUnlisted ? 'CHỈ LÀM QUA LINK' : 'HIỆN CÔNG KHAI'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Trạng thái phát hành</label>
                        <button onClick={() => props.setIsPublished(!props.isPublished)} className={`w-full p-4 rounded-[1.5rem] font-black text-[10px] border-2 transition-all shadow-md ${props.isPublished ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-200 text-slate-500 border-slate-300'}`}>
                            {props.isPublished ? 'ĐÃ CÔNG KHAI' : 'BẢN NHÁP (ẨN)'}
                        </button>
                    </div>
                </div>

                <button onClick={props.onSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-sm flex items-center justify-center gap-4 hover:bg-black transition-all shadow-2xl active:scale-[0.98] mt-6"><Save size={24}/> LƯU TOÀN BỘ ĐỀ THI VÀO DATABASE</button>
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
