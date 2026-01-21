
import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter, Question, ExamSession, PublishedResult } from '../types';

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

export const clearLocalCache = () => {
    localStorage.clear();
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
  const dbUsers = data.map((row: any) => ({ ...row.data, id: row.id } as User));
  saveLocalUsers(dbUsers);
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
      const idx = local.findIndex(u => u.id === normalizedUser.id);
      if (idx >= 0) local[idx] = normalizedUser; else local.push(normalizedUser);
      saveLocalUsers(local);
      return;
  }
  await supabase.from('users').upsert({ id: normalizedUser.id, username: normalizedUser.username, data: normalizedUser });
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  const searchCode = code.trim().toUpperCase();
  if (!supabase) return getLocalUsers().find(u => u.studentCode === searchCode);
  const { data } = await supabase.from('users').select('data').filter('data->>studentCode', 'eq', searchCode).maybeSingle();
  return data?.data as User;
};

export const findUser = async (username: string): Promise<User | undefined> => {
  const name = username.trim().toLowerCase();
  if (!supabase) return getLocalUsers().find(u => u.username === name);
  const { data } = await supabase.from('users').select('data').eq('username', name).maybeSingle();
  return data?.data as User;
};

export const deleteUser = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('users').delete().eq('id', id);
  const local = getLocalUsers();
  saveLocalUsers(local.filter(u => u.id !== id));
};

export const changePassword = async (userId: string, newPass: string): Promise<boolean> => {
  if (!supabase) return false;
  const { data } = await supabase.from('users').select('data').eq('id', userId).single();
  if (!data) return false;
  const updated = { ...data.data as User, password: newPass };
  const { error } = await supabase.from('users').update({ data: updated }).eq('id', userId);
  return !error;
};

// --- Quizzes ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('quizzes').select('data');
  return data ? data.map((row: any) => row.data as Quiz) : [];
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

// --- Results ---
export const getResults = async (): Promise<Result[]> => {
  if (!supabase) return getLocalResults();
  const { data } = await supabase.from('results').select('data');
  return data ? data.map((row: any) => row.data as Result) : getLocalResults();
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) {
    const local = getLocalResults();
    local.push(result);
    saveLocalResults(local);
    return;
  }
  await supabase.from('results').insert({ id: result.id, quiz_id: result.quizId, student_id: result.studentId, data: result });
};

export const deleteResult = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('results').delete().eq('id', id);
};

export const updateResultCode = async (id: string, code: string): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('results').select('data').eq('id', id).single();
    if (data) {
        const d = data.data as Result;
        d.studentCode = code.toUpperCase();
        await supabase.from('results').update({ data: d }).eq('id', id);
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

// --- Exam Sessions (Live Monitoring) ---
export const getExamSessions = async (): Promise<ExamSession[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('exam_sessions').select('data');
    return data ? data.map((row: any) => row.data as ExamSession) : [];
};

export const saveExamSession = async (session: ExamSession): Promise<void> => {
    if (!supabase) return;
    await supabase.from('exam_sessions').upsert({ id: session.id, data: session });
};

export const deleteExamSession = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('exam_sessions').delete().eq('id', id);
};

// --- Published Results ---
export const getPublishedResults = async (): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('published_results').select('data');
    return data ? data.map((row: any) => row.data as PublishedResult) : [];
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    if (!supabase) return;
    await supabase.from('published_results').upsert({ id: pub.id, data: pub });
};

// --- Chapters ---
export const getChapters = async (): Promise<Chapter[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('chapters').select('data');
  return data ? data.map((row: any) => row.data as Chapter).sort((a,b) => a.order - b.order) : [];
};

export const saveChapter = async (c: Chapter): Promise<void> => {
  if (supabase) await supabase.from('chapters').insert({ id: c.id, grade: c.grade, data: c });
};

export const deleteChapter = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('chapters').delete().eq('id', id);
};

// --- Bank ---
export const getBankQuestions = async (): Promise<Question[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('bank_questions').select('data');
    return data ? data.map((row: any) => row.data as Question) : [];
};

export const saveBankQuestion = async (q: Question): Promise<void> => {
    if (!supabase) return;
    await supabase.from('bank_questions').insert({ id: q.id, data: q });
};

export const initStorage = () => {
  console.log(supabase ? "Supabase Connected" : "Local Mode");
};
