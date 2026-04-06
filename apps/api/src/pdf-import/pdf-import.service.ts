import {
  Injectable,
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseClient } from '../common/supabase.client';

const MAX_CARDS = 25;

const SYSTEM_PROMPT_BASE = `You are an AI that extracts structured academic content cards for Lambda, a CS/Math learning platform used by Hebrew-speaking university students.

INPUT: A Hebrew or English academic PDF document (lecture notes, textbook, exam).
OUTPUT: A JSON object with "cards".

\u2501\u2501\u2501 HEBREW MATH HEADING \u2192 CARD TYPE MAPPING \u2501\u2501\u2501
Recognize these Hebrew section headings and map them to the correct card type:

| Hebrew heading          | type               |
|-------------------------|---------------------|
| \u05de\u05e9\u05e4\u05d8, \u05d8\u05e2\u05e0\u05d4, \u05de\u05e1\u05e7\u05e0\u05d4, \u05dc\u05de\u05d4 | "proof"            |
| \u05d4\u05d2\u05d3\u05e8\u05d4, \u05e1\u05d9\u05de\u05d5\u05df            | "other"            |
| \u05ea\u05e8\u05d2\u05d9\u05dc, \u05d1\u05e2\u05d9\u05d4             | "exercise_question"|
| \u05e9\u05d0\u05dc\u05d4 (exam context)     | "exam_question"    |
| \u05d0\u05dc\u05d2\u05d5\u05e8\u05d9\u05ea\u05dd                | "algorithm"        |
| \u05d3\u05d5\u05d2\u05de\u05d4, \u05d3\u05d5\u05d2\u05de\u05d0\u05d5\u05ea          | "other"            |
| \u05d4\u05e2\u05e8\u05d4, \u05d4\u05d0\u05e8\u05d4              | "other"            |

CRITICAL: "\u05d4\u05d5\u05db\u05d7\u05d4" (proof) is NEVER a separate card.
It is the SOLUTION of the preceding "\u05de\u05e9\u05e4\u05d8"/"\u05d8\u05e2\u05e0\u05d4" card.
Merge "\u05de\u05e9\u05e4\u05d8" + "\u05d4\u05d5\u05db\u05d7\u05d4" into ONE proof card.

\u2501\u2501\u2501 PROOF CARD CONSTRUCTION \u2501\u2501\u2501
When you see: [\u05de\u05e9\u05e4\u05d8/\u05d8\u05e2\u05e0\u05d4/\u05de\u05e1\u05e7\u05e0\u05d4] \u2026 [\u05d4\u05d5\u05db\u05d7\u05d4] \u2026
\u2192 Create ONE card:
  - type: "proof"
  - title: the theorem label from the document (e.g., "\u05de\u05e9\u05e4\u05d8 3.2", "\u05dc\u05de\u05d4 \u05d4\u05d0\u05d5\u05d9\u05dc\u05e8", "\u05d8\u05e2\u05e0\u05d4")
  - content: the theorem/claim statement
  - solution: everything under "\u05d4\u05d5\u05db\u05d7\u05d4" until the next heading

\u2501\u2501\u2501 TITLE RULES \u2501\u2501\u2501
- Use the document's exact label: "\u05de\u05e9\u05e4\u05d8 3.2", "\u05d4\u05d2\u05d3\u05e8\u05d4 1.4", "\u05ea\u05e8\u05d2\u05d9\u05dc 5", "\u05d0\u05dc\u05d2\u05d5\u05e8\u05d9\u05ea\u05dd \u05e4\u05d5\u05e8\u05d3-\u05e4\u05d5\u05dc\u05e7\u05e8\u05e1\u05d5\u05df"
- If the heading has a name, include it: "\u05de\u05e9\u05e4\u05d8 \u05d0\u05d5\u05d9\u05dc\u05e8", "\u05dc\u05de\u05d4 \u05d4\u05dc\u05d7\u05d9\u05e6\u05ea \u05d9\u05d3\u05d9\u05d9\u05dd"
- Titles should be short - the theorem label, not the full statement
- Preserve Hebrew in titles exactly as written

\u2501\u2501\u2501 LaTeX RULES \u2501\u2501\u2501
- Inline math: $...$ (e.g., "\u05d4\u05d2\u05e8\u05e3 $G=(V,E)$ \u05d4\u05d5\u05d0 \u05e7\u05e9\u05d9\u05e8")
- Block/display math: $$...$$ on its own line
- Preserve ALL mathematical notation as proper LaTeX
- Common symbols: \\leq, \\geq, \\neq, \\in, \\subseteq, \\cup, \\cap, \\forall, \\exists, \\Rightarrow, \\Leftrightarrow, \\mathbb{N}, \\mathbb{R}

\u2501\u2501\u2501 OUTPUT SCHEMA \u2501\u2501\u2501
{
  "cards": [{
    "type": "proof" | "exam_question" | "exercise_question" | "algorithm" | "other",
    "title": "string (document label, Hebrew preserved)",
    "content": "string (LaTeX-enabled, Hebrew preserved)",
    "solution": "string (omit if absent)",
    "difficulty": "easy" | "medium" | "hard" (omit if unclear),
    "tags": ["string"],
    "topic_index": number | null,
    "metadata": {
      "question_format": "open" | "multiple_choice" (omit if not applicable),
      "correct_option": "A" | "B" | "C" | "D" (only for multiple_choice),
      "explanation": "string" (only for multiple_choice),
      "sections": [{ "label": "string", "content": "string" }] (for algorithms)
    }
  }]
}

\u2501\u2501\u2501 RULES \u2501\u2501\u2501
- Max 25 cards. Prioritize complete, self-contained items.
- Skip: page numbers, running headers/footers, table of contents, bibliography.
- Do NOT create a card for "\u05d4\u05d5\u05db\u05d7\u05d4" alone - it belongs in the previous card's "solution".
- Copy content and solution text VERBATIM from the source - do not paraphrase, summarize, or rephrase.
- Never invent content not present in the source text.
- Respond with ONLY the JSON object, no prose.`;

function buildSystemPrompt(existingTopicTitles: string[]): string {
  const topicsSection =
    existingTopicTitles.length > 0
      ? `\u2501\u2501\u2501 TOPICS \u2501\u2501\u2501
Assign each card to one of these existing topics using "topic_index" (0-based index into this list).
Use null if no topic is a good fit.

${existingTopicTitles.map((t, i) => `[${i}] "${t}"`).join('\n')}`
      : `\u2501\u2501\u2501 TOPICS \u2501\u2501\u2501
No topics exist yet. Set "topic_index": null for all cards.`;

  return `${SYSTEM_PROMPT_BASE}\n\n${topicsSection}`;
}

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1];
  return text.trim();
}

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

@Injectable()
export class PdfImportService {
  constructor(private readonly config: ConfigService) {}

  private get db() {
    return getSupabaseClient();
  }

  async importPdf(
    buffer: Buffer,
    versionId: string,
    userId: string,
    existingTopicTitles: string[],
  ) {
    // Auth check
    const { data: version } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', versionId)
      .single();
    if (!version) throw new NotFoundException('Version not found');

    const { data: userRow } = await this.db
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();
    const isAdmin = userRow?.is_admin ?? false;

    if (!isAdmin && version.author_id !== userId) {
      throw new ForbiddenException('Only the version author can import content');
    }

    const { cards } = await this.callClaude(buffer, existingTopicTitles);
    return { cards, truncated: false };
  }

  private async callClaude(
    buffer: Buffer,
    existingTopicTitles: string[],
  ): Promise<{ cards: AiCard[] }> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('AI service not configured');

    const client = new Anthropic({ apiKey, timeout: 120_000 });

    let raw: string | null;
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8096,
        system: buildSystemPrompt(existingTopicTitles),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: buffer.toString('base64'),
                },
              } as any,
              {
                type: 'text',
                text: 'Extract content cards from this PDF. Respond with ONLY the JSON object.',
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      raw = textBlock?.type === 'text' ? textBlock.text : null;
    } catch {
      throw new BadGatewayException('AI service temporarily unavailable, please try again');
    }

    if (!raw) throw new BadGatewayException('AI returned empty response');

    let parsed: { cards?: unknown[] };
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      throw new BadGatewayException('AI returned unexpected response format');
    }

    const cards = this.sanitizeCards(parsed.cards ?? [], existingTopicTitles.length);
    return { cards };
  }

  private sanitizeCards(raw: unknown[], topicCount: number): AiCard[] {
    const VALID_TYPES = new Set([
      'proof',
      'exam_question',
      'exercise_question',
      'algorithm',
      'other',
    ]);
    const VALID_DIFF = new Set(['easy', 'medium', 'hard']);

    return raw
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .filter((c) => typeof c['title'] === 'string' && String(c['title']).trim())
      .filter((c) => typeof c['content'] === 'string' && String(c['content']).trim())
      .map((c) => {
        const rawTopicIndex = c['topic_index'];
        const topic_index =
          typeof rawTopicIndex === 'number' &&
          Number.isInteger(rawTopicIndex) &&
          rawTopicIndex >= 0 &&
          rawTopicIndex < topicCount
            ? rawTopicIndex
            : null;

        return {
          type: (VALID_TYPES.has(c['type'] as string) ? c['type'] : 'other') as AiCard['type'],
          title: String(c['title']).trim().slice(0, 500),
          content: String(c['content']).trim(),
          solution:
            typeof c['solution'] === 'string' && c['solution'].trim()
              ? c['solution'].trim()
              : undefined,
          difficulty: VALID_DIFF.has(c['difficulty'] as string)
            ? (c['difficulty'] as AiCard['difficulty'])
            : undefined,
          tags: Array.isArray(c['tags'])
            ? (c['tags'] as unknown[])
                .filter((t) => typeof t === 'string')
                .slice(0, 10) as string[]
            : [],
          topic_index,
          metadata:
            typeof c['metadata'] === 'object' && c['metadata'] !== null
              ? (c['metadata'] as AiCardMetadata)
              : undefined,
        };
      })
      .slice(0, MAX_CARDS);
  }
}
