import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { buildSystemPrompt } from '@/app/lib/systemPrompt';

const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: Request) {
    const { messages, bookmarks }: { messages: UIMessage[]; bookmarks?: any[] } = await req.json();

    const systemMessage = buildSystemPrompt({ bookmarks: bookmarks ?? null });

    const result = streamText({
        model: openrouter.chat('arcee-ai/trinity-large-preview:free'),
        system: systemMessage,
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
