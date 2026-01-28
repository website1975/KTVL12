
import React, { useState, useEffect } from 'react';
import { Quiz, Result, Grade, Chapter } from '../../types';
import { Edit, Trash2, Eye, Users, Filter, FileText, ChevronDown } from 'lucide-react';

interface QuizListProps {
    quizzes: Quiz[];
    results: Result[];
    chapters: Chapter[];
    onEdit: (quiz: Quiz) => void;
    onDelete: (id: string) => void;
    onPreview: (quiz: Quiz) => void;
    qSearch: string;
    setQSearch: (val: string) => void;
    qGradeFilter: Grade | 'all';
    setQGradeFilter: (val: Grade | 'all') => void;
    qChapterFilter: string;
    setQChapterFilter: (val: string) => void;
}

const PAGE_SIZE = 12;

const QuizList: React.FC<QuizListProps> = ({ 
    quizzes, results, chapters, onEdit, onDelete, onPreview, 
    qSearch, setQSearch, qGradeFilter, setQGradeFilter,
    qChapterFilter, setQChapterFilter
}) => {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filtered = quizzes.filter(q => 
        (qGradeFilter === 'all' || q.grade === qGradeFilter) && 
        (qChapterFilter === 'all' || q.category === qChapterFilter) &&
        q.title.toLowerCase().includes(qSearch.toLowerCase())
    ).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [qSearch, qGradeFilter, qChapterFilter]);

    const visibleQuizzes = filtered.slice(0, visibleCount);
    const relevantChapters = chapters.filter(c => qGradeFilter === 'all' || c.grade === qGradeFilter);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-6 rounded-[2rem] border shadow-sm">
                <div className="flex-1 w-full relative">
                    <input 
                        className="w-full p-4 bg-slate-50 border rounded-2xl outline-none text-xs font-bold pl-10" 
                        placeholder="Tìm tên đề thi..." 
                        value={qSearch} 
                        onChange={e => setQSearch(e.target.value)} 
                    />
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14}/>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                    <select 
                        className="flex-1 lg:w-40 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                        value={qGradeFilter} 
                        onChange={e => { setQGradeFilter(e.target.value as any); setQChapterFilter('all'); }}
                    >
                        <option value="all">TẤT CẢ KHỐI</option>
                        <option value="12">KHỐI 12</option>
                        <option value="11">KHỐI 11</option>
                        <option value="10">KHỐI 10</option>
                    </select>
                    <select 
                        className="flex-1 lg:w-56 px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                        value={qChapterFilter} 
                        onChange={e => setQChapterFilter(e.target.value)}
                    >
                        <option value="all">TẤT CẢ CHƯƠNG</option>
                        {relevantChapters.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visibleQuizzes.map(q => {
                    // TỐI ƯU: Sử dụng các trường đếm đã được tính toán từ Server
                    const count = (q as any).questionCount || 0;
                    const attempts = (q as any).attemptCount || 0;
                    
                    return (
                        <div 
                            key={q.id} 
                            className={`rounded-[2.5rem] p-6 border transition-all flex flex-col group relative overflow-hidden border-b-4 ${q.isPublished 
                                ? 'bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 border-b-blue-600 border-slate-100' 
                                : 'bg-slate-50 border-dashed border-slate-300 opacity-75'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col gap-1">
                                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight w-fit ${q.isPublished ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        KHỐI {q.grade}
                                    </span>
                                    {q.category && <span className={`text-[8px] font-bold uppercase truncate max-w-[120px] ${q.isPublished ? 'text-blue-500' : 'text-slate-400'}`}>{q.category}</span>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => onEdit(q)} className="p-2 bg-white border rounded-lg hover:bg-slate-900 hover:text-white shadow-sm transition-colors" title="Sửa đề"><Edit size={14}/></button>
                                    <button onClick={() => onDelete(q.id)} className="p-2 bg-red-50 border border-red-100 rounded-lg hover:bg-red-500 hover:text-white shadow-sm transition-colors" title="Xóa đề"><Trash2 size={14}/></button>
                                </div>
                            </div>
                            
                            <h3 className={`font-black text-sm mb-4 line-clamp-2 min-h-[40px] leading-tight uppercase transition-colors ${q.isPublished ? 'text-slate-800' : 'text-slate-500'}`}>
                                {q.title}
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className={`${q.isPublished ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-200/50 border-slate-200'} rounded-xl p-2 flex flex-col items-center justify-center border`}>
                                    <FileText size={12} className={q.isPublished ? "text-blue-500" : "text-slate-400"}/>
                                    <span className={`text-[9px] font-black ${q.isPublished ? 'text-blue-700' : 'text-slate-500'}`}>{count} CÂU</span>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-2 flex flex-col items-center justify-center border border-slate-100">
                                    <Users size={12} className="text-slate-400"/>
                                    <span className="text-[9px] font-black text-slate-700">{attempts} LƯỢT</span>
                                </div>
                            </div>

                            <div className="mt-auto">
                                <button 
                                    onClick={() => onPreview(q)} 
                                    className={`w-full py-3 rounded-xl text-[9px] font-extrabold uppercase flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${q.isPublished 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'bg-slate-800 text-white hover:bg-black'}`}
                                >
                                    <Eye size={14}/> Xem & Xuất Word
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {visibleCount < filtered.length && (
                <div className="py-10 text-center">
                    <button 
                        onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                        className="inline-flex items-center gap-2 px-10 py-4 bg-white border-2 border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-xl"
                    >
                        <ChevronDown size={16}/> Tải thêm đề thi (Còn {filtered.length - visibleCount})
                    </button>
                </div>
            )}
            
            {filtered.length === 0 && (
                <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Không tìm thấy đề thi nào</div>
            )}
        </div>
    );
};

export default QuizList;
