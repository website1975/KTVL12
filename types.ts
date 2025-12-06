
export type Role = 'admin' | 'student';
export type Grade = '10' | '11' | '12';
export type QuizType = 'practice' | 'test';
export type QuestionType = 'mcq' | 'group-tf' | 'short'; // Updated types for MOET format

export interface User {
  id: string;
  username: string;
  password: string; // In real app, hash this!
  role: Role;
  fullName: string;
  grade?: Grade; // Only for students
}

export interface SubQuestion {
  id: string;
  text: string; // The statement (e.g., "a) Hàm số đồng biến...")
  correctAnswer: 'True' | 'False';
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string; // The main question stem
  points: number | string; // Teacher manually sets points - allow string for flexible input
  imageUrl?: string;
  
  // For MCQ (Part I)
  options?: string[]; 
  correctAnswer?: string; 

  // For Group True/False (Part II)
  subQuestions?: SubQuestion[];

  // For Short Answer (Part III) - uses correctAnswer field
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  type: QuizType;
  grade: Grade;
  startTime?: string;
  durationMinutes: number;
  questions: Question[];
  createdAt: string;
  isPublished: boolean; // New field: determines if students can see the quiz
}

export interface Result {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  submittedAt: string;
  durationSeconds: number; // Time taken in seconds
  detailScores?: number[]; // Score per question
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
