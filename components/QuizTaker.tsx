
import React, { useState, useEffect, useRef } from 'react';
import { Quiz, User, Result, Question } from '../types';
import { saveResult, addPointsToUser, getResults } from '../services/storage';
import { addMinutes, differenceInSeconds, parseISO } from 'date-fns';
import { Timer, Check, RotateCcw, Home, Eye, ListChecks, ArrowLeft, Save, AlertCircle, Lightbulb, Menu, X, Send, Trophy, Sparkles, Loader2, ShieldAlert } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from './LatexText';

interface QuizTakerProps {
  quiz: Quiz;
  student: User;
  onExit: () => void;
}

type ViewState = 'taking' | 'result' | 'review';

const safeParseScore = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    try {
        const str = String(val).replace(',', '.').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    } catch (e) {
        return 0;
    }
};

const checkShortAnswer = (userAns: string | undefined, correctAns: string | undefined): boolean => {
    if (!userAns || !correctAns) return false;
    const u = userAns.trim().toLowerCase();
    const c = correctAns.trim().toLowerCase();
    if (u === c) return true;
    const uNum = parseFloat(u.replace(',', '.'));
    const cNum = parseFloat(c.replace(',', '.'));
    if (!isNaN(uNum) && !isNaN(cNum)) {
        return Math.abs(uNum - cNum) < 0.000001; 
    }
    return false;
};

const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, student, onExit }) => {
  const [currentView, setCurrentView] = useState<ViewState>('taking');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [finalScore, setFinalScore] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Anti-cheat states
  const [cheatWarning, setCheatWarning] = useState(false);
  const tabSwitchCount = useRef(0);

  // Monitor tab switching
  useEffect(() => {
    if (currentView !== 'taking') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (quiz.type === 'test') {
          tabSwitchCount.current += 1;
          if (tabSwitchCount.current === 1) {
            setCheatWarning(true);
          } else if (tabSwitchCount.current >= 2) {
            alert("BẠN ĐÃ RỜI KHỎI TAB THI LẦN THỨ 2. HỆ THỐNG TỰ ĐỘNG NỘP BÀI!");
            handleSubmit(true);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [currentView, quiz.type]);

  useEffect(() => {
    if (currentView !== 'taking') return;
    const durationMins = safeParseScore(quiz.durationMinutes) || 30;
    let targetTime: Date;
    if (quiz.type === 'test' && quiz.startTime) {
        const start = parseISO(quiz.startTime);
        targetTime = addMinutes(start, durationMins);
    } else {
        targetTime = addMinutes(new Date(), durationMins);
    }
    const timer = setInterval(() => {
        const now = new Date();
        const diff = differenceInSeconds(targetTime, now);
        if (diff <= 0) {
            clearInterval(timer);
            setTimeLeft(0);
            handleSubmit(true); 
        } else {
            setTimeLeft(diff);
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [quiz, currentView]);

  const handleAnswer = (qId: string, val: string) => {
      if (currentView !== 'taking') return;
      const newAnswers = { ...answers, [qId]: val };
      setAnswers(newAnswers);
      answersRef.current = newAnswers;
  };

  const handleReset = () => {
      if (window.confirm("Bạn có chắc muốn làm lại từ đầu?")) {
          setAnswers({});
          answersRef.current = {};
          const mainContent = document.getElementById('main-content');
          if (mainContent) mainContent.scrollTop = 0;
      }
  };

  const calculateTotalScore = (): number => {
      let total = 0;
      if (!quiz.questions || !Array.isArray(quiz.questions)) return 0;
      const currentAnswers = answersRef.current;
      quiz.questions.forEach(q => {
          if (!q) return; 
          const points = safeParseScore(q.points);
          try {
            if (q.type === 'mcq') {
                if (currentAnswers[q.id] === q.correctAnswer) total += points;
            } else if (q.type === 'short') {
                if (checkShortAnswer(currentAnswers[q.id], q.correctAnswer)) total += points;
            } else if (q.type === 'group-tf' && q.subQuestions) {
                let correctCount = 0;
                q.subQuestions.forEach(sq => {
                    const key = `${q.id}_${sq.id}`;
                    if (currentAnswers[key] === sq.correctAnswer) correctCount++;
                });
                if (correctCount === 1) total += 0.1;
                else if (correctCount === 2) total += 0.25;
                else if (correctCount === 3) total += 0.5;
                else if (correctCount === 4) total += points;
            }
          } catch (err) {}
      });
      return total;
  };

  const handleSubmit = async (auto: boolean = false) => {
      if (isSubmitting) return;
      if (!auto) {
          const unanswered = (quiz.questions?.length || 0) - Object.keys(answers).length;
          let msg = "Bạn có chắc chắn muốn nộp bài?";
          if (unanswered > 0) msg += `\n⚠️ Còn ${unanswered} câu chưa trả lời.`;
          if (!window.confirm(msg)) return;
      }

      setIsSubmitting(true);
      const score = calculateTotalScore();
      const durationMins = safeParseScore(quiz.durationMinutes) || 30;
      const spent = Math.max(0, (durationMins * 60) - timeLeft);
      
      let earned = 0;
      if (quiz.type === 'test') {
          if (score >= 8.0) earned = 1;
      } else if (quiz.type === 'practice') {
          // Công thức: diem = tong tgian (s) / (45*60)
          earned = spent / (45 * 60);
      }

      setFinalScore(score);
      setTotalTimeSpent(spent);
      setPointsEarned(earned);

      const result: Result = {
          id: uuidv4(),
          quizId: quiz.id,
          studentId: student.id,
          studentName: student.fullName,
          score: score,
          totalQuestions: quiz.questions?.length || 0,
          submittedAt: new Date().toISOString(),
          durationSeconds: spent,
          pointsAwarded: earned
      };

      await saveResult(result);
      if (earned > 0) await addPointsToUser(student.id, earned);

      setCurrentView('result');
      setIsSidebarOpen(false);
      setIsSubmitting(false);
  };

  const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const scrollToQuestion = (index: number) => {
      const container = document.getElementById('main-content');
      const element = document.getElementById(`q-${index}`);
      if (container && element) {
          const offset = window.innerWidth < 768 ? 80 : 20; 
          const topPos = element.offsetTop - offset;
          container.scrollTo({ top: topPos, behavior: 'smooth' });
          setIsSidebarOpen(false);
      }
  };

  if (currentView === 'result') {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-lg text-center animate-fade-in-up">
                  <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg relative">
                      <Check size={48} strokeWidth={4} />
                      {pointsEarned > 0 && <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-2 rounded-full animate-bounce shadow-lg"><Trophy size={20}/></div>}
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">Đã nộp bài thành công!</h2>
                  <p className="text-gray-500 mb-8 text-lg">{quiz.title}</p>
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-sm mb-8 space-y-6">
                      <div className="flex justify-between items-center pb-6 border-b border-gray-200"><span className="text-gray-500 font-medium text-lg">Điểm Số</span><span className="text-4xl font-extrabold text-blue-600">{finalScore.toFixed(2)}</span></div>
                      <div className="flex justify-between items-center pb-6 border-b border-gray-200"><span className="text-gray-500 font-medium text-lg">Thời Gian Làm</span><span className="text-2xl font-bold text-gray-800">{formatTime(totalTimeSpent)}</span></div>
                      {pointsEarned > 0 && (
                        <div className="flex items-center justify-center gap-3 py-4 bg-yellow-400/10 rounded-2xl border border-yellow-200 animate-pulse">
                            <Sparkles className="text-yellow-500" size={24}/>
                            <span className="text-yellow-700 font-black uppercase text-[10px] tracking-widest">
                                Bạn đã nhận +{pointsEarned.toFixed(4)} điểm tích lũy!
                            </span>
                        </div>
                      )}
                  </div>
                  <div className="space-y-4">
                      <button onClick={() => setCurrentView('review')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold text-lg shadow-blue-200 shadow-lg transition transform hover:-translate-y-1">Xem chi tiết đáp án</button>
                      <button onClick={onExit} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-bold text-lg transition">Quay về trang chủ</button>
                  </div>
              </div>
          </div>
      );
  }

  const isReview = currentView === 'review';

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative">
      {/* CHEAT WARNING MODAL */}
      {cheatWarning && (
        <div className="fixed inset-0 bg-red-600/95 z-[1000] flex items-center justify-center p-6 backdrop-blur-xl">
           <div className="bg-white p-10 rounded-[3rem] max-w-md w-full text-center shadow-2xl border-8 border-red-100 animate-bounce-slow">
              <ShieldAlert size={80} className="mx-auto text-red-600 mb-6" />
              <h2 className="text-2xl font-black text-red-600 uppercase mb-4">CẢNH BÁO VI PHẠM!</h2>
              <p className="text-slate-600 font-bold mb-8 leading-relaxed">Hệ thống phát hiện bạn vừa rời khỏi Tab làm bài. Nếu tái phạm lần nữa, hệ thống sẽ <b>TỰ ĐỘNG NỘP BÀI</b> ngay lập tức!</p>
              <button onClick={() => setCheatWarning(false)} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase shadow-xl hover:bg-red-700 transition-all active:scale-95">Tôi đã hiểu và cam kết</button>
           </div>
        </div>
      )}

      <div className="md:hidden absolute top-0 left-0 right-0 bg-slate-800 text-white p-3 z-30 flex justify-between items-center shadow-md">
          <div className="font-bold truncate max-w-[50%]">{quiz.title}</div>
          <div className="flex items-center gap-3">
             <div className="font-mono font-bold bg-slate-700 px-2 py-1 rounded">{isReview ? 'XEM LẠI' : formatTime(timeLeft)}</div>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>{isSidebarOpen ? <X/> : <Menu/>}</button>
          </div>
      </div>
      <aside className={`absolute md:relative z-20 w-64 bg-slate-800 text-white flex flex-col h-full transition-transform duration-300 shadow-xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} pt-14 md:pt-0`}>
          <div className="p-4 bg-slate-900/50 border-b border-slate-700 text-center shrink-0">
              <div className="text-slate-400 text-xs uppercase font-bold mb-1">{isReview ? 'Điểm của bạn' : 'Thời gian còn lại'}</div>
              <div className={`font-mono font-bold text-3xl ${timeLeft < 300 && !isReview ? 'text-red-500 animate-pulse' : 'text-white'}`}>{isReview ? `${finalScore.toFixed(2)}` : formatTime(timeLeft)}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">Câu hỏi bài thi</div>
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                  {quiz.questions?.map((q, idx) => {
                      let btnClass = "h-8 w-full rounded font-bold text-xs transition-all border flex items-center justify-center ";
                      const hasAnswer = q.type === 'group-tf' ? Object.keys(answers).some(k => k.startsWith(q.id)) : !!answers[q.id];
                      if (isReview) btnClass += "bg-slate-700 border-slate-600 text-slate-300";
                      else if (hasAnswer) btnClass += "bg-blue-600 border-blue-500 text-white shadow-sm";
                      else btnClass += "bg-transparent border-slate-600 text-slate-300 hover:bg-white/10 hover:border-white";
                      return (<button key={idx} onClick={() => scrollToQuestion(idx)} className={btnClass}>{idx + 1}</button>)
                  })}
              </div>
              <div className="border-t border-slate-700 pt-3">
                  {!isReview ? (
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-sm transition flex items-center justify-center gap-1 text-xs">{isSubmitting ? <Loader2 className="animate-spin" size={14}/> : <Send size={14} />} NỘP BÀI</button>
                          <button onClick={handleReset} disabled={isSubmitting} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded shadow-sm transition flex items-center justify-center gap-1 text-xs"><RotateCcw size={14} /> LÀM LẠI</button>
                      </div>
                  ) : (<button onClick={onExit} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded transition flex items-center justify-center gap-2 text-xs"><Home size={14}/> VỀ TRANG CHỦ</button>)}
              </div>
          </div>
      </aside>
      <main id="main-content" className="flex-1 h-full overflow-y-auto bg-gray-100 pt-16 md:pt-0 relative">
          <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
              <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-200 flex justify-between items-center">
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 mb-1">{quiz.title}</h1>
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">{quiz.type === 'test' ? 'Cơ chế giám sát thi đang bật' : 'Chế độ luyện tập tự do'}</p>
                  </div>
                  {quiz.type === 'test' && <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl border border-emerald-100 flex items-center gap-2 font-black text-[10px] uppercase shadow-sm"><ShieldAlert size={16}/> Anti-Cheat Active</div>}
              </div>
              <div className="space-y-6">
                {quiz.questions?.map((q, idx) => {
                    if (!q) return null;
                    return (
                        <div id={`q-${idx}`} key={q.id || idx} className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden relative">
                            <div className="bg-blue-50/50 px-5 py-3 border-b border-gray-100 flex justify-between items-center"><span className="font-black text-blue-800 text-lg">Câu {idx + 1}.</span><span className="text-[10px] font-black bg-white border px-3 py-1 rounded-xl text-gray-400 shadow-sm uppercase italic">{q.points} điểm</span></div>
                            <div className="p-6">
                                <div className="mb-6 text-gray-900 text-lg leading-relaxed font-medium"><LatexText text={q.text || ''} /></div>
                                {q.imageUrl && <div className="mb-8"><img src={q.imageUrl} className="max-h-[500px] rounded-2xl border-2 border-slate-100 mx-auto object-contain bg-slate-50 shadow-inner" alt="Hình ảnh câu hỏi" /></div>}
                                {q.type === 'mcq' && (
                                    <div className="grid grid-cols-1 gap-3">
                                        {q.options?.map((opt, optIdx) => {
                                            const isSelected = answers[q.id] === opt;
                                            const isCorrect = q.correctAnswer === opt;
                                            let containerClass = "p-4 border rounded-2xl cursor-pointer flex items-center gap-4 transition-all relative ";
                                            if (isReview) {
                                                containerClass += "cursor-default ";
                                                if (isCorrect) containerClass += "bg-green-100 border-green-600 text-green-900 ring-2 ring-green-200 font-bold z-10 shadow-sm";
                                                else if (isSelected) containerClass += "bg-red-50 border-red-300 text-red-500 opacity-60 line-through decoration-red-400";
                                                else containerClass += "bg-white border-gray-100 text-gray-300 opacity-30 grayscale";
                                            } else if (isSelected) containerClass += "bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-200";
                                            else containerClass += "border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm";
                                            return (<div key={optIdx} onClick={() => handleAnswer(q.id, opt)} className={containerClass}><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected || (isReview && isCorrect) ? 'border-current' : 'border-gray-300'}`}>{(isSelected || (isReview && isCorrect)) && <div className="w-3 h-3 rounded-full bg-current" />}</div><div className="font-medium"><LatexText text={opt}/></div>{isReview && isCorrect && <Check className="absolute right-4 text-green-600" strokeWidth={3} />}</div>);
                                        })}
                                    </div>
                                )}
                                {q.type === 'group-tf' && (
                                    <div className="border rounded-2xl overflow-hidden divide-y divide-gray-100">
                                        {q.subQuestions?.map((sq, sqIdx) => {
                                            const key = `${q.id}_${sq.id}`;
                                            const userVal = answers[key];
                                            return (
                                                <div key={sqIdx} className="p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex-1 font-medium"><span className="font-black mr-2 text-blue-600">{String.fromCharCode(97+sqIdx)})</span><LatexText text={sq.text}/></div>
                                                    <div className="flex gap-2 shrink-0">
                                                        {['True', 'False'].map(opt => {
                                                            const isBtnSelected = userVal === opt;
                                                            const isBtnCorrect = sq.correctAnswer === opt;
                                                            let btnClass = "px-6 py-2 rounded-xl text-sm font-bold border transition-all ";
                                                            if (isReview) {
                                                                if (isBtnCorrect) btnClass += "bg-green-600 text-white border-green-600 shadow-md opacity-100";
                                                                else if (isBtnSelected) btnClass += "bg-red-100 text-red-500 border-red-300 opacity-50";
                                                                else btnClass += "bg-white text-gray-200 border-gray-100 opacity-20";
                                                            } else if (isBtnSelected) btnClass += opt === 'True' ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-orange-500 text-white border-orange-500 shadow-md";
                                                            else btnClass += "bg-white text-gray-500 border-gray-300 hover:bg-gray-100 hover:border-gray-400";
                                                            return (<button key={opt} onClick={() => handleAnswer(key, opt)} disabled={isReview} className={btnClass}>{opt === 'True' ? 'ĐÚNG' : 'SAI'}</button>);
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {q.type === 'short' && (
                                    <div className="mt-2 flex items-center gap-3">
                                        <span className="font-black text-slate-700 whitespace-nowrap uppercase text-[10px] tracking-widest">Đáp số:</span>
                                        <div className="relative w-full max-w-xs">
                                            <input 
                                                type="text" 
                                                value={answers[q.id] || ''} 
                                                onChange={e => handleAnswer(q.id, e.target.value)} 
                                                disabled={isReview} 
                                                autoComplete="new-password" 
                                                id={`short-ans-${q.id}`}
                                                placeholder="Kết quả..." 
                                                className={`w-full px-4 py-2.5 border rounded-xl font-black outline-none transition-all ${isReview ? (checkShortAnswer(answers[q.id], q.correctAnswer) ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-300 text-red-500 opacity-60') : 'focus:border-blue-500 focus:ring-4 focus:ring-blue-100 border-gray-300 shadow-inner bg-slate-50/50'}`} 
                                            />
                                            {isReview && <div className="mt-2 text-[10px] font-black text-emerald-600 flex items-center gap-1 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-lg w-fit border border-emerald-100"><Check size={12}/> Đáp án chuẩn: {q.correctAnswer}</div>}
                                        </div>
                                    </div>
                                )}
                                {isReview && q.solution && <div className="mt-6 animate-fade-in"><div className="bg-yellow-50/50 border border-yellow-100 p-6 rounded-2xl"><h4 className="flex items-center gap-2 text-yellow-800 font-bold mb-3 uppercase text-[10px] tracking-[0.2em]"><Lightbulb size={16} className="text-yellow-600"/> Hướng dẫn giải chi tiết</h4><div className="text-gray-700 leading-relaxed text-sm"><LatexText text={q.solution} /></div></div></div>}
                            </div>
                        </div>
                    );
                })}
              </div>
          </div>
      </main>
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-10 md:hidden"></div>}
    </div>
  );
};

export default QuizTaker;
