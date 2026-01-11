
import React from 'react';
import { Quiz, Result, Grade } from '../../types';
import { Edit, Trash2, Eye, Check, X } from 'lucide-react';

interface QuizListProps {
    quizzes: Quiz[];
    results: Result[];
    onEdit: (quiz: Quiz) => void;
    onDelete: (id: string) => void;
    onPreview: (quiz: Quiz) => void;
    qSearch: string;
    setQSearch: (val: string) => void;
    qGradeFilter: Grade | 'all';
    setQGradeFilter: (val: Grade | 'all') => void;
}

const QuizList: React.FC<QuizListProps> = ({ quizzes, results, onEdit, onDelete, onPreview, qSearch, setQSearch, qGradeFilter, setQGradeFilter }) => {
    const filtered = quizzes.filter(q => 
        (qGradeFilter === 'all' || q.grade === qGradeFilter) && 
        q.title.toLowerCase().includes(qSearch.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-6 rounded-[2rem] border shadow-sm">
                <input 
                    className="flex-1 w-full p-3 bg-slate-50 border rounded-2xl outline-none text-xs font-bold" 
                    placeholder="Tìm tên đề..." 
                    value={qSearch} 
                    onChange={e => setQSearch(e.target.value)} 
                />
                <select 
                    className="px-4 py-3 bg-white border rounded-xl text-[10px] font-black uppercase outline-none" 
                    value={qGradeFilter} 
                    onChange={e => setQGradeFilter(e.target.value as any)}
                >
                    <option value="all">TẤT CẢ KHỐI</option>
                    <option value="12">KHỐI 12</option>
                    <option value="11">KHỐI 11</option>
                    <option value="10">KHỐI 10</option>
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.map(q => {
                    const attempts = results.filter(r => r.quizId === q.id).length;
                    return (
                        <div key={q.id} className="bg-white rounded-[2.5rem] p-8 border shadow-sm flex flex-col group transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-6">
                                <span className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-500 tracking-widest">LỚP {q.grade}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => onEdit(q)} className="p-2.5 bg-white border rounded-xl hover:bg-slate-900 hover:text-white"><Edit size={16}/></button>
                                    <button onClick={() => onDelete(q.id)} className="p-2.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-4 line-clamp-2 min-h-[56px] leading-tight uppercase">{q.title}</h3>
                            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{attempts} lượt làm</span>
                                <button onClick={() => onPreview(q)} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline">
                                    <Eye size={14}/> Xem đề
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
