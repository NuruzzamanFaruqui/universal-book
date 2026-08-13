import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { RuntimeConfigService } from '../config/runtime-config.service';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

@Injectable()
export class AiService {
  private client: Anthropic | null = null;
  private clientKey: string | null = null;

  constructor(private config: RuntimeConfigService) {}

  /**
   * Built on demand rather than in the constructor, so a key entered in
   * Admin → API Management takes effect without a redeploy.
   */
  private async anthropic(): Promise<Anthropic> {
    const key = await this.config.get('ANTHROPIC_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException(
        'AI is not configured. Add an Anthropic API key in Admin → API Management.',
      );
    }
    if (!this.client || this.clientKey !== key) {
      this.client = new Anthropic({ apiKey: key });
      this.clientKey = key;
    }
    return this.client;
  }

  private async model(): Promise<string> {
    return (await this.config.get('AI_MODEL')) || DEFAULT_MODEL;
  }

  /** Text out of a response, tolerating non-text blocks. */
  private text(message: any): string {
    const block = (message.content || []).find((b: any) => b.type === 'text');
    if (!block) throw new Error('The model returned no text.');
    return block.text as string;
  }

  /**
   * Parses JSON out of a model response. Previously five call sites did
   * `JSON.parse(raw)` with no guard, so a truncated or prose-wrapped reply was
   * an unhandled 500 in the middle of the wizard.
   */
  private parseJson<T>(raw: string, what: string): T {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.search(/[[{]/);
      const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1)) as T;
        } catch { /* fall through */ }
      }
      throw new ServiceUnavailableException(
        `The AI response for ${what} could not be read. Please try again.`,
      );
    }
  }

  async generateTitles(topic: string, description: string, genre: string, tone: string): Promise<any> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Generate 6 compelling book title options for:
Topic: ${topic}
Description: ${description || 'Not provided'}
Genre: ${genre}
Tone: ${tone}

Return ONLY a JSON array with this exact format:
[
  {
    "title": "Main Title",
    "subtitle": "Optional subtitle",
    "reason": "Why this title works"
  }
]

Make titles compelling, memorable, and marketable. No extra text.`
      }],
    });

    return { titles: this.parseJson(this.text(message), 'title options') };
  }

  async generateOutlines(topic: string, description: string, genre: string, tone: string, audience: string, title: string, chaptersCount: number): Promise<any> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `Generate 3 different book outlines for:
Title: ${title}
Topic: ${topic}
Description: ${description || 'Not provided'}
Genre: ${genre}
Tone: ${tone}
Audience: ${audience}
Chapters: ${chaptersCount}

Return ONLY a JSON array with this exact format:
[
  {
    "approach": "Brief description of this outline's approach",
    "chapters": [
      {
        "title": "Chapter title",
        "description": "Brief chapter description",
        "sections": ["Section 1", "Section 2"]
      }
    ]
  }
]

Each outline must have exactly ${chaptersCount} chapters.
For non-fiction/academic: include 2-4 sections per chapter.
For fiction: sections are optional.
No extra text outside JSON.`
      }],
    });

    return { outlines: this.parseJson(this.text(message), 'outlines') };
  }

  async generateSynopses(topic: string, title: string, genre: string, tone: string, audience: string, outline: any): Promise<any> {
    const chapterList = outline?.chapters?.map((c: any, i: number) => `${i+1}. ${c.title}`).join('\n') || '';

    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Write 3 different compelling book synopses for:
Title: ${title}
Topic: ${topic}
Genre: ${genre}
Tone: ${tone}
Target Audience: ${audience}
Chapters:
${chapterList}

Return ONLY a JSON array of 3 strings:
["Synopsis 1 text here...", "Synopsis 2 text here...", "Synopsis 3 text here..."]

Each synopsis should be 100-150 words, compelling, and make readers want to buy the book.
No extra text outside JSON.`
      }],
    });

    return { synopses: this.parseJson(this.text(message), 'synopses') };
  }

  async generateOutline(topic: string, genre: string, tone: string, audience: string, chaptersCount: number): Promise<any> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Create a detailed book outline for:
Topic: ${topic}
Genre: ${genre}
Tone: ${tone}
Audience: ${audience}
Chapters: ${chaptersCount}

Return JSON:
{
  "title": "Book title",
  "subtitle": "Optional subtitle",
  "synopsis": "Brief synopsis",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter title",
      "summary": "Chapter summary",
      "sections": ["Section 1", "Section 2"]
    }
  ]
}
No extra text.`
      }],
    });

    return this.parseJson(this.text(message), 'the outline');
  }

  async generateChapterContent(
    bookTitle: string,
    chapterTitle: string,
    chapterNumber: number,
    totalChapters: number,
    synopsis: string,
    genre: string,
    tone: string,
    audience: string,
    previousChapterSummary?: string,
    sections?: string[],
  ): Promise<string> {
    const sectionsText = sections?.length
      ? `\nThis chapter has these sections:\n${sections.map((s, i) => `${i+1}. ${s}`).join('\n')}`
      : '';

    const prevContext = previousChapterSummary
      ? `\nPrevious chapter summary: ${previousChapterSummary}`
      : '';

    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Write Chapter ${chapterNumber} of ${totalChapters} for the book "${bookTitle}".

Chapter Title: ${chapterTitle}
Genre: ${genre}
Tone: ${tone}
Target Audience: ${audience}
Book Synopsis: ${synopsis}${prevContext}${sectionsText}

Writing Requirements:
- Write in ${tone} tone
- Target audience: ${audience}
- If sections exist, use ## for section headings
- Use ### for subsections if needed
- Write 600-1000 words
- Start directly with content, no meta-commentary
- Make it engaging and professional
- End with a smooth transition if not the last chapter

Format with HTML. Do NOT repeat the chapter title — it is stored separately and
shown above the text, so writing it again duplicates it on the page.
- Sections: <h2>
- Subsections: <h3>
- Paragraphs: <p>
- Important points: <strong>
- Quotes/callouts: <blockquote>

Write the full chapter now:`
      }],
    });

    return this.text(message);
  }

  /**
   * Shapes the author's own material into prose. Deliberately constrained: no
   * new claims, no invented examples. A book is worth reading because of what
   * its author knows, and this is the path from knowing to written.
   */
  async draftFromNotes(input: {
    notes: string; bookTitle: string; chapterTitle: string; tone: string; audience: string;
  }): Promise<string> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 4000,
      system:
        'You turn an author\'s rough notes into finished prose. Every idea, example, number and ' +
        'opinion must come from the notes — never add facts, statistics, anecdotes or claims of ' +
        'your own. Where the notes are thin, write less rather than inventing filler. Reply with ' +
        'HTML only: <h2> for sections, <p> for paragraphs, <blockquote> for quotes, <ul>/<li> for ' +
        'lists. No markdown fences, no preamble.',
      messages: [{
        role: 'user',
        content: `Book: ${input.bookTitle}
${input.chapterTitle ? `Chapter: ${input.chapterTitle}` : ''}
${input.tone ? `Tone: ${input.tone}` : ''}
${input.audience ? `Reader: ${input.audience}` : ''}

My notes:
"""${input.notes}"""

Write this chapter from them.`,
      }],
    });
    return this.text(message).replace(/```html|```/g, '').trim();
  }

  /** Reads the manuscript and names what the author never had to declare. */
  async inferMetadata(sample: string): Promise<{
    genre: string; subGenre?: string; audience: string; tone: string;
    titles: string[]; synopsis: string; keywords: string[];
  }> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Read this book in progress and infer its metadata.

"""${sample}"""

Return ONLY JSON:
{
  "genre": "One of: Fantasy, Sci-Fi, Romance, Thriller, Self-Help, Business, Mystery, Horror, Biography, Literary Fiction, History, Science, Philosophy, Psychology, Education, Technology, Health, Travel, Cooking, Poetry",
  "subGenre": "More specific, or empty",
  "audience": "Who this is for, a short phrase",
  "tone": "A short phrase describing the register",
  "titles": ["Three title options that fit what is actually written"],
  "synopsis": "A back-cover blurb of 80-120 words, describing the book as it stands",
  "keywords": ["Five search keywords"]
}`,
      }],
    });
    return this.parseJson(this.text(message), 'the book metadata');
  }

  /**
   * Cross-chapter review. Asks only for the judgements a model is actually good
   * at — promises left unkept, terminology drift, contradictions, voice shifts.
   * Pacing is arithmetic and computed by the caller.
   */
  async reviewManuscript(
    title: string,
    chapters: { number: number; title: string; words: number; text: string }[],
  ): Promise<{
    continuity: { severity: 'high' | 'low'; chapter?: number; issue: string }[];
    voice: string;
    whereYouLeftOff?: { chapter: number; note: string };
  }> {
    const body = chapters
      .map(c => `--- Chapter ${c.number}: ${c.title} (${c.words} words) ---\n${c.text.slice(0, 3000)}`)
      .join('\n\n');

    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are reviewing a manuscript titled "${title}" for its author.

${body}

Report only real, specific problems you can point at. If there are none, return empty arrays —
do not invent issues to seem useful.

Return ONLY JSON:
{
  "continuity": [
    { "severity": "high", "chapter": 3, "issue": "Chapter 1 promises a framework for audits; no chapter delivers one." }
  ],
  "voice": "One sentence on whether the register is consistent, naming chapters that drift.",
  "whereYouLeftOff": { "chapter": 3, "note": "Stops mid-argument after introducing tacit knowledge without defining it." }
}`,
      }],
    });
    return this.parseJson(this.text(message), 'the manuscript review');
  }

  // ─── Writing assistance ───────────────────────────────────────────────────

  /**
   * Acts on a selection from the editor. Returns prose only — no preamble, no
   * quotes — because the result is substituted directly into the document.
   */
  async assist(action: string, text: string, context?: { bookTitle?: string; tone?: string; voiceSample?: string }): Promise<string> {
    const instructions: Record<string, string> = {
      tighten: 'Cut it to its essentials. Same meaning, fewer words, no loss of specificity.',
      expand: 'Develop it one step further with a concrete detail or consequence. Two or three sentences at most.',
      concrete: 'Replace abstractions with specifics — a number, a named example, an observable situation.',
      simplify: 'Rewrite so a reader outside the field follows it, without patronising them.',
      voice: "Rewrite it to match the author's own voice, using the sample below as the reference.",
      continue: 'Continue from where this stops. Match the voice and register exactly. Two or three sentences.',
    };

    const instruction = instructions[action];
    if (!instruction) throw new BadRequestException(`Unknown action "${action}".`);

    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 1200,
      system:
        'You are editing a passage inside a book. Reply with the replacement prose and nothing ' +
        'else — no explanation, no quotation marks, no markdown fences. Preserve any HTML tags ' +
        'that were present. Never invent facts the author has not written.',
      messages: [{
        role: 'user',
        content: `Book: ${context?.bookTitle || 'Untitled'}
Tone: ${context?.tone || 'as written'}
Task: ${instruction}
${context?.voiceSample ? `\nThe author's voice, for reference:\n"""${context.voiceSample.slice(0, 1500)}"""\n` : ''}
Passage:
"""${text}"""`,
      }],
    });

    return this.text(message).trim();
  }

  /**
   * Reads the whole manuscript and reflects its structure back — the outline as
   * a mirror of what exists rather than a plan to obey.
   */
  async describeShape(title: string, chapters: { number: number; title: string; words: number; excerpt: string }[]) {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Here is a book in progress, titled "${title}".

${chapters.map(c => `Chapter ${c.number}: ${c.title} (${c.words} words)\n${c.excerpt.slice(0, 600)}`).join('\n\n')}

Return ONLY JSON:
{
  "summary": "Two sentences on what this book currently is.",
  "gaps": ["Something promised and not delivered, or missing for a reader"],
  "suggestedNext": { "title": "Chapter title", "why": "One sentence" }
}`,
      }],
    });
    return this.parseJson(this.text(message), 'the book shape');
  }

  async importAndParseBook(content: string, fileName: string, title: string, genre: string): Promise<any> {
    const message = await (await this.anthropic()).messages.create({
      model: await this.model(),
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Parse this book manuscript and extract the structure:

Title: ${title}
Genre: ${genre}
File: ${fileName}

Content (first 8000 chars):
${content.substring(0, 8000)}

Return ONLY JSON:
{
  "title": "Book title",
  "synopsis": "Brief synopsis of the book",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter title",
      "content": "Full chapter content in HTML format"
    }
  ]
}

Parse as many chapters as you can detect. Use <p> tags for paragraphs, <h2> for sections.
No extra text outside JSON.`
      }],
    });

    return this.parseJson(this.text(message), 'the imported manuscript');
  }
}
