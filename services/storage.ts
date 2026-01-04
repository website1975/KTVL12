
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
  // Save to Local first for safety
  const local = getLocalUsers();
  const existingIdx = local.findIndex(u => u.id === user.id || (u.studentCode && u.studentCode === user.studentCode));
  if (existingIdx >= 0) {
    local[existingIdx] = user;
  } else {
    local.push(user);
  }
  saveLocalUsers(local);

  if (!supabase) return;
  const { error } = await supabase.from('users').upsert({ 
    id: user.id, 
    username: user.studentCode || user.username, 
    data: user 
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
  const local = getLocalUsers();
  const localFound = local.find(u => u.username === username);
  if (localFound) return localFound;

  if (!supabase) return undefined;
  const { data, error } = await supabase.from('users').select('data').eq('username', username).single();
  if (error || !data) return undefined;
  return data.data as User;
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  const local = getLocalUsers();
  const localFound = local.find(u => u.studentCode === code.toUpperCase());
  if (localFound) return localFound;

  if (!supabase) return undefined;
  const { data, error } = await supabase
    .from('users')
    .select('data')
    .filter('data->>studentCode', 'eq', code.toUpperCase())
    .maybeSingle();
  
  if (error || !data) return undefined;
  return data.data as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  const local = getLocalUsers().filter(u => u.id !== id);
  saveLocalUsers(local);

  if (!supabase) return;
  await supabase.from('users').delete().eq('id', id);
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
  if (!supabase) return;
  const { error } = await supabase.from('results').insert({ id: result.id, quiz_id: result.quizId, student_id: result.studentId, data: result });
  if (error) throw error;
};

export const deleteResult = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('results').delete().eq('id', id);
};

export const getStudentStats = async (studentId: string) => {
  if (!supabase) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };
  const { data } = await supabase.from('results').select('data').eq('student_id', studentId);
  if (!data) return { totalQuizzes: 0, avgScore: 0, totalSeconds: 0 };
  const resultsList = data.map((row: any) => row.data as Result);
  const totalQuizzes = resultsList.length;
  const totalScore = resultsList.reduce((acc: number, curr: Result) => acc + (curr.score || 0), 0);
  const totalSeconds = resultsList.reduce((acc: number, curr: Result) => acc + (curr.durationSeconds || 0), 0);
  return { totalQuizzes, avgScore: totalQuizzes > 0 ? (totalScore / totalQuizzes) : 0, totalSeconds };
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
