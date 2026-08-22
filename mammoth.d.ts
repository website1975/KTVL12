declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: any[];
  }

  export interface MammothOptions {
    arrayBuffer?: ArrayBuffer;
    buffer?: any;
    path?: string;
  }

  export function extractRawText(input: MammothOptions): Promise<MammothResult>;
  export function convertToHtml(input: MammothOptions, options?: any): Promise<MammothResult>;
  export function convertToMarkdown(input: MammothOptions, options?: any): Promise<MammothResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
    convertToMarkdown: typeof convertToMarkdown;
  };

  export default mammoth;
}
