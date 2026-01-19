
import React, { useState } from 'react';
import { Grade } from '../../types';
import { Sparkles, Database, LayoutTemplate, Loader2, AlertTriangle, PlusCircle } from 'lucide-react';

interface AIRendererProps {
    grade: Grade;
    setGrade: (val: Grade) => void;
    onGenerate: (prompt: string, p1: number, p2: number, p3: number, target: 'editor' | 'bank') => Promise<void>;
    isLoading: boolean;
    hasQuestionsInEditor?: boolean;
}

const AIRenderer: React.FC<AIRendererProps> = ({ grade, setGrade, onGenerate, isLoading, hasQuestionsInEditor }) => {
    const [prompt, setPrompt] = useState('');
    const [p1, setP1] = useState(5);
    const [p2, setP2] = useState(2);
    const [p3, setP3] = useState(2);
    const [target, setTarget] = useState<'editor' | 'bank'>('editor');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleGenerate = async () => {
        setErrorMsg(null);
        try {
            await onGenerate(prompt, p1, p2, p3, target);
        } catch (err: any) {
            setErrorMsg(err.message || "Đã xảy ra lỗi không xác định.");
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm text-center space-y-10">
                <Sparkles size={64} className="mx-auto text-blue-600 drop-shadow-lg"/>
                <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase text-slate-800">Soạn đề bằng AI (Gemini)</h3>
                    {hasQuestionsInEditor && target === 'editor' && (
                        <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 w-fit mx-auto px-4 py-1.5 rounded-full border border-emerald-100">
                            <PlusCircle size={14}/>
                            <span className="text-[10px] font-black uppercase tracking-wider">Đang ở chế độ chèn thêm vào đề hiện có</span>
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
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase ml-2 text-slate-400">1. Khối lớp</label>
                            <select className="w-full bg-slate-50 border rounded-2xl p-4 font-black outline-none mt-1" value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                                <option value="12">Khối 12</option>
                                <option value="11">Khối 11</option>
                                <option value="10">Khối 10</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase ml-2 text-slate-400">2. Đích đến</label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <button 
                                    onClick={() => setTarget('editor')}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${target === 'editor' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}
                                >
                                    <LayoutTemplate size={20}/>
                                    <span className="text-[9px] font-black uppercase">Mở Editor</span>
                                </button>
                                <button 
                                    onClick={() => setTarget('bank')}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${target === 'bank' ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}
                                >
                                    <Database size={20}/>
                                    <span className="text-[9px] font-black uppercase">Lưu Ngân hàng</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase ml-2 text-slate-400">3. Số lượng câu</label>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.I (TN)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p1} onChange={e => setP1(parseInt(e.target.value))} /></div>
                            <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.II (D/S)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p2} onChange={e => setP2(parseInt(e.target.value))} /></div>
                            <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.III (NGẮN)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p3} onChange={e => setP3(parseInt(e.target.value))} /></div>
                        </div>
                        <p className="text-[9px] text-slate-400 italic px-2 leading-tight">Mẹo: Soạn dưới 10 câu mỗi lần để đạt hiệu suất AI tốt nhất.</p>
                    </div>
                </div>

                <div className="text-left space-y-1">
                    <label className="text-[10px] font-black uppercase ml-2 text-slate-400">4. Nội dung yêu cầu</label>
                    <textarea 
                        className="w-full bg-slate-50 border rounded-[2.5rem] p-8 font-bold min-h-[150px] text-sm outline-none focus:border-blue-400" 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                        placeholder="Ví dụ: Đạo hàm và các bài toán cực trị, dùng LaTeX $...$ cho công thức..." 
                    />
                </div>

                <button 
                    onClick={handleGenerate} 
                    disabled={isLoading || !prompt} 
                    className={`w-full py-6 rounded-[2rem] font-black shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all ${target === 'bank' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                >
                    {isLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>} 
                    {isLoading ? 'HỆ THỐNG ĐANG SOẠN...' : (
                        target === 'bank' ? 'SOẠN & LƯU VÀO NGÂN HÀNG' : 
                        (hasQuestionsInEditor ? 'SOẠN & CHÈN TIẾP VÀO ĐỀ' : 'BẮT ĐẦU SOẠN ĐỀ THÔNG MINH')
                    )}
                </button>
            </div>
        </div>
    );
};

export default AIRenderer;
