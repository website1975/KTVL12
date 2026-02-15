
import React, { useState, useEffect, useMemo } from 'react';
import { Quiz, Question, User } from '../types';
import { ChevronRight, ChevronLeft, CheckCircle2, XCircle, Lightbulb, Home, Brain, Zap, ArrowRight, BookOpen } from 'lucide-react';
import LatexText from './LatexText';

interface QuickPracticeProps {
  quiz: Quiz;
  student: User;
  onExit: () => void;
}

const QuickPractice: React.FC<QuickPracticeProps> = ({ quiz, student, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [memoryTimer, setMemoryTimer] = useState(10); // 10 giây để ghi nhớ

  const currentQuestion = quiz.questions[currentIndex];
  const isCorrect = selectedOption === currentQuestion.correctAnswer;

  // Xử lý đếm ngược ghi nhớ (Memory Mode)
  useEffect(() => {
    if (!isAnswered && showContent) {
      const timer = setInterval(() => {
        setMemoryTimer((prev) => {
          if (prev <= 1) {
            setShowContent(false);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentIndex, isAnswered, showContent]);

  const handleConfirm = () => {
    if (selectedOption) {
      setIsAnswered(true);
      setShowContent(true); // Hiện lại nội dung khi đã trả lời xong để xem lời giải
    }
  };

  const handleNext = () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowContent(true);
      setMemoryTimer(10);
    } else {
      onExit();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col p-4 md:p-6 animate-fade-in">
      {/* Header Progress Bar */}
      <div className="max-w-7xl mx-auto w-full mb-4">
        <div className="bg-white rounded-full h-8 p-1 flex items-center shadow-sm relative overflow-hidden border">
           <div 
             className="h-full bg-blue-500 rounded-full transition-all duration-1000 flex items-center justify-end px-3"
             style={{ width: `${((currentIndex + 1) / quiz.questions.length) * 100}%` }}
           >
             <span className="text-[10px] text-white font-black">{currentIndex + 1}/{quiz.questions.length}</span>
           </div>
           {!isAnswered && showContent && (
             <div className="absolute top-0 right-4 h-full flex items-center gap-2">
                <Brain size={14} className="text-blue-500 animate-pulse"/>
                <span className="text-[10px] font-black text-blue-600 uppercase italic">Ghi nhớ: {memoryTimer}s</span>
             </div>
           )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col lg:flex-row gap-4">
        {/* Left Side: Question Content */}
        <div className="flex-[1.5] bg-white rounded-[2rem] shadow-xl border-4 border-white flex flex-col overflow-hidden relative min-h-[400px]">
          <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-tighter">TN</div>
             </div>
             <h2 className="text-xl font-black italic uppercase text-slate-800 tracking-tighter">{quiz.category || 'LUYỆN TẬP'}</h2>
             <button onClick={() => setShowContent(!showContent)} className="p-2 bg-white rounded-lg border shadow-sm text-blue-500 hover:bg-blue-50 transition-all">
                <Zap size={18}/>
             </button>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center justify-start text-center pt-12">
            {showContent ? (
              <div className="space-y-6 animate-fade-in w-full">
                <div className="text-lg md:text-xl font-medium text-slate-700 leading-tight px-4">
                  <LatexText text={currentQuestion.text} />
                </div>
                {currentQuestion.imageUrl && (
                  <img src={currentQuestion.imageUrl} className="max-h-56 mx-auto rounded-2xl shadow-md border-4 border-white" alt="q" />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 animate-pulse pt-20">
                 <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                    <Brain size={48} />
                 </div>
                 <div className="space-y-2">
                    <h4 className="text-xl font-black uppercase text-slate-400">Nội dung đã bị ẩn!</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Sử dụng trí nhớ của bạn để chọn đáp án.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Response Area */}
        <div className="flex-1 bg-white rounded-[2rem] shadow-xl border-4 border-white flex flex-col p-6 md:p-8 relative">
          {!isAnswered ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Khu vực phản ứng:</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-2xl text-[10px] font-black uppercase hover:bg-yellow-200 transition-all">
                  Trợ giúp <Lightbulb size={14}/>
                </button>
              </div>

              <div className="flex-1 space-y-2">
                <p className="text-[10px] font-black text-slate-300 uppercase italic mb-1">Chọn đáp án đúng:</p>
                {currentQuestion.options?.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(opt)}
                    className={`w-full p-3 rounded-[1.2rem] border-2 text-left flex items-center gap-4 transition-all group ${
                      selectedOption === opt 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-[1.01]' 
                      : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-base shrink-0 ${
                      selectedOption === opt ? 'bg-white/20' : 'bg-slate-50 text-slate-400 border group-hover:bg-blue-50 transition-colors'
                    }`}>
                      {String.fromCharCode(65+i)}
                    </div>
                    <div className="font-bold text-sm"><LatexText text={opt}/></div>
                  </button>
                ))}
              </div>

              <button
                disabled={!selectedOption}
                onClick={handleConfirm}
                className={`mt-6 w-full py-5 rounded-2xl font-black uppercase text-sm italic flex items-center justify-center gap-3 transition-all ${
                  selectedOption 
                  ? 'bg-slate-100 text-slate-500 shadow-inner hover:bg-slate-200 active:scale-95' 
                  : 'bg-slate-50 text-slate-200 cursor-not-allowed'
                }`}
              >
                Xác nhận đáp án <CheckCircle2 size={24} className={selectedOption ? 'text-emerald-500' : ''}/>
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col animate-fade-in-up">
               <div className="flex items-center gap-4 mb-4">
                  {isCorrect ? (
                    <CheckCircle2 size={40} className="text-emerald-500" />
                  ) : (
                    <XCircle size={40} className="text-red-500" />
                  )}
                  <h3 className={`text-3xl font-black italic uppercase ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isCorrect ? 'CHÍNH XÁC!' : 'RẤT TIẾC!'}
                  </h3>
               </div>

               <div className="bg-slate-50 p-4 rounded-[1.5rem] border-2 border-slate-100 mb-4">
                  <p className="font-black text-slate-700 text-sm">
                    {isCorrect ? 'ĐÚNG RỒI! (+1đ)' : `SAI RỒI! (0đ). Đáp án là: ${currentQuestion.correctAnswer}`}
                  </p>
               </div>

               <div className="flex-1 bg-emerald-50/50 p-6 rounded-[1.5rem] border-2 border-emerald-100 relative overflow-hidden group">
                  <div className="absolute top-4 right-6 text-emerald-100 group-hover:text-emerald-200 transition-all"><BookOpen size={40}/></div>
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3 italic">Phân tích chuyên sâu:</h4>
                  <div className="text-slate-600 text-sm italic font-medium leading-relaxed max-h-[220px] overflow-y-auto custom-scrollbar">
                    <LatexText text={currentQuestion.solution || 'Dữ liệu đang được hệ thống AI cập nhật thêm...'} />
                  </div>
               </div>

               <div className="mt-6 flex gap-3">
                  <button onClick={onExit} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 hover:bg-black transition-all">
                     <Home size={14}/> Thoát
                  </button>
                  <button onClick={handleNext} className="flex-[2] py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-xl hover:bg-blue-700 transition-all group">
                     Tiếp tục <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full mt-4 text-center">
         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Hệ thống luyện tập thông minh • EduQuiz PRO</p>
      </div>
    </div>
  );
};

export default QuickPractice;
