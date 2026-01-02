
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";
import { v4 as uuidv4 } from 'uuid';

const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
        throw new Error("Chưa cấu hình Gemini API Key.");
    }
    return new GoogleGenAI({ apiKey });
};

const cleanJsonString = (str: string): string => {
    return str.replace(/```json/g, "").replace(/```/g, "").trim();
};

export const parseQuestionsFromPDF = async (base64Data: string): Promise<Question[]> => {
  const ai = getAIClient();
  const prompt = `
    Nhiệm vụ: Chuyển đổi nội dung PDF đề thi Toán sang JSON theo cấu trúc 3 phần mới.
    
    QUY TẮC NHẬN DIỆN ĐÁP ÁN & LỜI GIẢI:
    1. PHẦN I (MCQ): Phương án nào có dấu '*' phía trước (VD: *B. Nội dung) là đáp án đúng.
    2. PHẦN II (Đúng/Sai): Mỗi ý a, b, c, d nếu có (Đ) ở cuối là Đúng, (S) ở cuối là Sai.
    3. PHẦN III (Ngắn): Đáp án sau từ "Đáp án:" hoặc "Kết quả:".
    4. LỜI GIẢI: Mọi nội dung nằm sau từ khóa "Lời giải:" hoặc "Hướng dẫn giải:" của mỗi câu PHẢI được đưa vào trường 'solution'. 
       Nội dung câu hỏi (field 'text') phải dừng lại TRƯỚC từ khóa "Lời giải:".

    CẤU TRÚC JSON:
    - type: "mcq" | "group-tf" | "short"
    - text: Nội dung câu hỏi (đã bỏ "Câu X:", đã bỏ phần lời giải).
    - points: Mặc định P1: 0.25, P2: 1.0, P3: 0.5.
    - options: (Chỉ P1) Mảng 4 chuỗi phương án (đã bỏ dấu '*').
    - correctAnswer: (P1) Nội dung phương án đúng; (P3) Giá trị số.
    - subQuestions: (Chỉ P2) Mảng 4 đối tượng {text, correctAnswer: "True" | "False"}.
    - solution: Nội dung sau chữ "Lời giải:".
  `;

  const response = await ai.models.generateContent({
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

export const generateQuizFromPrompt = async (config: any): Promise<Question[]> => {
    const ai = getAIClient();
    const prompt = `
        Soạn đề thi Toán lớp ${config.grade} về chủ đề: ${config.topic}.
        Yêu cầu:
        - Phần I: ${config.part1Count} câu trắc nghiệm 4 lựa chọn.
        - Phần II: ${config.part2Count} câu trắc nghiệm Đúng/Sai.
        - Phần III: ${config.part3Count} câu trả lời ngắn.
        Mỗi câu hỏi BẮT BUỘC có phần 'solution' (Lời giải chi tiết).
    `;

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
};
