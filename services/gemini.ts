
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/gi, "").replace(/```/gi, "").trim();
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Tối ưu prompt ngắn gọn hơn để tránh quá tải token
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
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
                correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true) ? 'True' : 'False'
            })) : undefined
        }));
    } catch (error: any) {
        console.error("Lỗi Gemini:", error);
        // Bắt lỗi Rate Limit (429) để thông báo cho người dùng
        if (error.message?.includes('429')) {
            throw new Error("Hệ thống AI đang bận (Rate Limit). Vui lòng đợi 1 phút và thử lại.");
        }
        throw new Error("AI gặp lỗi khi định dạng dữ liệu. Vui lòng thử lại với yêu cầu ngắn hơn.");
    }
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Phân tích PDF đề Toán và chuyển sang JSON mảng câu hỏi (LaTeX $...$).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
          parts: [
              { inlineData: { mimeType: "application/pdf", data: base64Data } },
              { text: prompt }
          ]
      },
      config: { responseMimeType: "application/json" }
    });

    const textOutput = response.text || "[]";
    const rawData = JSON.parse(cleanJsonString(textOutput));
    const questions = Array.isArray(rawData) ? rawData : (rawData.questions || []);

    return questions.map((item: any) => ({
        ...item,
        id: uuidv4(),
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ 
            ...sq, 
            id: uuidv4(),
            correctAnswer: (sq.correctAnswer === 'True' || sq.correctAnswer === true) ? 'True' : 'False'
        })) : undefined
    }));
  } catch (error) {
    console.error("Lỗi Gemini PDF:", error);
    throw error;
  }
};
