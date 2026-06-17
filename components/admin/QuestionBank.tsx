
import React, { useState, useMemo, useEffect } from 'react';
import { Question, QuestionType, Grade, Chapter } from '../../types';
import { Database, Search, CheckCircle2, CheckSquare, Square, X, BookOpen } from 'lucide-react';
import LatexText from '../LatexText';
import { v4 as uuidv4 } from 'uuid';

interface QuestionBankProps {
    questions: Question[];
    chapters: Chapter[];
    bGradeFilter: Grade | 'all';
    setBGradeFilter: (val: Grade | 'all') => void;
    bChapterFilter: string;
    setBChapterFilter: (val: string) => void;
    bTypeFilter: QuestionType | 'all';
    setBTypeFilter: (val: QuestionType | 'all') => void;
    bSearch: string;
    setBSearch: (val: string) => void;
    onAddMultiple: (qs: Question[]) => void;
}

const PAGE_SIZE = 40;

export default function QuestionBank({ 
    questions, chapters, bGradeFilter, setBGradeFilter, bChapterFilter, setBChapterFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onAddMultiple 
}: QuestionBankProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            // Lọc khối - Bình thường hóa chuỗi
            const qGradeRaw = (q.quizGrade || 'all').toString().trim();
            const matchGrade = bGradeFilter === 'all' || qGradeRaw === bGradeFilter;

            // Lọc chương
            const qChapter = (q.quizCategory || '').toString().trim().toLowerCase();
            const filterVal = bChapterFilter.trim().toLowerCase();
            const matchChapter = bChapterFilter === 'all' || qChapter === filterVal;
            
            // Lọc dạng - Quan trọng: Xử lý cả 'group_tf' và 'group-tf'
            let qTypeRaw = (q.type || 'mcq').toString().trim().toLowerCase().replace('_', '-');
            const targetType = bTypeFilter.toString().trim().toLowerCase().replace('_', '-');
            
            const matchType = bTypeFilter === 'all' || qTypeRaw === targetType;
            
            // Tìm kiếm
            const matchSearch = !bSearch || 
                              q.text.toLowerCase().includes(bSearch.toLowerCase()) ||
                              (q.quizTitle && q.quizTitle.toLowerCase().includes(bSearch.toLowerCase()));
            
            return matchGrade && matchChapter && matchType && matchSearch;
        });
    }, [questions, bGradeFilter, bChapterFilter, bTypeFilter, bSearch]);

    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [bGradeFilter, bChapterFilter, bTypeFilter, bSearch]);

    const toggleSelect = (id: string) => {
        const newIds = new Set(selectedIds);
        if (newIds.has(id)) newIds.delete(id);
        else newIds.add(id);
        setSelectedIds(newIds);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0) setSelectedIds(new Set());
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
        <div className="space-y-4 animate-fade-in w-full max-w-full pb-10">
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-30 flex flex-col md:flex-row gap-2">
                <div className="flex flex-wrap gap-2 shrink-0">
                    <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none" value={bGradeFilter} onChange={e => { setBGradeFilter(e.target.value as any); setBChapterFilter('all'); }}>
                        <option value="all">Khối: Tất cả</option>
                        <option value="12">Khối 12</option>
                        <option value="11">Khối 11</option>
                        <option value="10">Khối 10</option>
                    </select>
                    <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none max-w-[150px]" value={bChapterFilter} onChange={e => setBChapterFilter(e.target.value)}>
                        <option value="all">Chương: Tất cả</option>
                        {chapters.filter(c => bGradeFilter === 'all' || String(c.grade) === String(bGradeFilter)).map(c => (
                            <option key={c.id} value={c.name}>{c.name || (c as any).title || "Chương chưa đặt tên"}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => { setBGradeFilter('all'); setBChapterFilter('all'); setBTypeFilter('all'); setBSearch(''); }}
                        className="bg-red-50 text-red-500 border border-red-100 px-2 rounded-lg text-[8px] font-black uppercase"
                    >
                        Xóa lọc
                    </button>
                    <select className="bg-slate-50 border px-3 py-1.5 rounded-lg text-[9px] font-black uppercase outline-none" value={bTypeFilter} onChange={e => setBTypeFilter(e.target.value as any)}>
                        <option value="all">Dạng: Tất cả</option>
                        <option value="mcq">P.I (MCQ)</option>
                        <option value="group-tf">P.II (D/S)</option>
                        <option value="short">P.III (Ngắn)</option>
                    </select>
                </div>
                <div className="flex-1 flex items-center bg-slate-50 border rounded-lg px-3">
                    <Search size={14} className="text-slate-300"/>
                    <input className="bg-transparent p-1.5 text-[11px] font-medium outline-none w-full" placeholder="Tìm câu hỏi hoặc tên đề thi..." value={bSearch} onChange={e => setBSearch(e.target.value)} />
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

            <div className="grid grid-cols-1 gap-2">
                {visibleQuestions.map((bq, idx) => {
                    const isSelected = selectedIds.has(bq.id);
                    return (
                        <div key={bq.id || idx} onClick={() => toggleSelect(bq.id)} className={`bg-white p-4 rounded-2xl border flex items-start gap-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-slate-100 hover:border-blue-200'}`}>
                            <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-200'}`}><CheckCircle2 size={24}/></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white ${bq.type === 'mcq' ? 'bg-blue-500' : bq.type.includes('tf') ? 'bg-purple-500' : 'bg-orange-500'}`}>
                                        {bq.type.toUpperCase()}
                                    </span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">Khối {bq.quizGrade || 'all'}</span>
                                    {bq.quizCategory && <span className="text-[8px] text-purple-400 font-bold uppercase bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{bq.quizCategory}</span>}
                                    {bq.quizTitle && (
                                        <span className="flex items-center gap-1 text-[8px] text-blue-400 font-black uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                            <BookOpen size={10}/> {bq.quizTitle}
                                        </span>
                                    )}
                                </div>
                                <div className="text-slate-800 text-sm font-bold leading-relaxed overflow-x-auto"><LatexText text={bq.text}/></div>
                            </div>
                        </div>
                    );
                })}

                {visibleQuestions.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                        <X className="mx-auto text-slate-200" size={48}/>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Không tìm thấy câu hỏi nào</p>
                    </div>
                )}

                {visibleCount < filteredQuestions.length && (
                    <div className="py-6 text-center">
                        <button onClick={(e) => { e.stopPropagation(); setVisibleCount(prev => prev + PAGE_SIZE); }} className="px-10 py-3 bg-white border-2 border-slate-100 rounded-full text-[10px] font-black uppercase text-slate-500 shadow-sm hover:bg-slate-900 hover:text-white transition-all">Tải thêm câu hỏi</button>
                    </div>
                )}
            </div>
        </div>
    );
}
