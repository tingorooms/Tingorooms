const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const isValidURL = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

const { executeQuery } = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');
const {
    CONTACT_LEAD_STATUSES,
    ensureContactLeadsTable,
    escapeLikeSearchTerm
} = require('../utils/contactLeads');
const { uploadImageFiles } = require('../utils/imageStorage');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Multer configs for two default ad bg types
const adsBgStorageSearch = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/ads/'));
    },
    filename: (req, file, cb) => {
        cb(null, 'default-bg-search' + path.extname(file.originalname));
    }
});
const adsBgStoragePost = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/ads/'));
    },
    filename: (req, file, cb) => {
        cb(null, 'default-bg-post' + path.extname(file.originalname));
    }
});
const uploadAdsBgSearch = multer({ storage: adsBgStorageSearch });
const uploadAdsBgPost = multer({ storage: adsBgStoragePost });

// Upload/update default ad card background image for Search Card (admin only)
router.post('/ads/default-bg-search', authenticate, requireAdmin, uploadAdsBgSearch.single('defaultBg'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const bgPath = `/uploads/ads/${req.file.filename}`;
        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-search.json');
        fs.writeFileSync(settingsFile, JSON.stringify({ defaultBg: bgPath }, null, 2));
        await updateSiteSettings({ defaultAdBgSearchUrl: bgPath });
        return res.json({ success: true, url: bgPath });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to upload default background', error: err.message });
    }
});
// Get current default ad card background image for Search Card
router.get('/ads/default-bg-search', authenticate, requireAdmin, async (req, res) => {
    try {
        const settings = await getSiteSettings();
        if (settings?.defaultAdBgSearchUrl) {
            return res.json({ success: true, url: settings.defaultAdBgSearchUrl });
        }

        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-search.json');
        if (fs.existsSync(settingsFile)) {
            const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
            return res.json({ success: true, url: data.defaultBg });
        }
        return res.json({ success: true, url: '' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch default background', error: err.message });
    }
});

router.delete('/ads/default-bg-search', authenticate, requireAdmin, async (req, res) => {
    try {
        const settings = await getSiteSettings();
        const defaultBgPath = settings?.defaultAdBgSearchUrl || '';

        if (defaultBgPath.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', defaultBgPath.replace(/^\/uploads\//, 'uploads/'));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-search.json');
        if (fs.existsSync(settingsFile)) {
            fs.unlinkSync(settingsFile);
        }

        await updateSiteSettings({ defaultAdBgSearchUrl: '' });
        return res.json({ success: true, message: 'Default search background removed' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to remove default search background', error: err.message });
    }
});

// Upload/update default ad card background image for Post Room Card (admin only)
router.post('/ads/default-bg-post', authenticate, requireAdmin, uploadAdsBgPost.single('defaultBg'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const bgPath = `/uploads/ads/${req.file.filename}`;
        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-post.json');
        fs.writeFileSync(settingsFile, JSON.stringify({ defaultBg: bgPath }, null, 2));
        await updateSiteSettings({ defaultAdBgPostUrl: bgPath });
        return res.json({ success: true, url: bgPath });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to upload default background', error: err.message });
    }
});
// Get current default ad card background image for Post Room Card
router.get('/ads/default-bg-post', authenticate, requireAdmin, async (req, res) => {
    try {
        const settings = await getSiteSettings();
        if (settings?.defaultAdBgPostUrl) {
            return res.json({ success: true, url: settings.defaultAdBgPostUrl });
        }

        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-post.json');
        if (fs.existsSync(settingsFile)) {
            const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
            return res.json({ success: true, url: data.defaultBg });
        }
        return res.json({ success: true, url: '' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch default background', error: err.message });
    }
});

router.delete('/ads/default-bg-post', authenticate, requireAdmin, async (req, res) => {
    try {
        const settings = await getSiteSettings();
        const defaultBgPath = settings?.defaultAdBgPostUrl || '';

        if (defaultBgPath.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', defaultBgPath.replace(/^\/uploads\//, 'uploads/'));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        const settingsFile = path.join(__dirname, '../uploads/ads/default-bg-post.json');
        if (fs.existsSync(settingsFile)) {
            fs.unlinkSync(settingsFile);
        }

        await updateSiteSettings({ defaultAdBgPostUrl: '' });
        return res.json({ success: true, message: 'Default post room background removed' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to remove default post room background', error: err.message });
    }
});
const { sendBrokerApprovalEmail, sendSubscriptionDecisionEmail } = require('../utils/email');
const { getSiteSettings, updateSiteSettings } = require('../utils/siteSettings');
const { 
    filterUserForAdmin, 
    filterUsersForAdmin, 
    filterDashboardData, 
    filterRoomOwnerInfo 
} = require('../middleware/responseFilter');

let hasVerifiedSubscriptionsAdminRemarkColumn = false;
let hasVerifiedAdsTable = false;

const toCalendarSafeDate = (value) => {
    if (!value) {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const clonedDate = new Date(value.getTime());
        clonedDate.setHours(12, 0, 0, 0);
        return clonedDate;
    }

    const rawValue = String(value);
    const dateOnlyMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const monthIndex = Number(dateOnlyMatch[2]) - 1;
        const day = Number(dateOnlyMatch[3]);
        return new Date(year, monthIndex, day, 12, 0, 0, 0);
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    parsedDate.setHours(12, 0, 0, 0);
    return parsedDate;
};

const addCalendarDays = (sourceDate, days) => {
    const nextDate = new Date(sourceDate.getTime());
    nextDate.setDate(nextDate.getDate() + Number(days || 0));
    nextDate.setHours(12, 0, 0, 0);
    return nextDate;
};

const ensureSubscriptionsAdminRemarkColumn = async () => {
    if (hasVerifiedSubscriptionsAdminRemarkColumn) {
        return;
    }

    const columnRows = await executeQuery(`SHOW COLUMNS FROM subscriptions LIKE 'admin_remark'`);
    if (!columnRows || columnRows.length === 0) {
        await executeQuery(`ALTER TABLE subscriptions ADD COLUMN admin_remark TEXT NULL`);
    }

    hasVerifiedSubscriptionsAdminRemarkColumn = true;
};

const ensureAdsTable = async () => {
    if (hasVerifiedAdsTable) {
        return;
    }

    await executeQuery(`
        CREATE TABLE IF NOT EXISTS ads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            banner_title VARCHAR(150) NOT NULL,
            description TEXT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ads_active_dates (is_active, start_date, end_date),
            INDEX idx_ads_dates (start_date, end_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const adsImagesColumn = await executeQuery(`SHOW COLUMNS FROM ads LIKE 'images_json'`);
    if (!adsImagesColumn || adsImagesColumn.length === 0) {
        await executeQuery(`ALTER TABLE ads ADD COLUMN images_json JSON NULL AFTER description`);
    }

    const adsPriorityColumn = await executeQuery(`SHOW COLUMNS FROM ads LIKE 'priority'`);
    if (!adsPriorityColumn || adsPriorityColumn.length === 0) {
        await executeQuery(`ALTER TABLE ads ADD COLUMN priority INT NOT NULL DEFAULT 0 AFTER images_json`);
    }

    const adsCardPlacementColumn = await executeQuery(`SHOW COLUMNS FROM ads LIKE 'card_placement'`);
    if (!adsCardPlacementColumn || adsCardPlacementColumn.length === 0) {
        await executeQuery(`ALTER TABLE ads ADD COLUMN card_placement VARCHAR(50) DEFAULT 'MP_Search' AFTER priority`);
    }

    hasVerifiedAdsTable = true;
};

const insertAdminNotification = async ({
    userId,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
}) => {
    const baseSql = `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
                     VALUES (?, ?, ?, ?, ?, ?)`;
    const baseParams = [userId, type, title, message, referenceId, referenceType];

    try {
        await executeQuery(baseSql, baseParams);
        return;
    } catch (error) {
        const missingIdDefault =
            error &&
            error.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
            error.message &&
            error.message.includes("Field 'id'");

        if (!missingIdDefault) {
            throw error;
        }
    }

    // Fallback for imports where notifications.id is not AUTO_INCREMENT.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const maxRows = await executeQuery('SELECT COALESCE(MAX(id), 0) AS maxId FROM notifications');
        const nextId = Number(maxRows[0]?.maxId || 0) + 1;

        try {
            await executeQuery(
                `INSERT INTO notifications (id, user_id, type, title, message, reference_id, reference_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [nextId, ...baseParams]
            );
            return;
        } catch (fallbackError) {
            if (fallbackError?.code === 'ER_DUP_ENTRY' && attempt < 2) {
                continue;
            }
            throw fallbackError;
        }
    }
};

router.get('/site-settings', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const settings = await getSiteSettings();

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
});

router.put('/site-settings', authenticate, requireAdmin, [
    body('businessName').optional().trim().isLength({ min: 2, max: 120 }),
    body('businessTagline').optional().trim().isLength({ max: 255 }),
    body('supportEmail').optional().trim().isEmail(),
    body('adminEmail').optional().trim().isEmail(),
    body('supportPhone').optional().trim().isLength({ min: 7, max: 40 }),
    body('logoUrl').optional().trim().isLength({ max: 600 }),
    body('faviconUrl').optional().trim().isLength({ max: 600 }),
    body('supportAddress').optional().trim().isLength({ max: 255 }),
    body('facebookUrl').trim().custom(value => {
        if (!value) return true; // Allow empty strings
        if (!isValidURL(value)) throw new Error('Invalid Facebook URL');
        if (value.length > 500) throw new Error('URL too long');
        return true;
    }),
    body('twitterUrl').trim().custom(value => {
        if (!value) return true; // Allow empty strings
        if (!isValidURL(value)) throw new Error('Invalid Twitter URL');
        if (value.length > 500) throw new Error('URL too long');
        return true;
    }),
    body('instagramUrl').trim().custom(value => {
        if (!value) return true; // Allow empty strings
        if (!isValidURL(value)) throw new Error('Invalid Instagram URL');
        if (value.length > 500) throw new Error('URL too long');
        return true;
    }),
    body('linkedinUrl').trim().custom(value => {
        if (!value) return true; // Allow empty strings
        if (!isValidURL(value)) throw new Error('Invalid LinkedIn URL');
        if (value.length > 500) throw new Error('URL too long');
        return true;
    }),
    body('youtubeUrl').trim().custom(value => {
        if (!value) return true; // Allow empty strings
        if (!isValidURL(value)) throw new Error('Invalid YouTube URL');
        if (value.length > 500) throw new Error('URL too long');
        return true;
    })
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

        const settings = await updateSiteSettings(req.body || {});

        res.json({
            success: true,
            message: 'Site settings updated successfully',
            data: settings
        });
    } catch (error) {
        next(error);
    }
});

// Upload logo or favicon
router.post('/site-settings/upload/:fileType', authenticate, requireAdmin, handleUpload('file', 1), async (req, res, next) => {
    try {
        const { fileType } = req.params;
        
        if (!['logo', 'favicon'].includes(fileType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Must be "logo" or "favicon"'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const file = req.files[0];
        // File is stored in memory, create path for local storage
        const filename = `${fileType}-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
        const fileUrl = `/uploads/sites/${filename}`;
        
        // Save file to uploads/sites directory
        const uploadDir = 'uploads/sites';
        if (!require('fs').existsSync(uploadDir)) {
            require('fs').mkdirSync(uploadDir, { recursive: true });
        }
        require('fs').writeFileSync(`${uploadDir}/${filename}`, file.buffer);
        
        const updatePayload = fileType === 'logo' 
            ? { logoUrl: fileUrl }
            : { faviconUrl: fileUrl };
        
        const settings = await updateSiteSettings(updatePayload);

        res.json({
            success: true,
            message: `${fileType} uploaded successfully`,
            data: settings,
            fileUrl
        });
    } catch (error) {
        next(error);
    }
});

const normalizeAdImages = (images) => {
    if (images === undefined || images === null || images === '') {
        return JSON.stringify([]);
    }

    let imageList = [];

    if (Array.isArray(images)) {
        imageList = images;
    } else if (typeof images === 'string') {
        const trimmedImages = images.trim();

        if (!trimmedImages) {
            imageList = [];
        } else {
            try {
                const parsedImages = JSON.parse(trimmedImages);
                if (Array.isArray(parsedImages)) {
                    imageList = parsedImages;
                } else {
                    imageList = [trimmedImages];
                }
            } catch (error) {
                imageList = trimmedImages.split(/[\n,]+/);
            }
        }
    }

    const cleanedImageList = [...new Set(
        imageList
            .map((item) => String(item || '').trim())
            .filter(Boolean)
    )];

    return JSON.stringify(cleanedImageList);
};

const parseAdImages = (imagesJson) => {
    const decodeAndCleanUrl = (value) => String(value || '')
        .trim()
        .replace(/^['"]+|['"]+$/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&#x3A;/gi, ':')
        .replace(/&#58;/g, ':')
        .replace(/&#x3F;/gi, '?')
        .replace(/&#63;/g, '?')
        .replace(/&#x3D;/gi, '=')
        .replace(/&#61;/g, '=');

    if (!imagesJson) {
        return [];
    }

    if (Array.isArray(imagesJson)) {
        return imagesJson
            .map((item) => decodeAndCleanUrl(item))
            .filter(Boolean);
    }

    if (typeof imagesJson === 'string') {
        try {
            const parsedImages = JSON.parse(imagesJson);
            if (Array.isArray(parsedImages)) {
                return parsedImages
                    .map((item) => decodeAndCleanUrl(item))
                    .filter(Boolean);
            }
        } catch (error) {
            return imagesJson
                .split(/[\n,]+/)
                .map((item) => decodeAndCleanUrl(item))
                .filter(Boolean);
        }
    }

    return [];
};

const mapAdRow = (row) => ({
    ...row,
    images: parseAdImages(row.images_json)
});

const normalizeBrokerStatus = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    const statusMap = {
        approved: 'Approved',
        approve: 'Approved',
        active: 'Active',
        hold: 'Hold',
        rejected: 'Rejected',
        reject: 'Rejected',
        suspended: 'Suspended',
        suspend: 'Suspended'
    };

    return statusMap[normalizedValue] || null;
};

const normalizePlanFeatures = (features) => {
    if (features === undefined || features === null || features === '') {
        return null;
    }

    if (Array.isArray(features)) {
        const cleanedFeatures = features
            .map((item) => String(item || '').trim())
            .filter(Boolean);

        return JSON.stringify(cleanedFeatures);
    }

    if (typeof features === 'string') {
        const trimmedFeatures = features.trim();

        if (!trimmedFeatures) {
            return JSON.stringify([]);
        }

        try {
            const parsedFeatures = JSON.parse(trimmedFeatures);
            if (Array.isArray(parsedFeatures)) {
                const cleanedFeatures = parsedFeatures
                    .map((item) => String(item || '').trim())
                    .filter(Boolean);

                return JSON.stringify(cleanedFeatures);
            }
        } catch (error) {
            // Fallback to line/comma split
        }

        const splitFeatures = trimmedFeatures
            .split(/[\n,]+/)
            .map((item) => item.trim())
            .filter(Boolean);

        return JSON.stringify(splitFeatures);
    }

    return JSON.stringify([]);
};

// Dashboard statistics
router.get('/dashboard', authenticate, requireAdmin, async (req, res, next) => {
    try {
        // Get overall stats
        const stats = await executeQuery(`
            SELECT 
                (SELECT COUNT(*) FROM rooms) as total_rooms,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Approved') as approved_rooms,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Pending') as pending_rooms,
                (SELECT COUNT(*) FROM rooms WHERE is_occupied = TRUE) as occupied_rooms,
                (SELECT COUNT(*) FROM users WHERE role = 'Member') as total_members,
                (SELECT COUNT(*) FROM users WHERE role = 'Broker' AND broker_status = 'Approved') as approved_brokers,
                (SELECT COUNT(*) FROM users WHERE role = 'Broker' AND broker_status = 'Pending') as pending_brokers,
                (SELECT COUNT(*) FROM users WHERE DATE(registration_date) = CURDATE()) as today_registrations,
                (SELECT COUNT(*) FROM rooms WHERE DATE(post_date) = CURDATE()) as today_rooms
        `);

        // Today's registrations
        const todayRegistrations = await executeQuery(`
            SELECT id, unique_id, name, email, contact, role, broker_status, registration_date
            FROM users
            WHERE DATE(registration_date) = CURDATE()
            ORDER BY registration_date DESC
            LIMIT 10
        `);

        // Today's room posts
        const todayRooms = await executeQuery(`
            SELECT r.room_id, r.title, r.listing_type, r.status, r.post_date,
                   u.name as owner_name, u.email as owner_email
            FROM rooms r
            JOIN users u ON r.user_id = u.id
            WHERE DATE(r.post_date) = CURDATE()
            ORDER BY r.post_date DESC
            LIMIT 10
        `);

        // Pending brokers
        const pendingBrokersRaw = await executeQuery(`
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area,
                   u.registration_date, u.selected_plan_id,
                   p.id as plan_id, p.plan_name, p.price, p.duration_days
            FROM users u
            LEFT JOIN plans p ON u.selected_plan_id = p.id
            WHERE u.role = 'Broker' AND u.broker_status = 'Pending'
            ORDER BY u.registration_date DESC
        `);

        const pendingBrokers = pendingBrokersRaw.map((broker) => ({
            ...broker,
            selected_plan: broker.plan_id ? {
                id: broker.plan_id,
                plan_name: broker.plan_name,
                price: broker.price,
                duration_days: broker.duration_days
            } : null
        }));

        // Pending rooms
        const pendingRooms = await executeQuery(`
            SELECT r.id, r.room_id, r.title, r.listing_type, r.city, r.area, 
                   r.rent, r.deposit, r.post_date,
                   u.id as owner_id, u.name as owner_name, u.contact as owner_contact, 
                   u.email as owner_email
            FROM rooms r
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'Pending'
            ORDER BY r.post_date DESC
        `);

        // Filter sensitive data before sending response
        const filteredData = filterDashboardData({
            stats: stats[0],
            todayRegistrations,
            todayRooms,
            pendingBrokers,
            pendingRooms
        });

        res.json({
            success: true,
            data: filteredData
        });

    } catch (error) {
        next(error);
    }
});

// Get all users
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { role, status, search, page = 1, limit = 20 } = req.query;

        let sql = `
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.gender,
                   u.role, u.broker_status, u.broker_area, u.status,
                   u.registration_date, u.last_login,
                   (SELECT COUNT(*) FROM rooms WHERE user_id = u.id) as room_count
            FROM users u
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            sql += ' AND u.role = ?';
            params.push(role);
        }

        if (status) {
            sql += ' AND u.status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.unique_id LIKE ? OR u.contact LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY u.registration_date DESC';

        const users = await executeQuery(sql, params);

        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedUsers = users.slice(startIndex, endIndex);

        // Filter sensitive data before sending response
        const filteredUsers = filterUsersForAdmin(paginatedUsers);

        res.json({
            success: true,
            data: filteredUsers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(users.length / parseInt(limit)),
                totalItems: users.length,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get user statistics
router.get('/users/stats', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const stats = await executeQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END) as suspended
            FROM users
            WHERE role != 'Admin'
        `);

        res.json({
            success: true,
            data: {
                all: stats[0].total,
                active: stats[0].active,
                inactive: stats[0].inactive,
                suspended: stats[0].suspended
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get user details
router.get('/users/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const users = await executeQuery(
            `SELECT u.*, 
                    (SELECT COUNT(*) FROM rooms WHERE user_id = u.id) as room_count,
                    (SELECT COUNT(*) FROM rooms WHERE user_id = u.id AND status = 'Approved') as approved_room_count
             FROM users u WHERE u.id = ?`,
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's rooms
        const rooms = await executeQuery(
            `SELECT room_id, title, listing_type, status, post_date, views_count
             FROM rooms WHERE user_id = ? ORDER BY post_date DESC`,
            [req.params.id]
        );

        res.json({
            success: true,
            data: {
                ...users[0],
                rooms
            }
        });

    } catch (error) {
        next(error);
    }
});

// Update user status
router.put('/users/:id/status', authenticate, requireAdmin, [
    body('status').isIn(['Active', 'Inactive', 'Suspended'])
], async (req, res, next) => {
    try {
        const { status } = req.body;

        await executeQuery(
            'UPDATE users SET status = ? WHERE id = ?',
            [status, req.params.id]
        );

        res.json({
            success: true,
            message: `User status updated to ${status}`
        });

    } catch (error) {
        next(error);
    }
});

// Get all brokers (with optional status filter)
router.get('/brokers', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { status, search } = req.query;
        
        let query = `
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area, 
                   u.registration_date, u.broker_status, u.admin_remark, 
                   u.selected_plan_id, u.status,
                   p.id as plan_id, p.plan_name, p.price, p.duration_days,
                   s.starts_at, s.expires_at, s.payment_status as subscription_status,
                   pending_sub.id as upgrade_request_id,
                   pending_sub.created_at as upgrade_requested_at,
                   pending_plan.plan_name as upgrade_requested_plan_name
            FROM users u
            LEFT JOIN plans p ON u.selected_plan_id = p.id
            LEFT JOIN (
                SELECT s1.id, s1.user_id, s1.starts_at, s1.expires_at, s1.payment_status
                FROM subscriptions s1
                INNER JOIN (
                    SELECT user_id, MAX(id) as max_id
                    FROM subscriptions
                    GROUP BY user_id
                ) s2 ON s1.id = s2.max_id
            ) s ON u.id = s.user_id
            LEFT JOIN (
                SELECT s1.id, s1.user_id, s1.plan_id, s1.created_at
                FROM subscriptions s1
                INNER JOIN (
                    SELECT user_id, MAX(id) as max_id
                    FROM subscriptions
                    WHERE payment_status = 'Pending'
                    GROUP BY user_id
                ) s2 ON s1.id = s2.max_id
            ) pending_sub ON u.id = pending_sub.user_id
            LEFT JOIN plans pending_plan ON pending_sub.plan_id = pending_plan.id
            WHERE u.role = 'Broker'
        `;
        
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND u.broker_status = ?';
            params.push(status);
        }
        
        if (search) {
            query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.broker_area LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }
        
        query += ' ORDER BY u.registration_date DESC';
        
        const brokers = await executeQuery(query, params);

        const uniqueBrokersById = new Map();
        brokers.forEach((broker) => {
            const existing = uniqueBrokersById.get(broker.id);
            if (!existing) {
                uniqueBrokersById.set(broker.id, broker);
                return;
            }

            const existingUpgradeId = Number(existing.upgrade_request_id || 0);
            const nextUpgradeId = Number(broker.upgrade_request_id || 0);

            const existingExpiry = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
            const nextExpiry = broker.expires_at ? new Date(broker.expires_at).getTime() : 0;

            const shouldReplace =
                nextUpgradeId > existingUpgradeId ||
                (nextUpgradeId === existingUpgradeId && nextExpiry > existingExpiry);

            if (shouldReplace) {
                uniqueBrokersById.set(broker.id, broker);
            }
        });

        const dedupedBrokers = Array.from(uniqueBrokersById.values());

        // Format the response
        const formattedBrokers = dedupedBrokers.map(broker => ({
            ...broker,
            has_upgrade_request: !!broker.upgrade_request_id,
            selected_plan: broker.plan_id ? {
                id: broker.plan_id,
                plan_name: broker.plan_name,
                price: broker.price,
                duration_days: broker.duration_days
            } : null,
            subscription: broker.starts_at ? {
                starts_at: broker.starts_at,
                expires_at: broker.expires_at,
                payment_status: broker.subscription_status
            } : null
        }));

        res.json({
            success: true,
            data: formattedBrokers
        });

    } catch (error) {
        next(error);
    }
});

// Get broker statistics
router.get('/brokers/stats', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const stats = await executeQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN broker_status = 'Approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN broker_status = 'Pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN broker_status = 'Hold' THEN 1 ELSE 0 END) as hold,
                SUM(CASE WHEN broker_status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN broker_status = 'Suspended' THEN 1 ELSE 0 END) as suspended
            FROM users
            WHERE role = 'Broker'
        `);

        res.json({
            success: true,
            data: {
                all: stats[0].total,
                approved: stats[0].approved,
                pending: stats[0].pending,
                hold: stats[0].hold,
                rejected: stats[0].rejected,
                suspended: stats[0].suspended
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get pending brokers
router.get('/brokers/pending', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const brokers = await executeQuery(`
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area, 
                   u.registration_date, u.broker_status, u.admin_remark, 
                   u.selected_plan_id,
                   p.id as plan_id, p.plan_name, p.price, p.duration_days
            FROM users u
            LEFT JOIN plans p ON u.selected_plan_id = p.id
            WHERE u.role = 'Broker' AND u.broker_status IN ('Pending', 'Hold')
            ORDER BY u.registration_date DESC
        `);

        // Format the response to include plan info
        const formattedBrokers = brokers.map(broker => ({
            ...broker,
            selected_plan: broker.plan_id ? {
                id: broker.plan_id,
                plan_name: broker.plan_name,
                price: broker.price,
                duration_days: broker.duration_days
            } : null
        }));

        res.json({
            success: true,
            data: formattedBrokers
        });

    } catch (error) {
        next(error);
    }
});

// Update broker status
router.put('/brokers/:id/status', authenticate, requireAdmin, [
    body('status')
        .custom((value) => {
            if (!normalizeBrokerStatus(value)) {
                throw new Error('Invalid status. Allowed values: Approved, Active, Hold, Rejected, Suspended');
            }
            return true;
        }),
    body('remark').optional().trim(),
    body('planId').custom((value) => {
        if (value === undefined || value === null || value === '') {
            return true;
        }

        const parsedValue = Number(value);
        if (!Number.isInteger(parsedValue)) {
            throw new Error('planId must be an integer');
        }

        return true;
    }),
    body('subscriptionDays').custom((value) => {
        if (value === undefined || value === null || value === '') {
            return true;
        }

        const parsedValue = Number(value);
        if (!Number.isInteger(parsedValue)) {
            throw new Error('subscriptionDays must be an integer');
        }

        return true;
    })
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

        const { status: rawStatus, remark, planId, subscriptionDays } = req.body;
        const parsedPlanId = planId === undefined || planId === null || planId === '' ? null : parseInt(planId, 10);
        const parsedSubscriptionDays = subscriptionDays === undefined || subscriptionDays === null || subscriptionDays === ''
            ? null
            : parseInt(subscriptionDays, 10);
        const requestedStatus = normalizeBrokerStatus(rawStatus);
        const status = requestedStatus === 'Active' ? 'Approved' : requestedStatus;
        const shouldCreateOrUpdateSubscription = requestedStatus === 'Approved';

        const brokers = await executeQuery(
            'SELECT id, name, email, selected_plan_id FROM users WHERE id = ? AND role = ?',
            [req.params.id, 'Broker']
        );

        if (brokers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Broker not found'
            });
        }

        const resolvedPlanId = shouldCreateOrUpdateSubscription
            ? (parsedPlanId || brokers[0].selected_plan_id || null)
            : null;

        let resolvedSubscriptionDays = shouldCreateOrUpdateSubscription
            ? (parsedSubscriptionDays || null)
            : null;

        if (shouldCreateOrUpdateSubscription && resolvedPlanId && !resolvedSubscriptionDays) {
            const selectedPlans = await executeQuery(
                'SELECT duration_days FROM plans WHERE id = ? AND plan_type = ?',
                [resolvedPlanId, 'Broker']
            );

            if (selectedPlans.length > 0) {
                resolvedSubscriptionDays = selectedPlans[0].duration_days;
            }
        }

        // Update broker status and selected_plan_id (from request or broker's already selected plan)
        if (status === 'Approved' && resolvedPlanId && shouldCreateOrUpdateSubscription) {
            await executeQuery(
                'UPDATE users SET broker_status = ?, admin_remark = ?, selected_plan_id = ?, status = \"Active\" WHERE id = ?',
                [status, remark || null, resolvedPlanId, req.params.id]
            );
        } else if (status === 'Approved') {
            await executeQuery(
                'UPDATE users SET broker_status = ?, admin_remark = ?, status = "Active" WHERE id = ?',
                [status, remark || null, req.params.id]
            );
        } else {
            await executeQuery(
                'UPDATE users SET broker_status = ?, admin_remark = ? WHERE id = ?',
                [status, remark || null, req.params.id]
            );
        }

        // If approved and plan is available, create active subscription with resolved duration
        if (shouldCreateOrUpdateSubscription && status === 'Approved' && resolvedPlanId && resolvedSubscriptionDays) {
            const plans = await executeQuery(
                'SELECT * FROM plans WHERE id = ? AND plan_type = ?',
                [resolvedPlanId, 'Broker']
            );

            if (plans.length > 0) {
                const plan = plans[0];
                const now = new Date();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + parseInt(resolvedSubscriptionDays));

                // Check if active subscription already exists
                const existingSub = await executeQuery(
                    'SELECT id FROM subscriptions WHERE user_id = ? AND payment_status = "Completed" AND expires_at > NOW()',
                    [req.params.id]
                );

                if (existingSub.length === 0) {
                    await executeQuery(
                        `INSERT INTO subscriptions (user_id, plan_id, amount_paid, starts_at, expires_at, payment_status, transaction_id)
                         VALUES (?, ?, ?, ?, ?, 'Completed', ?)`,
                        [req.params.id, resolvedPlanId, plan.price, now, expiresAt, `ADMIN_APPROVED_${Date.now()}`]
                    );
                    // Subscription created
                } else {
                    // Active subscription already exists
                }
            } else {
                // Plan not found
            }
        } else if (shouldCreateOrUpdateSubscription && status === 'Approved') {
            // Broker approved but no plan details provided
        }

        // Send email notification
        await sendBrokerApprovalEmail(brokers[0].email, brokers[0].name, status, remark);

        // Create notification
        await insertAdminNotification({
            userId: req.params.id,
            type: 'Broker_Approved',
            title: `Broker Account ${requestedStatus}`,
            message: `Your broker account has been ${requestedStatus.toLowerCase()}`,
        });

        res.json({
            success: true,
            message: `Broker status updated to ${requestedStatus}`,
            subscriptionCreated: shouldCreateOrUpdateSubscription && status === 'Approved' && !!(resolvedPlanId && resolvedSubscriptionDays)
        });

    } catch (error) {
        next(error);
    }
});

// Get all rooms
router.get('/rooms', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { status, listingType, city, search, page = 1, limit = 20 } = req.query;
        let searchOrdering = 'r.post_date DESC';
        let searchScoreExpression = '0';

        let sql = `
            SELECT r.*, u.name as owner_name, u.contact as owner_contact, u.email as owner_email,
                   ${searchScoreExpression} as search_score
            FROM rooms r
            JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }

        if (listingType) {
            sql += ' AND r.listing_type = ?';
            params.push(listingType);
        }

        if (city) {
            sql += ' AND r.city = ?';
            params.push(city);
        }

        if (search) {
            const normalizedSearch = String(search).trim().toLowerCase();
            const searchTokens = Array.from(
                new Set(
                    normalizedSearch
                        .split(/[\s,]+/)
                        .map((token) => token.trim())
                        .filter((token) => token.length >= 2)
                )
            ).slice(0, 6);

            const searchableExpression =
                "LOWER(CONCAT_WS(' ', r.title, r.room_id, r.city, r.area, u.name, IFNULL(CAST(r.meta_data AS CHAR), '')))";

            if (searchTokens.length > 0) {
                sql += ` AND (${searchTokens
                    .map(
                        () => `(
                            ${searchableExpression} LIKE ?
                            OR SOUNDEX(r.title) = SOUNDEX(?)
                            OR SOUNDEX(r.area) = SOUNDEX(?)
                            OR SOUNDEX(r.city) = SOUNDEX(?)
                            OR SOUNDEX(u.name) = SOUNDEX(?)
                        )`
                    )
                    .join(' AND ')})`;

                const scoreParts = [];
                const scoreParams = [];

                searchTokens.forEach((token) => {
                    params.push(`%${token}%`, token, token, token, token);

                    scoreParts.push('CASE WHEN LOWER(r.room_id) = ? THEN 200 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN LOWER(r.title) LIKE ? THEN 140 ELSE 0 END');
                    scoreParams.push(`%${token}%`);
                    scoreParts.push('CASE WHEN LOWER(r.area) = ? THEN 130 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN LOWER(r.city) = ? THEN 120 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN LOWER(u.name) LIKE ? THEN 90 ELSE 0 END');
                    scoreParams.push(`%${token}%`);
                    scoreParts.push('CASE WHEN SOUNDEX(r.title) = SOUNDEX(?) THEN 45 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN SOUNDEX(r.area) = SOUNDEX(?) THEN 40 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN SOUNDEX(r.city) = SOUNDEX(?) THEN 35 ELSE 0 END');
                    scoreParams.push(token);
                    scoreParts.push('CASE WHEN SOUNDEX(u.name) = SOUNDEX(?) THEN 30 ELSE 0 END');
                    scoreParams.push(token);
                });

                scoreParts.push('CASE WHEN LOWER(r.title) LIKE ? THEN 180 ELSE 0 END');
                scoreParams.push(`%${normalizedSearch}%`);
                scoreParts.push('CASE WHEN LOWER(r.room_id) LIKE ? THEN 200 ELSE 0 END');
                scoreParams.push(`%${normalizedSearch}%`);

                searchScoreExpression = scoreParts.join(' + ');
                searchOrdering = 'search_score DESC, r.post_date DESC';
                sql = sql.replace('0 as search_score', `${searchScoreExpression} as search_score`);
                params.unshift(...scoreParams);
            } else {
                sql += ` AND ${searchableExpression} LIKE ?`;
                params.push(`%${normalizedSearch}%`);

                searchScoreExpression = 'CASE WHEN LOWER(r.title) LIKE ? THEN 120 ELSE 0 END';
                searchOrdering = 'search_score DESC, r.post_date DESC';
                sql = sql.replace('0 as search_score', `${searchScoreExpression} as search_score`);
                params.unshift(`%${normalizedSearch}%`);
            }
        }

        sql += ` ORDER BY ${searchOrdering}`;

        const rooms = await executeQuery(sql, params);

        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedRooms = rooms.slice(startIndex, endIndex);

        // Filter sensitive data before sending response
        const filteredRooms = paginatedRooms.map(room => ({
            id: room.id,
            room_id: room.room_id,
            title: room.title,
            listing_type: room.listing_type,
            room_type: room.room_type,
            city: room.city,
            area: room.area,
            rent: room.rent,
            deposit: room.deposit,
            cost: room.cost,
            post_date: room.post_date,
            status: room.status,
            is_occupied: room.is_occupied,
            views_count: room.views_count,
            owner_id: room.user_id,
            owner_name: room.owner_name,
            // Do NOT return: owner_contact, owner_email, address details
        }));

        res.json({
            success: true,
            data: filteredRooms,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(rooms.length / parseInt(limit)),
                totalItems: rooms.length,
                itemsPerPage: parseInt(limit)
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get room statistics
router.get('/rooms/stats', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const stats = await executeQuery(`
            SELECT 
                (SELECT COUNT(*) FROM rooms WHERE status = 'Approved') as approved_count,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Pending') as pending_count,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Hold') as hold_count,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Rejected') as rejected_count,
                (SELECT COUNT(*) FROM rooms) as total_count
        `);

        res.json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        next(error);
    }
});

// Get room details
router.get('/rooms/:roomId', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            `SELECT r.*, u.name as owner_name, u.contact as owner_contact, u.email as owner_email,
                    u.unique_id as owner_unique_id
             FROM rooms r
             JOIN users u ON r.user_id = u.id
             WHERE r.room_id = ?`,
            [req.params.roomId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Get existing roommates (from roommates table where room_id is set)
        const roommates = await executeQuery(
            'SELECT name, city FROM roommates WHERE room_id = ? AND room_id IS NOT NULL',
            [rooms[0].id]
        );

        res.json({
            success: true,
            data: {
                ...rooms[0],
                existing_roommates: roommates
            }
        });

    } catch (error) {
        next(error);
    }
});

// Update room status
router.put('/rooms/:roomId/status', authenticate, requireAdmin, [
    body('status').isIn(['Pending', 'Approved', 'Hold', 'Rejected', 'Expired']),
    body('remark').optional().trim()
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

        const { status, remark } = req.body;

        const rooms = await executeQuery(
            `SELECT r.id, r.room_id, r.title, r.user_id, u.email, u.name
             FROM rooms r
             JOIN users u ON r.user_id = u.id
             WHERE r.room_id = ?`,
            [req.params.roomId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];

        await executeQuery(
            'UPDATE rooms SET status = ?, admin_remark = ? WHERE room_id = ?',
            [status, remark || null, req.params.roomId]
        );

        // Send email notification
        const { sendRoomApprovalEmail } = require('../utils/email');
        await sendRoomApprovalEmail(room.email, room.name, room.title, room.room_id, status);

        // Create notification
        await insertAdminNotification({
            userId: room.user_id,
            type: 'Room_Approved',
            title: `Room ${status}`,
            message: `Your room "${room.title}" has been ${status.toLowerCase()}`,
            referenceId: room.room_id,
            referenceType: 'room',
        });

        res.json({
            success: true,
            message: `Room status updated to ${status}`
        });

    } catch (error) {
        next(error);
    }
});

// Get reports
router.get('/reports', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const validTypes = ['all', 'registrations', 'rooms', 'expenses'];
        const requestedType = req.query.type || 'all';

        if (!validTypes.includes(requestedType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid report type. Allowed values: all, registrations, rooms, expenses'
            });
        }

        const now = new Date();
        const defaultStart = new Date(now);
        defaultStart.setDate(now.getDate() - 29);

        const startInput = req.query.startDate ? new Date(`${req.query.startDate}T00:00:00`) : defaultStart;
        const endInput = req.query.endDate ? new Date(`${req.query.endDate}T23:59:59`) : new Date(now.setHours(23, 59, 59, 999));

        if (Number.isNaN(startInput.getTime()) || Number.isNaN(endInput.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date range'
            });
        }

        if (startInput > endInput) {
            return res.status(400).json({
                success: false,
                message: 'startDate cannot be greater than endDate'
            });
        }

        const formatDateTime = (value) => {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            const hours = String(value.getHours()).padStart(2, '0');
            const minutes = String(value.getMinutes()).padStart(2, '0');
            const seconds = String(value.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };

        const type = requestedType;
        const startDate = formatDateTime(startInput);
        const endDate = formatDateTime(endInput);

        let data = {};

        if (type === 'registrations' || type === 'all') {
            data.registrations = await executeQuery(`
                SELECT DATE(registration_date) as date, COUNT(*) as count
                FROM users
                WHERE registration_date BETWEEN ? AND ?
                GROUP BY DATE(registration_date)
                ORDER BY date
            `, [startDate, endDate]);
        }

        if (type === 'rooms' || type === 'all') {
            data.rooms = await executeQuery(`
                SELECT DATE(post_date) as date, COUNT(*) as count
                FROM rooms
                WHERE post_date BETWEEN ? AND ?
                GROUP BY DATE(post_date)
                ORDER BY date
            `, [startDate, endDate]);
        }

        if (type === 'expenses' || type === 'all') {
            data.expenses = await executeQuery(`
                SELECT DATE(created_at) as date, COUNT(*) as count, SUM(cost) as total
                FROM expenses
                WHERE created_at BETWEEN ? AND ?
                GROUP BY DATE(created_at)
                ORDER BY date
            `, [startDate, endDate]);
        }

        res.json({
            success: true,
            data,
            filters: {
                type,
                startDate,
                endDate
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get contact lead summary
router.get('/leads/stats', authenticate, requireAdmin, async (req, res, next) => {
    try {
        await ensureContactLeadsTable();

        const [stats] = await executeQuery(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_spam = 0 THEN 1 ELSE 0 END) AS valid,
                SUM(CASE WHEN status = 'New' AND is_spam = 0 THEN 1 ELSE 0 END) AS new_count,
                SUM(CASE WHEN status = 'In Progress' AND is_spam = 0 THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status = 'Closed' AND is_spam = 0 THEN 1 ELSE 0 END) AS closed,
                SUM(CASE WHEN is_spam = 1 OR status = 'Spam' THEN 1 ELSE 0 END) AS spam
            FROM contact_leads
        `);

        res.json({
            success: true,
            data: {
                total: Number(stats?.total || 0),
                valid: Number(stats?.valid || 0),
                new: Number(stats?.new_count || 0),
                in_progress: Number(stats?.in_progress || 0),
                closed: Number(stats?.closed || 0),
                spam: Number(stats?.spam || 0)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get contact leads
router.get('/leads', authenticate, requireAdmin, async (req, res, next) => {
    try {
        await ensureContactLeadsTable();

        const page = Math.max(Number.parseInt(String(req.query.page || '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
        const offset = (page - 1) * limit;
        const status = String(req.query.status || 'all').trim();
        const spamFilter = String(req.query.spam || 'exclude').trim();
        const search = String(req.query.search || '').trim();

        let whereClause = 'WHERE 1 = 1';
        const params = [];

        if (status !== 'all' && CONTACT_LEAD_STATUSES.includes(status)) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        if (spamFilter === 'exclude') {
            whereClause += ' AND is_spam = 0 AND status != ?';
            params.push('Spam');
        } else if (spamFilter === 'only') {
            whereClause += ' AND (is_spam = 1 OR status = ?)';
            params.push('Spam');
        }

        if (search) {
            const searchTerm = `%${escapeLikeSearchTerm(search)}%`;
            whereClause += `
                AND (
                    name LIKE ? ESCAPE '\\'
                    OR email LIKE ? ESCAPE '\\'
                    OR phone LIKE ? ESCAPE '\\'
                    OR subject LIKE ? ESCAPE '\\'
                    OR message LIKE ? ESCAPE '\\'
                )`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const leads = await executeQuery(
            `SELECT id, name, email, phone, subject, message, source_page, status,
                    admin_remark, is_spam, spam_score, spam_reason, ip_address,
                    user_agent, reviewed_by, reviewed_at, submitted_at, updated_at
             FROM contact_leads
             ${whereClause}
             ORDER BY submitted_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        const [countResult] = await executeQuery(
            `SELECT COUNT(*) AS total
             FROM contact_leads
             ${whereClause}`,
            params
        );

        const totalItems = Number(countResult?.total || 0);
        const totalPages = Math.max(Math.ceil(totalItems / limit), 1);

        res.json({
            success: true,
            data: leads,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        next(error);
    }
});

// Update contact lead status
router.put('/leads/:id/status', authenticate, requireAdmin, [
    body('status').isIn(CONTACT_LEAD_STATUSES),
    body('adminRemark').optional().isString().trim().isLength({ max: 2000 })
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

        await ensureContactLeadsTable();

        const { id } = req.params;
        const { status, adminRemark } = req.body;

        const existing = await executeQuery('SELECT id FROM contact_leads WHERE id = ? LIMIT 1', [id]);
        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }

        await executeQuery(
            `UPDATE contact_leads
             SET status = ?,
                 admin_remark = ?,
                 is_spam = ?,
                 reviewed_by = ?,
                 reviewed_at = NOW()
             WHERE id = ?`,
            [
                status,
                String(adminRemark || '').trim() || null,
                status === 'Spam',
                req.user.userId,
                id
            ]
        );

        res.json({
            success: true,
            message: 'Lead updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Get cities list
router.get('/cities', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const cities = await executeQuery(
            'SELECT city_name, district FROM maharashtra_cities WHERE is_active = TRUE ORDER BY city_name'
        );

        res.json({
            success: true,
            data: cities
        });

    } catch (error) {
        next(error);
    }
});

// Get broker plans
router.get('/plans', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { planType = 'Broker' } = req.query;
        let sql = 'SELECT * FROM plans';
        const params = [];

        if (planType !== 'all') {
            if (!['Regular', 'Broker'].includes(planType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid plan type. Allowed values: all, Regular, Broker'
                });
            }

            sql += ' WHERE plan_type = ?';
            params.push(planType);
        }

        sql += ' ORDER BY plan_type, duration_days, price';

        const plans = await executeQuery(sql, params);

        res.json({
            success: true,
            data: plans
        });

    } catch (error) {
        next(error);
    }
});

router.post('/plans', authenticate, requireAdmin, [
    body('plan_name').trim().notEmpty().withMessage('Plan name is required'),
    body('plan_code').trim().notEmpty().withMessage('Plan code is required'),
    body('plan_type').isIn(['Regular', 'Broker']).withMessage('Plan type must be Regular or Broker'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a valid non-negative number'),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration days must be at least 1'),
    body('description').optional().trim(),
    body('features').optional(),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
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

        const {
            plan_name,
            plan_code,
            plan_type,
            description,
            price,
            duration_days,
            features,
            is_active
        } = req.body;

        const featurePayload = normalizePlanFeatures(features);

        const result = await executeQuery(
            `INSERT INTO plans (plan_name, plan_code, plan_type, description, price, duration_days, features, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(plan_name).trim(),
                String(plan_code).trim(),
                plan_type,
                description ? String(description).trim() : null,
                Number(price),
                parseInt(duration_days, 10),
                featurePayload,
                is_active === undefined ? true : Boolean(is_active)
            ]
        );

        const createdPlanRows = await executeQuery('SELECT * FROM plans WHERE id = ?', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: createdPlanRows[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Plan code already exists'
            });
        }

        next(error);
    }
});

router.put('/plans/:id', authenticate, requireAdmin, [
    body('plan_name').trim().notEmpty().withMessage('Plan name is required'),
    body('plan_code').trim().notEmpty().withMessage('Plan code is required'),
    body('plan_type').isIn(['Regular', 'Broker']).withMessage('Plan type must be Regular or Broker'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a valid non-negative number'),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration days must be at least 1'),
    body('description').optional().trim(),
    body('features').optional(),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
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

        const existingPlans = await executeQuery('SELECT id FROM plans WHERE id = ?', [req.params.id]);
        if (existingPlans.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        const {
            plan_name,
            plan_code,
            plan_type,
            description,
            price,
            duration_days,
            features,
            is_active
        } = req.body;

        const featurePayload = normalizePlanFeatures(features);

        await executeQuery(
            `UPDATE plans
             SET plan_name = ?,
                 plan_code = ?,
                 plan_type = ?,
                 description = ?,
                 price = ?,
                 duration_days = ?,
                 features = ?,
                 is_active = ?
             WHERE id = ?`,
            [
                String(plan_name).trim(),
                String(plan_code).trim(),
                plan_type,
                description ? String(description).trim() : null,
                Number(price),
                parseInt(duration_days, 10),
                featurePayload,
                is_active === undefined ? true : Boolean(is_active),
                req.params.id
            ]
        );

        const updatedPlanRows = await executeQuery('SELECT * FROM plans WHERE id = ?', [req.params.id]);

        res.json({
            success: true,
            message: 'Plan updated successfully',
            data: updatedPlanRows[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Plan code already exists'
            });
        }

        next(error);
    }
});

router.patch('/plans/:id/status', authenticate, requireAdmin, [
    body('is_active').isBoolean().withMessage('is_active must be boolean')
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

        const existingPlans = await executeQuery('SELECT id FROM plans WHERE id = ?', [req.params.id]);
        if (existingPlans.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        await executeQuery('UPDATE plans SET is_active = ? WHERE id = ?', [Boolean(req.body.is_active), req.params.id]);

        const updatedPlanRows = await executeQuery('SELECT * FROM plans WHERE id = ?', [req.params.id]);

        res.json({
            success: true,
            message: `Plan ${req.body.is_active ? 'activated' : 'deactivated'} successfully`,
            data: updatedPlanRows[0]
        });
    } catch (error) {
        next(error);
    }
});

router.get('/ads', authenticate, requireAdmin, async (req, res, next) => {
    try {
        await ensureAdsTable();

        const ads = await executeQuery(
            `SELECT id, banner_title, description, images_json, priority, card_placement, start_date, end_date, is_active, created_at, updated_at,
                    CASE
                        WHEN is_active = TRUE AND CURDATE() BETWEEN start_date AND end_date THEN 'Running'
                        WHEN is_active = TRUE AND CURDATE() < start_date THEN 'Scheduled'
                        WHEN is_active = TRUE AND CURDATE() > end_date THEN 'Expired'
                        ELSE 'Inactive'
                    END AS status_display
             FROM ads
             ORDER BY priority DESC, created_at DESC`
        );

        res.json({
            success: true,
            data: ads.map(mapAdRow)
        });
    } catch (error) {
        next(error);
    }
});

router.post('/ads/upload-images', authenticate, requireAdmin, handleUpload('images', 8), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images uploaded'
            });
        }

        const imageUrls = await uploadImageFiles(req.files, 'ads');

        if (imageUrls.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Image upload failed. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'Ad images uploaded successfully',
            data: { imageUrls }
        });
    } catch (error) {
        next(error);
    }
});

router.post('/ads', authenticate, requireAdmin, [
    body('banner_title').trim().notEmpty().withMessage('Banner title is required'),
    body('description').optional().trim(),
    body('images').optional().custom((value) => Array.isArray(value) || typeof value === 'string').withMessage('images must be an array or string'),
    body('priority').optional().isInt({ min: 0 }).withMessage('priority must be a non-negative integer'),
    body('card_placement').optional().isString().withMessage('card_placement must be a string'),
    body('start_date').isISO8601().withMessage('Valid start date is required'),
    body('end_date').isISO8601().withMessage('Valid end date is required'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
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

        await ensureAdsTable();

    const { banner_title, description, images, priority, card_placement, start_date, end_date, is_active } = req.body;

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be greater than end date'
            });
        }

        const result = await executeQuery(
            `INSERT INTO ads (banner_title, description, images_json, priority, card_placement, start_date, end_date, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,

            [
                String(banner_title).trim(),
                description ? String(description).trim() : null,
                normalizeAdImages(images),
                priority === undefined ? 0 : Number(priority),
                card_placement || 'MP_Search',
                start_date,
                end_date,
                is_active === undefined ? true : Boolean(is_active)
            ]
        );

        const createdAdRows = await executeQuery('SELECT * FROM ads WHERE id = ?', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Ad created successfully',
            data: mapAdRow(createdAdRows[0])
        });
    } catch (error) {
        next(error);
    }
});

router.put('/ads/:id', authenticate, requireAdmin, [
    body('banner_title').trim().notEmpty().withMessage('Banner title is required'),
    body('description').optional().trim(),
    body('images').optional().custom((value) => Array.isArray(value) || typeof value === 'string').withMessage('images must be an array or string'),
    body('priority').optional().isInt({ min: 0 }).withMessage('priority must be a non-negative integer'),
    body('card_placement').optional().isString().withMessage('card_placement must be a string'),
    body('start_date').isISO8601().withMessage('Valid start date is required'),
    body('end_date').isISO8601().withMessage('Valid end date is required'),
    body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
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

        await ensureAdsTable();

        const existingAds = await executeQuery('SELECT id FROM ads WHERE id = ?', [req.params.id]);
        if (existingAds.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }

    const { banner_title, description, images, priority, card_placement, start_date, end_date, is_active } = req.body;

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be greater than end date'
            });
        }

        await executeQuery(
            `UPDATE ads
             SET banner_title = ?, description = ?, images_json = ?, priority = ?, card_placement = ?, start_date = ?, end_date = ?, is_active = ?
             WHERE id = ?`,

            [
                String(banner_title).trim(),
                description ? String(description).trim() : null,
                normalizeAdImages(images),
                priority === undefined ? 0 : Number(priority),
                card_placement || 'MP_Search',
                start_date,
                end_date,
                is_active === undefined ? true : Boolean(is_active),
                req.params.id
            ]
        );

        const updatedAdRows = await executeQuery('SELECT * FROM ads WHERE id = ?', [req.params.id]);

        res.json({
            success: true,
            message: 'Ad updated successfully',
            data: mapAdRow(updatedAdRows[0])
        });
    } catch (error) {
        next(error);
    }
});

router.patch('/ads/:id/status', authenticate, requireAdmin, [
    body('is_active').isBoolean().withMessage('is_active must be boolean')
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

        await ensureAdsTable();

        const existingAds = await executeQuery('SELECT id FROM ads WHERE id = ?', [req.params.id]);
        if (existingAds.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Ad not found'
            });
        }

        await executeQuery('UPDATE ads SET is_active = ? WHERE id = ?', [Boolean(req.body.is_active), req.params.id]);

        const updatedAdRows = await executeQuery('SELECT * FROM ads WHERE id = ?', [req.params.id]);

        res.json({
            success: true,
            message: `Ad ${req.body.is_active ? 'activated' : 'deactivated'} successfully`,
            data: mapAdRow(updatedAdRows[0])
        });
    } catch (error) {
        next(error);
    }
});

const getSubscriptionUpgradeRequestsHandler = async (req, res, next) => {
    try {
        await ensureSubscriptionsAdminRemarkColumn();

        const requests = await executeQuery(
                `SELECT s.id, s.user_id, s.plan_id, s.amount_paid, s.starts_at, s.expires_at,
                    s.payment_status, s.created_at, s.admin_remark,
                    u.unique_id as broker_unique_id, u.name as broker_name, u.email as broker_email,
                    u.selected_plan_id as current_plan_id,
                    p.plan_name as requested_plan_name, p.duration_days as requested_duration_days,
                    cp.plan_name as current_plan_name
             FROM subscriptions s
             JOIN users u ON s.user_id = u.id
             JOIN plans p ON s.plan_id = p.id
             LEFT JOIN plans cp ON u.selected_plan_id = cp.id
             WHERE u.role = 'Broker' AND s.payment_status = 'Pending'
             ORDER BY s.created_at DESC`
        );

        const userIds = [...new Set(requests.map((request) => request.user_id).filter(Boolean))];
        const activeExpiryByUserId = new Map();

        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(', ');
            const activeSubscriptions = await executeQuery(
                `SELECT s.user_id, s.expires_at
                 FROM subscriptions s
                 INNER JOIN (
                    SELECT user_id, MAX(expires_at) as max_expires_at
                    FROM subscriptions
                    WHERE payment_status = 'Completed' AND DATE(expires_at) >= CURDATE() AND user_id IN (${placeholders})
                    GROUP BY user_id
                 ) latest ON s.user_id = latest.user_id AND s.expires_at = latest.max_expires_at
                 WHERE s.payment_status = 'Completed'`,
                userIds
            );

            activeSubscriptions.forEach((sub) => {
                if (sub?.user_id && sub?.expires_at) {
                    const parsedExpiry = toCalendarSafeDate(sub.expires_at);
                    if (parsedExpiry) {
                        activeExpiryByUserId.set(sub.user_id, parsedExpiry);
                    }
                }
            });
        }

        const formattedRequests = requests.map((request) => {
            const now = new Date();
            const activeExpiry = activeExpiryByUserId.get(request.user_id);
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const activeSubscriptionExists =
                activeExpiry instanceof Date &&
                !Number.isNaN(activeExpiry.getTime()) &&
                activeExpiry >= startOfToday;

            const effectiveStartsAt = activeSubscriptionExists
                ? addCalendarDays(activeExpiry, 1)
                : (toCalendarSafeDate(request.starts_at) || toCalendarSafeDate(new Date()) || new Date());

            if (Number.isNaN(effectiveStartsAt.getTime())) {
                effectiveStartsAt.setTime(now.getTime());
            }

            const effectiveExpiresAt = request.expires_at
                ? (toCalendarSafeDate(request.expires_at) || new Date(effectiveStartsAt))
                : new Date(effectiveStartsAt);

            if (!request.expires_at) {
                effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + Number(request.requested_duration_days || 0));
                effectiveExpiresAt.setHours(12, 0, 0, 0);
            }

            const carryForwardDays = Math.max(
                0,
                Math.ceil((new Date(effectiveStartsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );

            return {
                id: request.id,
                user_id: request.user_id,
                broker_unique_id: request.broker_unique_id,
                broker_name: request.broker_name,
                broker_email: request.broker_email,
                current_plan_id: request.current_plan_id,
                current_plan_name: request.current_plan_name,
                requested_plan_id: request.plan_id,
                requested_plan_name: request.requested_plan_name,
                requested_duration_days: request.requested_duration_days,
                amount_paid: request.amount_paid,
                starts_at: request.starts_at,
                expires_at: request.expires_at,
                created_at: request.created_at,
                admin_remark: request.admin_remark || null,
                request_type: request.current_plan_id && request.current_plan_id !== request.plan_id ? 'Upgrade' : 'Renewal',
                effective_starts_at: effectiveStartsAt,
                effective_expires_at: effectiveExpiresAt,
                carry_forward_days: carryForwardDays
            };
        });

        res.json({
            success: true,
            data: formattedRequests
        });
    } catch (error) {
        next(error);
    }
};

// Get pending broker subscription upgrade/renewal requests
router.get('/subscription-upgrade-requests', authenticate, requireAdmin, getSubscriptionUpgradeRequestsHandler);
router.get('/subscription-upgrade-request', authenticate, requireAdmin, getSubscriptionUpgradeRequestsHandler);

const decideSubscriptionUpgradeRequestHandler = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        await ensureSubscriptionsAdminRemarkColumn();

        const {
            status,
            remark,
            admin_remark: adminRemark,
            plan_id: overridePlanId,
            starts_at: overrideStartsAt,
            expires_at: overrideExpiresAt
        } = req.body;
        const { id } = req.params;

        const requests = await executeQuery(
            `SELECT s.id, s.user_id, s.plan_id, s.payment_status, s.starts_at, s.expires_at,
                    u.name as broker_name, u.email as broker_email
             FROM subscriptions s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = ? AND u.role = 'Broker'`,
            [id]
        );

        if (requests.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Upgrade request not found'
            });
        }

        const request = requests[0];

        if (request.payment_status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `Request is already ${request.payment_status}`
            });
        }

        const incomingRemark = typeof remark === 'string'
            ? remark
            : (typeof adminRemark === 'string' ? adminRemark : null);
        const normalizedRemark = typeof incomingRemark === 'string' ? incomingRemark.trim() : null;

        if (status === 'Completed') {
            const selectedPlanId = overridePlanId ? Number(overridePlanId) : Number(request.plan_id);
            if (!Number.isInteger(selectedPlanId) || selectedPlanId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'A valid plan_id is required'
                });
            }

            const planRows = await executeQuery(
                'SELECT duration_days FROM plans WHERE id = ? AND plan_type = ? AND is_active = TRUE',
                [selectedPlanId, 'Broker']
            );

            if (planRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected upgrade plan is invalid or inactive'
                });
            }

            const activeSubs = await executeQuery(
                `SELECT expires_at
                 FROM subscriptions
                 WHERE user_id = ? AND payment_status = 'Completed' AND DATE(expires_at) >= CURDATE()
                 ORDER BY expires_at DESC
                 LIMIT 1`,
                [request.user_id]
            );

            const fallbackStart = activeSubs.length > 0
                ? addCalendarDays(toCalendarSafeDate(activeSubs[0].expires_at) || toCalendarSafeDate(new Date()) || new Date(), 1)
                : (toCalendarSafeDate(request.starts_at) || toCalendarSafeDate(new Date()) || new Date());

            const requestedStartAt = overrideStartsAt
                ? (toCalendarSafeDate(overrideStartsAt) || new Date(overrideStartsAt))
                : fallbackStart;

            const hasActiveSubscription = activeSubs.length > 0;
            const effectiveStartsAt = hasActiveSubscription && requestedStartAt < fallbackStart
                ? fallbackStart
                : requestedStartAt;

            if (Number.isNaN(effectiveStartsAt.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid starts_at value'
                });
            }

            let effectiveExpiresAt;
            if (overrideExpiresAt) {
                effectiveExpiresAt = toCalendarSafeDate(overrideExpiresAt) || new Date(overrideExpiresAt);
                if (Number.isNaN(effectiveExpiresAt.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid expires_at value'
                    });
                }
            } else {
                effectiveExpiresAt = new Date(effectiveStartsAt);
                effectiveExpiresAt.setDate(effectiveExpiresAt.getDate() + Number(planRows[0].duration_days || 0));
                effectiveExpiresAt.setHours(12, 0, 0, 0);
            }

            if (effectiveExpiresAt <= effectiveStartsAt) {
                return res.status(400).json({
                    success: false,
                    message: 'expires_at must be after starts_at'
                });
            }

            await executeQuery(
                `UPDATE subscriptions
                 SET payment_status = 'Completed', transaction_id = ?, plan_id = ?, starts_at = ?, expires_at = ?, admin_remark = ?
                 WHERE id = ?`,
                [`ADMIN_UPGRADE_${Date.now()}`, selectedPlanId, effectiveStartsAt, effectiveExpiresAt, normalizedRemark, id]
            );

            await executeQuery(
                'UPDATE users SET selected_plan_id = ? WHERE id = ?',
                [selectedPlanId, request.user_id]
            );

            await insertAdminNotification({
                userId: request.user_id,
                type: 'System',
                title: 'Subscription Updated',
                message: 'Your subscription upgrade request has been approved and activated.',
                referenceId: id,
                referenceType: 'subscription',
            });

            const selectedPlanRows = await executeQuery(
                'SELECT plan_name FROM plans WHERE id = ? LIMIT 1',
                [selectedPlanId]
            );

            await sendSubscriptionDecisionEmail(
                request.broker_email,
                request.broker_name,
                'Approved',
                normalizedRemark || '',
                selectedPlanRows[0]?.plan_name || '',
                effectiveStartsAt.toISOString().slice(0, 10),
                effectiveExpiresAt.toISOString().slice(0, 10)
            );
        } else {
            await executeQuery(
                `UPDATE subscriptions
                 SET payment_status = 'Failed', transaction_id = ?, admin_remark = ?
                 WHERE id = ?`,
                [`ADMIN_REJECTED_${Date.now()}`, normalizedRemark, id]
            );

            await insertAdminNotification({
                userId: request.user_id,
                type: 'System',
                title: 'Subscription Request Rejected',
                message: normalizedRemark || 'Your subscription upgrade request has been rejected. Please contact support.',
                referenceId: id,
                referenceType: 'subscription',
            });

            await sendSubscriptionDecisionEmail(
                request.broker_email,
                request.broker_name,
                'Rejected',
                normalizedRemark || ''
            );
        }

        res.json({
            success: true,
            message: `Upgrade request ${status === 'Completed' ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        next(error);
    }
};

// Approve/Reject broker subscription upgrade request
router.put('/subscription-upgrade-requests/:id/decision', authenticate, requireAdmin, [
    body('status').isIn(['Completed', 'Failed']),
    body('remark').optional().isString().trim(),
    body('admin_remark').optional().isString().trim(),
    body('plan_id').optional().isInt({ min: 1 }),
    body('starts_at').optional().isISO8601(),
    body('expires_at').optional().isISO8601()
], decideSubscriptionUpgradeRequestHandler);

router.put('/subscription-upgrade-request/:id/decision', authenticate, requireAdmin, [
    body('status').isIn(['Completed', 'Failed']),
    body('remark').optional().isString().trim(),
    body('admin_remark').optional().isString().trim(),
    body('plan_id').optional().isInt({ min: 1 }),
    body('starts_at').optional().isISO8601(),
    body('expires_at').optional().isISO8601()
], decideSubscriptionUpgradeRequestHandler);

// Get all broker subscriptions (with user and plan details)
router.get('/broker-subscriptions', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let whereClauses = ['u.role = "Broker"'];
        let queryParams = [];

        if (status && status !== 'all') {
            whereClauses.push('s.payment_status = ?');
            queryParams.push(status);
        }

        if (search) {
            whereClauses.push('(u.name LIKE ? OR u.email LIKE ? OR u.unique_id LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const safeOffset = (Math.max(1, Number(page) || 1) - 1) * safeLimit;

        const subscriptions = await executeQuery(`
            SELECT 
                s.id,
                s.user_id,
                s.plan_id,
                s.amount_paid,
                s.starts_at,
                s.expires_at,
                s.payment_status,
                s.transaction_id,
                s.admin_remark,
                s.created_at,
                u.unique_id as broker_unique_id,
                u.name as broker_name,
                u.email as broker_email,
                u.contact as broker_contact,
                p.plan_name,
                p.price as plan_price,
                p.duration_days,
                CASE 
                    WHEN s.payment_status = 'Completed' AND DATE(s.expires_at) >= CURDATE() THEN 'Active'
                    WHEN s.payment_status = 'Completed' AND DATE(s.expires_at) < CURDATE() THEN 'Expired'
                    ELSE s.payment_status
                END as status_display
            FROM subscriptions s
            INNER JOIN users u ON s.user_id = u.id
            INNER JOIN plans p ON s.plan_id = p.id
            ${whereClause}
            ORDER BY s.created_at DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `, queryParams);

        const countResult = await executeQuery(`
            SELECT COUNT(DISTINCT s.id) as total
            FROM subscriptions s
            INNER JOIN users u ON s.user_id = u.id
            ${whereClause}
        `, queryParams);
        
        const total = countResult[0]?.total || 0;

        res.json({
            success: true,
            data: subscriptions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: Number(total),
                totalPages: Math.ceil(Number(total) / Number(limit))
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get specific broker's subscription history
router.get('/broker-subscriptions/user/:userId', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { userId } = req.params;

        const subscriptions = await executeQuery(`
            SELECT 
                s.id,
                s.user_id,
                s.plan_id,
                s.amount_paid,
                s.starts_at,
                s.expires_at,
                s.payment_status,
                s.transaction_id,
                s.admin_remark,
                s.created_at,
                p.plan_name,
                p.price as plan_price,
                p.duration_days,
                CASE 
                    WHEN s.payment_status = 'Completed' AND DATE(s.expires_at) >= CURDATE() THEN 'Active'
                    WHEN s.payment_status = 'Completed' AND DATE(s.expires_at) < CURDATE() THEN 'Expired'
                    ELSE s.payment_status
                END as status_display
            FROM subscriptions s
            INNER JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            data: subscriptions
        });
    } catch (error) {
        next(error);
    }
});

// Update broker subscription (plan, expiry, status with admin remark)
router.put('/broker-subscriptions/:id', authenticate, requireAdmin, [
    body('plan_id').optional().isInt({ min: 1 }),
    body('starts_at').optional().isISO8601(),
    body('expires_at').optional().isISO8601(),
    body('payment_status').optional().isIn(['Pending', 'Completed', 'Rejected', 'Suspended', 'Refunded']),
    body('admin_remark').optional().isString().trim()
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

        const { id } = req.params;
        const { plan_id, starts_at, expires_at, payment_status, admin_remark } = req.body;

        // Ensure admin_remark column exists
        await ensureSubscriptionsAdminRemarkColumn();

        // Get current subscription details
        const [subscription] = await executeQuery(
            'SELECT * FROM subscriptions WHERE id = ?',
            [id]
        );

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        // Get broker details for notification
        const [broker] = await executeQuery(
            'SELECT u.id, u.name, u.email FROM users u WHERE u.id = ?',
            [subscription.user_id]
        );

        // Build update query
        let updateFields = [];
        let updateParams = [];

        if (plan_id) {
            updateFields.push('plan_id = ?');
            updateParams.push(plan_id);
        }

        if (starts_at) {
            const startDate = toCalendarSafeDate(starts_at);
            updateFields.push('starts_at = ?');
            updateParams.push(startDate);
        }

        if (expires_at) {
            const expireDate = toCalendarSafeDate(expires_at);
            updateFields.push('expires_at = ?');
            updateParams.push(expireDate);
        }

        if (payment_status) {
            updateFields.push('payment_status = ?');
            updateParams.push(payment_status);
        }

        if (admin_remark !== undefined) {
            updateFields.push('admin_remark = ?');
            updateParams.push(admin_remark || null);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // Update subscription
        updateParams.push(id);
        await executeQuery(
            `UPDATE subscriptions SET ${updateFields.join(', ')} WHERE id = ?`,
            updateParams
        );

        // Get updated plan details for notification
        const finalPlanId = plan_id || subscription.plan_id;
        const [plan] = await executeQuery(
            'SELECT plan_name FROM plans WHERE id = ?',
            [finalPlanId]
        );

        // Create notification for broker
        const notificationMessage = admin_remark 
            ? `Your subscription has been updated. Admin Remark: ${admin_remark}`
            : `Your subscription has been updated.`;

        await insertAdminNotification({
            userId: subscription.user_id,
            type: 'System',
            title: 'Subscription Updated',
            message: notificationMessage,
            referenceId: id,
            referenceType: 'subscription',
        });

        // Send email notification
        if (broker && plan) {
            const finalStartsAt = starts_at || subscription.starts_at;
            const finalExpiresAt = expires_at || subscription.expires_at;
            const finalStatus = payment_status || subscription.payment_status;

            await sendSubscriptionDecisionEmail(
                broker.email,
                broker.name,
                finalStatus === 'Completed' ? 'Updated' : finalStatus,
                admin_remark || 'Your subscription has been updated by admin',
                plan.plan_name,
                new Date(finalStartsAt).toISOString().slice(0, 10),
                new Date(finalExpiresAt).toISOString().slice(0, 10)
            );
        }

        res.json({
            success: true,
            message: 'Subscription updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
