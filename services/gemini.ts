
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Question, QuestionType, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Đọc key từ import.meta.env (đã được map trong vite.config.ts)
const API_KEY = (import.meta as any).env.API_KEY || ''; 

const getAIClient = () => {
    if (!API_KEY) {
        throw new Error("Vui lòng cấu hình API Key trong file .env");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

// Hàm delay để đợi trước khi thử lại
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm bọc để thực hiện cơ chế Retry (Thử lại khi lỗi server)
async function withRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 3000): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorStr = (error.message || '') + ' ' + JSON.stringify(error);
            const msg = errorStr.toLowerCase();
            
            const isServerBusy = msg.includes('503') || msg.includes('overloaded') || msg.includes('429') || msg.includes('quota') || msg.includes('500') || msg.includes('internal error');
            
            if (isServerBusy && i < retries - 1) {
                console.warn(`Gemini API busy (Lần ${i + 1}/${retries}). Đang thử lại sau ${initialDelay}ms...`);
                await delay(initialDelay);
                initialDelay *= 2; 
                continue;
            }
            
            throw error;
        }
    }
    throw lastError;
}

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
    - Sử dụng thẻ <br/> để xuống dòng.
    - Sử dụng Latex chuẩn cho công thức toán ($...$).
  `;

  try {
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("Không thể tạo câu hỏi tự động lúc này.");
  }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();

  const prompt = `
    Nhiệm vụ: Trích xuất văn bản đề thi từ PDF sang JSON nguyên văn.
    
    QUY TẮC NHẬN DIỆN ĐÁP ÁN (QUAN TRỌNG NHẤT):
    1. Nếu thấy ký tự dấu sao (*) nằm ở bất kỳ đâu trong một lựa chọn (ví dụ: *A. Nội dung, A. *Nội dung, hoặc *[Đáp án]):
       a) Hãy coi đó là đáp án ĐÚNG.
       b) Khi đưa vào mảng 'options', PHẢI XOÁ ký tự dấu sao (*) này đi.
       c) Giá trị gán vào 'correctAnswer' PHẢI TRÙNG KHỚP 100% với chuỗi đã xử lý trong mảng 'options'. 
          Ví dụ: Nếu options là ["A. Đáp án 1", "B. Đáp án 2"], và B có dấu *, thì correctAnswer PHẢI LÀ "B. Đáp án 2".
    2. Đối với Phần II (Đúng/Sai): Nhận diện ký hiệu (Đ)/(S) hoặc (T)/(F) để điền 'correctAnswer' là "True" hoặc "False". Xoá ký hiệu (Đ)/(S) khỏi text của subQuestion.
    3. Đối với Phần III (Trả lời ngắn): Trích xuất giá trị sau chữ "Đáp án:" hoặc "Kết quả:".

    Yêu cầu định dạng:
    - Công thức toán học giữ nguyên LaTeX trong dấu $. Cẩn thận không để dấu sao (*) dính vào dấu $ làm hỏng LaTeX.
    - 'solution' để trống "".
    - Trả về mảng JSON đúng cấu trúc schema.
  `;

  try {
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
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
    });

    const rawData = JSON.parse(response.text || '[]');

    return rawData.map((item: any) => ({
        id: uuidv4(),
        type: item.type,
        text: item.text,
        points: item.points,
        solution: "",
        options: item.options || undefined,
        correctAnswer: item.correct_answer || item.correctAnswer || undefined,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({
            id: uuidv4(),
            text: sq.text,
            correctAnswer: sq.correctAnswer
        })) : undefined
    }));

  } catch (error: any) {
     console.error("Gemini PDF Parse Error:", error);
     throw new Error(`Lỗi đọc file: ${error.message || "Hệ thống AI bận, vui lòng thử lại."}`);
  }
};
