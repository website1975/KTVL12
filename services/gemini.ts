
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("Chưa cấu hình Gemini API Key. Vui lòng thêm biến API_KEY vào Vercel.");
    }
    return new GoogleGenAI({ apiKey });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanJsonString = (str: string): string => {
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
            const isServerBusy = msg.includes('503') || msg.includes('overloaded') || msg.includes('429') || msg.includes('quota') || msg.includes('500') || msg.includes('apikey');
            
            if (msg.includes('apikey') || msg.includes('key not found')) {
                throw new Error("API Key không hợp lệ hoặc đã hết hạn.");
            }

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

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();
  const prompt = `
    Nhiệm vụ: Chuyển đổi PDF đề thi (định dạng mới 2025) sang JSON. 
    QUY TẮC TRÍCH XUẤT:
    1. Phần I (MCQ): Lấy correctAnswer từ dấu (*) hoặc text.
    2. Phần II (True/False): Trích xuất chính xác a-Đ, b-S...
    3. Phần III (Short): Đáp số là giá trị số.
    4. LỜI GIẢI: Trích xuất từ file nếu có trường lời giải/hướng dẫn.
    Giữ nguyên công thức Toán trong cặp ký hiệu $...$.
  `;

  try {
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
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
                            solution: { type: Type.STRING, nullable: true },
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
    const rawData = JSON.parse(cleanJsonString(text));
    return rawData.map((item: any) => ({
        id: uuidv4(),
        ...item,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
    }));
  } catch (error: any) {
     throw new Error(error.message || "Lỗi xử lý file.");
  }
};

export const generateQuizFromPrompt = async (config: {
    grade: string,
    category: string,
    topic: string,
    part1Count: number,
    part2Count: number,
    part3Count: number,
    difficulty: string
}): Promise<Question[]> => {
    const ai = getAIClient();
    const prompt = `
        Hãy đóng vai một chuyên gia soạn đề thi trắc nghiệm theo định dạng MOET 2025.
        YÊU CẦU: Soạn đề cho Lớp ${config.grade}, thuộc Chương/Mục: ${config.category}.
        CHỦ ĐỀ CHI TIẾT: ${config.topic}.
        MỨC ĐỘ TƯ DUY CHỦ ĐẠO: ${config.difficulty}.

        CẤU TRÚC ĐỀ CẦN SOẠN:
        1. Phần I: ${config.part1Count} câu trắc nghiệm 4 lựa chọn (mcq).
        2. Phần II: ${config.part2Count} câu Đúng/Sai (group-tf), mỗi câu 4 ý nhỏ.
        3. Phần III: ${config.part3Count} câu trả lời ngắn (short) - đáp án là số.

        YÊU CẦU KỸ THUẬT:
        - Các công thức toán lý hóa bắt buộc để trong dấu $...$ (VD: $x^2 + y = 0$).
        - Mỗi câu hỏi phải có trường 'solution' giải thích chi tiết cách giải.
        - Trả về JSON mảng Question.
    `;

    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
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
                                solution: { type: Type.STRING, nullable: true },
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
                            required: ["type", "text", "points", "solution"]
                        }
                    }
                }
            });
        });

        const text = response.text;
        if (!text) throw new Error("AI không phản hồi.");
        const rawData = JSON.parse(cleanJsonString(text));
        
        return rawData.map((item: any) => ({
            id: uuidv4(),
            ...item,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
        }));
    } catch (e: any) {
        throw new Error(e.message || "Lỗi soạn đề AI");
    }
};
