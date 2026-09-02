import { Question } from '../types';

/**
 * Thuật toán xáo trộn mảng ngẫu nhiên Fisher-Yates
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Gom nhóm các câu hỏi có chung ngữ cảnh/lời dẫn (context) để khi xáo trộn,
 * các câu hỏi trong cùng chùm dữ liệu vẫn đi liền với nhau.
 */
export function groupQuestionsByContext(questions: Question[]): Question[][] {
  const groups: Question[][] = [];
  let currentGroup: Question[] = [];
  let currentContext: string | undefined = undefined;

  for (const q of questions) {
    const ctx = (q.context || '').trim();
    if (ctx && currentContext && ctx === currentContext) {
      currentGroup.push(q);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [q];
      currentContext = ctx || undefined;
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
}

/**
 * Xáo trộn thứ tự các câu hỏi thông minh theo 3 phần riêng biệt:
 * - Phần 1: Xáo trộn nội bộ trong Phần 1 (Trắc nghiệm nhiều lựa chọn - MCQ)
 * - Phần 2: Xáo trộn nội bộ trong Phần 2 (Trắc nghiệm Đúng/Sai - Group TF)
 * - Phần 3: Xáo trộn nội bộ trong Phần 3 (Trắc nghiệm Trả lời ngắn - Short Answer)
 */
export function shuffleQuestionsByParts(questions: Question[]): Question[] {
  if (!questions || questions.length === 0) return [];

  const mcqQuestions = questions.filter(q => q.type === 'mcq');
  const tfQuestions = questions.filter(q => q.type === 'group-tf');
  const shortQuestions = questions.filter(q => q.type === 'short');

  const shufflePart = (partQuestions: Question[]): Question[] => {
    if (partQuestions.length <= 1) return partQuestions;
    // Gom nhóm các câu có cùng dữ liệu dẫn/context
    const grouped = groupQuestionsByContext(partQuestions);
    // Xáo trộn thứ tự các nhóm câu hỏi
    const shuffledGroups = shuffleArray(grouped);
    return shuffledGroups.flat();
  };

  const shuffledMcq = shufflePart(mcqQuestions);
  const shuffledTf = shufflePart(tfQuestions);
  const shuffledShort = shufflePart(shortQuestions);

  return [...shuffledMcq, ...shuffledTf, ...shuffledShort];
}

/**
 * Khôi phục lại chính xác thứ tự các câu hỏi theo mã ID đã lưu (khi học sinh nộp bài hoặc xem lại lịch sử)
 */
export function restoreQuestionsOrder(questions: Question[], questionOrder?: string[]): Question[] {
  if (!questions || questions.length === 0) return [];

  // Nếu không có mảng thứ tự lưu vết -> trả về theo thứ tự chuẩn theo Phần 1, 2, 3
  if (!questionOrder || !Array.isArray(questionOrder) || questionOrder.length === 0) {
    const mcq = questions.filter(q => q.type === 'mcq');
    const tf = questions.filter(q => q.type === 'group-tf');
    const short = questions.filter(q => q.type === 'short');
    return [...mcq, ...tf, ...short];
  }

  const questionMap = new Map<string, Question>();
  questions.forEach(q => questionMap.set(q.id, q));

  const ordered: Question[] = [];
  const addedIds = new Set<string>();

  // Sắp xếp theo đúng danh sách ID đã lưu
  for (const id of questionOrder) {
    const q = questionMap.get(id);
    if (q) {
      ordered.push(q);
      addedIds.add(id);
    }
  }

  // Bổ sung các câu hỏi chưa có trong danh sách ID đã lưu (đề phòng chỉnh sửa bổ sung)
  for (const q of questions) {
    if (!addedIds.has(q.id)) {
      ordered.push(q);
    }
  }

  return ordered;
}
