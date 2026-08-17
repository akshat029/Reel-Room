import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { store } from '../store.js';
import { config } from '../config.js';
import type { CreateRoomRequest, JoinRoomRequest, AddToQueueRequest, Participant } from '@reelroom/shared';

export const roomRoutes = Router();

// Create a new room
roomRoutes.post('/', (req: Request<{}, {}, CreateRoomRequest>, res: Response) => {
    try {
        const { hostName, settings } = req.body;

        if (!hostName || hostName.trim().length < 1) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_HOST_NAME', message: 'Host name is required' },
            });
        }

        const hostId = uuidv4();
        const room = store.createRoom(hostId, hostName.trim(), settings);

        // Generate JWT token for the host
        const token = jwt.sign(
            { userId: hostId, roomId: room.id, role: 'host' },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            data: { room, token, participantId: hostId },
        });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'CREATE_ROOM_ERROR', message: 'Failed to create room' },
        });
    }
});

// Get room details by code
roomRoutes.get('/:code', (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        // Return public room info (no sensitive data)
        res.json({
            success: true,
            data: {
                room: roomState.room,
                participantCount: roomState.participants.length,
                hasQueue: roomState.queue.length > 0,
            },
        });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'GET_ROOM_ERROR', message: 'Failed to get room' },
        });
    }
});

// Join a room
roomRoutes.post('/:code/join', (req: Request<{ code: string }, {}, JoinRoomRequest>, res: Response) => {
    try {
        const { code } = req.params;
        const { displayName } = req.body;

        if (!displayName || displayName.trim().length < 1) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_DISPLAY_NAME', message: 'Display name is required' },
            });
        }

        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        // Check if room is full
        if (roomState.participants.length >= roomState.room.settings.maxParticipants) {
            return res.status(403).json({
                success: false,
                error: { code: 'ROOM_FULL', message: 'Room is full' },
            });
        }

        const participantId = uuidv4();
        const participant: Participant = {
            id: participantId,
            displayName: displayName.trim(),
            role: 'participant',
            joinedAt: new Date(),
        };

        store.addParticipant(roomState.room.id, participant);

        // Generate JWT token
        const token = jwt.sign(
            { userId: participantId, roomId: roomState.room.id, role: 'participant' },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            data: {
                room: roomState.room,
                participant,
                token,
                queue: roomState.queue,
                playbackState: roomState.playbackState,
                participants: roomState.participants,
            },
        });
    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'JOIN_ROOM_ERROR', message: 'Failed to join room' },
        });
    }
});

// Get room queue
roomRoutes.get('/:code/queue', (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        res.json({
            success: true,
            data: { queue: roomState.queue },
        });
    } catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'GET_QUEUE_ERROR', message: 'Failed to get queue' },
        });
    }
});

// Add to queue
roomRoutes.post('/:code/queue', (req: Request<{ code: string }, {}, AddToQueueRequest & { addedBy: string; addedByName: string }>, res: Response) => {
    try {
        const { code } = req.params;
        const { reelUrl, addedBy, addedByName } = req.body;

        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        const queueItem = {
            id: uuidv4(),
            reelUrl,
            addedBy,
            addedByName,
            position: roomState.queue.length,
            addedAt: new Date(),
        };

        store.addToQueue(roomState.room.id, queueItem);

        res.status(201).json({
            success: true,
            data: { item: queueItem, queue: store.getQueue(roomState.room.id) },
        });
    } catch (error) {
        console.error('Add to queue error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'ADD_QUEUE_ERROR', message: 'Failed to add to queue' },
        });
    }
});

// Remove from queue
roomRoutes.delete('/:code/queue/:itemId', (req: Request, res: Response) => {
    try {
        const { code, itemId } = req.params;
        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        store.removeFromQueue(roomState.room.id, itemId);

        res.json({
            success: true,
            data: { queue: store.getQueue(roomState.room.id) },
        });
    } catch (error) {
        console.error('Remove from queue error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'REMOVE_QUEUE_ERROR', message: 'Failed to remove from queue' },
        });
    }
});

// Get participants
roomRoutes.get('/:code/participants', (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const roomState = store.getRoomByCode(code.toUpperCase());

        if (!roomState) {
            return res.status(404).json({
                success: false,
                error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' },
            });
        }

        res.json({
            success: true,
            data: { participants: roomState.participants },
        });
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'GET_PARTICIPANTS_ERROR', message: 'Failed to get participants' },
        });
    }
});
