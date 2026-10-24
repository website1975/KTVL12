import React, { useState } from 'react';
import { Question, QuestionType, Grade, Chapter, QuestionLevel } from '../../types';
import { X, Save, Edit3, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface BankQuestionModalProps {
    isOpen: boolean;
    question: Question | null;
    chapters: Chapter[];
    grade: Grade;
    onClose: () => void;
    onSave: (q: Question) => Promise<void> | void;
}

export default function BankQuestionModal({ isOpen, question, chapters, grade, onClose, onSave }: BankQuestionModalProps) {
    const [form, setForm] = useState<Question>(question ? { ...question } : {
        id: uuidv4(),
        type: 'mcq',
        text: '',
        points: 0.25,
        options: ['', '', '', ''],
        correctAnswer: 'A',
        solution: '',
        level: 'B',
        quizGrade: grade || '12',
        chapterName: chapters[0]?.name || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.text.trim()) {
            return alert("Vui lòng nhập nội dung câu hỏi!");
        }
        setIsSaving(true);
        try {
            await onSave({
                ...form,
                id: form.id || uuidv4(),
                points: form.type === 'group-tf' ? 1.0 : 0.25
            });
            onClose();
        } catch (e: any) {
            alert("Lỗi khi lưu câu hỏi: " + (e.message || e));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
            <div className="bg-white max-w-3xl w-full rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
                <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center border-b border-white/10">
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                        <Edit3 size={16} className="text-blue-500" />
                        <span>{question ? 'Hiệu chỉnh câu hỏi trong Ngân hàng' : 'Thêm câu hỏi mới vào Ngân hàng'}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50 custom-scrollbar">
                    {/* Hàng 1: Loại câu & Khối & Mức độ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Dạng câu hỏi</label>
                            <select 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                                value={form.type}
                                onChange={e => {
                                    const t = e.target.value as QuestionType;
                                    setForm(prev => ({
                                        ...prev,
                                        type: t,
                                        points: t === 'group-tf' ? 1.0 : 0.25,
                                        options: t === 'mcq' ? ['', '', '', ''] : undefined,
                                        subQuestions: t === 'group-tf' ? [
                                            { id: uuidv4(), text: '', correctAnswer: 'True' },
                                            { id: uuidv4(), text: '', correctAnswer: 'False' },
                                            { id: uuidv4(), text: '', correctAnswer: 'True' },
                                            { id: uuidv4(), text: '', correctAnswer: 'False' }
                                        ] : undefined
                                    }));
                                }}
                            >
                                <option value="mcq">Phần I: Trắc nghiệm 4 lựa chọn</option>
                                <option value="group-tf">Phần II: Đúng / Sai</option>
                                <option value="short">Phần III: Trả lời ngắn</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Khối lớp</label>
                            <select 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                                value={form.quizGrade || grade}
                                onChange={e => setForm(prev => ({ ...prev, quizGrade: e.target.value as Grade }))}
                            >
                                <option value="12">Khối 12</option>
                                <option value="11">Khối 11</option>
                                <option value="10">Khối 10</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500">Mức độ nhận thức</label>
                            <select 
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                                value={form.level || 'B'}
                                onChange={e => setForm(prev => ({ ...prev, level: e.target.value as QuestionLevel }))}
                            >
                                <option value="B">Nhận biết (B)</option>
                                <option value="H">Thông hiểu (H)</option>
                                <option value="VD">Vận dụng (VD)</option>
                                <option value="VDC">Vận dụng cao (VDC)</option>
                            </select>
                        </div>
                    </div>

                    {/* Hàng 2: Chương kiến thức */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Chương kiến thức</label>
                        <select 
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                            value={form.chapterName || ''}
                            onChange={e => setForm(prev => ({ ...prev, chapterName: e.target.value }))}
                        >
                            <option value="">-- Chọn chương kiến thức --</option>
                            {chapters.map(ch => (
                                <option key={ch.id} value={ch.name}>{ch.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Lời dẫn (Context) nếu có */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Lời dẫn chung / Bối cảnh thí nghiệm (Tùy chọn)</label>
                        <textarea 
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 min-h-[60px]"
                            value={form.context || ''}
                            onChange={e => setForm(prev => ({ ...prev, context: e.target.value }))}
                            placeholder="Nhập bối cảnh chung, đoạn văn đọc hiểu hoặc thí nghiệm..."
                        />
                    </div>

                    {/* Nội dung câu hỏi */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Nội dung câu hỏi (Hỗ trợ LaTeX $...$)</label>
                        <textarea 
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 min-h-[100px]"
                            value={form.text}
                            onChange={e => setForm(prev => ({ ...prev, text: e.target.value }))}
                            placeholder="Nhập nội dung câu hỏi, ví dụ: Tính gia tốc trọng trường $g$..."
                        />
                    </div>

                    {/* Hình ảnh minh họa URL */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Link hình ảnh minh họa (URL tùy chọn)</label>
                        <input 
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                            value={form.imageUrl || ''}
                            onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                            placeholder="https://example.com/image.png"
                        />
                    </div>

                    {/* Tùy chỉnh theo loại câu */}
                    {form.type === 'mcq' && (
                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                            <label className="text-[10px] font-black uppercase text-blue-600 block">4 phương án A, B, C, D</label>
                            {form.options?.map((opt, optIdx) => {
                                const letter = String.fromCharCode(65 + optIdx);
                                const isCorrect = form.correctAnswer === letter || form.correctAnswer === opt;
                                return (
                                    <div key={optIdx} className="flex items-center gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setForm(prev => ({ ...prev, correctAnswer: letter }))}
                                            className={`w-8 h-8 rounded-xl font-black text-xs shrink-0 flex items-center justify-center transition-all ${
                                                isCorrect ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                            title="Nhấn để chọn là đáp án đúng"
                                        >
                                            {letter}
                                        </button>
                                        <input 
                                            type="text"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:bg-white focus:border-blue-500"
                                            value={opt}
                                            onChange={e => {
                                                const newOpts = [...(form.options || ['', '', '', ''])];
                                                newOpts[optIdx] = e.target.value;
                                                setForm(prev => ({ ...prev, options: newOpts }));
                                            }}
                                            placeholder={`Nội dung phương án ${letter}...`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {form.type === 'group-tf' && (
                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                            <label className="text-[10px] font-black uppercase text-purple-600 block">4 ý Đúng / Sai (a, b, c, d)</label>
                            {form.subQuestions?.map((sq, sqIdx) => {
                                const label = String.fromCharCode(97 + sqIdx);
                                const isTrue = sq.correctAnswer === 'True';
                                return (
                                    <div key={sq.id || sqIdx} className="flex items-center gap-2">
                                        <span className="font-black text-xs text-slate-600 w-6 shrink-0">{label})</span>
                                        <input 
                                            type="text"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:bg-white focus:border-blue-500"
                                            value={sq.text}
                                            onChange={e => {
                                                const newSub = [...(form.subQuestions || [])];
                                                newSub[sqIdx] = { ...newSub[sqIdx], text: e.target.value };
                                                setForm(prev => ({ ...prev, subQuestions: newSub }));
                                            }}
                                            placeholder={`Nội dung ý ${label}...`}
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const newSub = [...(form.subQuestions || [])];
                                                newSub[sqIdx] = { ...newSub[sqIdx], correctAnswer: isTrue ? 'False' : 'True' };
                                                setForm(prev => ({ ...prev, subQuestions: newSub }));
                                            }}
                                            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase shrink-0 transition-all ${
                                                isTrue ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                                            }`}
                                        >
                                            {isTrue ? 'Đúng' : 'Sai'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {form.type === 'short' && (
                        <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-200">
                            <label className="text-[10px] font-black uppercase text-amber-600 block">Đáp án trả lời ngắn</label>
                            <input 
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:bg-white focus:border-blue-500"
                                value={form.correctAnswer || ''}
                                onChange={e => setForm(prev => ({ ...prev, correctAnswer: e.target.value }))}
                                placeholder="Ví dụ: 12.5 hoặc -4..."
                            />
                        </div>
                    )}

                    {/* Lời giải chi tiết */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500">Lời giải chi tiết</label>
                        <textarea 
                            className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none focus:border-blue-500 min-h-[100px]"
                            value={form.solution || ''}
                            onChange={e => setForm(prev => ({ ...prev, solution: e.target.value }))}
                            placeholder="Nhập lời giải chi tiết sư phạm..."
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-[10px] font-black uppercase transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        <span>Lưu vào Ngân hàng</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
