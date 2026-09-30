/**
 * Tiện ích xử lý và trích xuất hình ảnh inline cho câu hỏi và lời dẫn
 */

export function extractImageUrlsFromText(text?: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const urls: string[] = [];
  // 1. Markdown syntax: ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+|data:image\/[^\s\)]+)\)/g;
  let match;
  while ((match = mdRegex.exec(text)) !== null) {
    if (match[1]) urls.push(match[1].trim());
  }
  // 2. HTML syntax: <img ... src="url" ...>
  const htmlRegex = /<img[^>]+src=["'](https?:\/\/[^"']+|data:image\/[^"']+)["']/gi;
  while ((match = htmlRegex.exec(text)) !== null) {
    if (match[1]) urls.push(match[1].trim());
  }
  return urls;
}

export function getAllQuestionImages(q: any): string[] {
  if (!q) return [];
  const set = new Set<string>();
  if (typeof q.imageUrl === 'string' && q.imageUrl.trim()) set.add(q.imageUrl.trim());
  if (typeof q.image === 'string' && q.image.trim()) set.add(q.image.trim());
  if (typeof q.img === 'string' && q.img.trim()) set.add(q.img.trim());
  if (Array.isArray(q.images)) {
    q.images.forEach((img: any) => typeof img === 'string' && img.trim() && set.add(img.trim()));
  }
  extractImageUrlsFromText(q.context).forEach(u => set.add(u));
  extractImageUrlsFromText(q.text).forEach(u => set.add(u));
  extractImageUrlsFromText(q.solution).forEach(u => set.add(u));
  if (Array.isArray(q.subQuestions)) {
    q.subQuestions.forEach((sq: any) => {
      if (typeof sq.imageUrl === 'string' && sq.imageUrl.trim()) set.add(sq.imageUrl.trim());
      extractImageUrlsFromText(sq.text).forEach(u => set.add(u));
    });
  }
  return Array.from(set);
}

export function buildImageTag({
  url,
  caption,
  maxHeight = 260,
  align = 'center',
}: {
  url: string;
  caption?: string;
  maxHeight?: number;
  align?: 'center' | 'left' | 'right';
}): string {
  const cap = caption ? caption.trim() : '';
  const alignStyle = align === 'center' ? 'margin: 10px auto;' : align === 'left' ? 'margin: 10px auto 10px 0;' : 'margin: 10px 0 10px auto;';
  
  if (cap) {
    return `\n<div style="text-align: center; margin: 12px 0;"><img src="${url}" alt="${cap}" style="max-height: ${maxHeight}px; max-width: 100%; display: block; ${alignStyle} border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" /><span style="display: block; font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px; font-style: italic;">${cap}</span></div>\n`;
  }
  return `\n<img src="${url}" alt="Hình minh họa" style="max-height: ${maxHeight}px; max-width: 100%; display: block; ${alignStyle} border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);" />\n`;
}

export function buildMultiImageGridTag(
  items: { url: string; caption?: string }[],
  maxHeight: number = 220
): string {
  if (items.length === 1) {
    return buildImageTag({ url: items[0].url, caption: items[0].caption, maxHeight });
  }
  const imgsHtml = items.map((item, idx) => {
    const cap = item.caption || `Hình ${idx + 1}`;
    return `<div style="flex: 1 1 240px; max-width: 48%; text-align: center; margin: 4px;"><img src="${item.url}" alt="${cap}" style="max-height: ${maxHeight}px; max-width: 100%; object-fit: contain; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); display: block; margin: 0 auto;" /><span style="display: block; font-size: 11px; font-weight: bold; color: #64748b; margin-top: 4px; font-style: italic;">${cap}</span></div>`;
  }).join('\n');

  return `\n<div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 16px; margin: 14px 0;">\n${imgsHtml}\n</div>\n`;
}
