
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Nhiệm vụ: Chuyển đổi đề thi Toán từ PDF sang JSON.
    Quy tắc quan trọng:
    1. TRƯỜNG 'text': Chỉ chứa nội dung câu hỏi. KHÔNG bao gồm "Đáp án:", "Đáp số:".
    2. PHẦN I (mcq): Lấy 'correctAnswer' từ đáp án có dấu *.
    3. PHẦN II (group-tf): Bóc tách đúng 4 ý a, b, c, d theo THỨ TỰ.
    4. PHẦN III (short): Đưa đáp số vào 'correctAnswer'.
    5. LỜI GIẢI: Đưa vào 'solution'.
    Sử dụng LaTeX $ cho công thức.
  `;

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

    const rawData = JSON.parse(cleanJsonString(response.text || "[]"));
    return rawData.map((item: any) => ({
        id: uuidv4(),
        ...item,
        subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
    }));
  } catch (error) {
    console.error("Lỗi AI PDF:", error);
    throw error;
  }
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Soạn đề thi Toán lớp ${config.grade} - Chủ đề: ${config.topic}.
        Yêu cầu:
        - ${config.part1Count} câu trắc nghiệm (mcq).
        - ${config.part2Count} câu Đúng/Sai (group-tf) - mỗi câu 4 ý a,b,c,d.
        - ${config.part3Count} câu trả lời ngắn (short).
        Tất cả phải có giải thích (solution) và dùng LaTeX $.
    `;

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
                        required: ["type", "text", "solution"]
                    }
                }
            }
        });

        const rawData = JSON.parse(cleanJsonString(response.text || "[]"));
        return rawData.map((item: any) => ({
            id: uuidv4(),
            ...item,
            subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
        }));
    } catch (error) {
        console.error("Lỗi AI Soạn đề:", error);
        throw error;
    }
};
