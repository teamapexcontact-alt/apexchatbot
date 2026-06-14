declare module "pdf-parse" {
  interface PDFTextResult {
    text: string;
    pages: Array<{ text: string; num: number }>;
    total: number;
  }
  export class PDFParse {
    constructor(data: Uint8Array);
    getText(): Promise<PDFTextResult>;
    getInfo(): Promise<any>;
    destroy(): void;
    static isNodeJS: boolean;
  }
}
