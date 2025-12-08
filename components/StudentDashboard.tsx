
import React, { useState, useEffect } from 'react';
import { User, Quiz, Result } from '../types';
import { getQuizzes, getStudentStats, getResults } from '../services/storage';
import QuizTaker from './QuizTaker';
import { Clock, PlayCircle, CheckCircle, BarChart2, BookOpen, Trophy, History, XCircle, RotateCcw, Eye } from 'lucide-react';
import { format, parseISO, isBefore, isAfter, addMinutes } from 'date-fns';

interface StudentDashboardProps {
  user: User;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, totalSeconds: 0 });
  const [results, setResults] = useState<Result[]>([]);
  
  // History Modal State
  const [historyQuiz, setHistoryQuiz] = useState<{quiz: Quiz, results: Result[]} | null>(null);

  useEffect(() => {
    refreshData();
  }, [user.grade, activeQuiz]); // Refresh when activeQuiz closes

  const refreshData = async () => {
    // Filter quizzes by user grade AND published status
    const allQuizzes = await getQuizzes();
    const relevantQuizzes = allQuizzes.filter(q => q.grade === user.grade && q.isPublished === true);
    setQuizzes(relevantQuizzes);

    // Get stats
    const statsData = await getStudentStats(user.id);
    setStats(statsData);

    // Get results for calculations
    const allResults = await getResults();
    const userResults = allResults.filter(r => r.studentId === user.id);
    setResults(userResults);
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
  };
  
  const handleViewHistory = (quiz: Quiz) => {
    // Filter from local results
    const quizResults = results
      .filter(r => r.quizId === quiz.id)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    setHistoryQuiz({ quiz, results: quizResults });
  };

  // Convert seconds to readable string (e.g. 2h 30m)
  const formatStudyTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  };

  const formatDurationSimple = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}p ${s}s`;
  }

  if (activeQuiz) {
    return <QuizTaker quiz={activeQuiz} student={user} onExit={() => setActiveQuiz(null)} />;
  }

  // Split quizzes
  const practiceQuizzes = quizzes.filter(q => q.type === 'practice');
  const testQuizzes = quizzes.filter(q => q.type === 'test');
  
  // Helper to get stats for a specific practice quiz
  const getPracticeStats = (quizId: string) => {
      const attempts = results.filter(r => r.quizId === quizId);
      if (attempts.length === 0) return null;
      
      const maxScore = Math.max(...attempts.map(r => r.score));
      return { count: attempts.length, maxScore };
  };

  // Helper to get result for a specific test quiz (Testing only happens once usually, but get latest)
  const getTestResult = (quizId: string) => {
      const attempts = results.filter(r => r.quizId === quizId).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      return attempts.length > 0 ? attempts[0] : null;
  }

  const getTestStatus = (quiz: Quiz) => {
    const now = new Date();
    const start = parseISO(quiz.startTime!);
    const end = addMinutes(start, quiz.durationMinutes);
    const taken = results.some(r => r.quizId === quiz.id);

    if (taken) return { status: 'completed', label: 'Đã Thi', color: 'text-green-600 bg-green-100' };
    if (isBefore(now, start)) return { status: 'upcoming', label: 'Chưa mở', color: 'text-yellow-600 bg-yellow-100' };
    if (isAfter(now, end)) return { status: 'closed', label: 'Đã đóng', color: 'text-red-600 bg-red-100' };
    return { status: 'open', label: 'Vào Thi', color: 'text-blue-600 bg-blue-100' };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Xin chào, {user.fullName}</h1>
        <p className="text-gray-500">Học sinh lớp {user.grade}</p>
      </header>

      {/* STATS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
            <div>
                <p className="text-blue-100 font-medium mb-1">Điểm Trung Bình</p>
                <h3 className="text-4xl font-bold">{stats.avgScore.toFixed(2)}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
                <Trophy size={32} />
            </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
            <div>
                <p className="text-purple-100 font-medium mb-1">Số Đề Đã Làm</p>
                <h3 className="text-4xl font-bold">{stats.totalQuizzes}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
                <BookOpen size={32} />
            </div>
        </div>
        <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
            <div>
                <p className="text-orange-100 font-medium mb-1">Thời Gian Luyện Tập</p>
                <h3 className="text-3xl font-bold">{formatStudyTime(stats.totalSeconds)}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
                <Clock size={32} />
            </div>
        </div>
      </div>

      {/* Tests Section */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 className="text-red-500" /> Bài Kiểm Tra
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testQuizzes.length === 0 ? (
             <div className="col-span-full bg-white p-6 rounded-xl text-center text-gray-400 border border-dashed">Hiện tại không có bài kiểm tra nào.</div>
          ) : (
            testQuizzes.map(q => {
              const info = getTestStatus(q);
              const result = getTestResult(q.id);

              return (
                <div key={q.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full relative overflow-hidden">
                  {result && (
                      <div className="absolute top-0 right-0 p-2 z-10">
                          <div className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-green-200">
                              <Trophy size={12}/> Điểm: {result.score.toFixed(2)}
                          </div>
                      </div>
                  )}

                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg pr-16">{q.title}</h3>
                    {!result && (
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${info.color}`}>
                        {info.label}
                        </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{q.description}</p>
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <p className="flex items-center gap-2"><Clock size={14}/> {format(parseISO(q.startTime!), "HH:mm dd/MM/yyyy")}</p>
                    <p className="flex items-center gap-2"><PlayCircle size={14}/> {q.durationMinutes} phút</p>
                  </div>
                  
                  {info.status === 'completed' ? (
                       <button 
                        onClick={() => handleViewHistory(q)}
                        className="w-full py-2 rounded-lg font-medium transition bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                      >
                        <Eye size={16}/> Xem Chi Tiết
                      </button>
                  ) : (
                      <button 
                        onClick={() => handleStartQuiz(q)}
                        disabled={info.status !== 'open'}
                        className={`w-full py-2 rounded-lg font-medium transition ${
                          info.status === 'open' 
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 shadow-md' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {info.status === 'open' ? 'Bắt Đầu Làm Bài' : info.label}
                      </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Practice Section */}
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle className="text-green-500" /> Luyện Tập
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {practiceQuizzes.length === 0 ? (
             <div className="col-span-full bg-white p-6 rounded-xl text-center text-gray-400 border border-dashed">Chưa có đề luyện tập.</div>
          ) : (
            practiceQuizzes.map(q => {
              const quizStats = getPracticeStats(q.id);
              const hasTaken = !!quizStats;

              return (
                <div key={q.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col h-full relative overflow-hidden">
                  {/* Stats Overlay if taken */}
                  {hasTaken && (
                      <div className="absolute top-0 right-0 p-2">
                          <div className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <Trophy size={12}/> Điểm cao: {quizStats.maxScore.toFixed(2)}
                          </div>
                      </div>
                  )}

                  <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-2 pr-12">{q.title}</h3>
                      <div className="text-xs text-gray-500 mb-3 space-x-2">
                         <span className="bg-gray-100 px-2 py-1 rounded">{q.questions.length} câu</span>
                         <span className="bg-gray-100 px-2 py-1 rounded">{q.durationMinutes} phút</span>
                      </div>
                      
                      {hasTaken ? (
                          <div className="text-sm text-gray-600 mb-4 bg-blue-50 p-2 rounded border border-blue-100">
                             Số lần đã làm: <span className="font-bold">{quizStats.count}</span>
                          </div>
                      ) : (
                          <p className="text-sm text-gray-400 italic mb-4">Chưa làm bài lần nào.</p>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {hasTaken ? (
                         <>
                            <button 
                                onClick={() => handleViewHistory(q)}
                                className="border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1"
                            >
                                <History size={16}/> Lịch sử
                            </button>
                            <button 
                                onClick={() => handleStartQuiz(q)}
                                className="bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1 shadow-md"
                            >
                                <RotateCcw size={16}/> Làm lại
                            </button>
                         </>
                    ) : (
                        <button 
                            onClick={() => handleStartQuiz(q)}
                            className="col-span-2 border border-green-600 text-green-600 hover:bg-green-50 py-2 rounded-lg font-medium"
                        >
                            Luyện Ngay
                        </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* History Modal */}
      {historyQuiz && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-lg">Lịch sử làm bài</h3>
                        <p className="text-sm text-gray-500">{historyQuiz.quiz.title}</p>
                    </div>
                    <button onClick={() => setHistoryQuiz(null)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-2"><XCircle size={24}/></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                    {historyQuiz.results.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Chưa có dữ liệu.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-4 border-b">Lần thi</th>
                                    <th className="p-4 border-b">Ngày giờ</th>
                                    <th className="p-4 border-b">Thời gian</th>
                                    <th className="p-4 border-b text-right">Điểm số</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyQuiz.results.map((r, idx) => (
                                    <tr key={r.id} className="border-b last:border-0 hover:bg-blue-50 transition">
                                        <td className="p-4 font-medium text-gray-500">#{historyQuiz.results.length - idx}</td>
                                        <td className="p-4 text-sm">
                                            <div className="font-medium text-gray-800">{format(parseISO(r.submittedAt), "dd/MM/yyyy")}</div>
                                            <div className="text-xs text-gray-500">{format(parseISO(r.submittedAt), "HH:mm")}</div>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-gray-600">
                                            {formatDurationSimple(r.durationSeconds || 0)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`font-bold text-lg ${r.score >= 5 ? 'text-green-600' : 'text-red-500'}`}>
                                                {r.score.toFixed(2)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-4 bg-gray-50 text-center border-t">
                    <button onClick={() => setHistoryQuiz(null)} className="text-sm font-bold text-gray-600 hover:text-gray-900">Đóng</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
