
export type Role = 'admin' | 'student';
export type Grade = '10' | '11' | '12';
export type QuizType = 'practice' | 'test';
export type QuestionType = 'mcq' | 'group-tf' | 'short';

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  fullName: string;
  studentCode?: string; // Mã số học sinh
  grade?: Grade;
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
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  type: QuizType;
  grade: Grade;
  category?: string; 
  startTime?: string;
  durationMinutes: number;
  questions: Question[];
  createdAt: string;
  isPublished: boolean;
}

export interface Result {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number;
  detailScores?: number[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
