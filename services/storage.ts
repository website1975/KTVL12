
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

// --- Helpers for Offline/Backup Mode ---
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

const saveLocalResult = (result: Result) => {
  const local = getLocalResults();
  if (!local.find(r => r.id === result.id)) {
    local.push(result);
    localStorage.setItem('eduquiz_results_backup', JSON.stringify(local));
  }
};

// Hàm dọn dẹp cache cục bộ (Dùng khi muốn xóa dữ liệu rác không còn trên Database)
export const clearLocalCache = () => {
    localStorage.removeItem('eduquiz_results_backup');
    localStorage.removeItem('eduquiz_users_offline');
    console.log("Local cache cleared.");
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
  const dbUsers = data.map((row: any) => ({ ...row.data, id: row.id } as User));
  
  const local = getLocalUsers();
  const merged = [...dbUsers];
  local.forEach(u => {
    if (!merged.find(m => m.studentCode === u.studentCode)) merged.push(u);
  });
  return merged;
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

export const addPointsToUser = async (userId: string, pointsToAdd: number, studentCode?: string): Promise<void> => {
  const normalizedCode = studentCode?.toUpperCase();
  const local = getLocalUsers();
  
  const user = local.find(u => u.id === userId || (normalizedCode && u.studentCode === normalizedCode));
  if (user) {
    user.points = (user.points || 0) + pointsToAdd;
    saveLocalUsers(local);
  }

  if (!supabase) {
    const stored = localStorage.getItem('eduquiz_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u.studentCode === normalizedCode) {
        u.points = (u.points || 0) + pointsToAdd;
        localStorage.setItem('eduquiz_current_user', JSON.stringify(u));
      }
    }
    return;
  }
  
  let query = supabase.from('users').select('id, data');
  if (normalizedCode) {
    query = query.filter('data->>studentCode', 'eq', normalizedCode);
  } else {
    query = query.eq('id', userId);
  }

  const { data: rows } = await query;
  if (rows && rows.length > 0) {
    const targetRow = rows[0];
    const userData = targetRow.data as User;
    userData.points = (userData.points || 0) + pointsToAdd;
    await supabase.from('users').update({ data: userData }).eq('id', targetRow.id);
    
    const stored = localStorage.getItem('eduquiz_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u.studentCode === normalizedCode) {
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

  // Xóa sạch cả kết quả luyện tập của học sinh này trong máy (Local Cache)
  const localResults = getLocalResults();
  const filteredLocalResults = localResults.filter(r => 
    r.studentId !== id && (!userToDelete?.studentCode || r.studentCode !== userToDelete.studentCode.toUpperCase())
  );
  localStorage.setItem('eduquiz_results_backup', JSON.stringify(filteredLocalResults));

  if (!supabase) return;

  try {
    // 1. Xóa trong bảng results (theo ID)
    await supabase.from('results').delete().eq('student_id', id);
    // 2. Xóa trong bảng results (theo Mã học sinh trong JSON data)
    if (userToDelete?.studentCode) {
      await supabase.from('results').delete().filter('data->>studentCode', 'eq', userToDelete.studentCode.toUpperCase());
    }
    // 3. Xóa user
    await supabase.from('users').delete().eq('id', id);
  } catch (error) {
    console.error("Lỗi khi xóa triệt để học sinh:", error);
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
  const local = getLocalResults();
  
  if (!supabase) return local;

  try {
    const { data, error } = await supabase.from('results').select('data');
    if (error) return local;
    const dbResults = data.map((row: any) => row.data as Result);
    
    // Nếu Online, ưu tiên dữ liệu DB. Chỉ lấy Local nếu bản ghi đó chưa có trên DB.
    const merged = [...dbResults];
    local.forEach(lr => {
        if (!merged.find(mr => mr.id === lr.id)) merged.push(lr);
    });
    return merged;
  } catch (e) {
    return local;
  }
};

export const saveResult = async (result: Result): Promise<void> => {
  const normalizedResult = {
    ...result,
    studentCode: result.studentCode ? result.studentCode.toUpperCase() : undefined
  };

  saveLocalResult(normalizedResult);

  if (!supabase) return;
  
  try {
    const { error } = await supabase.from('results').insert({ 
        id: normalizedResult.id, 
        quiz_id: normalizedResult.quizId, 
        student_id: normalizedResult.studentId, 
        data: normalizedResult 
      });
      if (error) console.warn("Lưu lên DB thất bại, nhưng đã lưu local backup.");
  } catch (err) {
      console.warn("Lỗi Supabase, đã lưu local backup.");
  }
};

export const deleteResult = async (id: string): Promise<void> => {
  const local = getLocalResults();
  localStorage.setItem('eduquiz_results_backup', JSON.stringify(local.filter(r => r.id !== id)));

  if (!supabase) return;
  await supabase.from('results').delete().eq('id', id);
};

export const getStudentStats = async (studentId: string, studentCode?: string) => {
  const allResults = await getResults();
  
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
