
import React from 'react';
import { Quiz, Result, Grade, Chapter } from '../../types';
import { Edit, Trash2, Eye, Users, Filter, FileText } from 'lucide-react';

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

const QuizList: React.FC<QuizListProps> = ({ 
    quizzes, results, chapters, onEdit, onDelete, onPreview, 
    qSearch, setQSearch, qGradeFilter, setQGradeFilter,
    qChapterFilter, setQChapterFilter
}) => {
    const filtered = quizzes.filter(q => 
        (qGradeFilter === 'all' || q.grade === qGradeFilter) && 
        (qChapterFilter === 'all' || q.category === qChapterFilter) &&
        q.title.toLowerCase().includes(qSearch.toLowerCase())
    );

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.map(q => {
                    const quizResults = results.filter(r => r.quizId === q.id);
                    const attempts = quizResults.length;
                    
                    return (
                        <div 
                            key={q.id} 
                            className={`rounded-[2.5rem] p-8 border transition-all flex flex-col group relative overflow-hidden border-b-4 ${q.isPublished 
                                ? 'bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 border-b-blue-600 border-slate-100 opacity-100' 
                                : 'bg-slate-100 border-dashed border-slate-300 opacity-60 grayscale-[0.2]'}`}
                        >
                            {!q.isPublished && (
                                <div className="absolute top-2 right-4 bg-slate-500 text-white text-[7px] font-black px-2 py-0.5 rounded-full z-10 tracking-widest uppercase">
                                    Bản nháp
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-6">
                                <div className="flex flex-col gap-1">
                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest w-fit ${q.isPublished ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        LỚP {q.grade}
                                    </span>
                                    {q.category && <span className={`text-[8px] font-bold uppercase px-2 ${q.isPublished ? 'text-blue-500' : 'text-slate-400'}`}>{q.category}</span>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => onEdit(q)} className="p-2.5 bg-white border rounded-xl hover:bg-slate-900 hover:text-white shadow-sm transition-colors" title="Sửa đề"><Edit size={16}/></button>
                                    <button onClick={() => onDelete(q.id)} className="p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white shadow-sm transition-colors" title="Xóa đề"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            
                            <h3 className={`font-black text-lg mb-6 line-clamp-2 min-h-[56px] leading-tight uppercase transition-colors ${q.isPublished ? 'text-slate-800' : 'text-slate-500'}`}>
                                {q.title}
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className={`${q.isPublished ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-200/50 border-slate-200'} rounded-2xl p-3 flex flex-col items-center justify-center border`}>
                                    <FileText size={14} className={q.isPublished ? "text-blue-500" : "text-slate-400"}/>
                                    <span className={`text-[10px] font-black ${q.isPublished ? 'text-blue-700' : 'text-slate-500'}`}>{q.questions.length} câu hỏi</span>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 flex flex-col items-center justify-center border border-slate-100">
                                    <Users size={14} className="text-slate-400"/>
                                    <span className="text-[10px] font-black text-slate-700">{attempts} lượt làm</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-slate-100">
                                <button 
                                    onClick={() => onPreview(q)} 
                                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm ${q.isPublished 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'bg-slate-800 text-white hover:bg-black'}`}
                                >
                                    <Eye size={16}/> Xem & Xuất Word
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default QuizList;
