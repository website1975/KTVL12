
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter, Question, ExamSession, PublishedResult, Grade } from '../types';
import { v4 as uuidv4 } from 'uuid';

const SUPABASE_URL = 'https://lchfhsioxvgkjfsikycl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaGZoc2lveHZna2pmc2lreWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTI3MDksImV4cCI6MjA4MDUyODcwOX0.toOc2ytPzo_cqhpQyd0YOLq4Zvk3BtfdZSziXN__j8Q';

let supabase: any = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Lỗi khởi tạo Supabase:", e);
}

export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

const handleSupabaseError = (error: any, context: string) => {
    if (error) {
        console.error(`LỖI SUPABASE [${context}]:`, error);
        throw new Error(`${context} thất bại: ${error.message}`);
    }
};

// --- Results ---
// TỐI ƯU: Chỉ lấy thông tin cơ bản của kết quả (Metadata) để hiện bảng điểm
export const getResultsMetadata = async (quizId?: string): Promise<Result[]> => {
  if (!supabase) return [];
  try {
      // Loại bỏ trường userAnswers để giảm dung lượng tải xuống
      let query = supabase.from('results').select('id, quiz_id, student_id, data->studentName, data->studentCode, data->score, data->submittedAt, data->durationSeconds, data->violationCount');
      if (quizId && quizId !== 'all') {
        query = query.eq('quiz_id', quizId);
      }
      const { data, error } = await query;
      if (error) throw error;
      
      return data ? data.map((row: any) => ({
          id: row.id,
          quizId: row.quiz_id,
          studentId: row.student_id,
          studentName: row.studentName,
          studentCode: row.studentCode,
          score: row.score,
          submittedAt: row.submittedAt,
          durationSeconds: row.durationSeconds,
          violationCount: row.violationCount
      } as any)).sort((a: any, b: any) => 
        new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
      ) : [];
  } catch (e) {
      return [];
  }
};

export const getResults = async (quizId?: string): Promise<Result[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('results').select('data');
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

// Fix: Added getResultsForStudent to resolve module member error in StudentDashboard.tsx
export const getResultsForStudent = async (studentId: string, studentCode?: string): Promise<Result[]> => {
  if (!supabase) return [];
  let query = supabase.from('results').select('data');
  if (studentCode && studentCode !== 'N/A') {
    query = query.or(`student_id.eq.${studentId},data->>studentCode.eq.${studentCode.toUpperCase()}`);
  } else {
    query = query.eq('student_id', studentId);
  }
  const { data, error } = await query;
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

// Fix: Added verifyResultExists to resolve module member error in QuizTaker.tsx
export const verifyResultExists = async (id: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.from('results').select('id').eq('id', id).maybeSingle();
    return !!data;
};

export const getResultById = async (id: string): Promise<Result | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('results').select('data').eq('id', id).single();
    if (error || !data) return null;
    return data.data as Result;
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const payload = { id: result.id, quiz_id: result.quizId, student_id: result.studentId, data: result };
  const { error } = await supabase.from('results').insert(payload);
  handleSupabaseError(error, "Lưu kết quả thi");
};

export const deleteResult = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('results').delete().eq('id', id);
};

export const updateResultCode = async (id: string, code: string): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('results').select('data').eq('id', id).single();
    if (!data) return;
    const resData = { ...data.data, studentCode: code.trim().toUpperCase() };
    await supabase.from('results').update({ data: resData }).eq('id', id);
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('users').select('*');
  return data ? data.map((row: any) => ({ ...row.data, id: row.id } as User)) : [];
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database Cloud");
  const payload = { id: user.id, username: user.username.toLowerCase().trim(), data: user };
  await supabase.from('users').upsert(payload);
};

// Fix: Added addPointsToUser to resolve module member error in QuizTaker.tsx
export const addPointsToUser = async (userId: string, points: number): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('users').select('data').eq('id', userId).single();
    if (data) {
      const userData = { ...data.data, points: (data.data.points || 0) + points };
      await supabase.from('users').update({ data: userData }).eq('id', userId);
    }
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  const { data } = await supabase.from('users').select('data').filter('data->>studentCode', 'eq', code.trim().toUpperCase()).maybeSingle();
  return data?.data as User;
};

export const findUser = async (username: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  const { data } = await supabase.from('users').select('data').eq('username', username.trim().toLowerCase()).maybeSingle();
  return data?.data as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('users').delete().eq('id', id);
};

export const changePassword = async (userId: string, newPassword: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.from('users').select('data').eq('id', userId).single();
    if (!data) return false;
    const userData = { ...data.data, password: newPassword };
    const { error } = await supabase.from('users').update({ data: userData }).eq('id', userId);
    return !error;
};

// --- Quizzes ---
// TỐI ƯU: Chỉ lấy Metadata để hiện danh sách đề (Cực kỳ nhanh)
export const getQuizzesMetadata = async (grade?: Grade): Promise<Quiz[]> => {
  if (!supabase) return [];
  try {
    let query = supabase.from('quizzes').select('id, grade, data->title, data->type, data->isPublished, data->createdAt, data->category, data->durationMinutes, data->isMonitored');
    if (grade && grade !== 'all') {
        query = query.or(`grade.eq.${grade},grade.eq.all`);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    return data ? data.map((row: any) => ({
        id: row.id,
        grade: row.grade,
        title: row.title,
        type: row.type,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
        category: row.category,
        durationMinutes: row.durationMinutes,
        isMonitored: row.isMonitored,
        questions: [] // Trống để nhẹ
    } as any)) : [];
  } catch (e) {
    return [];
  }
};

// Fix: Added getQuizzes to resolve module member error in StudentDashboard.tsx and ExamMonitor.tsx
export const getQuizzes = async (grade?: Grade): Promise<Quiz[]> => {
  if (!supabase) return [];
  try {
    let query = supabase.from('quizzes').select('data');
    if (grade && grade !== 'all') {
        query = query.or(`grade.eq.${grade},grade.eq.all`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ? data.map((row: any) => row.data as Quiz) : [];
  } catch (e) {
    return [];
  }
};

export const getQuizById = async (id: string): Promise<Quiz | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('quizzes').select('data').eq('id', id).single();
    if (error || !data) return null;
    return data.data as Quiz;
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  await supabase.from('quizzes').insert({ id: quiz.id, grade: quiz.grade, data: quiz });
};

export const updateQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  await supabase.from('quizzes').update({ data: quiz, grade: quiz.grade }).eq('id', quiz.id);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('quizzes').delete().eq('id', id);
};

export const getChapters = async (): Promise<Chapter[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('chapters').select('data');
  return data ? data.map((row: any) => row.data as Chapter).sort((a: Chapter, b: Chapter) => a.order - b.order) : [];
};

export const saveChapter = async (c: Chapter): Promise<void> => {
  if (supabase) await supabase.from('chapters').insert({ id: c.id, grade: c.grade, data: c });
};

export const deleteChapter = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('chapters').delete().eq('id', id);
};

export const getBankQuestions = async (): Promise<Question[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('bank_questions').select('data');
    return data ? data.map((row: any) => row.data as Question) : [];
};

export const saveBankQuestion = async (q: Question): Promise<void> => {
    if (supabase) await supabase.from('bank_questions').insert({ id: q.id, data: q });
};

export const uploadQuizImage = async (file: File): Promise<string> => {
    if (!supabase) return '';
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('quiz-images').upload(fileName, file);
      if (uploadError) return '';
      const { data } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) { return ''; }
};

export const getPublishedResults = async (limit: number = 20): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('published_results').select('data').order('id', { ascending: false }).limit(limit);
    return data ? data.map((row: any) => row.data as PublishedResult) : [];
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    if (supabase) await supabase.from('published_results').upsert({ id: pub.id, data: pub });
};

export const deletePublishedResult = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('published_results').delete().eq('id', id);
};

export const saveExamSession = async (session: ExamSession): Promise<void> => {
    if (supabase) await supabase.from('exam_sessions').upsert({ id: session.id, data: session });
};

export const deleteExamSession = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('exam_sessions').delete().eq('id', id);
};

export const getExamSessions = async (quizId?: string): Promise<ExamSession[]> => {
    if (!supabase) return [];
    let query = supabase.from('exam_sessions').select('data');
    if (quizId && quizId !== 'all') query = query.filter('data->>quizId', 'eq', quizId);
    const { data } = await query;
    return data ? data.map((row: any) => row.data as ExamSession) : [];
};

export const clearAllSessions = async () => {
    if (supabase) await supabase.from('exam_sessions').delete().neq('id', 'null');
};

export const initStorage = () => {};
export const clearLocalCache = () => { localStorage.clear(); window.location.reload(); };
