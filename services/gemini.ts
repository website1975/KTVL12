
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
    Quy tắc bóc tách quan trọng:
    1. TRƯỜNG 'text': Chỉ chứa nội dung câu hỏi. TUYỆT ĐỐI KHÔNG bao gồm các cụm từ như "Đáp án:", "Đáp số:", "Kết quả là:" hoặc giá trị đáp án vào trong chuỗi 'text'.
    2. PHẦN I (mcq): Nhận diện dấu '*' hoặc định dạng trắc nghiệm để lấy 'correctAnswer'.
    3. PHẦN II (group-tf): Phải bóc tách đủ 4 ý a, b, c, d theo ĐÚNG THỨ TỰ xuất hiện trong đề.
    4. PHẦN III (short): Lấy giá trị đáp số đưa vào trường 'correctAnswer', không để lại trong 'text'.
    5. LỜI GIẢI: Mọi giải thích đưa vào trường 'solution'.
    
    Cấu trúc JSON: Array<{type, text, points, options?, correctAnswer?, solution?, subQuestions?}>
    Lưu ý: Giữ nguyên công thức Toán dạng LaTeX trong dấu $.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
        Yêu cầu nghiêm ngặt:
        - Trường 'text' CHỈ chứa nội dung câu hỏi, KHÔNG chứa đáp án hay cụm từ "Đáp án:".
        - Câu Đúng/Sai (group-tf) PHẢI có đúng 4 ý con sắp xếp theo thứ tự a, b, c, d rõ ràng.
        - ${config.part1Count} câu trắc nghiệm (mcq).
        - ${config.part2Count} câu Đúng/Sai (group-tf).
        - ${config.part3Count} câu trả lời ngắn (short).
        Sử dụng LaTeX $ cho công thức.
    `;

    try {
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
    } catch (error) {
        console.error("Lỗi AI Soạn đề:", error);
        throw error;
    }
};
