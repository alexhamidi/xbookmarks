import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { readFile } from 'fs/promises';
import path from 'path';

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

    const systemMessage = bookmarks?.data
        ? `You are a helpful assistant that knows about the user's X/Twitter bookmarks. Here are their most recent bookmarks:\n\n${JSON.stringify(bookmarks.data, null, 2)}\n\nUse this information to answer questions about their bookmarks. Be concise and helpful.\n\nIMPORTANT: At the very end of every response, you MUST include a line listing the tweet IDs of any bookmarks you referenced or that are relevant to your answer. Use this exact format on its own line:\n<<REFS>>id1,id2,id3<</REFS>>\n\nIf no bookmarks are relevant, output <<REFS>><</REFS>> with nothing between the tags. Never skip this line.`
        : 'You are a helpful assistant. The user has no bookmarks loaded.';

    console.log(systemMessage);

    const result = streamText({
        model: openrouter.chat('arcee-ai/trinity-large-preview:free'),
        system: systemMessage,
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
