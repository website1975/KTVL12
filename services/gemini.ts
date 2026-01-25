
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Bạn là chuyên gia soạn đề Toán lớp ${config.grade} VN. 
Chủ đề: ${config.topic}.
Số lượng: ${config.part1Count} câu mcq, ${config.part2Count} câu group-tf, ${config.part3Count} câu short.
Quy tắc:
1. Dùng LaTeX $...$ cho công thức.
2. mcq: 4 options, 1 correctAnswer.
3. group-tf: 4 subQuestions {text, correctAnswer: "True"/"False"}.
4. short: correctAnswer là số.
Trả về mảng JSON.`;

    try {
        // Fix: Use gemini-3-pro-preview for complex STEM/Math reasoning tasks
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING },
                            text: { type: Type.STRING },
                            points: { type: Type.NUMBER },
                            options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                            correctAnswer: { type: Type.STRING, nullable: true },
                            solution: { type: Type.STRING },
                            subQuestions: {
                                type: Type.ARRAY,
                                nullable: true,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING },
                                        correctAnswer: { type: Type.STRING }
                                    }
                                }
                            }
                        },
                        required: ["type", "text", "points", "solution"]
                    }
                }
            }
        });

        const textOutput = response.text || "[]";
        const rawData = JSON.parse(cleanJsonString(textOutput));
        
        return rawData.map((item: any) => ({
            ...item,
            id: uuidv4(),
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
                ...sq, 
                id: uuidv4(),
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        console.error("Lỗi Gemini:", error);
        if (error.message?.includes('429')) {
            throw new Error("Hệ thống AI đang bận (Rate Limit). Vui lòng đợi 1 phút và thử lại.");
        }
        throw new Error("AI gặp lỗi khi định dạng dữ liệu. Vui lòng thử lại với yêu cầu ngắn hơn.");
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Phân tích PDF đề thi Toán và trích xuất thành JSON mảng câu hỏi.
Dùng LaTeX $...$ cho công thức toán học.

Quy tắc nhận diện từ file:
- PHẦN 1 (mcq): Nhận diện các phương án A, B, C, D. Nếu phương án có dấu sao (*) phía trước (ví dụ *B.) thì đó là correctAnswer.
- PHẦN 2 (group-tf): Nhận diện 4 ý a, b, c, d. Nếu ghi Đúng hoặc (Đ) thì correctAnswer="True", nếu ghi Sai hoặc (S) thì correctAnswer="False".
- PHẦN 3 (short): Trích xuất câu hỏi và đáp số sau chữ "Đáp án:".
- Tất cả các phần: Trích xuất nội dung sau chữ "Lời giải:" vào trường solution.

Yêu cầu trả về JSON đúng cấu trúc mảng đối tượng.`;

  try {
    // Fix: Use gemini-3-pro-preview for high-quality complex reasoning extraction from PDF
    const response = await ai.models.generateContent({
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
                    type: { type: Type.STRING, description: "'mcq' | 'group-tf' | 'short'" },
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
                                correctAnswer: { type: Type.STRING, description: "'True' | 'False'" }
                            }
                        }
                    }
                },
                required: ["type", "text"]
            }
        }
      }
    });

    const textOutput = response.text || "[]";
    const rawData = JSON.parse(cleanJsonString(textOutput));
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("AI không tìm thấy hoặc không thể đọc được câu hỏi nào từ file PDF này.");
    }

    return rawData.map((item: any) => ({
        ...item,
        id: uuidv4(),
        points: item.points || (item.type === 'mcq' ? 0.25 : 1.0),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true || sq.correctAnswer === 'Đúng' || sq.correctAnswer === 'Đ') ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error: any) {
    console.error("Lỗi Gemini PDF:", error);
    throw new Error(error.message || "Lỗi không xác định khi xử lý PDF.");
  }
};
