
import React from 'react';
import { X, CheckCircle2, XCircle, HelpCircle, Info } from 'lucide-react';
import { Result, Quiz, Question } from '../../types';
import LatexText from '../LatexText';

interface ResultDetailModalProps {
    isOpen: boolean;
    result: Result | null;
    quiz: Quiz | null;
    onClose: () => void;
}

const ResultDetailModal: React.FC<ResultDetailModalProps> = ({ isOpen, result, quiz, onClose }) => {
    if (!isOpen || !result || !quiz) return null;

    const userAnswers = result.userAnswers || {};

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[1200] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
            <div className="bg-white rounded-[3.5rem] w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                <div className="p-8 bg-emerald-600 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner"><CheckCircle2 size={28}/></div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight">Chi tiết bài làm: {result.studentName}</h3>
                            <p className="text-[10px] font-bold text-emerald-100 uppercase mt-1">Đề thi: {quiz.title} • Đạt {result.score.toFixed(2)} điểm</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-emerald-700 rounded-2xl hover:bg-red-600 transition-colors"><X/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-slate-50">
                    <div className="max-w-3xl mx-auto space-y-10">
                        {quiz.questions.map((q, idx) => {
                            const ans = userAnswers[q.id];
                            let isCorrect = false;

                            if (q.type === 'mcq') isCorrect = ans === q.correctAnswer;
                            else if (q.type === 'short') isCorrect = String(ans || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                            else if (q.type === 'group-tf' && q.subQuestions) {
                                // Logic check nôm na cho Group-TF: Đúng hết mới được tính là đúng câu đó (hiển thị)
                                const subResults = q.subQuestions.map((sq, i) => ans?.[i] === sq.correctAnswer);
                                isCorrect = subResults.every(r => r === true);
                            }

                            return (
                                <div key={q.id} className={`bg-white p-10 rounded-[2.5rem] border-2 shadow-sm relative ${isCorrect ? 'border-emerald-100' : 'border-red-100'}`}>
                                    <div className="absolute top-8 right-8">
                                        {isCorrect ? <CheckCircle2 className="text-emerald-500" size={32}/> : <XCircle className="text-red-500" size={32}/>}
                                    </div>

                                    <div className="flex items-start gap-4 mb-8">
                                        <span className={`text-xs font-black px-4 py-1.5 rounded-xl uppercase shrink-0 ${isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>Câu {idx + 1}</span>
                                        <div className="text-slate-800 text-lg font-bold leading-relaxed pt-1 pr-12"><LatexText text={q.text}/></div>
                                    </div>

                                    {q.imageUrl && <div className="mb-8 flex justify-center"><img src={q.imageUrl} className="max-h-64 rounded-2xl border" alt="visual" /></div>}

                                    {q.type === 'mcq' && q.options && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-10">
                                            {q.options.map((opt, oi) => {
                                                const label = String.fromCharCode(65 + oi);
                                                const isUserChoice = ans === opt;
                                                const isRightAns = q.correctAnswer === opt;
                                                
                                                let stateClasses = "bg-slate-50 border-slate-100 text-slate-500";
                                                if (isRightAns) stateClasses = "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20";
                                                else if (isUserChoice && !isRightAns) stateClasses = "bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20";

                                                return (
                                                    <div key={oi} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${stateClasses}`}>
                                                        <span className="font-black text-xs opacity-50">{label}.</span>
                                                        <div className="font-bold text-sm"><LatexText text={opt}/></div>
                                                        {isUserChoice && <span className="ml-auto text-[8px] font-black uppercase bg-white/50 px-2 py-0.5 rounded-md">Bạn chọn</span>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'group-tf' && q.subQuestions && (
                                        <div className="space-y-4 pl-10">
                                            {q.subQuestions.map((sq, si) => {
                                                const userVal = ans?.[si];
                                                const isSubCorrect = userVal === sq.correctAnswer;
                                                return (
                                                    <div key={si} className={`flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-2xl border-2 ${isSubCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                                                        <span className="text-xs font-black text-slate-400 w-6">{String.fromCharCode(97+si)})</span>
                                                        <div className="flex-1 text-sm font-bold"><LatexText text={sq.text}/></div>
                                                        <div className="flex gap-2 text-[9px] font-black">
                                                            <div className={`px-4 py-2 rounded-xl border-2 ${userVal === 'True' ? (sq.correctAnswer === 'True' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-red-500 text-white border-red-600') : (sq.correctAnswer === 'True' ? 'bg-white text-emerald-600 border-emerald-100' : 'bg-white text-slate-300 border-slate-100 opacity-40')}`}>ĐÚNG</div>
                                                            <div className={`px-4 py-2 rounded-xl border-2 ${userVal === 'False' ? (sq.correctAnswer === 'False' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-red-500 text-white border-red-600') : (sq.correctAnswer === 'False' ? 'bg-white text-emerald-600 border-emerald-100' : 'bg-white text-slate-300 border-slate-100 opacity-40')}`}>SAI</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {q.type === 'short' && (
                                        <div className="pl-10 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Học sinh trả lời:</span>
                                                <span className={`px-6 py-3 rounded-xl border-2 font-black ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                                    {ans || '(Trống)'}
                                                </span>
                                            </div>
                                            {!isCorrect && (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-emerald-600 uppercase">Đáp án đúng:</span>
                                                    <span className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black shadow-lg">
                                                        {q.correctAnswer}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {q.solution && (
                                        <div className="mt-10 pt-8 border-t border-dashed border-slate-100 bg-blue-50/30 -mx-10 -mb-10 p-10 rounded-b-[2.5rem]">
                                            <div className="flex items-center gap-2 mb-4 text-blue-600">
                                                <Info size={18}/>
                                                <h5 className="text-[10px] font-black uppercase tracking-widest">Lời giải chi tiết</h5>
                                            </div>
                                            <div className="text-slate-600 text-sm italic leading-relaxed"><LatexText text={q.solution}/></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultDetailModal;
