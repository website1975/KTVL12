import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result } from '../types';

// Sử dụng process.env thay vì import.meta.env để đảm bảo tính tương thích
// Các giá trị này đã được define cứng trong vite.config.ts
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_KEY || '';

// Tạo client Supabase
// Nếu chưa có key, app vẫn chạy nhưng các hàm gọi DB sẽ lỗi (cần xử lý try/catch)
export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabaseUrl) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Lỗi lấy Users:', error);
    return [];
  }
  return data.map((row: any) => row.data as User);
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabaseUrl) return;
  const { error } = await supabase.from('users').insert({
    id: user.id,
    username: user.username,
    data: user
  });
  if (error) console.error('Lỗi lưu User:', error);
};

export const findUser = async (username: string): Promise<User | undefined> => {
  if (!supabaseUrl) return undefined;
  const { data, error } = await supabase
    .from('users')
    .select('data')
    .eq('username', username)
    .single();
  
  if (error || !data) return undefined;
  return data.data as User;
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabaseUrl) return [];
  const { data, error } = await supabase.from('quizzes').select('data');
  if (error) {
    console.error('Lỗi lấy Quizzes:', error);
    return [];
  }
  const quizzes = data.map((row: any) => row.data as Quiz);
  return quizzes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabaseUrl) {
      alert("Chưa kết nối Database! Vui lòng kiểm tra file .env");
      return;
  }
  const { error } = await supabase.from('quizzes').insert({
    id: quiz.id,
    grade: quiz.grade,
    data: quiz
  });
  if (error) console.error('Lỗi lưu Quiz:', error);
};

export const updateQuiz = async (updatedQuiz: Quiz): Promise<void> => {
  if (!supabaseUrl) return;
  const { error } = await supabase
    .from('quizzes')
    .update({ data: updatedQuiz, grade: updatedQuiz.grade })
    .eq('id', updatedQuiz.id);
  if (error) console.error('Lỗi update Quiz:', error);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabaseUrl) return;
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) console.error('Lỗi xóa Quiz:', error);
};

// --- Results ---
export const getResults = async (): Promise<Result[]> => {
  if (!supabaseUrl) return [];
  const { data, error } = await supabase.from('results').select('data');
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabaseUrl) return;
  const { error } = await supabase.from('results').insert({
    id: result.id,
    quiz_id: result.quizId,
    student_id: result.studentId,
    data: result
  });
  if (error) console.error('Lỗi lưu Result:', error);
};

export const hasStudentTakenQuiz = async (studentId: string, quizId: string): Promise<boolean> => {
  if (!supabaseUrl) return false;
  const { count, error } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('quiz_id', quizId);
  
  if (error) return false;
  return (count || 0) > 0;
};

export const getStudentStats = async (studentId: string) => {
  if (!supabaseUrl) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };
  
  const { data, error } = await supabase
    .from('results')
    .select('data')
    .eq('student_id', studentId);

  if (error || !data) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };

  const results = data.map((row: any) => row.data as Result);
  const totalQuizzes = results.length;
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const avgScore = totalQuizzes > 0 ? (totalScore / totalQuizzes) : 0;
  const totalSeconds = results.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);

  return {
    totalQuizzes,
    avgScore,
    totalSeconds
  };
};

export const initStorage = () => {
  console.log("Supabase Storage Initialized (Async Mode)");
};
