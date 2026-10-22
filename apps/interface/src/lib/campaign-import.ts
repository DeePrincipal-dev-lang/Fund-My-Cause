export interface CampaignImportData {
  title: string;
  description: string;
  goal: string;
  deadline: string;
  minContribution: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface ImportValidationError {
  field: string;
  message: string;
}

export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

export function validateImportData(data: CampaignImportData): ImportValidationError[] {
  const errors: ImportValidationError[] = [];

  if (!data.title || data.title.length < 3) {
    errors.push({ field: "title", message: "Title must be at least 3 characters" });
  }

  if (!data.description || data.description.length < 10) {
    errors.push({ field: "description", message: "Description must be at least 10 characters" });
  }

  const goal = parseFloat(data.goal);
  if (isNaN(goal) || goal <= 0) {
    errors.push({ field: "goal", message: "Goal must be a positive number" });
  }

  const deadline = new Date(data.deadline);
  if (isNaN(deadline.getTime()) || deadline <= new Date()) {
    errors.push({ field: "deadline", message: "Deadline must be a future date" });
  }

  const minContribution = parseFloat(data.minContribution);
  if (isNaN(minContribution) || minContribution <= 0) {
    errors.push({ field: "minContribution", message: "Minimum contribution must be positive" });
  }

  if (data.imageUrl && !isValidUrl(data.imageUrl)) {
    errors.push({ field: "imageUrl", message: "Invalid image URL" });
  }

  if (data.videoUrl && !isValidUrl(data.videoUrl)) {
    errors.push({ field: "videoUrl", message: "Invalid video URL" });
  }

  return errors;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function convertToXLM(amount: string): bigint {
  const num = parseFloat(amount);
  return BigInt(Math.floor(num * 10_000_000)); // 1 XLM = 10,000,000 stroops
}
