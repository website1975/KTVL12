
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

export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

// --- HÀM BẮT LỖI TỔNG QUÁT ---
const handleSupabaseError = (error: any, context: string) => {
    if (error) {
        console.error(`LỖI SUPABASE [${context}]:`, error);
        // Lỗi 42501 là lỗi vi phạm RLS (Row Level Security)
        if (error.code === '42501') {
            throw new Error(`Database chặn quyền (RLS). Bạn cần chỉnh 'Target Roles' thành 'anon' trong Policy của bảng trên Supabase.`);
        }
        throw new Error(`${context} thất bại: ${error.message}`);
    }
};

// --- Results ---
export const getResults = async (quizId?: string): Promise<Result[]> => {
  if (!supabase) return [];
  try {
      let query = supabase.from('results').select('data');
      if (quizId && quizId !== 'all') {
        query = query.eq('quiz_id', quizId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return []; 
      return data ? data.map((row: any) => row.data as Result) : [];
  } catch (e) {
      return [];
  }
};

export const verifyResultExists = async (resultId: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data, error } = await supabase.from('results').select('id').eq('id', resultId).maybeSingle();
    return !!data && !error;
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const payload = { 
      id: result.id, 
      quiz_id: result.quizId, 
      student_id: result.studentId, 
      data: result 
  };
  const { error } = await supabase.from('results').insert(payload);
  handleSupabaseError(error, "Lưu kết quả thi");
};

export const deleteResult = async (id: string): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('results').delete().eq('id', id);
        handleSupabaseError(error, "Xóa kết quả");
    }
};

export const updateResultCode = async (id: string, code: string): Promise<void> => {
    if (!supabase) return;
    const { data, error: fetchError } = await supabase.from('results').select('data').eq('id', id).single();
    if (fetchError || !data) return;
    const resData = { ...data.data, studentCode: code.trim().toUpperCase() };
    const { error } = await supabase.from('results').update({ data: resData }).eq('id', id);
    handleSupabaseError(error, "Cập nhật mã học sinh");
};

export const addPointsToUser = async (userId: string, points: number): Promise<void> => {
  if (!supabase) return;
  const { data, error: fetchError } = await supabase.from('users').select('data').eq('id', userId).single();
  if (fetchError) return;
  if (data) {
    const d = data.data as User;
    d.points = (Number(d.points) || 0) + Number(points);
    const { error } = await supabase.from('users').update({ data: d }).eq('id', userId);
    if (error) console.error("Không thể cập nhật điểm:", error.message);
  }
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
      console.error("Lỗi tải danh sách Users:", error.message);
      return [];
  }
  return data.map((row: any) => ({ ...row.data, id: row.id } as User));
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database Cloud");
  const payload = { 
      id: user.id, 
      username: user.username.toLowerCase().trim(), 
      data: user 
  };
  const { error } = await supabase.from('users').upsert(payload);
  handleSupabaseError(error, "Lưu thông tin người dùng");
  console.log("Đã lưu User thành công vào Supabase:", user.fullName);
};

export const changePassword = async (userId: string, newPassword: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data, error: fetchError } = await supabase.from('users').select('data').eq('id', userId).single();
    if (fetchError || !data) return false;
    const userData = { ...data.data, password: newPassword };
    const { error } = await supabase.from('users').update({ data: userData }).eq('id', userId);
    return !error;
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
  if (supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      handleSupabaseError(error, "Xóa người dùng");
  }
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('quizzes').select('data');
  if (error) return [];
  return data ? data.map((row: any) => row.data as Quiz) : [];
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').insert({ id: quiz.id, grade: quiz.grade, data: quiz });
  handleSupabaseError(error, "Lưu đề thi");
};

export const updateQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').update({ data: quiz, grade: quiz.grade }).eq('id', quiz.id);
  handleSupabaseError(error, "Cập nhật đề thi");
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

export const getPublishedResults = async (): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('published_results').select('data');
    return data ? data.map((row: any) => row.data as PublishedResult) : [];
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    if (supabase) {
        const { error } = await supabase.from('published_results').upsert({ id: pub.id, data: pub });
        handleSupabaseError(error, "Công bố kết quả");
    }
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
  if (supabase) {
      const { error } = await supabase.from('chapters').insert({ id: c.id, grade: c.grade, data: c });
      handleSupabaseError(error, "Lưu chương học");
  }
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
    if (supabase) {
        const { error } = await supabase.from('bank_questions').insert({ id: q.id, data: q });
        handleSupabaseError(error, "Lưu câu hỏi ngân hàng");
    }
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
