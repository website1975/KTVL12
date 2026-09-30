import JSZip from 'jszip';

/**
 * Trích xuất toàn bộ văn bản và công thức cơ bản từ file Word (.docx)
 * Hoạt động 100% trên trình duyệt (Browser-safe), tương thích hoàn toàn với Vite và Vercel.
 */
export async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // File chính chứa nội dung văn bản trong gói OpenXML .docx
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('File không đúng cấu trúc Word .docx hợp lệ (thiếu word/document.xml)');
  }

  const xmlContent = await docXmlFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  // Kiểm tra lỗi parse XML
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Không thể phân tích nội dung XML của file Word');
  }

  const paragraphs = xmlDoc.getElementsByTagNameNS('*', 'p');
  const lines: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    let paragraphText = '';

    // Lấy tất cả các thẻ text chuẩn (w:t), text công thức toán Office Math (m:t), tab (w:tab) và ngắt dòng (w:br, w:cr)
    const allChildNodes = p.querySelectorAll('t, [name$="t"], tab, [name$="tab"], br, [name$="br"], cr, [name$="cr"]');
    if (allChildNodes.length > 0) {
      allChildNodes.forEach(node => {
        const nodeName = (node.localName || node.nodeName || '').toLowerCase();
        if (nodeName.endsWith('tab')) {
          paragraphText += '   ';
        } else if (nodeName.endsWith('br') || nodeName.endsWith('cr')) {
          paragraphText += '\n';
        } else {
          paragraphText += node.textContent || '';
        }
      });
    } else {
      // Fallback lấy toàn bộ textContent của đoạn nếu không tìm thấy thẻ t
      paragraphText = p.textContent || '';
    }

    const trimmed = paragraphText.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }

  return lines.join('\n');
}
