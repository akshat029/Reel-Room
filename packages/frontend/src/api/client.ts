const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    headers?: Record<string, string>;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'API request failed');
    }

    return data.data as T;
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
