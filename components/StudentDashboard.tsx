
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result } from '../types';
import { getQuizzes, getResults, getUsers } from '../services/storage';
import QuizTaker from './QuizTaker';
import ResultDetailModal from './admin/ResultDetailModal';
import { Clock, CheckCircle, Trophy, BookOpen, Eye, FileText, Medal, Download, XCircle, History, ChevronRight } from 'lucide-react';
import { format, isBefore, isAfter } from 'date-fns';
import LatexText from './LatexText';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalSeconds: 0, accumulatedPoints: 0, bonusPoints: 0, effortPoints: 0 });
  const [results, setResults] = useState<Result[]>([]);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  
  // Trạng thái xem chi tiết bài làm
  const [selectedResult, setSelectedResult] = useState<{ result: Result, quiz: Quiz } | null>(null);

  useEffect(() => {
    refreshData();
  }, [user.grade, activeQuiz]);

  const refreshData = async () => {
    const [allQuizzes, allResults] = await Promise.all([getQuizzes(), getResults()]);
    const now = new Date();
    
    const relevantQuizzes = allQuizzes.filter(q => {
        const isCorrectGrade = q.grade === user.grade || q.grade === 'all';
        const isPub = q.isPublished === true;
        return isCorrectGrade && isPub;
    });
    setQuizzes(relevantQuizzes);

    const userResults = allResults.filter(r => 
        r.studentId === user.id || (user.studentCode && r.studentCode === user.studentCode.toUpperCase())
    ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    setResults(userResults);

    // Tính toán thống kê
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
    Object.values(testBestScores).forEach(score => {
        if (score >= 8) bonusPoints += 1;
    });

    setStats({
        totalQuizzes: userResults.length,
        avgScore: userResults.length > 0 ? (userResults.reduce((acc, r) => acc + r.score, 0) / userResults.length) : 0,
        totalSeconds,
        effortPoints,
        bonusPoints,
        accumulatedPoints: effortPoints + bonusPoints
    });
  };

  const getPracticeStats = (quizId: string) => {
      const attempts = results.filter(r => r.quizId === quizId);
      if (attempts.length === 0) return null;
      const scores = attempts.map(r => r.score);
      return { count: attempts.length, max: Math.max(...scores) };
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
      {/* Header & Thống kê */}
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
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Hạng</p>
                <span className="bg-blue-600 text-white px-5 py-2 rounded-full text-xs font-black shadow-lg uppercase tracking-wider">LỚP {user.grade}</span>
            </div>
        </div>
      </header>

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

      {/* Danh sách đề thi */}
      <section className="space-y-12">
          {testQuizzes.length > 0 && (
              <div>
                  <div className="flex items-center gap-4 mb-8">
                      <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Bài kiểm tra định kỳ</h2>
                      <div className="h-px flex-1 bg-red-100"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {testQuizzes.map(q => {
                          const isStarted = !q.startTime || isAfter(now, new Date(q.startTime));
                          const alreadyDone = results.some(r => r.quizId === q.id);
                          return (
                              <div key={q.id} className={`bg-white rounded-[2.5rem] border p-8 flex flex-col transition-all border-b-8 ${alreadyDone ? 'border-emerald-500 opacity-90' : (isStarted ? 'border-red-500 shadow-xl' : 'border-slate-200 opacity-60 grayscale')}`}>
                                  <div className="flex justify-between items-start mb-6">
                                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${alreadyDone ? 'bg-emerald-50 text-emerald-600' : (isStarted ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400')}`}>
                                          {alreadyDone ? 'ĐÃ HOÀN THÀNH' : (isStarted ? 'ĐANG DIỄN RA' : 'CHƯA ĐẾN GIỜ')}
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
                                          <button onClick={() => isStarted ? setActiveQuiz(q) : alert("Chưa đến giờ thi!")} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${isStarted ? 'bg-slate-900 text-white shadow-2xl hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                                              {isStarted ? 'Vào làm bài ngay' : 'Đang chờ giờ'}
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
                    const qStats = getPracticeStats(q.id);
                    return (
                      <div key={q.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all group border-b-8 border-b-slate-50 hover:border-b-blue-600">
                        <div className="flex justify-between items-start mb-6">
                          <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase">{q.questions.length} câu</div>
                          <span className="text-[10px] font-black text-slate-300 uppercase">{q.grade === 'all' ? 'Chung' : `Khối ${q.grade}`}</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-[15px] leading-tight mb-4 group-hover:text-blue-600 uppercase">{q.title}</h3>
                        <div className="bg-slate-50/50 rounded-2xl p-4 grid grid-cols-2 gap-2 mb-8 text-center">
                            <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Đã làm</p><p className="text-sm font-black text-slate-700">{qStats?.count || 0} lần</p></div>
                            <div><p className="text-[8px] font-black text-slate-400 uppercase text-blue-500 mb-1">Max</p><p className="text-sm font-black text-blue-600">{qStats ? qStats.max.toFixed(2) : '-'}</p></div>
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

      {/* Lịch sử làm bài chi tiết */}
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
                          <th className="p-6 text-center">Thời lượng</th>
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
                                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">Loại: {quiz?.type === 'test' ? 'Kiểm tra' : 'Luyện tập'}</span>
                                      </div>
                                  </td>
                                  <td className="p-6 text-center text-xs font-bold text-slate-500">
                                      {format(new Date(r.submittedAt), 'HH:mm dd/MM/yyyy')}
                                  </td>
                                  <td className="p-6 text-center text-xs font-bold text-slate-400">
                                      {Math.floor((r.durationSeconds || 0) / 60)}p {(r.durationSeconds || 0) % 60}s
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
                      {results.length === 0 && (
                          <tr><td colSpan={5} className="p-10 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">Chưa có lịch sử làm bài</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </section>

      {/* Modals */}
      {selectedResult && (
          <ResultDetailModal 
            isOpen={true} 
            result={selectedResult.result} 
            quiz={selectedResult.quiz} 
            onClose={() => setSelectedResult(null)} 
          />
      )}

      {/* Preview Đề thi mượn từ StudentDashboard trước đó */}
      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
              <div className="bg-white rounded-[3.5rem] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border-8 border-white shadow-2xl">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-5">
                          <div className="p-3 bg-blue-600 rounded-2xl"><FileText size={28}/></div>
                          <div>
                              <h3 className="text-lg font-black uppercase tracking-tight leading-tight">{previewQuiz.title}</h3>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">LỚP {previewQuiz.grade} • {previewQuiz.questions.length} CÂU HỎI</p>
                          </div>
                      </div>
                      <button onClick={() => setPreviewQuiz(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><XCircle/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-12 bg-slate-50">
                      <div className="max-w-3xl mx-auto space-y-12 pb-12">
                          {['mcq', 'group-tf', 'short'].map((type) => {
                              const typeQs = previewQuiz.questions.filter(q => q.type === type);
                              if (typeQs.length === 0) return null;
                              return (
                                  <div key={type} className="space-y-8">
                                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-200 pb-2">
                                          {type === 'mcq' ? 'PHẦN I. TRẮC NGHIỆM' : type === 'group-tf' ? 'PHẦN II. ĐÚNG/SAI' : 'PHẦN III. TRẢ LỜI NGẮN'}
                                      </h4>
                                      {typeQs.map((q, idx) => (
                                          <div key={q.id} className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
                                              <div className="text-slate-800 text-lg font-bold mb-6 flex gap-4 leading-relaxed">
                                                  <span className="text-blue-600 shrink-0 font-black italic underline uppercase">Câu {idx + 1}.</span>
                                                  <LatexText text={q.text}/>
                                              </div>
                                              {q.imageUrl && <div className="mb-6 flex justify-center"><img src={q.imageUrl} className="max-h-[350px] mx-auto rounded-xl border" alt="question"/></div>}
                                          </div>
                                      ))}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StudentDashboard;
