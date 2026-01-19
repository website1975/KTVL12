
import React from 'react';
import { Question, QuestionType, Grade } from '../../types';
import { Database, Search } from 'lucide-react';
import LatexText from '../LatexText';

interface QuestionBankProps {
    questions: Question[];
    bGradeFilter: Grade | 'all';
    setBGradeFilter: (val: Grade | 'all') => void;
    bTypeFilter: QuestionType | 'all';
    setBTypeFilter: (val: QuestionType | 'all') => void;
    bSearch: string;
    setBSearch: (val: string) => void;
    onCopy: (q: Question) => void;
}

const QuestionBank: React.FC<QuestionBankProps> = ({ questions, bGradeFilter, setBGradeFilter, bTypeFilter, setBTypeFilter, bSearch, setBSearch, onCopy }) => {
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row gap-4">
                <select className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase" value={bGradeFilter} onChange={e => setBGradeFilter(e.target.value as any)}><option value="all">TẤT CẢ KHỐI</option><option value="12">KHỐI 12</option><option value="11">KHỐI 11</option><option value="10">KHỐI 10</option></select>
                <select className="bg-slate-50 border p-3 rounded-xl text-[10px] font-black uppercase" value={bTypeFilter} onChange={e => setBTypeFilter(e.target.value as any)}><option value="all">TẤT CẢ DẠNG</option><option value="mcq">TRẮC NGHIỆM</option><option value="group-tf">ĐÚNG/SAI</option><option value="short">TRẢ LỜI NGẮN</option></select>
                <div className="flex-1 flex items-center bg-slate-50 border rounded-xl px-3"><Search size={16} className="text-slate-300"/><input className="bg-transparent p-3 text-xs font-bold outline-none w-full" placeholder="Tìm câu hỏi..." value={bSearch} onChange={e => setBSearch(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4">
                {questions.map((bq, idx) => (
                    <div key={bq.id || idx} className="bg-white p-6 rounded-3xl border shadow-sm flex items-center justify-between group hover:border-blue-300">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded text-white uppercase ${bq.type === 'mcq' ? 'bg-blue-500' : bq.type === 'group-tf' ? 'bg-purple-500' : 'bg-orange-500'}`}>{bq.type}</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">Nguồn: {bq.quizTitle || 'Không xác định'} ({bq.quizGrade || 'all'})</span>
                            </div>
                            <div className="font-bold text-slate-800"><LatexText text={bq.text}/></div>
                        </div>
                        <button onClick={() => onCopy(bq)} className="p-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all">Sao chép</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default QuestionBank;
