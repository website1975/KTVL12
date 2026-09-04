import React, { useState } from 'react';
import { Grade, Chapter, Question } from '../../types';
import { Sparkles, Database, LayoutTemplate, Loader2, AlertTriangle, PlusCircle, FileUp, Grid3X3, Wand2 } from 'lucide-react';
import MatrixQuizGenerator from './MatrixQuizGenerator';

interface AIRendererProps {
    grade: Grade;
    setGrade: (val: Grade) => void;
    chapters?: Chapter[];
    bankQuestions?: Question[];
    isBankLoading?: boolean;
    onLoadBank?: () => Promise<void>;
    onGenerate: (config: {
        topic: string;
        p1: number;
        p2: number;
        p3: number;
        target: 'editor' | 'bank';
        editorAction?: 'replace' | 'append';
        matrix?: { easy: number; medium: number; hard: number; vhard: number };
        pdfBase64?: string;
    }) => Promise<void>;
    onGenerateFromMatrix?: (
        createdQuestions: Question[], 
        quizTitle: string, 
        target: 'editor' | 'bank', 
        durationMinutes: number,
        editorAction?: 'replace' | 'append'
    ) => void;
    isLoading: boolean;
    hasQuestionsInEditor?: boolean;
}

export default function AIRenderer({ 
    grade, 
    setGrade, 
    chapters = [], 
    bankQuestions = [], 
    isBankLoading = false,
    onLoadBank,
    onGenerate, 
    onGenerateFromMatrix,
    isLoading, 
    hasQuestionsInEditor 
}: AIRendererProps) {
    // 3 Chế độ: 'matrix' (Ngân hàng theo Ma trận), 'prompt' (Soạn mới bằng Prompt), 'pdf' (Trích xuất từ PDF)
    const [activeMode, setActiveMode] = useState<'matrix' | 'prompt' | 'pdf'>('matrix');

    const [prompt, setPrompt] = useState('');
    const [p1, setP1] = useState(5);
    const [p2, setP2] = useState(2);
    const [p3, setP3] = useState(2);
    const [matrix, setMatrix] = useState({ easy: 40, medium: 30, hard: 20, vhard: 10 });
    const [target, setTarget] = useState<'editor' | 'bank'>('editor');
    const [editorAction, setEditorAction] = useState<'replace' | 'append'>('replace');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/pdf') {
                setErrorMsg("Chỉ hỗ trợ tệp PDF.");
                return;
            }
            setPdfFile(file);
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                setPdfBase64(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        setErrorMsg(null);
        try {
            await onGenerate({
                topic: prompt || (pdfFile ? `Dựa theo tài liệu: ${pdfFile.name}` : "Đề thi tổng hợp"),
                p1, p2, p3,
                target,
                editorAction: target === 'editor' ? editorAction : undefined,
                matrix,
                pdfBase64: pdfBase64 || undefined
            });
        } catch (err: any) {
            setErrorMsg(err.message || "Đã xảy ra lỗi không xác định.");
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* TAB CHỌN CHẾ ĐỘ SOẠN ĐỀ */}
            <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-200/80 rounded-3xl max-w-2xl mx-auto border border-slate-300 shadow-inner">
                <button
                    type="button"
                    onClick={() => setActiveMode('matrix')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-black uppercase transition-all ${
                        activeMode === 'matrix'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                >
                    <Grid3X3 size={16} />
                    <span>Lấy từ Ngân hàng (Ma trận)</span>
                    <span className="hidden sm:inline-block text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">Siêu tốc</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveMode('prompt')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-black uppercase transition-all ${
                        activeMode === 'prompt'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                >
                    <Wand2 size={16} />
                    <span>Soạn mới bằng AI (Prompt)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveMode('pdf')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-black uppercase transition-all ${
                        activeMode === 'pdf'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`}
                >
                    <FileUp size={16} />
                    <span>Trích xuất từ PDF</span>
                </button>
            </div>

            {/* CHẾ ĐỘ 1: TẠO TỪ NGÂN HÀNG THEO MA TRẬN */}
            {activeMode === 'matrix' && (
                <MatrixQuizGenerator
                    grade={grade}
                    setGrade={setGrade}
                    chapters={chapters}
                    bankQuestions={bankQuestions}
                    isBankLoading={isBankLoading}
                    onLoadBank={onLoadBank}
                    hasQuestionsInEditor={hasQuestionsInEditor}
                    onGenerateSuccess={(createdQuestions, quizTitle, targetType, durationMinutes, chosenAction) => {
                        if (onGenerateFromMatrix) {
                            onGenerateFromMatrix(createdQuestions, quizTitle, targetType, durationMinutes, chosenAction || editorAction);
                        }
                    }}
                />
            )}

            {/* CHẾ ĐỘ 2 & 3: SOẠN BẰNG PROMPT AI HOẶC FILE PDF */}
            {(activeMode === 'prompt' || activeMode === 'pdf') && (
                <div className="bg-white p-10 rounded-[3rem] border shadow-xs text-center space-y-10">
                    <div className="space-y-3">
                        <div className={`p-4 w-16 h-16 mx-auto rounded-3xl text-white shadow-lg flex items-center justify-center ${
                            activeMode === 'prompt' ? 'bg-blue-600' : 'bg-emerald-600'
                        }`}>
                            {activeMode === 'prompt' ? <Sparkles size={32}/> : <FileUp size={32}/>}
                        </div>
                        <h3 className="text-2xl font-black uppercase text-slate-800 tracking-tight">
                            {activeMode === 'prompt' ? 'Soạn đề mới bằng Prompt AI' : 'Bóc tách & Tạo đề từ tệp PDF'}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 max-w-lg mx-auto">
                            {activeMode === 'prompt' 
                                ? 'Nhập chủ đề kiến thức, AI sẽ tự động sinh câu hỏi mới chất lượng cao chuẩn GDPT 2018.'
                                : 'Tải lên tài liệu PDF (đề thi, tài liệu ôn tập), AI sẽ tự động bóc tách và phân loại mức độ.'
                            }
                        </p>
                        {hasQuestionsInEditor && target === 'editor' && (
                            <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-50/90 border border-amber-200 p-2.5 px-4 rounded-2xl w-fit mx-auto mt-2 shadow-2xs">
                                <span className="text-[11px] font-bold text-amber-900">
                                    Editor đang có câu hỏi sẵn:
                                </span>
                                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setEditorAction('replace')}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                            editorAction === 'replace'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Tạo đề mới (Làm trống đề cũ)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditorAction('append')}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                                            editorAction === 'append'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-500 hover:text-slate-900'
                                        }`}
                                    >
                                        Chèn thêm vào đề hiện có
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {errorMsg && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-bold text-left animate-shake">
                            <AlertTriangle className="shrink-0" />
                            <p>{errorMsg}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">1. Khối lớp & Đích đến</label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <select className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none text-xs" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                                        <option value="12">Khối 12</option>
                                        <option value="11">Khối 11</option>
                                        <option value="10">Khối 10</option>
                                    </select>
                                    <div className="flex bg-slate-100 p-1 rounded-2xl border-2 border-slate-100">
                                        <button onClick={() => setTarget('editor')} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${target === 'editor' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-400'}`}>
                                            <LayoutTemplate size={14}/> Editor
                                        </button>
                                        <button onClick={() => setTarget('bank')} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${target === 'bank' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-400'}`}>
                                            <Database size={14}/> Bank
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">2. Ma trận kiến thức (%)</label>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-emerald-600 uppercase">Nhận biết</label>
                                        <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-xs" value={matrix.easy} onChange={e => setMatrix({...matrix, easy: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-blue-600 uppercase">Thông hiểu</label>
                                        <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-xs" value={matrix.medium} onChange={e => setMatrix({...matrix, medium: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-orange-600 uppercase">Vận dụng</label>
                                        <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-xs" value={matrix.hard} onChange={e => setMatrix({...matrix, hard: parseInt(e.target.value) || 0})} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[8px] font-black text-red-600 uppercase">Vận dụng cao</label>
                                        <input type="number" className="w-full bg-white border border-slate-200 p-3 rounded-xl font-bold text-xs" value={matrix.vhard} onChange={e => setMatrix({...matrix, vhard: parseInt(e.target.value) || 0})} />
                                    </div>
                                </div>
                                <p className="text-[8px] text-slate-400 italic px-2">Lưu ý: Tổng các phần trăm nên là 100% để đề thi cân đối.</p>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">3. Cấu trúc đề (Số câu)</label>
                                <div className="flex gap-4 bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                                    <div className="flex-1 text-center border-r border-slate-100">
                                        <label className="text-[8px] font-black uppercase text-blue-500">P.I (TN)</label>
                                        <input type="number" className="w-full text-center bg-transparent font-black text-lg outline-none" value={p1} onChange={e => setP1(parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex-1 text-center border-r border-slate-100">
                                        <label className="text-[8px] font-black uppercase text-purple-500">P.II (D/S)</label>
                                        <input type="number" className="w-full text-center bg-transparent font-black text-lg outline-none" value={p2} onChange={e => setP2(parseInt(e.target.value))} />
                                    </div>
                                    <div className="flex-1 text-center">
                                        <label className="text-[8px] font-black uppercase text-orange-500">P.III (NGẮN)</label>
                                        <input type="number" className="w-full text-center bg-transparent font-black text-lg outline-none" value={p3} onChange={e => setP3(parseInt(e.target.value))} />
                                    </div>
                                </div>
                            </div>

                            {activeMode === 'pdf' ? (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">4. Tải lên tệp PDF</label>
                                    <div className={`relative border-2 border-dashed rounded-[2rem] p-6 transition-all ${pdfFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 hover:border-emerald-400'}`}>
                                        <input type="file" accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
                                        <div className="flex flex-col items-center gap-2">
                                            <FileUp className={pdfFile ? 'text-emerald-600' : 'text-slate-300'} size={32}/>
                                            <p className="text-[10px] font-black uppercase text-slate-600">
                                                {pdfFile ? pdfFile.name : 'Nhấn hoặc kéo PDF vào đây'}
                                            </p>
                                            {pdfFile && <button onClick={(e) => { e.preventDefault(); setPdfFile(null); setPdfBase64(null); }} className="text-[8px] font-black text-red-500 uppercase mt-1">Xóa file</button>}
                                        </div>
                                    </div>
                                    <p className="text-[8px] text-slate-400 italic px-2">AI sẽ bóc tách các câu hỏi trong PDF theo đúng tỉ lệ ma trận trên.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">4. Chế độ AI</label>
                                    <div className="p-6 bg-blue-50/50 rounded-[2rem] border-2 border-blue-100 flex items-center gap-3">
                                        <Sparkles className="text-blue-600 shrink-0" size={24} />
                                        <div className="text-xs text-blue-900 font-bold">
                                            AI Gemini 3 Flash được tối ưu hóa riêng cho Vật lý THPT, sinh công thức LaTeX và lời giải chuẩn.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-left space-y-1">
                        <label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">
                            {activeMode === 'pdf' ? 'Ghi chú thêm cho AI khi xử lý PDF' : 'Chủ đề & Ghi chú câu hỏi'}
                        </label>
                        <textarea 
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-8 font-bold min-h-[120px] text-sm outline-none focus:border-blue-400 transition-all focus:bg-white" 
                            value={prompt} 
                            onChange={e => setPrompt(e.target.value)} 
                            placeholder={activeMode === 'pdf' ? "Ví dụ: Chỉ lấy các câu hỏi chương 1 và chương 2 trong file..." : "Ví dụ: Đạo hàm và các bài toán cực trị trong dao động điều hòa..."}
                        />
                    </div>

                    <button 
                        onClick={handleGenerate} 
                        disabled={isLoading || (activeMode === 'prompt' && !prompt) || (activeMode === 'pdf' && !pdfFile)} 
                        className={`w-full py-6 rounded-[2.5rem] font-black shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 transition-all active:scale-[0.98] ${
                            target === 'bank' ? 'bg-purple-600 hover:bg-black' : 
                            activeMode === 'pdf' ? 'bg-emerald-600 hover:bg-black' : 'bg-blue-600 hover:bg-black'
                        } text-white text-sm uppercase tracking-widest`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={28}/> : <Sparkles size={28}/>} 
                        {isLoading ? 'Hệ thống đang xử lý...' : (
                            target === 'bank' ? 'Soạn & Lưu vào ngân hàng' : 
                            (hasQuestionsInEditor && editorAction === 'append' ? 'Soạn & Chèn thêm vào đề' : 'Bắt đầu tạo đề mới với AI')
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
