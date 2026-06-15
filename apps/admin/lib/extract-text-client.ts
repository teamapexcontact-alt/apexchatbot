export async function extractTextClientSide(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    try {
      const pdfjsLib: any = await import("pdfjs-dist");
      const version = pdfjsLib.version || "5.4.296";
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      return text.trim();
    } catch (e) {
      console.error("Client-side PDF extraction failed:", e);
      return "";
    }
  }
  if (name.endsWith(".docx")) {
    try {
      const mammoth: any = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return (result.value || "").trim();
    } catch {
      return "";
    }
  }
  try {
    return await file.text();
  } catch {
    return "";
  }
}
