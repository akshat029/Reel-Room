import { useCallback } from 'react';
import type { PlaybackState } from '@reelroom/shared';
import { connectSocket, disconnectSocket, send } from '../lib/wsClient';
import type { RTCSignalType } from '../lib/screenShare';

// Thin wrapper around the singleton WebSocket client (lib/wsClient). Every
// component shares one connection, so sends work from anywhere.
export function useWebSocket() {
    const connect = useCallback((roomCode: string, displayName: string, token?: string) => {
        connectSocket(roomCode, displayName, token);
    }, []);

    const disconnect = useCallback(() => {
        disconnectSocket();
    }, []);

    const sendMessage = useCallback((type: string, payload: object) => {
        send(type, payload);
    }, []);

    const sendChat = useCallback((content: string) => {
        send('chat', { content });
    }, []);

    const sendReaction = useCallback((emoji: string) => {
        send('reaction', { emoji });
    }, []);

    const sendPlaybackControl = useCallback((action: string, value?: number) => {
        send('playback_control', { action, value });
    }, []);

    const sendPlaybackSync = useCallback((state: Partial<PlaybackState>) => {
        send('playback_sync', state);
    }, []);

    const sendRTC = useCallback((type: RTCSignalType, payload: object) => {
        send(type, payload);
    }, []);

    return {
        connect,
        disconnect,
        send: sendMessage,
        sendChat,
        sendReaction,
        sendPlaybackControl,
        sendPlaybackSync,
        sendRTC,
    };
}
