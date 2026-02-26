# X Bookmarks Chat

An AI-powered chat interface for your X/Twitter bookmarks. Sync your bookmarks and have natural language conversations to discover, search, and analyze your saved content.

## Features

- **Twitter/X Integration** - Secure OAuth authentication and bookmark syncing
- **AI-Powered Chat** - Natural language queries about your bookmarks
- **Smart References** - Referenced tweets display inline in responses  
- **Real-time Sync** - Stream bookmark data with progress updates
- **Rate Limit Handling** - Automatic retries with exponential backoff
- **Local Persistence** - Saves chat history and bookmarks locally

## Getting Started

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/alexhamidi/x-bookmarks-chat.git
   cd x-bookmarks-chat
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file with your Twitter API credentials:
   ```env
   CLIENT_ID=your_twitter_client_id
   CLIENT_SECRET=your_twitter_client_secret
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** and sign in with X/Twitter

## Example Queries

- "Find all bookmarks relating to personal projects people built"
- "Find me the best articles I've bookmarked"
- "Is there anything time sensitive in my bookmarks?"
- "Show me bookmarks about AI and machine learning"

## Tech Stack

- **Next.js 16** with App Router
- **React 19** with TypeScript
- **AI SDK** for streaming chat responses
- **OpenRouter** for AI model access
- **Twitter API v2** for bookmark data
- **Tailwind CSS** for styling

## API Setup

### Twitter API
1. Create a Twitter Developer account
2. Create a new app with OAuth 2.0 enabled
3. Add `http://localhost:3000/api/auth/callback` as a redirect URI
4. Copy your Client ID and Client Secret

### OpenRouter API
1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Get your API key from the dashboard
3. Add it to your environment variables

## License

MIT License - see [LICENSE](LICENSE) for details.
