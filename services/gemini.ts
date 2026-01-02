
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
    Quy tắc bóc tách:
    1. PHẦN I (mcq): Nhận diện dấu '*' ở đầu phương án là đáp án đúng (VD: *A. Nội dung).
    2. PHẦN II (group-tf): Nhận diện (Đ) là True, (S) là False ở cuối mỗi ý a, b, c, d.
    3. PHẦN III (short): Lấy giá trị sau từ "Đáp án:" hoặc "Kết quả:".
    4. LỜI GIẢI: Tất cả nội dung sau chữ "Lời giải:" đưa vào trường 'solution'.
    
    Cấu trúc JSON: Array<{type, text, points, options?, correctAnswer?, solution?, subQuestions?}>
    Lưu ý: Giữ nguyên công thức Toán dạng LaTeX trong dấu $.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
          { inlineData: { mimeType: "application/pdf", data: base64Data } },
          { text: prompt }
      ],
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
        - ${config.part2Count} câu Đúng/Sai (group-tf).
        - ${config.part3Count} câu trả lời ngắn (short).
        Tất cả phải có lời giải chi tiết (solution) và dùng LaTeX $.
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
