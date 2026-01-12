
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter } from '../types';

const getEnv = (name: string): string | undefined => {
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) return metaEnv[name];
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return (process.env as any)[name];
    }
  } catch (e) {}
  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_KEY');

let supabase: any = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.error("Lỗi khởi tạo Supabase:", e);
  }
}

export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

const getLocalUsers = (): User[] => {
  const stored = localStorage.getItem('eduquiz_users_offline');
  return stored ? JSON.parse(stored) : [];
};

const saveLocalUsers = (users: User[]) => {
  localStorage.setItem('eduquiz_users_offline', JSON.stringify(users));
};

const getLocalResults = (): Result[] => {
  const stored = localStorage.getItem('eduquiz_results_backup');
  return stored ? JSON.parse(stored) : [];
};

const saveLocalResults = (results: Result[]) => {
  localStorage.setItem('eduquiz_results_backup', JSON.stringify(results));
};

const saveLocalResult = (result: Result) => {
  const local = getLocalResults();
  const idx = local.findIndex(r => r.id === result.id);
  if (idx >= 0) {
    local[idx] = result;
  } else {
    local.push(result);
  }
  saveLocalResults(local);
};

export const clearLocalCache = () => {
    localStorage.removeItem('eduquiz_results_backup');
    localStorage.removeItem('eduquiz_users_offline');
    localStorage.removeItem('eduquiz_current_user');
    window.location.reload();
};

export const uploadQuizImage = async (file: File): Promise<string> => {
    if (!supabase) throw new Error("Chưa kết nối Database");
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;
    const { error: uploadError } = await supabase.storage.from('quiz-images').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('quiz-images').getPublicUrl(filePath);
    return data.publicUrl;
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return getLocalUsers();
  const { data, error } = await supabase.from('users').select('*');
  if (error) return getLocalUsers();
  
  // NẾU CÓ KẾT NỐI DB: Chỉ lấy dữ liệu từ DB, không merge từ local để tránh "phục sinh" user đã xóa
  const dbUsers = data.map((row: any) => ({ ...row.data, id: row.id } as User));
  saveLocalUsers(dbUsers); // Cập nhật lại cache local cho đồng bộ
  return dbUsers;
};

export const saveUser = async (user: User): Promise<void> => {
  const normalizedUser = {
    ...user,
    username: (user.studentCode || user.username).toLowerCase(),
    studentCode: user.studentCode ? user.studentCode.toUpperCase() : undefined,
    fullName: user.fullName.trim()
  };

  if (!supabase) {
      const local = getLocalUsers();
      const existingIdx = local.findIndex(u => u.id === normalizedUser.id || (normalizedUser.studentCode && u.studentCode === normalizedUser.studentCode));
      if (existingIdx >= 0) local[existingIdx] = normalizedUser;
      else local.push(normalizedUser);
      saveLocalUsers(local);
      return;
  }

  const { error } = await supabase.from('users').upsert({ 
    id: normalizedUser.id, 
    username: normalizedUser.username, 
    data: normalizedUser 
  });
  if (error) throw error;
};

export const addPointsToUser = async (userId: string, pointsToAdd: number, studentCode?: string): Promise<void> => {
  if (!supabase) return;
  const normalizedCode = studentCode?.toUpperCase();
  let query = supabase.from('users').select('id, data');
  if (normalizedCode) query = query.filter('data->>studentCode', 'eq', normalizedCode);
  else query = query.eq('id', userId);

  const { data: rows } = await query;
  if (rows && rows.length > 0) {
    const targetRow = rows[0];
    const userData = targetRow.data as User;
    userData.points = (userData.points || 0) + pointsToAdd;
    await supabase.from('users').update({ data: userData }).eq('id', targetRow.id);
  }
};

export const findUser = async (username: string): Promise<User | undefined> => {
  const searchUsername = username.trim().toLowerCase();
  if (!supabase) return getLocalUsers().find(u => u.username === searchUsername);
  const { data, error } = await supabase.from('users').select('data').eq('username', searchUsername).maybeSingle();
  if (error || !data) return undefined;
  return data.data as User;
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  const searchCode = code.trim().toUpperCase();
  if (!supabase) return getLocalUsers().find(u => u.studentCode === searchCode);
  const { data, error } = await supabase.from('users').select('data').filter('data->>studentCode', 'eq', searchCode).maybeSingle();
  if (error || !data) return undefined;
  return data.data as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  const localUsers = getLocalUsers();
  const userToDelete = localUsers.find(u => u.id === id);
  saveLocalUsers(localUsers.filter(u => u.id !== id));

  if (!supabase) return;

  try {
    // 1. Xóa các bài làm trong bảng results có liên quan đến ID này
    await supabase.from('results').delete().eq('student_id', id);
    
    // 2. Nếu có mã HS, xóa các bài làm liên quan đến mã HS đó (đề phòng trường hợp id lệch)
    if (userToDelete?.studentCode) {
      await supabase.from('results').delete().filter('data->>studentCode', 'eq', userToDelete.studentCode.toUpperCase());
    }
    
    // 3. Cuối cùng mới xóa User
    await supabase.from('users').delete().eq('id', id);
  } catch (error) {
    console.error("Lỗi xóa triệt để:", error);
    throw error;
  }
};

export const changePassword = async (userId: string, newPass: string): Promise<boolean> => {
  if (!supabase) return false;
  const { data: rows, error: fetchError } = await supabase.from('users').select('data').eq('id', userId).single();
  if (fetchError || !rows) return false;
  const updatedUser = { ...rows.data as User, password: newPass };
  const { error: updateError } = await supabase.from('users').update({ data: updatedUser }).eq('id', userId);
  return !updateError;
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('quizzes').select('data');
  return error ? [] : data.map((row: any) => row.data as Quiz).sort((a: Quiz, b: Quiz) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').insert({ id: quiz.id, grade: quiz.grade, data: quiz });
  if (error) throw error;
};

export const updateQuiz = async (updatedQuiz: Quiz): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').update({ data: updatedQuiz, grade: updatedQuiz.grade }).eq('id', updatedQuiz.id);
  if (error) throw error;
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('quizzes').delete().eq('id', id);
};

// --- Results ---
export const getResults = async (): Promise<Result[]> => {
  if (!supabase) return getLocalResults();
  const { data, error } = await supabase.from('results').select('data');
  if (error) return getLocalResults();
  const dbResults = data.map((row: any) => row.data as Result);
  saveLocalResults(dbResults);
  return dbResults;
};

export const saveResult = async (result: Result): Promise<void> => {
  const normalizedResult = { ...result, studentCode: result.studentCode ? result.studentCode.toUpperCase() : undefined };
  saveLocalResult(normalizedResult);
  if (!supabase) return;
  await supabase.from('results').insert({ id: normalizedResult.id, quiz_id: normalizedResult.quizId, student_id: normalizedResult.studentId, data: normalizedResult });
};

export const updateResultCode = async (resultId: string, newCode: string): Promise<void> => {
    if (!supabase) return;
    const { data: row } = await supabase.from('results').select('data').eq('id', resultId).single();
    if (row) {
        const resData = row.data as Result;
        resData.studentCode = newCode.toUpperCase();
        await supabase.from('results').update({ data: resData }).eq('id', resultId);
    }
};

export const deleteResult = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('results').delete().eq('id', id);
};

export const getStudentStats = async (studentId: string, studentCode?: string) => {
  const allResults = await getResults();
  const userResults = allResults.filter(r => r.studentId === studentId || (studentCode && r.studentCode === studentCode.toUpperCase()));
  const totalQuizzes = userResults.length;
  return { 
    totalQuizzes, 
    avgScore: totalQuizzes > 0 ? (userResults.reduce((acc, curr) => acc + curr.score, 0) / totalQuizzes) : 0, 
    totalSeconds: userResults.reduce((acc, curr) => acc + curr.durationSeconds, 0) 
  };
};

// --- Chapters ---
export const getChapters = async (): Promise<Chapter[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('chapters').select('data');
  return error ? [] : data.map((row: any) => row.data as Chapter).sort((a: Chapter, b: Chapter) => a.order - b.order);
};

export const saveChapter = async (chapter: Chapter): Promise<void> => {
  if (!supabase) return;
  await supabase.from('chapters').insert({ id: chapter.id, grade: chapter.grade, data: chapter });
};

export const deleteChapter = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('chapters').delete().eq('id', id);
};

export const initStorage = () => {
  console.log(supabase ? "Database Connected" : "Running Offline");
};
