import React, { useState, useRef } from 'react';
import { Question, QuestionType, Grade, Chapter, QuestionLevel } from '../../types';
import { X, Save, Edit3, Loader2, Image as ImageIcon, Upload, Link as LinkIcon, Clipboard, Trash2, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { uploadQuizImageWithResult } from '../../services/storage';

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
    const [storageMode, setStorageMode] = useState<'auto' | 'base64' | 'imgbb'>('auto');
    const [isUploadingImg, setIsUploadingImg] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleProcessImageFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            return alert("Vui lòng chọn hoặc dán đúng tệp hình ảnh!");
        }
        setIsUploadingImg(true);
        try {
            if (storageMode === 'base64') {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64Url = reader.result as string;
                    setForm(prev => ({ ...prev, imageUrl: base64Url }));
                    setIsUploadingImg(false);
                };
                reader.readAsDataURL(file);
            } else {
                const result = await uploadQuizImageWithResult(file, storageMode);
                if (result && result.url) {
                    setForm(prev => ({ ...prev, imageUrl: result.url }));
                } else {
                    alert("Lỗi tải ảnh lên máy chủ.");
                }
                setIsUploadingImg(false);
            }
        } catch (e: any) {
            alert("Lỗi khi xử lý ảnh: " + (e.message || "Không xác định"));
            setIsUploadingImg(false);
        }
    };

    const handlePasteClipboard = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const file = new File([blob], "pasted_image.png", { type });
                        handleProcessImageFile(file);
                        return;
                    }
                }
            }
            alert("Không tìm thấy hình ảnh trong khay nhớ tạm (Clipboard). Vui lòng chụp/chép vùng ảnh trước!");
        } catch (e) {
            alert("Vui lòng bấm tổ hợp phím Ctrl + V trực tiếp trên giao diện để dán ảnh.");
        }
    };

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

                    {/* ĐÍNH KÈM HÌNH ẢNH MINH HỌA (3 CHẾ ĐỘ LƯU TRỮ) */}
                    <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2">
                            <label className="text-[10px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                                <ImageIcon size={14} className="text-blue-600" />
                                <span>Đính kèm hình ảnh minh họa câu hỏi</span>
                            </label>

                            {/* Nút Chọn Chế độ Lưu Trữ Linh Hoạt */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                <span className="text-[9px] font-extrabold uppercase text-slate-400 px-1">Lưu:</span>
                                <button
                                    type="button"
                                    onClick={() => setStorageMode('auto')}
                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                        storageMode === 'auto' 
                                            ? 'bg-blue-600 text-white shadow-xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Lưu vào Cloud Database (Store) - An toàn, ổn định"
                                >
                                    ⚡ Store
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStorageMode('base64')}
                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                        storageMode === 'base64' 
                                            ? 'bg-amber-500 text-white shadow-xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Nhúng sBase64 vĩnh viễn trong dữ liệu - 100% không bao giờ mất link!"
                                >
                                    🚀 sBase64
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStorageMode('imgbb')}
                                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                                        storageMode === 'imgbb' 
                                            ? 'bg-purple-600 text-white shadow-xs' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Lưu trữ ngoại vi lên ImgBB"
                                >
                                    🌐 ImgBB
                                </button>
                            </div>
                        </div>

                        {/* Buttons Row: Dán ảnh / Tải ảnh lên / Dán link */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePasteClipboard}
                                disabled={isUploadingImg}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                title="Dán nhanh hình chụp Snipping Tool từ bộ nhớ tạm"
                            >
                                <Clipboard size={14} />
                                <span>DÁN ẢNH (CTRL + V)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploadingImg}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {isUploadingImg ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                <span>{isUploadingImg ? 'Đang tải...' : 'TẢI ẢNH LÊN'}</span>
                            </button>
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleProcessImageFile(f);
                                    e.target.value = '';
                                }}
                            />

                            <div className="flex-1 min-w-[200px] flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                                <LinkIcon size={12} className="text-slate-400 mr-1.5 shrink-0" />
                                <input 
                                    type="text"
                                    className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400"
                                    value={form.imageUrl || ''}
                                    onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                    placeholder="Hoặc dán URL link ảnh..."
                                />
                                {form.imageUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                                        className="p-1 text-slate-400 hover:text-red-500 rounded-md"
                                        title="Xóa link ảnh"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Image Preview Card */}
                        {form.imageUrl && (
                            <div className="relative mt-2 p-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-3">
                                <img 
                                    src={form.imageUrl} 
                                    alt="Minh họa câu hỏi" 
                                    className="max-h-24 max-w-[160px] rounded-lg object-contain bg-white border border-slate-700" 
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                                        <Check size={12} /> Đã gán hình ảnh cho câu hỏi
                                    </span>
                                    <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                                        {form.imageUrl.startsWith('data:image') ? '[Dữ liệu ảnh sBase64 mã hóa]' : form.imageUrl}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                                    className="px-2.5 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-[10px] font-black uppercase transition-all"
                                >
                                    XÓA ẢNH
                                </button>
                            </div>
                        )}
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
