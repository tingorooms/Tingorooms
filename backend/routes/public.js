const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { executeQuery } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const { createSlug } = require('../utils/helpers');
const { getSiteSettings, DEFAULT_SITE_SETTINGS } = require('../utils/siteSettings');
const {
    computeSpamAssessment,
    ensureContactLeadsTable,
    getRequestIp,
    normalizeContactLeadPayload
} = require('../utils/contactLeads');

let hasVerifiedAdsTable = false;

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

    hasVerifiedAdsTable = true;
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

const parseSafePositiveInt = (value, fallback = 1, min = 1, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

// Get all approved rooms (public)
router.get('/rooms', async (req, res, next) => {
    try {
        const { 
            city, 
            area, 
            listingType, 
            roomType, 
            minRent, 
            maxRent, 
            furnishingType,
            gender,
            search,
            userId,
            page = 1, 
            limit = 12 
        } = req.query;

        let searchOrdering = 'r.post_date DESC';
        let searchScoreExpression = '0';

        let sql = `
            SELECT r.room_id, r.listing_type, r.title, r.room_type, r.house_type,
                   r.city, r.area, r.rent, r.deposit, r.cost, r.size_sqft,
                   r.availability_from, r.furnishing_type, r.facilities, 
                   r.preferred_gender, r.images, r.views_count, r.post_date,
                   r.contact, r.contact_visibility, r.user_id,
                   r.latitude, r.longitude,
                   u.name as owner_name, u.unique_id as owner_unique_id,
                   ${searchScoreExpression} as search_score
            FROM rooms r
            JOIN users u ON r.user_id = u.id
            WHERE r.status = 'Approved' AND r.is_occupied = FALSE AND r.deleted_at IS NULL
        `;
        const params = [];
        let searchScoreParams = [];

        if (city) {
            sql += ' AND r.city = ?';
            params.push(city);
        }

        if (area) {
            sql += ' AND r.area LIKE ?';
            params.push(`%${area}%`);
        }

        if (listingType) {
            sql += ' AND r.listing_type = ?';
            params.push(listingType);
        }

        if (roomType) {
            sql += ' AND r.room_type = ?';
            params.push(roomType);
        }

        if (minRent) {
            sql += ' AND (r.rent >= ? OR r.cost >= ?)';
            params.push(parseFloat(minRent), parseFloat(minRent));
        }

        if (maxRent) {
            sql += ' AND (r.rent <= ? OR r.cost <= ?)';
            params.push(parseFloat(maxRent), parseFloat(maxRent));
        }

        if (furnishingType) {
            sql += ' AND r.furnishing_type = ?';
            params.push(furnishingType);
        }

        if (gender) {
            sql += ' AND (r.preferred_gender = ? OR r.preferred_gender = "Any")';
            params.push(gender);
        }

        if (userId) {
            sql += ' AND r.user_id = ?';
            params.push(parseInt(userId));
        }

        if (search) {
            const normalizedSearch = String(search).trim().toLowerCase();
            const rawSearchTokens = Array.from(
                new Set(
                    normalizedSearch
                        .split(/[\s,]+/)
                        .map((token) => token.trim())
                        .filter((token) => token.length >= 2)
                )
            ).slice(0, 6);

            const normalizedCityFilter = city ? String(city).trim().toLowerCase() : '';
            const searchTokens = normalizedCityFilter
                ? rawSearchTokens.filter((token) => token !== normalizedCityFilter)
                : rawSearchTokens;
            const effectiveSearchTokens = searchTokens.length > 0 ? searchTokens : rawSearchTokens;

            const searchableExpression =
                "LOWER(CONCAT_WS(' ', r.title, r.area, r.city, r.address, r.pincode, r.listing_type, r.room_type, r.house_type, IFNULL(CAST(r.meta_data AS CHAR), '')))";

            const scoreParts = [];
            const scoreParams = [];

            if (effectiveSearchTokens.length > 0) {
                sql += ` AND (${effectiveSearchTokens
                    .map(
                        () => `(
                            ${searchableExpression} LIKE ?
                            OR SOUNDEX(r.area) = SOUNDEX(?)
                            OR SOUNDEX(r.city) = SOUNDEX(?)
                            OR SOUNDEX(r.title) = SOUNDEX(?)
                        )`
                    )
                    .join(' AND ')})`;

                effectiveSearchTokens.forEach((token) => {
                    params.push(`%${token}%`, token, token, token);

                    scoreParts.push('CASE WHEN LOWER(r.area) = ? THEN 160 ELSE 0 END');
                    scoreParams.push(token);

                    scoreParts.push('CASE WHEN LOWER(r.city) = ? THEN 150 ELSE 0 END');
                    scoreParams.push(token);

                    scoreParts.push('CASE WHEN LOWER(r.title) LIKE ? THEN 120 ELSE 0 END');
                    scoreParams.push(`%${token}%`);

                    scoreParts.push('CASE WHEN LOWER(r.address) LIKE ? THEN 70 ELSE 0 END');
                    scoreParams.push(`%${token}%`);

                    scoreParts.push("CASE WHEN LOWER(IFNULL(CAST(r.meta_data AS CHAR), '')) LIKE ? THEN 50 ELSE 0 END");
                    scoreParams.push(`%${token}%`);

                    scoreParts.push('CASE WHEN SOUNDEX(r.area) = SOUNDEX(?) THEN 45 ELSE 0 END');
                    scoreParams.push(token);

                    scoreParts.push('CASE WHEN SOUNDEX(r.city) = SOUNDEX(?) THEN 40 ELSE 0 END');
                    scoreParams.push(token);

                    scoreParts.push('CASE WHEN SOUNDEX(r.title) = SOUNDEX(?) THEN 30 ELSE 0 END');
                    scoreParams.push(token);
                });

                scoreParts.push('CASE WHEN LOWER(r.title) LIKE ? THEN 220 ELSE 0 END');
                scoreParams.push(`%${normalizedSearch}%`);

                scoreParts.push('CASE WHEN LOWER(r.area) LIKE ? THEN 140 ELSE 0 END');
                scoreParams.push(`%${normalizedSearch}%`);

                scoreParts.push('CASE WHEN LOWER(r.city) LIKE ? THEN 140 ELSE 0 END');
                scoreParams.push(`%${normalizedSearch}%`);

                searchScoreExpression = scoreParts.join(' + ');
                searchOrdering = 'search_score DESC, r.post_date DESC';

                sql = sql.replace('0 as search_score', `${searchScoreExpression} as search_score`);
                searchScoreParams = [...scoreParams];
            } else {
                sql += ` AND ${searchableExpression} LIKE ?`;
                params.push(`%${normalizedSearch}%`);

                searchScoreExpression = 'CASE WHEN LOWER(r.title) LIKE ? THEN 120 ELSE 0 END';
                searchOrdering = 'search_score DESC, r.post_date DESC';
                sql = sql.replace('0 as search_score', `${searchScoreExpression} as search_score`);
                searchScoreParams = [`%${normalizedSearch}%`];
            }
        }

        // Get total count for pagination
        const countResult = await executeQuery(
            sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM'),
            params
        );

        // Inline LIMIT/OFFSET as integer literals to avoid TiDB prepared-statement
        // type-coercion issues ("Incorrect arguments to LIMIT").
        const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
        const safePage  = Math.max(1, parseInt(page, 10) || 1);
        const safeOffset = (safePage - 1) * safeLimit;

        sql += ` ORDER BY ${searchOrdering} LIMIT ${safeLimit} OFFSET ${safeOffset}`;
        const resultParams = [
            ...searchScoreParams,
            ...params
        ];

        const rooms = await executeQuery(sql, resultParams);

        res.json({
            success: true,
            data: rooms,
            pagination: {
                currentPage: safePage,
                totalPages: Math.ceil(countResult[0].total / safeLimit),
                totalItems: countResult[0].total,
                itemsPerPage: safeLimit
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get active ads for homepage corner
router.get('/ads/active', async (req, res, next) => {
    try {
        await ensureAdsTable();

        let ads = await executeQuery(
            `SELECT id, banner_title, description, images_json, priority, card_placement, start_date, end_date
             FROM ads
             WHERE is_active = TRUE
               AND CURDATE() BETWEEN start_date AND end_date
             ORDER BY priority DESC, start_date DESC, created_at DESC
             LIMIT 10`
        );

        // Check for each card_placement separately and add defaults if missing
        const siteSettings = await getSiteSettings();
        const resultAds = ads || [];
        
        // Check if there's any active ad for MP_Search placement
        const hasSearchAd = resultAds.some(ad => ad.card_placement === 'MP_Search');
        if (!hasSearchAd && siteSettings?.defaultAdBgSearchUrl) {
            resultAds.push({
                id: -1,
                banner_title: '',
                description: '',
                images_json: JSON.stringify([siteSettings.defaultAdBgSearchUrl]),
                priority: 0,
                card_placement: 'MP_Search',
                start_date: new Date().toISOString().slice(0, 10),
                end_date: new Date().toISOString().slice(0, 10)
            });
        }

        // Check if there's any active ad for MP_Post1 placement
        const hasPostAd = resultAds.some(ad => ad.card_placement === 'MP_Post1');
        if (!hasPostAd && siteSettings?.defaultAdBgPostUrl) {
            resultAds.push({
                id: -2,
                banner_title: '',
                description: '',
                images_json: JSON.stringify([siteSettings.defaultAdBgPostUrl]),
                priority: 0,
                card_placement: 'MP_Post1',
                start_date: new Date().toISOString().slice(0, 10),
                end_date: new Date().toISOString().slice(0, 10)
            });
        }

        ads = resultAds;

        res.json({
            success: true,
            data: ads.map(mapAdRow)
        });
    } catch (error) {
        next(error);
    }
});

// Get room details by ID (public)
router.get('/rooms/:roomId', async (req, res, next) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        if (!/^[A-Za-z0-9_-]{3,40}$/.test(roomId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid room identifier'
            });
        }

        const rooms = await executeQuery(
            `SELECT r.*, u.name as owner_name, u.unique_id as owner_unique_id, 
                    u.profile_image as owner_profile_image
             FROM rooms r
             JOIN users u ON r.user_id = u.id
             WHERE r.room_id = ? AND r.status = 'Approved' AND r.deleted_at IS NULL`,
            [roomId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];

        // Get existing roommates
        const roommates = await executeQuery(
            'SELECT name, city FROM existing_roommates WHERE room_id = ?',
            [room.id]
        );
        room.existing_roommates = roommates;

        // Get similar rooms
        const similarRooms = await executeQuery(
            `SELECT room_id, title, room_type, city, area, rent, cost, images
             FROM rooms
             WHERE status = 'Approved' 
             AND room_id != ?
             AND (city = ? OR room_type = ?)
             AND is_occupied = FALSE
             AND deleted_at IS NULL
             LIMIT 4`,
            [room.room_id, room.city, room.room_type]
        );
        room.similar_rooms = similarRooms;

        // Increment view count
        await executeQuery(
            'UPDATE rooms SET views_count = views_count + 1 WHERE room_id = ?',
            [roomId]
        );

        res.json({
            success: true,
            data: room
        });

    } catch (error) {
        next(error);
    }
});

// Get top brokers (public)
router.get('/brokers', async (req, res, next) => {
    try {
        const {
            search,
            city,
            minListings,
            sort = 'top_listed',
            page = 1,
            limit = 12
        } = req.query;

        const safePage = parseSafePositiveInt(page, 1, 1, 5000);
        const safeLimit = parseSafePositiveInt(limit, 12, 1, 60);
        const safeOffset = (safePage - 1) * safeLimit;

        const sortMap = {
            top_listed: 'room_count DESC, u.registration_date DESC',
            newest: 'u.registration_date DESC, room_count DESC',
            name_asc: 'u.name ASC',
            name_desc: 'u.name DESC'
        };
        const orderBy = sortMap[sort] || sortMap.top_listed;

        let sql = `
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area, u.profile_image,
                   u.registration_date,
                   (SELECT COUNT(*) FROM rooms WHERE user_id = u.id AND status = 'Approved' AND deleted_at IS NULL) as room_count
            FROM users u
            WHERE u.role = 'Broker' AND u.broker_status = 'Approved' AND u.status = 'Active'
        `;

        const params = [];

        if (city) {
            sql += ' AND u.broker_area LIKE ?';
            params.push(`%${String(city).trim()}%`);
        }

        if (search) {
            const normalizedSearch = `%${String(search).trim()}%`;
            sql += ' AND (u.name LIKE ? OR u.broker_area LIKE ? OR u.email LIKE ?)';
            params.push(normalizedSearch, normalizedSearch, normalizedSearch);
        }

        if (minListings !== undefined && minListings !== null && String(minListings).trim() !== '') {
            const safeMinListings = parseSafePositiveInt(minListings, 0, 0, 10000);
            sql += `
                AND (SELECT COUNT(*) FROM rooms WHERE user_id = u.id AND status = 'Approved' AND deleted_at IS NULL) >= ?
            `;
            params.push(safeMinListings);
        }

        const countSql = `SELECT COUNT(*) as total FROM (${sql}) as brokers_base`;
        const countRows = await executeQuery(countSql, params);
        const totalItems = countRows?.[0]?.total || 0;

        // TiDB does not support placeholders for LIMIT/OFFSET in prepared statements.
        sql += ` ORDER BY ${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`;

        const brokers = await executeQuery(sql, params);

        res.json({
            success: true,
            data: brokers,
            pagination: {
                currentPage: safePage,
                totalPages: Math.ceil(totalItems / safeLimit),
                totalItems,
                itemsPerPage: safeLimit
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/brokers/top', async (req, res, next) => {
    try {
        const { city, limit = 10 } = req.query;

        let sql = `
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area, u.profile_image,
                   u.registration_date,
                   (SELECT COUNT(*) FROM rooms WHERE user_id = u.id AND status = 'Approved' AND deleted_at IS NULL) as room_count
            FROM users u
            WHERE u.role = 'Broker' AND u.broker_status = 'Approved' AND u.status = 'Active'
        `;
        const params = [];

        if (city) {
            sql += ' AND u.broker_area LIKE ?';
            params.push(`%${city}%`);
        }

        sql += ' ORDER BY room_count DESC LIMIT ?';
        params.push(parseSafePositiveInt(limit, 10, 1, 100));

        const brokers = await executeQuery(sql, params);

        res.json({
            success: true,
            data: brokers
        });

    } catch (error) {
        next(error);
    }
});

// Get single broker by ID (public)
router.get('/brokers/:brokerId', async (req, res, next) => {
    try {
        const { brokerId } = req.params;
        const normalizedBrokerId = String(brokerId || '').trim();
        const isNumericId = /^\d+$/.test(normalizedBrokerId);
        const isUniqueId = /^[A-Za-z0-9_-]{3,64}$/.test(normalizedBrokerId);

        if (!isNumericId && !isUniqueId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid broker identifier'
            });
        }

        const sql = `
            SELECT u.id, u.unique_id, u.name, u.email, u.contact, u.broker_area, u.profile_image,
                   u.registration_date,
                   (SELECT COUNT(*) FROM rooms WHERE user_id = u.id AND status = 'Approved' AND deleted_at IS NULL) as room_count
            FROM users u
            WHERE (u.id = ? OR u.unique_id = ?)
              AND u.role = 'Broker'
              AND u.broker_status = 'Approved'
              AND u.status = 'Active'
        `;

        const numericValue = isNumericId ? parseSafePositiveInt(normalizedBrokerId, 0, 0, 999999999) : 0;
        const brokers = await executeQuery(sql, [numericValue, normalizedBrokerId]);

        if (brokers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Broker not found'
            });
        }

        res.json({
            success: true,
            data: brokers[0]
        });

    } catch (error) {
        next(error);
    }
});

// Get cities list (public)
router.get('/cities', async (req, res, next) => {
    try {
        const cities = await executeQuery(
            `SELECT city_name, district, 
                    (SELECT COUNT(*) FROM rooms WHERE city = maharashtra_cities.city_name AND status = 'Approved' AND deleted_at IS NULL) as room_count
             FROM maharashtra_cities 
             WHERE is_active = TRUE 
             ORDER BY room_count DESC, city_name`
        );

        res.json({
            success: true,
            data: cities
        });

    } catch (error) {
        next(error);
    }
});

// Get public site settings
router.get('/site-settings', async (req, res, next) => {
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

// Get public support email (backward compatibility)
router.get('/support-email', async (req, res) => {
    try {
        const settings = await getSiteSettings();

        res.json({
            success: true,
            data: {
                supportEmail: settings.supportEmail
            }
        });
    } catch {
        res.json({
            success: true,
            data: {
                supportEmail: DEFAULT_SITE_SETTINGS.supportEmail
            }
        });
    }
});

// Get areas by city (public)
router.get('/areas/:city', async (req, res, next) => {
    try {
        const areas = await executeQuery(
            `SELECT DISTINCT area, COUNT(*) as room_count
             FROM rooms
             WHERE city = ? AND status = 'Approved'
             GROUP BY area
             ORDER BY room_count DESC`,
            [req.params.city]
        );

        res.json({
            success: true,
            data: areas
        });

    } catch (error) {
        next(error);
    }
});

// Get room types (public)
router.get('/room-types', async (req, res, next) => {
    try {
        const roomTypes = await executeQuery(
            `SELECT room_type, COUNT(*) as count
             FROM rooms
             WHERE status = 'Approved'
             GROUP BY room_type
             ORDER BY count DESC`
        );

        res.json({
            success: true,
            data: roomTypes
        });

    } catch (error) {
        next(error);
    }
});

// Get listing types (public)
router.get('/listing-types', async (req, res, next) => {
    try {
        const listingTypes = await executeQuery(
            `SELECT listing_type, COUNT(*) as count
             FROM rooms
             WHERE status = 'Approved'
             GROUP BY listing_type
             ORDER BY count DESC`
        );

        res.json({
            success: true,
            data: listingTypes
        });

    } catch (error) {
        next(error);
    }
});

// Get facilities list (public)
router.get('/facilities', async (req, res, next) => {
    try {
        const facilities = [
            'Furnished', 'Semi-furnished', 'Unfurnished', 'Balcony', 'Lift / Elevator',
            'WiFi / Broadband', 'Gym', 'Swimming Pool', '2-Wheeler Parking',
            '4-Wheeler Parking', '24x7 Water Supply', 'Filter / RO Water',
            'Electricity Backup (Inverter / Generator)', 'Solar Water Heater',
            'Geyser', 'CCTV', 'Security Guard', 'Sofa', 'Washing Machine',
            'Refrigerator', 'AC', 'TV', 'Dining Table', 'Wardrobe', 'Modular Kitchen'
        ];

        res.json({
            success: true,
            data: facilities
        });

    } catch (error) {
        next(error);
    }
});

// Get statistics (public)
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await executeQuery(`
            SELECT 
                (SELECT COUNT(*) FROM rooms WHERE status = 'Approved' AND deleted_at IS NULL) as total_rooms,
                (SELECT COUNT(*) FROM users WHERE role = 'Member') as total_members,
                (SELECT COUNT(*) FROM users WHERE role = 'Broker' AND broker_status = 'Approved') as total_brokers,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Approved' AND listing_type = 'For Rent' AND deleted_at IS NULL) as rooms_for_rent,
                (SELECT COUNT(*) FROM rooms WHERE status = 'Approved' AND listing_type = 'For Sell' AND deleted_at IS NULL) as rooms_for_sale
        `);

        res.json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        next(error);
    }
});

// Contact form submission
router.post('/contact', [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').trim().isEmail().withMessage('A valid email address is required'),
    body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+()\-\s]{7,20}$/).withMessage('Phone number is invalid'),
    body('subject').trim().isLength({ min: 3, max: 200 }).withMessage('Subject must be between 3 and 200 characters'),
    body('message').trim().isLength({ min: 20, max: 4000 }).withMessage('Message must be between 20 and 4000 characters'),
    body('website').optional().trim().isLength({ max: 255 }),
    body('sourcePage').optional().trim().isLength({ max: 120 }),
    body('formElapsedMs').optional().isInt({ min: 0, max: 600000 }).withMessage('Invalid form timing')
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0]?.msg || 'Please check the form fields and try again.',
                errors: errors.array()
            });
        }

        await ensureContactLeadsTable();

        const { name, email, phone, subject, message, sourcePage, website, formElapsedMs } = normalizeContactLeadPayload(req.body);
        const ipAddress = getRequestIp(req);
        const userAgent = String(req.headers['user-agent'] || '').trim().slice(0, 255) || null;

        const recentIpSubmissions = ipAddress
            ? await executeQuery(
                `SELECT COUNT(*) AS recent_count
                 FROM contact_leads
                 WHERE ip_address = ?
                   AND submitted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
                [ipAddress]
            )
            : [{ recent_count: 0 }];

        if (Number(recentIpSubmissions[0]?.recent_count || 0) >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many contact requests from this network. Please try again later.'
            });
        }

        const duplicateLeads = await executeQuery(
            `SELECT id
             FROM contact_leads
             WHERE email = ?
               AND subject = ?
               AND message = ?
               AND submitted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
             LIMIT 1`,
            [email, subject, message]
        );

        if (duplicateLeads.length > 0) {
            return res.json({
                success: true,
                message: 'Thank you. Your message is already in our queue.'
            });
        }

        const recentEmailSubmissions = await executeQuery(
            `SELECT COUNT(*) AS recent_count
             FROM contact_leads
             WHERE email = ?
               AND submitted_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)`,
            [email]
        );

        const spamAssessment = computeSpamAssessment({
            name,
            email,
            subject,
            message,
            website,
            formElapsedMs
        });

        const spamReasons = [...spamAssessment.reasons];
        const emailFlooding = Number(recentEmailSubmissions[0]?.recent_count || 0) >= 4;
        if (emailFlooding) {
            spamReasons.push('too many submissions from the same email');
        }

        const isSpam = spamAssessment.isSpam || emailFlooding;

        await executeQuery(
            `INSERT INTO contact_leads (
                name, email, phone, subject, message, source_page,
                status, admin_remark, is_spam, spam_score, spam_reason,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
            [
                name,
                email,
                phone || null,
                subject,
                message,
                sourcePage || '/contact',
                isSpam ? 'Spam' : 'New',
                isSpam,
                spamAssessment.score,
                spamReasons.join(', ').slice(0, 255) || null,
                ipAddress,
                userAgent
            ]
        );

        res.json({
            success: true,
            message: 'Thank you for contacting us. We will get back to you soon.'
        });

    } catch (error) {
        next(error);
    }
});

// SEO metadata for room
router.get('/rooms/:roomId/seo', async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            `SELECT room_id, title, listing_type, room_type, city, area, 
                    rent, deposit, cost, images, note, address, pincode, furnishing_type
             FROM rooms
             WHERE room_id = ? AND status = 'Approved'`,
            [req.params.roomId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];
        let imageUrl = null;
        try {
            const parsedImages = room.images ? JSON.parse(room.images) : [];
            imageUrl = Array.isArray(parsedImages) && parsedImages.length > 0 ? parsedImages[0] : null;
        } catch (error) {
            imageUrl = null;
        }

        const slug = createSlug(`${room.title}-${room.area}-${room.city}`);
        const roomUrl = `${process.env.SITE_URL || 'https://yourdomain.com'}/room/${room.room_id}/${slug}`;
        const description = [
            `${room.room_type} for ${room.listing_type.toLowerCase()} in ${room.area}, ${room.city}.`,
            room.rent ? `Rent: ₹${room.rent}.` : '',
            room.cost ? `Price: ₹${room.cost}.` : '',
            room.furnishing_type ? `Furnishing: ${room.furnishing_type}.` : '',
            room.note ? String(room.note).trim() : ''
        ]
            .filter(Boolean)
            .join(' ')
            .trim();

        const structuredData = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: room.title,
            description,
            sku: room.room_id,
            category: room.listing_type,
            url: roomUrl,
            image: imageUrl ? [imageUrl] : [],
            offers: {
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: room.rent || room.cost || 0,
                availability: 'https://schema.org/InStock',
                url: roomUrl
            },
            location: {
                '@type': 'Place',
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: room.address || '',
                    addressLocality: room.area,
                    addressRegion: room.city,
                    postalCode: room.pincode || ''
                }
            }
        };

        const seoData = {
            title: `${room.title} - ${room.room_type} in ${room.area}, ${room.city}`,
            description,
            image: imageUrl,
            url: roomUrl,
            canonical: roomUrl,
            slug,
            type: 'property',
            price: room.rent || room.cost,
            currency: 'INR',
            city: room.city,
            area: room.area,
            structuredData
        };

        res.json({
            success: true,
            data: seoData
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
