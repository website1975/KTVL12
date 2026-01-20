
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quiz, User, Result, Question } from '../types';
import { saveResult, addPointsToUser } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { Clock, Send, XCircle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import LatexText from './LatexText';

interface QuizTakerProps {
    quiz: Quiz;
    student: User;
    onExit: () => void;
}

const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, student, onExit }) => {
    const [spent, setSpent] = useState(0);
    const [currentAnswers, setCurrentAnswers] = useState<Record<string, any>>({});
    const [violations, setViolations] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    
    // Sử dụng ref để handleSubmit có thể truy cập state mới nhất trong event listener
    const currentAnswersRef = useRef(currentAnswers);
    const spentRef = useRef(spent);
    const violationsRef = useRef(violations);

    useEffect(() => {
        currentAnswersRef.current = currentAnswers;
    }, [currentAnswers]);

    useEffect(() => {
        spentRef.current = spent;
    }, [spent]);

    useEffect(() => {
        violationsRef.current = violations;
    }, [violations]);

    // Sắp xếp câu hỏi theo thứ tự chuẩn: MCQ -> Group-TF -> Short
    const orderedQuestions = useMemo(() => {
        const parts = {
            mcq: quiz.questions.filter(q => q.type === 'mcq'),
            'group-tf': quiz.questions.filter(q => q.type === 'group-tf'),
            short: quiz.questions.filter(q => q.type === 'short')
        };
        return [...parts.mcq, ...parts['group-tf'], ...parts.short];
    }, [quiz.questions]);

    useEffect(() => {
        const timer = setInterval(() => setSpent(s => s + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Logic Giám sát thi (Chống chuyển tab)
    useEffect(() => {
        if (!quiz.isMonitored) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Khi rời khỏi tab
            } else {
                // Khi quay lại tab
                setViolations(v => {
                    const newVal = v + 1;
                    if (newVal >= 3) {
                        handleAutoSubmit();
                    } else {
                        setShowWarning(true);
                    }
                    return newVal;
                });
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleVisibilityChange);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleVisibilityChange);
        };
    }, [quiz.isMonitored]);

    const calculateScore = (answers: Record<string, any>) => {
        let score = 0;
        quiz.questions.forEach(q => {
            const ans = answers[q.id];
            if (q.type === 'mcq') {
                if (ans === q.correctAnswer) score += Number(q.points);
            } else if (q.type === 'short') {
                if (String(ans || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) score += Number(q.points);
            } else if (q.type === 'group-tf' && q.subQuestions) {
                let subCorrect = 0;
                q.subQuestions.forEach((sq, i) => {
                    if (ans?.[i] === sq.correctAnswer) subCorrect++;
                });
                if (subCorrect === 4) score += Number(q.points);
                else if (subCorrect === 3) score += Number(q.points) * 0.5;
                else if (subCorrect === 2) score += Number(q.points) * 0.25;
                else if (subCorrect === 1) score += Number(q.points) * 0.1;
            }
        });
        return score;
    };

    const handleAutoSubmit = async () => {
        alert("BẠN ĐÃ VI PHẠM QUY CHẾ THI QUÁ 3 LẦN (CHUYỂN TAB/RỜI TRÌNH DUYỆT). HỆ THỐNG SẼ TỰ ĐỘNG NỘP BÀI!");
        await finalizeSubmit(true);
    };

    const finalizeSubmit = async (isAuto = false) => {
        const finalAnswers = currentAnswersRef.current;
        const finalSpent = spentRef.current;
        const finalViolations = violationsRef.current;
        const score = calculateScore(finalAnswers);

        const result: Result = {
            id: uuidv4(),
            quizId: quiz.id,
            studentId: student.id,
            studentName: student.fullName,
            studentCode: student.studentCode || 'N/A',
            score: score,
            totalQuestions: quiz.questions.length,
            submittedAt: new Date().toISOString(),
            durationSeconds: finalSpent,
            pointsAwarded: score,
            userAnswers: finalAnswers,
            violationCount: finalViolations
        };

        try {
            await saveResult(result);
            await addPointsToUser(student.id, score);
            if (!isAuto) alert(`Hoàn thành! Bạn đạt ${score.toFixed(2)} điểm.`);
            onExit();
        } catch (error) {
            console.error("Submission error:", error);
            alert("Có lỗi khi lưu kết quả!");
        }
    };

    const handleSubmit = async () => {
        if (!confirm('Bạn có chắc chắn muốn nộp bài?')) return;
        await finalizeSubmit(false);
    };

    const renderQuestion = (q: Question, globalIdx: number) => (
        <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:border-blue-100">
            <div className="flex items-start gap-4 mb-6">
                <span className="text-blue-600 font-black italic underline uppercase shrink-0">Câu {globalIdx + 1}.</span>
                <div className="text-slate-800 text-lg font-bold leading-relaxed"><LatexText text={q.text}/></div>
            </div>

            {q.imageUrl && <div className="mb-6 flex justify-center"><img src={q.imageUrl} className="max-h-80 rounded-2xl border border-slate-100 shadow-sm" alt="question-visual" /></div>}

            {q.type === 'mcq' && q.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-10">
                    {q.options.map((opt, oi) => (
                        <button 
                            key={oi} 
                            onClick={() => setCurrentAnswers({ ...currentAnswers, [q.id]: opt })}
                            className={`p-5 rounded-2xl border-2 text-left text-sm font-bold transition-all flex items-center gap-3 ${currentAnswers[q.id] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-[1.02]' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'}`}
                        >
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${currentAnswers[q.id] === opt ? 'bg-white/20 border-white/40' : 'bg-white border-slate-200'}`}>
                                {String.fromCharCode(65+oi)}
                            </span>
                            <LatexText text={opt}/>
                        </button>
                    ))}
                </div>
            )}

            {q.type === 'group-tf' && q.subQuestions && (
                <div className="space-y-4 pl-0 md:pl-10">
                    {q.subQuestions.map((sq, si) => (
                        <div key={si} className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
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
                                        className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${currentAnswers[q.id]?.[si] === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
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
                <div className="pl-0 md:pl-10">
                    <div className="relative max-w-md">
                        <input 
                            type="text" 
                            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-blue-600 focus:border-blue-500 focus:bg-white transition-all pl-12"
                            placeholder="Nhập đáp số của bạn..."
                            value={currentAnswers[q.id] || ''}
                            onChange={e => setCurrentAnswers({ ...currentAnswers, [q.id]: e.target.value })}
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                            <CheckCircle2 size={20}/>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            {/* Overlay Cảnh báo */}
            {showWarning && (
                <div className="fixed inset-0 z-[2000] bg-red-600/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[3rem] p-12 max-w-lg text-center shadow-2xl space-y-6">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                            <ShieldAlert size={48}/>
                        </div>
                        <h2 className="text-2xl font-black uppercase text-red-600">CẢNH BÁO VI PHẠM!</h2>
                        <p className="font-bold text-slate-600 leading-relaxed">
                            Hệ thống ghi nhận bạn vừa chuyển tab hoặc rời khỏi cửa sổ làm bài. <br/>
                            <span className="text-red-600 underline">Số lần vi phạm: {violations}/3</span>
                        </p>
                        <p className="text-xs text-slate-400 italic">
                            Nếu vi phạm đủ 3 lần, bài làm của bạn sẽ bị hệ thống tự động nộp ngay lập tức.
                        </p>
                        <button 
                            onClick={() => setShowWarning(false)}
                            className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all"
                        >
                            TÔI ĐÃ HIỂU VÀ QUAY LẠI LÀM BÀI
                        </button>
                    </div>
                </div>
            )}

            <header className="max-w-5xl w-full mx-auto flex justify-between items-center bg-white/90 backdrop-blur-xl p-6 rounded-[2.5rem] border shadow-sm sticky top-6 z-50 mb-10 mt-6 px-10">
                <div>
                    <h1 className="font-black text-slate-800 uppercase tracking-tight text-lg">{quiz.title}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">KHỐI {quiz.grade}</span>
                        {quiz.isMonitored && (
                            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                                <ShieldAlert size={10}/> ĐANG GIÁM SÁT ({violations}/3)
                            </span>
                        )}
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Thí sinh: {student.fullName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 bg-blue-50 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm transition-all animate-pulse-slow">
                        <Clock size={20} className="text-blue-600"/>
                        <span className="tabular-nums text-blue-700 font-black text-xl">
                            {Math.floor(spent / 60)}:{(spent % 60).toString().padStart(2, '0')}
                        </span>
                    </div>
                    <button onClick={() => confirm('Thoát bài thi? Kết quả sẽ không được lưu.') && onExit()} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><XCircle size={28}/></button>
                </div>
            </header>

            <div className="max-w-5xl w-full mx-auto space-y-12 pb-48 px-4">
                {/* Phần I */}
                {orderedQuestions.some(q => q.type === 'mcq') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl">
                            <Info size={20} className="text-blue-400"/>
                            <h2 className="font-black uppercase text-sm tracking-widest">PHẦN I. Câu hỏi trắc nghiệm nhiều phương án lựa chọn</h2>
                        </div>
                        {orderedQuestions.filter(q => q.type === 'mcq').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}

                {/* Phần II */}
                {orderedQuestions.some(q => q.type === 'group-tf') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl">
                            <Info size={20} className="text-purple-400"/>
                            <h2 className="font-black uppercase text-sm tracking-widest">PHẦN II. Câu hỏi trắc nghiệm Đúng/Sai</h2>
                        </div>
                        {orderedQuestions.filter(q => q.type === 'group-tf').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}

                {/* Phần III */}
                {orderedQuestions.some(q => q.type === 'short') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl">
                            <Info size={20} className="text-orange-400"/>
                            <h2 className="font-black uppercase text-sm tracking-widest">PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn</h2>
                        </div>
                        {orderedQuestions.filter(q => q.type === 'short').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}
            </div>

            <footer className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md border-t flex justify-center z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <button 
                    onClick={handleSubmit}
                    className="group relative flex items-center gap-4 px-24 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-sm shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all overflow-hidden"
                >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative z-10 flex items-center gap-4">
                        <Send size={20} className="group-hover:rotate-12 transition-transform"/>
                        Nộp bài thi ngay
                    </span>
                </button>
            </footer>
        </div>
    );
};

export default QuizTaker;
