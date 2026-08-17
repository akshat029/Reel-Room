import { WebSocket, WebSocketServer as WSServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { store } from '../store.js';
import type {
    WSMessage,
    ChatMessage,
    PlaybackState,
    Participant,
    QueueItem,
} from '@reelroom/shared';

interface AuthenticatedSocket extends WebSocket {
    id: string;
    userId: string;
    roomId: string;
    roomCode: string;
    displayName: string;
    role: 'host' | 'cohost' | 'participant' | 'guest';
    isAlive: boolean;
}

export class WebSocketServer {
    private wss: WSServer;
    private clients: Map<string, AuthenticatedSocket> = new Map();
    private roomClients: Map<string, Set<string>> = new Map(); // roomId -> Set of client IDs

    constructor(server: Server) {
        this.wss = new WSServer({ server, path: '/ws' });
        this.setupServer();
        this.startHeartbeat();
        console.log('🔌 WebSocket server initialized');
    }

    private setupServer() {
        this.wss.on('connection', (ws: WebSocket, req) => {
            const socket = ws as AuthenticatedSocket;
            socket.id = uuidv4();
            socket.isAlive = true;

            console.log(`New connection: ${socket.id}`);

            socket.on('pong', () => {
                socket.isAlive = true;
            });

            socket.on('message', (data) => {
                try {
                    const message: WSMessage = JSON.parse(data.toString());
                    this.handleMessage(socket, message);
                } catch (error) {
                    console.error('Failed to parse message:', error);
                    this.sendError(socket, 'INVALID_MESSAGE', 'Invalid message format');
                }
            });

            socket.on('close', () => {
                this.handleDisconnect(socket);
            });

            socket.on('error', (error) => {
                console.error(`Socket error ${socket.id}:`, error);
            });
        });
    }

    private startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const socket = ws as AuthenticatedSocket;
                if (!socket.isAlive) {
                    this.handleDisconnect(socket);
                    return socket.terminate();
                }
                socket.isAlive = false;
                socket.ping();
            });
        }, 30000);
    }

    private handleMessage(socket: AuthenticatedSocket, message: WSMessage) {
        switch (message.type) {
            case 'join':
                this.handleJoin(socket, message.payload as { roomCode: string; displayName: string; token?: string });
                break;
            case 'leave':
                this.handleLeave(socket);
                break;
            case 'playback_sync':
                this.handlePlaybackSync(socket, message.payload as PlaybackState);
                break;
            case 'playback_control':
                this.handlePlaybackControl(socket, message.payload as { action: string; value?: number });
                break;
            case 'chat':
                this.handleChat(socket, message.payload as { content: string });
                break;
            case 'reaction':
                this.handleReaction(socket, message.payload as { emoji: string });
                break;
            case 'queue_add':
                this.handleQueueAdd(socket, message.payload as { reelUrl: string; embedHtml?: string; title?: string; thumbnailUrl?: string });
                break;
            case 'queue_remove':
                this.handleQueueRemove(socket, message.payload as { itemId: string });
                break;
            case 'queue_reorder':
                this.handleQueueReorder(socket, message.payload as { itemId: string; newPosition: number });
                break;
            case 'rtc_offer':
            case 'rtc_answer':
            case 'rtc_ice':
                this.handleRTCSignaling(socket, message);
                break;
            case 'media_state':
                // Host broadcasts which live media (screen/camera/mic) is active.
                if (socket.roomId) {
                    this.broadcastToRoom(socket.roomId, message, socket.id);
                }
                break;
            case 'moderation':
                this.handleModeration(socket, message.payload as { action: string; targetId: string });
                break;
            default:
                this.sendError(socket, 'UNKNOWN_MESSAGE', `Unknown message type: ${message.type}`);
        }
    }

    private handleJoin(socket: AuthenticatedSocket, payload: { roomCode: string; displayName: string; token?: string }) {
        const { roomCode, displayName, token } = payload;

        const roomState = store.getRoomByCode(roomCode.toUpperCase());
        if (!roomState) {
            return this.sendError(socket, 'ROOM_NOT_FOUND', 'Room not found');
        }

        // Verify token if provided
        let userId = uuidv4();
        let role: 'host' | 'cohost' | 'participant' | 'guest' = 'participant';

        if (token) {
            try {
                const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; roomId: string; role: string };
                userId = decoded.userId;
                role = decoded.role as typeof role;
            } catch {
                // Invalid token, treat as guest
                role = 'guest';
            }
        }

        // Set socket properties
        socket.userId = userId;
        socket.roomId = roomState.room.id;
        socket.roomCode = roomCode.toUpperCase();
        socket.displayName = displayName;
        socket.role = role;

        // Register client
        this.clients.set(socket.id, socket);

        // Add to room clients
        if (!this.roomClients.has(roomState.room.id)) {
            this.roomClients.set(roomState.room.id, new Set());
        }
        this.roomClients.get(roomState.room.id)!.add(socket.id);

        // Add/update participant in store
        const participant: Participant = {
            id: userId,
            displayName,
            role,
            joinedAt: new Date(),
        };
        store.addParticipant(roomState.room.id, participant);

        // Send room state to the joining client
        this.send(socket, {
            type: 'join',
            payload: {
                success: true,
                room: roomState.room,
                participants: store.getParticipants(roomState.room.id),
                queue: store.getQueue(roomState.room.id),
                playbackState: store.getPlaybackState(roomState.room.id),
                messages: store.getChatMessages(roomState.room.id, 50),
                yourId: userId,
                yourRole: role,
            },
            timestamp: Date.now(),
        });

        // Notify others
        this.broadcastToRoom(roomState.room.id, {
            type: 'participant_joined',
            payload: { participant },
            timestamp: Date.now(),
        }, socket.id);

        console.log(`${displayName} joined room ${roomCode}`);
    }

    private handleLeave(socket: AuthenticatedSocket) {
        if (!socket.roomId) return;

        store.removeParticipant(socket.roomId, socket.userId);

        // Notify others
        this.broadcastToRoom(socket.roomId, {
            type: 'participant_left',
            payload: { userId: socket.userId, displayName: socket.displayName },
            timestamp: Date.now(),
        }, socket.id);

        // Remove from room clients
        this.roomClients.get(socket.roomId)?.delete(socket.id);
        this.clients.delete(socket.id);

        console.log(`${socket.displayName} left room ${socket.roomCode}`);
    }

    private handleDisconnect(socket: AuthenticatedSocket) {
        if (socket.roomId) {
            store.removeParticipant(socket.roomId, socket.userId);

            this.broadcastToRoom(socket.roomId, {
                type: 'participant_left',
                payload: { userId: socket.userId, displayName: socket.displayName },
                timestamp: Date.now(),
            }, socket.id);

            this.roomClients.get(socket.roomId)?.delete(socket.id);
        }

        this.clients.delete(socket.id);
        console.log(`Connection closed: ${socket.id}`);
    }

    private handlePlaybackSync(socket: AuthenticatedSocket, playbackState: PlaybackState) {
        if (!socket.roomId) return;
        if (socket.role !== 'host' && socket.role !== 'cohost') {
            return this.sendError(socket, 'UNAUTHORIZED', 'Only host or cohost can sync playback');
        }

        store.updatePlaybackState(socket.roomId, playbackState);

        this.broadcastToRoom(socket.roomId, {
            type: 'playback_sync',
            payload: { ...playbackState, timestamp: Date.now() },
            timestamp: Date.now(),
        });
    }

    private handlePlaybackControl(socket: AuthenticatedSocket, payload: { action: string; value?: number }) {
        if (!socket.roomId) return;
        if (socket.role !== 'host' && socket.role !== 'cohost') {
            return this.sendError(socket, 'UNAUTHORIZED', 'Only host or cohost can control playback');
        }

        const currentState = store.getPlaybackState(socket.roomId);
        if (!currentState) return;

        let newState: Partial<PlaybackState> = {};

        switch (payload.action) {
            case 'play':
                newState = { isPlaying: true };
                break;
            case 'pause':
                newState = { isPlaying: false };
                break;
            case 'seek':
                newState = { currentTime: payload.value || 0 };
                break;
        }

        store.updatePlaybackState(socket.roomId, newState);

        this.broadcastToRoom(socket.roomId, {
            type: 'playback_control',
            payload: { ...payload, by: socket.displayName },
            timestamp: Date.now(),
        });
    }

    private handleChat(socket: AuthenticatedSocket, payload: { content: string }) {
        if (!socket.roomId) return;

        const roomState = store.getRoomByCode(socket.roomCode);
        if (!roomState?.room.settings.allowChat) {
            return this.sendError(socket, 'CHAT_DISABLED', 'Chat is disabled in this room');
        }

        const message: ChatMessage = {
            id: uuidv4(),
            senderId: socket.userId,
            senderName: socket.displayName,
            content: payload.content.slice(0, 500), // Limit message length
            timestamp: new Date(),
            type: 'message',
        };

        store.addChatMessage(socket.roomId, message);

        this.broadcastToRoom(socket.roomId, {
            type: 'chat',
            payload: message,
            timestamp: Date.now(),
        });
    }

    private handleReaction(socket: AuthenticatedSocket, payload: { emoji: string }) {
        if (!socket.roomId) return;

        const roomState = store.getRoomByCode(socket.roomCode);
        if (!roomState?.room.settings.allowReactions) {
            return;
        }

        this.broadcastToRoom(socket.roomId, {
            type: 'reaction',
            payload: {
                id: uuidv4(),
                emoji: payload.emoji,
                senderId: socket.userId,
                senderName: socket.displayName,
                timestamp: Date.now(),
            },
            timestamp: Date.now(),
        });
    }

    private handleQueueAdd(socket: AuthenticatedSocket, payload: { reelUrl: string; embedHtml?: string; title?: string; thumbnailUrl?: string }) {
        if (!socket.roomId || !payload.reelUrl) return;

        const roomState = store.getRoomByCode(socket.roomCode);
        if (!roomState) return;

        const item: QueueItem = {
            id: uuidv4(),
            reelUrl: payload.reelUrl,
            embedHtml: payload.embedHtml,
            thumbnailUrl: payload.thumbnailUrl,
            title: payload.title,
            addedBy: socket.userId,
            addedByName: socket.displayName,
            position: roomState.queue.length,
            addedAt: new Date(),
        };

        store.addToQueue(roomState.room.id, item);
        this.broadcastQueue(roomState.room.id);
    }

    private handleQueueRemove(socket: AuthenticatedSocket, payload: { itemId: string }) {
        if (!socket.roomId || !payload.itemId) return;

        store.removeFromQueue(socket.roomId, payload.itemId);
        this.broadcastQueue(socket.roomId);
    }

    private handleQueueReorder(socket: AuthenticatedSocket, payload: { itemId: string; newPosition: number }) {
        if (!socket.roomId || !payload.itemId) return;

        store.reorderQueue(socket.roomId, payload.itemId, payload.newPosition);
        this.broadcastQueue(socket.roomId);
    }

    private broadcastQueue(roomId: string) {
        this.broadcastToRoom(roomId, {
            type: 'queue_update',
            payload: { queue: store.getQueue(roomId) },
            timestamp: Date.now(),
        });
    }

    private handleRTCSignaling(socket: AuthenticatedSocket, message: WSMessage) {
        if (!socket.roomId) return;

        const payload = message.payload as { sdp?: string; candidate?: object; targetId?: string };

        if (payload.targetId) {
            // Send to specific peer
            const targetSocket = Array.from(this.clients.values()).find(c => c.userId === payload.targetId && c.roomId === socket.roomId);
            if (targetSocket) {
                this.send(targetSocket, {
                    type: message.type,
                    payload: { ...payload, fromId: socket.userId },
                    timestamp: Date.now(),
                });
            }
        } else {
            // Broadcast to room (for offers from host)
            this.broadcastToRoom(socket.roomId, {
                type: message.type,
                payload: { ...payload, fromId: socket.userId },
                timestamp: Date.now(),
            }, socket.id);
        }
    }

    private handleModeration(socket: AuthenticatedSocket, payload: { action: string; targetId: string }) {
        if (!socket.roomId) return;
        if (socket.role !== 'host') {
            return this.sendError(socket, 'UNAUTHORIZED', 'Only host can moderate');
        }

        const { action, targetId } = payload;

        switch (action) {
            case 'kick':
                // Find and disconnect the target
                const targetSocket = Array.from(this.clients.values()).find(
                    c => c.userId === targetId && c.roomId === socket.roomId
                );
                if (targetSocket) {
                    this.send(targetSocket, {
                        type: 'moderation',
                        payload: { action: 'kicked', by: socket.displayName },
                        timestamp: Date.now(),
                    });
                    targetSocket.close();
                }
                store.removeParticipant(socket.roomId, targetId);
                break;

            case 'mute':
                store.updateParticipant(socket.roomId, targetId, { isMuted: true });
                break;

            case 'unmute':
                store.updateParticipant(socket.roomId, targetId, { isMuted: false });
                break;

            case 'promote':
                store.updateParticipant(socket.roomId, targetId, { role: 'cohost' });
                break;

            case 'demote':
                store.updateParticipant(socket.roomId, targetId, { role: 'participant' });
                break;
        }

        // Broadcast updated participants
        this.broadcastToRoom(socket.roomId, {
            type: 'participant_update',
            payload: { participants: store.getParticipants(socket.roomId) },
            timestamp: Date.now(),
        });
    }

    private send(socket: WebSocket, message: WSMessage) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }

    private sendError(socket: AuthenticatedSocket, code: string, message: string) {
        this.send(socket, {
            type: 'error',
            payload: { code, message },
            timestamp: Date.now(),
        });
    }

    private broadcastToRoom(roomId: string, message: WSMessage, excludeId?: string) {
        const clientIds = this.roomClients.get(roomId);
        if (!clientIds) return;

        clientIds.forEach(clientId => {
            if (clientId === excludeId) return;
            const client = this.clients.get(clientId);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}
