
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
            
            const isQuotaError = msg.includes('429') || msg.includes('quota');
            const isServerBusy = msg.includes('503') || msg.includes('overloaded') || msg.includes('500');
            const isAuthError = msg.includes('apikey') || msg.includes('key not found') || msg.includes('invalid');

            if (isAuthError) {
                throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại cấu hình trên Vercel.");
            }

            if ((isQuotaError || isServerBusy) && i < retries - 1) {
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
    Nhiệm vụ: Chuyển đổi PDF đề thi sang JSON. 
    QUY TẮC CỰC KỲ NGHIÊM NGẶT:
    1. 'text': CHỈ chứa nội dung câu hỏi. TUYỆT ĐỐI KHÔNG chứa "Câu 1.", "Câu 2:" hay các ký tự phương án "A.", "B.".
    2. 'options': Cho MCQ, phải là mảng 4 chuỗi sạch. KHÔNG chứa "A.", "B." bên trong chuỗi.
    3. 'correctAnswer': Phải khớp 100% với nội dung trong mảng options.
    4. Tự động gán điểm mặc định: MCQ (0.25), Group-TF (1.0), Short (0.5).
  `;

  try {
    const response = await withRetry(async () => {
        return await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
                        required: ["type", "text"]
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
        points: item.points || (item.type === 'mcq' ? 0.25 : (item.type === 'group-tf' ? 1.0 : 0.5)),
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
        Soạn đề thi Toán học Lớp ${config.grade} - Chủ đề: ${config.topic}.
        YÊU CẦU DỮ LIỆU SẠCH (BẮT BUỘC):
        1. 'text': KHÔNG chứa "Câu X:" hay "A.", "B.". Chỉ chứa nội dung câu hỏi.
        2. 'options': Mảng 4 chuỗi sạch. KHÔNG chứa "A. ", "B. ".
        3. 'correctAnswer': Phải khớp 100% với một phần tử trong 'options'.
        4. 'solution': Giải thích chi tiết cách làm.
        
        SỐ LƯỢNG: ${config.part1Count} câu MCQ, ${config.part2Count} câu Đúng/Sai, ${config.part3Count} câu Trả lời ngắn.
        ĐỘ KHÓ: ${config.difficulty}.
    `;

    try {
        const response = await withRetry(async () => {
            return await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
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
                            required: ["type", "text", "solution", "correctAnswer"]
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
            points: item.points || (item.type === 'mcq' ? 0.25 : (item.type === 'group-tf' ? 1.0 : 0.5)),
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
        }));
    } catch (e: any) {
        throw new Error(e.message || "Lỗi soạn đề AI");
    }
};
