
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
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  type: QuizType;
  grade: Grade;
  category?: string; 
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
  studentId: string;
  studentName: string;
  studentCode?: string; 
  score: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number;
  detailScores?: number[];
  pointsAwarded?: number;
  bonusPoint?: number; 
  userAnswers?: Record<string, any>; 
  violationCount?: number;
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
