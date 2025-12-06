
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

const API_KEY = process.env.API_KEY || ''; 

const getAIClient = () => {
    if (!API_KEY) {
        throw new Error("Vui lòng cấu hình API Key trong code hoặc biến môi trường.");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

export const generateQuestions = async (
  topic: string,
  grade: Grade,
  count: number,
  difficulty: string
): Promise<Question[]> => {
  
  const ai = getAIClient();

  const prompt = `
    Tạo ${count} câu hỏi trắc nghiệm khách quan (Phần I - 4 lựa chọn) cho lớp ${grade}, chủ đề "${topic}".
    Độ khó: ${difficulty}. Ngôn ngữ: Tiếng Việt.
    Định dạng JSON. Có điểm số mặc định là 0.25.
    Lưu ý: Nếu có công thức Toán học, hãy dùng Latex và đặt trong dấu $ (ví dụ $x^2$).
    QUAN TRỌNG: Hãy escape dấu backslash trong JSON string (ví dụ dùng \\\\frac thay vì \\frac).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question_text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correct_answer: { type: Type.STRING }
            },
            required: ["question_text", "options", "correct_answer"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || '[]');
    
    return rawData.map((item: any) => ({
      id: uuidv4(),
      type: 'mcq',
      text: item.question_text,
      options: item.options,
      correctAnswer: item.correct_answer,
      points: 0.25 // Default point for Part I
    }));

  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Không thể tạo câu hỏi tự động.");
  }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();

  const prompt = `
    Bạn là trợ lý soạn đề thi theo mẫu mới của Bộ GD&ĐT Việt Nam (từ 2025).
    Hãy đọc file PDF và trích xuất câu hỏi theo 3 phần:
    
    1. PHẦN I: Trắc nghiệm nhiều lựa chọn (MCQ). (Type: 'mcq')
       - 4 lựa chọn A, B, C, D. Chọn 1 đúng.
    
    2. PHẦN II: Trắc nghiệm Đúng/Sai (Grouped True/False). (Type: 'group-tf')
       - Một câu dẫn chính.
       - 4 ý nhỏ (a, b, c, d). Mỗi ý phải xác định là Đúng (True) hay Sai (False).
    
    3. PHẦN III: Trả lời ngắn. (Type: 'short')
       - Học sinh điền số hoặc văn bản ngắn.

    Yêu cầu về định dạng Toán học (LaTeX):
    - Hãy giữ nguyên công thức toán học dưới dạng LaTeX.
    - Bao quanh công thức bằng dấu $. Ví dụ: $x^2 + 2x + 1 = 0$.
    - RẤT QUAN TRỌNG: Khi trả về JSON string, bạn PHẢI escape các dấu gạch chéo ngược (backslash). 
      Ví dụ: để hiển thị \frac, trong chuỗi JSON phải viết là \\frac. Để hiển thị \alpha, viết là \\alpha.

    Yêu cầu Output JSON Strict:
    - field 'type': 'mcq' | 'group-tf' | 'short'
    - field 'points': Mặc định (Phần I: 0.25, Phần II: 1.0, Phần III: 0.5)
    - Nếu là 'group-tf': field 'subQuestions' là mảng 4 phần tử {text: string, correctAnswer: 'True'|'False'}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["mcq", "group-tf", "short"] },
              text: { type: Type.STRING },
              points: { type: Type.NUMBER },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              correctAnswer: { type: Type.STRING, nullable: true },
              subQuestions: {
                type: Type.ARRAY,
                nullable: true,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    correctAnswer: { type: Type.STRING, enum: ["True", "False"] }
                  }
                }
              }
            },
            required: ["type", "text", "points"]
          }
        }
      }
    });

    const rawData = JSON.parse(response.text || '[]');

    return rawData.map((item: any) => ({
        id: uuidv4(),
        type: item.type,
        text: item.text,
        points: item.points,
        options: item.options || undefined,
        correctAnswer: item.correctAnswer || undefined,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({
            id: uuidv4(),
            text: sq.text,
            correctAnswer: sq.correctAnswer
        })) : undefined
    }));

  } catch (error) {
     console.error("Gemini PDF Parse Error:", error);
     throw new Error("Lỗi đọc file PDF. Đảm bảo file đúng định dạng đề thi mới.");
  }
};
