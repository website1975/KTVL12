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

const normalizeContext = (c?: string): string => {
  if (!c) return '';
  return c.replace(/\r\n/g, '\n').trim();
};

/**
 * Gom nhóm các câu hỏi có chung ngữ cảnh/lời dẫn (context) để khi xáo trộn,
 * các câu hỏi trong cùng chùm dữ liệu BẮT BUỘC đi liền với nhau và GIỮ NGUYÊN thứ tự nội bộ.
 */
export function groupQuestionsByContext(questions: Question[]): Question[][] {
  const groups: Question[][] = [];
  let currentGroup: Question[] = [];
  let currentContext: string | undefined = undefined;

  for (const q of questions) {
    const ctx = normalizeContext(q.context);
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
 * - Các câu hỏi có Lời dẫn / Dữ liệu dùng chung (context) sẽ GIỮ NGUYÊN VỊ TRÍ CỐ ĐỊNH, không bị xáo trộn.
 * - Các câu hỏi đơn lập (không có context) sẽ được xáo trộn ngẫu nhiên vào các vị trí còn lại.
 */
export function shuffleQuestionsByParts(questions: Question[]): Question[] {
  if (!questions || questions.length === 0) return [];

  const mcqQuestions = questions.filter(q => q.type === 'mcq');
  const tfQuestions = questions.filter(q => q.type === 'group-tf');
  const shortQuestions = questions.filter(q => q.type === 'short');

  const shufflePart = (partQuestions: Question[]): Question[] => {
    if (partQuestions.length <= 1) return partQuestions;

    const result: (Question | null)[] = new Array(partQuestions.length).fill(null);
    const freeQuestions: Question[] = [];

    // 1. Giữ nguyên vị trí cố định cho các câu hỏi có chứa lời dẫn chung (context)
    partQuestions.forEach((q, index) => {
      const ctx = normalizeContext(q.context);
      if (ctx) {
        result[index] = q; // Cố định vị trí
      } else {
        freeQuestions.push(q);
      }
    });

    // 2. Xáo trộn ngẫu nhiên các câu hỏi đơn lập không có context
    const shuffledFree = shuffleArray(freeQuestions);

    // 3. Điền các câu hỏi đã xáo vào các ô trống còn lại
    let freeIdx = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i] === null) {
        result[i] = shuffledFree[freeIdx++];
      }
    }

    return result as Question[];
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
