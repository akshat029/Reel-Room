import {
    Room,
    RoomState,
    RoomSettings,
    Participant,
    QueueItem,
    PlaybackState,
    ChatMessage,
    generateRoomCode,
} from '@reelroom/shared';
import { v4 as uuidv4 } from 'uuid';

// In-memory store for development
// Replace with Redis/PostgreSQL for production
class Store {
    private rooms: Map<string, RoomState> = new Map();
    private roomsByCode: Map<string, string> = new Map(); // code -> roomId
    private oembedCache: Map<string, { html: string; expiresAt: number }> = new Map();

    // Room Operations
    createRoom(hostId: string, hostName: string, settings?: Partial<RoomSettings>): Room {
        const id = uuidv4();
        let code = generateRoomCode();

        // Ensure unique code
        while (this.roomsByCode.has(code)) {
            code = generateRoomCode();
        }

        const room: Room = {
            id,
            code,
            hostId,
            hostName,
            createdAt: new Date(),
            settings: {
                allowChat: true,
                allowReactions: true,
                maxParticipants: 50,
                isPrivate: false,
                ...settings,
            },
        };

        const initialState: RoomState = {
            room,
            participants: [{
                id: hostId,
                displayName: hostName,
                role: 'host',
                joinedAt: new Date(),
            }],
            queue: [],
            playbackState: {
                mode: 'none',
                currentItemId: null,
                isPlaying: false,
                currentTime: 0,
                duration: 0,
                timestamp: Date.now(),
            },
            chatMessages: [],
        };

        this.rooms.set(id, initialState);
        this.roomsByCode.set(code, id);

        return room;
    }

    getRoomByCode(code: string): RoomState | undefined {
        const roomId = this.roomsByCode.get(code.toUpperCase());
        if (!roomId) return undefined;
        return this.rooms.get(roomId);
    }

    getRoomById(id: string): RoomState | undefined {
        return this.rooms.get(id);
    }

    deleteRoom(roomId: string): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        this.roomsByCode.delete(state.room.code);
        this.rooms.delete(roomId);
        return true;
    }

    // Participant Operations
    addParticipant(roomId: string, participant: Participant): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        // Check max participants
        if (state.participants.length >= state.room.settings.maxParticipants) {
            return false;
        }

        // Check if already exists
        const existing = state.participants.find(p => p.id === participant.id);
        if (existing) {
            // Update existing
            Object.assign(existing, participant);
        } else {
            state.participants.push(participant);
        }

        return true;
    }

    removeParticipant(roomId: string, participantId: string): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        state.participants = state.participants.filter(p => p.id !== participantId);
        return true;
    }

    getParticipants(roomId: string): Participant[] {
        const state = this.rooms.get(roomId);
        return state?.participants || [];
    }

    updateParticipant(roomId: string, participantId: string, updates: Partial<Participant>): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        const participant = state.participants.find(p => p.id === participantId);
        if (!participant) return false;

        Object.assign(participant, updates);
        return true;
    }

    // Queue Operations
    addToQueue(roomId: string, item: QueueItem): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        item.position = state.queue.length;
        state.queue.push(item);
        return true;
    }

    removeFromQueue(roomId: string, itemId: string): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        state.queue = state.queue.filter(q => q.id !== itemId);
        // Recalculate positions
        state.queue.forEach((q, i) => q.position = i);
        return true;
    }

    reorderQueue(roomId: string, itemId: string, newPosition: number): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        const itemIndex = state.queue.findIndex(q => q.id === itemId);
        if (itemIndex === -1) return false;

        const [item] = state.queue.splice(itemIndex, 1);
        state.queue.splice(newPosition, 0, item);
        state.queue.forEach((q, i) => q.position = i);

        return true;
    }

    getQueue(roomId: string): QueueItem[] {
        const state = this.rooms.get(roomId);
        return state?.queue || [];
    }

    // Playback Operations
    updatePlaybackState(roomId: string, playbackState: Partial<PlaybackState>): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        state.playbackState = {
            ...state.playbackState,
            ...playbackState,
            timestamp: Date.now(),
        };
        return true;
    }

    getPlaybackState(roomId: string): PlaybackState | undefined {
        const state = this.rooms.get(roomId);
        return state?.playbackState;
    }

    // Chat Operations
    addChatMessage(roomId: string, message: ChatMessage): boolean {
        const state = this.rooms.get(roomId);
        if (!state) return false;

        state.chatMessages.push(message);

        // Keep only last 100 messages in memory
        if (state.chatMessages.length > 100) {
            state.chatMessages = state.chatMessages.slice(-100);
        }

        return true;
    }

    getChatMessages(roomId: string, limit = 50): ChatMessage[] {
        const state = this.rooms.get(roomId);
        return state?.chatMessages.slice(-limit) || [];
    }

    // oEmbed Cache
    cacheOEmbed(url: string, html: string, ttlSeconds = 3600): void {
        this.oembedCache.set(url, {
            html,
            expiresAt: Date.now() + (ttlSeconds * 1000),
        });
    }

    getCachedOEmbed(url: string): string | undefined {
        const cached = this.oembedCache.get(url);
        if (!cached) return undefined;
        if (Date.now() > cached.expiresAt) {
            this.oembedCache.delete(url);
            return undefined;
        }
        return cached.html;
    }

    // Cleanup expired rooms (call periodically)
    cleanupExpiredRooms(maxAgeMs = 24 * 60 * 60 * 1000): number {
        let deleted = 0;
        const now = Date.now();

        for (const [id, state] of this.rooms.entries()) {
            const age = now - new Date(state.room.createdAt).getTime();
            if (age > maxAgeMs && state.participants.length === 0) {
                this.roomsByCode.delete(state.room.code);
                this.rooms.delete(id);
                deleted++;
            }
        }

        return deleted;
    }
}

// Singleton instance
export const store = new Store();
