
import React, { useState } from 'react';
import { Quiz, Question, Grade, QuestionType, Chapter, QuizType } from '../../types';
import { Save, FileUp, Database, CheckCircle2, HelpCircle, AlignLeft, Trash2, Target as TargetIcon, Plus, ImageIcon, Loader2, Lightbulb, Eye, ImageMinus, ShieldAlert, ShieldCheck, Sparkles, Zap, Type as TypeIcon, X, Link as LinkIcon, EyeOff } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from '../LatexText';

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
}

const QuestionSection: React.FC<QuestionSectionProps> = ({ sectionTitle, type, questions, setQuestions, onUploadImage, uploadingId, onOpenBank }) => {
    const [quickPoints, setQuickPoints] = useState(type === 'mcq' ? "0.25" : "1.0");
    const sectionQuestions = questions.filter(q => q.type === type);
    const Icon = type === 'mcq' ? CheckCircle2 : type === 'group-tf' ? HelpCircle : AlignLeft;

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
                    
                    <div className="flex items-center gap-4 mb-6">
                        <span className="text-[11px] font-black px-5 py-2 rounded-xl uppercase bg-slate-900 text-white">Câu {idx + 1}</span>
                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border-2 border-blue-100">
                            <TargetIcon size={14} className="text-blue-500" />
                            <input type="text" className="bg-transparent text-sm font-black text-blue-700 outline-none w-14 text-center" value={q.points} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].points = e.target.value; setQuestions(nl); }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nội dung đề (LaTeX: $...$)</label>
                            <textarea className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-sm font-bold outline-none min-h-[120px] focus:border-blue-300 transition-colors" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="VD: Tìm $x$ biết $x^2 = 4$..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-500 uppercase ml-2">Xem trước hiển thị</label>
                            <div className="w-full p-6 bg-blue-50/20 rounded-[2rem] border-2 border-blue-100/50 min-h-[120px] text-sm overflow-auto"><LatexText text={q.text || '*Đề trống*'} /></div>
                        </div>
                    </div>

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
                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-tight">Đính kèm hình ảnh minh họa</h4>
                            <div className="flex flex-wrap gap-2">
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} />
                                <label htmlFor={`img-${q.id}`} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase cursor-pointer flex items-center gap-2 transition-all ${uploadingId === q.id ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-black shadow-lg shadow-blue-200'}`}>
                                    {uploadingId === q.id ? <Loader2 className="animate-spin" size={14}/> : <ImageIcon size={14}/>} 
                                    {uploadingId === q.id ? 'ĐANG XỬ LÝ...' : (q.imageUrl ? 'THAY ĐỔI ẢNH' : 'TẢI ẢNH LÊN')}
                                </label>
                                {q.imageUrl && (
                                    <button 
                                        onClick={() => handleRemoveImage(q.id)}
                                        className="px-6 py-3 bg-red-50 text-red-600 border-2 border-red-100 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <ImageMinus size={14}/> Gỡ ảnh
                                    </button>
                                )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase italic">Tự động tối ưu dung lượng khi tải lên Cloud.</p>
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
                                    <span className="text-xs font-black text-blue-600 w-10">{String.fromCharCode(97+si)})</span>
                                    <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý trắc nghiệm..." />
                                    <div className="flex bg-white rounded-xl p-1 border-2 border-slate-200">
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

    const totalPoints = props.questions.reduce((acc, q) => acc + safeParseScore(q.points), 0);
    const relevantChapters = props.chapters.filter(c => c.grade === props.grade);

    const handleConfirmTextExtract = () => {
        if (!pastedText.trim()) return;
        props.onTextExtract(pastedText);
        setPastedText('');
        setIsTextInputOpen(false);
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
                                Copy nội dung đề từ Word hoặc Web dán vào đây. Hệ thống AI sẽ tự nhận diện Câu hỏi, Đáp án và Lời giải.
                            </p>
                            <textarea 
                                className="w-full h-80 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none font-medium text-sm focus:border-blue-400 transition-all"
                                placeholder="Dán nội dung tại đây..."
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
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-b-2 border-slate-50 pb-10">
                    <div className="flex-1 w-full space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề đề thi</label>
                        <input type="text" className="text-3xl font-black outline-none bg-transparent w-full uppercase placeholder:text-slate-100 focus:text-blue-600 transition-colors" placeholder="VD: KIỂM TRA CHƯƠNG I ĐẠO HÀM..." value={props.title} onChange={e => props.setTitle(e.target.value)} />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={props.onCleanLabels}
                            className="flex items-center gap-3 px-6 py-5 bg-emerald-50 text-emerald-600 border-2 border-emerald-100 rounded-[2rem] text-xs font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-xl active:scale-95"
                            title="Xóa bỏ các nhãn A., B., a), b) dư thừa trong nội dung câu hỏi"
                        >
                            <Zap size={20}/> DỌN DẸP NHÃN
                        </button>
                        <button 
                            onClick={() => setIsTextInputOpen(true)}
                            className={`flex items-center gap-3 px-6 py-5 bg-blue-600 text-white rounded-[2rem] text-xs font-black uppercase hover:bg-black transition-all shadow-2xl active:scale-95 ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <TypeIcon size={20}/> NHẬP TỪ VĂN BẢN (AI)
                        </button>
                        <label className={`flex items-center gap-3 px-6 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase cursor-pointer hover:bg-black transition-all shadow-2xl active:scale-95 ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileUp size={20}/> NHẬP TỪ PDF (AI)
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
                            {relevantChapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-600 uppercase ml-2 flex items-center gap-1"><Zap size={12}/> Hạn chót nộp bài</label>
                        <input type="datetime-local" className="w-full border-2 border-blue-100 rounded-[1.5rem] p-4 text-xs font-black bg-blue-50/20 focus:bg-white outline-none" value={props.quizType === 'test' ? props.startTime : props.endTime} onChange={e => props.quizType === 'test' ? props.setStartTime(e.target.value) : props.setEndTime(e.target.value)} />
                    </div>
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

            <QuestionSection sectionTitle="PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN" type="mcq" questions={props.questions} setQuestions={props.setQuestions} onUploadImage={props.onUploadImage} uploadingId={props.uploadingId} onOpenBank={props.onOpenBank} />
            <QuestionSection sectionTitle="PHẦN II. TRẮC NGHIỆM ĐÚNG SAI" type="group-tf" questions={props.questions} setQuestions={props.setQuestions} onUploadImage={props.onUploadImage} uploadingId={props.uploadingId} onOpenBank={props.onOpenBank} />
            <QuestionSection sectionTitle="PHẦN III. TRẢ LỜI NGẮN" type="short" questions={props.questions} setQuestions={props.setQuestions} onUploadImage={props.onUploadImage} uploadingId={props.uploadingId} onOpenBank={props.onOpenBank} />
        </div>
    );
}
