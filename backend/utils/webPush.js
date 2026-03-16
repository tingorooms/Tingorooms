const webpush = require('web-push');
const { executeQuery } = require('../config/database');

let vapidConfigured = false;

const configureVapid = () => {
    if (vapidConfigured) {
        return true;
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

    if (!publicKey || !privateKey) {
        return false;
    }

    try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        vapidConfigured = true;
        return true;
    } catch (error) {
        console.error('Failed to configure VAPID keys:', error.message);
        return false;
    }
};

const ensurePushSubscriptionsTable = async () => {
    await executeQuery(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT NOT NULL AUTO_INCREMENT,
            user_id INT NOT NULL,
            endpoint VARCHAR(600) NOT NULL,
            p256dh VARCHAR(255) NOT NULL,
            auth VARCHAR(255) NOT NULL,
            user_agent VARCHAR(255) DEFAULT NULL,
            last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_push_endpoint (endpoint),
            KEY idx_push_user_id (user_id),
            CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

const savePushSubscription = async ({ userId, endpoint, p256dh, auth, userAgent }) => {
    await ensurePushSubscriptionsTable();

    await executeQuery(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            p256dh = VALUES(p256dh),
            auth = VALUES(auth),
            user_agent = VALUES(user_agent),
            last_seen = NOW()`,
        [userId, endpoint, p256dh, auth, userAgent || null]
    );
};

const removePushSubscriptionByEndpoint = async (endpoint, userId = null) => {
    await ensurePushSubscriptionsTable();

    if (userId) {
        await executeQuery('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, userId]);
        return;
    }

    await executeQuery('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
};

const sendWebPushToUser = async (userId, payload) => {
    if (!configureVapid()) {
        return { sent: 0, failed: 0, skipped: true };
    }

    await ensurePushSubscriptionsTable();

    const subscriptions = await executeQuery(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
        [userId]
    );

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        return { sent: 0, failed: 0, skipped: true };
    }

    const payloadText = JSON.stringify(payload || {});
    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
            },
        };

        try {
            await webpush.sendNotification(pushSubscription, payloadText);
            sent += 1;
        } catch (error) {
            failed += 1;
            const statusCode = error?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
                await removePushSubscriptionByEndpoint(sub.endpoint);
            }
        }
    }

    return { sent, failed, skipped: false };
};

const isWebPushEnabled = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

module.exports = {
    configureVapid,
    isWebPushEnabled,
    ensurePushSubscriptionsTable,
    savePushSubscription,
    removePushSubscriptionByEndpoint,
    sendWebPushToUser,
};
