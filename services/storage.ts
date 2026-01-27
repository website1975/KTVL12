
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter, Question, ExamSession, PublishedResult } from '../types';
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

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
};

export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

// --- Results ---
export const getResults = async (quizId?: string): Promise<Result[]> => {
  if (!supabase) return [];
  // Bypass cache bằng cách thêm timestamp vào query nếu cần, nhưng Supabase thường xử lý tốt
  let query = supabase.from('results').select('data');
  if (quizId && quizId !== 'all') {
    query = query.eq('quiz_id', quizId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
      console.error("Lỗi lấy kết quả:", error);
      return [];
  }
  return data ? data.map((row: any) => row.data as Result) : [];
};

export const verifyResultExists = async (resultId: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data, error } = await supabase.from('results').select('id').eq('id', resultId).maybeSingle();
    return !!data && !error;
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  
  await withRetry(async () => {
      // Đảm bảo các trường ID không bị undefined
      const payload = { 
          id: result.id, 
          quiz_id: result.quizId, 
          student_id: result.studentId, 
          data: result 
      };

      const { error } = await supabase.from('results').insert(payload);
      
      if (error) {
          // Log lỗi chi tiết để Admin có thể xem trong F12
          console.error("SUPABASE ERROR:", error.message, error.details, error.hint);
          throw new Error(`Database từ chối lưu: ${error.message}`);
      }
  });
};

export const updateResultCode = async (id: string, code: string): Promise<void> => {
  if (!supabase) return;
  const { data, error: fetchErr } = await supabase.from('results').select('data').eq('id', id).single();
  if (fetchErr) return;
  if (data) {
    const updatedData = { ...data.data, studentCode: code };
    const { error: updateErr } = await supabase.from('results').update({ data: updatedData }).eq('id', id);
  }
};

export const deleteResult = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('results').delete().eq('id', id);
};

// --- Exam Sessions ---
export const getExamSessions = async (quizId?: string): Promise<ExamSession[]> => {
    if (!supabase) return [];
    let query = supabase.from('exam_sessions').select('data');
    if (quizId && quizId !== 'all') {
        query = query.filter('data->>quizId', 'eq', quizId);
    }
    const { data } = await query;
    return data ? data.map((row: any) => row.data as ExamSession) : [];
};

export const saveExamSession = async (session: ExamSession): Promise<void> => {
    if (!supabase) return;
    await withRetry(async () => {
        const { error } = await supabase.from('exam_sessions').upsert({ id: session.id, data: session });
        if (error) throw error;
    }, 2, 500);
};

export const deleteExamSession = async (id: string): Promise<void> => {
    if (supabase) await withRetry(async () => {
        const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
        if (error) throw error;
    });
};

export const clearAllSessions = async (): Promise<void> => {
    if (supabase) {
        await supabase.from('exam_sessions').delete().neq('id', 'null');
    }
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) return [];
  return data.map((row: any) => ({ ...row.data, id: row.id } as User));
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabase) return;
  const normalizedUser = {
    ...user,
    username: (user.studentCode || user.username).toLowerCase(),
    studentCode: user.studentCode ? user.studentCode.toUpperCase() : undefined,
    fullName: user.fullName.trim()
  };
  const { error } = await supabase.from('users').upsert({ id: normalizedUser.id, username: normalizedUser.username, data: normalizedUser });
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

export const changePassword = async (userId: string, newPass: string): Promise<boolean> => {
  if (!supabase) return false;
  const { data } = await supabase.from('users').select('data').eq('id', userId).single();
  if (!data) return false;
  const updated = { ...data.data as User, password: newPass };
  const { error } = await supabase.from('users').update({ data: updated }).eq('id', userId);
  return !error;
};

export const clearLocalCache = () => {
    localStorage.clear();
    window.location.reload();
};

export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('quizzes').select('data');
  return data ? data.map((row: any) => row.data as Quiz) : [];
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (supabase) await supabase.from('quizzes').insert({ id: quiz.id, grade: quiz.grade, data: quiz });
};

export const updateQuiz = async (quiz: Quiz): Promise<void> => {
  if (supabase) await supabase.from('quizzes').update({ data: quiz, grade: quiz.grade }).eq('id', quiz.id);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('quizzes').delete().eq('id', id);
};

export const uploadQuizImage = async (file: File): Promise<string> => {
  if (!supabase) return '';
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `quiz-images/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
    if (uploadError) return '';
    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    return '';
  }
};

export const addPointsToUser = async (userId: string, points: number): Promise<void> => {
  if (!supabase) return;
  const { data } = await supabase.from('users').select('data').eq('id', userId).single();
  if (data) {
    const d = data.data as User;
    d.points = (d.points || 0) + points;
    await supabase.from('users').update({ data: d }).eq('id', userId);
  }
};

export const getPublishedResults = async (): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('published_results').select('data');
    return data ? data.map((row: any) => row.data as PublishedResult) : [];
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    if (supabase) await supabase.from('published_results').upsert({ id: pub.id, data: pub });
};

export const deletePublishedResult = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('published_results').delete().eq('id', id);
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

export const initStorage = () => {};
