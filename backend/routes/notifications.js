const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { executeQuery } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const {
    isWebPushEnabled,
    ensurePushSubscriptionsTable,
    savePushSubscription,
    removePushSubscriptionByEndpoint,
} = require('../utils/webPush');

// Get push config for frontend
router.get('/push/config', async (req, res) => {
    res.json({
        success: true,
        data: {
            supported: isWebPushEnabled(),
            publicKey: process.env.VAPID_PUBLIC_KEY || null,
        },
    });
});

// Save/update browser push subscription
router.post(
    '/push/subscribe',
    authenticate,
    [
        body('subscription').isObject(),
        body('subscription.endpoint').isString().notEmpty(),
        body('subscription.keys.p256dh').isString().notEmpty(),
        body('subscription.keys.auth').isString().notEmpty(),
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array(),
                });
            }

            await ensurePushSubscriptionsTable();

            const { subscription } = req.body;
            await savePushSubscription({
                userId: req.user.userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: req.headers['user-agent'] || null,
            });

            res.json({
                success: true,
                message: 'Push subscription saved',
            });
        } catch (error) {
            next(error);
        }
    }
);

// Remove browser push subscription
router.delete('/push/unsubscribe', authenticate, async (req, res, next) => {
    try {
        await ensurePushSubscriptionsTable();

        const endpoint = String(req.body?.endpoint || '').trim();
        if (!endpoint) {
            return res.status(400).json({
                success: false,
                message: 'endpoint is required',
            });
        }

        await removePushSubscriptionByEndpoint(endpoint, req.user.userId);

        res.json({
            success: true,
            message: 'Push subscription removed',
        });
    } catch (error) {
        next(error);
    }
});

// Get user's notifications
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { isRead, page = 1, limit = 20 } = req.query;

        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const safeOffset = (safePage - 1) * safeLimit;

        let sql = `
            SELECT n.*, 
                   CASE 
                       WHEN n.reference_type = 'room' THEN (SELECT title FROM rooms WHERE room_id = n.reference_id)
                       WHEN n.reference_type = 'chat' THEN (SELECT u.name FROM chat_rooms cr JOIN users u ON 
                           CASE WHEN cr.participant_1 = ? THEN cr.participant_2 ELSE cr.participant_1 END = u.id 
                           WHERE cr.room_id = n.reference_id)
                       ELSE NULL
                   END as reference_title
            FROM notifications n
            WHERE n.user_id = ?
        `;
        const params = [req.user.userId, req.user.userId];

        if (isRead !== undefined) {
            sql += ' AND n.is_read = ?';
            params.push(isRead === 'true' ? 1 : 0);
        }

        // TiDB does not support placeholders for LIMIT/OFFSET in prepared statements.
        sql += ` ORDER BY n.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

        const notifications = await executeQuery(sql, params);

        // Get unread count
        const unreadResult = await executeQuery(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [req.user.userId]
        );

        res.json({
            success: true,
            data: notifications,
            unreadCount: unreadResult[0].count
        });

    } catch (error) {
        next(error);
    }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res, next) => {
    try {
        const result = await executeQuery(
            'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        next(error);
    }
});

// Mark all notifications as read
router.put('/read-all', authenticate, async (req, res, next) => {
    try {
        await executeQuery(
            'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
            [req.user.userId]
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        next(error);
    }
});

// Delete notification
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await executeQuery(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.userId]
        );

        res.json({
            success: true,
            message: 'Notification deleted'
        });

    } catch (error) {
        next(error);
    }
});

// Get notification preferences (placeholder for future)
router.get('/preferences', authenticate, async (req, res, next) => {
    try {
        // In future, this will return user's notification preferences
        res.json({
            success: true,
            data: {
                emailNotifications: true,
                pushNotifications: true,
                smsNotifications: false,
                roomUpdates: true,
                expenseReminders: true,
                chatMessages: true,
                marketingEmails: false
            }
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
