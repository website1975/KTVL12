
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionType, Grade } from '../../types';
import { Database, Search, CheckCircle2, PlusCircle, Trash2, CheckSquare, Square, ChevronDown } from 'lucide-react';
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

const PAGE_SIZE = 20;

const QuestionBank: React.FC<QuestionBankProps> = ({ 
    questions, bGradeFilter, setBGradeFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple 
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Reset phân trang mỗi khi người dùng thay đổi bộ lọc hoặc tìm kiếm
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [bGradeFilter, bTypeFilter, bSearch]);

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

    // Chỉ lấy số lượng câu hỏi cần hiển thị
    const visibleQuestions = useMemo(() => {
        return questions.slice(0, visibleCount);
    }, [questions, visibleCount]);

    return (
        <div className="space-y-6 animate-fade-in pb-20 w-full">
            {/* Header Bộ lọc & Thanh công cụ chọn nhanh - Luôn dính ở trên để dễ lọc */}
            <div className="bg-white p-6 rounded-[2rem] border-4 border-slate-100 shadow-xl sticky top-0 z-30 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex gap-2 shrink-0">
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
                    </div>
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
                    <div className="flex items-center gap-6">
                        <button 
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors"
                        >
                            {selectedIds.size === questions.length ? <CheckSquare size={18}/> : <Square size={18}/>}
                            {selectedIds.size === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả trong danh sách'}
                        </button>
                        <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100">
                            Số lượng đã chọn: {selectedIds.size} câu
                        </span>
                    </div>
                    <button 
                        onClick={handleAddSelected}
                        disabled={selectedIds.size === 0}
                        className={`flex items-center gap-3 px-10 py-4 rounded-2xl text-[11px] font-black uppercase transition-all shadow-xl ${selectedIds.size > 0 ? 'bg-blue-600 text-white hover:bg-black hover:scale-105 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                        <PlusCircle size={20}/> Nạp {selectedIds.size} câu vào đề
                    </button>
                </div>
            </div>

            {/* Danh sách câu hỏi - Tận dụng tối đa chiều ngang */}
            <div className="flex flex-col gap-4">
                {visibleQuestions.map((bq, idx) => {
                    const isSelected = selectedIds.has(bq.id);
                    return (
                        <div 
                            key={bq.id || idx} 
                            onClick={() => toggleSelect(bq.id)}
                            className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm flex items-start gap-8 group cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/20 ring-4 ring-blue-500/10' : 'hover:border-slate-300 border-transparent hover:shadow-lg'}`}
                        >
                            <div className={`mt-1 shrink-0 transition-all ${isSelected ? 'text-blue-600 scale-125' : 'text-slate-200 group-hover:text-blue-200 group-hover:scale-110'}`}>
                                {isSelected ? <CheckCircle2 size={32}/> : <PlusCircle size={32}/>}
                            </div>
                            
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg text-white uppercase tracking-widest ${bq.type === 'mcq' ? 'bg-blue-600' : bq.type === 'group-tf' ? 'bg-purple-600' : 'bg-orange-600'}`}>
                                        {bq.type === 'mcq' ? 'PHẦN I' : bq.type === 'group-tf' ? 'PHẦN II' : 'PHẦN III'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                                        Nguồn: <span className="text-slate-900 font-black">{bq.quizTitle || 'Tự do'}</span> | Khối: <span className="text-slate-900 font-black">{bq.quizGrade || 'Chung'}</span>
                                    </span>
                                </div>
                                <div className="text-slate-800 text-lg font-bold leading-relaxed max-w-full overflow-x-auto">
                                    <LatexText text={bq.text}/>
                                </div>
                                
                                {bq.type === 'mcq' && bq.options && (
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 opacity-80">
                                        {bq.options.map((opt, i) => (
                                            <div key={i} className="text-[11px] font-bold bg-slate-50/50 px-4 py-2 rounded-xl border border-slate-100 truncate">
                                                <span className="text-blue-600 mr-2">{String.fromCharCode(65+i)}.</span>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {bq.type === 'group-tf' && bq.subQuestions && (
                                    <div className="mt-4 space-y-2 opacity-60">
                                        {bq.subQuestions.map((sq, i) => (
                                            <div key={i} className="text-[10px] font-medium flex gap-2">
                                                <span className="text-purple-600">{String.fromCharCode(97+i)})</span>
                                                <span className="truncate">{sq.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="hidden lg:flex shrink-0 h-full items-center">
                                <div className={`text-[10px] font-black uppercase tracking-tighter px-4 py-2 rounded-full border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-300 border-slate-100 group-hover:text-blue-400 group-hover:border-blue-100'}`}>
                                    {isSelected ? 'ĐÃ CHỌN' : 'BẤM CHỌN'}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Nút Xem thêm */}
                {visibleCount < questions.length && (
                    <div className="p-12 text-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + PAGE_SIZE); }}
                            className="inline-flex items-center gap-3 px-16 py-5 bg-white border-4 border-slate-100 rounded-full text-[12px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-2xl active:scale-95"
                        >
                            <ChevronDown size={20}/> Tải thêm 20 câu hỏi (Còn {questions.length - visibleCount} câu trong kho)
                        </button>
                    </div>
                )}

                {questions.length === 0 && (
                    <div className="py-40 text-center bg-white rounded-[3.5rem] border-4 border-dashed border-slate-100">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Database size={48} className="text-slate-200"/>
                        </div>
                        <p className="font-black text-slate-300 uppercase tracking-widest text-sm">Không tìm thấy câu hỏi nào phù hợp với bộ lọc</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;
