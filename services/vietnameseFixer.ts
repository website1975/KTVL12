    /**
     * Bộ chuẩn hóa tiếng Việt và sửa lỗi vỡ dấu / vỡ từ (Decomposed accents / OCR / PDF artifacts)
     * Chú ý: TUYỆT ĐỐI KHÔNG làm biến đổi nội dung công thức LaTeX nằm trong $...$
     */

    // Bảng ánh xạ nguyên âm + loại dấu sang ký tự tiếng Việt chuẩn (Unicode NFC)
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
        // Hỏi: ̉ (\u0309), ˀ
        if (char === '\u0309' || char === '̉' || char === 'ˀ') return 'hook';
        // Ngã: ~, ˜ (\u02DC), ̃ (\u0303)
        if (char === '~' || char === '˜' || char === '\u02DC' || char === '\u0303' || char === '̃') return 'tilde';
        // Nặng: ̣ (\u0323)
        if (char === '\u0323' || char === '̣') return 'dot';
        return null;
    }

    /**
     * Khôi phục văn bản tiếng Việt thuần túy (không đụng vào khối LaTeX)
     */
    export function repairVietnameseTextOnly(raw: string): string {
        if (!raw) return '';

        // 0. Loại bỏ ký tự null \u0000 và các ký tự điều khiển lỗi không hợp lệ trong PostgreSQL/JSON
        let text = raw
            .replace(/\0/g, '')
            .replace(/\\u0000/g, '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '');

        // 1. Chuẩn hóa Unicode sang dạng dựng sẵn (NFC)
        text = text.normalize('NFC');

        // 2. Xóa các dấu thanh rác chèn ngay sau ký tự tiếng Việt đã có dấu
        // Ví dụ: Đố´i -> Đối, chấ´t -> chất, cấ´u -> cấu, biế´n -> biến, đấ´t -> đất
        text = text.replace(/([áàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ])\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~]+)/g, '$1');

        // 3. Sửa các từ phổ biến bị vỡ dấu do font TCVN3 / VNI / PDF
        text = text
            .replace(/PHÂ\s*[`´'\u00B4\u02CA\u02CB~]\s*N/g, 'PHẦN')
            .replace(/NHIÊ\s*[`´'\u00B4\u02CA\u02CB~]\s*U/g, 'NHIỀU')
            .replace(/TRẮ\s+C/g, 'TRẮC')
            .replace(/TRÁ\s+I/g, 'TRÁI')
            .replace(/ĐẤ\s+T/g, 'ĐẤT')
            .replace(/CẤ\s+U/g, 'CẤU')
            .replace(/BIẾ\s+N/g, 'BIẾN')
            .replace(/ĐỐ\s+I/g, 'ĐỐI')
            .replace(/TƯỢ\s+NG/g, 'TƯỢNG')
            .replace(/(p|P)hâ\s*[`´'\u00B4\u02CA\u02CB~]\s*n/g, (_m, p1) => (p1 === 'P' ? 'Phần' : 'phần'))
            .replace(/(n|N)hiê\s*[`´'\u00B4\u02CA\u02CB~]\s*u/g, (_m, p1) => (p1 === 'N' ? 'Nhiều' : 'nhiều'))
            .replace(/(n|N)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*c/g, (_m, p1) => (p1 === 'N' ? 'Nước' : 'nước'))
            .replace(/(đ|Đ)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*c/g, (_m, p1) => (p1 === 'Đ' ? 'Được' : 'được'))
            .replace(/(t|T)rươ\s*[`´'\u00B4\u02CA\u02CB~]\s*c/g, (_m, p1) => (p1 === 'T' ? 'Trước' : 'trước'))
            .replace(/(l|L)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*ng/g, (_m, p1) => (p1 === 'L' ? 'Lượng' : 'lượng'))
            .replace(/(th|Th)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*ng/g, (_m, p1) => (p1 === 'Th' ? 'Thường' : 'thường'))
            .replace(/(h|H)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*ng/g, (_m, p1) => (p1 === 'H' ? 'Hướng' : 'hướng'))
            .replace(/(ng|Ng)ươ\s*[`´'\u00B4\u02CA\u02CB~]\s*i/g, (_m, p1) => (p1 === 'Ng' ? 'Người' : 'người'))
            .replace(/(ch|Ch)iê\s*[`´'\u00B4\u02CA\u02CB~]\s*u/g, (_m, p1) => (p1 === 'Ch' ? 'Chiều' : 'chiều'))
            .replace(/(b|B)ă\s*[`´'\u00B4\u02CA\u02CB~]\s*ng/g, (_m, p1) => (p1 === 'B' ? 'Bằng' : 'bằng'))
            .replace(/(c|C)hâ\s*[`´'\u00B4\u02CA\u02CB~]\s*t/g, (_m, p1) => (p1 === 'C' ? 'Chất' : 'chất'))
            .replace(/(c|C)â\s*[`´'\u00B4\u02CA\u02CB~]\s*n/g, (_m, p1) => (p1 === 'C' ? 'Cần' : 'cần'))
            .replace(/(c|C)â\s*[`´'\u00B4\u02CA\u02CB~]\s*u/g, (_m, p1) => (p1 === 'C' ? 'Cấu' : 'cấu'))
            .replace(/(đ|Đ)â\s*[`´'\u00B4\u02CA\u02CB~]\s*u/g, (_m, p1) => (p1 === 'Đ' ? 'Đầu' : 'đầu'))
            .replace(/(đ|Đ)â\s*[`´'\u00B4\u02CA\u02CB~]\s*t/g, (_m, p1) => (p1 === 'Đ' ? 'Đất' : 'đất'))
            .replace(/(b|B)iê\s*[`´'\u00B4\u02CA\u02CB~]\s*n/g, (_m, p1) => (p1 === 'B' ? 'Biến' : 'biến'))
            .replace(/(đ|Đ)ô\s*[`´'\u00B4\u02CA\u02CB~]\s*i/g, (_m, p1) => (p1 === 'Đ' ? 'Đối' : 'đối'));

        // 4. Sửa dạng nguyên âm đôi + dấu rời rạc (iê, uô, ươ, ưa, ua, ie, ye, IÊ, UÔ, ƯƠ)
        const diphthongPattern = /(iê|uô|ươ|ưa|ua|ie|ye|Iê|Uô|Ươ|Ưa|Ua|IÊ|UÔ|ƯƠ)\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~])\s*([a-zA-ZđĐ]*)/g;
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

        // 5. Sửa dạng nguyên âm đơn + dấu rời rạc: [Nguyên âm] + [Dấu rời: ´ ` ' ~] + [Phụ âm / Nguyên âm tiếp theo]
        const singleVowelPattern = /([aAăĂâÂeEêÊiIoOôÔơƠuUưƯyY])\s*([´`'\u00B4\u02CA\u02CB\u02DC\u0309\u0303\u0323~])\s*([a-zA-ZđĐ]*)/g;
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

        // 6. Sửa các từ tiếng Việt bị vỡ cụ thể (ghép đúng từ đơn/từ ghép, TUYỆT ĐỐI không gộp từ khác)
        // Sửa các cặp từ bị chèn khoảng trắng thường gặp trong đề thi:
        const specificBrokenWords: [RegExp, string][] = [
            [/\bbằ\s+ng\b/gi, 'bằng'],
            [/\bchiề\s+u\b/gi, 'chiều'],
            [/\bchuyể\s+n\b/gi, 'chuyển'],
            [/\bquã\s+ng\b/gi, 'quãng'],
            [/\bđườ\s+ng\b/gi, 'đường'],
            [/\bđộ\s+ng\b/gi, 'động'],
            [/\bthẳ\s+ng\b/gi, 'thẳng'],
            [/\bđổ\s+i\b/gi, 'đổi'],
            [/\btrò\s+n\b/gi, 'tròn'],
            [/\blỏ\s+ng\b/gi, 'lỏng'],
            [/\bchấ\s+t\b/gi, 'chất'],
            [/\bcầ\s+n\b/gi, 'cần'],
            [/\bđầ\s+u\b/gi, 'đầu'],
            [/\bnhiệ\s+t\b/gi, 'nhiệt'],
            [/\bvậ\s+t\b/gi, 'vật'],
            [/\bkhô\s+ng\b/gi, 'không'],
            [/\bbiế\s+t\b/gi, 'biết'],
            [/\bđiể\s+m\b/gi, 'điểm'],
            [/\bthờ\s+i\b/gi, 'thời'],
            [/\bgiâ\s+y\b/gi, 'giây']
        ];

        for (const [regex, replacement] of specificBrokenWords) {
            text = text.replace(regex, replacement);
        }

        return text.normalize('NFC');
    }

    /**
     * Tự động bọc $...$ cho các công thức, biểu thức, ký hiệu toán/lý bị thiếu dấu $
     * và chuẩn hóa \(...\), \[...\] sang $...$, $$...$$
     */
    export function autoWrapLatex(text: string): string {
        if (!text) return '';
        
        // 0. Loại bỏ ký tự null và ký tự điều khiển lỗi
        const cleanText = text
            .replace(/\0/g, '')
            .replace(/\\u0000/g, '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '');

        // 1. Chuyển đổi \( ... \) và \[ ... \] thành $ ... $ và $$ ... $$
        let res = cleanText
            .replace(/\\\(([\s\S]*?)\\\)/g, (_m, g1) => `$${g1}$`)
            .replace(/\\\[([\s\S]*?)\\\]/g, (_m, g1) => `$$${g1}$$`);

        // 2. Chuẩn hóa dấu phẩy số thập phân trong khối LaTeX $12,5$ -> $12{,}5$
        res = res.replace(/\$([^$]+)\$/g, (_m, inner) => {
            const fixedInner = inner.replace(/(\d+),(\d+)/g, '$1{,}$2');
            return `$${fixedInner}$`;
        });

        // 3. Tự động bọc $...$ cho các lệnh LaTeX chưa có bao bọc $
        const parts = res.split(/(\${1,2}[^$]+\${1,2})/g);
        const processed = parts.map(part => {
            if (part.startsWith('$')) {
                return part; // Đã là khối LaTeX
            }
            
            let chunk = part;
            
            // Nhận diện các lệnh LaTeX phổ biến (bắt đầu bằng \) - không dùng Lookbehind để tương thích 100% iOS Safari / iPhone
            const latexPattern = /(^|[^\\])(\\(?:frac\{[^{}]*\}\{[^{}]*\}|sqrt(?:\[[^{}]*\])?\{[^{}]*\}|vec\{[^{}]*\}|text\{[^{}]*\}|mathrm\{[^{}]*\}|mathbf\{[^{}]*\}|hat\{[^{}]*\}|bar\{[^{}]*\}|dot\{[^{}]*\}|ddot\{[^{}]*\}|left[([{|.]|right[)\]}|.]|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|Lambda|mu|nu|xi|Xi|pi|Pi|rho|sigma|Sigma|tau|upsilon|phi|Phi|chi|psi|Psi|omega|Omega|infty|approx|le|ge|neq|equiv|sim|times|div|cdot|pm|mp|circ|degree|rightarrow|to|parallel|perp|angle|sum|int|lim)(?:[a-zA-Z0-9_{}^=+\-*/(),.\s]*))/g;

            chunk = chunk.replace(latexPattern, (_m, prefix, cmd) => {
                const trimmed = (cmd || '').trim();
                if (!trimmed) return _m;
                return `${prefix}$${trimmed}$`;
            });

            // Nhận diện số mũ hoặc chỉ số dưới chưa bọc LaTeX (ví dụ 10^-3, 10^5, x_1, v_{max})
            const expPattern = /(^|[\s([=+\-*/])([a-zA-Z0-9]+\^\{?-?[0-9a-zA-Z+\-]+\}?|[a-zA-Z]+_\{?[0-9a-zA-Z+\-]+\}?)(?=[\s)\].,;:!?]|$)/g;
            chunk = chunk.replace(expPattern, (_m, prefix, expr) => {
                const trimmed = (expr || '').trim();
                if (!trimmed || trimmed.startsWith('$')) return _m;
                return `${prefix}$${trimmed}$`;
            });

            return chunk;
        });

        return processed.join('');
    }

    /**
     * Xóa các tiền tố gán cứng số câu trong đề gốc khỏi nội dung lời dẫn dùng chung
     * (Ví dụ: "Dữ liệu dùng chung cho câu 3, 4: Cho đoạn mạch..." -> "Cho đoạn mạch...")
     */
    export function cleanSharedContextBody(raw?: string): string {
        if (!raw) return '';
        let text = raw.trim();
        const prefixRegexes = [
            /^(?:Dữ\s*liệu|Thông\s*tin|Đoạn\s*văn|Đoạn\s*trích|Bảng\s*số\s*liệu|Lời\s*dẫn|Bối\s*cảnh|Tình\s*huống)?\s*(?:dùng\s*chung)?\s*(?:cho|của)?\s*(?:các)?\s*(?:câu|câu\s*hỏi|ý)\s*(?:\d+|[A-Z])(?:\s*(?:,|;|và|-|–|đến|to)\s*(?:câu\s*)?(?:\d+|[A-Z]))*\s*[:.\-–—]\s*/i,
            /^(?:Sử\s*dụng|Dựa\s*vào|Căn\s*cứ\s*vào|Đọc|Quan\s*sát|Xem)\s*(?:dữ\s*liệu|thông\s*tin|bảng|đồ\s*thị|hình\s*vẽ|đoạn\s*văn|bài\s*đọc|thực\s*nghiệm)?\s*(?:sau\s*)?(?:đây\s*)?(?:để\s*)?trả\s*lời\s*(?:cho\s*)?(?:các\s*)?(?:câu|câu\s*hỏi|ý)?\s*(?:\d+|[A-Z])(?:\s*(?:,|;|và|-|–|đến|to)\s*(?:câu\s*)?(?:\d+|[A-Z]))*\s*[:.\-–—]\s*/i,
            /^(?:Dữ\s*liệu|Lời\s*dẫn|Thông\s*tin)\s*dùng\s*chung\s*[:.\-–—]\s*/i
        ];

        for (const regex of prefixRegexes) {
            text = text.replace(regex, '');
        }
        return text.trim();
    }

    /**
     * Tính toán thông tin nhóm câu hỏi có chung lời dẫn trong danh sách đề thi hiện hành
     * Tự động sinh tiêu đề linh hoạt: "Dữ liệu dùng chung cho Câu 5 – Câu 6"
     */
    export function getContextGroupInfo(questions: { context?: string }[], currentIndex: number): {
        label: string;
        isFirstInGroup: boolean;
        groupCount: number;
        cleanedContext: string;
    } {
        const currentQ = questions[currentIndex];
        const currentCtx = (currentQ?.context || '').trim();
        if (!currentCtx) {
            return { label: '', isFirstInGroup: true, groupCount: 0, cleanedContext: '' };
        }

        const cleanedContext = cleanSharedContextBody(currentCtx);

        // Tìm phạm vi các câu hỏi liên tiếp có chung context
        let start = currentIndex;
        while (start > 0 && (questions[start - 1]?.context || '').trim() === currentCtx) {
            start--;
        }

        let end = currentIndex;
        while (end < questions.length - 1 && (questions[end + 1]?.context || '').trim() === currentCtx) {
            end++;
        }

        const isFirstInGroup = currentIndex === start;
        const groupCount = end - start + 1;

        let label = '';
        if (groupCount > 1) {
            label = `Dữ liệu dùng chung cho Câu ${start + 1} – Câu ${end + 1}`;
        } else {
            label = `Dữ liệu dùng chung cho Câu ${currentIndex + 1}`;
        }

        return { label, isFirstInGroup, groupCount, cleanedContext };
    }

    /**
     * Chuẩn hóa toàn bộ chuỗi nhưng bảo vệ an toàn 100% cho các khối LaTeX $...$
     */
    export function normalizeFullText(text: string): string {
        if (!text) return '';

        // Tự động bọc LaTeX nếu phát hiện các mẫu LaTeX thiếu $
        const wrapped = autoWrapLatex(text);

        // Nếu không có ký tự $, chuẩn hóa trực tiếp text
        if (!wrapped.includes('$')) {
            return repairVietnameseTextOnly(wrapped);
        }

        // Tách chuỗi thành các phần LaTeX ($...$) và văn bản thường
        const parts = wrapped.split(/(\$.*?\$)/g);
        
        return parts.map(part => {
            if (part.startsWith('$') && part.endsWith('$')) {
                // Khối LaTeX: Giữ NGUYÊN BẢN để KaTeX xử lý chính xác tuyệt đối
                return part;
            }
            // Khối văn bản thường: Sửa lỗi tiếng Việt bị vỡ dấu
            return repairVietnameseTextOnly(part);
        }).join('');
    }

    export function repairVietnameseText(raw: string): string {
        return normalizeFullText(raw);
    }
