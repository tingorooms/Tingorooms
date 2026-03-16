const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Get current broker subscription and stats
router.get('/broker/current', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Check if user is a broker
        if (userRole !== 'Broker') {
            return res.status(403).json({ error: 'Access denied. Broker role required.' });
        }

        // Get latest subscription record (status handled in application layer)
        let [subscriptions] = await pool.query(`
            SELECT s.*, p.plan_name, p.plan_code, p.description, p.price, p.duration_days, p.features
            FROM subscriptions s
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
            LIMIT 1
        `, [userId]);

        // Auto-recovery disabled intentionally:
        // do not create any synthetic subscription rows while fetching current subscription.

        const currentSubscription = subscriptions.length > 0 ? {
            ...subscriptions[0],
            plan: {
                id: subscriptions[0].plan_id,
                plan_name: subscriptions[0].plan_name,
                plan_code: subscriptions[0].plan_code,
                description: subscriptions[0].description,
                price: subscriptions[0].price,
                duration_days: subscriptions[0].duration_days,
                features: typeof subscriptions[0].features === 'string' 
                    ? JSON.parse(subscriptions[0].features) 
                    : subscriptions[0].features
            }
        } : null;

        // Get subscription history
        const [history] = await pool.query(`
            SELECT s.*, p.plan_name, p.plan_code, p.price, p.duration_days
            FROM subscriptions s
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [userId]);

        // Calculate statistics
        const hasCurrentSubscription = currentSubscription !== null;
        const isActive = hasCurrentSubscription
            ? currentSubscription.payment_status === 'Completed' && new Date(currentSubscription.expires_at) > new Date()
            : false;
        const daysRemaining = hasCurrentSubscription
            ? Math.ceil((new Date(currentSubscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
            : 0;

        // Get room statistics
        const [roomStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_rooms,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as active_rooms,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_rooms
            FROM rooms
            WHERE user_id = ?
        `, [userId]);

        const stats = {
            currentSubscription,
            subscriptionHistory: history.map(sub => ({
                ...sub,
                plan: {
                    plan_name: sub.plan_name,
                    plan_code: sub.plan_code,
                    price: sub.price,
                    duration_days: sub.duration_days
                }
            })),
            isActive,
            daysRemaining,
            totalRoomsPosted: roomStats[0]?.total_rooms || 0,
            activeRooms: roomStats[0]?.active_rooms || 0,
            pendingRooms: roomStats[0]?.pending_rooms || 0
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching broker subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
});

// Get subscription history
router.get('/broker/history', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;

        if (userRole !== 'Broker') {
            return res.status(403).json({ error: 'Access denied. Broker role required.' });
        }

        const [history] = await pool.query(`
            SELECT s.*, p.plan_name, p.plan_code, p.description, p.price, p.duration_days, p.features
            FROM subscriptions s
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [userId]);

        res.json(history);
    } catch (error) {
        console.error('Error fetching subscription history:', error);
        res.status(500).json({ error: 'Failed to fetch subscription history' });
    }
});

// Get available plans
router.get('/plans', async (req, res) => {
    try {
        const planType = req.query.type || 'Regular'; // Default to Regular plans
        
        const [plans] = await pool.query(`
            SELECT * FROM plans
            WHERE is_active = TRUE AND plan_type = ?
            ORDER BY price ASC
        `, [planType]);

        const formattedPlans = plans.map(plan => ({
            ...plan,
            features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features
        }));

        res.json(formattedPlans);
    } catch (error) {
        console.error('Error fetching plans:', error);
        res.status(500).json({ error: 'Failed to fetch plans' });
    }
});

// Create/Renew subscription
router.post('/broker/renew', authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { plan_id } = req.body;

        if (userRole !== 'Broker') {
            return res.status(403).json({ error: 'Access denied. Broker role required.' });
        }

        if (!plan_id) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        // Get plan details
        const [plans] = await pool.query('SELECT * FROM plans WHERE id = ? AND is_active = TRUE', [plan_id]);
        
        if (plans.length === 0) {
            return res.status(404).json({ error: 'Plan not found or inactive' });
        }

        const plan = plans[0];

        // Calculate subscription dates:
        // If broker has an active subscription, next plan starts from next day after expiry.
        // If no active subscription, starts from today.
        const [activeSubs] = await pool.query(
            `SELECT expires_at
             FROM subscriptions
             WHERE user_id = ? AND payment_status = 'Completed' AND expires_at > NOW()
             ORDER BY expires_at DESC
             LIMIT 1`,
            [userId]
        );

        const startsAt = activeSubs.length > 0
            ? new Date(new Date(activeSubs[0].expires_at).setDate(new Date(activeSubs[0].expires_at).getDate() + 1))
            : new Date();

        const expiresAt = new Date(startsAt);
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);

        // Create subscription record
        let subscriptionId = null;
        try {
            const [result] = await pool.query(`
                INSERT INTO subscriptions (
                    user_id, plan_id, amount_paid, starts_at, expires_at, payment_status
                ) VALUES (?, ?, ?, ?, ?, 'Pending')
            `, [userId, plan_id, plan.price, startsAt, expiresAt]);
            subscriptionId = result.insertId;
        } catch (insertError) {
            const missingIdDefault =
                insertError &&
                insertError.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
                insertError.message &&
                insertError.message.includes("Field 'id'");

            if (!missingIdDefault) {
                throw insertError;
            }

            const [maxRows] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM subscriptions');
            subscriptionId = Number(maxRows?.[0]?.maxId || 0) + 1;

            await pool.query(`
                INSERT INTO subscriptions (
                    id, user_id, plan_id, amount_paid, starts_at, expires_at, payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')
            `, [subscriptionId, userId, plan_id, plan.price, startsAt, expiresAt]);
        }

        // Get the created subscription
        const [newSubscription] = await pool.query(`
            SELECT s.*, p.plan_name, p.plan_code, p.description, p.price, p.duration_days, p.features
            FROM subscriptions s
            LEFT JOIN plans p ON s.plan_id = p.id
            WHERE s.id = ?
        `, [subscriptionId]);

        res.status(201).json({
            message: 'Subscription created successfully',
            subscription: newSubscription[0]
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// Update subscription payment status (for manual/admin updates)
router.patch('/:subscriptionId/payment-status', authenticate, async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { payment_status, transaction_id } = req.body;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Check if subscription belongs to user or if user is admin
        const [subscriptions] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
        
        if (subscriptions.length === 0) {
            return res.status(404).json({ error: 'Subscription not found' });
        }

        const subscription = subscriptions[0];

        if (subscription.user_id !== userId && userRole !== 'Admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Update payment status
        await pool.query(`
            UPDATE subscriptions
            SET payment_status = ?, transaction_id = ?
            WHERE id = ?
        `, [payment_status, transaction_id || null, subscriptionId]);

        res.json({ message: 'Payment status updated successfully' });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
});

module.exports = router;
