/**
 * Bộ chuẩn hóa tiếng Việt và sửa lỗi vỡ dấu / vỡ từ (Decomposed accents / OCR / PDF artifacts)
 * Chuyên trị các lỗi:
 * 1. Dấu thừa chen ngang: "Đố´i" -> "Đối", "chấ´t" -> "chất", "cấ´u" -> "cấu", "biế´n" -> "biến", "đấ´t" -> "đất", "vật chấ´ t" -> "vật chất"
 * 2. Vỡ dấu tiếng Việt: "PHÂ`N" -> "PHẦN", "NHIÊ`U" -> "NHIỀU", "câ` n" -> "cần", "bă` ng" -> "bằng", "chiê` u" -> "chiều", "đâ` u" -> "đầu"
 * 3. Vỡ từ do khoảng trắng (OCR / Font spacing): "TRẮ C" -> "TRẮC", "TRÁ I" -> "TRÁI", "ĐẤ T" -> "ĐẤT", "CẤ U" -> "CẤU", "BIẾ N" -> "BIẾN", "ĐỐ I" -> "ĐỐI", "TƯỢ NG" -> "TƯỢNG", "QUÃ NG ĐƯỜ NG" -> "QUÃNG ĐƯỜNG", "VẬ T" -> "VẬT", "CHẤ T" -> "CHẤT"
 * 4. Tự động nhận diện và bọc công thức LaTeX chưa có $...$ như: "1^\circ C", "10^5", "m/s^2", "\alpha"
 */

// Bảng ánh xạ nguyên âm + loại dấu sang ký tự tiếng Việt chuẩn
const ACCENT_MAP: Record<string, { acute: string; grave: string; hook: string; tilde: string; dot: string }> = {
    'a': { acute: 'á', grave: 'à', hook: 'ả', tilde: 'ã', dot: 'ạ' },
    'A': { acute: 'Á', grave: 'À', hook: 'Ả', tilde: 'Ã', dot: 'Ạ' },
    'â': { acute: 'ấ', grave: 'ầ', hook: 'ẩ', tilde: 'ẫ', dot: 'ậ' },
    'Â': { acute: 'Ấ', grave: 'Ầ', hook: 'Ẩ', tilde: 'Ẫ', dot: 'Ậ' },
    'ă': { acute: 'ắ', grave: 'ằ', hook: 'ẳ', tilde: 'ẵ', dot: 'ặ' },
    'Ă': { acute: 'Ắ', grave: 'Ằ', hook: 'Ẳ', tilde: 'Ẵ', dot: 'Ặ' },
    'e': { acute: 'é', grave: 'è', hook: 'ẻ', tilde: 'ẽ', dot: 'ẹ' },
    'E': { acute: 'É', grave: 'È', hook: 'Ẻ', tilde: 'Ẽ', dot: 'Ẹ' },
    'ê': { acute: 'ế', grave: 'ề', hook: 'ể', tilde: 'ễ', dot: 'ệ' },
    'Ê': { acute: 'Ế', grave: 'Ề', hook: 'Ể', tilde: 'Ễ', dot: 'Ệ' },
    'i': { acute: 'í', grave: 'ì', hook: 'ỉ', tilde: 'ĩ', dot: 'ị' },
    'I': { acute: 'Í', grave: 'Ì', hook: 'Ỉ', tilde: 'Ĩ', dot: 'Ị' },
    'o': { acute: 'ó', grave: 'ò', hook: 'ỏ', tilde: 'õ', dot: 'ọ' },
    'O': { acute: 'Ó', grave: 'Ò', hook: 'Ỏ', tilde: 'Õ', dot: 'Ọ' },
    'ô': { acute: 'ố', grave: 'ồ', hook: 'ổ', tilde: 'ỗ', dot: 'ộ' },
    'Ô': { acute: 'Ố', grave: 'Ồ', hook: 'Ổ', tilde: 'Ỗ', dot: 'Ộ' },
    'ơ': { acute: 'ớ', grave: 'ờ', hook: 'ở', tilde: 'ỡ', dot: 'ợ' },
    'Ơ': { acute: 'Ớ', grave: 'Ờ', hook: 'Ở', tilde: 'Ỡ', dot: 'Ợ' },
    'u': { acute: 'ú', grave: 'ù', hook: 'ủ', tilde: 'ũ', dot: 'ụ' },
    'U': { acute: 'Ú', grave: 'Ù', hook: 'Ủ', tilde: 'Ũ', dot: 'Ụ' },
    'ư': { acute: 'ứ', grave: 'ừ', hook: 'ử', tilde: 'ữ', dot: 'ự' },
    'Ư': { acute: 'Ứ', grave: 'Ừ', hook: 'Ử', tilde: 'Ữ', dot: 'Ự' },
    'y': { acute: 'ý', grave: 'ỳ', hook: 'ỷ', tilde: 'ỹ', dot: 'ỵ' },
    'Y': { acute: 'Ý', grave: 'Ỳ', hook: 'Ỷ', tilde: 'Ỹ', dot: 'Ỵ' },
    'ươ': { acute: 'ướ', grave: 'ườ', hook: 'ưở', tilde: 'ưỡ', dot: 'ượ' },
    'ƯƠ': { acute: 'ƯỚ', grave: 'ƯỜ', hook: 'ƯỞ', tilde: 'ƯỠ', dot: 'ƯỢ' },
    'ưa': { acute: 'ứa', grave: 'ừa', hook: 'ửa', tilde: 'ữa', dot: 'ựa' },
    'Ưa': { acute: 'Ứa', grave: 'Ừa', hook: 'Ửa', tilde: 'Ữa', dot: 'Ựa' },
    'ua': { acute: 'úa', grave: 'ùa', hook: 'ủa', tilde: 'ũa', dot: 'ụa' },
    'Ua': { acute: 'Úa', grave: 'Ùa', hook: 'Ủa', tilde: 'Ũa', dot: 'Ụa' },
    'ie': { acute: 'iế', grave: 'iề', hook: 'iể', tilde: 'iễ', dot: 'iệ' },
    'iê': { acute: 'iế', grave: 'iề', hook: 'iể', tilde: 'iễ', dot: 'iệ' },
    'Iê': { acute: 'Iế', grave: 'Iề', hook: 'Iể', tilde: 'Iễ', dot: 'Iệ' },
    'IÊ': { acute: 'IẾ', grave: 'IỀ', hook: 'IỂ', tilde: 'IỄ', dot: 'IỆ' },
    'ye': { acute: 'yế', grave: 'yề', hook: 'yể', tilde: 'yễ', dot: 'yệ' },
    'yê': { acute: 'yế', grave: 'yề', hook: 'yể', tilde: 'yễ', dot: 'yệ' },
    'uô': { acute: 'uố', grave: 'uồ', hook: 'uổ', tilde: 'uỗ', dot: 'uộ' },
    'Uô': { acute: 'Uố', grave: 'Uồ', hook: 'Uổ', tilde: 'Uỗ', dot: 'Uộ' },
    'UÔ': { acute: 'UỐ', grave: 'UỒ', hook: 'UỔ', tilde: 'UỖ', dot: 'UỘ' },
};

function getAccentType(char: string): 'acute' | 'grave' | 'hook' | 'tilde' | 'dot' | null {
    // Sắc: ´ (\u00B4), ˊ (\u02CA), ' , ’, \u0301
    if (char === '´' || char === '\u00B4' || char === '\u02CA' || char === "'" || char === '’' || char === '\u0301') return 'acute';
    // Huyền: ` (\u0060), ˋ (\u02CB), ‘, \u0300
    if (char === '`' || char === '\u0060' || char === '\u02CB' || char === '‘' || char === '\u0300') return 'grave';
    // Hỏi: ? (khi đứng sau nguyên âm), ̉ (\u0309), ˀ
    if (char === '?' || char === '\u0309' || char === '̉' || char === 'ˀ') return 'hook';
    // Ngã: ~, ˜ (\u02DC), ̃ (\u0303)
    if (char === '~' || char === '˜' || char === '\u02DC' || char === '\u0303' || char === '̃') return 'tilde';
    // Nặng: . (khi đứng sát sau nguyên âm giữa từ), ̣ (\u0323)
    if (char === '.' || char === '\u0323' || char === '̣') return 'dot';
    return null;
}

/**
 * Khôi phục các từ tiếng Việt bị vỡ dấu và vỡ chữ do PDF/Word font encoding
 */
export function repairVietnameseText(raw: string): string {
    if (!raw) return '';

    // Bước 1: Chuẩn hóa Unicode sang dạng dựng sẵn (NFC)
    let text = raw.normalize('NFC');

    // Bước 2: Xử lý các dấu thanh rác chèn vào ngay sau nguyên âm đã có dấu
    // Ví dụ: Đố´i -> Đối, chấ´t -> chất, cấ´u -> cấu, biế´n -> biến, đấ´t -> đất, vật chấ´ t -> vật chất
    // Pattern: [Nguyên âm có dấu] + [khoảng trắng tùy chọn] + [dấu thanh rác ´ ` ' ~ ^ .] + [khoảng trắng tùy chọn]
    text = text.replace(/([áàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ])\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~]+)\s*/g, '$1');

    // Bước 3: Xử lý các từ ghép cụ thể bị vỡ phổ biến từ font VNI / TCVN3 / PDF
    text = text
        .replace(/(p|P)hâ\s*[´'\`\?~]\s*n/g, (_m, p1) => (p1 === 'P' ? 'Phần' : 'phần'))
        .replace(/PHÂ\s*[´'\`\?~]\s*N/g, 'PHẦN')
        .replace(/(n|N)hiê\s*[´'\`\?~]\s*u/g, (_m, p1) => (p1 === 'N' ? 'Nhiều' : 'nhiều'))
        .replace(/NHIÊ\s*[´'\`\?~]\s*U/g, 'NHIỀU')
        .replace(/(n|N)ươ\s*[´'\`\?~]\s*c/g, (_m, p1) => (p1 === 'N' ? 'Nước' : 'nước'))
        .replace(/(đ|Đ)ươ\s*[´'\`\?~]\s*c/g, (_m, p1) => (p1 === 'Đ' ? 'Được' : 'được'))
        .replace(/(t|T)rươ\s*[´'\`\?~]\s*c/g, (_m, p1) => (p1 === 'T' ? 'Trước' : 'trước'))
        .replace(/(l|L)ươ\s*[´'\`\?~]\s*ng/g, (_m, p1) => (p1 === 'L' ? 'Lượng' : 'lượng'))
        .replace(/(th|Th)ươ\s*[´'\`\?~]\s*ng/g, (_m, p1) => (p1 === 'Th' ? 'Thường' : 'thường'))
        .replace(/(h|H)ươ\s*[´'\`\?~]\s*ng/g, (_m, p1) => (p1 === 'H' ? 'Hướng' : 'hướng'))
        .replace(/(ng|Ng)ươ\s*[´'\`\?~]\s*i/g, (_m, p1) => (p1 === 'Ng' ? 'Người' : 'người'))
        .replace(/(ch|Ch)iê\s*[´'\`\?~]\s*u/g, (_m, p1) => (p1 === 'Ch' ? 'Chiều' : 'chiều'))
        .replace(/(b|B)ă\s*[´'\`\?~]\s*ng/g, (_m, p1) => (p1 === 'B' ? 'Bằng' : 'bằng'))
        .replace(/(c|C)hâ\s*[´'\`\?~]\s*t/g, (_m, p1) => (p1 === 'C' ? 'Chất' : 'chất'))
        .replace(/(c|C)â\s*[´'\`\?~]\s*n/g, (_m, p1) => (p1 === 'C' ? 'Cần' : 'cần'))
        .replace(/(c|C)â\s*[´'\`\?~]\s*u/g, (_m, p1) => (p1 === 'C' ? 'Cấu' : 'cấu'))
        .replace(/(đ|Đ)â\s*[´'\`\?~]\s*u/g, (_m, p1) => (p1 === 'Đ' ? 'Đầu' : 'đầu'))
        .replace(/(đ|Đ)â\s*[´'\`\?~]\s*t/g, (_m, p1) => (p1 === 'Đ' ? 'Đất' : 'đất'))
        .replace(/(b|B)iê\s*[´'\`\?~]\s*n/g, (_m, p1) => (p1 === 'B' ? 'Biến' : 'biến'))
        .replace(/(đ|Đ)ô\s*[´'\`\?~]\s*i/g, (_m, p1) => (p1 === 'Đ' ? 'Đối' : 'đối'));

    // Bước 4: Sửa dạng nguyên âm đôi + dấu rời rạc (iê, uô, ươ, ưa, ua, ie, ye, IÊ, UÔ, ƯƠ)
    const diphthongPattern = /(iê|uô|ươ|ưa|ua|ie|ye|Iê|Uô|Ươ|Ưa|Ua|IÊ|UÔ|ƯƠ)\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~?])\s*([a-zA-ZđĐ]*)/g;
    text = text.replace(diphthongPattern, (match, diph, accentChar, nextChars) => {
        const accentType = getAccentType(accentChar);
        const lowerDiph = diph.toLowerCase();
        if (accentType && ACCENT_MAP[lowerDiph]) {
            const isAllUpper = diph === diph.toUpperCase();
            const isFirstUpper = diph[0] === diph[0].toUpperCase();
            let fixed = ACCENT_MAP[lowerDiph][accentType];
            if (isAllUpper && fixed) {
                fixed = fixed.toUpperCase();
            } else if (isFirstUpper && fixed) {
                fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
            }
            if (fixed) {
                return fixed + (nextChars || '');
            }
        }
        return match;
    });

    // Bước 5: Sửa dạng nguyên âm đơn + dấu rời rạc: [Nguyên âm] + [Dấu rời: ´ ` ' ? ~ .] + [Phụ âm / Nguyên âm tiếp theo]
    // Ví dụ: PHÂ`N -> PHẦN, bă` ng -> bằng, chiê` u -> chiều, câ` n -> cần, châ´ t -> chất, đâ` u -> đầu, lơ` n -> lớn, biê´ t -> biết, khô` ng -> không
    const singleVowelPattern = /([aAăĂâÂeEêÊiIoOôÔơƠuUưƯyY])\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~?])\s*([a-zA-ZđĐ]*)/g;
    text = text.replace(singleVowelPattern, (match, vowel, accentChar, nextChars) => {
        const accentType = getAccentType(accentChar);
        if (accentType && ACCENT_MAP[vowel]) {
            const fixedVowel = ACCENT_MAP[vowel][accentType];
            if (fixedVowel) {
                return fixedVowel + (nextChars || '');
            }
        }
        return match;
    });

    // Bước 6: Sửa trường hợp dấu rời rạc ở cuối từ (VD: "đo´ " -> "đó", "la` " -> "là", "thê´ " -> "thế", "vê`" -> "về")
    const endWordPattern = /([aAăĂâÂeEêÊiIoOôÔơƠuUưƯyY])\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303~])(?=[\s,\.!?;:\)\]\}]|$)/g;
    text = text.replace(endWordPattern, (match, vowel, accentChar) => {
        const accentType = getAccentType(accentChar);
        if (accentType && ACCENT_MAP[vowel]) {
            const fixedVowel = ACCENT_MAP[vowel][accentType];
            if (fixedVowel) {
                return fixedVowel;
            }
        }
        return match;
    });

    // Bước 7: Ghép các từ tiếng Việt bị vỡ đôi bởi khoảng trắng do trích xuất Word/PDF (Cực kỳ quan trọng)
    // Ví dụ trong đề thi:
    // - "TRẮ C" -> "TRẮC", "TRÁ I" -> "TRÁI", "ĐẤ T" -> "ĐẤT", "CẤ U" -> "CẤU", "BIẾ N" -> "BIẾN", "ĐỐ I" -> "ĐỐI", "TƯỢ NG" -> "TƯỢNG"
    // - "bằ ng" -> "bằng", "chiề u" -> "chiều", "chuyể n" -> "chuyển", "quã ng" -> "quãng", "đườ ng" -> "đường", "độ ng" -> "động", "thẳ ng" -> "thẳng"
    // - "đổ i" -> "đổi", "trò n" -> "tròn", "lỏ ng" -> "lỏng", "chấ t" -> "chất", "cầ n" -> "cần", "đầ u" -> "đầu", "nhiệ t" -> "nhiệt", "vậ t" -> "vật"
    
    // 7.1. Coda 2 ký tự: ng, nh, ch (kể cả viết hoa NG, NH, CH)
    text = text.replace(/\b([a-zA-ZđĐáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]+)\s+(ng|nh|ch|NG|NH|CH)\b/g, '$1$2');

    // 7.2. Coda 1 ký tự: c, t, p, m, n, u, i, y (kể cả viết hoa C, T, P, M, N, U, I, Y) sau nguyên âm có dấu
    text = text.replace(/\b([a-zA-ZđĐ]*[áàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]+)\s+([ctpmnuiyCTPMNUIY])\b/g, '$1$2');

    // 7.3. Các từ không dấu đặc trưng hay bị cắt: "khô ng", "giâ y", "dâ y", "câ y", "mâ y", "đâ u", "đâ y", "sâ u"
    text = text.replace(/\b(khô|giâ|dâ|câ|mâ|đâ|sâ|trâ|châ|phâ|lâ|hâ|tâ|KHÔ|GIÂ|DÂ|CÂ|MÂ|ĐÂ|SÂ|TRÂ|CHÂ|PHÂ|LÂ|HÂ|TÂ)\s+(ng|y|u|n|m|t|c|NG|Y|U|N|M|T|C)\b/g, '$1$2');

    return text.normalize('NFC');
}

/**
 * Tự động nhận diện và bọc các công thức toán/lý/hóa vào $...$ nếu bị thiếu
 */
export function autoFormatLatex(text: string): string {
    if (!text) return '';

    let res = text;

    // 1. Tự động bọc nhiệt độ C / K / F (VD: "1^\circ C", "100 ^\circ C", "100^oC", "100°C", "25 ^\circ\text{C}")
    res = res.replace(/(?<!\$)(?:(\d+(?:[.,]\d+)?)\s*)?(?:\^\\circ|\^o|\^0|°)\s*(?:\\text\{)?([CKF])\}?(?!\$)/g, (_m, num, unit) => {
        const prefix = num ? `${num}` : '';
        return `$${prefix}^\\circ\\text{${unit}}$`;
    });

    // 2. Tự động bọc lũy thừa 10 (VD: "10^5", "10^-3", "10^{5}")
    res = res.replace(/(?<!\$)\b10\^({?-?\d+}?)(?!\$)/g, '$$10^{$1}$$');

    // 3. Tự động bọc các đơn vị có số mũ (VD: "m/s^2", "kg/m^3", "g/cm^3", "cm^3", "m^3", "cm^2", "m^2")
    res = res.replace(/(?<!\$)\b(m\/s\^2|kg\/m\^3|g\/cm\^3|cm\^3|m\^3|cm\^2|m\^2|J\/kg|J\/\(kg\.K\)|J\/kg\.K|N\/m)(?!\$)/g, '$$$1$$');

    // 4. Tự động bọc các ký hiệu Hy Lạp nếu đứng đơn lẻ chưa bọc $
    const greekPattern = /(?<!\$)\\(alpha|beta|gamma|delta|Delta|lambda|Lambda|mu|pi|omega|Omega|rho|sigma|Sigma|theta|phi|Phi|approx|le|ge|pm|times|cdot|sqrt\{[^}]+\}|frac\{[^}]+\}\{[^}]+\})(?!\$)/g;
    res = res.replace(greekPattern, '$$$&$$');

    return res;
}

/**
 * Chuẩn hóa toàn diện cả tiếng Việt và LaTeX
 */
export function normalizeFullText(text: string): string {
    if (!text) return '';
    const repaired = repairVietnameseText(text);
    return autoFormatLatex(repaired);
}
