
/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter, Question, ExamSession, PublishedResult, Grade, ClassRoom } from '../types';
import { v4 as uuidv4 } from 'uuid';

let cleanedUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://lchfhsioxvgkjfsikycl.supabase.co').trim();
if (cleanedUrl.endsWith('/rest/v1') || cleanedUrl.endsWith('/rest/v1/')) {
    cleanedUrl = cleanedUrl.replace(/\/rest\/v1\/?$/, '');
}
const SUPABASE_URL = cleanedUrl;

const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaGZoc2lveHZna2pmc2lreWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTI3MDksImV4cCI6MjA4MDUyODcwOX0.toOc2ytPzo_cqhpQyd0YOLq4Zvk3BtfdZSziXN__j8Q').trim();

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

const handleSupabaseError = (error: any, context: string) => {
    if (error) {
        console.error(`LỖI SUPABASE [${context}]:`, error);
        throw new Error(`${context} thất bại: ${error.message || JSON.stringify(error)}`);
    }
};

// --- Results ---
export const getResultsMetadataPage = async (page: number, pageSize: number = 50, quizId?: string, search?: string): Promise<{ data: Result[], total: number }> => {
  if (!supabase) return { data: [], total: 0 };
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('results')
      .select('id, quiz_id, student_id, data', { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, to);
      
    if (quizId && quizId !== 'all') {
      query = query.eq('quiz_id', quizId);
    }

    if (search) {
      // Tìm kiếm theo tên học sinh hoặc mã học sinh lưu trong cột data (JSONB)
      query = query.or(`data->>studentName.ilike.%${search}%,data->>studentCode.ilike.%${search}%`);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    const results = data ? data.map((row: any) => ({
      ...(row.data as Result),
      id: row.id,
      quizId: row.quiz_id,
      studentId: row.student_id
    })) : [];

    return { data: results, total: count || 0 };
  } catch (e) {
    console.error("Lỗi getResultsMetadataPage:", e);
    return { data: [], total: 0 };
  }
};

export const getResultsMetadata = async (quizId?: string, maxRecords: number = 10000): Promise<Result[]> => {
  if (!supabase) return [];
  try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore && allData.length < maxRecords) {
          let query = supabase.from('results')
            .select('id, quiz_id, student_id, data')
            .order('id', { ascending: false })
            .range(from, from + step - 1);
            
          if (quizId && quizId !== 'all') {
            query = query.eq('quiz_id', quizId);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data && data.length > 0) {
              allData = [...allData, ...data];
              from += step;
              if (data.length < step) hasMore = false;
          } else {
              hasMore = false;
          }
      }
      
      return allData.map((row: any) => {
          const res = row.data as Result;
          return {
              ...res,
              id: row.id,
              quizId: row.quiz_id,
              studentId: row.student_id
          };
      });
  } catch (e) {
      console.error("Lỗi getResultsMetadata:", e);
      return [];
  }
};

export const getResultsCount = async (quizId?: string): Promise<number> => {
  if (!supabase) return 0;
  let query = supabase.from('results').select('*', { count: 'exact', head: true });
  if (quizId && quizId !== 'all') query = query.eq('quiz_id', quizId);
  const { count, error } = await query;
  return error ? 0 : (count || 0);
};

export const getResults = async (quizId?: string, maxRecords: number = 5000): Promise<Result[]> => {
  if (!supabase) return [];
  try {
      let allData: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore && allData.length < maxRecords) {
          let query = supabase.from('results')
            .select('data')
            .order('id', { ascending: false })
            .range(from, from + step - 1);
            
          if (quizId && quizId !== 'all') {
            query = query.eq('quiz_id', quizId);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          if (data && data.length > 0) {
              allData = [...allData, ...data];
              from += step;
              if (data.length < step) hasMore = false;
          } else {
              hasMore = false;
          }
      }
      return allData.map((row: any) => row.data as Result);
  } catch (e) {
      return [];
  }
};

export const getResultsForStudent = async (studentId: string, studentCode?: string): Promise<Result[]> => {
  if (!supabase) return [];
  let query = supabase.from('results')
    .select('data')
    .order('id', { ascending: false })
    .limit(500); // Lấy 500 bài gần nhất của học sinh này
    
  if (studentCode && studentCode !== 'N/A') {
    const code = studentCode.trim().toUpperCase();
    query = query.or(`student_id.eq.${studentId},data->>studentCode.eq.${code}`);
  } else {
    query = query.eq('student_id', studentId);
  }
  const { data, error } = await query;
  if (error) return [];
  return data.map((row: any) => row.data as Result);
};

export const verifyResultExists = async (id: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.from('results').select('id').eq('id', id).maybeSingle();
    return !!data;
};

export const getResultById = async (id: string): Promise<Result | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('results').select('data').eq('id', id).single();
    if (error || !data) return null;
    return data.data as Result;
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const payload = { id: result.id, quiz_id: result.quizId, student_id: result.studentId, data: result };
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
    const { data } = await supabase.from('results').select('data').eq('id', id).single();
    if (!data) return;
    const resData = { ...data.data, studentCode: code.trim().toUpperCase() };
    await supabase.from('results').update({ data: resData }).eq('id', id);
};

// --- Users ---
export const getUsersPage = async (page: number, pageSize: number = 50, search?: string): Promise<{ data: User[], total: number }> => {
  if (!supabase) return { data: [], total: 0 };
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('users')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, to);
    
    if (search) {
      // Lọc role student mặc định cho dashboard
      query = query.or(`data->>fullName.ilike.%${search}%,data->>studentCode.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    const users = data ? data.map((row: any) => ({ ...row.data, id: row.id } as User)) : [];
    return { data: users, total: count || 0 };
  } catch (e) {
    console.error("Lỗi getUsersPage:", e);
    return { data: [], total: 0 };
  }
};

export const getUsers = async (): Promise<User[]> => {
  if (!supabase) return [];
  try {
    let allUsers: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.from('users')
            .select('*')
            .range(from, from + step - 1);
        
        if (error) throw error;
        if (data && data.length > 0) {
            allUsers = [...allUsers, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    return allUsers.map((row: any) => ({ ...row.data, id: row.id } as User));
  } catch (e) {
    console.error("Lỗi getUsers:", e);
    return [];
  }
};

export const saveUser = async (user: User): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database Cloud");
  const payload = { id: user.id, username: user.username.toLowerCase().trim(), data: user };
  await supabase.from('users').upsert(payload);
};

export const saveUsersBatch = async (users: User[]): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database Cloud");
  if (users.length === 0) return;
  const payloads = users.map(user => ({
    id: user.id,
    username: user.username.toLowerCase().trim(),
    data: user
  }));
  const { error } = await supabase.from('users').upsert(payloads);
  handleSupabaseError(error, "Lưu danh sách học sinh");
};

export const addPointsToUser = async (userId: string, points: number): Promise<void> => {
    if (!supabase) return;
    const { data } = await supabase.from('users').select('data').eq('id', userId).single();
    if (data) {
      const userData = { ...data.data, points: (data.data.points || 0) + points };
      await supabase.from('users').update({ data: userData }).eq('id', userId);
    }
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  console.log("Supabase: Đang tìm User qua mã HS:", code.trim().toUpperCase());
  const { data, error } = await supabase.from('users').select('data').filter('data->>studentCode', 'eq', code.trim().toUpperCase()).maybeSingle();
  if (error) {
    console.error("Lỗi Supabase khi tìm mã HS:", error);
    return undefined;
  }
  console.log("Kết quả tìm kiếm User:", data);
  return data?.data as User;
};

export const findUser = async (username: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  console.log("Supabase: Đang tìm User qua username:", username.trim().toLowerCase());
  const { data, error } = await supabase.from('users').select('data').eq('username', username.trim().toLowerCase()).maybeSingle();
  if (error) {
    console.error("Lỗi Supabase khi tìm username:", error);
    return undefined;
  }
  console.log("Kết quả tìm kiếm User:", data);
  return data?.data as User;
};

export const testSupabaseConnection = async (): Promise<{success: boolean, message: string}> => {
    if (!supabase) return { success: false, message: "Supabase client not initialized" };
    console.log("Đang kiểm tra kết nối tới:", SUPABASE_URL);
    try {
        const { data, error } = await supabase.from('users').select('id').limit(1);
        if (error) {
            console.error("Lỗi PostgREST:", error);
            return { success: false, message: `Lỗi kết nối (${SUPABASE_URL}): ${error.message || JSON.stringify(error)}` };
        }
        return { success: true, message: `Kết nối OK. Tìm thấy ${data?.length || 0} bản ghi.` };
    } catch (e: any) {
        console.error("Lỗi Exception kết nối:", e);
        return { success: false, message: `Lỗi kết nối ngoại lệ: ${e.message}` };
    }
};

export const deleteUser = async (id: string): Promise<void> => {
  if (supabase) {
      // 1. Xóa tất cả các kết quả thi của người dùng này trước để tránh dữ liệu mồ côi
      const { error: resultsError } = await supabase.from('results').delete().eq('student_id', id);
      if (resultsError) {
          console.warn("Cảnh báo: Không thể xóa sạch kết quả thi của người dùng, nhưng vẫn tiến hành xóa tài khoản.", resultsError);
      }

      // 2. Xóa thông tin người dùng
      const { error } = await supabase.from('users').delete().eq('id', id);
      handleSupabaseError(error, "Xóa người dùng");
  }
};

export const changePassword = async (userId: string, newPassword: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.from('users').select('data').eq('id', userId).single();
    if (!data) return false;
    const userData = { ...data.data, password: newPassword };
    const { error } = await supabase.from('users').update({ data: userData }).eq('id', userId);
    return !error;
};

// --- Quizzes ---
export const getQuizzesMetadataPage = async (page: number, pageSize: number = 20, grade?: Grade): Promise<{ data: Quiz[], total: number }> => {
  if (!supabase) return { data: [], total: 0 };
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('quizzes')
      .select('id, grade, data', { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, to);
      
    if (grade && grade !== 'all') {
      query = query.or(`grade.eq.${grade},grade.eq.all`);
    }
    
    const { data, count, error } = await query;
    if (error) throw error;
    
    const quizzes = data ? data.map((row: any) => {
        const quiz = row.data as Quiz;
        return {
            ...quiz,
            id: row.id,
            grade: row.grade,
            attemptCount: quiz.attemptCount || 0,
            questions: []
        };
    }) : [];

    return { data: quizzes, total: count || 0 };
  } catch (e) {
    console.error("Lỗi getQuizzesMetadataPage:", e);
    return { data: [], total: 0 };
  }
};

export const getQuizzesMetadata = async (grade?: Grade): Promise<Quiz[]> => {
  if (!supabase) return [];
  try {
    let allQuizzes: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from('quizzes')
            .select('id, grade, data')
            .order('id', { ascending: false })
            .range(from, from + step - 1);
            
        if (grade && grade !== 'all') {
            query = query.or(`grade.eq.${grade},grade.eq.all`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
            allQuizzes = [...allQuizzes, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    
    return allQuizzes.map((row: any) => {
        const quiz = row.data as Quiz;
        return {
            ...quiz,
            id: row.id,
            grade: row.grade,
            attemptCount: quiz.attemptCount || 0,
            questions: [] // Không tải câu hỏi để tiết kiệm băng thông
        };
    });
  } catch (e) {
    console.error("Lỗi getQuizzesMetadata:", e);
    return [];
  }
};

export const getQuizzes = async (grade?: Grade): Promise<Quiz[]> => {
  if (!supabase) return [];
  try {
    let allQuizzes: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from('quizzes')
            .select('data')
            .order('id', { ascending: false })
            .range(from, from + step - 1);
            
        if (grade && grade !== 'all') {
            query = query.or(`grade.eq.${grade},grade.eq.all`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
            allQuizzes = [...allQuizzes, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    return allQuizzes.map((row: any) => row.data as Quiz);
  } catch (e) {
    return [];
  }
};

export const getQuizById = async (id: string): Promise<Quiz | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('quizzes').select('data').eq('id', id).single();
    if (error || !data) return null;
    return data.data as Quiz;
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const enrichedQuiz = { 
    ...quiz, 
    questionCount: quiz.questions.length,
    isSyncedToBank: quiz.isSyncedToBank ?? false 
  };
  const { error } = await supabase.from('quizzes').insert({ id: quiz.id, grade: quiz.grade, data: enrichedQuiz });
  handleSupabaseError(error, "Lưu đề thi mới");
};

export const updateQuiz = async (enrichedQuiz: Quiz): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const quiz = { ...enrichedQuiz, questionCount: enrichedQuiz.questions.length };
  const { error } = await supabase.from('quizzes').update({ data: quiz, grade: enrichedQuiz.grade }).eq('id', enrichedQuiz.id);
  handleSupabaseError(error, "Cập nhật đề thi");
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (supabase) {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      handleSupabaseError(error, "Xóa đề thi");
  }
};

// CÔNG CỤ ĐỒNG BỘ: Quét lại toàn bộ đề thi để cập nhật số câu chính xác
export const syncAllQuizzesMetadata = async (): Promise<number> => {
  if (!supabase) return 0;
  try {
    const { data: allQuizzes, error } = await supabase.from('quizzes').select('*');
    if (error || !allQuizzes) return 0;
    
    let count = 0;
    for (const row of allQuizzes) {
      const quiz = row.data as Quiz;
      const questionCount = quiz.questions ? quiz.questions.length : 0;
      const updatedQuiz = { ...quiz, questionCount };
      
      await supabase.from('quizzes').update({ 
          data: updatedQuiz, 
          grade: quiz.grade 
      }).eq('id', row.id);
      count++;
    }
    return count;
  } catch (e) {
    console.error("Lỗi đồng bộ Metadata:", e);
    return 0;
  }
};

// --- Chapters ---
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

// --- Classroom & Academic Year Management ---
export const getClasses = async (): Promise<ClassRoom[]> => {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('classes').select('*');
      if (!error && data && data.length > 0) {
        const classes = data.map((row: any) => ({
          ...(row.data || {}),
          id: row.id,
          name: row.name || (row.data && row.data.name) || '',
          academicYear: row.academic_year || (row.data && row.data.academicYear) || '',
          grade: row.grade || (row.data && row.data.grade) || '12',
          description: row.description || (row.data && row.data.description) || ''
        } as ClassRoom));
        
        // Cache to localStorage for fast offline read
        try {
          localStorage.setItem('eduquiz_classes_cache', JSON.stringify(classes));
        } catch (e) {}
        return classes;
      }
    } catch (e) {
      console.warn("Chưa có bảng classes trên Supabase hoặc lỗi đọc, fallback sang cache/local:", e);
    }
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem('eduquiz_classes_cache');
    if (local) return JSON.parse(local);
  } catch (e) {}
  return [];
};

export const saveClass = async (c: ClassRoom): Promise<void> => {
  // Update local cache first
  try {
    const list = await getClasses();
    const idx = list.findIndex(item => item.id === c.id);
    if (idx >= 0) list[idx] = c;
    else list.push(c);
    localStorage.setItem('eduquiz_classes_cache', JSON.stringify(list));
  } catch (e) {}

  if (supabase) {
    try {
      await supabase.from('classes').upsert({ 
        id: c.id, 
        name: c.name,
        academic_year: c.academicYear,
        grade: c.grade,
        data: c 
      });
    } catch (e) {
      console.warn("Lưu classes vào Supabase (bảng có thể chưa tạo):", e);
    }
  }
};

export const saveClassesBatch = async (classesList: ClassRoom[]): Promise<void> => {
  if (classesList.length === 0) return;
  try {
    localStorage.setItem('eduquiz_classes_cache', JSON.stringify(classesList));
  } catch (e) {}

  if (supabase) {
    try {
      const payload = classesList.map(c => ({
        id: c.id,
        name: c.name,
        academic_year: c.academicYear,
        grade: c.grade,
        data: c
      }));
      await supabase.from('classes').upsert(payload);
    } catch (e) {
      console.warn("Lưu batch classes vào Supabase:", e);
    }
  }
};

export const deleteClass = async (id: string): Promise<void> => {
  try {
    const list = await getClasses();
    const updated = list.filter(item => item.id !== id);
    localStorage.setItem('eduquiz_classes_cache', JSON.stringify(updated));
  } catch (e) {}

  if (supabase) {
    try {
      await supabase.from('classes').delete().eq('id', id);
    } catch (e) {
      console.warn("Xóa class trên Supabase:", e);
    }
  }
};

// Gán học sinh vào lớp hàng loạt
export const assignStudentsToClass = async (studentIds: string[], classInfo: { classId?: string; className?: string; academicYear?: string; grade?: Grade } | null): Promise<number> => {
  if (!supabase || studentIds.length === 0) return 0;
  try {
    const allUsers = await getUsers();
    const targetUsers = allUsers.filter(u => studentIds.includes(u.id));
    
    const updatedUsers: User[] = targetUsers.map(u => ({
      ...u,
      classId: classInfo?.classId || undefined,
      className: classInfo?.className || undefined,
      academicYear: classInfo?.academicYear || undefined,
      grade: classInfo?.grade || u.grade
    }));

    await saveUsersBatch(updatedUsers);
    return updatedUsers.length;
  } catch (e) {
    console.error("Lỗi gán học sinh vào lớp:", e);
    throw e;
  }
};

// --- Question Bank ---
export const getBankQuestions = async (): Promise<Question[]> => {
    if (!supabase) return [];
    try {
        let allQuestions: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase.from('bank_questions')
                .select('data')
                .range(from, from + step - 1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                allQuestions = [...allQuestions, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        return allQuestions.map((row: any) => row.data as Question);
    } catch (e) {
        console.error("Lỗi lấy ngân hàng câu hỏi:", e);
        return [];
    }
};

// Hàm tạo mã băm/fingerprint nội dung câu hỏi để nhận diện trùng lặp
export const getQuestionFingerprint = (q: Question): string => {
    const normalize = (str: string) => (str || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const type = (q.type || 'mcq').toLowerCase().replace('_', '-');
    const text = normalize(q.text);
    
    // Đối với MCQ: so sánh thêm các options
    let optionsKey = '';
    if (type === 'mcq' && q.options) {
        optionsKey = q.options.map(opt => normalize(opt)).sort().join('|');
    }
    
    // Đối với Group-TF: so sánh các subQuestions
    let subKey = '';
    if (type === 'group-tf' && q.subQuestions) {
        subKey = q.subQuestions.map(sq => `${normalize(sq.text)}:${sq.correctAnswer || ''}`).join('|');
    }

    return `${type}:::${text}:::${optionsKey}:::${subKey}`;
};

export const syncQuizzesToBank = async (forceAll: boolean = false): Promise<{ 
    total: number, 
    added: number, 
    skipped: number, 
    updated: number, 
    syncedQuizzesCount: number,
    totalQuizzes: number 
}> => {
    if (!supabase) return { total: 0, added: 0, skipped: 0, updated: 0, syncedQuizzesCount: 0, totalQuizzes: 0 };
    try {
        // 1. Lấy tất cả đề thi từ database
        const { data: quizRows, error: quizError } = await supabase.from('quizzes').select('id, grade, data');
        if (quizError || !quizRows) return { total: 0, added: 0, skipped: 0, updated: 0, syncedQuizzesCount: 0, totalQuizzes: 0 };

        const totalQuizzes = quizRows.length;
        
        // Lọc ra các đề chưa được gắn cờ đồng bộ (nếu forceAll = true thì quét toàn bộ)
        const pendingQuizRows = forceAll 
            ? quizRows 
            : quizRows.filter((r: any) => {
                const qz = r.data as Quiz;
                return !qz.isSyncedToBank;
            });

        if (pendingQuizRows.length === 0) {
            return { total: 0, added: 0, skipped: 0, updated: 0, syncedQuizzesCount: 0, totalQuizzes };
        }

        // 2. Lấy tất cả câu hỏi hiện có trong kho ngân hàng để đối chiếu
        const existingBankQuestions = await getBankQuestions();
        const existingIdSet = new Set<string>();
        const existingFingerprintMap = new Map<string, Question>();
        
        existingBankQuestions.forEach(bq => {
            existingIdSet.add(bq.id);
            if (bq.bankOriginId) existingIdSet.add(bq.bankOriginId);
            const fp = getQuestionFingerprint(bq);
            existingFingerprintMap.set(fp, bq);
        });

        const questionsToSave: Question[] = [];
        let totalScanned = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        let addedCount = 0;

        const currentBatchFingerprints = new Set<string>();

        for (const row of pendingQuizRows) {
            const quiz = row.data as Quiz;
            if (quiz.questions && Array.isArray(quiz.questions)) {
                quiz.questions.forEach(q => {
                    totalScanned++;

                    // Ưu tiên 1: Kiểm tra vết ID gốc (bankOriginId) - Siêu nhanh O(1)
                    if (q.bankOriginId && existingIdSet.has(q.bankOriginId)) {
                        skippedCount++;
                        return;
                    }

                    const fp = getQuestionFingerprint(q);
                    
                    // Nếu câu hỏi đã xuất hiện trong lượt quét của đợt này -> bỏ qua trùng lặp trong đề
                    if (currentBatchFingerprints.has(fp)) {
                        skippedCount++;
                        return;
                    }
                    currentBatchFingerprints.add(fp);

                    // Ưu tiên 2: Kiểm tra theo nội dung đối với các câu hỏi mới nạp từ PDF/JSON
                    const existingQ = existingFingerprintMap.get(fp);
                    if (existingQ) {
                        // Nếu câu hỏi đã có, kiểm tra xem bản mới có thông tin phong phú hơn không (VD: có thêm level hoặc solution)
                        const hasNewLevel = (!existingQ.level && q.level);
                        const hasNewSolution = (!existingQ.solution && q.solution);
                        
                        if (hasNewLevel || hasNewSolution) {
                            const enriched: Question = {
                                ...existingQ,
                                level: q.level || existingQ.level,
                                solution: q.solution || existingQ.solution,
                                quizTitle: quiz.title || existingQ.quizTitle,
                                quizGrade: quiz.grade || existingQ.quizGrade,
                                quizCategory: quiz.category || existingQ.quizCategory
                            };
                            questionsToSave.push(enriched);
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // Câu hỏi hoàn toàn mới chưa có trong Ngân hàng -> Thêm mới
                        const newQ: Question = {
                            ...q,
                            quizTitle: quiz.title,
                            quizGrade: quiz.grade,
                            quizCategory: quiz.category
                        };
                        questionsToSave.push(newQ);
                        existingFingerprintMap.set(fp, newQ);
                        if (newQ.id) existingIdSet.add(newQ.id);
                        addedCount++;
                    }
                });
            }
        }

        // 3. Lưu câu hỏi mới/cập nhật vào bank_questions
        if (questionsToSave.length > 0) {
            const chunkSize = 50;
            for (let i = 0; i < questionsToSave.length; i += chunkSize) {
                const chunk = questionsToSave.slice(i, i + chunkSize);
                const payload = chunk.map(q => ({ id: q.id, data: q }));
                await supabase.from('bank_questions').upsert(payload);
            }
        }

        // 4. Gắn cờ isSyncedToBank: true cho các đề thi vừa được quét xong
        const nowIso = new Date().toISOString();
        for (const row of pendingQuizRows) {
            const quiz = row.data as Quiz;
            const updatedQuiz: Quiz = {
                ...quiz,
                isSyncedToBank: true,
                syncedToBankAt: nowIso
            };
            await supabase.from('quizzes').update({
                data: updatedQuiz,
                grade: row.grade || quiz.grade
            }).eq('id', row.id);
        }

        return { 
            total: totalScanned, 
            added: addedCount, 
            skipped: skippedCount, 
            updated: updatedCount, 
            syncedQuizzesCount: pendingQuizRows.length,
            totalQuizzes 
        };
    } catch (e) {
        console.error("Lỗi đồng bộ về Ngân hàng:", e);
        return { total: 0, added: 0, skipped: 0, updated: 0, syncedQuizzesCount: 0, totalQuizzes: 0 };
    }
};

export const saveBankQuestion = async (q: Question): Promise<void> => {
    if (!supabase) return;
    try {
        const fp = getQuestionFingerprint(q);
        const existing = await getBankQuestions();
        const found = existing.find(item => getQuestionFingerprint(item) === fp);
        const finalId = found ? found.id : q.id;
        await supabase.from('bank_questions').upsert({ id: finalId, data: { ...q, id: finalId } });
    } catch (e) {
        console.warn("Lỗi lưu bank question:", e);
    }
};

export const uploadQuizImage = async (file: File): Promise<string> => {
    if (!supabase) return '';
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${uuidv4()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('quiz-images').upload(fileName, file);
      if (uploadError) return '';
      const { data } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (err) { return ''; }
};

export const getPublishedResults = async (limit: number = 20): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('published_results').select('data').order('id', { ascending: false }).limit(limit);
    return data ? data.map((row: any) => row.data as PublishedResult) : [];
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    if (supabase) await supabase.from('published_results').upsert({ id: pub.id, data: pub });
};

export const deletePublishedResult = async (id: string): Promise<void> => {
    if (supabase) await supabase.from('published_results').delete().eq('id', id);
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

export const getStudentActiveSessions = async (studentId: string): Promise<ExamSession[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('exam_sessions').select('data').filter('data->>studentId', 'eq', studentId);
    return data ? data.map((row: any) => row.data as ExamSession) : [];
};

export const clearAllSessions = async () => {
    if (supabase) await supabase.from('exam_sessions').delete().neq('id', 'null');
};

export const initStorage = () => {};
export const clearLocalCache = () => { localStorage.clear(); window.location.reload(); };
