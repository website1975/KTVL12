
import React, { useState, useEffect } from 'react';
import { Quiz, User, Result } from '../types';
import { saveResult, addPointsToUser } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { Clock, Send, XCircle } from 'lucide-react';
import LatexText from './LatexText';

interface QuizTakerProps {
    quiz: Quiz;
    student: User;
    onExit: () => void;
}

// Fix: Fully implement QuizTaker to resolve all "Cannot find name" errors and export as default module
const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, student, onExit }) => {
    const [spent, setSpent] = useState(0);
    const [currentAnswers, setCurrentAnswers] = useState<Record<string, any>>({});

    useEffect(() => {
        const timer = setInterval(() => setSpent(s => s + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSubmit = async () => {
        if (!confirm('Bạn có chắc chắn muốn nộp bài?')) return;
        
        let score = 0;
        quiz.questions.forEach(q => {
            const ans = currentAnswers[q.id];
            if (q.type === 'mcq') {
                if (ans === q.correctAnswer) score += Number(q.points);
            } else if (q.type === 'short') {
                if (String(ans || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) score += Number(q.points);
            } else if (q.type === 'group-tf' && q.subQuestions) {
                let subCorrect = 0;
                q.subQuestions.forEach((sq, i) => {
                    if (ans?.[i] === sq.correctAnswer) subCorrect++;
                });
                // Scoring for group-tf (example: proportional)
                if (subCorrect === 4) score += Number(q.points);
                else if (subCorrect === 3) score += Number(q.points) * 0.6;
                else if (subCorrect === 2) score += Number(q.points) * 0.25;
            }
        });

        const earned = score;

        const result: Result = {
            id: uuidv4(),
            quizId: quiz.id,
            studentId: student.id,
            studentName: student.fullName,
            studentCode: student.studentCode || 'N/A',
            score: score,
            totalQuestions: quiz.questions?.length || 0,
            submittedAt: new Date().toISOString(),
            durationSeconds: spent,
            pointsAwarded: earned,
            userAnswers: currentAnswers 
        };

        try {
            await saveResult(result);
            await addPointsToUser(student.id, earned, student.studentCode);
            alert(`Hoàn thành! Bạn đạt ${score.toFixed(2)} điểm.`);
            onExit();
        } catch (error) {
            console.error("Submission error:", error);
            alert("Có lỗi khi lưu kết quả!");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
            <header className="max-w-4xl w-full mx-auto flex justify-between items-center bg-white p-6 rounded-3xl border shadow-sm sticky top-6 z-50 mb-10">
                <div>
                    <h1 className="font-black text-slate-800 uppercase tracking-tight">{quiz.title}</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Thí sinh: {student.fullName} ({student.studentCode})</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-blue-600 font-black">
                        <Clock size={20}/>
                        <span className="tabular-nums">
                            {Math.floor(spent / 60)}:{(spent % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                    <button onClick={onExit} className="text-slate-300 hover:text-red-500 transition-colors"><XCircle size={24}/></button>
                </div>
            </header>

            <div className="max-w-4xl w-full mx-auto space-y-8 pb-32">
                {quiz.questions.map((q, idx) => (
                    <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:border-blue-100">
                        <div className="flex items-start gap-4 mb-6">
                            <span className="text-blue-600 font-black italic underline uppercase shrink-0">Câu {idx + 1}.</span>
                            <div className="text-slate-800 text-lg font-bold"><LatexText text={q.text}/></div>
                        </div>

                        {q.imageUrl && <div className="mb-6 flex justify-center"><img src={q.imageUrl} className="max-h-64 rounded-xl border border-slate-100 shadow-inner" alt="question-visual" /></div>}

                        {q.type === 'mcq' && q.options && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-10">
                                {q.options.map((opt, oi) => (
                                    <button 
                                        key={oi} 
                                        onClick={() => setCurrentAnswers({ ...currentAnswers, [q.id]: opt })}
                                        className={`p-4 rounded-2xl border text-left text-sm font-bold transition-all ${currentAnswers[q.id] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`}
                                    >
                                        <span className="mr-3 opacity-50">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/>
                                    </button>
                                ))}
                            </div>
                        )}

                        {q.type === 'group-tf' && q.subQuestions && (
                            <div className="space-y-4 pl-10">
                                {q.subQuestions.map((sq, si) => (
                                    <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <span className="text-xs font-black text-blue-600 w-6">{String.fromCharCode(97+si)})</span>
                                        <div className="flex-1 text-sm font-bold"><LatexText text={sq.text}/></div>
                                        <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                                            {['True', 'False'].map(v => (
                                                <button 
                                                    key={v} 
                                                    onClick={() => {
                                                        const qAns = currentAnswers[q.id] || {};
                                                        setCurrentAnswers({ ...currentAnswers, [q.id]: { ...qAns, [si]: v } });
                                                    }}
                                                    className={`px-4 py-1 text-[9px] font-black rounded-lg transition-all ${currentAnswers[q.id]?.[si] === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                                                >
                                                    {v === 'True' ? 'ĐÚNG' : 'SAI'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {q.type === 'short' && (
                            <div className="pl-10">
                                <input 
                                    type="text" 
                                    className="w-full md:w-80 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold focus:border-blue-500 focus:bg-white transition-all"
                                    placeholder="Nhập kết quả bài làm..."
                                    value={currentAnswers[q.id] || ''}
                                    onChange={e => setCurrentAnswers({ ...currentAnswers, [q.id]: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <footer className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md border-t flex justify-center z-[60]">
                <button 
                    onClick={handleSubmit}
                    className="flex items-center gap-3 px-20 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all"
                >
                    <Send size={20}/> Nộp bài thi ngay
                </button>
            </footer>
        </div>
    );
};

export default QuizTaker;
