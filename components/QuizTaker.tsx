
import React, { useState, useEffect, useRef } from 'react';
import { Quiz, User, Result, Question } from '../types';
import { saveResult } from '../services/storage';
import { addMinutes, differenceInSeconds, parseISO } from 'date-fns';
import { Timer, Check, RotateCcw, Home, Eye, ListChecks, ArrowLeft, Save, AlertCircle, Lightbulb, Menu, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from './LatexText';

interface QuizTakerProps {
  quiz: Quiz;
  student: User;
  onExit: () => void;
}

type ViewState = 'taking' | 'result' | 'review';

// Hàm tiện ích: Ép kiểu số an toàn tuyệt đối
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

const QuizTaker: React.FC<QuizTakerProps> = ({ quiz, student, onExit }) => {
  const [currentView, setCurrentView] = useState<ViewState>('taking');
  
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});

  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [finalScore, setFinalScore] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  
  // Mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      if (window.confirm("Bạn có chắc muốn làm lại từ đầu? Mọi đáp án hiện tại sẽ bị xóa.")) {
          setAnswers({});
          answersRef.current = {};
          // Reset scroll
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
            } 
            else if (q.type === 'short') {
                const userAns = (currentAnswers[q.id] || '').trim().toLowerCase();
                const correctAns = (q.correctAnswer || '').trim().toLowerCase();
                if (correctAns && userAns === correctAns) total += points;
            }
            else if (q.type === 'group-tf' && q.subQuestions) {
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
          } catch (err) {
              console.error("Lỗi tính điểm câu:", q.id, err);
          }
      });
      return total;
  };

  const handleSubmit = (auto: boolean = false) => {
      if (!auto) {
          const unanswered = (quiz.questions?.length || 0) - Object.keys(answers).length;
          let msg = "Bạn có chắc chắn muốn nộp bài thi không?";
          if (unanswered > 0) msg += `\n⚠️ Còn ${unanswered} câu chưa trả lời.`; // Note: This logic is simple, ideally check question by question
          
          const isConfirmed = window.confirm(msg);
          if (!isConfirmed) return;
      }

      let score = 0;
      let spent = 0;
      try {
          score = calculateTotalScore();
          const durationMins = safeParseScore(quiz.durationMinutes) || 30;
          spent = Math.max(0, (durationMins * 60) - timeLeft);
      } catch (e) {
          console.error(e);
      }

      setFinalScore(score);
      setTotalTimeSpent(spent);

      try {
          const result: Result = {
              id: uuidv4(),
              quizId: quiz.id,
              studentId: student.id,
              studentName: student.fullName,
              score: score,
              totalQuestions: quiz.questions?.length || 0,
              submittedAt: new Date().toISOString(),
              durationSeconds: spent
          };
          saveResult(result);
      } catch (e) {
          console.error("Lỗi lưu DB", e);
      }

      setCurrentView('result');
      setIsSidebarOpen(false);
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
          // Tính toán vị trí cần cuộn đến:
          // Lấy vị trí của element so với phần tử cha (offsetTop)
          // Trừ đi khoảng 20px (hoặc 100px nếu mobile) để tạo khoảng trống phía trên, giúp nhìn thấy tiêu đề "Câu X"
          const offset = window.innerWidth < 768 ? 80 : 20; 
          const topPos = element.offsetTop - offset;

          container.scrollTo({
              top: topPos,
              behavior: 'smooth'
          });
          
          setIsSidebarOpen(false); // Đóng sidebar trên mobile sau khi click
      }
  };

  // --- VIEW: RESULT SCREEN ---
  if (currentView === 'result') {
      return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
              <div className="w-full max-w-lg text-center animate-fade-in-up">
                  <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <Check size={48} strokeWidth={4} />
                  </div>
                  
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Đã Nộp Bài Thành Công!</h2>
                  <p className="text-gray-500 mb-8 text-lg">{quiz.title}</p>
                  
                  <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 shadow-sm mb-8">
                      <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-200">
                          <span className="text-gray-500 font-medium text-lg">Điểm Số</span>
                          <span className="text-4xl font-extrabold text-blue-600">{finalScore.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-gray-500 font-medium text-lg">Thời Gian</span>
                          <span className="text-2xl font-bold text-gray-800">{formatTime(totalTimeSpent)}</span>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <button 
                          onClick={() => { setCurrentView('review'); }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-blue-200 shadow-lg transition transform hover:-translate-y-1"
                      >
                          Xem Chi Tiết Đáp Án
                      </button>
                      <button 
                          onClick={onExit}
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-xl font-bold text-lg transition"
                      >
                          Về Trang Chủ
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  const isReview = currentView === 'review';

  // --- MAIN QUIZ UI (SPLIT SCREEN) ---
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative">
      
      {/* MOBILE HEADER (Only visible on small screens) */}
      <div className="md:hidden absolute top-0 left-0 right-0 bg-slate-800 text-white p-3 z-30 flex justify-between items-center shadow-md">
          <div className="font-bold truncate max-w-[50%]">{quiz.title}</div>
          <div className="flex items-center gap-3">
             <div className="font-mono font-bold bg-slate-700 px-2 py-1 rounded">{isReview ? 'XEM LẠI' : formatTime(timeLeft)}</div>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                 {isSidebarOpen ? <X/> : <Menu/>}
             </button>
          </div>
      </div>

      {/* LEFT SIDEBAR (Navigation) */}
      <aside className={`
          absolute md:relative z-20 w-72 bg-slate-800 text-white flex flex-col h-full transition-transform duration-300 shadow-xl
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          pt-14 md:pt-0
      `}>
          {/* Timer Section */}
          <div className="p-4 bg-slate-900/50 border-b border-slate-700 text-center">
              <div className="text-slate-400 text-xs uppercase font-bold mb-1">
                  {isReview ? 'Điểm số của bạn' : 'Thời gian còn lại'}
              </div>
              <div className={`font-mono font-bold text-3xl ${timeLeft < 300 && !isReview ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {isReview ? `${finalScore.toFixed(2)}` : formatTime(timeLeft)}
              </div>
          </div>

          {/* Question Navigator - COMPACT VERSION */}
          <div className="flex-1 overflow-y-auto p-3">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2 border-b border-slate-700 pb-1">
                  Bộ điều hướng
              </div>
              {/* Tăng số cột lên 5, giảm gap, giảm kích thước nút */}
              <div className="grid grid-cols-5 gap-1.5">
                  {quiz.questions?.map((q, idx) => {
                      // Logic màu sắc nút
                      let btnClass = "h-8 w-full rounded font-bold text-xs transition-all border flex items-center justify-center ";
                      const hasAnswer = q.type === 'group-tf' 
                          ? Object.keys(answers).some(k => k.startsWith(q.id))
                          : !!answers[q.id];
                      
                      if (isReview) {
                          // Logic Review (Đúng/Sai chưa check kỹ từng câu, tạm thời hiển thị active)
                          btnClass += "bg-slate-700 border-slate-600 text-slate-300";
                      } else {
                          if (hasAnswer) btnClass += "bg-blue-600 border-blue-500 text-white shadow-sm";
                          else btnClass += "bg-transparent border-slate-600 text-slate-300 hover:bg-white/10 hover:border-white";
                      }

                      return (
                          <button 
                              key={idx} 
                              onClick={() => scrollToQuestion(idx)}
                              className={btnClass}
                              title={`Câu ${idx + 1}`}
                          >
                              {idx + 1}
                          </button>
                      )
                  })}
              </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-slate-900 border-t border-slate-700 space-y-2">
              {!isReview ? (
                  <>
                    <button 
                        onClick={() => handleSubmit(false)}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-lg shadow-red-900/50 transition flex items-center justify-center gap-2 text-sm"
                    >
                        NỘP BÀI
                    </button>
                    <button 
                        onClick={handleReset}
                        className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded shadow-lg shadow-yellow-900/50 transition text-sm"
                    >
                        LÀM LẠI
                    </button>
                  </>
              ) : (
                  <button 
                      onClick={onExit}
                      className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded transition flex items-center justify-center gap-2 text-sm"
                  >
                      <Home size={16}/> VỀ TRANG CHỦ
                  </button>
              )}
          </div>
      </aside>

      {/* RIGHT MAIN CONTENT (Questions) */}
      <main id="main-content" className="flex-1 h-full overflow-y-auto bg-gray-100 pt-16 md:pt-0 relative">
          <div className="max-w-4xl mx-auto p-4 md:p-8 pb-32">
              <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
                  <p className="text-gray-500 text-sm">
                      {quiz.description || "Hãy đọc kỹ câu hỏi và chọn đáp án chính xác nhất."}
                  </p>
              </div>

              <div className="space-y-6">
                {(!quiz.questions || quiz.questions.length === 0) && (
                    <div className="text-center p-10 text-gray-500">Đề thi chưa có câu hỏi nào.</div>
                )}

                {quiz.questions?.map((q, idx) => {
                    if (!q) return null;
                    const points = safeParseScore(q.points);
                    return (
                        <div id={`q-${idx}`} key={q.id || idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                            {/* Question Header */}
                            <div className="bg-blue-50/50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                                <span className="font-bold text-blue-800 text-lg">Câu {idx + 1}.</span>
                                <span className="text-xs font-bold bg-white border px-2 py-1 rounded text-gray-500 shadow-sm">{points} điểm</span>
                            </div>

                            <div className="p-6">
                                <div className="mb-6 text-gray-900 text-lg leading-relaxed font-medium">
                                    <LatexText text={q.text || ''} />
                                </div>
                                {q.imageUrl && (
                                    <div className="mb-6">
                                        <img src={q.imageUrl} className="max-h-80 rounded-lg border mx-auto object-contain bg-gray-50" alt="Question" />
                                    </div>
                                )}

                                {/* RENDER MCQ OPTIONS */}
                                {q.type === 'mcq' && (
                                    <div className="grid grid-cols-1 gap-3">
                                        {q.options?.map((opt, optIdx) => {
                                            const isSelected = answers[q.id] === opt;
                                            const isCorrect = q.correctAnswer === opt;
                                            
                                            // Base style
                                            let containerClass = "p-4 border rounded-xl cursor-pointer flex items-center gap-4 transition-all relative ";
                                            
                                            if (isReview) {
                                                containerClass += "cursor-default ";
                                                if (isCorrect) containerClass += "bg-green-50 border-green-500 text-green-900 ring-1 ring-green-200";
                                                else if (isSelected) containerClass += "bg-red-50 border-red-500 text-red-900 opacity-70";
                                                else containerClass += "border-gray-200 opacity-50";
                                            } else {
                                                if (isSelected) containerClass += "bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-200";
                                                else containerClass += "border-gray-200 hover:border-blue-300 hover:bg-gray-50 hover:shadow-sm";
                                            }

                                            return (
                                                <div key={optIdx} onClick={() => handleAnswer(q.id, opt)} className={containerClass}>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected || (isReview && isCorrect) ? 'border-current' : 'border-gray-300'}`}>
                                                        {(isSelected || (isReview && isCorrect)) && <div className="w-3 h-3 rounded-full bg-current" />}
                                                    </div>
                                                    <div className="font-medium"><LatexText text={opt}/></div>
                                                    {isReview && isCorrect && <Check className="absolute right-4 text-green-600" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* RENDER GROUP TRUE/FALSE */}
                                {q.type === 'group-tf' && (
                                    <div className="border rounded-xl overflow-hidden divide-y divide-gray-100">
                                        {q.subQuestions?.map((sq, sqIdx) => {
                                            const key = `${q.id}_${sq.id}`;
                                            const userVal = answers[key];
                                            return (
                                                <div key={sqIdx} className="p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <span className="font-bold mr-2 text-blue-600">{String.fromCharCode(97+sqIdx)})</span>
                                                        <LatexText text={sq.text}/>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        {['True', 'False'].map(opt => {
                                                            const isBtnSelected = userVal === opt;
                                                            const isBtnCorrect = sq.correctAnswer === opt;
                                                            let btnClass = "px-6 py-2 rounded-lg text-sm font-bold border transition-all ";
                                                            
                                                            if (isReview) {
                                                                if (isBtnCorrect) btnClass += "bg-green-600 text-white border-green-600 shadow-md";
                                                                else if (isBtnSelected) btnClass += "bg-red-100 text-red-600 border-red-300 opacity-50";
                                                                else btnClass += "bg-white text-gray-300 border-gray-200 opacity-40";
                                                            } else {
                                                                if (isBtnSelected) btnClass += opt === 'True' ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-orange-500 text-white border-orange-500 shadow-md";
                                                                else btnClass += "bg-white text-gray-500 border-gray-300 hover:bg-gray-100 hover:border-gray-400";
                                                            }

                                                            return (
                                                                <button key={opt} onClick={() => handleAnswer(key, opt)} disabled={isReview} className={btnClass}>
                                                                    {opt === 'True' ? 'ĐÚNG' : 'SAI'}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* RENDER SHORT ANSWER */}
                                {q.type === 'short' && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-700 whitespace-nowrap">Đáp số {idx+1}:</span>
                                            <div className="relative w-full max-w-xs">
                                                <input 
                                                    type="text"
                                                    value={answers[q.id] || ''}
                                                    onChange={e => handleAnswer(q.id, e.target.value)}
                                                    disabled={isReview}
                                                    placeholder="Nhập kết quả..."
                                                    className={`w-full px-4 py-2 border rounded-lg font-medium outline-none transition-colors ${
                                                        isReview 
                                                        ? (answers[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800') 
                                                        : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-100 border-gray-300'
                                                    }`}
                                                />
                                                {isReview && (
                                                     <div className="mt-2 text-sm font-bold text-green-600 flex items-center gap-1">
                                                         <Check size={14}/> Đáp án đúng: {q.correctAnswer}
                                                     </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isReview && q.solution && (
                                    <div className="mt-6 animate-fade-in">
                                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                                            <h4 className="flex items-center gap-2 text-yellow-800 font-bold mb-2">
                                                <Lightbulb size={18} className="fill-yellow-400 text-yellow-600"/> Lời giải chi tiết
                                            </h4>
                                            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap text-sm">
                                                <LatexText text={q.solution} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    );
                })}
              </div>
          </div>
      </main>
      
      {/* OVERLAY FOR MOBILE SIDEBAR */}
      {isSidebarOpen && (
          <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-10 md:hidden"></div>
      )}
    </div>
  );
};

export default QuizTaker;
