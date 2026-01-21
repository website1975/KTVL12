
import React from 'react';
import { Quiz, Question, Grade, QuestionType, Chapter, QuizType } from '../../types';
import { Save, FileUp, Database, CheckCircle2, HelpCircle, AlignLeft, Trash2, Target as TargetIcon, CopyCheck, ImageIcon, Loader2, Lightbulb, Eye, Plus, Calendar, ImageMinus, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
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
    onOpenBank: (type: QuestionType) => void;
    onPdfExtract: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    const sectionQuestions = questions.filter(q => q.type === type);
    const Icon = type === 'mcq' ? CheckCircle2 : type === 'group-tf' ? HelpCircle : AlignLeft;

    const addManual = () => {
        const newQ: Question = {
            id: uuidv4(), type, text: '', points: type === 'mcq' ? 0.25 : 1.0,
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

    return (
        <div className="space-y-6 mt-10">
            <div className="flex items-center justify-between bg-white p-6 rounded-3xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${type === 'mcq' ? 'bg-blue-50 text-blue-600' : type === 'group-tf' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}><Icon size={24}/></div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">{sectionTitle}</h3>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => onOpenBank(type)} className="flex items-center gap-2 px-5 py-3 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase border border-blue-100 transition-all hover:bg-blue-600 hover:text-white"><Database size={14}/> Ngân hàng</button>
                    <button onClick={addManual} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase transition-all hover:bg-black"><Plus size={14}/> Thêm mới</button>
                </div>
            </div>

            {sectionQuestions.map((q, idx) => (
                <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm relative group animate-fade-in-up">
                    <button onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))} className="absolute top-8 right-8 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                    
                    <div className="flex items-center gap-4 mb-6">
                        <span className="text-[10px] font-black px-4 py-1.5 rounded-xl uppercase bg-slate-100 text-slate-500">Câu {idx + 1}</span>
                        <div className="flex items-center gap-2 bg-blue-50 px-4 py-1.5 rounded-2xl border border-blue-100">
                            <TargetIcon size={14} className="text-blue-500" />
                            <input type="text" className="bg-transparent text-xs font-black text-blue-700 outline-none w-14 text-center border-b border-blue-200" value={q.points} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].points = e.target.value; setQuestions(nl); }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                        <textarea className="w-full p-6 bg-slate-50 border rounded-3xl text-sm font-bold outline-none min-h-[100px] focus:border-blue-300" value={q.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung câu hỏi (LaTeX: $...$)" />
                        <div className="w-full p-6 bg-blue-50/30 rounded-3xl border border-blue-100 min-h-[100px] text-sm overflow-auto"><LatexText text={q.text || '*Trống*'} /></div>
                    </div>

                    <div className="mb-6 flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <div className="shrink-0">{q.imageUrl ? <img src={q.imageUrl} className="w-20 h-20 object-cover rounded-xl border" alt="q" /> : <div className="w-20 h-20 bg-white border rounded-xl flex items-center justify-center text-slate-300">{uploadingId === q.id ? <Loader2 className="animate-spin" size={16}/> : <ImageIcon size={20}/>}</div>}</div>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input type="file" accept="image/*" className="hidden" id={`img-${q.id}`} onChange={(e) => e.target.files && onUploadImage(q.id, e.target.files[0])} />
                                <label htmlFor={`img-${q.id}`} className="px-4 py-2 bg-white border rounded-xl text-[9px] font-black uppercase cursor-pointer hover:bg-slate-50 flex items-center gap-2">
                                    <ImageIcon size={14}/> Tải ảnh
                                </label>
                                {q.imageUrl && (
                                    <button 
                                        onClick={() => handleRemoveImage(q.id)}
                                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <ImageMinus size={14}/> Xóa ảnh
                                    </button>
                                )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase italic">Hỗ trợ định dạng .jpg, .png, .webp</p>
                        </div>
                    </div>

                    {type === 'mcq' && q.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                                    <input type="radio" name={`ans-${q.id}`} checked={q.correctAnswer === opt && opt !== ''} onChange={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = opt; setQuestions(nl); }} />
                                    <input type="text" className="bg-transparent text-sm font-bold outline-none flex-1" value={opt} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].options![oi] = e.target.value; setQuestions(nl); }} placeholder={`Đáp án ${String.fromCharCode(65+oi)}...`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {type === 'group-tf' && q.subQuestions && (
                        <div className="space-y-3 mb-6">
                            {q.subQuestions.map((sq, si) => (
                                <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                                    <span className="text-xs font-black text-blue-600 w-6">{String.fromCharCode(97+si)})</span>
                                    <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={sq.text} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].text = e.target.value; setQuestions(nl); }} placeholder="Nội dung ý..." />
                                    <div className="flex bg-white rounded-xl p-1 border">
                                        {['True', 'False'].map(v => (
                                            <button key={v} onClick={() => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].subQuestions![si].correctAnswer = v as any; setQuestions(nl); }} className={`px-4 py-1 text-[9px] font-black rounded-lg transition-all ${sq.correctAnswer === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {type === 'short' && (
                        <div className="mb-6 flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border">
                            <span className="text-[10px] font-black text-orange-600 uppercase">Đáp án đúng:</span>
                            <input type="text" className="flex-1 bg-transparent text-sm font-bold outline-none" value={q.correctAnswer} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].correctAnswer = e.target.value; setQuestions(nl); }} placeholder="Nhập kết quả..." />
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2"><Lightbulb size={14}/> Hướng dẫn giải</label>
                            <textarea className="w-full p-4 bg-yellow-50/20 border border-yellow-100 rounded-2xl text-sm outline-none min-h-[80px]" value={q.solution} onChange={e => { const nl = [...questions]; const i = nl.findIndex(x => x.id === q.id); nl[i].solution = e.target.value; setQuestions(nl); }} placeholder="Giải chi tiết..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-yellow-600 uppercase flex items-center gap-2"><Eye size={14}/> Xem trước giải</label>
                            <div className="w-full p-4 bg-yellow-50/10 rounded-2xl border border-yellow-100/50 min-h-[80px] text-sm italic text-slate-500 overflow-auto"><LatexText text={q.solution || '*Chưa có lời giải*'} /></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const QuizEditor: React.FC<QuizEditorProps> = (props) => {
    const totalPoints = props.questions.reduce((acc, q) => acc + safeParseScore(q.points), 0);
    const relevantChapters = props.chapters.filter(c => c.grade === props.grade);

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-fade-in relative">
            {/* Loading Overlay khi trích xuất PDF hoặc AI đang chạy */}
            {props.isAiLoading && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center space-y-6 max-w-sm w-full border-4 border-blue-600/20">
                        <div className="relative w-20 h-20 mx-auto">
                            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="text-blue-600 animate-pulse" size={24}/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight">Hệ thống đang xử lý...</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Đang trích xuất dữ liệu thông minh bằng AI. Vui lòng đợi trong giây lát.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-10 rounded-[3rem] border shadow-sm space-y-8 relative overflow-hidden">
                <div className={`absolute top-0 right-10 px-6 py-2 rounded-b-2xl font-black text-[10px] uppercase shadow-lg z-10 ${totalPoints === 10 ? 'bg-emerald-600' : 'bg-orange-500'} text-white`}>
                    Tổng điểm đề: {totalPoints.toFixed(2)}đ
                </div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b pb-8">
                    <input type="text" className="text-3xl font-black outline-none bg-transparent w-full uppercase" placeholder="Tên đề thi..." value={props.title} onChange={e => props.setTitle(e.target.value)} />
                    <label className={`flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase cursor-pointer hover:bg-black transition-all ${props.isAiLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <FileUp size={16}/> {props.isAiLoading ? 'ĐANG XỬ LÝ...' : 'NHẬP TỪ PDF'}
                        <input type="file" accept="application/pdf" className="hidden" disabled={props.isAiLoading} onChange={props.onPdfExtract}/>
                    </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Khối lớp</label>
                        <select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={props.grade} onChange={e => { props.setGrade(e.target.value as Grade); props.setCategory(''); }}>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Chương học</label>
                        <select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={props.category} onChange={e => props.setCategory(e.target.value)}>
                            <option value="">Chọn chương...</option>
                            {relevantChapters.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Hình thức</label>
                        <select className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={props.quizType} onChange={e => props.setQuizType(e.target.value as any)}>
                            <option value="practice">Luyện tập</option>
                            <option value="test">Kiểm tra</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Thời gian (p)</label>
                        <input type="number" className="w-full border rounded-2xl p-4 text-xs font-black bg-slate-50" value={props.duration} onChange={e => props.setDuration(parseInt(e.target.value))} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {props.quizType === 'test' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-blue-600 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Thời gian mở đề (Kiểm tra)</label>
                                <input type="datetime-local" className="w-full border rounded-2xl p-4 text-xs font-black bg-blue-50/30 border-blue-100" value={props.startTime} onChange={e => props.setStartTime(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-red-600 uppercase ml-1 flex items-center gap-1"><ShieldAlert size={12}/> Giám sát (Chống gian lận)</label>
                                <button 
                                    onClick={() => props.setIsMonitored(!props.isMonitored)} 
                                    className={`w-full p-4 rounded-2xl font-black text-[10px] border transition-all flex items-center justify-center gap-2 ${props.isMonitored ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                >
                                    {props.isMonitored ? <ShieldCheck size={14}/> : <ShieldAlert size={14}/>}
                                    {props.isMonitored ? 'ĐANG BẬT GIÁM SÁT THI' : 'KHÔNG GIÁM SÁT (TỰ DO)'}
                                </button>
                            </div>
                        </>
                    )}
                    {props.quizType === 'practice' && (
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-red-600 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Hạn chót đóng đề (Luyện tập)</label>
                            <input type="datetime-local" className="w-full border rounded-2xl p-4 text-xs font-black bg-red-50/30 border-red-100" value={props.endTime} onChange={e => props.setEndTime(e.target.value)} />
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Trạng thái phát hành</label>
                        <button onClick={() => props.setIsPublished(!props.isPublished)} className={`w-full p-4 rounded-2xl font-black text-[10px] border transition-all ${props.isPublished ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                            {props.isPublished ? 'CÔNG KHAI CHO HỌC SINH' : 'LƯU BẢN NHÁP (ẨN)'}
                        </button>
                    </div>
                </div>

                <button onClick={props.onSave} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs flex items-center justify-center gap-3 hover:bg-black transition-all shadow-2xl"><Save size={20}/> LƯU ĐỀ THI</button>
            </div>

            <QuestionSection 
                sectionTitle="PHẦN I. TRẮC NGHIỆM" 
                type="mcq" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank} 
            />
            <QuestionSection 
                sectionTitle="PHẦN II. ĐÚNG/SAI" 
                type="group-tf" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank} 
            />
            <QuestionSection 
                sectionTitle="PHẦN III. TRẢ LỜI NGẮN" 
                type="short" 
                questions={props.questions} 
                setQuestions={props.setQuestions} 
                onUploadImage={props.onUploadImage} 
                uploadingId={props.uploadingId} 
                onOpenBank={props.onOpenBank} 
            />
        </div>
    );
};

export default QuizEditor;
