// ==========================================
// ReelRoom Shared Types
// ==========================================

// User and Authentication Types
export type UserRole = 'host' | 'cohost' | 'participant' | 'guest';

export interface User {
    id: string;
    provider?: 'google' | 'github' | 'guest';
    providerId?: string;
    displayName: string;
    avatarUrl?: string;
    createdAt: Date;
}

export interface Participant {
    id: string;
    displayName: string;
    role: UserRole;
    avatarUrl?: string;
    joinedAt: Date;
    isMuted?: boolean;
}

// Room Types
export interface RoomSettings {
    allowChat: boolean;
    allowReactions: boolean;
    maxParticipants: number;
    isPrivate: boolean;
}

export interface Room {
    id: string;
    code: string;
    hostId: string;
    hostName: string;
    settings: RoomSettings;
    createdAt: Date;
    closedAt?: Date;
}

export interface RoomState {
    room: Room;
    participants: Participant[];
    queue: QueueItem[];
    playbackState: PlaybackState;
    chatMessages: ChatMessage[];
}

// Queue Types
export interface QueueItem {
    id: string;
    reelUrl: string;
    embedHtml?: string;
    thumbnailUrl?: string;
    title?: string;
    addedBy: string;
    addedByName: string;
    position: number;
    addedAt: Date;
}

// Playback Types
export type ContentMode = 'embed' | 'screenshare' | 'none';

export interface PlaybackState {
    mode: ContentMode;
    currentItemId: string | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    timestamp: number; // For latency compensation
}

// Chat Types
export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    timestamp: Date;
    type: 'message' | 'system' | 'reaction';
}

export interface Reaction {
    id: string;
    emoji: string;
    senderId: string;
    senderName: string;
    timestamp: Date;
}

// oEmbed Types
export interface OEmbedResponse {
    version: string;
    title?: string;
    author_name?: string;
    author_url?: string;
    provider_name: string;
    provider_url: string;
    type: string;
    width?: number;
    height?: number;
    html: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
}

// API Request/Response Types
export interface CreateRoomRequest {
    hostName: string;
    settings?: Partial<RoomSettings>;
}

export interface CreateRoomResponse {
    room: Room;
    token: string;
}

export interface JoinRoomRequest {
    displayName: string;
}

export interface JoinRoomResponse {
    room: Room;
    participant: Participant;
    token: string;
}

export interface AddToQueueRequest {
    reelUrl: string;
}

export interface FetchOEmbedRequest {
    url: string;
}

// WebSocket Message Types
export type WSMessageType =
    | 'join'
    | 'leave'
    | 'participant_joined'
    | 'participant_left'
    | 'participant_update'
    | 'playback_sync'
    | 'playback_control'
    | 'chat'
    | 'reaction'
    | 'queue_update'
    | 'queue_add'
    | 'queue_remove'
    | 'queue_reorder'
    | 'moderation'
    | 'rtc_offer'
    | 'rtc_answer'
    | 'rtc_ice'
    | 'media_state'
    | 'error'
    | 'room_closed';

export interface WSMessage {
    type: WSMessageType;
    payload: unknown;
    timestamp: number;
}

// Specific WebSocket Messages
export interface JoinMessage {
    type: 'join';
    payload: {
        roomCode: string;
        displayName: string;
        token?: string;
    };
}

export interface PlaybackSyncMessage {
    type: 'playback_sync';
    payload: PlaybackState;
}

export interface PlaybackControlMessage {
    type: 'playback_control';
    payload: {
        action: 'play' | 'pause' | 'seek' | 'next' | 'previous';
        value?: number;
    };
}

export interface ChatMessageWS {
    type: 'chat';
    payload: {
        content: string;
    };
}

export interface ReactionMessage {
    type: 'reaction';
    payload: {
        emoji: string;
    };
}

export interface QueueUpdateMessage {
    type: 'queue_update';
    payload: {
        queue: QueueItem[];
    };
}

export interface ParticipantUpdateMessage {
    type: 'participant_update';
    payload: {
        participants: Participant[];
    };
}

export interface RTCOfferMessage {
    type: 'rtc_offer';
    payload: {
        sdp: string;
        targetId?: string;
    };
}

export interface RTCAnswerMessage {
    type: 'rtc_answer';
    payload: {
        sdp: string;
        targetId: string;
    };
}

export interface RTCIceMessage {
    type: 'rtc_ice';
    payload: {
        candidate: object;
        targetId: string;
    };
}

export interface ModerationMessage {
    type: 'moderation';
    payload: {
        action: 'mute' | 'unmute' | 'kick' | 'promote' | 'demote';
        targetId: string;
    };
}

export interface ErrorMessage {
    type: 'error';
    payload: {
        code: string;
        message: string;
    };
}

// Utility Types
export type ApiResponse<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: {
        code: string;
        message: string;
    };
};

// Room Code Utilities
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars

export function generateRoomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
}

export function isValidRoomCode(code: string): boolean {
    if (code.length !== ROOM_CODE_LENGTH) return false;
    return code.split('').every(char => ROOM_CODE_CHARS.includes(char));
}

// Instagram URL Utilities
export const INSTAGRAM_REEL_REGEX = /^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/;

export function isValidInstagramUrl(url: string): boolean {
    return INSTAGRAM_REEL_REGEX.test(url);
}

export function extractReelId(url: string): string | null {
    const match = url.match(INSTAGRAM_REEL_REGEX);
    return match ? match[1] : null;
}

// Time Sync Utilities
export function calculateLatencyOffset(serverTime: number, clientTime: number): number {
    return serverTime - clientTime;
}

export function adjustPlaybackTime(
    hostTime: number,
    hostTimestamp: number,
    currentTimestamp: number,
    latencyOffset: number
): number {
    const elapsed = (currentTimestamp - hostTimestamp) / 1000;
    return hostTime + elapsed;
}
