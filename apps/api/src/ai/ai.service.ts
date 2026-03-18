import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateTitles(topic: string, description: string, genre: string, tone: string): Promise<any> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const text = (message.content[0] as any).text;
    const clean = text.replace(/```json|```/g, '').trim();
    return { titles: JSON.parse(clean) };
  }

  async generateOutlines(topic: string, description: string, genre: string, tone: string, audience: string, title: string, chaptersCount: number): Promise<any> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const text = (message.content[0] as any).text;
    const clean = text.replace(/```json|```/g, '').trim();
    return { outlines: JSON.parse(clean) };
  }

  async generateSynopses(topic: string, title: string, genre: string, tone: string, audience: string, outline: any): Promise<any> {
    const chapterList = outline?.chapters?.map((c: any, i: number) => `${i+1}. ${c.title}`).join('\n') || '';

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const text = (message.content[0] as any).text;
    const clean = text.replace(/```json|```/g, '').trim();
    return { synopses: JSON.parse(clean) };
  }

  async generateOutline(topic: string, genre: string, tone: string, audience: string, chaptersCount: number): Promise<any> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const text = (message.content[0] as any).text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
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

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

Format with proper headings using HTML:
- Chapter title: <h1>
- Sections: <h2>
- Subsections: <h3>
- Paragraphs: <p>
- Important points: <strong>
- Quotes/callouts: <blockquote>

Write the full chapter now:`
      }],
    });

    return (message.content[0] as any).text;
  }

  async importAndParseBook(content: string, fileName: string, title: string, genre: string): Promise<any> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
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

    const text = (message.content[0] as any).text;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  }
}
