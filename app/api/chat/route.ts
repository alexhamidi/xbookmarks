import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { readFile } from 'fs/promises';
import path from 'path';
import { buildSystemPrompt } from '@/app/lib/systemPrompt';

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

async function loadBookmarks() {
    try {
        const filePath = path.join(process.cwd(), 'data', 'bookmarks.json');
        const raw = await readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    const { messages }: { messages: UIMessage[] } = await req.json();

    const bookmarks = await loadBookmarks();
    const systemMessage = buildSystemPrompt({ bookmarks: bookmarks?.data ?? null });

    const result = streamText({
        model: openrouter.chat('arcee-ai/trinity-large-preview:free'),
        system: systemMessage,
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
