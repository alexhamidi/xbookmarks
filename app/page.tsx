'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { Toaster, toast } from 'sonner';

function parseRefs(text: string): { cleanText: string; tweetIds: string[] } {
  const match = text.match(/<<REFS>>([\s\S]*?)<<\/REFS>>/);
  if (!match) {
    // Also strip any partial/opening tag that might appear while streaming
    const cleaned = text.replace(/<<REFS>>[\s\S]*$/, '').trimEnd();
    return { cleanText: cleaned, tweetIds: [] };
  }
  const ids = match[1].split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s));
  const cleanText = text.replace(/<<REFS>>[\s\S]*?<<\/REFS>>/, '').trimEnd();
  return { cleanText, tweetIds: ids };
}

function TweetEmbed({ tweetId }: { tweetId: string }) {
  const [height, setHeight] = useState(250);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== 'https://platform.twitter.com') return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data['twttr.embed']?.id && data['twttr.embed']?.method === 'twttr.private.resize') {
          const params = data['twttr.embed'].params;
          if (params?.[0]?.height) setHeight(Math.min(params[0].height, 350));
        }
      } catch { }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <iframe
      src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&chrome=nofooter&maxHeight=350`}
      className="max-w-sm flex-shrink-0 rounded-xl border border-neutral-700/50 overflow-hidden"
      style={{ height }}
      allowFullScreen
      frameBorder="0"
      scrolling="no"
    />
  );
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [bookmarks, setBookmarks] = useState<any>(null);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const { messages, sendMessage, setMessages, status } = useChat({ id: 'main' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_messages');
      if (saved) setMessages(JSON.parse(saved));
    } catch { }
  }, []);

  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };
    const session = getCookie('user_session');
    if (session) {
      try {
        setUser(JSON.parse(decodeURIComponent(session)));
      } catch (e) {
        console.error('Failed to parse user session', e);
      }
    }
    setAuthChecked(true);
  }, []);

  // Load cached bookmarks on login
  useEffect(() => {
    if (!user) return;
    fetch('/api/bookmarks')
      .then((res) => res.json())
      .then((data) => { if (data?.data) setBookmarks(data); })
      .catch(() => { });
  }, [user]);

  const attemptSync = async (): Promise<{ rateLimited: boolean }> => {
    const res = await fetch('/api/bookmarks/sync', { method: 'POST' });
    if (!res.ok || !res.body) {
      throw new Error('Sync failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);

        if (msg.error) {
          if (msg.status === 429) return { rateLimited: true };
          throw new Error(msg.error);
        }

        if (msg.progress) {
          setSyncStatus(`Syncing bookmarks — ${msg.progress} synced`);
        }

        if (msg.done) {
          setBookmarks(msg);
          toast.success(`Synced ${msg.data?.length ?? 0} bookmarks`);
        }
      }
    }
    return { rateLimited: false };
  };

  const handleSync = async () => {
    setBookmarksLoading(true);
    setSyncStatus('Syncing bookmarks...');

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { rateLimited } = await attemptSync();
        if (!rateLimited) {
          setBookmarksLoading(false);
          setSyncStatus('');
          return;
        }
        if (attempt === 4) {
          toast.error('Rate limited — please try again later');
          break;
        }
        const wait = Math.min(2 ** attempt * 3, 30);
        for (let s = wait; s > 0; s--) {
          setSyncStatus(`Rate limited — retrying in ${s}s...`);
          await new Promise(r => setTimeout(r, 1000));
        }
        setSyncStatus('Syncing bookmarks...');
      } catch (e: any) {
        toast.error(e.message || 'Failed to sync bookmarks');
        break;
      }
    }

    setBookmarksLoading(false);
    setSyncStatus('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      localStorage.setItem('chat_messages', JSON.stringify(messages));
    }
  }, [isLoading, messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [chatInput]);

  useEffect(() => {
    if (user && bookmarks?.data && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [user, bookmarks]);

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  const handleLogout = () => {
    document.cookie = 'user_session=; Max-Age=0; path=/;';
    setUser(null);
    setBookmarks(null);
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem('chat_messages');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;
    sendMessage({ text: chatInput });
    setChatInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!authChecked) {
    return <div className="flex min-h-screen bg-[#141414]" />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-[#141414] text-white">
        <h1 className="text-4xl font-bold mb-8 flex items-center gap-2">Chat with your <svg viewBox="0 0 24 24" className="w-9 h-9 fill-current inline-block"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> Bookmarks</h1>
        <div className="text-center">
          <button
            onClick={handleLogin}
            className="px-8 py-4 bg-white text-black text-xl rounded-full hover:bg-gray-200 transition shadow-lg flex items-center gap-3 mx-auto"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Sign in with X
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-white">
      <Toaster theme="dark" />
      {/* Top bar */}
      <header className="flex items-center justify-end px-6 py-3 gap-4">
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="text-xs text-neutral-500 hover:text-white transition"
          >
            Clear chat
          </button>
        )}

        {/* Bookmarks indicator */}
        <div className="flex items-center gap-1.5">

          {bookmarksLoading ? (
            <span className="text-xs text-neutral-500 italic">{syncStatus || 'Syncing bookmarks...'}</span>
          ) : bookmarks?.data ? (
            <span className="text-xs text-neutral-500 italic">
              {bookmarks.data.length} bookmarks · last synced {new Date(bookmarks.lastSynced).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : (
            <button
              onClick={handleSync}
              className="text-xs text-neutral-400 hover:text-white transition"
            >
              Sync bookmarks
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">@{user.data?.username}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-neutral-500 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8" >
            <div className="space-y-2 w-[70vw]">
              <h2 className="text-8xl font-semibold tracking-tight text-white/90">
                {bookmarks?.data ? `You have ${bookmarks.data.length} bookmarks. Let’s make some sense out of them.` : 'Sync your bookmarks to get started'}
              </h2>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
            {messages.map((message) => {
              // For AI messages, parse out bookmark refs
              const fullText = message.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map(p => p.text)
                .join('');
              const isAI = message.role === 'assistant';
              const { cleanText, tweetIds } = isAI ? parseRefs(fullText) : { cleanText: fullText, tweetIds: [] };

              return (
                <div key={message.id}>
                  <div className={message.role === 'user' ? 'flex justify-center' : ''}>
                    <div className={`text-[15px] leading-[1.7] whitespace-pre-wrap break-words ${message.role === 'user'
                      ? 'bg-[#2a2a2a] border border-neutral-700/50 text-neutral-100 px-4 py-2.5 rounded-2xl max-w-[85%] inline-block'
                      : 'text-neutral-200'
                      }`}>
                      {cleanText}
                    </div>
                  </div>
                  {tweetIds.length > 0 && (
                    <div className="tweet-scroll mt-3 flex gap-2 overflow-x-auto">
                      {tweetIds.map((id) => (
                        <TweetEmbed key={id} tweetId={id} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div>
                <div className="flex gap-1.5 py-1">
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-6 pb-8 pt-3">
        {messages.length === 0 && (
          <div className="max-w-3xl mx-auto w-full flex flex-wrap gap-2 mb-3 justify-center">
            {[
              'Find all bookmarks relating to personal projects people built',
              'Find me the best articles I\'ve bookmarked',
              'Is there anything time sensitive (events, internship applications) in my bookmarks?',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => sendMessage({ text: suggestion })}
                className="text-[13px] text-neutral-400 border border-neutral-700/50 rounded-full px-4 py-2 hover:border-neutral-500 hover:text-neutral-200 transition-all duration-150"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto w-full"
        >
          <div className="relative rounded-2xl border border-neutral-700/50 bg-[#1e1e1e] focus-within:border-neutral-600 focus-within:bg-[#212121] transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={chatInput}
              autoFocus
              disabled={!bookmarks?.data}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={bookmarks?.data ? "Ask anything..." : "Sync bookmarks to get started"}
              rows={2}
              className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 pl-5 pr-14 pt-4 pb-4 text-[15px] leading-relaxed resize-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="absolute bottom-3 right-3">
              <button
                type="submit"
                disabled={!chatInput.trim() || isLoading}
                className="w-9 h-9 rounded-full bg-neutral-500 text-white flex items-center justify-center disabled:opacity-20 disabled:cursor-not-allowed hover:bg-neutral-400 active:scale-95 transition-all duration-150"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
