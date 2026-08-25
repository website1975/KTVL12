import { Quiz } from '../types';

/**
 * Tải file JSON xuống máy người dùng
 */
export const downloadJsonFile = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Khử ký tự không hợp lệ trong tên file
    const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '_').trim();
    link.href = url;
    link.download = safeFilename.endsWith('.json') ? safeFilename : `${safeFilename}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Xuất 1 đề thi thành file JSON chuẩn định dạng
 */
export const exportQuizToJson = (quiz: Quiz) => {
    const cleanQuizData = {
        id: quiz.id,
        title: quiz.title,
        grade: quiz.grade,
        type: quiz.type,
        category: quiz.category || '',
        durationMinutes: quiz.durationMinutes || 45,
        orderIndex: quiz.orderIndex || 0,
        isPublished: quiz.isPublished ?? true,
        isMonitored: quiz.isMonitored ?? false,
        isUnlisted: quiz.isUnlisted ?? false,
        targetType: quiz.targetType || 'all',
        assignedClassIds: quiz.assignedClassIds || [],
        startTime: quiz.startTime || '',
        endTime: quiz.endTime || '',
        questionCount: quiz.questions?.length || quiz.questionCount || 0,
        questions: (quiz.questions || []).map((q, idx) => ({
            id: q.id,
            index: idx + 1,
            type: q.type,
            level: q.level || undefined,
            context: q.context || undefined,
            text: q.text,
            options: q.type === 'mcq' ? (q.options || []) : undefined,
            correctAnswer: q.correctAnswer || undefined,
            subQuestions: q.type === 'group-tf' ? (q.subQuestions || []) : undefined,
            solution: q.solution || undefined,
            points: q.points || (q.type === 'mcq' ? 0.25 : 1.0),
            imageUrl: q.imageUrl || undefined,
            chapterId: q.chapterId || undefined
        })),
        createdAt: quiz.createdAt || new Date().toISOString()
    };

    const fileName = `${quiz.title || 'de_thi'}_K${quiz.grade || ''}`;
    downloadJsonFile(cleanQuizData, fileName);
};

/**
 * Xuất hàng loạt đề thi thành 1 gói JSON
 */
export const exportQuizzesBatchToJson = (quizzes: Quiz[], packageTitle: string = 'danh_sach_de_thi') => {
    const cleanPackage = {
        packageTitle,
        exportedAt: new Date().toISOString(),
        totalQuizzes: quizzes.length,
        quizzes: quizzes.map(quiz => ({
            id: quiz.id,
            title: quiz.title,
            grade: quiz.grade,
            type: quiz.type,
            category: quiz.category || '',
            durationMinutes: quiz.durationMinutes || 45,
            orderIndex: quiz.orderIndex || 0,
            isPublished: quiz.isPublished ?? true,
            isMonitored: quiz.isMonitored ?? false,
            isUnlisted: quiz.isUnlisted ?? false,
            targetType: quiz.targetType || 'all',
            assignedClassIds: quiz.assignedClassIds || [],
            startTime: quiz.startTime || '',
            endTime: quiz.endTime || '',
            questionCount: quiz.questions?.length || quiz.questionCount || 0,
            questions: (quiz.questions || []).map((q, idx) => ({
                id: q.id,
                index: idx + 1,
                type: q.type,
                level: q.level || undefined,
                context: q.context || undefined,
                text: q.text,
                options: q.type === 'mcq' ? (q.options || []) : undefined,
                correctAnswer: q.correctAnswer || undefined,
                subQuestions: q.type === 'group-tf' ? (q.subQuestions || []) : undefined,
                solution: q.solution || undefined,
                points: q.points || (q.type === 'mcq' ? 0.25 : 1.0),
                imageUrl: q.imageUrl || undefined,
                chapterId: q.chapterId || undefined
            }))
        }))
    };

    downloadJsonFile(cleanPackage, packageTitle);
};
