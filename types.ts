
export type Role = 'admin' | 'student';
export type Grade = '10' | '11' | '12' | 'all';
export type QuizType = 'practice' | 'test';
export type QuestionType = 'mcq' | 'group-tf' | 'short';

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  fullName: string;
  studentCode?: string; 
  grade?: Grade;
  points?: number;
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
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number | string;
  imageUrl?: string;
  solution?: string; 
  options?: string[]; 
  correctAnswer?: string; 
  subQuestions?: SubQuestion[];
  quizTitle?: string;
  quizGrade?: Grade;
  quizCategory?: string;
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
  orderIndex?: number; // Thứ tự trong chương
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
