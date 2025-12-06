
import { User, Quiz, Result } from '../types';

const KEYS = {
  USERS: 'eduquiz_users',
  QUIZZES: 'eduquiz_quizzes',
  RESULTS: 'eduquiz_results',
  CURRENT_USER: 'eduquiz_current_user',
};

// --- Users ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(KEYS.USERS);
  return data ? JSON.parse(data) : [];
};

export const saveUser = (user: User): void => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
};

export const findUser = (username: string): User | undefined => {
  return getUsers().find((u) => u.username === username);
};

// --- Quizzes ---
export const getQuizzes = (): Quiz[] => {
  const data = localStorage.getItem(KEYS.QUIZZES);
  return data ? JSON.parse(data) : [];
};

export const saveQuiz = (quiz: Quiz): void => {
  const quizzes = getQuizzes();
  quizzes.push(quiz);
  localStorage.setItem(KEYS.QUIZZES, JSON.stringify(quizzes));
};

export const updateQuiz = (updatedQuiz: Quiz): void => {
  const quizzes = getQuizzes();
  const index = quizzes.findIndex((q) => q.id === updatedQuiz.id);
  if (index !== -1) {
    quizzes[index] = updatedQuiz;
    localStorage.setItem(KEYS.QUIZZES, JSON.stringify(quizzes));
  }
};

export const deleteQuiz = (id: string): void => {
  const quizzes = getQuizzes().filter((q) => q.id !== id);
  localStorage.setItem(KEYS.QUIZZES, JSON.stringify(quizzes));
};

// --- Results ---
export const getResults = (): Result[] => {
  const data = localStorage.getItem(KEYS.RESULTS);
  return data ? JSON.parse(data) : [];
};

export const saveResult = (result: Result): void => {
  const results = getResults();
  results.push(result);
  localStorage.setItem(KEYS.RESULTS, JSON.stringify(results));
};

export const hasStudentTakenQuiz = (studentId: string, quizId: string): boolean => {
  const results = getResults();
  return results.some((r) => r.studentId === studentId && r.quizId === quizId);
};

export const getStudentStats = (studentId: string) => {
  const results = getResults().filter(r => r.studentId === studentId);
  
  const totalQuizzes = results.length;
  
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const avgScore = totalQuizzes > 0 ? (totalScore / totalQuizzes) : 0;
  
  // Sum up durationSeconds (fallback to 0 if not present)
  const totalSeconds = results.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);

  return {
    totalQuizzes,
    avgScore,
    totalSeconds
  };
};

// --- Init Data (for demo) ---
export const initStorage = () => {
  if (!localStorage.getItem(KEYS.USERS)) {
    const admin: User = {
      id: 'admin-1',
      username: 'admin',
      password: '123',
      role: 'admin',
      fullName: 'Thầy Giáo (Admin)',
    };
    const student10: User = {
        id: 's-10',
        username: 'hs10',
        password: '123',
        role: 'student',
        grade: '10',
        fullName: 'Nguyễn Văn A (Lớp 10)',
    };
    const student12: User = {
        id: 's-12',
        username: 'hs12',
        password: '123',
        role: 'student',
        grade: '12',
        fullName: 'Trần Thị B (Lớp 12)',
    };
    localStorage.setItem(KEYS.USERS, JSON.stringify([admin, student10, student12]));
  }
};
