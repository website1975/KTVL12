
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result } from '../types';
import { getQuizzes, getStudentStats, getResults, getUsers } from '../services/storage';
import QuizTaker from './QuizTaker';
import { Clock, CheckCircle, Trophy, BookOpen, Eye, FileText, Target, Medal, Download, XCircle, Calendar, ShieldAlert } from 'lucide-react';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import LatexText from './LatexText';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalSeconds: 0, accumulatedPoints: 0, bonusPoints: 0, effortPoints: 0 });
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
        const isCorrectGrade = q.grade === user.grade || q.grade === 'all';
        const isPub = q.isPublished === true;
        return isCorrectGrade && isPub;
    });
    setQuizzes(relevantQuizzes);

    const allResults = await getResults();
    const userResults = allResults.filter(r => 
        r.studentId === user.id || (user.studentCode && r.studentCode === user.studentCode.toUpperCase())
    );
    setResults(userResults);

    // LOGIC TÍNH ĐIỂM TÍCH LŨY CHUẨN (CÔNG BẰNG)
    const totalSeconds = userResults.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);
    const effortPoints = totalSeconds / 2700; // 45p = 1đ

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
          max: Math.max(...scores)
      };
  };

  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  const exportToDoc = (quiz: Quiz) => {
    let content = `<html><head><meta charset="utf-8"><style>
      img { display: block; margin: 15px auto; max-width: 500px; height: auto; border: 1px solid #ddd; }
      body { font-family: 'Times New Roman', serif; line-height: 1.6; }
      h1, h2, h3 { text-align: center; }
      .question { margin-top: 20px; font-weight: bold; }
      .options { margin-left: 30px; }
    </style></head><body>`;
    content += `<h1>${quiz.title}</h1>`;
    content += `<h3>Khối: ${quiz.grade} | Thời gian: ${quiz.durationMinutes} phút</h3><hr/>`;
    
    const parts = [
        { title: 'PHẦN I. Câu trắc nghiệm nhiều lựa chọn', type: 'mcq' },
        { title: 'PHẦN II. Câu trắc nghiệm Đúng/Sai', type: 'group-tf' },
        { title: 'PHẦN III. Câu trắc nghiệm Trả lời ngắn', type: 'short' }
    ];

    parts.forEach(part => {
        const partQs = quiz.questions.filter(q => q.type === part.type);
        if (partQs.length > 0) {
            content += `<h2>${part.title}</h2>`;
            partQs.forEach((q, idx) => {
                content += `<div class="question">Câu ${idx + 1}. ${q.text}</div>`;
                if (q.imageUrl) content += `<p style="text-align:center"><img src="${q.imageUrl}" width="400" /></p>`;
            });
        }
    });

    content += `</body></html>`;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${quiz.title}.doc`;
    link.click();
  };

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={() => setActiveQuiz(null)} />;
  }

  const now = new Date();
  const practiceQuizzes = quizzes.filter(q => q.type === 'practice' && (!q.endTime || isBefore(now, parseISO(q.endTime))));
  const testQuizzes = quizzes.filter(q => q.type === 'test');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">
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
                    <div className="absolute top-full right-0 mt-2 bg-slate-900 text-white text-[8px] p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-xl uppercase font-black tracking-widest pointer-events-none">
                        {stats.effortPoints.toFixed(2)}đ nỗ lực (45p=1đ) + {stats.bonusPoints}đ thưởng (KT >= 8)
                    </div>
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

      <section className="animate-fade-in">
          {testQuizzes.length > 0 && (
              <div className="mb-12">
                  <div className="flex items-center justify-between mb-8">
                      <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2 tracking-tight"><ShieldAlert className="text-red-500" size={18} /> Bài kiểm tra định kỳ</h2>
                      <div className="h-px flex-1 mx-6 bg-red-100 hidden md:block"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {testQuizzes.map(q => {
                          const isStarted = !q.startTime || isAfter(now, parseISO(q.startTime));
                          const alreadyDone = results.some(r => r.quizId === q.id);
                          return (
                              <div key={q.id} className={`bg-white rounded-[2.5rem] border p-8 flex flex-col transition-all relative overflow-hidden border-b-8 ${alreadyDone ? 'border-emerald-500 opacity-90' : (isStarted ? 'border-red-500 shadow-xl' : 'border-slate-200 opacity-60 grayscale')}`}>
                                  <div className="flex justify-between items-start mb-6">
                                      <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-sm ${alreadyDone ? 'bg-emerald-500 text-white' : (isStarted ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400')}`}>
                                          {alreadyDone ? 'ĐÃ HOÀN THÀNH' : (isStarted ? 'ĐANG DIỄN RA' : 'CHƯA ĐẾN GIỜ')}
                                      </div>
                                      <span className="text-[10px] font-black text-slate-300 uppercase italic">{q.durationMinutes}p</span>
                                  </div>
                                  <h3 className="font-black text-slate-800 text-[16px] leading-tight mb-4 min-h-[44px] uppercase">{q.title}</h3>
                                  <div className="mt-auto space-y-4">
                                      {alreadyDone ? (
                                          <>
                                              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 text-center text-[10px] font-black uppercase">Bạn đã nộp bài thành công.</div>
                                              <button onClick={() => setPreviewQuiz(q)} className="w-full py-4 rounded-2xl border-2 border-slate-100 text-slate-400 font-black uppercase text-[10px] hover:bg-slate-50 flex items-center justify-center gap-2"><Eye size={14}/> Xem lại đề</button>
                                          </>
                                      ) : (
                                          <button onClick={() => isStarted ? setActiveQuiz(q) : alert("Chưa đến giờ thi!")} className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] transition-all ${isStarted ? 'bg-slate-900 text-white shadow-2xl hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                                              {isStarted ? 'Vào làm bài ngay' : 'Đang chờ giờ mở đề'}
                                          </button>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}

          <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2 tracking-tight"><CheckCircle className="text-green-500" size={18} /> Kho đề luyện tập</h2>
              <div className="h-px flex-1 mx-6 bg-slate-100 hidden md:block"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {practiceQuizzes.map(q => {
                const qStats = getPracticeStats(q.id);
                return (
                  <div key={q.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden border-b-8 border-b-slate-50 hover:border-b-blue-600">
                    <div className="flex justify-between items-start mb-6">
                      <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl flex items-center gap-1.5 font-black text-[10px] uppercase shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <FileText size={12}/> {q.questions.length} câu
                      </div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                        {q.grade === 'all' ? 'Chung' : `Khối ${q.grade}`}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-800 text-[15px] leading-tight mb-4 group-hover:text-blue-600 min-h-[44px] uppercase">{q.title}</h3>
                    {q.endTime && (
                        <div className="mb-4 text-[9px] font-black text-red-500 flex items-center gap-2 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full w-fit">
                            <Clock size={12}/> Hạn chót: {format(parseISO(q.endTime), 'HH:mm dd/MM')}
                        </div>
                    )}
                    <div className="bg-slate-50/50 rounded-2xl p-4 grid grid-cols-2 gap-2 mb-8 text-center">
                        <div className="border-r border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Đã làm</p>
                            <p className="text-sm font-black text-slate-700">{qStats?.count || 0} lần</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase text-blue-500 mb-1">Max</p>
                            <p className="text-sm font-black text-blue-600">{qStats ? qStats.max.toFixed(2) : '-'}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <button onClick={() => setPreviewQuiz(q)} className="flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-3.5 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"><Eye size={16}/> Xem đề</button>
                      <button onClick={() => setActiveQuiz(q)} className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-700 transition-all">Vào học</button>
                    </div>
                  </div>
                );
            })}
          </div>
      </section>
      
      {/* Modals keep same as before */}
    </div>
  );
};

export default StudentDashboard;
