const getRedirectUri = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://xbookmarks.chat/api/auth/callback';
  }
  return 'http://localhost:3000/api/auth/callback';
};

export const X_CONFIG = {
  CLIENT_ID: process.env.CLIENT_ID!,
  CLIENT_SECRET: process.env.CLIENT_SECRET!,
  REDIRECT_URI: getRedirectUri(),
  AUTH_URL: 'https://twitter.com/i/oauth2/authorize',
  TOKEN_URL: 'https://api.twitter.com/2/oauth2/token',
  USER_INFO_URL: 'https://api.twitter.com/2/users/me',
  // Scopes required for basic login and reading user profile
  SCOPES: ['tweet.read', 'users.read', 'bookmark.read', 'offline.access'],
};
