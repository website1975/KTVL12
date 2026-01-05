
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result } from '../types';
import { getQuizzes, getStudentStats, getResults, getUsers } from '../services/storage';
import QuizTaker from './QuizTaker';
import { Clock, PlayCircle, CheckCircle, BarChart2, BookOpen, Trophy, History, XCircle, RotateCcw, Eye, FileText, Target, TrendingUp, TrendingDown, Medal, Sparkles } from 'lucide-react';
import { format, parseISO, isBefore, isAfter, addMinutes } from 'date-fns';
import LatexText from './LatexText';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalSeconds: 0 });
  const [results, setResults] = useState<Result[]>([]);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    refreshData();
  }, [user.grade, activeQuiz]);

  const refreshData = async () => {
    const allQuizzes = await getQuizzes();
    const now = new Date();
    
    const relevantQuizzes = allQuizzes.filter(q => {
        const isCorrectGrade = q.grade === user.grade;
        const isPub = q.isPublished === true;
        
        // Đề luyện tập chỉ hiện khi chưa quá hạn endTime
        let notExpired = true;
        if (q.type === 'practice' && q.endTime) {
            try {
                notExpired = isBefore(now, parseISO(q.endTime));
            } catch (e) {
                notExpired = true;
            }
        }
        
        return isCorrectGrade && isPub && notExpired;
    });
    setQuizzes(relevantQuizzes);

    const statsData = await getStudentStats(user.id);
    setStats(statsData);

    const allResults = await getResults();
    const userResults = allResults.filter(r => r.studentId === user.id);
    setResults(userResults);

    const allUsers = await getUsers();
    const me = allUsers.find(u => u.id === user.id);
    if (me) setCurrentUserData(me);
  };

  const getPracticeStats = (quizId: string) => {
      const attempts = results.filter(r => r.quizId === quizId);
      if (attempts.length === 0) return null;
      const scores = attempts.map(r => r.score);
      return { 
          count: attempts.length, 
          max: Math.max(...scores),
          min: Math.min(...scores),
          avg: scores.reduce((a, b) => a + b, 0) / attempts.length
      };
  };

  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={() => setActiveQuiz(null)} />;
  }

  const practiceQuizzes = quizzes.filter(q => q.type === 'practice');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10">
            <h1 className="text-2xl font-black text-slate-800">Xin chào, {user.fullName} 👋</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest mt-1">Học sinh lớp {user.grade} • Hệ thống thi trực tuyến</p>
        </div>
        <div className="flex items-center gap-6 relative z-10">
            <div className="flex items-center gap-3 bg-yellow-50 px-6 py-3 rounded-[1.5rem] border border-yellow-100 shadow-sm animate-pulse">
                <div className="w-10 h-10 bg-yellow-400 text-white rounded-2xl flex items-center justify-center shadow-lg"><Medal size={24}/></div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-yellow-600 uppercase leading-none mb-1">Điểm tích lũy</p>
                    <span className="text-xl font-black text-yellow-700">{currentUserData?.points || 0}</span>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Khối lớp</p>
                <span className="bg-blue-600 text-white px-5 py-2 rounded-full text-xs font-black shadow-lg uppercase">LỚP {user.grade}</span>
            </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Trophy size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Điểm Trung Bình</p><h3 className="text-2xl font-black text-slate-800">{stats.avgScore.toFixed(2)}</h3></div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0"><BookOpen size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Đề đã luyện</p><h3 className="text-2xl font-black text-slate-800">{stats.totalQuizzes}</h3></div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><Clock size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Thời gian học</p><h3 className="text-2xl font-black text-slate-800">{formatStudyTime(stats.totalSeconds)}</h3></div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><CheckCircle className="text-green-500" size={18} /> Kho đề luyện tập miễn phí</h2>
            <div className="h-px flex-1 mx-6 bg-slate-100 hidden md:block"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-5 py-2 rounded-full tracking-widest">{practiceQuizzes.length} đề thi sẵn có</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {practiceQuizzes.map(q => {
              const qStats = getPracticeStats(q.id);
              return (
                <div key={q.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden border-b-8 border-b-slate-50 hover:border-b-blue-600">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-slate-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-sm transition-colors group-hover:bg-blue-600 group-hover:text-white shadow-inner">{q.questions.length}</div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">Khối {q.grade}</span>
                  </div>

                  <h3 className="font-black text-slate-800 text-[15px] leading-tight mb-4 group-hover:text-blue-600 min-h-[44px]">{q.title}</h3>
                  
                  {q.endTime && (
                      <div className="mb-4 text-[9px] font-black text-red-500 flex items-center gap-2 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full w-fit">
                          <Clock size={12}/> Hạn chót: {format(parseISO(q.endTime), 'HH:mm dd/MM')}
                      </div>
                  )}

                  <div className="bg-slate-50/50 rounded-2xl p-4 grid grid-cols-4 gap-2 mb-8">
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Lượt làm</p>
                          <p className="text-xs font-black text-slate-700">{qStats?.count || 0}</p>
                      </div>
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-blue-500 mb-1">Cao nhất</p>
                          <p className="text-xs font-black text-blue-600">{qStats ? qStats.max.toFixed(1) : '-'}</p>
                      </div>
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-rose-500 mb-1">Thấp</p>
                          <p className="text-xs font-black text-rose-600">{qStats ? qStats.min.toFixed(1) : '-'}</p>
                      </div>
                      <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-emerald-500 mb-1">T.Bình</p>
                          <p className="text-xs font-black text-emerald-600">{qStats ? qStats.avg.toFixed(1) : '-'}</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button 
                        onClick={() => setPreviewQuiz(q)}
                        className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3.5 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                    >
                        <Eye size={16}/> Xem đề
                    </button>
                    <button 
                        onClick={() => setActiveQuiz(q)}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all"
                    >
                        Luyện ngay
                    </button>
                  </div>
                </div>
              );
          })}
        </div>
      </section>

      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20"><FileText size={28}/></div>
                        <div>
                            <h3 className="text-lg font-black uppercase leading-tight tracking-tight">{previewQuiz.title}</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">Chế độ xem trước • {previewQuiz.questions.length} câu hỏi</p>
                        </div>
                    </div>
                    <button onClick={() => setPreviewQuiz(null)} className="p-4 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><XCircle size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-12 pb-12">
                        {previewQuiz.questions.map((q, i) => (
                            <div key={q.id} className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-100">
                                <div className="text-slate-800 text-[16px] font-bold mb-6 leading-relaxed flex items-start gap-4">
                                    <span className="text-blue-600 shrink-0 font-black italic underline">Câu {i+1}.</span>
                                    <LatexText text={q.text}/>
                                </div>
                                <div className="mt-8 pt-8 border-t border-slate-50 flex items-center gap-3 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    <Target size={18} className="text-slate-200"/> Thí sinh thực hiện chọn đáp án khi bắt đầu thi
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-8 bg-white border-t flex justify-center shadow-2xl relative z-10">
                    <button onClick={() => { setActiveQuiz(previewQuiz); setPreviewQuiz(null); }} className="px-16 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all">Bắt đầu làm bài thi ngay</button>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StudentDashboard;
