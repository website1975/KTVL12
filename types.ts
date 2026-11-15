
export type Role = 'admin' | 'student';
export type Grade = '10' | '11' | '12' | 'all';
export type QuizType = 'practice' | 'test';
export type QuestionType = 'mcq' | 'group-tf' | 'short';
export type QuestionLevel = 'B' | 'H' | 'VD' | 'VDC';

export interface ClassRoom {
  id: string; // e.g. "class_12a1_2026" or uuid
  name: string; // e.g. "12A1", "11A2", "10A1", "Lớp Nâng Cao"
  academicYear: string; // e.g. "2025-2026", "2026-2027", "2026"
  grade: Grade; // '10' | '11' | '12' | 'all'
  description?: string; // Ghi chú, giáo viên phụ trách, phân loại trình độ
  createdAt?: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  fullName: string;
  studentCode?: string; 
  grade?: Grade;
  points?: number;
  // Thông tin Lớp học & Niên khóa (có thể thay đổi qua các năm mà không đổi tài khoản)
  classId?: string; 
  className?: string; 
  academicYear?: string;
}

export interface Chapter {
  id: string;
  grade: Grade;
  name: string;
  order: number;
}

export interface Lesson {
  id: string;
  grade: Grade;
  chapterId: string;
  chapterName: string;
  title: string; // Tên bài học (VD: "Bài 13: Tổng hợp và phân tích lực")
  url: string;   // Đường dẫn web bài học
  defaultKeyConcept?: string; // Khung kiến thức trọng tâm / công thức cốt lõi mặc định
}


export interface QuizFolder {
  id: string;
  name: string; // e.g. "Đề củng cố Bài học", "Đề ôn chương", "Đề tổng hợp"
  chapterId?: string; // ID của chương chứa folder
  chapterName: string; // Tên chương (e.g. "Chương 1: Vật lý nhiệt")
  grade: Grade; // '10' | '11' | '12' | 'all'
  color?: 'amber' | 'blue' | 'emerald' | 'purple' | 'rose' | 'indigo' | 'cyan' | string;
  order?: number;
  description?: string;
  createdAt?: string;
}

export interface SubQuestion {
  id: string;
  text: string;
  correctAnswer: 'True' | 'False';
  level?: QuestionLevel;
}

export interface Question {
  id: string;
  bankOriginId?: string; // ID gốc của câu hỏi trong Ngân hàng (nếu được lấy từ Ngân hàng)
  type: QuestionType;
  context?: string; // Lời dẫn / Dữ liệu dùng chung cho chùm câu hỏi (VD: "Dữ liệu dùng chung cho câu 3 và câu 4...")
  text: string;
  points: number | string;
  level?: QuestionLevel;
  imageUrl?: string;
  solution?: string; 
  options?: string[]; 
  correctAnswer?: string; 
  subQuestions?: SubQuestion[];
  quizTitle?: string;
  quizGrade?: Grade;
  quizCategory?: string;
  chapterId?: string;
  chapterName?: string;
  keyConcept?: string; // Khung kiến thức trọng tâm / công thức cốt lõi (hỗ trợ KaTeX)
  lessonUrl?: string; // Link bài học Vercel/HTML (VD: https://hethonghoctap-nhc.vercel.app/student?subject=10&node=g10-1780405969910)
  lessonTitle?: string; // Tên bài học liên quan (VD: "Bài 13: Tổng hợp và phân tích lực")
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  type: QuizType;
  grade: Grade;
  academicYear?: string; // Niên khóa / Năm học (ví dụ: "2025-2026")
  category?: string; 
  folderId?: string; // ID của Thư mục chứa đề này (nằm trong Chương)
  folderName?: string; // Tên Thư mục (e.g. "Đề củng cố Bài học", "Đề ôn chương")
  startTime?: string;
  endTime?: string; 
  durationMinutes: number;
  questions: Question[];
  questionCount?: number; 
  attemptCount?: number;
  createdAt: string;
  isPublished: boolean;
  isMonitored?: boolean;
  isUnlisted?: boolean; 
  isSyncedToBank?: boolean; // Cờ đánh dấu đề thi đã được quét và đồng bộ vào Ngân hàng câu hỏi
  syncedToBankAt?: string; // Thời điểm đồng bộ vào Ngân hàng
  orderIndex?: number; // Thứ tự trong chương
  // Phân quyền giao đề theo Lớp học & Niên khóa
  targetType?: 'all' | 'classes'; // 'all' (tất cả hs cùng khối) | 'classes' (chỉ giao cho các lớp chỉ định)
  assignedClassIds?: string[]; // IDs của các lớp được giao đề
  assignedClasses?: { id: string; name: string; academicYear?: string }[]; // Thông tin chi tiết lớp để hiển thị nhanh
  maxAttempts?: number; // Số lần làm bài tối đa (mặc định là 2 cho đề thi)
  allowReview?: boolean; // Cho phép học sinh xem lại đáp án & lời giải chi tiết (Mặc định: BẬT cho Luyện tập, TẮT cho Đề thi nếu GV chưa mở)
}

export interface Result {
  id: string;
  quizId: string;
  quizTitle?: string;
  quizCategory?: string;
  quizType?: QuizType;
  studentId: string;
  studentName: string;
  studentCode?: string; 
  academicYear?: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number;
  detailScores?: number[];
  pointsAwarded?: number;
  bonusPoint?: number; 
  userAnswers?: Record<string, any>; 
  violationCount?: number;
  questionOrder?: string[]; // Ghi nhớ thứ tự ID câu hỏi đã xáo trộn riêng cho lượt làm bài này
}

export interface ExamSession {
  id: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  startTime: string;
  lastUpdate: string;
  violationCount: number;
  isFinished: boolean;
}

export interface PublishedResult {
  id: string;
  quizId: string;
  quizTitle: string;
  publishedAt: string;
  studentCodes: string[];
  results: Result[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LiveReviewStudentAnswer {
  studentId: string;
  studentName: string;
  studentCode: string;
  answer: any;
  submittedAt: string;
  isCorrect?: boolean;
  activationId?: string;
}

export interface LiveReviewSession {
  id: string; // e.g. "live_review_" + uuid
  quizId: string;
  quizTitle: string;
  grade: Grade;
  academicYear?: string;
  targetClassIds: string[];
  targetClassNames: string[];
  startTime: string; // ISO string t1
  endTime: string; // ISO string t2
  status: 'active' | 'ended';
  currentQuestionIndex: number;
  timeLimitSeconds: number; // e.g. 60, 120
  questionActivatedAt: string | null;
  activationId?: string;
  isQuestionLocked: boolean;
  showAnswer: boolean;
  showSolution: boolean;
  teacherNote?: string;
  allowPracticeRetry?: boolean;
  createdAt: string;
  updatedAt: string;
}
