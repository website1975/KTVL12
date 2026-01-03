
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result } from '../types';
import { getQuizzes, getStudentStats, getResults } from '../services/storage';
import QuizTaker from './QuizTaker';
import { Clock, PlayCircle, CheckCircle, BarChart2, BookOpen, Trophy, History, XCircle, RotateCcw, Eye, FileText, Target, TrendingUp, TrendingDown } from 'lucide-react';
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
  
  // Modal States
  const [historyQuiz, setHistoryQuiz] = useState<{quiz: Quiz, results: Result[]} | null>(null);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);

  useEffect(() => {
    refreshData();
  }, [user.grade, activeQuiz]);

  const refreshData = async () => {
    const allQuizzes = await getQuizzes();
    const relevantQuizzes = allQuizzes.filter(q => q.grade === user.grade && q.isPublished === true);
    setQuizzes(relevantQuizzes);

    const statsData = await getStudentStats(user.id);
    setStats(statsData);

    const allResults = await getResults();
    const userResults = allResults.filter(r => r.studentId === user.id);
    setResults(userResults);
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
  const testQuizzes = quizzes.filter(q => q.type === 'test');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
            <h1 className="text-2xl font-black text-slate-800">Xin chào, {user.fullName} 👋</h1>
            <p className="text-slate-500 font-medium uppercase text-[10px] tracking-widest mt-1">Học sinh lớp {user.grade} • Hệ thống thi trắc nghiệm trực tuyến</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Khối lớp</p>
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black">LỚP {user.grade}</span>
            </div>
        </div>
      </header>

      {/* TỔNG QUAN THÀNH TÍCH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><Trophy size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Điểm Trung Bình</p><h3 className="text-2xl font-black text-slate-800">{stats.avgScore.toFixed(2)}</h3></div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0"><BookOpen size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Đề đã luyện</p><h3 className="text-2xl font-black text-slate-800">{stats.totalQuizzes}</h3></div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><Clock size={28} /></div>
            <div><p className="text-slate-400 text-[10px] font-black uppercase">Thời gian học</p><h3 className="text-2xl font-black text-slate-800">{formatStudyTime(stats.totalSeconds)}</h3></div>
        </div>
      </div>

      {/* DANH SÁCH ĐỀ LUYỆN TẬP */}
      <section>
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2"><CheckCircle className="text-green-500" size={18} /> Kho đề luyện tập miễn phí</h2>
            <div className="h-px flex-1 mx-4 bg-slate-100 hidden md:block"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-3 py-1 rounded-full">{practiceQuizzes.length} đề thi</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {practiceQuizzes.map(q => {
              const qStats = getPracticeStats(q.id);
              return (
                <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col hover:shadow-xl transition-all group relative overflow-hidden border-b-4 border-b-slate-100 hover:border-b-blue-600">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-slate-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs transition-colors group-hover:bg-blue-600 group-hover:text-white">{q.questions.length}</div>
                    <span className="text-[9px] font-black text-slate-300 uppercase">Khối {q.grade}</span>
                  </div>

                  <h3 className="font-black text-slate-800 text-[13px] leading-tight mb-2 group-hover:text-blue-600 min-h-[40px]">{q.title}</h3>
                  
                  {/* DÃY THÔNG SỐ THỐNG KÊ CHI TIẾT */}
                  <div className="bg-slate-50/50 rounded-xl p-3 grid grid-cols-4 gap-1 mb-5">
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase">Lượt làm</p>
                          <p className="text-xs font-black text-slate-700">{qStats?.count || 0}</p>
                      </div>
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-blue-500">Cao nhất</p>
                          <p className="text-xs font-black text-blue-600">{qStats ? qStats.max.toFixed(1) : '-'}</p>
                      </div>
                      <div className="text-center border-r border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-rose-500">Thấp nhất</p>
                          <p className="text-xs font-black text-rose-600">{qStats ? qStats.min.toFixed(1) : '-'}</p>
                      </div>
                      <div className="text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase text-emerald-500">T.Bình</p>
                          <p className="text-xs font-black text-emerald-600">{qStats ? qStats.avg.toFixed(1) : '-'}</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button 
                        onClick={() => setPreviewQuiz(q)}
                        className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                    >
                        <Eye size={14}/> Xem đề
                    </button>
                    <button 
                        onClick={() => setActiveQuiz(q)}
                        className="flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                        {qStats ? 'Luyện lại' : 'Luyện ngay'}
                    </button>
                  </div>
                </div>
              );
          })}
        </div>
      </section>

      {/* MODAL XEM ĐỀ (PREVIEW) */}
      {previewQuiz && (
          <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border-8 border-white">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center"><FileText size={24}/></div>
                        <div>
                            <h3 className="text-lg font-black uppercase leading-tight">{previewQuiz.title}</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Chế độ xem trước • {previewQuiz.questions.length} câu hỏi • {previewQuiz.durationMinutes} phút</p>
                        </div>
                    </div>
                    <button onClick={() => setPreviewQuiz(null)} className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"><XCircle size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-12">
                        {previewQuiz.questions.map((q, i) => (
                            <div key={q.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                                <div className="text-slate-800 text-[15px] font-bold mb-6 leading-relaxed flex items-start gap-3">
                                    <span className="text-blue-600 shrink-0 font-black">Câu {i+1}.</span>
                                    <LatexText text={q.text}/>
                                </div>
                                {q.type === 'mcq' && q.options && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-10">
                                        {q.options.map((opt, oi) => <div key={oi} className="text-sm font-medium text-slate-500"><span className="text-slate-300 mr-2">{String.fromCharCode(65+oi)}.</span> <LatexText text={opt}/></div>)}
                                    </div>
                                )}
                                {q.type === 'group-tf' && q.subQuestions && (
                                    <div className="space-y-3 ml-10">
                                        {q.subQuestions.map((sq, si) => <div key={si} className="text-sm font-medium text-slate-500"><span className="text-slate-300 mr-2">{String.fromCharCode(97+si)})</span> <LatexText text={sq.text}/></div>)}
                                    </div>
                                )}
                                <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase italic">
                                    <Target size={14}/> Thí sinh thực hiện chọn đáp án khi bắt đầu thi
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-6 bg-white border-t flex justify-center">
                    <button onClick={() => { setActiveQuiz(previewQuiz); setPreviewQuiz(null); }} className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 hover:scale-105 transition-transform">Bắt đầu luyện tập ngay</button>
                </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StudentDashboard;
