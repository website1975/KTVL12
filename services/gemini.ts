
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
    Nhiệm vụ: Chuyển đổi nội dung PDF đề thi Toán sang JSON.
    
    QUY TẮC NHẬN DIỆN MẪU ĐỀ CỦA NGƯỜI DÙNG:
    1. PHẦN I (MCQ): 
       - Câu hỏi bắt đầu bằng "Câu X:" hoặc "Cau :".
       - Phương án nào có dấu '*' phía trước (VD: *B. Đáp án) là đáp án đúng.
    2. PHẦN II (Đúng/Sai): 
       - Mỗi ý a, b, c, d nếu có (Đ) ở cuối là Đúng, (S) ở cuối là Sai.
    3. PHẦN III (Trả lời ngắn): 
       - Đáp án sau từ "Đáp án:".
    4. LỜI GIẢI CHI TIẾT: 
       - Mọi nội dung nằm sau từ khóa "Lời giải:" của mỗi câu PHẢI được đưa vào trường 'solution'.
       - Phần 'text' của câu hỏi phải dừng lại TRƯỚC từ khóa "Lời giải:".

    CẤU TRÚC JSON CẦN TRẢ VỀ:
    - type: "mcq" | "group-tf" | "short"
    - text: Nội dung câu hỏi (đã bỏ "Câu X:", đã bỏ phần lời giải).
    - points: P1: 0.25, P2: 1.0, P3: 0.5.
    - options: (Chỉ P1) Mảng 4 chuỗi phương án (đã bỏ dấu '*').
    - correctAnswer: (P1) Nội dung phương án đúng; (P3) Giá trị đáp án.
    - subQuestions: (Chỉ P2) Mảng các đối tượng {text, correctAnswer: "True" | "False"}.
    - solution: Nội dung chi tiết sau chữ "Lời giải:".
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
        Yêu cầu có lời giải chi tiết sau mỗi câu.
        - Phần I: ${config.part1Count} câu trắc nghiệm.
        - Phần II: ${config.part2Count} câu Đúng/Sai.
        - Phần III: ${config.part3Count} câu trả lời ngắn.
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
