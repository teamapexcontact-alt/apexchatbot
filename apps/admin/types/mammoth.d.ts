declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  interface ExtractOptions {
    buffer: Buffer;
  }
  export function extractRawText(options: ExtractOptions): Promise<ExtractResult>;
}
