
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

const PAGE_SIZE = 30;

const QuestionBank: React.FC<QuestionBankProps> = ({ 
    questions, bGradeFilter, setBGradeFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple 
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Xử lý lọc dữ liệu tại đây để đảm bảo logic chạy đúng
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            const matchGrade = bGradeFilter === 'all' || q.quizGrade === bGradeFilter;
            const matchType = bTypeFilter === 'all' || q.type === bTypeFilter;
            const matchSearch = !bSearch || q.text.toLowerCase().includes(bSearch.toLowerCase());
            return matchGrade && matchType && matchSearch;
        });
    }, [questions, bGradeFilter, bTypeFilter, bSearch]);

    // Reset phân trang khi thay đổi bộ lọc
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
        if (selectedIds.size === filteredQuestions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
        }
    };

    const handleAddSelected = () => {
        const selectedQuestions = filteredQuestions
            .filter(q => selectedIds.has(q.id))
            .map(q => ({ ...q, id: uuidv4() }));
        
        if (selectedQuestions.length === 0) return alert("Vui lòng chọn ít nhất một câu hỏi!");
        onAddMultiple(selectedQuestions);
        setSelectedIds(new Set());
    };

    const visibleQuestions = useMemo(() => {
        return filteredQuestions.slice(0, visibleCount);
    }, [filteredQuestions, visibleCount]);

    return (
        <div className="space-y-4 animate-fade-in pb-10 w-full">
            {/* Thanh công cụ thu nhỏ - Bác sẽ duyệt đề sướng hơn */}
            <div className="bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-md sticky top-0 z-30 space-y-3">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="flex gap-2 shrink-0">
                        <select 
                            className="bg-slate-50 border px-3 py-2 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" 
                            value={bGradeFilter} 
                            onChange={e => setBGradeFilter(e.target.value as any)}
                        >
                            <option value="all">Tất cả Khối</option>
                            <option value="12">Khối 12</option>
                            <option value="11">Khối 11</option>
                            <option value="10">Khối 10</option>
                        </select>
                        <select 
                            className="bg-slate-50 border px-3 py-2 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-1 focus:ring-blue-500" 
                            value={bTypeFilter} 
                            onChange={e => setBTypeFilter(e.target.value as any)}
                        >
                            <option value="all">Tất cả Dạng</option>
                            <option value="mcq">P.I (MCQ)</option>
                            <option value="group-tf">P.II (D/S)</option>
                            <option value="short">P.III (Ngắn)</option>
                        </select>
                    </div>
                    <div className="flex-1 flex items-center bg-slate-50 border rounded-xl px-3 group transition-all">
                        <Search size={14} className="text-slate-300"/>
                        <input 
                            className="bg-transparent p-2 text-[11px] font-bold outline-none w-full" 
                            placeholder="Tìm nội dung câu hỏi..." 
                            value={bSearch} 
                            onChange={e => setBSearch(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
                        >
                            {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                            Chọn tất cả ({filteredQuestions.length})
                        </button>
                        <span className="text-[9px] font-black uppercase text-blue-600">
                            Đã chọn: {selectedIds.size}
                        </span>
                    </div>
                    <button 
                        onClick={handleAddSelected}
                        disabled={selectedIds.size === 0}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${selectedIds.size > 0 ? 'bg-blue-600 text-white hover:bg-black shadow-lg shadow-blue-200' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                        <PlusCircle size={16}/> Nạp vào đề
                    </button>
                </div>
            </div>

            {/* Danh sách - Thu nhỏ lề, mở rộng ruột */}
            <div className="flex flex-col gap-2">
                {visibleQuestions.map((bq, idx) => {
                    const isSelected = selectedIds.has(bq.id);
                    return (
                        <div 
                            key={bq.id || idx} 
                            onClick={() => toggleSelect(bq.id)}
                            className={`bg-white p-4 rounded-xl border transition-all flex items-start gap-4 cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-slate-100 hover:border-blue-200 hover:shadow-sm'}`}
                        >
                            <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-200'}`}>
                                <CheckCircle2 size={24}/>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white uppercase ${bq.type === 'mcq' ? 'bg-blue-500' : bq.type === 'group-tf' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                        {bq.type === 'mcq' ? 'P.I' : bq.type === 'group-tf' ? 'P.II' : 'P.III'}
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">
                                        Khối: {bq.quizGrade} | {bq.quizTitle?.slice(0, 30)}...
                                    </span>
                                </div>
                                <div className="text-slate-800 text-sm font-medium leading-relaxed">
                                    <LatexText text={bq.text}/>
                                </div>
                                
                                {bq.type === 'mcq' && bq.options && (
                                    <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2 opacity-70">
                                        {bq.options.map((opt, i) => (
                                            <div key={i} className="text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">
                                                <span className="text-blue-600 font-bold mr-1">{String.fromCharCode(65+i)}.</span>
                                                <LatexText text={opt}/>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {visibleCount < filteredQuestions.length && (
                    <div className="py-6 text-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + PAGE_SIZE); }}
                            className="inline-flex items-center gap-2 px-10 py-3 bg-white border rounded-full text-[10px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                        >
                            <ChevronDown size={16}/> Tải thêm ({filteredQuestions.length - visibleCount})
                        </button>
                    </div>
                )}

                {filteredQuestions.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                        <p className="font-black text-slate-300 uppercase text-[10px]">Không có dữ liệu phù hợp bộ lọc</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;
