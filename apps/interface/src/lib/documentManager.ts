import { apiClient } from "@/lib/api-client";

export interface CampaignDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export function validateDocument(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File size exceeds 10MB limit" };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: "File type not supported" };
  }
  return { valid: true };
}

export function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export async function uploadDocument(
  file: File,
  campaignId: string,
): Promise<CampaignDocument> {
  const validation = validateDocument(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("campaignId", campaignId);

  return apiClient.post<CampaignDocument>("/api/documents/upload", formData);
}

export function downloadDocument(doc: CampaignDocument): void {
  const a = document.createElement("a");
  a.href = doc.url;
  a.download = doc.name;
  a.click();
}
