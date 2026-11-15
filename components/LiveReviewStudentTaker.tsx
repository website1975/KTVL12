import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Quiz, User, Question, LiveReviewSession, LiveReviewStudentAnswer } from '../types';
import { 
  getLiveReviewSessionById, 
  subscribeToLiveReviewSession, 
  submitLiveReviewAnswer, 
  getStudentAnswerForQuestion,
  checkIsStudentAnswerCorrect,
  resolveQuestionCorrectOption
} from '../services/liveReviewService';
import { getQuizById } from '../services/storage';
import { 
  Clock, CheckCircle2, XCircle, ArrowLeft, ShieldAlert, Sparkles, 
  Lock, Check, AlertCircle, FileText, Lightbulb, Zap, HelpCircle,
  Eye, RefreshCw, Send, Trophy
} from 'lucide-react';
import LatexText from './LatexText';

interface LiveReviewStudentTakerProps {
  session: LiveReviewSession;
  student: User;
  onExit: () => void;
}

export default function LiveReviewStudentTaker({
  session: initialSession,
  student,
  onExit
}: LiveReviewStudentTakerProps) {
  const [session, setSession] = useState<LiveReviewSession>(initialSession);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);

  // Câu trả lời của học sinh theo từng câu hỏi: { [qIndex: number]: any }
  const [myAnswers, setMyAnswers] = useState<Record<number, any>>({});
  const [shortDrafts, setShortDrafts] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Đếm ngược thời gian câu hỏi hiện tại
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const activeQuestionRef = useRef<HTMLDivElement | null>(null);
  const lastActivationByQRef = useRef<Record<number, string | undefined>>({
    [initialSession.currentQuestionIndex ?? 0]: initialSession.activationId
  });

  // 1. Lắng nghe cập nhật phiên trực tiếp từ Giáo viên
  useEffect(() => {
    const unsubscribe = subscribeToLiveReviewSession(initialSession.id, updated => {
      if (updated && updated.status === 'active') {
        setSession(prev => {
          if (
            prev &&
            prev.id === updated.id &&
            prev.currentQuestionIndex === updated.currentQuestionIndex &&
            prev.activationId === updated.activationId &&
            prev.isQuestionLocked === updated.isQuestionLocked &&
            prev.showAnswer === updated.showAnswer &&
            prev.showSolution === updated.showSolution &&
            prev.questionActivatedAt === updated.questionActivatedAt &&
            prev.timeLimitSeconds === updated.timeLimitSeconds &&
            prev.updatedAt === updated.updatedAt
          ) {
            return prev;
          }
          return updated;
        });
      } else {
        // Giáo viên đã kết thúc buổi sửa bài trực tiếp
        onExit();
      }
    }, 1200);

    return () => unsubscribe();
  }, [initialSession.id, onExit]);

  // 2. Tải toàn bộ câu hỏi của đề thi
  useEffect(() => {
    let isMounted = true;
    setIsLoadingQuiz(true);
    getQuizById(session.quizId, true).then(fullQuiz => {
      if (isMounted) {
        setQuiz(fullQuiz);
        setIsLoadingQuiz(false);
      }
    }).catch(err => {
      console.warn("Lỗi tải đề thi sửa bài:", err);
      if (isMounted) setIsLoadingQuiz(false);
    });

    return () => { isMounted = false; };
  }, [session.quizId]);

  // 3. Đồng bộ lượt kích hoạt mới & phục hồi câu trả lời cũ của đúng lượt kích hoạt hiện tại
  useEffect(() => {
    if (!student?.id || !session?.id) return;
    const currentQIdx = session.currentQuestionIndex ?? 0;
    const prevActId = lastActivationByQRef.current[currentQIdx];
    const nextActId = session.activationId;

    if (prevActId !== undefined && prevActId !== nextActId) {
      setMyAnswers(prev => {
        if (prev[currentQIdx] === undefined) return prev;
        const copy = { ...prev };
        delete copy[currentQIdx];
        return copy;
      });
      setShortDrafts(prev => {
        if (prev[currentQIdx] === undefined) return prev;
        const copy = { ...prev };
        delete copy[currentQIdx];
        return copy;
      });
    }
    lastActivationByQRef.current[currentQIdx] = nextActId;

    let isCancelled = false;
    getStudentAnswerForQuestion(session.id, currentQIdx, student.id, nextActId).then(ans => {
      if (isCancelled) return;
      if (ans && ans.answer !== undefined) {
        setMyAnswers(prev => {
          if (prev[currentQIdx] === ans.answer) return prev;
          return { ...prev, [currentQIdx]: ans.answer };
        });
      }
    });

    return () => { isCancelled = true; };
  }, [session.id, session.currentQuestionIndex, session.activationId, student.id]);

  // 4. Tính toán thời gian đếm ngược thời gian thực cho câu hỏi đang active
  useEffect(() => {
    if (!session.questionActivatedAt || session.timeLimitSeconds <= 0 || session.isQuestionLocked) {
      setSecondsLeft(prev => (prev === 0 ? prev : 0));
      return;
    }

    const targetTime = new Date(session.questionActivatedAt).getTime() + session.timeLimitSeconds * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setSecondsLeft(prev => (prev === diff ? prev : diff));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [session.questionActivatedAt, session.timeLimitSeconds, session.isQuestionLocked]);

  // Tự động cuộn đến câu hỏi đang được giáo viên kích hoạt
  useEffect(() => {
    if (activeQuestionRef.current) {
      activeQuestionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [session.currentQuestionIndex]);

  // Kiểm tra câu hỏi hiện tại có đang bị khóa trả lời không
  const isCurrentExpired = useMemo(() => {
    if (session.isQuestionLocked) return true;
    if (session.timeLimitSeconds > 0 && secondsLeft <= 0 && session.questionActivatedAt) {
      const targetTime = new Date(session.questionActivatedAt).getTime() + session.timeLimitSeconds * 1000;
      if (Date.now() >= targetTime) return true;
    }
    return false;
  }, [session.isQuestionLocked, session.timeLimitSeconds, secondsLeft, session.questionActivatedAt]);

  // Xử lý học sinh chọn đáp án
  const handleSelectOption = async (qIdx: number, question: Question, answerValue: any) => {
    if (qIdx !== session.currentQuestionIndex) return;
    if (isCurrentExpired) return;
    if (answerValue === undefined || answerValue === null || String(answerValue).trim() === '') return;

    // Cập nhật state UI ngay lập tức
    setMyAnswers(prev => ({ ...prev, [qIdx]: answerValue }));

    // Tính toán độ chính xác chính xác dựa trên hàm chuẩn hóa
    const isCorrect = checkIsStudentAnswerCorrect(question, answerValue);

    setIsSubmitting(true);
    try {
      await submitLiveReviewAnswer(session.id, qIdx, student, answerValue, isCorrect, question, session.activationId);
    } catch (err) {
      console.warn("Lỗi gửi câu trả lời:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý học sinh chọn Đúng/Sai cho câu chùm
  const handleSelectGroupTF = async (qIdx: number, question: Question, subQuestionId: string, value: 'True' | 'False') => {
    if (qIdx !== session.currentQuestionIndex) return;
    if (isCurrentExpired) return;

    const currentTfAnswers = (myAnswers[qIdx] && typeof myAnswers[qIdx] === 'object') 
      ? { ...myAnswers[qIdx] } 
      : {};

    currentTfAnswers[subQuestionId] = value;
    setMyAnswers(prev => ({ ...prev, [qIdx]: currentTfAnswers }));

    const isCorrect = checkIsStudentAnswerCorrect(question, currentTfAnswers);

    setIsSubmitting(true);
    try {
      await submitLiveReviewAnswer(session.id, qIdx, student, currentTfAnswers, isCorrect, question, session.activationId);
    } catch (err) {
      console.warn("Lỗi gửi câu trả lời TF:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingQuiz || !quiz) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl text-center space-y-4 max-w-md">
          <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="text-white font-black uppercase text-base tracking-wider">
            Đang tải dữ liệu bài sửa trực tiếp...
          </h3>
          <p className="text-slate-400 text-xs font-medium">
            Hệ thống đang đồng bộ câu hỏi & kết nối cùng giáo viên. Vui lòng chờ trong giây lát!
          </p>
        </div>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const currentActiveIdx = session.currentQuestionIndex ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* TOP HEADER THANH ĐIỀU HƯỚNG LIVE                                          */}
      {/* ========================================================================= */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Trái: Nút thoát & Tên đề */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition-all flex items-center gap-1.5 text-xs font-bold"
              title="Rời phòng sửa bài"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Rời phòng</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Trực tiếp cùng Giáo viên
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase hidden md:inline">
                  Lớp: {session.targetClassNames?.join(', ') || 'Chỉ định'}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black uppercase text-white tracking-tight truncate max-w-[280px] sm:max-w-md lg:max-w-xl">
                {quiz.title}
              </h1>
            </div>
          </div>

          {/* Phải: Đồng hồ đếm ngược câu hỏi & Thông tin HS */}
          <div className="flex items-center gap-3">
            {session.timeLimitSeconds > 0 && (
              <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 transition-all ${
                isCurrentExpired 
                  ? 'bg-slate-800 border-slate-700 text-slate-400'
                  : secondsLeft <= 10 
                  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}>
                <Clock size={16} />
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase tracking-wider block opacity-80 leading-none">
                    {isCurrentExpired ? 'Hết giờ' : 'Thời gian câu'}
                  </span>
                  <span className="text-sm font-black font-mono leading-tight">
                    {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs font-bold text-slate-300">
              <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-black">
                {student.fullName ? student.fullName.slice(0, 1).toUpperCase() : 'H'}
              </div>
              <div>
                <span className="block font-black text-white">{student.fullName}</span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">{student.studentCode || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* THÂN BÀI SỬA: DANH SÁCH CÂU HỎI & THANH ĐIỀU HƯỚNG CÂU                   */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* CỘT TRÁI: NỘI DUNG CÁC CÂU HỎI TRONG ĐỀ */}
        <div className="lg:col-span-3 space-y-8">
          {/* Banner thông báo chế độ tương tác đố vui */}
          <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900/60 p-4 rounded-3xl border border-blue-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-lg">
                <Zap size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-blue-300">
                  Phòng Sửa bài & Ôn tập đố vui tương tác
                </h4>
                <p className="text-[11px] text-slate-300 font-medium">
                  Giáo viên điều khiển từng câu hỏi. Khi câu hỏi được kích hoạt, bạn có thời gian quy định để chọn đáp án!
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Đang sửa câu</span>
              <span className="text-lg font-black text-amber-400 font-mono">
                {currentActiveIdx + 1} / {questions.length}
              </span>
            </div>
          </div>

          {/* DANH SÁCH TỪNG CÂU HỎI */}
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const isActive = idx === currentActiveIdx;
              const hasAnswered = myAnswers[idx] !== undefined;
              const myChoice = myAnswers[idx];

              return (
                <div
                  key={q.id || idx}
                  ref={isActive ? activeQuestionRef : null}
                  className={`relative rounded-3xl transition-colors duration-200 overflow-hidden ${
                    isActive
                      ? 'bg-slate-900 border-2 border-blue-500 shadow-2xl ring-4 ring-blue-500/20 p-6 sm:p-8'
                      : 'bg-slate-900/40 border border-slate-800/80 p-5 opacity-40 pointer-events-none select-none'
                  }`}
                >
                  {/* OVERLAY NẾU CÂU HỎI CHƯA ĐƯỢC GIÁO VIÊN ACTIVE */}
                  {!isActive && (
                    <div className="absolute inset-0 bg-slate-950/60 z-10 flex items-center justify-center p-4">
                      <div className="bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-xl">
                        <Lock size={14} className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                          Câu {idx + 1}: Chờ giáo viên kích hoạt
                        </span>
                      </div>
                    </div>
                  )}

                  {/* HEADER CÂU HỎI */}
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        Câu {idx + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        {q.type === 'mcq' ? 'Trắc nghiệm 4 lựa chọn' : q.type === 'group-tf' ? 'Đúng / Sai' : 'Trả lời ngắn'}
                      </span>
                    </div>

                    {/* Trạng thái trả lời của học sinh */}
                    {isActive && (
                      <div className="flex items-center gap-2">
                        {isCurrentExpired ? (
                          <span className="px-3 py-1 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-black uppercase flex items-center gap-1.5">
                            <Lock size={12} /> Đã khóa câu trả lời
                          </span>
                        ) : hasAnswered ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Đã ghi nhận câu trả lời
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black uppercase animate-pulse flex items-center gap-1.5">
                            <Clock size={12} /> Đang mở trả lời...
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* NỘI DUNG ĐỀ CÂU HỎI */}
                  <div className="py-4 text-slate-100 text-sm sm:text-base leading-relaxed">
                    {/* Ngữ cảnh dùng chung nếu có */}
                    {q.context && (
                      <div className="mb-3 p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 text-xs text-slate-300 italic">
                        <LatexText text={q.context} />
                      </div>
                    )}
                    
                    <LatexText text={q.text} />

                    {/* Hình ảnh nếu có */}
                    {q.imageUrl && (
                      <div className="my-4 text-center">
                        <img 
                          src={q.imageUrl} 
                          alt={`Minh họa câu ${idx + 1}`} 
                          className="max-h-72 mx-auto rounded-2xl border border-slate-700 object-contain shadow-lg"
                        />
                      </div>
                    )}
                  </div>

                  {/* KHU VỰC CÁC PHƯƠNG ÁN TRẢ LỜI */}
                  <div className="pt-2">
                    {/* DẠNG 1: TRẮC NGHIỆM 4 LỰA CHỌN (MCQ) */}
                    {q.type === 'mcq' && q.options && (() => {
                      const { index: correctIdx, letter: correctLetter, text: correctText } = resolveQuestionCorrectOption(q);
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, optIdx) => {
                            const optKey = String.fromCharCode(65 + optIdx); // A, B, C, D
                            const isSelected = myChoice === optKey;
                            const isCorrectOpt = (correctIdx >= 0 && optIdx === correctIdx) ||
                              (correctLetter && optKey === correctLetter) ||
                              (correctText && opt.trim().toLowerCase() === correctText.trim().toLowerCase());
                            
                            // Tô màu đáp án khi Giáo viên bật hiện đáp án
                            let optionStyle = 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200';
                            if (isSelected) {
                              optionStyle = 'bg-blue-600/30 border-blue-500 text-white ring-2 ring-blue-500/30';
                            }
                            if (session.showAnswer) {
                              if (isCorrectOpt) {
                                optionStyle = 'bg-emerald-600/30 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/40 font-black';
                              } else if (isSelected && !isCorrectOpt) {
                                optionStyle = 'bg-rose-600/30 border-rose-500 text-rose-200';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={isCurrentExpired}
                                onClick={() => handleSelectOption(idx, q, optKey)}
                                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${optionStyle} ${
                                  isCurrentExpired ? 'cursor-default' : 'cursor-pointer'
                                }`}
                              >
                                <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 uppercase transition-all ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white shadow-md' 
                                    : session.showAnswer && isCorrectOpt
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-300'
                                }`}>
                                  {optKey}
                                </span>
                                <div className="text-xs sm:text-sm font-medium leading-relaxed pt-1 flex-1">
                                  <LatexText text={opt} />
                                </div>
                                {session.showAnswer && isCorrectOpt && (
                                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-1" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* DẠNG 2: ĐÚNG / SAI (GROUP TF) */}
                    {q.type === 'group-tf' && q.subQuestions && (
                      <div className="space-y-3">
                        {q.subQuestions.map((sq, sqIdx) => {
                          const sqLabel = String.fromCharCode(97 + sqIdx); // a, b, c, d
                          const currentTfVal = myChoice && typeof myChoice === 'object' ? myChoice[sq.id] : undefined;
                          
                          return (
                            <div 
                              key={sq.id || sqIdx}
                              className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                            >
                              <div className="text-xs sm:text-sm flex items-start gap-2 flex-1">
                                <span className="font-black text-blue-400 uppercase shrink-0">{sqLabel})</span>
                                <LatexText text={sq.text} />
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <button
                                  type="button"
                                  disabled={isCurrentExpired}
                                  onClick={() => handleSelectGroupTF(idx, q, sq.id, 'True')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all border ${
                                    currentTfVal === 'True'
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  disabled={isCurrentExpired}
                                  onClick={() => handleSelectGroupTF(idx, q, sq.id, 'False')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all border ${
                                    currentTfVal === 'False'
                                      ? 'bg-red-600 text-white border-red-500 shadow-sm'
                                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* DẠNG 3: TRẢ LỜI NGẮN (SHORT) */}
                    {q.type === 'short' && (() => {
                      const draftVal = shortDrafts[idx] ?? (typeof myChoice === 'string' ? myChoice : '');
                      const submitShort = () => {
                        const trimmed = draftVal.trim();
                        if (!trimmed || isCurrentExpired) return;
                        handleSelectOption(idx, q, trimmed);
                      };
                      return (
                        <div className="max-w-md">
                          <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                            Nhập kết quả số của bạn:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              disabled={isCurrentExpired}
                              value={draftVal}
                              onChange={e => setShortDrafts(prev => ({ ...prev, [idx]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  submitShort();
                                }
                              }}
                              onBlur={() => {
                                if (draftVal.trim() && draftVal.trim() !== myChoice) {
                                  submitShort();
                                }
                              }}
                              placeholder="Ví dụ: 2.5 hoặc 10"
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-black text-white outline-none focus:border-blue-500 disabled:opacity-60"
                            />
                            <button
                              type="button"
                              disabled={isCurrentExpired || !draftVal.trim() || isSubmitting}
                              onClick={submitShort}
                              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-1.5 transition cursor-pointer shrink-0"
                            >
                              <Send size={14} />
                              <span>Gửi</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* KHU VỰC HIỆN ĐÁP ÁN ĐÚNG & LỜI GIẢI CHI TIẾT (KHI GIÁO VIÊN BẬT) */}
                  {session.showAnswer && q.correctAnswer && (
                    <div className="mt-6 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 text-xs font-black uppercase">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span>Đáp án chính xác: <span className="text-white text-sm ml-1 font-mono font-black">{String(q.correctAnswer)}</span></span>
                      </div>
                    </div>
                  )}

                  {session.showSolution && (q.solution || (q as any).detailedSolution) && (
                    <div className="mt-4 p-5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase">
                        <Lightbulb size={16} className="text-amber-400" />
                        <span>Lời giải chi tiết từ Giáo viên:</span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans pl-6">
                        <LatexText text={q.solution || (q as any).detailedSolution} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT PHẢI: BẢNG TIẾN ĐỘ & DANH SÁCH CÂU HỎI */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl sticky top-24 space-y-5 shadow-xl">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider">
                Danh sách câu hỏi
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 font-bold">
                Màn hình tự động đồng bộ theo bước sửa bài của Thầy/Cô.
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isActive = idx === currentActiveIdx;
                const isAnswered = myAnswers[idx] !== undefined;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      // Cuộn tới câu
                      const el = document.querySelectorAll('.space-y-6 > div')[idx];
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`aspect-square rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center relative ${
                      isActive
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-lg scale-105'
                        : isAnswered
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700/60 hover:bg-slate-700'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5 animate-ping"></span>
                    )}
                    {isAnswered && !isActive && (
                      <Check size={10} className="text-emerald-400 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* CHÚ THÍCH BIỂU TƯỢNG */}
            <div className="pt-4 border-t border-slate-800 space-y-2 text-[10px] font-bold text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-blue-600"></span>
                <span>Câu đang được kích hoạt đố vui</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-600/30 border border-emerald-500/40"></span>
                <span>Đã ghi nhận câu trả lời của bạn</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-800 border border-slate-700"></span>
                <span>Đang khóa (Chờ GV mở)</span>
              </div>
            </div>

            <button
              onClick={onExit}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase transition-all border border-slate-700"
            >
              Rời phòng đố vui
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
