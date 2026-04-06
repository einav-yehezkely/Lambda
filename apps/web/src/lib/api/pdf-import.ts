const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AiCardMetadata {
  question_format?: 'open' | 'multiple_choice';
  correct_option?: string;
  explanation?: string;
  sections?: Array<{ label: string; content: string }>;
}

export interface AiCard {
  type: 'proof' | 'exam_question' | 'exercise_question' | 'algorithm' | 'other';
  title: string;
  content: string;
  solution?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
  topic_index: number | null;
  metadata?: AiCardMetadata;
}

export interface ImportPdfResult {
  cards: AiCard[];
  truncated: boolean;
}

export async function importPdf(
  file: File,
  versionId: string,
  topicTitles: string[],
): Promise<ImportPdfResult> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('topics', JSON.stringify(topicTitles));

  const res = await fetch(
    `${API_URL}/api/pdf-import?version_id=${encodeURIComponent(versionId)}`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    },
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Import failed');
  }

  return res.json();
}
