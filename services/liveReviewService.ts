import { LiveReviewSession, LiveReviewStudentAnswer, User, Quiz, Question } from '../types';
import { supabase, isDatabaseConnected, sanitizeForJsonB } from './storage';

// BroadcastChannel để đồng bộ tức thời 0ms giữa các tab cùng trình duyệt
let liveChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    liveChannel = new BroadcastChannel('eduquiz_live_review_sync');
  }
} catch (e) {
  console.warn("BroadcastChannel không khả dụng:", e);
}

const LOCAL_STORAGE_SESSION_PREFIX = 'eduquiz_live_session_';
const LOCAL_STORAGE_ANSWER_PREFIX = 'eduquiz_live_ans_';
const LOCAL_STORAGE_PRACTICE_LIST = 'eduquiz_live_reviewed_quizzes_v2';

/**
 * Phân giải đáp án đúng của câu hỏi trắc nghiệm (hỗ trợ cả dạng A, B, C, D hoặc dạng chuỗi văn bản phương án)
 */
export function resolveQuestionCorrectOption(question: Question): { index: number; letter: string; text: string } {
  if (!question) return { index: -1, letter: '', text: '' };

  const rawCorrect = String(question.correctAnswer || '').trim();
  const options = question.options || [];

  const cleanOption = (s: string) => 
    s.trim().toLowerCase().replace(/^[a-d][.)\s:]+/i, '').trim();

  let correctIdx = -1;
  const upper = rawCorrect.toUpperCase();

  if (['A', 'B', 'C', 'D'].includes(upper)) {
    correctIdx = upper.charCodeAt(0) - 65;
  } else if (['0', '1', '2', '3'].includes(rawCorrect)) {
    correctIdx = parseInt(rawCorrect, 10);
  } else if (/^[A-D][.)\s]/i.test(rawCorrect)) {
    correctIdx = rawCorrect[0].toUpperCase().charCodeAt(0) - 65;
  } else if (options.length > 0) {
    // So khớp trực tiếp nội dung đáp án trong danh sách options
    const targetClean = cleanOption(rawCorrect);
    const match = options.findIndex(opt => {
      if (opt.trim().toLowerCase() === rawCorrect.toLowerCase()) return true;
      if (cleanOption(opt) === targetClean) return true;
      return false;
    });
    if (match !== -1) {
      correctIdx = match;
    }
  }

  const letter = (correctIdx >= 0 && correctIdx < 26) ? String.fromCharCode(65 + correctIdx) : upper;
  const text = (correctIdx >= 0 && options[correctIdx]) ? options[correctIdx] : rawCorrect;

  return { index: correctIdx, letter, text };
}

/**
 * Kiểm tra câu trả lời của học sinh có chính xác không (tương thích mọi loại câu hỏi: MCQ, Đúng/Sai, Trả lời ngắn)
 */
export function checkIsStudentAnswerCorrect(question: Question, userAnswer: any): boolean {
  if (!question || userAnswer === undefined || userAnswer === null || userAnswer === '') {
    return false;
  }

  // 1. Trắc nghiệm 4 lựa chọn (MCQ)
  if (question.type === 'mcq') {
    const { index: correctIdx, letter: correctLetter, text: correctText } = resolveQuestionCorrectOption(question);
    const rawAns = String(userAnswer).trim();
    const upperAns = rawAns.toUpperCase();

    // TH1: Học sinh gửi lên chữ cái A, B, C, D
    if (['A', 'B', 'C', 'D'].includes(upperAns)) {
      if (correctIdx >= 0) {
        return upperAns === correctLetter;
      }
      return upperAns === String(question.correctAnswer || '').trim().toUpperCase();
    }

    // TH2: Học sinh gửi lên số chỉ mục 0, 1, 2, 3
    if (['0', '1', '2', '3'].includes(rawAns)) {
      return parseInt(rawAns, 10) === correctIdx;
    }

    // TH3: Học sinh gửi lên toàn bộ chuỗi nội dung đáp án
    const cleanOption = (s: string) => s.trim().toLowerCase().replace(/^[a-d][.)\s:]+/i, '').trim();
    if (cleanOption(rawAns) === cleanOption(correctText)) {
      return true;
    }
    if (rawAns.toLowerCase() === String(question.correctAnswer || '').trim().toLowerCase()) {
      return true;
    }

    return false;
  }

  // 2. Câu trả lời ngắn (Short)
  if (question.type === 'short') {
    const normalizeShort = (val: any) =>
      String(val || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/,/g, '.');

    const nAns = normalizeShort(userAnswer);
    const nCorrect = normalizeShort(question.correctAnswer);

    if (nAns !== '' && nCorrect !== '' && nAns === nCorrect) {
      return true;
    }

    // So sánh số học (ví dụ: 2.5 và 2.50)
    const numAns = parseFloat(nAns);
    const numCorrect = parseFloat(nCorrect);
    if (!isNaN(numAns) && !isNaN(numCorrect) && Math.abs(numAns - numCorrect) < 0.0001) {
      return true;
    }

    return false;
  }

  // 3. Câu Đúng / Sai chùm (Group True/False)
  if (question.type === 'group-tf' && question.subQuestions) {
    if (typeof userAnswer === 'object' && userAnswer !== null) {
      let isAllCorrect = true;
      let answeredCount = 0;

      question.subQuestions.forEach((sq, i) => {
        const val = userAnswer[sq.id] !== undefined ? userAnswer[sq.id] : userAnswer[i];
        if (val !== undefined && val !== null) {
          answeredCount++;
          const normAns = String(val).trim().toLowerCase();
          const normCorrect = String(sq.correctAnswer).trim().toLowerCase();
          const isMatch = (normAns === 'true' && (normCorrect === 'true' || normCorrect === 'đúng')) ||
                          (normAns === 'false' && (normCorrect === 'false' || normCorrect === 'sai')) ||
                          normAns === normCorrect;
          if (!isMatch) {
            isAllCorrect = false;
          }
        } else {
          isAllCorrect = false;
        }
      });

      return answeredCount > 0 && isAllCorrect;
    }
  }

  return false;
}

/**
 * Lưu / Cập nhật phiên sửa bài đố vui trực tiếp (Live Review Session)
 */
export async function saveLiveReviewSession(session: LiveReviewSession): Promise<void> {
  const sanitized = sanitizeForJsonB(session);
  
  // 1. Lưu LocalStorage làm bộ đệm tức thì
  try {
    localStorage.setItem(`${LOCAL_STORAGE_SESSION_PREFIX}${session.id}`, JSON.stringify(sanitized));
    
    // Ghi nhận đề thi này vào danh sách được luyện tập lại
    if (session.allowPracticeRetry !== false) {
      addQuizToPracticeList(session.quizId);
    }
  } catch (e) {}

  // 2. Broadcast tức thời qua kênh nội bộ
  if (liveChannel) {
    try {
      liveChannel.postMessage({ type: 'SESSION_UPDATE', session: sanitized });
    } catch (e) {}
  }

  // 3. Lưu vào Supabase Database Cloud (Bảng exam_sessions với ID live_review_...)
  if (isDatabaseConnected() && supabase) {
    try {
      await supabase.from('exam_sessions').upsert({
        id: session.id,
        data: sanitized
      });
    } catch (err) {
      console.warn("Lỗi lưu Live Review Session lên Supabase:", err);
    }
  }
}

/**
 * Lấy chi tiết phiên sửa bài trực tiếp theo ID
 */
export async function getLiveReviewSessionById(sessionId: string): Promise<LiveReviewSession | null> {
  // Ưu tiên đọc từ LocalStorage
  let localSession: LiveReviewSession | null = null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_SESSION_PREFIX}${sessionId}`);
    if (raw) localSession = JSON.parse(raw);
  } catch (e) {}

  if (!isDatabaseConnected() || !supabase) {
    return localSession;
  }

  try {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('data')
      .eq('id', sessionId)
      .limit(1);

    if (!error && data && data.length > 0 && data[0]?.data) {
      const serverSession = data[0].data as LiveReviewSession;
      try {
        localStorage.setItem(`${LOCAL_STORAGE_SESSION_PREFIX}${sessionId}`, JSON.stringify(serverSession));
      } catch (e) {}
      return serverSession;
    }
  } catch (err) {
    console.warn("Lỗi lấy Live Review Session từ Supabase:", err);
  }

  return localSession;
}

/**
 * Lấy tất cả phiên sửa bài đang hoạt động (Active) trong khung giờ hợp lệ
 */
export async function getActiveLiveReviewSessions(): Promise<LiveReviewSession[]> {
  const now = new Date();
  const sessionsMap = new Map<string, LiveReviewSession>();

  // 1. Quét từ LocalStorage và dọn sạch các phiên đã expired hoặc không còn active
  try {
    const staleKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_SESSION_PREFIX)) {
        try {
          const s: LiveReviewSession = JSON.parse(localStorage.getItem(key) || '{}');
          if (s && s.id && s.status === 'active') {
            const end = s.endTime ? new Date(s.endTime) : null;
            if (!end || now.getTime() <= end.getTime()) {
              sessionsMap.set(s.id, s);
            } else {
              staleKeys.push(key);
            }
          } else {
            staleKeys.push(key);
          }
        } catch (e) {
          staleKeys.push(key);
        }
      }
    }
    staleKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {}

  // 2. Quét từ Supabase Cloud (Nguồn dữ liệu tối cao)
  if (isDatabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('id, data')
        .like('id', 'live_review_%');

      if (!error && Array.isArray(data)) {
        const activeCloudIds = new Set<string>();

        data.forEach((row: any) => {
          const s = row.data as LiveReviewSession;
          if (s && s.id) {
            const end = s.endTime ? new Date(s.endTime) : null;
            const isStillActive = s.status === 'active' && (!end || now.getTime() <= end.getTime());
            if (isStillActive) {
              activeCloudIds.add(s.id);
              sessionsMap.set(s.id, s);
              try {
                localStorage.setItem(`${LOCAL_STORAGE_SESSION_PREFIX}${s.id}`, JSON.stringify(s));
              } catch (e) {}
            } else {
              // Phiên đã ended trên Cloud hoặc quá giờ -> xóa hoàn toàn khỏi local
              sessionsMap.delete(s.id);
              try {
                localStorage.removeItem(`${LOCAL_STORAGE_SESSION_PREFIX}${s.id}`);
              } catch (e) {}
            }
          }
        });

        // Xóa sạch mọi session trong LocalStorage mà Cloud đã kết thúc hoặc không còn active
        for (const key of Array.from(sessionsMap.keys())) {
          if (!activeCloudIds.has(key)) {
            sessionsMap.delete(key);
            try {
              localStorage.removeItem(`${LOCAL_STORAGE_SESSION_PREFIX}${key}`);
            } catch (e) {}
          }
        }

        // Quét thêm một lượt trong localStorage để chắc chắn không còn sót session rác nào
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(LOCAL_STORAGE_SESSION_PREFIX)) {
              const sId = k.slice(LOCAL_STORAGE_SESSION_PREFIX.length);
              if (!activeCloudIds.has(sId)) {
                localStorage.removeItem(k);
              }
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách Live Review Sessions:", err);
    }
  }

  return Array.from(sessionsMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

/**
 * Kiểm tra xem có phiên sửa bài đố vui nào đang mở cho học sinh này hay không
 */
export async function getActiveLiveReviewForStudent(student: User): Promise<LiveReviewSession | null> {
  if (!student) return null;
  const sessions = await getActiveLiveReviewSessions();
  if (sessions.length === 0) return null;

  const now = new Date();
  const sClassId = (student.classId || '').trim();
  const sClassName = (student.className || '').trim().toUpperCase();

  // Tìm phiên khớp với Lớp của học sinh
  for (const session of sessions) {
    if (session.status !== 'active') continue;

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);

    // Kiểm tra nằm trong khung giờ [t1, t2] (với dung sai 5 phút cho học sinh vào sớm)
    const withinTime = (now.getTime() >= start.getTime() - 5 * 60 * 1000) && (now.getTime() <= end.getTime());
    if (!withinTime) continue;

    // Kiểm tra xem đề có share cho lớp của học sinh hay không
    const matchClassId = sClassId && session.targetClassIds && session.targetClassIds.includes(sClassId);
    const matchClassName = sClassName && session.targetClassNames && session.targetClassNames.some(
      cn => (cn || '').trim().toUpperCase() === sClassName
    );
    const matchAll = session.targetClassIds && (session.targetClassIds.includes('all') || session.targetClassNames.includes('Tất cả các lớp'));

    if (matchClassId || matchClassName || matchAll) {
      return session;
    }
  }

  return null;
}

/**
 * Giáo viên kích hoạt câu hỏi mới & bắt đầu tính giờ
 */
export async function activateLiveReviewQuestion(
  session: LiveReviewSession,
  questionIndex: number,
  timeLimitSeconds: number = 60
): Promise<LiveReviewSession> {
  const updated: LiveReviewSession = {
    ...session,
    currentQuestionIndex: questionIndex,
    timeLimitSeconds,
    questionActivatedAt: new Date().toISOString(),
    isQuestionLocked: false,
    showAnswer: false,
    showSolution: false,
    updatedAt: new Date().toISOString()
  };

  await saveLiveReviewSession(updated);
  return updated;
}

/**
 * Giáo viên khóa câu hỏi hiện tại (hết thời gian hoặc dừng nhận trả lời)
 */
export async function lockLiveReviewQuestion(session: LiveReviewSession): Promise<LiveReviewSession> {
  const updated: LiveReviewSession = {
    ...session,
    isQuestionLocked: true,
    updatedAt: new Date().toISOString()
  };

  await saveLiveReviewSession(updated);
  return updated;
}

/**
 * Giáo viên bật/tắt hiển thị đáp án đúng
 */
export async function toggleLiveReviewAnswer(session: LiveReviewSession, show: boolean): Promise<LiveReviewSession> {
  const updated: LiveReviewSession = {
    ...session,
    showAnswer: show,
    updatedAt: new Date().toISOString()
  };

  await saveLiveReviewSession(updated);
  return updated;
}

/**
 * Giáo viên bật/tắt hiển thị lời giải chi tiết
 */
export async function toggleLiveReviewSolution(session: LiveReviewSession, show: boolean): Promise<LiveReviewSession> {
  const updated: LiveReviewSession = {
    ...session,
    showSolution: show,
    updatedAt: new Date().toISOString()
  };

  await saveLiveReviewSession(updated);
  return updated;
}

/**
 * Giáo viên kết thúc buổi sửa bài trực tiếp
 */
export async function endLiveReviewSession(session: LiveReviewSession): Promise<LiveReviewSession> {
  const updated: LiveReviewSession = {
    ...session,
    status: 'ended',
    isQuestionLocked: true,
    updatedAt: new Date().toISOString()
  };

  // 1. Xóa ngay khỏi LocalStorage
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_SESSION_PREFIX}${session.id}`);
  } catch (e) {}

  // 2. Broadcast tức thời qua kênh nội bộ cho mọi tab học sinh để lập tức ẩn banner
  if (liveChannel) {
    try {
      liveChannel.postMessage({ type: 'SESSION_END', sessionId: session.id, session: updated });
    } catch (e) {}
  }

  // 3. Dọn dẹp trên Supabase Cloud: cập nhật status ended hoặc xóa phiên
  if (isDatabaseConnected() && supabase) {
    try {
      await supabase.from('exam_sessions').delete().eq('id', session.id);
    } catch (err) {
      console.warn("Lỗi dọn dẹp Live Review Session trên Supabase:", err);
    }
  }

  return updated;
}

/**
 * Học sinh gửi câu trả lời cho một câu hỏi cụ thể trong buổi sửa bài
 */
export async function submitLiveReviewAnswer(
  sessionId: string,
  qIndex: number,
  student: User,
  answer: any,
  isCorrect?: boolean,
  question?: Question
): Promise<LiveReviewStudentAnswer> {
  const calculatedCorrect = question !== undefined 
    ? checkIsStudentAnswerCorrect(question, answer) 
    : isCorrect;

  const record: LiveReviewStudentAnswer = {
    studentId: student.id,
    studentName: student.fullName,
    studentCode: student.studentCode || 'N/A',
    answer,
    submittedAt: new Date().toISOString(),
    isCorrect: calculatedCorrect
  };

  const answerKey = `live_ans_${sessionId}_q${qIndex}_${student.id}`;

  // 1. Lưu LocalStorage
  try {
    localStorage.setItem(answerKey, JSON.stringify(record));
  } catch (e) {}

  // 2. Broadcast tức thời
  if (liveChannel) {
    try {
      liveChannel.postMessage({
        type: 'STUDENT_ANSWER',
        sessionId,
        qIndex,
        answer: record
      });
    } catch (e) {}
  }

  // 3. Lưu vào Supabase Cloud
  if (isDatabaseConnected() && supabase) {
    try {
      await supabase.from('exam_sessions').upsert({
        id: answerKey,
        data: {
          sessionId,
          qIndex,
          ...record
        }
      });
    } catch (err) {
      console.warn("Lỗi lưu câu trả lời học sinh lên Supabase:", err);
    }
  }

  return record;
}

/**
 * Lấy câu trả lời của 1 học sinh cho câu hỏi cụ thể (phục vụ phục hồi khi học sinh F5 / mở lại)
 */
export async function getStudentAnswerForQuestion(
  sessionId: string,
  qIndex: number,
  studentId: string
): Promise<LiveReviewStudentAnswer | null> {
  const answerKey = `live_ans_${sessionId}_q${qIndex}_${studentId}`;

  try {
    const raw = localStorage.getItem(answerKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  if (isDatabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('data')
        .eq('id', answerKey)
        .limit(1);

      if (!error && data && data.length > 0 && data[0]?.data) {
        return data[0].data as LiveReviewStudentAnswer;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Lấy toàn bộ câu trả lời của học sinh cho câu hỏi `qIndex` (để Giáo viên xem thống kê A, B, C, D)
 */
export async function getStudentAnswersForQuestion(
  sessionId: string,
  qIndex: number
): Promise<LiveReviewStudentAnswer[]> {
  const answersMap = new Map<string, LiveReviewStudentAnswer>();
  const prefix = `live_ans_${sessionId}_q${qIndex}_`;

  // 1. Quét LocalStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        try {
          const ans = JSON.parse(localStorage.getItem(k) || '{}');
          if (ans && ans.studentId) answersMap.set(ans.studentId, ans);
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 2. Quét Supabase Cloud
  if (isDatabaseConnected() && supabase) {
    try {
      const { data, error } = await supabase
        .from('exam_sessions')
        .select('data')
        .like('id', `${prefix}%`);

      if (!error && data && Array.isArray(data)) {
        data.forEach((row: any) => {
          const ans = row.data as LiveReviewStudentAnswer;
          if (ans && ans.studentId) {
            answersMap.set(ans.studentId, ans);
            try {
              localStorage.setItem(`live_ans_${sessionId}_q${qIndex}_${ans.studentId}`, JSON.stringify(ans));
            } catch (e) {}
          }
        });
      }
    } catch (err) {
      console.warn("Lỗi tải câu trả lời học sinh từ Supabase:", err);
    }
  }

  return Array.from(answersMap.values());
}

/**
 * Lắng nghe thay đổi phiên sửa bài trực tiếp (dùng Polling + BroadcastChannel)
 */
export function subscribeToLiveReviewSession(
  sessionId: string,
  onUpdate: (session: LiveReviewSession | null) => void,
  intervalMs: number = 1500
): () => void {
  let isSubscribed = true;

  // Lắng nghe qua BroadcastChannel
  const handleBroadcast = (e: MessageEvent) => {
    if (!isSubscribed) return;
    if (e.data?.type === 'SESSION_UPDATE' && e.data?.session?.id === sessionId) {
      onUpdate(e.data.session);
    } else if (e.data?.type === 'SESSION_END' && e.data?.sessionId === sessionId) {
      onUpdate(null);
    }
  };

  if (liveChannel) {
    liveChannel.addEventListener('message', handleBroadcast);
  }

  // Thăm dò định kỳ
  const poll = async () => {
    if (!isSubscribed) return;
    try {
      const s = await getLiveReviewSessionById(sessionId);
      if (isSubscribed) {
        if (!s || s.status !== 'active') {
          onUpdate(null);
        } else {
          onUpdate(s);
        }
      }
    } catch (e) {}
  };

  // Poll lần đầu ngay lập tức
  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    isSubscribed = false;
    clearInterval(timer);
    if (liveChannel) {
      liveChannel.removeEventListener('message', handleBroadcast);
    }
  };
}

/**
 * Lắng nghe câu trả lời của học sinh cho câu hỏi hiện tại (cho màn hình Giáo viên)
 */
export function subscribeToStudentAnswers(
  sessionId: string,
  qIndex: number,
  onUpdate: (answers: LiveReviewStudentAnswer[]) => void,
  intervalMs: number = 1500
): () => void {
  let isSubscribed = true;

  const handleBroadcast = (e: MessageEvent) => {
    if (!isSubscribed) return;
    if (e.data?.type === 'STUDENT_ANSWER' && e.data?.sessionId === sessionId && e.data?.qIndex === qIndex) {
      getStudentAnswersForQuestion(sessionId, qIndex).then(res => {
        if (isSubscribed) onUpdate(res);
      });
    }
  };

  if (liveChannel) {
    liveChannel.addEventListener('message', handleBroadcast);
  }

  const poll = async () => {
    if (!isSubscribed) return;
    try {
      const res = await getStudentAnswersForQuestion(sessionId, qIndex);
      if (isSubscribed) onUpdate(res);
    } catch (e) {}
  };

  poll();
  const timer = setInterval(poll, intervalMs);

  return () => {
    isSubscribed = false;
    clearInterval(timer);
    if (liveChannel) {
      liveChannel.removeEventListener('message', handleBroadcast);
    }
  };
}

/**
 * Ghi nhận đề thi vào danh sách Luyện tập lại (Yêu cầu 4)
 */
export function addQuizToPracticeList(quizId: string): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRACTICE_LIST);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(quizId)) {
      list.push(quizId);
      localStorage.setItem(LOCAL_STORAGE_PRACTICE_LIST, JSON.stringify(list));
    }
  } catch (e) {}
}

/**
 * Lấy danh sách ID các đề thi đã từng được sửa bài để đưa vào mục Luyện tập
 */
export function getLiveReviewedQuizIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PRACTICE_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
