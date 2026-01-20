
import React from 'react';
import { X, Download, FileType } from 'lucide-react';
import { Quiz, Question } from '../../types';
import LatexText from '../LatexText';

interface QuizPreviewModalProps {
    quiz: Quiz;
    onClose: () => void;
}

const QuizPreviewModal: React.FC<QuizPreviewModalProps> = ({ quiz, onClose }) => {
    
    // Tính toán số cột (Tab) linh hoạt dựa trên độ dài đáp án
    const getColumnCount = (options: string[]) => {
        const maxLength = Math.max(...options.map(opt => opt.length));
        // Nếu đáp án dài trên 40 ký tự -> 1 cột
        if (maxLength > 40) return 1;
        // Nếu đáp án dài trên 15 ký tự -> 2 cột (Tab 2)
        if (maxLength > 15) return 2;
        // Đáp án ngắn -> 4 cột (Tab 4)
        return 4;
    };

    // Render các phương án theo dạng bảng (Tab) để đảm bảo căn lề chuẩn trong cả Preview và Word
    const renderOptionsTable = (q: Question) => {
        if (!q.options) return null;
        const cols = getColumnCount(q.options);
        const rows = [];
        for (let i = 0; i < q.options.length; i += cols) {
            rows.push(q.options.slice(i, i + cols));
        }

        return (
            <table className="options-table w-full border-collapse mt-3 ml-6" style={{ width: '100%' }}>
                <tbody>
                    {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                            {row.map((opt, cIdx) => (
                                <td 
                                    key={cIdx} 
                                    style={{ 
                                        width: `${100 / cols}%`, 
                                        textAlign: 'left', // Bỏ justify để chữ không bị thưa
                                        padding: '4px 8px 4px 0',
                                        verticalAlign: 'top'
                                    }} 
                                    className="option-cell"
                                >
                                    <span style={{ fontWeight: 'bold', marginRight: '4px' }}>
                                        {String.fromCharCode(65 + (rIdx * cols + cIdx))}.
                                    </span>
                                    <LatexText text={opt} />
                                </td>
                            ))}
                            {/* Bổ sung các ô trống nếu hàng chưa đủ cột */}
                            {row.length < cols && Array(cols - row.length).fill(0).map((_, i) => (
                                <td key={`empty-${i}`} style={{ width: `${100 / cols}%` }}></td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const handleExportWord = () => {
        const content = document.getElementById('quiz-export-content')?.innerHTML;
        if (!content) return alert("Không tìm thấy nội dung!");

        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>${quiz.title}</title>
                <style>
                    @page { size: 21cm 29.7cm; margin: 2cm; }
                    body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; color: black; }
                    .section-title { font-weight: bold; margin-top: 20px; font-size: 12pt; text-transform: uppercase; border-bottom: 1.5pt solid black; padding-bottom: 2pt; }
                    .question { margin-top: 15px; margin-bottom: 10px; page-break-inside: avoid; }
                    .q-label { font-weight: bold; font-style: italic; text-decoration: underline; }
                    .options-table { width: 100%; margin-top: 5px; border-collapse: collapse; }
                    .option-cell { padding: 2pt 0; vertical-align: top; text-align: left; }
                    .q-image-container { text-align: center; margin: 15pt 0; }
                    img { max-width: 450px; height: auto; display: block; margin: 5pt auto; }
                    .footer { text-align: center; margin-top: 40pt; border-top: 1pt solid black; padding-top: 10pt; font-weight: bold; }
                    table { border-collapse: collapse; width: 100%; }
                    td { vertical-align: top; }
                </style>
            </head>
            <body>
        `;
        const footer = "</body></html>";
        const sourceHTML = header + content + footer;
        
        const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${quiz.title.replace(/[/\\?%*:|"<>]/g, '-')}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 z-[2000] flex items-center justify-center p-0 md:p-4 backdrop-blur-xl animate-fade-in">
            <div className="bg-white rounded-[0] md:rounded-[3.5rem] w-full max-w-5xl h-full md:h-[95vh] flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header điều khiển */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg">
                            <FileType size={24}/>
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight leading-tight">{quiz.title}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                XEM TRƯỚC VÀ XUẤT ĐỀ THI CHUẨN CẤU TRÚC
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportWord}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase hover:bg-blue-700 transition-all shadow-xl active:scale-95"
                        >
                            <Download size={16}/> Xuất file Word
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-3 bg-slate-800 rounded-2xl hover:bg-red-600 transition-colors"
                        >
                            <X size={24}/>
                        </button>
                    </div>
                </div>

                {/* Nội dung đề thi */}
                <div className="flex-1 overflow-y-auto p-12 bg-white custom-scrollbar">
                    <div id="quiz-export-content" className="max-w-4xl mx-auto font-serif text-black space-y-12 pb-24">
                        
                        {/* Phần tiêu đề đề thi */}
                        <div className="mb-10">
                            <table style={{ width: '100%' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '40%', textAlign: 'center' }}>
                                            <p style={{ fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>SỞ GD&ĐT EDUQUIZ VN</p>
                                            <p style={{ fontWeight: 'bold', textTransform: 'uppercase', textDecoration: 'underline', margin: 0 }}>TRƯỜNG THPT CHUYÊN AI</p>
                                            <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>Mã đề: {quiz.id.slice(0, 3).toUpperCase()}</p>
                                        </td>
                                        <td style={{ width: '60%', textAlign: 'center' }}>
                                            <p style={{ fontWeight: 'bold', fontSize: '14pt', margin: 0 }}>ĐỀ THI {quiz.type === 'test' ? 'CHÍNH THỨC' : 'LUYỆN TẬP'}</p>
                                            <p style={{ fontWeight: 'bold', margin: 0 }}>MÔN: TOÁN - KHỐI {quiz.grade}</p>
                                            <p style={{ fontStyle: 'italic' }}>Thời gian: {quiz.durationMinutes} phút</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style={{ border: '1.5pt solid black', padding: '10px', marginTop: '20px' }}>
                                <p style={{ fontWeight: 'bold', margin: 0 }}>Họ và tên thí sinh: ................................................................... SBD: ......................</p>
                            </div>
                            <h2 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16pt', marginTop: '30px', textTransform: 'uppercase' }}>{quiz.title}</h2>
                        </div>

                        {/* Nội dung câu hỏi */}
                        {['mcq', 'group-tf', 'short'].map((type) => {
                            const typeQs = quiz.questions.filter(q => q.type === type);
                            if (typeQs.length === 0) return null;
                            
                            return (
                                <div key={type} className="section-block" style={{ marginBottom: '30px' }}>
                                    <div className="section-title" style={{ fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1.5pt solid black', marginBottom: '15px', paddingBottom: '3px' }}>
                                        {type === 'mcq' ? 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN' : 
                                         type === 'group-tf' ? 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG SAI' : 
                                         'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN'}
                                    </div>
                                    
                                    <div className="space-y-8">
                                        {typeQs.map((q, idx) => (
                                            <div key={q.id} className="question" style={{ marginBottom: '20px' }}>
                                                <div style={{ display: 'table', width: '100%' }}>
                                                    <div style={{ display: 'table-cell', width: '50px', fontWeight: 'bold', fontStyle: 'italic', textDecoration: 'underline' }}>Câu {idx + 1}.</div>
                                                    <div style={{ display: 'table-cell', textAlign: 'justify' }}>
                                                        <LatexText text={q.text}/>
                                                    </div>
                                                </div>

                                                {/* Ảnh đề thi */}
                                                {q.imageUrl && (
                                                    <div className="q-image-container" style={{ textAlign: 'center', margin: '15px 0' }}>
                                                        <img src={q.imageUrl} alt={`Hình ${idx + 1}`} style={{ maxWidth: '400px', border: '0.5pt solid #ddd' }} />
                                                    </div>
                                                )}

                                                {/* Canh Tab linh hoạt cho phần I */}
                                                {q.type === 'mcq' && renderOptionsTable(q)}

                                                {/* Phần II: Đúng/Sai */}
                                                {q.type === 'group-tf' && q.subQuestions && (
                                                    <div style={{ marginLeft: '30px', marginTop: '5px' }}>
                                                        {q.subQuestions.map((sq, si) => (
                                                            <div key={si} style={{ display: 'table', width: '100%', marginBottom: '4px' }}>
                                                                <div style={{ display: 'table-cell', width: '30px', fontWeight: 'bold' }}>{String.fromCharCode(97 + si)})</div>
                                                                <div style={{ display: 'table-cell' }}><LatexText text={sq.text}/></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Phần III: Trả lời ngắn */}
                                                {q.type === 'short' && (
                                                    <div style={{ marginLeft: '30px', marginTop: '10px' }}>
                                                        <div style={{ border: '1pt solid black', width: '150px', height: '35px', textAlign: 'center', lineHeight: '35px', color: '#ccc', fontStyle: 'italic', fontSize: '10pt' }}>
                                                            Đáp số: .........
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="footer" style={{ textAlign: 'center', marginTop: '50px', borderTop: '1pt solid black', paddingTop: '15px', fontWeight: 'bold' }}>
                            <p>--- HẾT ---</p>
                            <p style={{ fontSize: '10pt', fontWeight: 'normal', fontStyle: 'italic' }}>(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuizPreviewModal;
