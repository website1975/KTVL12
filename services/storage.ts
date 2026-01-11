
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

// --- Helper for Offline Mode ---
const getLocalUsers = (): User[] => {
  const stored = localStorage.getItem('eduquiz_users_offline');
  return stored ? JSON.parse(stored) : [];
};

const saveLocalUsers = (users: User[]) => {
  localStorage.setItem('eduquiz_users_offline', JSON.stringify(users));
};

// --- Storage (Images) ---
export const uploadQuizImage = async (file: File): Promise<string> => {
    if (!supabase) throw new Error("Chưa kết nối Database");
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('quiz-images')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
        .from('quiz-images')
        .getPublicUrl(filePath);

    return data.publicUrl;
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return getLocalUsers();
  const { data, error } = await supabase.from('users').select('*');
  if (error) return getLocalUsers();
  return data.map((row: any) => ({ ...row.data, id: row.id } as User));
};

export const saveUser = async (user: User): Promise<void> => {
  const normalizedUser = {
    ...user,
    username: (user.studentCode || user.username).toLowerCase(),
    studentCode: user.studentCode ? user.studentCode.toUpperCase() : undefined,
    fullName: user.fullName.trim()
  };

  const local = getLocalUsers();
  const existingIdx = local.findIndex(u => u.id === normalizedUser.id || (normalizedUser.studentCode && u.studentCode === normalizedUser.studentCode));
  if (existingIdx >= 0) {
    local[existingIdx] = normalizedUser;
  } else {
    local.push(normalizedUser);
  }
  saveLocalUsers(local);

  if (!supabase) return;
  const { error } = await supabase.from('users').upsert({ 
    id: normalizedUser.id, 
    username: normalizedUser.username, 
    data: normalizedUser 
  });
  if (error) throw error;
};

export const addPointsToUser = async (userId: string, pointsToAdd: number): Promise<void> => {
  const local = getLocalUsers();
  const user = local.find(u => u.id === userId);
  if (user) {
    user.points = (user.points || 0) + pointsToAdd;
    saveLocalUsers(local);
  }

  if (!supabase) {
    const stored = localStorage.getItem('eduquiz_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u.id === userId) {
        u.points = (u.points || 0) + pointsToAdd;
        localStorage.setItem('eduquiz_current_user', JSON.stringify(u));
      }
    }
    return;
  }
  
  const { data: row } = await supabase.from('users').select('data').eq('id', userId).single();
  if (row) {
    const userData = row.data as User;
    userData.points = (userData.points || 0) + pointsToAdd;
    await supabase.from('users').update({ data: userData }).eq('id', userId);
    
    const stored = localStorage.getItem('eduquiz_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u.id === userId) {
        localStorage.setItem('eduquiz_current_user', JSON.stringify(userData));
      }
    }
  }
};

export const findUser = async (username: string): Promise<User | undefined> => {
  const searchUsername = username.trim().toLowerCase();
  const local = getLocalUsers();
  const localFound = local.find(u => u.username === searchUsername);
  if (localFound) return localFound;

  if (!supabase) return undefined;
  const { data, error } = await supabase.from('users').select('data').eq('username', searchUsername).single();
  if (error || !data) return undefined;
  return data.data as User;
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  const searchCode = code.trim().toUpperCase();
  const local = getLocalUsers();
  const localFound = local.find(u => u.studentCode === searchCode);
  if (localFound) return localFound;

  if (!supabase) return undefined;
  
  const { data, error } = await supabase
    .from('users')
    .select('data')
    .filter('data->>studentCode', 'eq', searchCode)
    .maybeSingle();
  
  if (error || !data) return undefined;
  return data.data as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  const localUsers = getLocalUsers();
  const userToDelete = localUsers.find(u => u.id === id);
  const newLocalUsers = localUsers.filter(u => u.id !== id);
  saveLocalUsers(newLocalUsers);

  if (!supabase) return;

  try {
    await supabase.from('results').delete().eq('student_id', id);
    if (userToDelete?.studentCode) {
      await supabase.from('results').delete().filter('data->>studentCode', 'eq', userToDelete.studentCode.toUpperCase());
    }
    await supabase.from('users').delete().eq('id', id);
  } catch (error) {
    console.error("Lỗi khi xóa học sinh và các kết quả liên quan:", error);
    throw error;
  }
};

export const changePassword = async (userId: string, newPass: string): Promise<boolean> => {
  const local = getLocalUsers();
  const u = local.find(x => x.id === userId);
  if (u) {
    u.password = newPass;
    saveLocalUsers(local);
  }

  if (!supabase) return !!u;
  const { data: rows, error: fetchError } = await supabase.from('users').select('data').eq('id', userId).single();
  if (fetchError || !rows) return false;
  const currentUser = rows.data as User;
  const updatedUser = { ...currentUser, password: newPass };
  const { error: updateError } = await supabase.from('users').update({ data: updatedUser }).eq('id', userId);
  return !updateError;
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('quizzes').select('data');
  if (error) return [];
  return data.map((row: any) => row.data as Quiz).sort((a: Quiz, b: Quiz) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  if (!supabase) return [];
  const { data, error } = await supabase.from('results').select('data');
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

export const saveResult = async (result: Result): Promise<void> => {
  const normalizedResult = {
    ...result,
    studentCode: result.studentCode ? result.studentCode.toUpperCase() : undefined
  };

  if (!supabase) return;
  const { error } = await supabase.from('results').insert({ 
    id: normalizedResult.id, 
    quiz_id: normalizedResult.quizId, 
    student_id: normalizedResult.studentId, 
    data: normalizedResult 
  });
  if (error) throw error;
};

export const deleteResult = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('results').delete().eq('id', id);
};

export const getStudentStats = async (studentId: string, studentCode?: string) => {
  const allResults = await getResults();
  
  // Lọc thông minh: Tìm theo ID HOẶC Mã học sinh
  const userResults = allResults.filter(r => 
    r.studentId === studentId || (studentCode && r.studentCode === studentCode.toUpperCase())
  );

  const totalQuizzes = userResults.length;
  const totalScore = userResults.reduce((acc, curr) => acc + (curr.score || 0), 0);
  const totalSeconds = userResults.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  
  return { 
    totalQuizzes, 
    avgScore: totalQuizzes > 0 ? (totalScore / totalQuizzes) : 0, 
    totalSeconds 
  };
};

// --- Chapters ---
export const getChapters = async (): Promise<Chapter[]> => {
  if (!supabase) {
      const local = localStorage.getItem('eduquiz_chapters');
      return local ? JSON.parse(local) : [];
  }
  const { data, error } = await supabase.from('chapters').select('data');
  if (error) {
    const local = localStorage.getItem('eduquiz_chapters');
    return local ? JSON.parse(local) : [];
  }
  return data.map((row: any) => row.data as Chapter).sort((a: Chapter, b: Chapter) => a.order - b.order);
};

export const saveChapter = async (chapter: Chapter): Promise<void> => {
  const currentLocal = await getChapters();
  localStorage.setItem('eduquiz_chapters', JSON.stringify([...currentLocal, chapter]));

  if (!supabase) return;
  const { error } = await supabase.from('chapters').insert({ id: chapter.id, grade: chapter.grade, data: chapter });
  if (error) throw error;
};

export const updateChapter = async (chapter: Chapter): Promise<void> => {
  const currentLocal = await getChapters();
  localStorage.setItem('eduquiz_chapters', JSON.stringify(currentLocal.map(c => c.id === chapter.id ? chapter : c)));

  if (!supabase) return;
  const { error } = await supabase.from('chapters').update({ data: chapter, grade: chapter.grade }).eq('id', chapter.id);
  if (error) throw error;
};

export const deleteChapter = async (id: string): Promise<void> => {
  const currentLocal = await getChapters();
  localStorage.setItem('eduquiz_chapters', JSON.stringify(currentLocal.filter(c => c.id !== id)));

  if (!supabase) return;
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  if (error) throw error;
};

export const initStorage = () => {
  console.log(supabase ? "Database Connected" : "Running Offline");
};
