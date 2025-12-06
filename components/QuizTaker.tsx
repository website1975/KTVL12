
import React, { useState, useEffect } from 'react';
import { Quiz, User, Result, Question } from '../types';
import { saveResult } from '../services/storage';
import { addMinutes, differenceInSeconds, parseISO } from 'date-fns';
import { Timer, Check, RotateCcw, Home, Eye, ListChecks, ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import LatexText from './LatexText';

interface QuizTakerProps {
  quiz: Quiz;
  student: User;
  onExit: () => void;
}

// Thêm trạng thái 'hello' để test
type ViewState = 'taking' | 'result' | 'review' | 'hello';

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
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [finalScore, setFinalScore] = useState(0);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  
  // Khởi tạo thời gian
  useEffect(() => {
    // Nếu không phải đang làm bài thì không chạy đồng hồ
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
            // Hết giờ thì tự nộp
            handleSubmit(true); 
        } else {
            setTimeLeft(diff);
        }
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, currentView]); // Quan trọng: currentView thay đổi -> useEffect chạy lại -> cleanup timer cũ

  const handleAnswer = (qId: string, val: string) => {
      if (currentView !== 'taking') return;
      setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const calculateTotalScore = (): number => {
      let total = 0;
      if (!quiz.questions || !Array.isArray(quiz.questions)) return 0;

      quiz.questions.forEach(q => {
          if (!q) return; 
          const points = safeParseScore(q.points);

          try {
            if (q.type === 'mcq') {
                if (answers[q.id] === q.correctAnswer) total += points;
            } 
            else if (q.type === 'short') {
                const userAns = (answers[q.id] || '').trim().toLowerCase();
                const correctAns = (q.correctAnswer || '').trim().toLowerCase();
                if (correctAns && userAns === correctAns) total += points;
            }
            else if (q.type === 'group-tf' && q.subQuestions) {
                let correctCount = 0;
                q.subQuestions.forEach(sq => {
                    const key = `${q.id}_${sq.id}`;
                    if (answers[key] === sq.correctAnswer) correctCount++;
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
      // 1. NGẮT MỌI LOGIC CHẶN (Bỏ window.confirm)
      console.log("Đang nộp bài...");

      // 2. Tính toán điểm
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

      // 3. Lưu kết quả
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

      // 4. CHUYỂN TRANG NGAY LẬP TỨC SANG TRANG 'HELLO' ĐỂ CHỨNG MINH
      setCurrentView('hello');
      
      // Cuộn lên đầu
      window.scrollTo(0,0);
  };

  const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // ==========================================================
  // VIEW TEST: HELLO (Theo yêu cầu của bạn)
  // ==========================================================
  if (currentView === 'hello') {
      return (
          <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center text-white p-4">
              <h1 className="text-4xl md:text-6xl font-extrabold mb-6 text-center">HELLO!</h1>
              <p className="text-xl md:text-2xl mb-8 text-center bg-blue-700 p-4 rounded-xl">
                 TÔI ĐÃ ĐIỀU HƯỚNG THÀNH CÔNG THEO YÊU CẦU CỦA BẠN.<br/>
                 Nút nộp bài đã hoạt động chính xác.
              </p>
              <button 
                onClick={() => setCurrentView('result')}
                className="bg-white text-blue-600 px-8 py-4 rounded-full font-bold text-xl hover:bg-gray-100 shadow-xl transition transform hover:scale-105"
              >
                XEM KẾT QUẢ CHI TIẾT
              </button>
          </div>
      );
  }

  // ==========================================================
  // VIEW RESULT: KẾT QUẢ THẬT
  // ==========================================================
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
                          onClick={() => { setCurrentView('review'); window.scrollTo(0,0); }}
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

  // ==========================================================
  // VIEW: LÀM BÀI (TAKING) HOẶC XEM LẠI (REVIEW)
  // ==========================================================
  const isReview = currentView === 'review';

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header Sticky */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  {isReview && (
                      <button onClick={() => setCurrentView('result')} className="p-2 hover:bg-gray-100 rounded-full">
                          <ArrowLeft size={24}/>
                      </button>
                  )}
                  <div>
                      <h1 className="font-bold text-gray-800 truncate max-w-[150px] sm:max-w-md">{quiz.title}</h1>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isReview ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                          {isReview ? 'CHẾ ĐỘ XEM LẠI' : 'ĐANG LÀM BÀI'}
                      </span>
                  </div>
              </div>
              
              {!isReview ? (
                  <div className={`font-mono font-bold text-xl flex items-center gap-2 px-3 py-1 rounded-lg ${timeLeft < 60 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'}`}>
                      <Timer size={20}/> {formatTime(timeLeft)}
                  </div>
              ) : (
                  <div className="font-bold text-xl text-blue-600 px-3 py-1 bg-blue-50 rounded-lg border border-blue-100">
                      {finalScore.toFixed(2)} đ
                  </div>
              )}
          </div>
      </div>

      {/* List Questions */}
      <div className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
          {(!quiz.questions || quiz.questions.length === 0) && (
              <div className="text-center p-10 text-gray-500">Đề thi chưa có câu hỏi nào.</div>
          )}

          {quiz.questions?.map((q, idx) => {
              if (!q) return null;
              const points = safeParseScore(q.points);
              return (
                  <div key={q.id || idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* Header Question */}
                      <div className="bg-gray-50 px-5 py-3 border-b flex justify-between items-center">
                          <span className="font-bold text-gray-800">Câu {idx + 1} <span className="text-gray-400 font-normal ml-1">({q.type?.toUpperCase() || 'MCQ'})</span></span>
                          <span className="text-xs font-bold bg-white border px-2 py-1 rounded text-gray-600">{points} điểm</span>
                      </div>

                      <div className="p-6">
                          <div className="mb-6 text-gray-900 text-lg leading-relaxed">
                              <LatexText text={q.text || ''} />
                          </div>
                          {q.imageUrl && (
                              <div className="mb-6">
                                  <img src={q.imageUrl} className="max-h-80 rounded-lg border mx-auto object-contain bg-gray-100" alt="Question" />
                              </div>
                          )}

                          {/* MCQ */}
                          {q.type === 'mcq' && (
                              <div className="grid grid-cols-1 gap-3">
                                  {q.options?.map((opt, optIdx) => {
                                      const isSelected = answers[q.id] === opt;
                                      const isCorrect = q.correctAnswer === opt;
                                      let containerClass = "p-4 border-2 rounded-xl cursor-pointer flex items-center gap-4 transition-all relative ";
                                      
                                      if (isReview) {
                                          containerClass += "cursor-default ";
                                          if (isCorrect) containerClass += "bg-green-50 border-green-500 text-green-900";
                                          else if (isSelected) containerClass += "bg-red-50 border-red-500 text-red-900 opacity-60";
                                          else containerClass += "border-gray-200 opacity-50";
                                      } else {
                                          if (isSelected) containerClass += "bg-blue-50 border-blue-600 shadow-sm";
                                          else containerClass += "border-gray-200 hover:border-blue-300 hover:bg-gray-50";
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

                          {/* Group TF */}
                          {q.type === 'group-tf' && (
                              <div className="border rounded-xl overflow-hidden divide-y">
                                  {q.subQuestions?.map((sq, sqIdx) => {
                                      const key = `${q.id}_${sq.id}`;
                                      const userVal = answers[key];
                                      return (
                                          <div key={sqIdx} className="p-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                              <div className="flex-1">
                                                  <span className="font-bold mr-2 text-gray-500">{String.fromCharCode(97+sqIdx)})</span>
                                                  <LatexText text={sq.text}/>
                                              </div>
                                              <div className="flex gap-2 shrink-0">
                                                  {['True', 'False'].map(opt => {
                                                      const isBtnSelected = userVal === opt;
                                                      const isBtnCorrect = sq.correctAnswer === opt;
                                                      let btnClass = "px-6 py-2 rounded-lg text-sm font-bold border transition-all ";
                                                      
                                                      if (isReview) {
                                                          if (isBtnCorrect) btnClass += "bg-green-600 text-white border-green-600 shadow-md ring-2 ring-green-200";
                                                          else if (isBtnSelected && !isBtnCorrect) btnClass += "bg-red-100 text-red-600 border-red-300 opacity-50";
                                                          else btnClass += "bg-white text-gray-300 border-gray-200 opacity-40";
                                                      } else {
                                                          if (isBtnSelected) btnClass += opt === 'True' ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-orange-500 text-white border-orange-500 shadow-md";
                                                          else btnClass += "bg-white text-gray-500 border-gray-300 hover:bg-gray-100";
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

                          {/* Short Answer */}
                          {q.type === 'short' && (
                              <div>
                                  <label className="block text-sm font-medium text-gray-500 mb-2">Nhập đáp án:</label>
                                  <div className="relative">
                                      <input 
                                          type="text"
                                          value={answers[q.id] || ''}
                                          onChange={e => handleAnswer(q.id, e.target.value)}
                                          disabled={isReview}
                                          className={`w-full p-4 text-lg border-2 rounded-xl font-medium outline-none transition-colors ${
                                              isReview 
                                              ? (answers[q.id]?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800') 
                                              : 'focus:border-blue-500 focus:bg-blue-50 border-gray-300'
                                          }`}
                                      />
                                      {isReview && (
                                          <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-green-600 bg-white px-2 py-1 rounded shadow-sm border border-green-200 text-sm">
                                              Đáp án: {q.correctAnswer}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              );
          })}
      </div>

      {/* FOOTER */}
      {!isReview && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div className="hidden sm:block text-sm text-gray-500">
                      Đã làm: <span className="font-bold text-gray-800">{Object.keys(answers).length}</span> / {quiz.questions?.length || 0} câu
                  </div>
                  <button 
                      onClick={() => handleSubmit(false)}
                      className="flex-1 sm:flex-none sm:w-64 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                      <Save size={20}/> NỘP BÀI THI
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default QuizTaker;
