
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Question, QuestionType, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Đọc key từ import.meta.env (đã được map trong vite.config.ts)
// Fix: Cast import.meta to any to resolve missing property 'env' error
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
async function withRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const msg = error.toString().toLowerCase();
            
            // Kiểm tra các mã lỗi thường gặp do server bận: 503 (Overloaded), 429 (Rate Limit), 500 (Internal)
            const isServerBusy = msg.includes('503') || msg.includes('overloaded') || msg.includes('429') || msg.includes('quota') || msg.includes('500');
            
            if (isServerBusy && i < retries - 1) {
                console.warn(`Gemini API busy (Lần ${i + 1}/${retries}). Đang thử lại sau ${initialDelay}ms...`);
                await delay(initialDelay);
                initialDelay *= 2; // Tăng thời gian chờ lên gấp đôi (Exponential backoff)
                continue;
            }
            
            // Nếu không phải lỗi server busy hoặc đã hết số lần thử, ném lỗi ra ngoài
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
    - KHÔNG cần sinh lời giải chi tiết (solution) để tăng tốc độ, trừ khi là câu hỏi cực khó.
    - Sử dụng thẻ <br/> để xuống dòng.
    - Sử dụng Latex chuẩn cho công thức toán ($...$). Ví dụ: $\\sqrt{x}$, $\\frac{1}{2}$, $\\Rightarrow$, $\\approx$.
  `;

  try {
    // Áp dụng withRetry
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
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
    throw new Error("Không thể tạo câu hỏi tự động do hệ thống AI đang bận. Vui lòng thử lại sau vài giây.");
  }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();

  // Prompt được tối ưu để xử lý PDF nhiễu và định dạng số học
  const prompt = `
    Bạn là trợ lý nhập liệu đề thi thông minh. Nhiệm vụ: Trích xuất câu hỏi từ file PDF sang JSON.
    
    CHÚ Ý QUAN TRỌNG:
    - Bỏ qua Header, Footer, Số trang, Watermark (chữ chìm). Chỉ lấy nội dung câu hỏi.
    - Nếu câu hỏi bị ngắt trang, hãy tự động nối lại thành câu hoàn chỉnh.
    
    Cấu trúc đề thi cần tìm:
    1. PHẦN I (MCQ): 
       - Tìm câu hỏi và 4 đáp án (A, B, C, D).
       - Đáp án đúng: Thường có dấu (*), gạch chân, hoặc tô đậm. Nếu không có dấu hiệu, hãy TỰ GIẢI để tìm đáp án đúng.
    2. PHẦN II (Đúng/Sai):
       - Tìm các ý a), b), c), d).
       - Đáp án: (Đ)/(S) hoặc (True)/(False).
    3. PHẦN III (Trả lời ngắn):
       - Tìm câu hỏi và điền đáp án vào 'correctAnswer'.
       - BẮT BUỘC sinh lời giải vắn tắt vào 'solution'.

    Quy tắc định dạng:
    - Toán học: Dùng LaTeX giữa dấu $ (VD: $\\sqrt{x}$).
    - Điểm số (points): Phần I (0.25), Phần II (1.0), Phần III (0.5).

    Output JSON Strict:
  `;

  try {
    // Áp dụng withRetry cho cả hàm đọc PDF
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: "application/pdf", data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                // Tắt bộ lọc an toàn để tránh chặn nội dung giáo dục
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
    });

    const rawData = JSON.parse(response.text || '[]');

    return rawData.map((item: any) => ({
        id: uuidv4(),
        type: item.type,
        text: item.text,
        points: item.points,
        solution: item.solution || "", 
        options: item.options || undefined,
        correctAnswer: item.correctAnswer || undefined,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({
            id: uuidv4(),
            text: sq.text,
            correctAnswer: sq.correctAnswer
        })) : undefined
    }));

  } catch (error: any) {
     console.error("Gemini PDF Parse Error Full:", error);
     const msg = error.message || JSON.stringify(error);
     
     // Custom error messages
     if (msg.includes("503") || msg.includes("overloaded")) throw new Error("Server AI đang quá tải (503). Đã thử lại nhưng không thành công. Vui lòng đợi 1 phút và thử lại.");
     if (msg.includes("429")) throw new Error("Bạn đã gửi quá nhiều yêu cầu (429). Vui lòng đợi 30s rồi thử lại.");
     if (msg.includes("SAFETY")) throw new Error("File bị chặn bởi bộ lọc an toàn. Hãy kiểm tra nội dung nhạy cảm.");
     
     throw new Error(`Lỗi đọc file: ${msg.substring(0, 100)}... (Xem Console)`);
  }
};
