import { NextRequest, NextResponse } from 'next/server';

const MAX_BOOKMARKS = 500;
const BASE_URL = 'https://api.twitter.com/2/users';
const FIELDS = 'tweet.fields=created_at,author_id,text&expansions=author_id&user.fields=name,username&max_results=100';

export async function POST(request: NextRequest) {
    const accessToken = request.cookies.get('access_token')?.value;
    if (!accessToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionCookie = request.cookies.get('user_session')?.value;
    if (!sessionCookie) {
        return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    let userId: string;
    try {
        const userData = JSON.parse(decodeURIComponent(sessionCookie));
        userId = userData.data?.id;
        if (!userId) throw new Error('No user ID');
    } catch {
        return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const allTweets: any[] = [];
            const allUsers: any[] = [];
            let paginationToken: string | undefined;

            try {
                while (allTweets.length < MAX_BOOKMARKS) {
                    let url = `${BASE_URL}/${userId}/bookmarks?${FIELDS}`;
                    if (paginationToken) url += `&pagination_token=${paginationToken}`;

                    const res = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error('Bookmarks sync error:', res.status, errorText);
                        controller.enqueue(encoder.encode(JSON.stringify({ error: 'Failed to fetch bookmarks', status: res.status }) + '\n'));
                        controller.close();
                        return;
                    }

                    const page = await res.json();
                    if (page.data) allTweets.push(...page.data);
                    if (page.includes?.users) {
                        for (const user of page.includes.users) {
                            if (!allUsers.find((u: any) => u.id === user.id)) {
                                allUsers.push(user);
                            }
                        }
                    }

                    // Send progress
                    controller.enqueue(encoder.encode(JSON.stringify({ progress: allTweets.length }) + '\n'));

                    paginationToken = page.meta?.next_token;
                    if (!paginationToken || !page.data?.length) break;
                }

                const result = {
                    lastSynced: new Date().toISOString(),
                    data: allTweets,
                    includes: { users: allUsers },
                };

                controller.enqueue(encoder.encode(JSON.stringify({ done: true, ...result }) + '\n'));
                controller.close();
            } catch (e: any) {
                controller.enqueue(encoder.encode(JSON.stringify({ error: e.message }) + '\n'));
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson' },
    });
}
