
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result, PublishedResult } from '../types';
import { getQuizzes, getResults, getPublishedResults } from '../services/storage';
import QuizTaker from './QuizTaker';
import ResultDetailModal from './admin/ResultDetailModal';
import { Clock, Trophy, BookOpen, Eye, Medal, History, ChevronRight, AlertCircle, Sparkles, Star, Award } from 'lucide-react';
import { format, isBefore, isAfter, addMinutes } from 'date-fns';
import LatexText from './LatexText';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalSeconds: 0, accumulatedPoints: 0, bonusPoints: 0, effortPoints: 0 });
  const [results, setResults] = useState<Result[]>([]);
  const [publishedResults, setPublishedResults] = useState<PublishedResult[]>([]);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [selectedResult, setSelectedResult] = useState<{ result: Result, quiz: Quiz } | null>(null);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [user.grade, activeQuiz]);

  const refreshData = async () => {
    const [allQuizzes, allResults, allPubs] = await Promise.all([
        getQuizzes(), 
        getResults(), 
        getPublishedResults()
    ]);
    
    const relevantQuizzes = allQuizzes.filter(q => {
        const isCorrectGrade = q.grade === user.grade || q.grade === 'all';
        return isCorrectGrade && q.isPublished;
    });
    setQuizzes(relevantQuizzes);

    const userResults = allResults.filter(r => 
        r.studentId === user.id || (user.studentCode && r.studentCode === user.studentCode.toUpperCase())
    ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    setResults(userResults);

    // Lấy Bảng Vàng: Chỉ những bản ghi mà mã học sinh nằm trong danh sách được công bố
    const userPubs = allPubs.filter(p => 
        user.studentCode && p.studentCodes.map(c => c.toUpperCase()).includes(user.studentCode.toUpperCase())
    ).sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    setPublishedResults(userPubs);

    const totalSeconds = userResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
    const effortPoints = totalSeconds / 2700; 

    const testBestScores: Record<string, number> = {};
    userResults.forEach(r => {
        const quiz = relevantQuizzes.find(q => q.id === r.quizId);
        if (quiz && quiz.type === 'test') {
            if (!testBestScores[r.quizId] || r.score > testBestScores[r.quizId]) {
                testBestScores[r.quizId] = r.score;
            }
        }
    });
    
    let bonusPoints = 0;
    Object.values(testBestScores).forEach(score => { if (score >= 8) bonusPoints += 1; });

    setStats({
        totalQuizzes: userResults.length,
        avgScore: userResults.length > 0 ? (userResults.reduce((acc, r) => acc + r.score, 0) / userResults.length) : 0,
        totalSeconds,
        effortPoints,
        bonusPoints,
        accumulatedPoints: effortPoints + bonusPoints
    });
  };

  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  };

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={() => setActiveQuiz(null)} />;
  }

  const now = new Date();
  const practiceQuizzes = quizzes.filter(q => q.type === 'practice' && (!q.endTime || isBefore(now, new Date(q.endTime))));
  const testQuizzes = quizzes.filter(q => q.type === 'test');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">Chào mừng, {user.fullName} 👋</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest mt-1">Khối {user.grade} • Mã số: {user.studentCode}</p>
        </div>
        <div className="flex items-center gap-6 relative z-10">
            <div className="flex items-center gap-3 bg-yellow-50 px-6 py-3 rounded-[1.5rem] border border-yellow-100 shadow-sm group">
                <div className="w-10 h-10 bg-yellow-400 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Medal size={24}/></div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-yellow-600 uppercase leading-none mb-1">Tích lũy</p>
                    <span className="text-xl font-black text-yellow-700">{stats.accumulatedPoints.toFixed(2)}</span>
                </div>
            </div>
        </div>
      </header>

      {/* BẢNG VÀNG KẾT QUẢ - ĐÍNH KÈM TRANG TRỌNG */}
      {publishedResults.length > 0 && (
          <section className="animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6 px-4">
                  <Star className="text-yellow-500 fill-yellow-500" size={20}/>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Bảng Vàng Vinh Danh Kết Quả</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {publishedResults.map(pub => {
                      const userResult = pub.results.find(r => r.studentCode?.toUpperCase() === user.studentCode?.toUpperCase());
                      return (
                          <div key={pub.id} className="relative group overflow-hidden bg-slate-900 rounded-[3rem] p-8 shadow-2xl border-4 border-yellow-500/30 hover:border-yellow-500 transition-all">
                              <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:bg-yellow-500/20 transition-all"></div>
                              <div className="relative z-10 space-y-6">
                                  <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 bg-yellow-500 text-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/40">
                                              <Award size={24} />
                                          </div>
                                          <div>
                                              <p className="text-[9px] font-black text-yellow-500 uppercase tracking-[0.2em]">Kỳ thi đã công bố</p>
                                              <h3 className="text-white font-black uppercase text-sm leading-tight line-clamp-1">{pub.quizTitle}</h3>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[8px] font-bold text-slate-500 uppercase">{format(new Date(pub.publishedAt), 'HH:mm dd/MM')}</p>
                                      </div>
                                  </div>

                                  <div className="flex items-center justify-between bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                                      <div>
                                          <p className="text-[9px] font-black text-slate-400 uppercase">Điểm số của bạn</p>
                                          <div className="flex items-baseline gap-2">
                                              <span className="text-4xl font-black text-emerald-400">{userResult?.score.toFixed(2)}</span>
                                              <span className="text-xs text-slate-500 font-bold">/ 10.00</span>
                                          </div>
                                      </div>
                                      <button 
                                          onClick={() => {
                                              const q = quizzes.find(item => item.id === pub.quizId);
                                              if (userResult && q) setSelectedResult({ result: userResult, quiz: q });
                                          }}
                                          className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-slate-900 rounded-xl text-[10px] font-black uppercase hover:bg-white transition-all shadow-lg active:scale-95"
                                      >
                                          <Eye size={16}/> Xem chi tiết
                                      </button>
                                  </div>
                              </div>
                              {/* Hiệu ứng lấp lánh */}
                              <div className="absolute top-4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping opacity-20"></div>
                              <div className="absolute bottom-10 right-1/3 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></div>
                          </div>
                      );
                  })}
              </div>
          </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Trophy size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">ĐTB Chung</p><h3 className="text-2xl font-black text-slate-800">{stats.avgScore.toFixed(2)}</h3></div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0"><BookOpen size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Bài hoàn thành</p><h3 className="text-2xl font-black text-slate-800">{stats.totalQuizzes} bài</h3></div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><Clock size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">TG luyện tập</p><h3 className="text-xl font-black text-slate-800">{formatStudyTime(stats.totalSeconds)}</h3></div>
        </div>
      </div>

      <section className="space-y-12">
          {testQuizzes.length > 0 && (
              <div>
                  <div className="flex items-center gap-4 mb-8">
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Bài kiểm tra định kỳ</h2>
                      <div className="h-px flex-1 bg-red-100"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {testQuizzes.map(q => {
                          const startTime = q.startTime ? new Date(q.startTime) : now;
                          const endTime = addMinutes(startTime, q.durationMinutes);
                          const isStarted = isAfter(now, startTime);
                          const isEnded = isAfter(now, endTime);
                          const alreadyDone = results.some(r => r.quizId === q.id);

                          return (
                              <div key={q.id} className={`bg-white rounded-[2.5rem] border p-8 flex flex-col transition-all border-b-8 ${alreadyDone ? 'border-emerald-500' : (isEnded ? 'border-slate-300 opacity-60' : (isStarted ? 'border-red-500 shadow-xl' : 'border-slate-200 opacity-60 grayscale'))}`}>
                                  <div className="flex justify-between items-start mb-6">
                                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${alreadyDone ? 'bg-emerald-50 text-emerald-600' : (isEnded ? 'bg-slate-100 text-slate-400' : (isStarted ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'))}`}>
                                          {alreadyDone ? 'ĐÃ HOÀN THÀNH' : (isEnded ? 'ĐÃ KẾT THÚC' : (isStarted ? 'ĐANG DIỄN RA' : 'CHƯA ĐẾN GIỜ'))}
                                      </div>
                                      <span className="text-[10px] font-black text-slate-300 uppercase">{q.durationMinutes}p</span>
                                  </div>
                                  <h3 className="font-black text-slate-800 text-[16px] leading-tight mb-4 uppercase">{q.title}</h3>
                                  <div className="mt-auto">
                                      {alreadyDone ? (
                                          <button onClick={() => {
                                              const res = results.find(r => r.quizId === q.id);
                                              if (res) setSelectedResult({ result: res, quiz: q });
                                          }} className="w-full py-4 rounded-2xl border-2 border-slate-100 text-slate-600 font-black uppercase text-[10px] hover:bg-slate-50 flex items-center justify-center gap-2"><Eye size={14}/> Xem kết quả bài làm</button>
                                      ) : (
                                          <button 
                                            disabled={!isStarted || isEnded}
                                            onClick={() => isStarted && !isEnded ? setActiveQuiz(q) : null} 
                                            className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${isStarted && !isEnded ? 'bg-slate-900 text-white shadow-2xl hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                                          >
                                              {isEnded ? 'Đã hết giờ thi' : (isStarted ? 'Vào làm bài ngay' : `Bắt đầu lúc ${format(startTime, 'HH:mm')}`)}
                                          </button>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}

          <div>
              <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Kho đề luyện tập</h2>
                  <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {practiceQuizzes.map(q => {
                    const qStats = (qid: string) => {
                      const attempts = results.filter(r => r.quizId === qid);
                      if (attempts.length === 0) return null;
                      return { count: attempts.length, max: Math.max(...attempts.map(r => r.score)) };
                    };
                    const qs = qStats(q.id);
                    return (
                      <div key={q.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all group border-b-8 border-b-slate-50 hover:border-b-blue-600">
                        <div className="flex justify-between items-start mb-6">
                          <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase">{q.questions.length} câu</div>
                          <span className="text-[10px] font-black text-slate-300 uppercase">{q.grade === 'all' ? 'Chung' : `Khối ${q.grade}`}</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-[15px] leading-tight mb-4 group-hover:text-blue-600 uppercase">{q.title}</h3>
                        <div className="bg-slate-50/50 rounded-2xl p-4 grid grid-cols-2 gap-2 mb-8 text-center">
                            <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Đã làm</p><p className="text-sm font-black text-slate-700">{qs?.count || 0} lần</p></div>
                            <div><p className="text-[8px] font-black text-slate-400 uppercase text-blue-500 mb-1">Max</p><p className="text-sm font-black text-blue-600">{qs ? qs.max.toFixed(2) : '-'}</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-auto">
                          <button onClick={() => setPreviewQuiz(q)} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3.5 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"><Eye size={16}/> Xem đề</button>
                          <button onClick={() => setActiveQuiz(q)} className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all">Vào học</button>
                        </div>
                      </div>
                    );
                })}
              </div>
          </div>
      </section>

      <section className="pt-10">
          <div className="flex items-center gap-4 mb-8">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2"><History size={20} className="text-blue-600"/> Lịch sử làm bài gần đây</h2>
              <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                  <thead>
                      <tr className="bg-slate-50 border-b text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <th className="p-6">Đề thi</th>
                          <th className="p-6 text-center">Thời gian nộp</th>
                          <th className="p-6 text-center">Điểm số</th>
                          <th className="p-6 text-center">Hành động</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y">
                      {results.slice(0, 10).map((r, idx) => {
                          const quiz = quizzes.find(q => q.id === r.quizId);
                          return (
                              <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="p-6">
                                      <div className="flex flex-col">
                                          <span className="font-black text-slate-800 uppercase text-xs leading-tight">{quiz?.title || 'Đề thi đã bị xóa'}</span>
                                      </div>
                                  </td>
                                  <td className="p-6 text-center text-xs font-bold text-slate-500">
                                      {format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}
                                  </td>
                                  <td className="p-6 text-center">
                                      <span className={`text-sm font-black ${r.score >= 8 ? 'text-emerald-600' : r.score >= 5 ? 'text-blue-600' : 'text-orange-600'}`}>
                                          {r.score.toFixed(2)}
                                      </span>
                                  </td>
                                  <td className="p-6 text-center">
                                      <button 
                                        onClick={() => quiz && setSelectedResult({ result: r, quiz: quiz })}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                      >
                                          Xem lại <ChevronRight size={14}/>
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </section>

      {selectedResult && (
          <ResultDetailModal 
            isOpen={true} 
            result={selectedResult.result} 
            quiz={selectedResult.quiz} 
            onClose={() => setSelectedResult(null)} 
          />
      )}
    </div>
  );
};

export default StudentDashboard;
