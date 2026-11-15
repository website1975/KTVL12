import React, { useState, useMemo } from 'react';
import { Question, LiveReviewStudentAnswer } from '../../types';
import { resolveQuestionCorrectOption, checkIsStudentAnswerCorrect, hasNonEmptyLiveAnswer } from '../../services/liveReviewService';
import { 
  BarChart2, X, CheckCircle2, XCircle, Users, Clock, Award, 
  HelpCircle, Eye, EyeOff, Search, FileText, Check, RotateCcw
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

export interface ChartItem {
  name: string;
  option: string;
  count: number;
  percent: number;
  isCorrect: boolean;
  fill: string;
  trueCount?: number;
  falseCount?: number;
  correct?: string;
}

export interface LiveReviewStatsModalProps {
  question?: Question | null;
  currentQuestion?: Question | null;
  questionIndex?: number;
  currentQuestionIndex?: number;
  answers?: LiveReviewStudentAnswer[];
  studentAnswers?: LiveReviewStudentAnswer[];
  session?: any;
  allStudents?: any[];
  isOpen?: boolean;
  showAnswer?: boolean;
  showSolution?: boolean;
  isQuestionLocked?: boolean;
  onToggleAnswer?: (show: boolean) => void;
  onToggleShowAnswer?: (show: boolean) => void;
  onToggleSolution?: (show: boolean) => void;
  onToggleShowSolution?: (show: boolean) => void;
  onLockQuestion?: () => void;
  onResetAnswers?: () => void;
  onClose: () => void;
}

export default function LiveReviewStatsModal({
  question: propQuestion,
  currentQuestion,
  questionIndex: propQuestionIndex,
  currentQuestionIndex,
  answers: propAnswers,
  studentAnswers,
  session,
  allStudents = [],
  isOpen = true,
  showAnswer: propShowAnswer,
  showSolution: propShowSolution,
  isQuestionLocked: propIsQuestionLocked,
  onToggleAnswer,
  onToggleShowAnswer,
  onToggleSolution,
  onToggleShowSolution,
  onLockQuestion,
  onResetAnswers,
  onClose
}: LiveReviewStatsModalProps) {
  const [searchStudent, setSearchStudent] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'list'>('chart');
  const [confirmReset, setConfirmReset] = useState(false);

  const question = currentQuestion || propQuestion || null;
  const questionIndex = currentQuestionIndex !== undefined ? currentQuestionIndex : (propQuestionIndex || 0);
  const rawAnswers = studentAnswers || propAnswers || [];
  const answers = useMemo(
    () => rawAnswers.filter(a => a && hasNonEmptyLiveAnswer(a.answer)),
    [rawAnswers]
  );
  const showAnswer = propShowAnswer ?? (session?.showAnswer || false);
  const showSolution = propShowSolution ?? (session?.showSolution || false);
  const isQuestionLocked = propIsQuestionLocked ?? (session?.isQuestionLocked || false);
  const handleToggleAnswer = onToggleShowAnswer || onToggleAnswer || (() => {});
  const handleToggleSolution = onToggleShowSolution || onToggleSolution || (() => {});

  const totalResponses = answers.length;

  const targetClassCount = useMemo(() => {
    if (!Array.isArray(allStudents) || allStudents.length === 0) return 0;
    const targetIds = Array.isArray(session?.targetClassIds) ? session.targetClassIds : [];
    const targetNames = Array.isArray(session?.targetClassNames)
      ? session.targetClassNames.map((n: string) => String(n || '').trim().toUpperCase())
      : [];
    if (
      targetIds.includes('all') ||
      targetNames.includes('TẤT CẢ CÁC LỚP') ||
      (targetIds.length === 0 && targetNames.length === 0)
    ) {
      return allStudents.length;
    }
    return allStudents.filter((st: any) => {
      const matchId = st.classId && targetIds.includes(st.classId);
      const matchName = st.className && targetNames.includes(String(st.className).trim().toUpperCase());
      return matchId || matchName;
    }).length;
  }, [allStudents, session?.targetClassIds, session?.targetClassNames]);

  // Tính toán dữ liệu thống kê cho câu hỏi trắc nghiệm A, B, C, D (hoặc Đúng/Sai / Trả lời ngắn)
  const chartData: ChartItem[] = useMemo(() => {
    if (!question) return [];

    if (question.type === 'mcq') {
      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
      const { index: correctIdx, letter: correctLetter, text: correctText } = resolveQuestionCorrectOption(question);

      answers.forEach(a => {
        let val = String(a.answer || '').trim().toUpperCase();
        if (['0', '1', '2', '3'].includes(val)) {
          val = String.fromCharCode(65 + parseInt(val, 10));
        } else if (!['A', 'B', 'C', 'D'].includes(val) && question.options) {
          const matchIdx = question.options.findIndex(opt => opt.trim().toLowerCase() === String(a.answer || '').trim().toLowerCase());
          if (matchIdx >= 0 && matchIdx < 4) {
            val = String.fromCharCode(65 + matchIdx);
          }
        }

        if (counts[val] !== undefined) {
          counts[val]++;
        }
      });

      return ['A', 'B', 'C', 'D'].map((key, keyIdx) => {
        const count = counts[key] || 0;
        const percent = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
        const isCorrect = (correctLetter && key === correctLetter) || (correctIdx >= 0 && keyIdx === correctIdx);
        return {
          name: `Đáp án ${key}`,
          option: key,
          count,
          percent,
          isCorrect,
          fill: isCorrect ? '#10b981' : '#3b82f6'
        };
      });
    }

    if (question.type === 'group-tf' && question.subQuestions) {
      // Nhóm đúng sai
      return question.subQuestions.map((sq, idx) => {
        const label = String.fromCharCode(97 + idx); // a, b, c, d
        let trueCount = 0;
        let falseCount = 0;
        answers.forEach(a => {
          if (a.answer && typeof a.answer === 'object') {
            const chosen = a.answer[sq.id];
            if (chosen === 'True' || chosen === true) trueCount++;
            else if (chosen === 'False' || chosen === false) falseCount++;
          }
        });
        const count = trueCount + falseCount;
        const percent = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
        return {
          name: `Ý ${label})`,
          option: label,
          count,
          percent,
          isCorrect: true,
          fill: '#3b82f6',
          trueCount,
          falseCount,
          correct: sq.correctAnswer
        };
      });
    }

    // Câu trả lời ngắn: Gom nhóm theo giá trị điền
    const shortCounts: Record<string, number> = {};
    answers.forEach(a => {
      const val = String(a.answer || '').trim();
      if (val) {
        shortCounts[val] = (shortCounts[val] || 0) + 1;
      }
    });

    const sortedValues = Object.entries(shortCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return sortedValues.map(([val, count]) => {
      const isCorrect = checkIsStudentAnswerCorrect(question, val);
      const percent = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      return {
        name: val,
        option: val,
        count,
        percent,
        isCorrect,
        fill: isCorrect ? '#10b981' : '#6366f1'
      };
    });
  }, [question, answers, totalResponses]);

  // Lọc danh sách học sinh theo ô tìm kiếm
  const filteredAnswers = useMemo(() => {
    return answers.filter(a => {
      if (!searchStudent.trim()) return true;
      const q = searchStudent.toLowerCase();
      return (
        a.studentName.toLowerCase().includes(q) ||
        a.studentCode.toLowerCase().includes(q) ||
        String(a.answer).toLowerCase().includes(q)
      );
    });
  }, [answers, searchStudent]);

  if (!question) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-[2.5rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* HEADER MODAL */}
        <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <BarChart2 className="text-amber-400" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full">
                  Câu hỏi số {questionIndex + 1}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {question.type === 'mcq' ? 'Trắc nghiệm 4 lựa chọn' : question.type === 'group-tf' ? 'Đúng / Sai' : 'Trả lời ngắn'}
                </span>
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight mt-0.5">
                Thống kê phản hồi trực tiếp của học sinh
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all"
              title="Đóng bảng thống kê"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TOOLBAR ĐIỀU KHIỂN NHANH */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <Users size={16} className="text-blue-600" />
              <span className="text-xs font-black text-slate-700">
                {targetClassCount > 0
                  ? `${totalResponses} / ${targetClassCount} học sinh đã trả lời`
                  : `${totalResponses} học sinh đã trả lời`}
              </span>
            </div>

            {question.correctAnswer && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-xs font-black">
                  Đáp án chuẩn: <span className="text-emerald-900 uppercase font-black">{String(question.correctAnswer)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Quick Action Toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleToggleAnswer(!showAnswer)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 border cursor-pointer ${
                showAnswer 
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {showAnswer ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>{showAnswer ? 'Đang hiện đáp án cho HS' : 'Hiện đáp án cho HS'}</span>
            </button>

            <button
              onClick={() => handleToggleSolution(!showSolution)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 border cursor-pointer ${
                showSolution 
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileText size={14} />
              <span>{showSolution ? 'Đang hiện lời giải' : 'Hiện lời giải chi tiết'}</span>
            </button>

            {!isQuestionLocked && (
              <button
                onClick={() => onLockQuestion && onLockQuestion()}
                className="px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Clock size={14} />
                <span>Khóa nhận bài</span>
              </button>
            )}

            {onResetAnswers && (
              <button
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    setTimeout(() => setConfirmReset(false), 3500);
                  } else {
                    setConfirmReset(false);
                    onResetAnswers();
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 border cursor-pointer ${
                  confirmReset
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                }`}
                title="Xóa toàn bộ câu trả lời hiện tại của câu này để thu thập lại từ 0"
              >
                <RotateCcw size={14} />
                <span>{confirmReset ? 'Bấm lần nữa để xóa về 0' : 'Làm mới (0)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* TABS VIEW SWITCHER */}
        <div className="px-6 pt-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chart')}
              className={`pb-3 px-4 text-xs font-black uppercase transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'chart'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <BarChart2 size={16} />
              <span>Biểu đồ số lượng chọn ({totalResponses})</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`pb-3 px-4 text-xs font-black uppercase transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Users size={16} />
              <span>Danh sách học sinh & đáp án ({filteredAnswers.length})</span>
            </button>
          </div>
        </div>

        {/* BODY MODAL */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {totalResponses === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-slate-400">
                <Clock size={32} className="animate-pulse" />
              </div>
              <h4 className="text-base font-black text-slate-700 uppercase">
                Chưa có học sinh nào nộp câu trả lời
              </h4>
              <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                Học sinh đang đọc đề và suy nghĩ. Khi các em bấm chọn đáp án, biểu đồ sẽ tự động cập nhật trực tiếp theo thời gian thực!
              </p>
            </div>
          ) : activeTab === 'chart' ? (
            <div className="space-y-6">
              {/* BIỂU ĐỒ CỘT (RECHARTS) */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-4 flex items-center justify-between">
                  <span>Phân bố câu trả lời của lớp</span>
                  <span className="text-[10px] text-slate-400 font-bold lowercase">
                    {totalResponses} lượt trả lời
                  </span>
                </h4>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <YAxis 
                        allowDecimals={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs font-bold border border-slate-800">
                                <p className="font-black text-amber-400">{data.name}</p>
                                <p className="mt-1">Số bạn chọn: <span className="font-black text-white">{data.count} học sinh</span></p>
                                <p>Tỷ lệ: <span className="font-black text-emerald-400">{data.percent}%</span></p>
                                {data.isCorrect && (
                                  <p className="mt-1 text-[10px] text-emerald-300 uppercase font-black">
                                    ★ Đây là đáp án đúng
                                  </p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.fill || '#3b82f6'} 
                            stroke={entry.isCorrect ? '#059669' : '#2563eb'}
                            strokeWidth={entry.isCorrect ? 2 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CARD TỔNG KẾT TỪNG LỰA CHỌN */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {chartData.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      item.isCorrect
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-black ${item.isCorrect ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {item.name}
                      </span>
                      {item.isCorrect && (
                        <span className="p-1 bg-emerald-600 text-white rounded-lg" title="Đáp án đúng">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-slate-800">
                        {item.count}
                        <span className="text-xs font-bold text-slate-400 ml-1">HS</span>
                      </span>
                      <span className={`text-xs font-black ${item.isCorrect ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* DANH SÁCH HỌC SINH ĐÃ TRẢ LỜI */
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Tìm học sinh theo tên, mã số MAHS hoặc đáp án..."
                  value={searchStudent}
                  onChange={e => setSearchStudent(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-center w-12">STT</th>
                      <th className="p-3">Học sinh</th>
                      <th className="p-3 text-center">Mã số (MAHS)</th>
                      <th className="p-3 text-center">Lựa chọn</th>
                      <th className="p-3 text-center">Kết quả</th>
                      <th className="p-3 text-right">Thời điểm gửi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {filteredAnswers.map((ans, idx) => {
                      const isCorrect = ans.isCorrect !== undefined 
                        ? ans.isCorrect 
                        : checkIsStudentAnswerCorrect(question, ans.answer);

                      return (
                        <tr key={ans.studentId || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-black text-slate-800">{ans.studentName}</td>
                          <td className="p-3 text-center font-mono text-blue-600">{ans.studentCode || 'N/A'}</td>
                          <td className="p-3 text-center">
                            <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-lg font-black uppercase">
                              {typeof ans.answer === 'object' ? JSON.stringify(ans.answer) : String(ans.answer || '-')}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {question.correctAnswer || question.type === 'group-tf' ? (
                              isCorrect ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-black uppercase border border-emerald-200 inline-flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Chính xác
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-md text-[10px] font-black uppercase border border-rose-200 inline-flex items-center gap-1">
                                  <XCircle size={12} /> Chưa đúng
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[10px]">Chưa chấm</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-slate-400 text-[11px] font-mono">
                            {new Date(ans.submittedAt).toLocaleTimeString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-400 font-bold">
            Thống kê được cập nhật trực tiếp theo thời gian thực.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xs"
          >
            Đóng bảng thống kê
          </button>
        </div>
      </div>
    </div>
  );
}
