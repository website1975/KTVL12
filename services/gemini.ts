
/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Đọc key từ import.meta.env (đã được map trong vite.config.ts)
const API_KEY = import.meta.env.API_KEY || ''; 

const getAIClient = () => {
    if (!API_KEY) {
        throw new Error("Vui lòng cấu hình API Key trong file .env");
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
    Định dạng JSON.
    
    Yêu cầu:
    - KHÔNG cần sinh lời giải chi tiết (solution) để tăng tốc độ, trừ khi là câu hỏi cực khó.
    - Sử dụng thẻ <br/> để xuống dòng.
    - Sử dụng Latex chuẩn cho công thức toán ($...$). Ví dụ: $\\sqrt{x}$, $\\frac{1}{2}$, $\\Rightarrow$, $\\approx$.
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
              correct_answer: { type: Type.STRING },
              solution: { type: Type.STRING }
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
      solution: item.solution || "",
      points: 0.25
    }));

  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Không thể tạo câu hỏi tự động.");
  }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();

  const prompt = `
    Bạn là trợ lý nhập liệu đề thi thông minh. Nhiệm vụ: Trích xuất câu hỏi từ file PDF sang JSON.
    
    Ưu tiên tốc độ và định dạng gọn nhẹ:
    1. PHẦN I (MCQ): 
       - Tìm câu hỏi và 4 đáp án.
       - Đáp án đúng thường được đánh dấu bằng dấu sao (*) hoặc tô đậm/khoanh tròn. Nếu không thấy, hãy tự giải.
       - KHÔNG cần sinh field 'solution' (để trống).

    2. PHẦN II (Đúng/Sai):
       - Tìm các ý a, b, c, d.
       - Đáp án thường ghi là (Đ) hoặc (S), hoặc (True)/(False).
       - KHÔNG cần sinh field 'solution' (để trống).

    3. PHẦN III (Trả lời ngắn):
       - BẮT BUỘC phải điền đáp án vào 'correctAnswer'.
       - BẮT BUỘC sinh lời giải vắn tắt vào field 'solution' (Ví dụ: "Giải pt ta được x=2").

    Quy tắc định dạng văn bản (Rich Text):
    - Xuống dòng: Sử dụng thẻ <br/>
    - Căn, mũ, phân số, ký hiệu đặc biệt: Dùng LaTeX đặt trong dấu $.
      Ví dụ: $\\sqrt{x}$, $x^2$, $\\frac{a}{b}$, $\\approx$, $\\Leftrightarrow$, $\\Rightarrow$.
    - Escape JSON: Chú ý escape dấu gạch chéo ngược (ví dụ \\frac phải viết là \\\\frac).

    Output JSON Strict:
    - type: 'mcq' | 'group-tf' | 'short'
    - points: 0.25 (mcq), 1.0 (group-tf), 0.5 (short)
    - subQuestions: [{text: string, correctAnswer: 'True'|'False'}] (chỉ dùng cho group-tf)
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
              solution: { type: Type.STRING },
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
        solution: item.solution || "", // Mặc định rỗng cho nhanh, trừ phần III
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
     throw new Error("Lỗi đọc file PDF. Vui lòng thử lại với file rõ nét hơn.");
  }
};
