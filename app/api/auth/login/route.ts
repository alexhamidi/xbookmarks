import { NextRequest, NextResponse } from 'next/server';
import { X_CONFIG } from '@/app/lib/config';
import { generateRandomString, generateCodeChallenge } from '@/app/lib/oauth';

export async function GET() {
    const state = generateRandomString();
    const codeVerifier = generateRandomString();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: X_CONFIG.CLIENT_ID,
        redirect_uri: X_CONFIG.REDIRECT_URI,
        scope: X_CONFIG.SCOPES.join(' '),
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    const url = `${X_CONFIG.AUTH_URL}?${params.toString()}`;

    const response = NextResponse.redirect(url);

    // Store state and codeVerifier in HTTP-only cookies
    response.cookies.set('oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });
    response.cookies.set('code_verifier', codeVerifier, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/' });

    return response;
}
