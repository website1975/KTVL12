
import React, { useState, useMemo } from 'react';
import { Question, QuestionType, Grade } from '../../types';
import { Database, Search, CheckCircle2, PlusCircle, Trash2, CheckSquare, Square } from 'lucide-react';
import LatexText from '../LatexText';
import { v4 as uuidv4 } from 'uuid';

interface QuestionBankProps {
    questions: Question[];
    bGradeFilter: Grade | 'all';
    setBGradeFilter: (val: Grade | 'all') => void;
    bTypeFilter: QuestionType | 'all';
    setBTypeFilter: (val: QuestionType | 'all') => void;
    bSearch: string;
    setBSearch: (val: string) => void;
    onAddMultiple: (qs: Question[]) => void;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ 
    questions, bGradeFilter, setBGradeFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple 
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        const newIds = new Set(selectedIds);
        if (newIds.has(id)) newIds.delete(id);
        else newIds.add(id);
        setSelectedIds(newIds);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === questions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(questions.map(q => q.id)));
        }
    };

    const handleAddSelected = () => {
        const selectedQuestions = questions
            .filter(q => selectedIds.has(q.id))
            .map(q => ({ ...q, id: uuidv4() })); // Tạo ID mới để tránh trùng lặp trong đề
        
        if (selectedQuestions.length === 0) return alert("Vui lòng chọn ít nhất một câu hỏi!");
        onAddMultiple(selectedQuestions);
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Bộ lọc & Thanh công cụ chọn nhanh */}
            <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm sticky top-0 z-30 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <select 
                        className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" 
                        value={bGradeFilter} 
                        onChange={e => setBGradeFilter(e.target.value as any)}
                    >
                        <option value="all">TẤT CẢ KHỐI</option>
                        <option value="12">KHỐI 12</option>
                        <option value="11">KHỐI 11</option>
                        <option value="10">KHỐI 10</option>
                    </select>
                    <select 
                        className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" 
                        value={bTypeFilter} 
                        onChange={e => setBTypeFilter(e.target.value as any)}
                    >
                        <option value="all">TẤT CẢ DẠNG</option>
                        <option value="mcq">TRẮC NGHIỆM (P.I)</option>
                        <option value="group-tf">ĐÚNG/SAI (P.II)</option>
                        <option value="short">TRẢ LỜI NGẮN (P.III)</option>
                    </select>
                    <div className="flex-1 flex items-center bg-slate-50 border rounded-xl px-3 group focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <Search size={16} className="text-slate-300"/>
                        <input 
                            className="bg-transparent p-3 text-xs font-bold outline-none w-full" 
                            placeholder="Tìm nội dung câu hỏi trong ngân hàng..." 
                            value={bSearch} 
                            onChange={e => setBSearch(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Thanh trạng thái chọn */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors"
                        >
                            {selectedIds.size === questions.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                            {selectedIds.size === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                        <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                            Đã chọn: {selectedIds.size} câu
                        </span>
                    </div>
                    <button 
                        onClick={handleAddSelected}
                        disabled={selectedIds.size === 0}
                        className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg ${selectedIds.size > 0 ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                        <PlusCircle size={16}/> Thêm {selectedIds.size} câu vào đề
                    </button>
                </div>
            </div>

            {/* Danh sách câu hỏi */}
            <div className="grid grid-cols-1 gap-4">
                {questions.map((bq, idx) => {
                    const isSelected = selectedIds.has(bq.id);
                    return (
                        <div 
                            key={bq.id || idx} 
                            onClick={() => toggleSelect(bq.id)}
                            className={`bg-white p-6 rounded-[2rem] border-2 shadow-sm flex items-start gap-5 group cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/20' : 'hover:border-slate-300 border-transparent'}`}
                        >
                            <div className={`mt-1 shrink-0 transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-200 group-hover:text-slate-400'}`}>
                                {isSelected ? <CheckCircle2 size={24}/> : <PlusCircle size={24}/>}
                            </div>
                            
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`text-[8px] font-black px-2 py-1 rounded-md text-white uppercase tracking-widest ${bq.type === 'mcq' ? 'bg-blue-500' : bq.type === 'group-tf' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                        {bq.type === 'mcq' ? 'Phần I' : bq.type === 'group-tf' ? 'Phần II' : 'Phần III'}
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">
                                        Nguồn: <span className="text-slate-600">{bq.quizTitle || 'Tự do'}</span> | Khối: {bq.quizGrade || 'all'}
                                    </span>
                                </div>
                                <div className="text-slate-800 text-sm font-bold leading-relaxed">
                                    <LatexText text={bq.text}/>
                                </div>
                                
                                {bq.type === 'mcq' && bq.options && (
                                    <div className="mt-4 grid grid-cols-2 gap-2 opacity-60">
                                        {bq.options.map((opt, i) => (
                                            <div key={i} className="text-[10px] font-medium truncate bg-white/50 px-2 py-1 rounded">
                                                {String.fromCharCode(65+i)}. {opt}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="hidden lg:block">
                                <span className="text-[9px] font-black text-blue-600/30 uppercase italic">Click để chọn</span>
                            </div>
                        </div>
                    );
                })}

                {questions.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <Database size={48} className="mx-auto text-slate-200 mb-4"/>
                        <p className="font-black text-slate-300 uppercase tracking-widest text-xs">Không tìm thấy câu hỏi nào phù hợp</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;
