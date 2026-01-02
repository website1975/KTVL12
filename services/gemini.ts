
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

// Helper to clean JSON strings if needed
const cleanJsonString = (str: string): string => {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
};

// Fix: Always use gemini-3-pro-preview for complex math reasoning/parsing and ensure direct SDK initialization.
export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Nhiệm vụ: Chuyển đổi nội dung PDF đề thi Toán sang JSON theo cấu trúc 3 phần.
    
    QUY TẮC NHẬN DIỆN:
    1. PHẦN I (MCQ): Phương án có dấu '*' phía trước (VD: *B. Nội dung) là đáp án đúng.
    2. PHẦN II (Đúng/Sai): Mỗi ý a, b, c, d nếu có (Đ) ở cuối là Đúng, (S) ở cuối là Sai.
    3. PHẦN III (Trả lời ngắn): Đáp án nằm sau từ "Đáp án:" hoặc "Kết quả:".
    4. LỜI GIẢI CHI TIẾT: Mọi nội dung nằm sau từ khóa "Lời giải:" hoặc "Hướng dẫn giải:" PHẢI được đưa vào trường 'solution'. 
       Nội dung câu hỏi (field 'text') phải dừng lại TRƯỚC từ khóa "Lời giải:".

    CẤU TRÚC JSON:
    - type: "mcq" | "group-tf" | "short"
    - text: Nội dung câu hỏi (đã bỏ "Câu X:", đã bỏ phần lời giải).
    - points: Mặc định P1: 0.25, P2: 1.0, P3: 0.5.
    - options: (Chỉ P1) Mảng 4 phương án (đã bỏ dấu '*').
    - correctAnswer: (P1) Nội dung đáp án đúng; (P3) Giá trị đáp án.
    - subQuestions: (Chỉ P2) Mảng {text, correctAnswer: "True" | "False"}.
    - solution: Nội dung chi tiết sau chữ "Lời giải:".
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Complex task: math extraction from PDF
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
                    type: { type: Type.STRING },
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
                                correctAnswer: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ["type", "text"]
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

// Fix: Always use gemini-3-pro-preview for complex math reasoning/parsing and ensure direct SDK initialization.
export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Soạn đề thi Toán lớp ${config.grade} về chủ đề: ${config.topic}.
        Yêu cầu:
        - Phần I: ${config.part1Count} câu trắc nghiệm (có ký hiệu * trước đáp án đúng).
        - Phần II: ${config.part2Count} câu Đúng/Sai (có ký hiệu (Đ) hoặc (S) cuối mỗi ý).
        - Phần III: ${config.part3Count} câu trả lời ngắn.
        Mọi câu hỏi phải có phần "Lời giải:" chi tiết ở cuối.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Complex task: math content generation
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
