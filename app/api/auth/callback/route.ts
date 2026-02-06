import { NextRequest, NextResponse } from 'next/server';
import { X_CONFIG } from '@/app/lib/config';
import { getBasicAuthHeader } from '@/app/lib/oauth';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const storedState = request.cookies.get('oauth_state')?.value;
    const codeVerifier = request.cookies.get('code_verifier')?.value;

    if (!code || !state || !storedState || !codeVerifier) {
        return NextResponse.json({ error: 'Invalid request or missing cookies' }, { status: 400 });
    }

    if (state !== storedState) {
        return NextResponse.json({ error: 'State mismatch' }, { status: 400 });
    }

    try {
        const response = await fetch(X_CONFIG.TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': getBasicAuthHeader(X_CONFIG.CLIENT_ID, X_CONFIG.CLIENT_SECRET),
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: X_CONFIG.CLIENT_ID,
                redirect_uri: X_CONFIG.REDIRECT_URI,
                code_verifier: codeVerifier,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token Exchange Error:', errorText);
            return NextResponse.json({ error: 'Failed to exchange token', details: errorText }, { status: response.status });
        }

        const tokens = await response.json();

        // In a real app, you would create a session here.
        // For this simple example, we'll confirm the login by fetching the user and showing it.

        const userResponse = await fetch(X_CONFIG.USER_INFO_URL, {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`
            }
        });

        if (!userResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch user info' }, { status: userResponse.status });
        }

        const userData = await userResponse.json();
        const userId = userData.data?.id;

        // Fetch the user's most recent 4 bookmarks
        if (userId) {
            try {
                const bookmarksRes = await fetch(
                    `https://api.twitter.com/2/users/${userId}/bookmarks?max_results=4&tweet.fields=created_at,author_id,text`,
                    { headers: { 'Authorization': `Bearer ${tokens.access_token}` } }
                );
                if (bookmarksRes.ok) {
                    const bookmarksData = await bookmarksRes.json();
                    const fileContent = {
                        lastSynced: new Date().toISOString(),
                        ...bookmarksData
                    };
                    const filePath = path.join(process.cwd(), 'data', 'bookmarks.json');
                    await writeFile(filePath, JSON.stringify(fileContent, null, 2), 'utf-8');
                }
            } catch (e) {
                console.error('Failed to fetch bookmarks:', e);
            }
        }

        const res = NextResponse.redirect(new URL('/', request.url));
        res.cookies.set('user_session', JSON.stringify(userData), { httpOnly: false, path: '/' });

        // Clear oauth cookies
        res.cookies.delete('oauth_state');
        res.cookies.delete('code_verifier');

        return res;

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
