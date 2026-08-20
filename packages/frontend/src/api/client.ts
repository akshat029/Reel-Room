const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    headers?: Record<string, string>;
}

// fetch() only rejects when the request never completed at all: the API is
// unreachable or asleep, the browser blocked it as mixed content, or the CORS
// check failed. The browser reports every one of those as the same opaque
// 'Failed to fetch', so translate it into something actionable.
async function sendRequest(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch {
        if (!API_URL) {
            throw new Error(
                'VITE_API_URL is not set, so this request went to the web app instead of the API server. Set it to the backend URL and redeploy.'
            );
        }

        if (API_URL.startsWith('http://') && window.location.protocol === 'https:') {
            throw new Error(
                `Blocked an insecure request to ${API_URL} from an HTTPS page. VITE_API_URL must use https:// - update it and redeploy.`
            );
        }

        throw new Error(
            `Could not reach the API at ${API_URL}. It may still be waking up (free instances take up to a minute), or its CORS_ORIGIN may not allow ${window.location.origin}.`
        );
    }
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const response = await sendRequest(`${API_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Read the body as text first. Error pages from Vercel, Render or a proxy
    // are HTML, and calling response.json() on those throws a SyntaxError that
    // hides the actual status code.
    const raw = await response.text();
    let payload: any = {};

    if (raw) {
        try {
            payload = JSON.parse(raw);
        } catch {
            throw new Error(
                `The API returned a non-JSON response (HTTP ${response.status}) from ${API_URL}${endpoint}.`
            );
        }
    }

    if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || `API request failed (HTTP ${response.status})`);
    }

    return payload.data as T;
}

// Room API
export interface CreateRoomResult {
    room: {
        id: string;
        code: string;
        hostId: string;
        hostName: string;
        settings: {
            allowChat: boolean;
            allowReactions: boolean;
            maxParticipants: number;
            isPrivate: boolean;
        };
        createdAt: string;
    };
    token: string;
    participantId: string;
}

export const roomApi = {
    create: (hostName: string, settings?: object) =>
        api<CreateRoomResult>('/api/rooms', { method: 'POST', body: { hostName, settings } }),

    get: (code: string) =>
        api<{ room: CreateRoomResult['room']; participantCount: number; hasQueue: boolean }>(`/api/rooms/${code}`),

    join: (code: string, displayName: string) =>
        api<CreateRoomResult & { participants: unknown[]; queue: unknown[]; playbackState: unknown }>(`/api/rooms/${code}/join`, { method: 'POST', body: { displayName } }),

    getQueue: (code: string) =>
        api<{ queue: unknown[] }>(`/api/rooms/${code}/queue`),

    addToQueue: (code: string, reelUrl: string, addedBy: string, addedByName: string) =>
        api<{ item: unknown; queue: unknown[] }>(`/api/rooms/${code}/queue`, {
            method: 'POST',
            body: { reelUrl, addedBy, addedByName }
        }),

    removeFromQueue: (code: string, itemId: string) =>
        api<{ queue: unknown[] }>(`/api/rooms/${code}/queue/${itemId}`, { method: 'DELETE' }),

    getParticipants: (code: string) =>
        api<{ participants: unknown[] }>(`/api/rooms/${code}/participants`),
};

// oEmbed API
export interface OEmbedResult {
    html: string;
    thumbnail?: string;
    title?: string;
    author?: string;
    cached?: boolean;
    fallback?: boolean;
}

export const oembedApi = {
    fetch: (url: string) =>
        api<OEmbedResult>('/api/oembed', { method: 'POST', body: { url } }),
};
