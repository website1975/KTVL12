
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Nhiệm vụ: Chuyển đổi nội dung PDF đề thi Toán sang JSON.
    
    YÊU CẦU CẤU TRÚC 3 PHẦN:
    1. PHẦN I (mcq): Các câu trắc nghiệm 4 lựa chọn. Đáp án đúng được đánh dấu bằng dấu '*' ở đầu (VD: *A. Nội dung).
    2. PHẦN II (group-tf): Các câu Đúng/Sai. Mỗi câu có 4 ý a, b, c, d. Cuối mỗi ý có (Đ) là Đúng, (S) là Sai.
    3. PHẦN III (short): Các câu trả lời ngắn. Đáp án nằm sau chữ "Đáp án:" hoặc "Kết quả:".
    
    LƯU Ý QUAN TRỌNG:
    - LỜI GIẢI: Mọi nội dung sau từ khóa "Lời giải:" hoặc "Hướng dẫn giải:" phải đưa vào trường 'solution'.
    - PHẦN 'text' của câu hỏi phải dừng lại TRƯỚC từ khóa "Lời giải:".
    - Công thức toán học giữ nguyên định dạng LaTeX (nếu có).

    TRẢ VỀ JSON ARRAY:
    { "type": "mcq" | "group-tf" | "short", "text": "...", "points": 0.25, "options": [], "correctAnswer": "...", "solution": "...", "subQuestions": [{"text": "...", "correctAnswer": "True" | "False"}] }
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
        { inlineData: { mimeType: "application/pdf", data: base64Data } },
        { text: prompt }
    ],
    config: {
        responseMimeType: "application/json",
    }
  });

  const rawData = JSON.parse(cleanJsonString(response.text || "[]"));
  return rawData.map((item: any) => ({
      id: uuidv4(),
      ...item,
      subQuestions: item.subQuestions ? item.subQuestions.map((sq: any) => ({ ...sq, id: uuidv4() })) : undefined
  }));
};

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Hãy đóng vai chuyên gia soạn đề thi Toán lớp ${config.grade}.
        Chủ đề: ${config.topic}.
        Yêu cầu đề thi gồm:
        - ${config.part1Count} câu trắc nghiệm (mcq).
        - ${config.part2Count} câu Đúng/Sai (group-tf).
        - ${config.part3Count} câu trả lời ngắn (short).
        
        MỖI CÂU HỎI BẮT BUỘC PHẢI CÓ LỜI GIẢI CHI TIẾT (Trường 'solution').
        Sử dụng LaTeX cho các công thức toán học (kẹp trong dấu $).
    `;

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
};
