const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { executeQuery } = require('../config/database');
const { authenticate, requireMember } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const { sendWebPushToUser } = require('../utils/webPush');
const { 
    getOrCreateChatRoom,
    getSupabaseAdmin,
    sendMessage, 
    getChatHistory, 
    getUserChatRooms 
} = require('../config/supabase');

// Get user's chat rooms
router.get('/rooms', authenticate, requireMember, async (req, res, next) => {
    try {
        const chatRooms = await getUserChatRooms(req.user.userId);

        // Enrich with room details from MySQL and ensure profile images are synced
        for (const chatRoom of chatRooms) {
            if (chatRoom.room_listing_id) {
                const roomDetails = await executeQuery(
                    `SELECT room_id, title, images, status 
                     FROM rooms WHERE id = ?`,
                    [chatRoom.room_listing_id]
                );
                chatRoom.room_details = roomDetails[0] || null;
            }

            // Ensure participant profile images are synced to Supabase
            try {
                const supabaseAdmin = getSupabaseAdmin();
                
                // Get participant IDs
                const p1Id = typeof chatRoom.participant_1 === 'object' ? chatRoom.participant_1?.id : chatRoom.participant_1;
                const p2Id = typeof chatRoom.participant_2 === 'object' ? chatRoom.participant_2?.id : chatRoom.participant_2;
                
                // Fetch from MySQL to ensure we have latest profile images
                const participants = await executeQuery(
                    'SELECT id, name, profile_image FROM users WHERE id IN (?, ?)',
                    [p1Id, p2Id]
                );
                
                // Sync to Supabase
                if (participants.length > 0) {
                    const upsertData = participants.map(p => ({
                        id: p.id,
                        name: p.name,
                        profile_image: p.profile_image
                    }));
                    
                    await supabaseAdmin.from('users').upsert(upsertData, { onConflict: 'id' });
                }
            } catch (error) {
                console.error('Failed to sync participant profile images:', error);
                // Don't fail the request
            }
        }

        res.json({
            success: true,
            data: chatRooms
        });

    } catch (error) {
        next(error);
    }
});

// Get or create chat room for a listing
router.post('/room', authenticate, requireMember, [
    body('roomListingId').isInt()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { roomListingId } = req.body;

        // Get room details and owner info
        const rooms = await executeQuery(
            `SELECT r.id, r.room_id, r.title, r.images, r.user_id,
                    u.name as owner_name, u.profile_image as owner_profile_image
             FROM rooms r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.id = ?`,
            [roomListingId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];
        const ownerId = room.user_id;

        // Can't chat with yourself
        if (ownerId === req.user.userId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot chat with yourself'
            });
        }

        // Get current user details
        const currentUsers = await executeQuery(
            'SELECT id, name, profile_image FROM users WHERE id = ?',
            [req.user.userId]
        );
        const currentUser = currentUsers[0];

        // Sync users to Supabase (upsert to avoid conflicts)
        const supabaseAdmin = getSupabaseAdmin();
        
        await supabaseAdmin.from('users').upsert([
            { id: currentUser.id, name: currentUser.name, profile_image: currentUser.profile_image },
            { id: ownerId, name: room.owner_name, profile_image: room.owner_profile_image }
        ], { onConflict: 'id' });

        // Sync room to Supabase
        await supabaseAdmin.from('rooms').upsert([
            { id: room.id, room_id: room.room_id, title: room.title, images: room.images }
        ], { onConflict: 'id' });

        // Get or create chat room
        const chatRoom = await getOrCreateChatRoom(req.user.userId, ownerId, roomListingId);

        // Sync to MySQL
        await executeQuery(
            `INSERT INTO chat_rooms (room_id, room_listing_id, participant_1, participant_2, created_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE last_message_at = NOW()`,
            [chatRoom.room_id, roomListingId, req.user.userId, ownerId]
        );

        res.json({
            success: true,
            data: chatRoom
        });

    } catch (error) {
        next(error);
    }
});

// Get chat messages
router.get('/room/:roomId/messages', authenticate, requireMember, async (req, res, next) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        // Verify user is part of this chat
        const chatRoom = await executeQuery(
            'SELECT * FROM chat_rooms WHERE room_id = ? AND (participant_1 = ? OR participant_2 = ?)',
            [req.params.roomId, req.user.userId, req.user.userId]
        );

        if (chatRoom.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant in this chat'
            });
        }

        const messages = await getChatHistory(req.params.roomId, parseInt(limit), parseInt(offset));

        // Mark messages as read
        await executeQuery(
            `UPDATE messages SET is_read = TRUE, read_at = NOW() 
             WHERE chat_room_id = ? AND sender_id != ? AND is_read = FALSE`,
            [req.params.roomId, req.user.userId]
        );

        res.json({
            success: true,
            data: messages
        });

    } catch (error) {
        next(error);
    }
});

// Send message - Rate limited to 20 messages per minute
router.post('/room/:roomId/message', 
    authenticate, 
    requireMember,
    rateLimitMiddleware(20, 60000), // 20 requests per 60 seconds
    [
        body('message')
            .trim()
            .notEmpty().withMessage('Message cannot be empty')
            .isLength({ max: 2000 }).withMessage('Message must be 2000 characters or less'),
    ], 
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        let { message } = req.body;

        // Sanitize message - strip HTML tags
        message = message.replace(/<[^>]*>/g, '');

        // Verify user is part of this chat or is an admin
        const chatRooms = await executeQuery(
            'SELECT * FROM chat_rooms WHERE room_id = ?',
            [req.params.roomId]
        );

        let chatRoom = chatRooms[0] || null;
        const wasMissingInMySql = !chatRoom;

        // Fallback to Supabase if MySQL doesn't have the room yet
        if (!chatRoom) {
            try {
                const supabaseAdmin = getSupabaseAdmin();
                const { data: supabaseRoom } = await supabaseAdmin
                    .from('chat_rooms')
                    .select('participant_1, participant_2, room_listing_id')
                    .eq('room_id', req.params.roomId)
                    .single();

                if (supabaseRoom) {
                    chatRoom = supabaseRoom;
                }
            } catch (error) {
                console.error('Failed to read chat room from Supabase:', error);
            }
        }

        if (!chatRoom) {
            return res.status(403).json({
                success: false,
                message: 'Chat room not found'
            });
        }

        // Backfill MySQL chat_rooms if missing
        if (wasMissingInMySql && chatRoom) {
            await executeQuery(
                `INSERT INTO chat_rooms (room_id, room_listing_id, participant_1, participant_2, created_at)
                 VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE last_message_at = NOW()` ,
                [
                    req.params.roomId,
                    chatRoom.room_listing_id || null,
                    chatRoom.participant_1,
                    chatRoom.participant_2
                ]
            );
        }

        // Check if user is participant or admin
        const userId = Number(req.user.userId);
        const participant1 = Number(chatRoom.participant_1);
        const participant2 = Number(chatRoom.participant_2);
        const isParticipant = participant1 === userId || participant2 === userId;
        const isAdmin = req.user.role === 'Admin';

        if (!isParticipant && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant in this chat'
            });
        }

        // Send message via Supabase
        const sentMessage = await sendMessage(req.params.roomId, req.user.userId, message);

        // Sync to MySQL
        await executeQuery(
            `INSERT INTO messages (chat_room_id, sender_id, message, created_at)
             VALUES (?, ?, ?, NOW())`,
            [req.params.roomId, req.user.userId, message]
        );

        // Update last message time
        await executeQuery(
            'UPDATE chat_rooms SET last_message_at = NOW() WHERE room_id = ?',
            [req.params.roomId]
        );

        // Create notification for recipient
        const recipientId = participant1 === userId
            ? participant2
            : participant1;

        await executeQuery(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, created_at)
             VALUES (?, 'Chat_Message', 'New Message', ?, ?, 'chat', NOW())`,
            [recipientId, `New message from ${req.user.name}`, req.params.roomId]
        );

        // Send web push notification (works when app tab is closed) when recipient has subscribed.
        await sendWebPushToUser(recipientId, {
            title: `Message from ${req.user.name}`,
            body: String(message || '').slice(0, 140) || 'Sent you a message',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: `chat_${req.params.roomId}`,
            data: {
                url: `/dashboard/chat?room=${encodeURIComponent(req.params.roomId)}`,
                chatRoomId: req.params.roomId,
                type: 'chat_message',
            },
        });

        res.json({
            success: true,
            message: 'Message sent successfully',
            data: sentMessage
        });

    } catch (error) {
        next(error);
    }
});

// Mark messages as read
router.put('/room/:roomId/read', authenticate, requireMember, async (req, res, next) => {
    try {
        // Update MySQL
        await executeQuery(
            `UPDATE messages SET is_read = TRUE, read_at = NOW() 
             WHERE chat_room_id = ? AND sender_id != ? AND is_read = FALSE`,
            [req.params.roomId, req.user.userId]
        );

        // Update Supabase - THIS IS CRITICAL for unread count to work!
        try {
            const supabaseAdmin = getSupabaseAdmin();
            await supabaseAdmin
                .from('messages')
                .update({ 
                    is_read: true, 
                    read_at: new Date().toISOString() 
                })
                .eq('chat_room_id', req.params.roomId)
                .neq('sender_id', req.user.userId)
                .eq('is_read', false);
        } catch (supabaseError) {
            console.error('Failed to mark messages as read in Supabase:', supabaseError);
            // Don't fail the request - MySQL is our primary source
        }

        res.json({
            success: true,
            message: 'Messages marked as read'
        });

    } catch (error) {
        next(error);
    }
});

// Get unread message count
router.get('/unread-count', authenticate, requireMember, async (req, res, next) => {
    try {
        const result = await executeQuery(
            `SELECT COUNT(*) as count 
             FROM messages m
             JOIN chat_rooms cr ON m.chat_room_id = cr.room_id
             WHERE (cr.participant_1 = ? OR cr.participant_2 = ?) 
             AND m.sender_id != ? AND m.is_read = FALSE`,
            [req.user.userId, req.user.userId, req.user.userId]
        );

        res.json({
            success: true,
            data: { unreadCount: result[0].count }
        });

    } catch (error) {
        next(error);
    }
});

// Get unread message count per chat room
router.get('/unread-per-room', authenticate, requireMember, async (req, res, next) => {
    try {
        const results = await executeQuery(
            `SELECT cr.room_id as roomId, COUNT(m.id) as unreadCount
             FROM messages m
             JOIN chat_rooms cr ON m.chat_room_id = cr.room_id
             WHERE (cr.participant_1 = ? OR cr.participant_2 = ?) 
             AND m.sender_id != ? AND m.is_read = FALSE
             GROUP BY cr.room_id`,
            [req.user.userId, req.user.userId, req.user.userId]
        );

        // Format response as object with roomId as key
        const unreadCounts = {};
        results.forEach((row) => {
            unreadCounts[row.roomId] = row.unreadCount;
        });

        res.json({
            success: true,
            data: unreadCounts
        });

    } catch (error) {
        next(error);
    }
});

// Auto-register and start chat (for non-logged in users clicking chat)
router.post('/auto-register', [
    body('email').isEmail(),
    body('roomId').notEmpty()
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { email, roomId } = req.body;

        // Check if user exists
        const existingUser = await executeQuery(
            'SELECT id, unique_id, name, email, role FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            // User exists, return user info and prompt for login
            return res.json({
                success: true,
                data: {
                    exists: true,
                    user: existingUser[0],
                    message: 'Please login to continue chatting'
                }
            });
        }

        // Auto-register new user
        const { generateUserId, generateOTP } = require('../utils/helpers');
        const { sendOTPEmail } = require('../utils/email');

        let uniqueId;
        let isUnique = false;
        while (!isUnique) {
            uniqueId = generateUserId();
            const existing = await executeQuery(
                'SELECT id FROM users WHERE unique_id = ?',
                [uniqueId]
            );
            if (existing.length === 0) isUnique = true;
        }

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Create temporary user
        const result = await executeQuery(
            `INSERT INTO users (
                unique_id, name, email, contact, gender, pincode,
                password_hash, role, otp_code, otp_expires_at,
                is_verified, registration_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'Active')`,
            [
                uniqueId, email.split('@')[0], email, '0000000000', 'Other', '000000',
                '', 'Member', otp, otpExpiresAt, false
            ]
        );

        // Send OTP
        await sendOTPEmail(email, otp);

        res.json({
            success: true,
            data: {
                exists: false,
                userId: result.insertId,
                uniqueId,
                email,
                message: 'OTP sent for verification',
                requiresVerification: true
            }
        });

    } catch (error) {
        next(error);
    }
});

// Star a chat room
router.post('/:chatRoomId/star', authenticate, requireMember, async (req, res, next) => {
    try {
        const { chatRoomId } = req.params;
        const supabaseAdmin = getSupabaseAdmin();

        // Verify user is part of this chat using Supabase
        const { data: chatRoom, error: chatRoomError } = await supabaseAdmin
            .from('chat_rooms')
            .select('*')
            .eq('room_id', chatRoomId)
            .single();

        if (chatRoomError || !chatRoom) {
            return res.status(404).json({
                success: false,
                message: 'Chat room not found'
            });
        }

        if (chatRoom.participant_1 !== req.user.userId && chatRoom.participant_2 !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant in this chat'
            });
        }

        // Check if already 5 starred
        const { data: starredRooms, error: countError } = await supabaseAdmin
            .from('chat_rooms')
            .select('*', { count: 'exact' })
            .or(`participant_1.eq.${req.user.userId},participant_2.eq.${req.user.userId}`)
            .eq('is_starred', true);

        if (countError) throw countError;

        if ((starredRooms?.length || 0) >= 5) {
            return res.status(400).json({
                success: false,
                message: 'You can only star up to 5 conversations'
            });
        }

        // Update to starred in Supabase
        const { data: updatedRoom, error } = await supabaseAdmin
            .from('chat_rooms')
            .update({ is_starred: true })
            .eq('room_id', chatRoomId)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data: updatedRoom
        });

    } catch (error) {
        next(error);
    }
});

// Unstar a chat room
router.post('/:chatRoomId/unstar', authenticate, requireMember, async (req, res, next) => {
    try {
        const { chatRoomId } = req.params;
        const supabaseAdmin = getSupabaseAdmin();

        // Verify user is part of this chat using Supabase
        const { data: chatRoom, error: chatRoomError } = await supabaseAdmin
            .from('chat_rooms')
            .select('*')
            .eq('room_id', chatRoomId)
            .single();

        if (chatRoomError || !chatRoom) {
            return res.status(404).json({
                success: false,
                message: 'Chat room not found'
            });
        }

        if (chatRoom.participant_1 !== req.user.userId && chatRoom.participant_2 !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You are not a participant in this chat'
            });
        }

        // Update to unstarred in Supabase
        const { data: updatedRoom, error } = await supabaseAdmin
            .from('chat_rooms')
            .update({ is_starred: false })
            .eq('room_id', chatRoomId)
            .select('*')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data: updatedRoom
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
