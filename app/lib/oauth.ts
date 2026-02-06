import crypto from 'crypto';

/**
 * Generates a random string for state and code_verifier
 */
export function generateRandomString(length: number = 64): string {
    return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generates the code_challenge from the code_verifier using S256
 */
export function generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Parses the Basic Auth header value for the token endpoint
 */
export function getBasicAuthHeader(clientId: string, clientSecret: string): string {
    return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}
