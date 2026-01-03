
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter } from '../types';

// Helper để lấy biến môi trường an toàn
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

// --- Storage (Ảnh) ---
export const uploadImage = async (file: File): Promise<string | null> => {
  if (!supabase) return null;
  try {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error: uploadError } = await supabase.storage
      .from('quiz-images')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('quiz-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (e) {
    console.error("Lỗi upload ảnh:", e);
    return null;
  }
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) return [];
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

export const deleteUser = async (id: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from('users').delete().eq('id', id);
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
  const { data: rows, error: fetchError } = await supabase
      .from('users')
      .select('data')
      .eq('id', userId)
      .single();
  
  if (fetchError || !rows) return false;
  const currentUser = rows.data as User;
  const updatedUser = { ...currentUser, password: newPass };

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
  if (error) return [];
  return data.map((row: any) => row.data as Quiz)
    .sort((a: Quiz, b: Quiz) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from('quizzes').insert({
    id: quiz.id,
    grade: quiz.grade,
    data: quiz
  });
};

export const updateQuiz = async (updatedQuiz: Quiz): Promise<void> => {
  if (!supabase) return;
  await supabase.from('quizzes')
    .update({ data: updatedQuiz, grade: updatedQuiz.grade })
    .eq('id', updatedQuiz.id);
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
  await supabase.from('results').insert({
    id: result.id,
    quiz_id: result.quizId,
    student_id: result.studentId,
    data: result
  });
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
  if (error) return [];
  return data.map((row: any) => row.data as Chapter).sort((a: Chapter, b: Chapter) => a.order - b.order);
};

export const saveChapter = async (chapter: Chapter): Promise<void> => {
  if (!supabase) {
      const chapters = await getChapters();
      localStorage.setItem('eduquiz_chapters', JSON.stringify([...chapters, chapter]));
      return;
  }
  await supabase.from('chapters').insert({
    id: chapter.id,
    grade: chapter.grade,
    data: chapter
  });
};

export const updateChapter = async (chapter: Chapter): Promise<void> => {
  if (!supabase) {
      const chapters = await getChapters();
      const updated = chapters.map(c => c.id === chapter.id ? chapter : c);
      localStorage.setItem('eduquiz_chapters', JSON.stringify(updated));
      return;
  }
  await supabase.from('chapters').update({ data: chapter, grade: chapter.grade }).eq('id', chapter.id);
};

export const deleteChapter = async (id: string): Promise<void> => {
  if (!supabase) {
      const chapters = await getChapters();
      const updated = chapters.filter(c => c.id !== id);
      localStorage.setItem('eduquiz_chapters', JSON.stringify(updated));
      return;
  }
  await supabase.from('chapters').delete().eq('id', id);
};

export const initStorage = () => {
  console.log(supabase ? "Database Connected" : "Running Offline");
};
