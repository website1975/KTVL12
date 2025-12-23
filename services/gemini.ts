
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Question, QuestionType, Grade } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Đọc key từ import.meta.env
const API_KEY = (import.meta as any).env.API_KEY || ''; 

const getAIClient = () => {
    if (!API_KEY) {
        throw new Error("Vui lòng cấu hình API Key trong file .env");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm dọn dẹp chuỗi JSON trước khi parse
const cleanJsonString = (str: string): string => {
    // Loại bỏ markdown code blocks nếu có
    let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
    return cleaned;
};

async function withRetry<T>(operation: () => Promise<T>, retries = 3, initialDelay = 3000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorStr = (error.message || '') + ' ' + JSON.stringify(error);
            const msg = errorStr.toLowerCase();
            const isServerBusy = msg.includes('503') || msg.includes('overloaded') || msg.includes('429') || msg.includes('quota') || msg.includes('500');
            
            if (isServerBusy && i < retries - 1) {
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
  const prompt = `Tạo ${count} câu hỏi trắc nghiệm khách quan lớp ${grade}, chủ đề "${topic}". Định dạng JSON siêu gọn.`;

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
                            correct_answer: { type: Type.STRING }
                        },
                        required: ["question_text", "options", "correct_answer"]
                    }
                }
            }
        });
    });

    const rawData = JSON.parse(cleanJsonString(response.text || '[]'));
    return rawData.map((item: any) => ({
      id: uuidv4(),
      type: 'mcq',
      text: item.question_text,
      options: item.options,
      correctAnswer: item.correct_answer,
      solution: "",
      points: 0.25
    }));
  } catch (error) {
    throw new Error("Không thể tạo câu hỏi tự động.");
  }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();

  // Prompt tối ưu hóa: Yêu cầu AI viết cực kỳ ngắn gọn để tránh bị cắt cụt JSON
  const prompt = `
    Nhiệm vụ: Chuyển PDF đề thi sang JSON. 
    QUY TẮC ĐÁP ÁN: 
    - Dấu sao (*) ở lựa chọn nào thì đó là 'correctAnswer'. Ví dụ: "*A. Nội dung" -> options xóa "*", correctAnswer = "A. Nội dung".
    - Phần II (Đúng/Sai): Nhận diện (Đ)/(S).
    - Phần III: Lấy giá trị sau "Đáp án:".
    
    YÊU CẦU QUAN TRỌNG:
    - Trả về JSON NGUYÊN BẢN, KHÔNG khoảng trắng thừa, KHÔNG giải thích.
    - Nếu file quá dài, chỉ ưu tiên trích xuất nội dung text chính xác.
    - Giữ LaTeX trong $...$.
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
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
                responseMimeType: "application/json",
                // Thiết kế Schema tối giản để giảm dung lượng text trả về
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

    const text = response.text;
    if (!text) throw new Error("AI không trả về dữ liệu.");

    const cleanedText = cleanJsonString(text);

    try {
        const rawData = JSON.parse(cleanedText);
        return rawData.map((item: any) => ({
            id: uuidv4(),
            type: item.type,
            text: item.text,
            points: item.points,
            solution: "",
            options: item.options || undefined,
            correctAnswer: item.correctAnswer || undefined,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({
                id: uuidv4(),
                text: sq.text,
                correctAnswer: sq.correctAnswer
            })) : undefined
        }));
    } catch (parseError: any) {
        console.error("JSON Parse Error. Raw Text Snippet:", cleanedText.substring(cleanedText.length - 100));
        throw new Error("Dữ liệu PDF quá lớn khiến kết quả bị cắt cụt. Vui lòng chia nhỏ PDF (dưới 5 trang) và thử lại.");
    }

  } catch (error: any) {
     throw new Error(error.message || "Lỗi xử lý file.");
  }
};
