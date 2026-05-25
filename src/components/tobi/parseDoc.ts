import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ParsedDoc = { name: string; kind: "docx" | "xlsx"; text: string; preview: string };

export async function parseDocument(file: File): Promise<ParsedDoc> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return { name: file.name, kind: "docx", text: value, preview: value.slice(0, 200) };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    let text = "";
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      text += `\n## Sheet: ${name}\n`;
      text += XLSX.utils.sheet_to_csv(sheet);
      text += "\n";
    }
    return { name: file.name, kind: "xlsx", text: text.slice(0, 50000), preview: text.slice(0, 200) };
  }
  throw new Error(`Unsupported file type: ${file.name}. Try .docx or .xlsx.`);
}
