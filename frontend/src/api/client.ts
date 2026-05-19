const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const OPENAI_KEY_STORAGE = 'openaiApiKey';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const openAiKey = localStorage.getItem(OPENAI_KEY_STORAGE);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(openAiKey ? { 'X-OpenAI-Api-Key': openAiKey } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `Request failed: ${response.status}`;

    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) {
        message = parsed.message.join(', ');
      } else if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // Keep the raw text when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
