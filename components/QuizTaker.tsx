
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quiz, User, Result, Question, ExamSession } from '../types';
import { saveResult, addPointsToUser, saveExamSession, deleteExamSession } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { Clock, Send, XCircle, Info, ShieldAlert } from 'lucide-react';
import LatexText from './LatexText';
import { addMinutes, differenceInSeconds } from 'date-fns';

interface QuizTakerProps {
    quiz: Quiz;
    student: User;
    onExit: () => void;
}

const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, student, onExit }) => {
    const sessionIdRef = useRef(`sess_${student.id}_${quiz.id}`);
    const initialStartTimeRef = useRef(new Date().toISOString());
    const isInternalActionRef = useRef(false);
    
    const deadline = useMemo(() => {
        if (quiz.type === 'test' && quiz.startTime) {
            return addMinutes(new Date(quiz.startTime), quiz.durationMinutes);
        }
        return addMinutes(new Date(), quiz.durationMinutes);
    }, [quiz]);

    const calculateTimeLeft = () => {
        const diff = differenceInSeconds(deadline, new Date());
        return diff > 0 ? diff : 0;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
    const [spent, setSpent] = useState(0); 
    const [currentAnswers, setCurrentAnswers] = useState<Record<string, any>>({});
    const [violations, setViolations] = useState(0);
    const [showWarning, setShowWarning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const currentAnswersRef = useRef(currentAnswers);
    const spentRef = useRef(spent);
    const violationsRef = useRef(violations);

    useEffect(() => {
        currentAnswersRef.current = currentAnswers;
        spentRef.current = spent;
        violationsRef.current = violations;
    }, [currentAnswers, spent, violations]);

    const updateMonitorStatus = async (violationCount: number, isFinished = false) => {
        try {
            const session: ExamSession = {
                id: sessionIdRef.current,
                quizId: quiz.id,
                studentId: student.id,
                studentName: student.fullName,
                studentCode: student.studentCode || 'N/A',
                startTime: initialStartTimeRef.current,
                lastUpdate: new Date().toISOString(),
                violationCount: violationCount,
                isFinished: isFinished
            };
            await saveExamSession(session);
        } catch (e) {
            console.warn("Lỗi cập nhật giám sát (không nghiêm trọng):", e);
        }
    };

    useEffect(() => {
        updateMonitorStatus(0);
        // Giảm tần suất heartbeat xuống 20s để giảm tải DB
        const heartbeat = setInterval(() => {
            if (!isSubmitting) updateMonitorStatus(violationsRef.current);
        }, 20000);
        
        return () => clearInterval(heartbeat);
    }, []);

    const orderedQuestions = useMemo(() => {
        const parts = {
            mcq: quiz.questions.filter(q => q.type === 'mcq'),
            'group-tf': quiz.questions.filter(q => q.type === 'group-tf'),
            short: quiz.questions.filter(q => q.type === 'short')
        };
        return [...parts.mcq, ...parts['group-tf'], ...parts.short];
    }, [quiz.questions]);

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            setSpent(s => s + 1);

            if (remaining <= 0 && !isSubmitting) {
                clearInterval(timer);
                handleTimeUp();
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [deadline]);

    useEffect(() => {
        if (!quiz.isMonitored || isSubmitting) return;
        const handleVisibilityChange = () => {
            if (isInternalActionRef.current) return;
            if (document.hidden) {
                setViolations(v => {
                    const newVal = v + 1;
                    updateMonitorStatus(newVal);
                    if (newVal >= 3) handleAutoSubmit("VI PHẠM QUY CHẾ (CHUYỂN TAB)");
                    else setShowWarning(true);
                    return newVal;
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [quiz.isMonitored, isSubmitting]);

    const handleTimeUp = async () => {
        isInternalActionRef.current = true;
        // Jitter: Đợi ngẫu nhiên 0-3 giây trước khi nộp để tránh dồn toa yêu cầu
        const delay = Math.random() * 3000;
        console.log(`Nộp bài tự động sau ${delay.toFixed(0)}ms...`);
        setTimeout(async () => {
            alert("HẾT GIỜ LÀM BÀI! HỆ THỐNG SẼ TỰ ĐỘNG NỘP BÀI.");
            await finalizeSubmit(true);
        }, delay);
    };

    const handleAutoSubmit = async (reason: string) => {
        isInternalActionRef.current = true;
        alert(`BẠN ĐÃ ${reason} QUÁ 3 LẦN. HỆ THỐNG SẼ TỰ ĐỘNG NỘP BÀI!`);
        await finalizeSubmit(true);
    };

    const finalizeSubmit = async (isAuto = false) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        const finalAnswers = currentAnswersRef.current;
        const finalSpent = spentRef.current;
        const finalViolations = violationsRef.current;
        
        let score = 0;
        quiz.questions.forEach(q => {
            const ans = finalAnswers[q.id];
            if (q.type === 'mcq') {
                if (ans === q.correctAnswer) score += Number(q.points);
            } else if (q.type === 'short') {
                if (String(ans || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) score += Number(q.points);
            } else if (q.type === 'group-tf' && q.subQuestions) {
                let subCorrect = 0;
                q.subQuestions.forEach((sq, i) => { if (ans?.[i] === sq.correctAnswer) subCorrect++; });
                if (subCorrect === 4) score += Number(q.points);
                else if (subCorrect === 3) score += Number(q.points) * 0.5;
                else if (subCorrect === 2) score += Number(q.points) * 0.25;
                else if (subCorrect === 1) score += Number(q.points) * 0.1;
            }
        });

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
            await deleteExamSession(sessionIdRef.current); 
            if (!isAuto) {
                alert(`Hoàn thành! Bạn đạt ${score.toFixed(2)} điểm.`);
            }
            onExit();
        } catch (error) {
            console.error("Lỗi nộp bài:", error);
            alert("Hệ thống đang quá tải, bài làm đã được lưu vào bộ nhớ đệm. Vui lòng không đóng trình duyệt và nhấn nộp lại sau 1 phút.");
            setIsSubmitting(false);
            isInternalActionRef.current = false;
        }
    };

    const handleSubmit = async () => {
        isInternalActionRef.current = true;
        if (!confirm('Bạn có chắc chắn muốn nộp bài?')) {
            isInternalActionRef.current = false;
            return;
        }
        await finalizeSubmit(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderQuestion = (q: Question, globalIdx: number) => (
        <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm transition-all hover:border-blue-100">
            <div className="flex items-start gap-4 mb-6">
                <span className="text-blue-600 font-black italic underline uppercase shrink-0">Câu {globalIdx + 1}.</span>
                <div className="text-slate-800 text-lg font-bold leading-relaxed"><LatexText text={q.text}/></div>
            </div>
            {q.imageUrl && <div className="mb-6 flex justify-center"><img src={q.imageUrl} className="max-h-80 rounded-2xl border border-slate-100 shadow-sm" alt="q" /></div>}
            {q.type === 'mcq' && q.options && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-10">
                    {q.options.map((opt, oi) => (
                        <button key={oi} onClick={() => setCurrentAnswers({ ...currentAnswers, [q.id]: opt })} className={`p-5 rounded-2xl border-2 text-left text-sm font-bold transition-all flex items-center gap-3 ${currentAnswers[q.id] === opt ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-[1.02]' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${currentAnswers[q.id] === opt ? 'bg-white/20 border-white/40' : 'bg-white border-slate-200'}`}>{String.fromCharCode(65+oi)}</span>
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
                                    <button key={v} onClick={() => { const qAns = currentAnswers[q.id] || {}; setCurrentAnswers({ ...currentAnswers, [q.id]: { ...qAns, [si]: v } }); }} className={`px-6 py-2 text-[10px] font-black rounded-lg transition-all ${currentAnswers[q.id]?.[si] === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{v === 'True' ? 'ĐÚNG' : 'SAI'}</button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {q.type === 'short' && (
                <div className="pl-0 md:pl-10">
                    <input type="text" className="w-full max-w-md p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-blue-600 focus:border-blue-500 focus:bg-white transition-all" placeholder="Nhập đáp số..." value={currentAnswers[q.id] || ''} onChange={e => setCurrentAnswers({ ...currentAnswers, [q.id]: e.target.value })} />
                </div>
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            {showWarning && !isSubmitting && (
                <div className="fixed inset-0 z-[2000] bg-red-600/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[3rem] p-12 max-w-lg text-center shadow-2xl space-y-6">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto animate-bounce"><ShieldAlert size={48}/></div>
                        <h2 className="text-2xl font-black uppercase text-red-600">CẢNH BÁO VI PHẠM!</h2>
                        <p className="font-bold text-slate-600">Bạn vừa thoát tab thi. Số lần vi phạm: {violations}/3</p>
                        <button onClick={() => { setShowWarning(false); isInternalActionRef.current = false; }} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all">QUAY LẠI LÀM BÀI</button>
                    </div>
                </div>
            )}

            <header className="max-w-5xl w-full mx-auto flex justify-between items-center bg-white/90 backdrop-blur-xl p-6 rounded-[2.5rem] border shadow-sm sticky top-6 z-50 mb-10 mt-6 px-10">
                <div>
                    <h1 className="font-black text-slate-800 uppercase tracking-tight text-lg">{quiz.title}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">KHỐI {quiz.grade}</span>
                        {quiz.isMonitored && <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 animate-pulse"><ShieldAlert size={10}/> ĐANG GIÁM SÁT</span>}
                    </div>
                </div>
                <div className="flex items-center gap-8">
                    <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-sm transition-all ${timeLeft < 300 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                        <Clock size={20} className={timeLeft < 300 ? 'text-red-600' : 'text-blue-600'}/>
                        <span className={`tabular-nums font-black text-xl ${timeLeft < 300 ? 'text-red-700' : 'text-blue-700'}`}>{formatTime(timeLeft)}</span>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl w-full mx-auto space-y-12 pb-48 px-4">
                {orderedQuestions.some(q => q.type === 'mcq') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl"><h2 className="font-black uppercase text-sm tracking-widest">PHẦN I. TRẮC NGHIỆM</h2></div>
                        {orderedQuestions.filter(q => q.type === 'mcq').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}
                {orderedQuestions.some(q => q.type === 'group-tf') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl"><h2 className="font-black uppercase text-sm tracking-widest">PHẦN II. ĐÚNG/SAI</h2></div>
                        {orderedQuestions.filter(q => q.type === 'group-tf').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}
                {orderedQuestions.some(q => q.type === 'short') && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-900 text-white p-5 px-10 rounded-[2rem] shadow-xl"><h2 className="font-black uppercase text-sm tracking-widest">PHẦN III. TRẢ LỜI NGẮN</h2></div>
                        {orderedQuestions.filter(q => q.type === 'short').map((q) => renderQuestion(q, orderedQuestions.indexOf(q)))}
                    </div>
                )}
            </div>

            <footer className="fixed bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md border-t flex justify-center z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <button onClick={handleSubmit} disabled={isSubmitting} className="group relative flex items-center gap-4 px-24 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-sm shadow-2xl hover:bg-black transition-all overflow-hidden disabled:opacity-50">
                    <span className="relative z-10 flex items-center gap-4"><Send size={20}/> {isSubmitting ? 'ĐANG NỘP BÀI...' : 'Nộp bài thi ngay'}</span>
                </button>
            </footer>
        </div>
    );
};

export default QuizTaker;
