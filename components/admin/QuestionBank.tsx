
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

const PAGE_SIZE = 40;

const QuestionBank: React.FC<QuestionBankProps> = ({ 
    questions, bGradeFilter, setBGradeFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple 
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Chuẩn hóa dữ liệu trước khi lọc để tránh lỗi chuỗi (như 'group_tf' vs 'group-tf')
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            // Lấy khối
            const qGradeRaw = (q.quizGrade || 'all').toString().trim();
            const matchGrade = bGradeFilter === 'all' || qGradeRaw === bGradeFilter;
            
            // Lấy dạng câu hỏi và chuẩn hóa các trường hợp AI gõ nhầm dấu gạch dưới (_)
            let qTypeRaw = (q.type || 'mcq').toString().trim().toLowerCase().replace('_', '-');
            const targetType = bTypeFilter.toString().trim().toLowerCase().replace('_', '-');
            
            const matchType = bTypeFilter === 'all' || qTypeRaw === targetType;
            
            // Tìm kiếm văn bản
            const matchSearch = !bSearch || q.text.toLowerCase().includes(bSearch.toLowerCase());
            
            return matchGrade && matchType && matchSearch;
        });
    }, [questions, bGradeFilter, bTypeFilter, bSearch]);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [bGradeFilter, bTypeFilter, bSearch]);

    const toggleSelect = (id: string) => {
        const newIds = new Set(selectedIds);
        if (newIds.has(id)) newIds.delete(id);
        else newIds.add(id);
        setSelectedIds(newIds);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredQuestions.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredQuestions.map(q => q.id)));
    };

    const handleAddSelected = () => {
        const selectedQuestions = filteredQuestions
            .filter(q => selectedIds.has(q.id))
            .map(q => ({ ...q, id: uuidv4() }));
        if (selectedQuestions.length === 0) return alert("Vui lòng chọn ít nhất một câu hỏi!");
        onAddMultiple(selectedQuestions);
        setSelectedIds(new Set());
    };

    const visibleQuestions = useMemo(() => filteredQuestions.slice(0, visibleCount), [filteredQuestions, visibleCount]);

    return (
        <div className="space-y-4 animate-fade-in w-full max-w-full">
            {/* Slim Header - Bộ lọc siêu gọn */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-30 flex flex-col md:flex-row gap-2">
                <div className="flex gap-2 shrink-0">
                    <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none" value={bGradeFilter} onChange={e => setBGradeFilter(e.target.value as any)}>
                        <option value="all">Khối: Tất cả</option>
                        <option value="12">Khối 12</option>
                        <option value="11">Khối 11</option>
                        <option value="10">Khối 10</option>
                    </select>
                    <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none" value={bTypeFilter} onChange={e => setBTypeFilter(e.target.value as any)}>
                        <option value="all">Dạng: Tất cả</option>
                        <option value="mcq">P.I (MCQ)</option>
                        <option value="group-tf">P.II (D/S)</option>
                        <option value="short">P.III (Ngắn)</option>
                    </select>
                </div>
                <div className="flex-1 flex items-center bg-slate-50 border rounded-lg px-3">
                    <Search size={14} className="text-slate-300"/>
                    <input className="bg-transparent p-1.5 text-[11px] font-medium outline-none w-full" placeholder="Tìm kiếm nội dung..." value={bSearch} onChange={e => setBSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 shrink-0 px-2">
                    <button onClick={handleSelectAll} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400 hover:text-blue-600">
                        {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? <CheckSquare size={14}/> : <Square size={14}/>}
                        Chọn {filteredQuestions.length} câu
                    </button>
                    <button onClick={handleAddSelected} disabled={selectedIds.size === 0} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${selectedIds.size > 0 ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                        + Thêm {selectedIds.size} câu
                    </button>
                </div>
            </div>

            {/* Danh sách câu hỏi - Cực kỳ thoáng */}
            <div className="grid grid-cols-1 gap-2">
                {visibleQuestions.map((bq, idx) => {
                    const isSelected = selectedIds.has(bq.id);
                    return (
                        <div key={bq.id || idx} onClick={() => toggleSelect(bq.id)} className={`bg-white p-3 rounded-xl border flex items-start gap-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-slate-100 hover:border-blue-200'}`}>
                            <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-200'}`}><CheckCircle2 size={20}/></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded text-white ${bq.type === 'mcq' ? 'bg-blue-500' : bq.type === 'group-tf' ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                        {bq.type.toUpperCase()}
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">Khối {bq.quizGrade || 'all'}</span>
                                </div>
                                <div className="text-slate-800 text-sm font-medium leading-relaxed overflow-x-auto"><LatexText text={bq.text}/></div>
                                {bq.type === 'mcq' && bq.options && (
                                    <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2 opacity-60">
                                        {bq.options.map((opt, i) => (
                                            <div key={i} className="text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate">
                                                <span className="text-blue-600 font-bold mr-1">{String.fromCharCode(65+i)}.</span> <LatexText text={opt}/>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {visibleCount < filteredQuestions.length && (
                    <div className="py-4 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + PAGE_SIZE); }} className="px-8 py-2 bg-white border rounded-full text-[9px] font-black uppercase text-slate-500 shadow-sm hover:bg-slate-900 hover:text-white transition-all">Tải thêm câu hỏi</button>
                    </div>
                )}
                {filteredQuestions.length === 0 && (
                    <div className="py-10 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
                        <p className="font-black text-slate-300 uppercase text-[9px]">Dữ liệu trống (Vui lòng kiểm tra lại bộ lọc)</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionBank;
