
import React, { useState } from 'react';
import { Grade } from '../../types';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';

interface AIRendererProps {
    grade: Grade;
    setGrade: (val: Grade) => void;
    onGenerate: (prompt: string, p1: number, p2: number, p3: number) => Promise<void>;
    isLoading: boolean;
}

const AIRenderer: React.FC<AIRendererProps> = ({ grade, setGrade, onGenerate, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const [p1, setP1] = useState(5);
    const [p2, setP2] = useState(2);
    const [p3, setP3] = useState(2);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <div className="bg-white p-10 rounded-[3rem] border shadow-sm text-center space-y-10">
                <Sparkles size={64} className="mx-auto text-blue-600 drop-shadow-lg"/>
                <h3 className="text-2xl font-black uppercase text-slate-800">Soạn đề bằng AI (Gemini)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase ml-2 text-slate-400">Khối lớp</label>
                        <select className="w-full bg-slate-50 border rounded-2xl p-4 font-black outline-none" value={grade} onChange={e => setGrade(e.target.value as Grade)}><option value="12">Khối 12</option><option value="11">Khối 11</option><option value="10">Khối 10</option></select>
                    </div>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.I (TN)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p1} onChange={e => setP1(parseInt(e.target.value))} /></div>
                        <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.II (D/S)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p2} onChange={e => setP2(parseInt(e.target.value))} /></div>
                        <div className="flex-1"><label className="text-[8px] font-black uppercase ml-1">P.III (NGẮN)</label><input type="number" className="w-full bg-slate-50 border p-4 rounded-2xl font-bold" value={p3} onChange={e => setP3(parseInt(e.target.value))} /></div>
                    </div>
                </div>
                <textarea className="w-full bg-slate-50 border rounded-[2.5rem] p-8 font-bold min-h-[200px] text-sm outline-none focus:border-blue-400" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ví dụ: Đạo hàm và các bài toán cực trị, dùng LaTeX $...$ cho công thức..." />
                <button onClick={() => onGenerate(prompt, p1, p2, p3)} disabled={isLoading || !prompt} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black shadow-2xl hover:bg-blue-700 flex items-center justify-center gap-3 disabled:opacity-50">
                    {isLoading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24}/>} {isLoading ? 'AI ĐANG SOẠN...' : 'BẮT ĐẦU SOẠN ĐỀ THÔNG MINH'}
                </button>
            </div>
        </div>
    );
};

export default AIRenderer;

