
/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';
import { User, Quiz, Result, Chapter, Lesson, QuizFolder, Question, QuestionType, ExamSession, PublishedResult, Grade, ClassRoom } from '../types';
import { v4 as uuidv4 } from 'uuid';

let cleanedUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://lchfhsioxvgkjfsikycl.supabase.co').trim();
if (cleanedUrl.endsWith('/rest/v1') || cleanedUrl.endsWith('/rest/v1/')) {
    cleanedUrl = cleanedUrl.replace(/\/rest\/v1\/?$/, '');
}
const SUPABASE_URL = cleanedUrl;

const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaGZoc2lveHZna2pmc2lreWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTI3MDksImV4cCI6MjA4MDUyODcwOX0.toOc2ytPzo_cqhpQyd0YOLq4Zvk3BtfdZSziXN__j8Q').trim();

export let supabase: any = null;

try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Lỗi khởi tạo Supabase:", e);
}

// Helper timeout an toàn để Supabase không bao giờ làm treo UI hoặc quay vô tận
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 6000, fallback: T): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[Supabase Timeout] Truy vấn vượt quá ${timeoutMs}ms, tự động chuyển về dữ liệu dự phòng`);
      resolve(fallback);
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    console.warn("[Supabase Catch Error]", err);
    return fallback;
  }
};

export const isDatabaseConnected = (): boolean => {
    return !!supabase;
};

/**
 * Chuẩn hóa và làm sạch dữ liệu trước khi lưu vào Supabase JSONB / PostgreSQL
 * Triệt tiêu hoàn toàn lỗi: "unsupported Unicode escape sequence"
 * 1. Xóa ký tự null (\u0000, \0, \\u0000)
 * 2. Xóa các ký tự điều khiển không in được (control characters 0x00-0x1F ngoại trừ tab, \n, \r)
 * 3. Xóa các ký tự lone surrogates (\uD800 - \uDFFF) bị lỗi
 */
export function sanitizeForJsonB<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return (obj as string)
      .replace(/\0/g, '')
      .replace(/\\u0000/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '') as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForJsonB(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = typeof key === 'string'
        ? key.replace(/\0/g, '').replace(/\\u0000/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '')
        : key;
      cleaned[cleanKey] = sanitizeForJsonB(value);
    }
    return cleaned as T;
  }
  return obj;
}

const handleSupabaseError = (error: any, context: string) => {
    if (error) {
        console.error(`LỖI SUPABASE [${context}]:`, error);
        throw new Error(`${context} thất bại: ${error.message || JSON.stringify(error)}`);
    }
};

export const RESULT_METADATA_PROJECTION = 'id,quiz_id,student_id,score:data->>score,studentName:data->>studentName,studentCode:data->>studentCode,durationSeconds:data->>durationSeconds,submittedAt:data->>submittedAt,totalQuestions:data->>totalQuestions,correctCount:data->>correctCount,wrongCount:data->>wrongCount,unansweredCount:data->>unansweredCount,grade:data->>grade,classId:data->>classId,className:data->>className,academicYear:data->>academicYear,quizId:data->>quizId,quizTitle:data->>quizTitle,quizCategory:data->>quizCategory,quizType:data->>quizType,bonusPoint:data->>bonusPoint';

const mapRowToResultMeta = (row: any): Result => {
    if (!row) return {} as Result;
    const d = (row.data && typeof row.data === 'object') ? row.data : row;

    const rawStudentName = row.studentName || d.studentName || row['data->studentName'] || row['data->>studentName'] || 'Học sinh';
    const rawStudentCode = row.studentCode || d.studentCode || row['data->studentCode'] || row['data->>studentCode'] || 'N/A';
    const rawQuizTitle = row.quizTitle || d.quizTitle || d.title || row['data->quizTitle'] || row['data->>quizTitle'] || '';
    const rawQuizCategory = row.quizCategory || d.quizCategory || d.category || row['data->quizCategory'] || row['data->>quizCategory'] || '';
    const rawQuizType = row.quizType || d.quizType || d.type || row['data->quizType'] || row['data->>quizType'] || '';

    const scoreVal = row.score !== undefined ? row.score : (d.score !== undefined ? d.score : (row['data->score'] !== undefined ? row['data->score'] : row['data->>score']));
    const durationVal = row.durationSeconds !== undefined ? row.durationSeconds : (d.durationSeconds !== undefined ? d.durationSeconds : (row['data->durationSeconds'] !== undefined ? row['data->durationSeconds'] : row['data->>durationSeconds']));
    const submittedVal = row.submittedAt || d.submittedAt || row['data->submittedAt'] || row['data->>submittedAt'] || new Date().toISOString();
    const totalQVal = row.totalQuestions !== undefined ? row.totalQuestions : (d.totalQuestions !== undefined ? d.totalQuestions : (row['data->totalQuestions'] !== undefined ? row['data->totalQuestions'] : row['data->>totalQuestions']));
    const bonusVal = row.bonusPoint !== undefined ? row.bonusPoint : (d.bonusPoint !== undefined ? d.bonusPoint : (row['data->bonusPoint'] !== undefined ? row['data->bonusPoint'] : row['data->>bonusPoint']));

    return {
        id: String(row.id || d.id || ''),
        quizId: String(row.quiz_id || d.quizId || row.quizId || ''),
        studentId: String(row.student_id || d.studentId || row.studentId || ''),
        studentName: String(rawStudentName),
        studentCode: String(rawStudentCode),
        quizTitle: String(rawQuizTitle),
        quizCategory: String(rawQuizCategory),
        quizType: String(rawQuizType),
        score: typeof scoreVal === 'number' ? scoreVal : (parseFloat(scoreVal) || 0),
        durationSeconds: typeof durationVal === 'number' ? durationVal : (parseInt(durationVal) || 0),
        submittedAt: String(submittedVal),
        totalQuestions: typeof totalQVal === 'number' ? totalQVal : (parseInt(totalQVal) || 0),
        correctCount: typeof row.correctCount === 'number' ? row.correctCount : (typeof d.correctCount === 'number' ? d.correctCount : (parseInt(row.correctCount || d.correctCount) || 0)),
        wrongCount: typeof row.wrongCount === 'number' ? row.wrongCount : (typeof d.wrongCount === 'number' ? d.wrongCount : (parseInt(row.wrongCount || d.wrongCount) || 0)),
        unansweredCount: typeof row.unansweredCount === 'number' ? row.unansweredCount : (typeof d.unansweredCount === 'number' ? d.unansweredCount : (parseInt(row.unansweredCount || d.unansweredCount) || 0)),
        grade: String(row.grade || d.grade || '12') as Grade,
        classId: row.classId || d.classId || '',
        className: row.className || d.className || '',
        academicYear: row.academicYear || d.academicYear || '',
        bonusPoint: bonusVal !== undefined ? Number(bonusVal) : 0,
        userAnswers: {},
        questions: []
    } as Result;
};

// --- Results ---
export const getResultsMetadataPage = async (page: number, pageSize: number = 50, quizId?: string, search?: string): Promise<{ data: Result[], total: number }> => {
  if (!supabase) return { data: [], total: 0 };
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('results')
      .select(RESULT_METADATA_PROJECTION, { count: 'exact' })
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
    
    const results = data ? data.map(mapRowToResultMeta) : [];

    return { data: results, total: count || 0 };
  } catch (e) {
    console.error("Lỗi getResultsMetadataPage:", e);
    return { data: [], total: 0 };
  }
};

export const getResultsMetadata = async (quizId?: string, maxRecords: number = 1000, forceRefresh: boolean = false): Promise<Result[]> => {
  if (!supabase) return [];
  const cacheKey = `results_meta_${quizId || 'all'}_${maxRecords}`;
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }
  try {
      let query = supabase.from('results')
        .select(RESULT_METADATA_PROJECTION)
        .order('id', { ascending: false });
        
      if (quizId && quizId !== 'all') {
        query = query.or(`quiz_id.eq.${quizId},data->>quizId.eq.${quizId}`);
      }

      query = query.limit(maxRecords);
      
      const { data, error } = await query;
      if (error) {
        console.warn("Lỗi fetch results meta:", error);
        return [];
      }
      
      const mapped = (data || []).map(mapRowToResultMeta);
      memoryCache[cacheKey] = { data: mapped, expires: now + CACHE_TTL };
      return mapped;
  } catch (e) {
      console.error("Lỗi getResultsMetadata:", e);
      return [];
  }
};
/**
 * Lấy tất cả kết quả nộp bài của danh sách học sinh theo MAHS (studentCode) và student_id.
 * Giúp màn hình Thống kê Lớp học đối soát CHUẨN XÁC 100% bằng MAHS cho từng học sinh.
 */
export const getResultsForStudents = async (
  studentCodes: string[] = [],
  studentIds: string[] = []
): Promise<Result[]> => {
  if (!supabase) return [];
  const cleanCodes = studentCodes.map(c => c.trim().toUpperCase()).filter(Boolean);
  const cleanIds = studentIds.map(i => i.trim()).filter(Boolean);

  if (cleanCodes.length === 0 && cleanIds.length === 0) return [];

  try {
    const resultsMap = new Map<string, Result>();

    // 1. Lấy theo student_id IN (...)
    if (cleanIds.length > 0) {
      const { data: dataById, error: errById } = await supabase
        .from('results')
        .select(RESULT_METADATA_PROJECTION)
        .in('student_id', cleanIds)
        .order('id', { ascending: false });

      if (!errById && dataById) {
        dataById.map(mapRowToResultMeta).forEach((r: Result) => {
          if (r && r.id) resultsMap.set(r.id, r);
        });
      }
    }

    // 2. Lấy theo MAHS (data->>studentCode)
    if (cleanCodes.length > 0) {
      const { data: dataByCode, error: errByCode } = await supabase
        .from('results')
        .select(RESULT_METADATA_PROJECTION)
        .in('data->>studentCode', cleanCodes)
        .order('id', { ascending: false });

      if (!errByCode && dataByCode) {
        dataByCode.map(mapRowToResultMeta).forEach((r: Result) => {
          if (r && r.id) resultsMap.set(r.id, r);
        });
      }
    }

    return Array.from(resultsMap.values());
  } catch (e) {
    console.error("Lỗi getResultsForStudents:", e);
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

export const getResults = async (quizId?: string, maxRecords: number = 500): Promise<Result[]> => {
  if (!supabase) return [];
  try {
      let query = supabase.from('results')
        .select('id, quiz_id, student_id, data')
        .order('id', { ascending: false })
        .limit(maxRecords);
        
      if (quizId && quizId !== 'all') {
        query = query.eq('quiz_id', quizId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((row: any) => (row.data || row) as Result);
  } catch (e) {
      return [];
  }
};

export const getResultsForStudent = async (studentId: string, studentCode?: string, forceRefresh: boolean = false): Promise<Result[]> => {
  if (!supabase) return [];
  const cacheKey = `student_results_${studentId}_${studentCode || 'na'}`;
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }
  let query = supabase.from('results')
    .select('id, quiz_id, student_id, data')
    .order('id', { ascending: false })
    .limit(100); // Lấy 100 bài gần nhất của học sinh (tiết kiệm băng thông tối đa)
    
  if (studentCode && studentCode !== 'N/A') {
    const code = studentCode.trim().toUpperCase();
    query = query.or(`student_id.eq.${studentId},data->>studentCode.eq.${code}`);
  } else {
    query = query.eq('student_id', studentId);
  }
  const { data, error } = await query;
  if (error) return [];
  const result = data ? data.map(mapRowToResultMeta) : [];
  memoryCache[cacheKey] = { data: result, expires: now + CACHE_TTL };
  return result;
};

export const verifyResultExists = async (id: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data } = await supabase.from('results').select('id').eq('id', id).maybeSingle();
    return !!data;
};

export const getResultById = async (id: string): Promise<Result | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.from('results').select('data').eq('id', id).limit(1);
      if (error || !data || data.length === 0) return null;
      return (data[0].data || data[0]) as Result;
    } catch (e) {
      return null;
    }
};

export const saveResult = async (result: Result): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  invalidateCache('student_results');
  invalidateCache('published_results');
  const sanitizedResult = sanitizeForJsonB(result);
  const payload = { id: sanitizedResult.id, quiz_id: sanitizedResult.quizId, student_id: sanitizedResult.studentId, data: sanitizedResult };
  const { error } = await supabase.from('results').insert(payload);
  handleSupabaseError(error, "Lưu kết quả thi");
};

export const deleteResult = async (id: string): Promise<void> => {
    if (supabase) {
        invalidateCache('student_results');
        invalidateCache('published_results');
        const { error } = await supabase.from('results').delete().eq('id', id);
        handleSupabaseError(error, "Xóa kết quả");
    }
};

export const updateResultCode = async (id: string, code: string): Promise<void> => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('results').select('data').eq('id', id).limit(1);
      if (!data || data.length === 0 || !data[0]?.data) return;
      const resData = { ...data[0].data, studentCode: code.trim().toUpperCase() };
      await supabase.from('results').update({ data: resData }).eq('id', id);
    } catch (e) {
      console.warn("Lỗi updateResultCode:", e);
    }
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

export const getUsers = async (forceRefresh: boolean = false): Promise<User[]> => {
  if (!supabase) return [];
  const cacheKey = 'users_all';
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }
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
    const result = allUsers.map((row: any) => ({ ...row.data, id: row.id } as User));
    memoryCache[cacheKey] = { data: result, expires: now + CACHE_TTL };
    return result;
  } catch (e) {
    console.error("Lỗi getUsers:", e);
    return [];
  }
};

export const saveUser = async (user: User): Promise<void> => {
  invalidateCache('users_all');
  if (!supabase) throw new Error("Mất kết nối Database Cloud");
  const payload = { id: user.id, username: user.username.toLowerCase().trim(), data: user };
  await supabase.from('users').upsert(payload);
};

export const saveUsersBatch = async (users: User[]): Promise<void> => {
  invalidateCache('users_all');
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
    try {
      const { data } = await supabase.from('users').select('data').eq('id', userId).limit(1);
      if (data && data.length > 0 && data[0]?.data) {
        const userData = { ...data[0].data, points: (data[0].data.points || 0) + points };
        await supabase.from('users').update({ data: userData }).eq('id', userId);
      }
    } catch (e) {
      console.warn("Lỗi addPointsToUser:", e);
    }
};

export const findUserByStudentCode = async (code: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  const cleanCode = code.trim();
  const upperCode = cleanCode.toUpperCase();
  console.log("Supabase: Đang tìm User qua mã HS:", upperCode);
  try {
    // Sử dụng limit(1) thay cho maybeSingle() để tránh lỗi PGRST116 nếu CSDL có nhiều bản ghi trùng mã
    const { data, error } = await supabase
      .from('users')
      .select('data')
      .or(`data->>studentCode.eq.${upperCode},data->>studentCode.eq.${cleanCode}`)
      .limit(1);

    if (error) {
      console.error("Lỗi Supabase khi tìm mã HS:", error);
      return undefined;
    }
    const user = (data && data.length > 0) ? (data[0].data as User) : undefined;
    console.log("Kết quả tìm kiếm User:", user);
    return user;
  } catch (e) {
    console.error("Lỗi ngoại lệ khi tìm mã HS:", e);
    return undefined;
  }
};

export const findUser = async (username: string): Promise<User | undefined> => {
  if (!supabase) return undefined;
  const cleanUser = username.trim().toLowerCase();
  console.log("Supabase: Đang tìm User qua username:", cleanUser);
  try {
    // Sử dụng limit(1) thay cho maybeSingle() để an toàn và tối ưu
    const { data, error } = await supabase
      .from('users')
      .select('data')
      .eq('username', cleanUser)
      .limit(1);

    if (error) {
      console.error("Lỗi Supabase khi tìm username:", error);
      return undefined;
    }
    const user = (data && data.length > 0) ? (data[0].data as User) : undefined;
    console.log("Kết quả tìm kiếm User:", user);
    return user;
  } catch (e) {
    console.error("Lỗi ngoại lệ khi tìm username:", e);
    return undefined;
  }
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
    try {
      const { data } = await supabase.from('users').select('data').eq('id', userId).limit(1);
      if (!data || data.length === 0 || !data[0]?.data) return false;
      const userData = { ...data[0].data, password: newPassword };
      const { error } = await supabase.from('users').update({ data: userData }).eq('id', userId);
      return !error;
    } catch (e) {
      return false;
    }
};

// Định nghĩa các trường Metadata của Đề thi (chỉ lấy thông tin hiển thị, KHÔNG LẤY cột câu hỏi để giảm 98% băng thông)
const QUIZ_METADATA_PROJECTION = 'id,grade,data->title,data->description,data->type,data->academicYear,data->category,data->folderId,data->folderName,data->startTime,data->endTime,data->durationMinutes,data->questionCount,data->attemptCount,data->createdAt,data->isPublished,data->isMonitored,data->isUnlisted,data->targetType,data->assignedClassIds,data->assignedClasses,data->maxAttempts,data->allowReview,data->orderIndex,data->isSyncedToBank,data->syncedToBankAt';

const mapRowToQuizMeta = (row: any): Quiz => {
    const d = (row && row.data && typeof row.data === 'object') ? row.data : (row || {});
    return {
        id: String(row.id || d.id || ''),
        grade: String(row.grade || d.grade || '12') as Grade,
        title: row.title || d.title || 'Đề thi',
        description: row.description || d.description || '',
        type: row.type || d.type || 'practice',
        academicYear: row.academicYear || d.academicYear || '',
        category: row.category || d.category || '',
        folderId: row.folderId || d.folderId || undefined,
        folderName: row.folderName || d.folderName || undefined,
        startTime: row.startTime || d.startTime || '',
        endTime: row.endTime || d.endTime || '',
        durationMinutes: typeof row.durationMinutes === 'number' ? row.durationMinutes : (typeof d.durationMinutes === 'number' ? d.durationMinutes : (parseInt(row.durationMinutes || d.durationMinutes) || 45)),
        questionCount: typeof row.questionCount === 'number' ? row.questionCount : (typeof d.questionCount === 'number' ? d.questionCount : (parseInt(row.questionCount || d.questionCount) || (Array.isArray(d.questions) ? d.questions.length : 0))),
        attemptCount: typeof row.attemptCount === 'number' ? row.attemptCount : (typeof d.attemptCount === 'number' ? d.attemptCount : (parseInt(row.attemptCount || d.attemptCount) || 0)),
        createdAt: row.createdAt || d.createdAt || new Date().toISOString(),
        isPublished: row.isPublished === true || row.isPublished === 'true' || d.isPublished === true || d.isPublished === 'true',
        isMonitored: row.isMonitored === true || row.isMonitored === 'true' || d.isMonitored === true || d.isMonitored === 'true',
        isUnlisted: row.isUnlisted === true || row.isUnlisted === 'true' || d.isUnlisted === true || d.isUnlisted === 'true',
        targetType: row.targetType || d.targetType || 'all',
        assignedClassIds: Array.isArray(row.assignedClassIds) ? row.assignedClassIds : (Array.isArray(d.assignedClassIds) ? d.assignedClassIds : []),
        assignedClasses: Array.isArray(row.assignedClasses) ? row.assignedClasses : (Array.isArray(d.assignedClasses) ? d.assignedClasses : []),
        maxAttempts: typeof row.maxAttempts === 'number' ? row.maxAttempts : (typeof d.maxAttempts === 'number' ? d.maxAttempts : 2),
        allowReview: row.allowReview ?? d.allowReview ?? true,
        orderIndex: typeof row.orderIndex === 'number' ? row.orderIndex : (typeof d.orderIndex === 'number' ? d.orderIndex : 0),
        isSyncedToBank: row.isSyncedToBank === true || row.isSyncedToBank === 'true' || d.isSyncedToBank === true || d.isSyncedToBank === 'true',
        syncedToBankAt: row.syncedToBankAt || d.syncedToBankAt || undefined,
        questions: [] // Tuyệt đối không tải mảng câu hỏi ở metadata để tiết kiệm bộ nhớ và băng thông
    };
};

// --- Quizzes ---
export const getQuizzesMetadataPage = async (page: number, pageSize: number = 20, grade?: Grade): Promise<{ data: Quiz[], total: number }> => {
  if (!supabase) return { data: [], total: 0 };
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('quizzes')
      .select(QUIZ_METADATA_PROJECTION, { count: 'exact' })
      .order('id', { ascending: false })
      .range(from, to);
    
    if (grade && grade !== 'all') {
      query = query.or(`grade.eq.${grade},grade.eq.all,grade.is.null,data->>grade.eq.${grade}`);
    }

    const { data, count, error } = await query;
    if (error) throw error;
    
    let quizzes: Quiz[] = data ? data.map(mapRowToQuizMeta) : [];
    if (grade && grade !== 'all') {
      quizzes = quizzes.filter((q: Quiz) => !q.grade || q.grade === 'all' || q.grade === grade);
    }
    return { data: quizzes, total: count || 0 };
  } catch (e) {
    console.error("Lỗi getQuizzesMetadataPage:", e);
    return { data: [], total: 0 };
  }
};

// Cache in-memory 10 phút để giảm triệt để băng thông và số lượng request
const memoryCache: { [key: string]: { data: any; expires: number } } = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 phút (600.000 ms)

export const invalidateCache = (prefix?: string) => {
  if (!prefix) {
    Object.keys(memoryCache).forEach(k => delete memoryCache[k]);
  } else {
    Object.keys(memoryCache).filter(k => k.startsWith(prefix)).forEach(k => delete memoryCache[k]);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (!prefix) {
        Object.keys(sessionStorage).filter(k => k.startsWith('quizzes_') || k.startsWith('quiz_')).forEach(k => sessionStorage.removeItem(k));
      } else {
        Object.keys(sessionStorage).filter(k => k.startsWith(prefix)).forEach(k => sessionStorage.removeItem(k));
      }
    }
  } catch (e) {}
};

// Cập nhật trực tiếp 1 đề thi vào Cache Memory mà không làm mất bộ đệm 70 đề khác
export const updateQuizInCache = (updatedQuiz: Quiz) => {
  const existingDetail = quizDetailCache.get(updatedQuiz.id);
  const questionsToKeep = (updatedQuiz.questions && updatedQuiz.questions.length > 0)
    ? updatedQuiz.questions
    : (existingDetail?.questions && existingDetail.questions.length > 0 ? existingDetail.questions : []);

  const count = questionsToKeep.length > 0
    ? questionsToKeep.length
    : (updatedQuiz.questionCount || existingDetail?.questionCount || 0);

  const metaItem: Quiz = {
    ...updatedQuiz,
    questionCount: count,
    questions: []
  };

  const fullQuizToCache: Quiz = {
    ...updatedQuiz,
    questions: questionsToKeep,
    questionCount: count
  };

  if (questionsToKeep.length > 0) {
    quizDetailCache.set(updatedQuiz.id, fullQuizToCache);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`quiz_detail_${updatedQuiz.id}`, JSON.stringify(fullQuizToCache));
      }
    } catch (e) {}
  } else if (existingDetail) {
    quizDetailCache.set(updatedQuiz.id, {
      ...existingDetail,
      ...updatedQuiz,
      questions: existingDetail.questions,
      questionCount: existingDetail.questions.length
    });
  }

  Object.keys(memoryCache).forEach(k => {
    if (k.startsWith('quizzes_meta_')) {
      const list = memoryCache[k].data as Quiz[];
      if (Array.isArray(list)) {
        memoryCache[k].data = list.map(q => q.id === updatedQuiz.id ? { 
          ...q, 
          ...metaItem, 
          questions: [],
          questionCount: count 
        } : q);
      }
    } else if (k.startsWith('quizzes_full_')) {
      const list = memoryCache[k].data as Quiz[];
      if (Array.isArray(list)) {
        memoryCache[k].data = list.map(q => q.id === updatedQuiz.id ? fullQuizToCache : q);
      }
    }
  });
};

// Xóa sạch tất cả bộ nhớ đệm (Memory, localStorage, sessionStorage) để tải dữ liệu mới nhất 100% từ Server
export const clearAllLocalCaches = () => {
  for (const k of Object.keys(memoryCache)) {
    delete memoryCache[k];
  }
  quizDetailCache.clear();

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('quizzes_') || k.startsWith('chapters_') || k.startsWith('quiz_folders_') || k.startsWith('eduquiz_admin_quiz_filters') || k.startsWith('results_') || k.startsWith('classes_') || k.startsWith('users_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (e) {}
};

// Chỉ xóa cache khi người dùng bấm nút "Xóa Cache & Đồng bộ"
// try {
//   clearAllLocalCaches();
// } catch (e) {}

// Xóa 1 đề thi khỏi Cache Memory trực tiếp
export const removeQuizFromCache = (quizId: string) => {
  quizDetailCache.delete(quizId);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(`quiz_detail_${quizId}`);
    }
  } catch (e) {}
  Object.keys(memoryCache).forEach(k => {
    if (k.startsWith('quizzes_meta_') || k.startsWith('quizzes_full_')) {
      const list = memoryCache[k].data as Quiz[];
      if (Array.isArray(list)) {
        memoryCache[k].data = list.filter(q => q.id !== quizId);
      }
    }
  });
};

export const getQuizzesMetadata = async (grade?: Grade, forceRefresh: boolean = false): Promise<Quiz[]> => {
  if (!supabase) return [];
  const cacheKey = `quizzes_meta_${grade || 'all'}`;
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }

  const fetchPromise = async (): Promise<Quiz[]> => {
    let allQuizzes: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from('quizzes')
            .select(QUIZ_METADATA_PROJECTION)
            .range(from, from + step - 1);
            
        if (grade && grade !== 'all') {
            query = query.or(`grade.eq.${grade},grade.eq.all,grade.is.null,data->>grade.eq.${grade}`);
        }

        try {
          query = query.order('id', { ascending: false });
        } catch {}
        
        const { data, error } = await query;
        if (error) {
            console.warn("Lỗi query getQuizzesMetadata:", error);
            const fallbackQuery = await supabase.from('quizzes').select(QUIZ_METADATA_PROJECTION);
            if (fallbackQuery.data && fallbackQuery.data.length > 0) {
              allQuizzes = fallbackQuery.data;
            }
            hasMore = false;
            break;
        }
        
        if (data && data.length > 0) {
            allQuizzes = [...allQuizzes, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    
    let mapped: Quiz[] = allQuizzes.map(mapRowToQuizMeta);

    if (grade && grade !== 'all') {
        mapped = mapped.filter((q: Quiz) => !q.grade || q.grade === 'all' || q.grade === grade);
    }

    const cachePayload = { data: mapped, expires: Date.now() + CACHE_TTL };
    memoryCache[cacheKey] = cachePayload;
    return mapped;
  };

  const cached = memoryCache[cacheKey]?.data || [];
  return withTimeout(fetchPromise(), 6000, cached);
};

export const getQuizzes = async (grade?: Grade, forceRefresh: boolean = false): Promise<Quiz[]> => {
  if (!supabase) return [];
  const cacheKey = `quizzes_full_${grade || 'all'}`;
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }
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
    const result = allQuizzes.map((row: any) => {
      const q = row.data as Quiz;
      quizDetailCache.set(q.id, q);
      return q;
    });
    memoryCache[cacheKey] = { data: result, expires: now + CACHE_TTL };
    return result;
  } catch (e) {
    return [];
  }
};

const quizDetailCache = new Map<string, Quiz>();

export const getQuizById = async (id: string, forceRefresh: boolean = false): Promise<Quiz | null> => {
    if (!supabase) return null;
    
    // Kiểm tra cache in-memory, CHỈ dùng nếu có chứa mảng câu hỏi hợp lệ
    if (!forceRefresh && quizDetailCache.has(id)) {
        const cached = quizDetailCache.get(id)!;
        if (cached && Array.isArray(cached.questions) && cached.questions.length > 0) {
            return cached;
        }
    }

    // Kiểm tra sessionStorage, CHỈ dùng nếu có chứa mảng câu hỏi hợp lệ
    try {
        if (!forceRefresh && typeof sessionStorage !== 'undefined') {
            const cachedStr = sessionStorage.getItem(`quiz_detail_${id}`);
            if (cachedStr) {
                const parsed = JSON.parse(cachedStr) as Quiz;
                if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                    quizDetailCache.set(id, parsed);
                    return parsed;
                } else {
                    sessionStorage.removeItem(`quiz_detail_${id}`);
                }
            }
        }
    } catch (e) {}

    try {
      const { data, error } = await supabase.from('quizzes').select('data').eq('id', id).limit(1);
      if (error || !data || data.length === 0) return null;
      const quiz = (data[0].data || data[0]) as Quiz;
      quizDetailCache.set(id, quiz);

      try {
          if (typeof sessionStorage !== 'undefined' && quiz.questions && quiz.questions.length > 0) {
              sessionStorage.setItem(`quiz_detail_${id}`, JSON.stringify(quiz));
          }
      } catch (e) {}

      return quiz;
    } catch (e) {
      return null;
    }
};

export const saveQuiz = async (quiz: Quiz): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const enrichedQuiz = sanitizeForJsonB({ 
    ...quiz, 
    questionCount: quiz.questions.length,
    isSyncedToBank: quiz.isSyncedToBank ?? false 
  });
  updateQuizInCache(enrichedQuiz);
  const { error } = await supabase.from('quizzes').insert({ id: enrichedQuiz.id, grade: enrichedQuiz.grade, data: enrichedQuiz });
  handleSupabaseError(error, "Lưu đề thi mới");
};

export const updateQuiz = async (enrichedQuiz: Quiz): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  
  // LỚP BẢO VỆ CHỐNG MẤT CÂU HỎI TUYỆT ĐỐI:
  // Nếu enrichedQuiz không có mảng câu hỏi (do truyền từ card metadata),
  // tuyệt đối không được ghi đè bằng rỗng! Phải tải bản ghi đầy đủ từ Database hoặc cache!
  let fullQuiz: Quiz = enrichedQuiz;
  if (!enrichedQuiz.questions || enrichedQuiz.questions.length === 0) {
    const existing = await getQuizById(enrichedQuiz.id);
    if (existing && existing.questions && existing.questions.length > 0) {
      fullQuiz = {
        ...existing,
        ...enrichedQuiz,
        questions: existing.questions,
        questionCount: existing.questions.length
      };
    }
  }

  const qCount = fullQuiz.questions && fullQuiz.questions.length > 0
    ? fullQuiz.questions.length
    : (fullQuiz.questionCount || 0);

  const quiz = sanitizeForJsonB({ 
    ...fullQuiz, 
    questionCount: qCount,
    isSyncedToBank: false 
  });
  updateQuizInCache(quiz);
  const { error } = await supabase.from('quizzes').update({ data: quiz, grade: fullQuiz.grade }).eq('id', fullQuiz.id);
  handleSupabaseError(error, "Cập nhật đề thi");
};

// Cập nhật đổi tên đề thi (File) an toàn 100%, bảo toàn trọn vẹn danh sách câu hỏi
export const updateQuizTitle = async (
  quizId: string, 
  newTitle: string
): Promise<Quiz> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').eq('id', quizId).single();
  if (error || !data) throw new Error("Không tìm thấy đề thi trên hệ thống");
  const currentQuiz = data.data as Quiz;
  const cleanTitle = newTitle.trim().toUpperCase();
  const updatedQuiz: Quiz = {
    ...currentQuiz,
    title: cleanTitle
  };
  updateQuizInCache(updatedQuiz);
  const { error: updateErr } = await supabase.from('quizzes').update({
    data: updatedQuiz,
    grade: data.grade
  }).eq('id', quizId);
  handleSupabaseError(updateErr, "Đổi tên đề thi");
  return updatedQuiz;
};

// Helper tính toán Niên khóa / Năm học hiện hành theo lịch Việt Nam (tháng 9 bắt đầu năm học mới)
// Quy tắc: Từ 01/09 đến 31/08 năm sau:
// - Từ 01/09/2025 đến 31/08/2026 => Niên học 2025-2026
// - Qua ngày 01/09/2026 đến 31/08/2027 => Niên học 2026-2027
export const getCurrentAcademicYear = (date: Date = new Date()): string => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1; // 1 (Tháng 1) đến 12 (Tháng 12)
  if (currentMonth >= 9) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
};

// Cập nhật nhanh Niên khóa / Năm học cho 1 đề thi
export const updateQuizAcademicYear = async (
  quizId: string,
  academicYear: string
): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').eq('id', quizId).single();
  if (error || !data) throw new Error("Không tìm thấy đề thi trên hệ thống");
  const currentQuiz = data.data as Quiz;
  const updatedQuiz: Quiz = {
    ...currentQuiz,
    academicYear
  };
  updateQuizInCache(updatedQuiz);
  const { error: updateErr } = await supabase.from('quizzes').update({
    data: updatedQuiz,
    grade: data.grade
  }).eq('id', quizId);
  handleSupabaseError(updateErr, "Cập nhật năm học cho đề thi");
};

// Cập nhật hàng loạt Niên khóa cho nhiều đề thi
export const batchUpdateQuizAcademicYear = async (
  quizIds: string[],
  academicYear: string
): Promise<number> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  if (quizIds.length === 0) return 0;
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').in('id', quizIds);
  if (error || !data) throw new Error("Lỗi khi tải danh sách đề thi");

  let count = 0;
  for (const row of data) {
    const currentQuiz = row.data as Quiz;
    const updatedQuiz: Quiz = {
      ...currentQuiz,
      academicYear
    };
    updateQuizInCache(updatedQuiz);
    const { error: updateErr } = await supabase.from('quizzes').update({
      data: updatedQuiz,
      grade: row.grade
    }).eq('id', row.id);
    if (!updateErr) count++;
  }
  return count;
};

// Gán nhanh phòng / lớp cho một đề thi
export const updateQuizTarget = async (
  quizId: string, 
  targetType: 'all' | 'classes', 
  assignedClassIds: string[]
): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').eq('id', quizId).single();
  if (error || !data) throw new Error("Không tìm thấy đề thi trên hệ thống");
  const currentQuiz = data.data as Quiz;
  const updatedQuiz: Quiz = {
    ...currentQuiz,
    targetType,
    assignedClassIds
  };
  updateQuizInCache(updatedQuiz);
  const { error: updateErr } = await supabase.from('quizzes').update({
    data: updatedQuiz,
    grade: data.grade
  }).eq('id', quizId);
  handleSupabaseError(updateErr, "Gán phòng/lớp cho đề thi");
};

// Cập nhật nhanh quyền xem đáp án chi tiết
export const updateQuizAllowReview = async (
  quizId: string, 
  allowReview: boolean
): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').eq('id', quizId).single();
  if (error || !data) throw new Error("Không tìm thấy đề thi trên hệ thống");
  const currentQuiz = data.data as Quiz;
  const updatedQuiz: Quiz = {
    ...currentQuiz,
    allowReview
  };
  updateQuizInCache(updatedQuiz);
  const { error: updateErr } = await supabase.from('quizzes').update({
    data: updatedQuiz,
    grade: data.grade
  }).eq('id', quizId);
  handleSupabaseError(updateErr, "Cập nhật quyền xem đáp án chi tiết");
};

// Gán nhanh phòng / lớp hàng loạt cho nhiều đề thi (ví dụ chuyển hàng loạt đề cũ vào phòng tạm)
export const batchUpdateQuizTarget = async (
  quizIds: string[],
  targetType: 'all' | 'classes',
  assignedClassIds: string[]
): Promise<number> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  if (quizIds.length === 0) return 0;
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').in('id', quizIds);
  if (error || !data) throw new Error("Lỗi khi tải danh sách đề thi");

  let count = 0;
  for (const row of data) {
    const currentQuiz = row.data as Quiz;
    const updatedQuiz: Quiz = {
      ...currentQuiz,
      targetType,
      assignedClassIds
    };
    updateQuizInCache(updatedQuiz);
    const { error: updateErr } = await supabase.from('quizzes').update({
      data: updatedQuiz,
      grade: row.grade
    }).eq('id', row.id);
    if (!updateErr) count++;
  }
  return count;
};

export const deleteQuiz = async (id: string): Promise<void> => {
  if (supabase) {
      removeQuizFromCache(id);
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
export const getChapters = async (forceRefresh: boolean = false): Promise<Chapter[]> => {
  if (!supabase) return [];
  const cacheKey = 'chapters_all';
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }
  
  const fetchPromise = async (): Promise<Chapter[]> => {
    const { data, error } = await supabase.from('chapters').select('id, grade, data');
    if (error) {
      console.warn("Lỗi getChapters:", error);
      return [];
    }
    const result = data 
      ? data
          .filter((row: any) => row.id !== 'system_lessons_registry' && !row.data?.isSystemRegistry && row.data?.name)
          .map((row: any) => row.data as Chapter)
          .sort((a: Chapter, b: Chapter) => (a.order || 0) - (b.order || 0)) 
      : [];
    memoryCache[cacheKey] = { data: result, expires: Date.now() + CACHE_TTL };
    return result;
  };

  const cached = memoryCache[cacheKey]?.data || [];
  return withTimeout(fetchPromise(), 5000, cached);
};

export const saveChapter = async (c: Chapter): Promise<void> => {
  invalidateCache('chapters_all');
  if (supabase) await supabase.from('chapters').insert({ id: c.id, grade: c.grade, data: c });
};

export const deleteChapter = async (id: string): Promise<void> => {
  invalidateCache('chapters_all');
  if (supabase) await supabase.from('chapters').delete().eq('id', id);
};

// --- Lessons (Quản lý bài học thuộc chương - Lưu trữ Cloud CSDL Supabase) ---
export const getLessons = async (forceRefresh: boolean = false): Promise<Lesson[]> => {
  const cacheKey = 'lessons_all';
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }

  const fetchPromise = async (): Promise<Lesson[]> => {
    let dbLessons: Lesson[] = [];
    if (supabase) {
      // 1. Thử đọc từ registry an toàn trong bảng chapters (đã có sẵn trên CSDL Supabase)
      try {
        const { data: regRow, error: regError } = await supabase
          .from('chapters')
          .select('data')
          .eq('id', 'system_lessons_registry')
          .maybeSingle();

        if (!regError && regRow && regRow.data && Array.isArray(regRow.data.lessons)) {
          dbLessons = regRow.data.lessons as Lesson[];
        }
      } catch (e) {
        console.warn("Lỗi đọc system_lessons_registry từ Supabase:", e);
      }

      // 2. Dự phòng: Đọc từ bảng lessons nếu tồn tại
      if (dbLessons.length === 0) {
        try {
          const { data, error } = await supabase.from('lessons').select('data');
          if (!error && data && data.length > 0) {
            dbLessons = data.map((row: any) => row.data as Lesson);
          }
        } catch (e) {}
      }
    }

    // 3. Khôi phục từ localStorage nếu Supabase chưa có (ví dụ người dùng vừa thêm bài lúc trước)
    let localLessons: Lesson[] = [];
    try {
      const local = localStorage.getItem('eduquiz_lessons_cache');
      if (local) localLessons = JSON.parse(local);
    } catch (e) {}

    // Hợp nhất dữ liệu giữa LocalStorage và Supabase để không bao giờ bị mất bài
    if (localLessons.length > 0) {
      const map = new Map<string, Lesson>();
      dbLessons.forEach(l => map.set(l.id, l));
      let hasNew = false;
      localLessons.forEach(l => {
        if (!map.has(l.id)) {
          map.set(l.id, l);
          hasNew = true;
        }
      });
      dbLessons = Array.from(map.values());

      // Nếu local có bài học chưa kịp đẩy lên Supabase -> đẩy ngay lên Cloud
      if (hasNew && supabase && dbLessons.length > 0) {
        supabase.from('chapters').upsert({
          id: 'system_lessons_registry',
          grade: 'all',
          data: {
            id: 'system_lessons_registry',
            isSystemRegistry: true,
            updatedAt: new Date().toISOString(),
            lessons: dbLessons
          }
        }).catch((e: any) => console.warn("Lỗi tự động sao lưu lessons lên Supabase:", e));
      }
    }

    // 4. Nếu hoàn toàn rỗng, nạp danh mục bài học mẫu chuẩn Vercel và GitHub Vật lí 12
    if (dbLessons.length === 0) {
      dbLessons = [
        {
          id: 'lesson_12_c1_b1',
          grade: '12',
          chapterId: 'e695e00c-ad6b-4894-9a10-05e04ad5649f',
          chapterName: 'Chương 1: vật lý nhiệt',
          title: 'Bài 1: Cấu trúc của chất. Sự chuyển thể',
          url: 'https://website1975.github.io/vatly12/chuong1/Suchuyenthe.html',
          defaultKeyConcept: 'Mô hình động học phân tử về cấu tạo chất có những nội dung cơ bản sau:\n- Các chất được cấu tạo từ các hạt riêng biệt là phân tử.\n- Các phân tử chuyển động không ngừng.\n- Giữa các phân tử có lực tương tác (hút và đẩy).'
        },
        {
          id: 'lesson_12_c1_b2',
          grade: '12',
          chapterId: 'e695e00c-ad6b-4894-9a10-05e04ad5649f',
          chapterName: 'Chương 1: vật lý nhiệt',
          title: 'Bài 2: Nội năng. Định luật 1 Nhiệt động lực học',
          url: 'https://website1975.github.io/vatly12/chuong1/Noinang.html',
          defaultKeyConcept: '1/ Nội năng là tổng động năng và thế năng của các phân tử cấu tạo nên vật: $U = f(T, V)$.\n2/ Định luật 1 Nhiệt động lực học: $\\Delta U = Q + A$\n- $Q > 0$: Vật nhận nhiệt lượng; $Q < 0$: Vật truyền nhiệt lượng.\n- $A > 0$: Vật nhận công; $A < 0$: Vật thực hiện công.'
        },
        {
          id: 'lesson_12_c1_b3',
          grade: '12',
          chapterId: 'e695e00c-ad6b-4894-9a10-05e04ad5649f',
          chapterName: 'Chương 1: vật lý nhiệt',
          title: 'Bài 3: Nhiệt dung riêng',
          url: 'https://website1975.github.io/vatly12/chuong1/nhietdungrieng.html',
          defaultKeyConcept: '1/ Nhiệt lượng giúp vật liệu thay đổi nhiệt $\\Delta T$:\n$$Q = m \\cdot c \\cdot \\Delta T$$\n- $c$: Nhiệt dung riêng của chất ($J/(kg \\cdot K)$).\n- Đo nhiệt dung riêng bằng phương pháp nhiệt lượng kế.'
        },
        {
          id: 'lesson_12_c1_b4',
          grade: '12',
          chapterId: 'e695e00c-ad6b-4894-9a10-05e04ad5649f',
          chapterName: 'Chương 1: vật lý nhiệt',
          title: 'Bài 4: Sự nóng chảy và sự sôi. Nhiệt nóng chảy riêng',
          url: 'https://website1975.github.io/vatly12/chuong1/nhietnongchay.html',
          defaultKeyConcept: '1/ Nhiệt nóng chảy: $Q = \\lambda \\cdot m$ ($\\lambda$: Nhiệt nóng chảy riêng $J/kg$).\n2/ Nhiệt hóa hơi: $Q = L \\cdot m$ ($L$: Nhiệt hóa hơi riêng $J/kg$).'
        },
        {
          id: 'lesson_10_c1_b1',
          grade: '10',
          chapterId: 'ch_10_c1',
          chapterName: 'Chương 1: Mở đầu & Động học',
          title: 'Bài 1: Làm quen với Vật lí',
          url: 'https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969901',
          defaultKeyConcept: '1/ Đối tượng nghiên cứu của Vật lí: các dạng vận động của vật chất và năng lượng.\n2/ Sai số tỉ đối: $\\delta A = \\frac{\\Delta A}{\\bar{A}} \\times 100\\%$'
        },
        {
          id: 'lesson_11_c1_b1',
          grade: '11',
          chapterId: 'ch_11_c1',
          chapterName: 'Chương 1: Dao động',
          title: 'Bài 1: Mô tả dao động điều hòa',
          url: 'https://hethonghoctap-nhc.vercel.app/student?subject=11&node=g11-dao-dong-dieu-hoa',
          defaultKeyConcept: '1/ Phương trình dao động: $x = A\\cos(\\omega t + \\varphi)$\n- Vận tốc: $v = -\\omega A\\sin(\\omega t + \\varphi)$\n- Gia tốc: $a = -\\omega^2 x$'
        }
      ];

      if (supabase) {
        supabase.from('chapters').upsert({
          id: 'system_lessons_registry',
          grade: 'all',
          data: {
            id: 'system_lessons_registry',
            isSystemRegistry: true,
            updatedAt: new Date().toISOString(),
            lessons: dbLessons
          }
        }).catch(() => {});
      }
    }

    memoryCache[cacheKey] = { data: dbLessons, expires: Date.now() + CACHE_TTL };
    try {
      localStorage.setItem('eduquiz_lessons_cache', JSON.stringify(dbLessons));
    } catch (e) {}
    return dbLessons;
  };

  const cached = memoryCache[cacheKey]?.data || [];
  return withTimeout(fetchPromise(), 6000, cached);
};

export const saveLesson = async (l: Lesson): Promise<void> => {
  invalidateCache('lessons_all');
  
  // 1. Cập nhật localStorage
  let currentList: Lesson[] = [];
  try {
    const local = localStorage.getItem('eduquiz_lessons_cache');
    if (local) currentList = JSON.parse(local);
  } catch (e) {}
  
  const idx = currentList.findIndex(item => item.id === l.id);
  if (idx >= 0) currentList[idx] = l;
  else currentList.push(l);
  try {
    localStorage.setItem('eduquiz_lessons_cache', JSON.stringify(currentList));
  } catch (e) {}

  // 2. Lưu trực tiếp vào Cloud CSDL Supabase
  if (supabase) {
    try {
      const { data: regRow } = await supabase
        .from('chapters')
        .select('data')
        .eq('id', 'system_lessons_registry')
        .maybeSingle();

      let remoteList: Lesson[] = [];
      if (regRow && regRow.data && Array.isArray(regRow.data.lessons)) {
        remoteList = regRow.data.lessons;
      } else {
        remoteList = currentList;
      }

      const rIdx = remoteList.findIndex(item => item.id === l.id);
      if (rIdx >= 0) remoteList[rIdx] = l;
      else remoteList.push(l);

      const { error: upsertErr } = await supabase.from('chapters').upsert({
        id: 'system_lessons_registry',
        grade: 'all',
        data: {
          id: 'system_lessons_registry',
          isSystemRegistry: true,
          updatedAt: new Date().toISOString(),
          lessons: remoteList
        }
      });
      if (upsertErr) {
        console.warn("Lỗi lưu lessons vào Supabase:", upsertErr);
      } else {
        console.log(`[Supabase] Đã lưu thành công bài học "${l.title}" vào CSDL!`);
      }

      // Thử đồng thời bảng lessons nếu có
      try {
        await supabase.from('lessons').upsert({
          id: l.id,
          grade: l.grade,
          chapter_id: l.chapterId,
          data: l
        });
      } catch (e) {}
    } catch (e) {
      console.warn("Lỗi lưu lessons vào Supabase:", e);
    }
  }
};

export const deleteLesson = async (id: string): Promise<void> => {
  invalidateCache('lessons_all');
  try {
    const list = await getLessons(true);
    const updated = list.filter(item => item.id !== id);
    localStorage.setItem('eduquiz_lessons_cache', JSON.stringify(updated));

    if (supabase) {
      await supabase.from('chapters').upsert({
        id: 'system_lessons_registry',
        grade: 'all',
        data: {
          id: 'system_lessons_registry',
          isSystemRegistry: true,
          updatedAt: new Date().toISOString(),
          lessons: updated
        }
      });
      try {
        await supabase.from('lessons').delete().eq('id', id);
      } catch (e) {}
    }
  } catch (e) {
    console.warn("Lỗi xóa bài học:", e);
  }
};

export const saveLessonsBatch = async (lessonsList: Lesson[]): Promise<void> => {
  invalidateCache('lessons_all');
  if (lessonsList.length === 0) return;
  try {
    const current = await getLessons(true);
    const map = new Map<string, Lesson>();
    current.forEach(l => map.set(l.id, l));
    lessonsList.forEach(l => map.set(l.id, l));
    const merged = Array.from(map.values());
    localStorage.setItem('eduquiz_lessons_cache', JSON.stringify(merged));

    if (supabase) {
      await supabase.from('chapters').upsert({
        id: 'system_lessons_registry',
        grade: 'all',
        data: {
          id: 'system_lessons_registry',
          isSystemRegistry: true,
          updatedAt: new Date().toISOString(),
          lessons: merged
        }
      });
    }
  } catch (e) {
    console.warn("Lỗi lưu lessons batch:", e);
  }
};



// --- Quiz Folders (Thư mục đề thi con trong từng Chương) ---
// Dữ liệu được lưu trữ 100% trên Supabase Server (Single Source of Truth)

// Tự động dọn dẹp bộ nhớ đệm ổ cứng cũ nếu có
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('eduquiz_quiz_folders_v1');
  }
} catch (e) {}

export const getQuizFolders = async (grade?: Grade, forceRefresh: boolean = false): Promise<QuizFolder[]> => {
  const cacheKey = `quiz_folders_${grade || 'all'}`;
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }

  const fetchPromise = async (): Promise<QuizFolder[]> => {
    let dbFolders: QuizFolder[] = [];
    if (supabase) {
      try {
        let query = supabase.from('quiz_folders').select('data');
        if (grade && grade !== 'all') {
          query = query.or(`grade.eq.${grade},grade.eq.all`);
        }
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          dbFolders = data.map((row: any) => row.data as QuizFolder);
        }
      } catch (e) {
        console.warn("Chưa đọc được bảng quiz_folders trên Supabase:", e);
      }
    }

    const folderMap = new Map<string, QuizFolder>();
    dbFolders.forEach(f => {
      if (f && f.id) folderMap.set(f.id, f);
    });

    let merged = Array.from(folderMap.values());
    if (grade && grade !== 'all') {
      merged = merged.filter(f => !f.grade || f.grade === 'all' || f.grade === grade);
    }

    merged.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
    memoryCache[cacheKey] = { data: merged, expires: Date.now() + CACHE_TTL };
    return merged;
  };

  const cached = memoryCache[cacheKey]?.data || [];
  return withTimeout(fetchPromise(), 5000, cached);
};

export const saveQuizFolder = async (folder: QuizFolder): Promise<void> => {
  invalidateCache('quiz_folders_');
  // Lưu 100% trực tiếp lên Supabase Database
  if (!supabase) throw new Error("Mất kết nối với cơ sở dữ liệu Supabase");

  const { error } = await supabase.from('quiz_folders').upsert({
    id: folder.id,
    grade: folder.grade || 'all',
    data: folder
  });

  if (error) {
    console.error("Lỗi lưu quiz_folder lên Supabase:", error);
    throw new Error(`Không thể lưu thư mục lên máy chủ: ${error.message || 'Lỗi không xác định'}. Hãy chắc chắn bảng quiz_folders đã được tạo trên Supabase.`);
  }
};

export const deleteQuizFolder = async (folderId: string): Promise<void> => {
  invalidateCache('quiz_folders_');
  invalidateCache('quizzes_meta_');
  invalidateCache('quizzes_full_');
  
  if (!supabase) throw new Error("Mất kết nối với cơ sở dữ liệu Supabase");

  // 1. Xóa thư mục trên Supabase
  const { error } = await supabase.from('quiz_folders').delete().eq('id', folderId);
  if (error) {
    console.warn("Lỗi xóa folder trên Supabase:", error);
  }

  // 2. Trả các đề thi thuộc folder này về trạng thái chưa phân thư mục trên Supabase
  try {
    const { data: matchedRows } = await supabase
      .from('quizzes')
      .select('id, grade, data');

    if (matchedRows && matchedRows.length > 0) {
      for (const row of matchedRows) {
        const q = row.data as Quiz;
        if (q && q.folderId === folderId) {
          const updatedQuiz: Quiz = {
            ...q,
            folderId: undefined,
            folderName: undefined
          };
          updateQuizInCache(updatedQuiz);
          await supabase.from('quizzes').update({
            data: updatedQuiz,
            grade: row.grade || q.grade
          }).eq('id', row.id);
        }
      }
    }
  } catch (e) {
    console.warn("Lỗi hoàn trả đề thi về vùng chưa phân:", e);
  }
};

// Di chuyển nhanh đề thi vào một thư mục
export const updateQuizFolderAssignment = async (
  quizId: string,
  folderId?: string,
  folderName?: string,
  chapterName?: string
): Promise<void> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').eq('id', quizId).single();
  if (error || !data) throw new Error("Không tìm thấy đề thi");
  const currentQuiz = data.data as Quiz;
  const updatedQuiz: Quiz = {
    ...currentQuiz,
    folderId: folderId || undefined,
    folderName: folderName || undefined,
    category: chapterName || currentQuiz.category
  };
  updateQuizInCache(updatedQuiz);
  const { error: updateErr } = await supabase.from('quizzes').update({
    data: updatedQuiz,
    grade: data.grade
  }).eq('id', quizId);
  handleSupabaseError(updateErr, "Di chuyển đề thi vào thư mục");
};

// Di chuyển hàng loạt đề thi vào thư mục
export const batchMoveQuizzesToFolder = async (
  quizIds: string[],
  folderId?: string,
  folderName?: string,
  chapterName?: string
): Promise<number> => {
  if (!supabase) throw new Error("Mất kết nối Database");
  if (quizIds.length === 0) return 0;
  const { data, error } = await supabase.from('quizzes').select('id, grade, data').in('id', quizIds);
  if (error || !data) throw new Error("Lỗi khi nạp danh sách đề thi");

  let count = 0;
  for (const row of data) {
    const currentQuiz = row.data as Quiz;
    const updatedQuiz: Quiz = {
      ...currentQuiz,
      folderId: folderId || undefined,
      folderName: folderName || undefined,
      category: chapterName || currentQuiz.category
    };
    updateQuizInCache(updatedQuiz);
    const { error: updateErr } = await supabase.from('quizzes').update({
      data: updatedQuiz,
      grade: row.grade
    }).eq('id', row.id);
    if (!updateErr) count++;
  }
  return count;
};

// --- Classroom & Academic Year Management ---
export const getClasses = async (forceRefresh: boolean = false): Promise<ClassRoom[]> => {
  const cacheKey = 'classes_all';
  const now = Date.now();
  if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
    return memoryCache[cacheKey].data;
  }

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
        
        // Cache to memory and localStorage for fast read
        memoryCache[cacheKey] = { data: classes, expires: now + CACHE_TTL };
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
    if (local) {
      const parsed = JSON.parse(local);
      memoryCache[cacheKey] = { data: parsed, expires: now + CACHE_TTL };
      return parsed;
    }
  } catch (e) {}
  return [];
};

export const saveClass = async (c: ClassRoom): Promise<void> => {
  invalidateCache('classes_all');
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
  invalidateCache('classes_all');
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
  invalidateCache('classes_all');
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
export const getBankQuestionsPage = async (
    page: number = 1,
    pageSize: number = 40,
    gradeFilter?: Grade | 'all',
    chapterFilter?: string,
    typeFilter?: QuestionType | 'all',
    levelFilter?: string,
    search?: string
): Promise<{ data: Question[], total: number }> => {
    if (!supabase) return { data: [], total: 0 };
    try {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('bank_questions')
            .select('data', { count: 'exact' });

        if (gradeFilter && gradeFilter !== 'all') {
            query = query.or(`data->>quizGrade.eq.${gradeFilter},data->>grade.eq.${gradeFilter}`);
        }

        if (chapterFilter && chapterFilter !== 'all') {
            const rawClean = chapterFilter.trim();
            let kw = rawClean.replace(/^chương\s*\d+\s*[:\-]\s*/i, '').trim();
            kw = kw.replace(/l[íy]/gi, 'l_');
            const kwWildcard = kw || rawClean;
            query = query.or(`data->>chapterId.eq.${rawClean},data->>chapterName.ilike.%${kwWildcard}%,data->>quizCategory.ilike.%${kwWildcard}%,data->>chapterName.ilike.%${rawClean}%`);
        }

        if (typeFilter && typeFilter !== 'all') {
            if (typeFilter === 'group-tf' || (typeFilter as string) === 'group_tf') {
                query = query.or('data->>type.eq.group-tf,data->>type.eq.group_tf');
            } else {
                query = query.eq('data->>type', typeFilter);
            }
        }

        if (levelFilter && levelFilter !== 'all') {
            query = query.eq('data->>level', levelFilter);
        }

        if (search && search.trim()) {
            query = query.ilike('data->>text', `%${search.trim()}%`);
        }

        const { data, count, error } = await query
            .order('id', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const questions = data ? data.map((row: any) => row.data as Question) : [];
        return { data: questions, total: count || 0 };
    } catch (e) {
        console.error("Lỗi getBankQuestionsPage:", e);
        return { data: [], total: 0 };
    }
};

export const getBankQuestionsCount = async (gradeFilter?: Grade | 'all'): Promise<number> => {
    if (!supabase) return 0;
    try {
        let query = supabase.from('bank_questions').select('*', { count: 'exact', head: true });
        if (gradeFilter && gradeFilter !== 'all') {
            query = query.or(`data->>quizGrade.eq.${gradeFilter},data->>grade.eq.${gradeFilter}`);
        }
        const { count, error } = await query;
        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
};

export const getBankQuestions = async (
    gradeFilterOrForce?: Grade | 'all' | boolean, 
    forceRefreshParam: boolean = false
): Promise<Question[]> => {
    if (!supabase) return [];
    
    let gradeFilter: Grade | 'all' | undefined;
    let forceRefresh = forceRefreshParam;

    if (typeof gradeFilterOrForce === 'boolean') {
        forceRefresh = gradeFilterOrForce;
        gradeFilter = 'all';
    } else {
        gradeFilter = gradeFilterOrForce;
    }

    const filterKey = gradeFilter || 'all';
    const cacheKey = `bank_questions_${filterKey}`;
    const now = Date.now();
    if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
      return memoryCache[cacheKey].data;
    }
    try {
        let allQuestions: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from('bank_questions')
                .select('data');
            
            if (gradeFilter && gradeFilter !== 'all') {
                query = query.or(`data->>quizGrade.eq.${gradeFilter},data->>grade.eq.${gradeFilter}`);
            }

            const { data, error } = await query.range(from, from + step - 1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                allQuestions = [...allQuestions, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }
        const result = allQuestions.map((row: any) => row.data as Question);
        memoryCache[cacheKey] = { data: result, expires: now + CACHE_TTL };
        return result;
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
                        // Kiểm tra xem bản mới có thông tin mới/cập nhật không (chương, mức độ, lời giải...)
                        const isChapterChanged = Boolean(
                            (q.chapterName && q.chapterName !== existingQ.chapterName) ||
                            (q.chapterId && q.chapterId !== existingQ.chapterId)
                        );
                        const hasNewLevel = Boolean(!existingQ.level && q.level);
                        const isLevelChanged = Boolean(q.level && q.level !== existingQ.level);
                        const hasNewSolution = Boolean(!existingQ.solution && q.solution);
                        const isSolutionChanged = Boolean(q.solution && q.solution !== existingQ.solution);

                        if (isChapterChanged || hasNewLevel || isLevelChanged || hasNewSolution || isSolutionChanged) {
                            const enriched: Question = {
                                ...existingQ,
                                level: q.level || existingQ.level,
                                solution: q.solution || existingQ.solution,
                                chapterName: q.chapterName || existingQ.chapterName || quiz.category,
                                chapterId: q.chapterId || existingQ.chapterId,
                                quizTitle: quiz.title || existingQ.quizTitle,
                                quizGrade: quiz.grade || existingQ.quizGrade,
                                quizCategory: q.chapterName || quiz.category || existingQ.quizCategory
                            };
                            questionsToSave.push(enriched);
                            existingFingerprintMap.set(fp, enriched);
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        // Câu hỏi hoàn toàn mới chưa có trong Ngân hàng -> Thêm mới
                        const newQ: Question = {
                            ...q,
                            chapterName: q.chapterName || quiz.category,
                            chapterId: q.chapterId,
                            quizTitle: quiz.title,
                            quizGrade: quiz.grade,
                            quizCategory: q.chapterName || quiz.category
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

        // 4. Gắn cờ isSyncedToBank: true cho các đề thi vừa được quét xong (thực thi song song nhanh chóng)
        const nowIso = new Date().toISOString();
        const updatePromises = pendingQuizRows.map((row: any) => {
            const quiz = row.data as Quiz;
            const updatedQuiz: Quiz = {
                ...quiz,
                isSyncedToBank: true,
                syncedToBankAt: nowIso
            };
            return supabase!.from('quizzes').update({
                data: updatedQuiz,
                grade: row.grade || quiz.grade
            }).eq('id', row.id);
        });
        await Promise.all(updatePromises);

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
        const existing = await getBankQuestions('all', true);
        const found = existing.find(item => item.id === q.id || getQuestionFingerprint(item) === fp);
        const finalId = q.id || (found ? found.id : uuidv4());
        await supabase.from('bank_questions').upsert({ id: finalId, data: { ...q, id: finalId } });
        invalidateCache('bank_questions');
    } catch (e) {
        console.warn("Lỗi lưu bank question:", e);
    }
};

export const deleteBankQuestion = async (id: string): Promise<boolean> => {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('bank_questions').delete().eq('id', id);
        if (error) throw error;
        invalidateCache('bank_questions');
        return true;
    } catch (e) {
        console.warn("Lỗi xóa bank question:", e);
        return false;
    }
};

// --- Cấu hình lưu trữ hình ảnh (ImgBB & Supabase Storage) ---
export type ImageStorageProvider = 'auto' | 'imgbb' | 'supabase' | 'base64';

export interface ImageStorageConfig {
    provider: ImageStorageProvider;
    imgbbApiKey: string;
}

export const DEFAULT_IMGBB_KEY = '2ea8b9b28f97a0369bac68c8cd6c0a3d';

export const getImageStorageConfig = (): ImageStorageConfig => {
    try {
        const storedProvider = localStorage.getItem('eduquiz_image_provider') as ImageStorageProvider;
        const storedKey = localStorage.getItem('eduquiz_imgbb_key');
        return {
            provider: (storedProvider === 'imgbb' || storedProvider === 'supabase' || storedProvider === 'base64' || storedProvider === 'auto') ? storedProvider : 'auto',
            imgbbApiKey: (storedKey && storedKey.trim()) ? storedKey.trim() : DEFAULT_IMGBB_KEY
        };
    } catch (e) {
        return {
            provider: 'auto',
            imgbbApiKey: DEFAULT_IMGBB_KEY
        };
    }
};

export const saveImageStorageConfig = (config: Partial<ImageStorageConfig>): void => {
    try {
        if (config.provider) {
            localStorage.setItem('eduquiz_image_provider', config.provider);
        }
        if (config.imgbbApiKey !== undefined) {
            localStorage.setItem('eduquiz_imgbb_key', config.imgbbApiKey.trim());
        }
    } catch (e) {}
};

/**
 * Tải ảnh trực tiếp lên ImgBB qua API
 */
export const uploadToImgbb = async (file: File | Blob, apiKey?: string): Promise<string> => {
    const key = (apiKey && apiKey.trim()) || getImageStorageConfig().imgbbApiKey || DEFAULT_IMGBB_KEY;
    if (!key) throw new Error("Chưa cung cấp ImgBB API Key");

    const formData = new FormData();
    formData.append('image', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error?.message || `ImgBB trả về mã lỗi HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!data || !data.success || !data.data) {
            throw new Error(data?.error?.message || "ImgBB không trả về dữ liệu hình ảnh hợp lệ");
        }

        // Trả về direct URL của ảnh (display_url hoặc url trên CDN i.ibb.co)
        const imageUrl = data.data.display_url || data.data.url;
        if (!imageUrl) {
            throw new Error("Không tìm thấy đường link ảnh từ ImgBB");
        }
        return imageUrl;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error("Tải ảnh lên ImgBB bị quá thời gian chờ (Timeout)");
        }
        throw error;
    }
};

/**
 * Tải ảnh lên Supabase Storage (Bucket 'quiz-images')
 */
export const uploadToSupabaseStorage = async (file: File | Blob): Promise<string> => {
    if (!supabase) throw new Error("Mất kết nối Supabase");
    const fileExt = (file instanceof File && file.name ? file.name.split('.').pop() : 'png') || 'png';
    const fileName = `${uuidv4()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('quiz-images').upload(fileName, file, {
        contentType: (file as any).type || 'image/png',
        upsert: true
    });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
    if (!data?.publicUrl) {
        throw new Error("Không lấy được Public URL từ Supabase Storage");
    }
    return data.publicUrl;
};

export interface ImageUploadResult {
    url: string;
    provider: 'imgbb' | 'supabase' | 'base64';
    error?: string;
}

/**
 * Tự động tối ưu hoá và nén ảnh (giữ độ sắc nét cho sơ đồ, công thức, đồ thị)
 * Giúp tiết kiệm tối đa băng thông (giảm 70% - 90% dung lượng ảnh chụp màn hình Snipping Tool)
 */
export const compressImageForUpload = async (
    file: File | Blob, 
    maxWidth: number = 1200, 
    quality: number = 0.85
): Promise<{ blob: Blob; dataUrl: string }> => {
    return new Promise((resolve) => {
        const toFallback = () => {
            const reader = new FileReader();
            reader.onload = () => resolve({ blob: file, dataUrl: (reader.result as string) || '' });
            reader.onerror = () => resolve({ blob: file, dataUrl: '' });
            reader.readAsDataURL(file);
        };

        if (typeof window === 'undefined' || typeof Image === 'undefined') {
            return toFallback();
        }

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            try {
                let { width, height } = img;
                if (width <= 0 || height <= 0) return toFallback();

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return toFallback();

                // Nền trắng cho các ảnh cắt có kênh trong suốt (tránh bị đen nền)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const mimeType = 'image/jpeg';
                const dataUrl = canvas.toDataURL(mimeType, quality);
                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        resolve({ blob, dataUrl });
                    } else {
                        const reader = new FileReader();
                        reader.onload = () => resolve({ blob: file, dataUrl: (reader.result as string) || dataUrl });
                        reader.onerror = () => resolve({ blob: file, dataUrl });
                        reader.readAsDataURL(file);
                    }
                }, mimeType, quality);
            } catch (err) {
                toFallback();
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            toFallback();
        };
        img.src = objectUrl;
    });
};

/**
 * Tải ảnh đề thi với cơ chế lựa chọn thông minh & tự động fallback:
 * Ưu tiên ImgBB -> Chuyển Supabase Storage -> Chuyển Base64 DataURL
 */
export const uploadQuizImageWithResult = async (
    file: File | Blob, 
    customProvider?: ImageStorageProvider,
    customApiKey?: string
): Promise<ImageUploadResult> => {
    const config = getImageStorageConfig();
    const provider = customProvider || config.provider;
    const apiKey = customApiKey || config.imgbbApiKey;

    // Tự động nén ảnh thông minh trước khi tải lên hoặc chuyển Base64 (tiết kiệm băng thông tối đa)
    const { blob: optimizedBlob, dataUrl: optimizedDataUrl } = await compressImageForUpload(file);
    const toBase64 = async (): Promise<string> => optimizedDataUrl;
    const targetFile = optimizedBlob;

    // 0. Chế độ 'base64' (Mã hóa nhúng trực tiếp sBase64 vĩnh viễn)
    if (provider === 'base64') {
        const base64Url = await toBase64();
        return { url: base64Url, provider: 'base64' };
    }

    // 1. Chế độ 'auto' (Ưu tiên Supabase Storage vĩnh viễn -> Fallback ImgBB -> Fallback Base64)
    if (provider === 'auto') {
        try {
            const supabaseUrl = await uploadToSupabaseStorage(targetFile);
            return { url: supabaseUrl, provider: 'supabase' };
        } catch (supabaseErr: any) {
            console.warn("⚠️ Upload Supabase Storage không thành công, tự động chuyển sang ImgBB:", supabaseErr?.message || supabaseErr);
            try {
                const imgbbUrl = await uploadToImgbb(targetFile, apiKey);
                return { url: imgbbUrl, provider: 'imgbb' };
            } catch (imgbbErr: any) {
                console.warn("⚠️ Upload ImgBB cũng không thành công, fallback sang Base64 DataURL:", imgbbErr?.message || imgbbErr);
                const base64Url = await toBase64();
                return { 
                    url: base64Url, 
                    provider: 'base64', 
                    error: `Supabase: ${supabaseErr?.message || 'Lỗi'}; ImgBB: ${imgbbErr?.message || 'Lỗi'}` 
                };
            }
        }
    }

    // 2. Chế độ 'imgbb' (Chỉ dùng ImgBB -> Fallback Base64)
    if (provider === 'imgbb') {
        try {
            const imgbbUrl = await uploadToImgbb(targetFile, apiKey);
            return { url: imgbbUrl, provider: 'imgbb' };
        } catch (imgbbErr: any) {
            console.warn("⚠️ Upload ImgBB thất bại, fallback sang Base64:", imgbbErr);
            const base64Url = await toBase64();
            return { url: base64Url, provider: 'base64', error: imgbbErr?.message };
        }
    }

    // 3. Chế độ 'supabase' (Chỉ dùng Supabase Storage -> Fallback Base64)
    if (provider === 'supabase') {
        try {
            const supabaseUrl = await uploadToSupabaseStorage(targetFile);
            return { url: supabaseUrl, provider: 'supabase' };
        } catch (supabaseErr: any) {
            console.warn("⚠️ Upload Supabase thất bại, fallback sang Base64:", supabaseErr);
            const base64Url = await toBase64();
            return { url: base64Url, provider: 'base64', error: supabaseErr?.message };
        }
    }

    const fallbackUrl = await toBase64();
    return { url: fallbackUrl, provider: 'base64' };
};

export const uploadQuizImage = async (file: File | Blob): Promise<string> => {
    const res = await uploadQuizImageWithResult(file);
    return res.url;
};

export const getPublishedResults = async (limit: number = 6, forceRefresh: boolean = false): Promise<PublishedResult[]> => {
    if (!supabase) return [];
    const cacheKey = `published_results_${limit}`;
    const now = Date.now();
    if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
      return memoryCache[cacheKey].data;
    }
    const { data } = await supabase.from('published_results').select('data').order('id', { ascending: false }).limit(limit);
    const result = data ? data.map((row: any) => row.data as PublishedResult) : [];
    memoryCache[cacheKey] = { data: result, expires: now + CACHE_TTL };
    return result;
};

/**
 * Tối ưu hóa băng thông đặc biệt cho Màn hình Học Sinh:
 * CHỈ tải bản ghi vinh danh nào có chứa mã số của chính học sinh này (không tải toàn bộ CSDL bảng vinh danh của học sinh khác).
 * Dữ liệu trả về chỉ chứa thông tin vinh danh của riêng em đó, giảm 99% băng thông mạng (~62.9 kB -> ~0.4 kB).
 */
export const getPublishedResultsForStudent = async (studentCode?: string, forceRefresh: boolean = false): Promise<PublishedResult[]> => {
    if (!supabase || !studentCode) return [];
    const cleanCode = studentCode.trim().toUpperCase();
    if (!cleanCode) return [];
    const cacheKey = `published_results_student_${cleanCode}`;
    const now = Date.now();
    if (!forceRefresh && memoryCache[cacheKey] && memoryCache[cacheKey].expires > now) {
      return memoryCache[cacheKey].data;
    }
    try {
      // 1. Dùng containment filter của PostgREST để lọc ngay tại máy chủ Supabase:
      // data @> {"studentCodes": ["MÃ_HỌC_SINH"]}
      let { data, error } = await supabase
        .from('published_results')
        .select('data')
        .order('id', { ascending: false })
        .contains('data', { studentCodes: [cleanCode] })
        .limit(6);

      let rows = data;
      // Fallback nếu trong DB mã được lưu chữ thường hoặc ký tự gốc
      if ((!rows || rows.length === 0) && studentCode.trim() !== cleanCode) {
        const retry = await supabase
          .from('published_results')
          .select('data')
          .order('id', { ascending: false })
          .contains('data', { studentCodes: [studentCode.trim()] })
          .limit(6);
        if (retry.data && retry.data.length > 0) {
          rows = retry.data;
        }
      }

      if (!rows || rows.length === 0) {
        memoryCache[cacheKey] = { data: [], expires: now + CACHE_TTL };
        return [];
      }

      // 2. Chỉ giữ lại kết quả vinh danh của CHÍNH học sinh này
      const myHonors: PublishedResult[] = rows.map((row: any) => {
        const pub = row.data as PublishedResult;
        if (!pub) return null;
        const myResults = (pub.results || []).filter(r => (r.studentCode || '').trim().toUpperCase() === cleanCode);
        if (myResults.length === 0) return null;
        return {
          ...pub,
          results: myResults,
          studentCodes: [cleanCode]
        };
      }).filter((p: PublishedResult | null): p is PublishedResult => p !== null);

      memoryCache[cacheKey] = { data: myHonors, expires: now + CACHE_TTL };
      return myHonors;
    } catch (e) {
      console.warn("Lỗi tải bảng vinh danh cá nhân học sinh:", e);
      return [];
    }
};

export const savePublishedResult = async (pub: PublishedResult): Promise<void> => {
    invalidateCache('published_results');
    if (supabase) await supabase.from('published_results').upsert({ id: pub.id, data: pub });
};

export const deletePublishedResult = async (id: string): Promise<void> => {
    invalidateCache('published_results');
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