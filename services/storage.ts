/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result } from '../types';

// Lấy biến môi trường theo chuẩn Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

let supabase: any = null;

// CHỈ khởi tạo nếu có đầy đủ URL và Key để tránh lỗi màn hình trắng
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error("Lỗi khởi tạo Supabase (Key không hợp lệ):", e);
  }
} else {
  console.warn("Chưa cấu hình Supabase URL/Key. Ứng dụng sẽ chạy nhưng không lưu được dữ liệu.");
}

// Hàm kiểm tra trạng thái kết nối
export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

// --- Storage (Images) ---
export const uploadImage = async (file: File): Promise<string | null> => {
  if (!supabase) {
    alert("Chưa kết nối Supabase. Vui lòng kiểm tra Key.");
    return null;
  }

  try {
    // 1. Tạo tên file độc nhất để không bị trùng (timestamp_tênfile)
    // Xử lý tên file để bỏ các ký tự đặc biệt tiếng Việt
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${Date.now()}_${sanitizedName}`;

    // 2. Upload lên bucket 'quiz-images'
    const { error: uploadError } = await supabase.storage
      .from('quiz-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload Error:', uploadError);
      alert("Lỗi upload: " + uploadError.message);
      return null;
    }

    // 3. Lấy đường dẫn công khai (Public URL)
    const { data } = supabase.storage
      .from('quiz-images')
      .getPublicUrl(fileName);

    return data.publicUrl;

  } catch (e) {
    console.error("Lỗi upload:", e);
    return null;
  }
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Lỗi lấy Users:', error);
    return [];
  }
  return data.map((row: any) => row.data as User);
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('users').insert({
    id: user.id,
    username: user.username,
    data: user
  });
  if (error) console.error('Lỗi lưu User:', error);
};

export const findUser = async (username: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from('users')
    .select('data')
    .eq('username', username)
    .single();
  
  if (error || !data) return undefined;
  return data.data as User;
};

export const changePassword = async (userId: string, newPass: string): Promise<boolean> => {
  if (!supabase) return false;
  
  // 1. Lấy data người dùng hiện tại
  const { data: rows, error: fetchError } = await supabase
      .from('users')
      .select('data')
      .eq('id', userId)
      .single();
  
  if (fetchError || !rows) return false;
  
  const currentUser = rows.data as User;
  
  // 2. Cập nhật mật khẩu trong object JSON
  const updatedUser = { ...currentUser, password: newPass };

  // 3. Lưu ngược lại vào DB
  const { error: updateError } = await supabase
      .from('users')
      .update({ data: updatedUser })
      .eq('id', userId);

  return !updateError;
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('quizzes').select('data');
  if (error) {
    console.error('Lỗi lấy Quizzes:', error);
    return [];
  }
  const quizzes = data.map((row: any) => row.data as Quiz);
  // FIX: Thêm kiểu dữ liệu rõ ràng (a: Quiz, b: Quiz) để tránh lỗi build TS7006 trên Vercel
  return quizzes.sort((a: Quiz, b: Quiz) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) {
      alert("Lỗi: Chưa kết nối Database! Vui lòng kiểm tra cấu hình Key trên Vercel.");
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
  if (!supabase) return;
  const { error } = await supabase
    .from('quizzes')
    .update({ data: updatedQuiz, grade: updatedQuiz.grade })
    .eq('id', updatedQuiz.id);
  if (error) console.error('Lỗi update Quiz:', error);
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) console.error('Lỗi xóa Quiz:', error);
};

// --- Results ---
export const getResults = async (): Promise<Result[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('results').select('data');
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('results').insert({
    id: result.id,
    quiz_id: result.quizId,
    student_id: result.studentId,
    data: result
  });
  if (error) console.error('Lỗi lưu Result:', error);
};

export const hasStudentTakenQuiz = async (studentId: string, quizId: string): Promise<boolean> => {
  if (!supabase) return false;
  const { count, error } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('quiz_id', quizId);
  
  if (error) return false;
  return (count || 0) > 0;
};

export const getStudentStats = async (studentId: string) => {
  if (!supabase) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };
  
  const { data, error } = await supabase
    .from('results')
    .select('data')
    .eq('student_id', studentId);

  if (error || !data) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };

  const results = data.map((row: any) => row.data as Result);
  const totalQuizzes = results.length;
  
  // FIX: Thêm kiểu dữ liệu rõ ràng (sum: number, r: Result) để tránh lỗi build TS7006
  const totalScore = results.reduce((sum: number, r: Result) => sum + r.score, 0);
  const avgScore = totalQuizzes > 0 ? (totalScore / totalQuizzes) : 0;
  
  // FIX: Thêm kiểu dữ liệu rõ ràng (sum: number, r: Result)
  const totalSeconds = results.reduce((sum: number, r: Result) => sum + (r.durationSeconds || 0), 0);

  return {
    totalQuizzes,
    avgScore,
    totalSeconds
  };
};

export const initStorage = () => {
  if (supabase) {
    console.log("Supabase Storage Connected");
  } else {
    console.log("Storage Running in Offline Mode (No DB Connection)");
  }
};
