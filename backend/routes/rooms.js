const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { executeQuery, withTransaction } = require('../config/database');
const { authenticate, optionalAuth, requireAdmin, requireMember, requireApprovedBroker } = require('../middleware/auth');
const { checkBrokerSubscription } = require('../middleware/brokerSubscription');
const { handleUpload } = require('../middleware/upload');
const { 
    generateRoomId, 
    formatCurrency,
    generateMetaTags 
} = require('../utils/helpers');
const { sendRoomApprovalEmail } = require('../utils/email');
const { uploadImageFiles } = require('../utils/imageStorage');

// Facilities list
const FACILITIES_LIST = [
    'Furnished', 'Semi-furnished', 'Unfurnished', 'Balcony', 'Lift / Elevator',
    'WiFi / Broadband', 'Gym', 'Swimming Pool', '2-Wheeler Parking',
    '4-Wheeler Parking', '24x7 Water Supply', 'Filter / RO Water',
    'Electricity Backup (Inverter / Generator)', 'Solar Water Heater',
    'Geyser', 'CCTV', 'Security Guard', 'Sofa', 'Washing Machine',
    'Refrigerator', 'AC', 'TV', 'Dining Table', 'Wardrobe', 'Modular Kitchen'
];

const safeText = (value) => String(value || '').trim();

const parseFacilitiesValue = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => safeText(item)).filter(Boolean);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => safeText(item)).filter(Boolean);
            }
        } catch (error) {
            return value
                .split(',')
                .map((item) => safeText(item))
                .filter(Boolean);
        }
    }

    return [];
};

const buildRoomMetadata = (roomData = {}) => {
    const title = safeText(roomData.title);
    const listingType = safeText(roomData.listingType);
    const roomType = safeText(roomData.roomType);
    const houseType = safeText(roomData.houseType);
    const city = safeText(roomData.city);
    const area = safeText(roomData.area);
    const address = safeText(roomData.address);
    const pincode = safeText(roomData.pincode);
    const furnishingType = safeText(roomData.furnishingType);
    const note = safeText(roomData.note);
    const facilities = parseFacilitiesValue(roomData.facilities);

    const searchableText = [
        title,
        listingType,
        roomType,
        houseType,
        city,
        area,
        address,
        pincode,
        furnishingType,
        note,
        ...facilities
    ]
        .filter(Boolean)
        .join(' ');

    const tokenSet = new Set(
        searchableText
            .toLowerCase()
            .split(/[^a-z0-9]+/i)
            .map((token) => token.trim())
            .filter((token) => token.length > 2)
    );

    return {
        title,
        listingType,
        roomType,
        houseType,
        city,
        area,
        pincode,
        furnishingType,
        facilities,
        keywords: Array.from(tokenSet).slice(0, 160),
        searchableText,
        updatedAt: new Date().toISOString()
    };
};

// Create room (Step 1-9 combined)
router.post('/', authenticate, requireMember, requireApprovedBroker, checkBrokerSubscription, [
    body('listingType').isIn(['For Rent', 'Required Roommate', 'For Sell']),
    body('roomType').isIn(['1RK', '1BHK', '2BHK', '3BHK', '4BHK', 'PG', 'Dormitory', 'Studio', 'Other']),
    body('houseType').isIn(['Flat', 'Apartment', 'House']),
    body('title').trim().notEmpty(),
    body('availabilityFrom').isISO8601(),
    body('latitude').isFloat(),
    body('longitude').isFloat(),
    body('city').trim().notEmpty(),
    body('area').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('pincode').matches(/^\d{6}$/),
    body('contact').notEmpty(),
    body('contactVisibility').isIn(['Private', 'Public']),
    body('furnishingType').isIn(['Furnished', 'Semi-furnished', 'Unfurnished']),
    body('planType').notEmpty()
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
            listingType,
            roomType,
            houseType,
            title,
            availabilityFrom,
            rent,
            deposit,
            cost,
            sizeSqft,
            latitude,
            longitude,
            city,
            area,
            address,
            pincode,
            contact,
            contactVisibility,
            email,
            preferredGender,
            furnishingType,
            facilities,
            note,
            planType,
            planAmount,
            existingRoommates,
            images
        } = req.body;

        // Generate unique room ID
        let roomId;
        let isUnique = false;
        while (!isUnique) {
            roomId = generateRoomId();
            const existing = await executeQuery(
                'SELECT id FROM rooms WHERE room_id = ?',
                [roomId]
            );
            if (existing.length === 0) isUnique = true;
        }

        // Validate based on listing type
        if ((listingType === 'For Rent' || listingType === 'Required Roommate') && (!rent || !deposit)) {
            return res.status(400).json({
                success: false,
                message: 'Rent and deposit are required for this listing type'
            });
        }

        if (listingType === 'For Sell' && (!cost || !sizeSqft)) {
            return res.status(400).json({
                success: false,
                message: 'Cost and size are required for selling'
            });
        }

        // Prefer contact from user profile table when available
        const userProfileRows = await executeQuery(
            'SELECT contact FROM users WHERE id = ? LIMIT 1',
            [req.user.userId]
        );

        const profileContact = userProfileRows?.[0]?.contact
            ? String(userProfileRows[0].contact).trim()
            : '';

        const finalContact = profileContact || String(contact || '').trim();

        if (!finalContact) {
            return res.status(400).json({
                success: false,
                message: 'Contact number is required. Please update your profile contact.'
            });
        }

        if (req.user.role === 'Broker') {
            // Check if subscription is suspended
            if (req.isSubscriptionSuspended) {
                return res.status(403).json({
                    success: false,
                    message: 'Your subscription has been suspended. You cannot post rooms. Please contact admin.',
                    errorCode: 'SUBSCRIPTION_SUSPENDED',
                    subscriptionStatus: 'suspended'
                });
            }

            // Check if broker has active subscription
            if (!req.hasBrokerSubscription) {
                const postWithoutSubscription = Boolean(req.body.postWithoutSubscription);

                if (postWithoutSubscription) {
                    // Allow posting without active subscription, listing will remain pending for admin approval
                } else {
                const latestSubscription = await executeQuery(
                    `SELECT s.id
                     FROM subscriptions s
                     INNER JOIN plans p ON s.plan_id = p.id
                     WHERE s.user_id = ? AND s.payment_status = 'Completed' AND p.plan_type = 'Broker'
                     ORDER BY s.expires_at DESC
                     LIMIT 1`,
                    [req.user.userId]
                );

                const subscriptionStatus = latestSubscription.length > 0 ? 'expired' : 'not_subscribed';
                const message = subscriptionStatus === 'expired'
                    ? 'Your posting subscription has expired. Renew to post room.'
                    : 'No active broker subscription found. Subscribe to post room. Or Pay per post.';

                return res.status(403).json({
                    success: false,
                    message,
                    errorCode: 'BROKER_SUBSCRIPTION_REQUIRED',
                    subscriptionStatus
                });
                }
            }
        }

        // Determine room status and plan based on broker subscription
        let roomStatus = 'Pending';
        let finalPlanType = planType;
        let finalPlanAmount = planAmount || 0;
        const roomMetadata = buildRoomMetadata({
            title,
            listingType,
            roomType,
            houseType,
            city,
            area,
            address,
            pincode,
            furnishingType,
            facilities,
            note
        });

        // If user is broker with active subscription, auto-approve and use premium plan
        if (req.hasBrokerSubscription && req.user.role === 'Broker') {
            roomStatus = 'Approved';
            finalPlanType = 'Premium'; // Default to Premium for broker subscriptions
            finalPlanAmount = 0; // No per-room charge for broker subscriptions
        }

        // Insert room
        const result = await executeQuery(
            `INSERT INTO rooms (
                room_id, user_id, listing_type, title, room_type, house_type,
                availability_from, rent, deposit, cost, size_sqft,
                latitude, longitude, city, area, address, pincode,
                contact, contact_visibility, email, preferred_gender, furnishing_type,
                facilities, note, plan_type, plan_amount, images, meta_data,
                status, post_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                roomId, req.user.userId, listingType, title, roomType, houseType,
                availabilityFrom, rent || null, deposit || null, cost || null, sizeSqft || null,
                latitude, longitude, city, area, address, pincode,
                finalContact, contactVisibility, email || req.user.email, preferredGender || null, furnishingType,
                JSON.stringify(facilities || []), note || null, finalPlanType, finalPlanAmount,
                JSON.stringify(images || []), JSON.stringify(roomMetadata),
                roomStatus
            ]
        );

        const roomDbId = result.insertId;

        // Insert existing roommates if provided
        if (existingRoommates && existingRoommates.length > 0) {
            for (const roommate of existingRoommates) {
                if (roommate.name && roommate.city) {
                    await executeQuery(
                        'INSERT INTO roommates (room_id, name, email, city, invited_by, group_id, status) VALUES (?, ?, ?, ?, ?, NULL, ?)',
                        [roomDbId, roommate.name, roommate.name.toLowerCase().replace(/\s+/g, '') + '@room-occupant.local', roommate.city, req.user.userId, 'Accepted']
                    );
                }
            }
        }

        // Create notification for admin
        if (roomStatus === 'Pending') {
            try {
                await executeQuery(
                    `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
                     SELECT id, 'System', 'New Room Pending Approval', 
                            CONCAT('New room "${title}" posted by ${req.user.name}'),
                            '${roomId}', 'room'
                     FROM users WHERE role = 'Admin'`,
                );
            } catch (notificationError) {
                const missingIdDefault =
                    notificationError &&
                    notificationError.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
                    notificationError.message &&
                    notificationError.message.includes("Field 'id'");

                if (!missingIdDefault) {
                    throw notificationError;
                }

                const adminUsers = await executeQuery('SELECT id FROM users WHERE role = ? ORDER BY id ASC', ['Admin']);
                for (const admin of adminUsers) {
                    const maxRows = await executeQuery('SELECT COALESCE(MAX(id), 0) AS maxId FROM notifications');
                    const nextId = Number(maxRows[0]?.maxId || 0) + 1;

                    await executeQuery(
                        `INSERT INTO notifications (id, user_id, type, title, message, reference_id, reference_type)
                         VALUES (?, ?, 'System', 'New Room Pending Approval', ?, ?, 'room')`,
                        [
                            nextId,
                            admin.id,
                            `New room "${title}" posted by ${req.user.name}`,
                            roomId,
                        ]
                    );
                }
            }
        }

        const successMessage = roomStatus === 'Approved' 
            ? 'Room posted and approved successfully!' 
            : 'Room posted successfully. Waiting for admin approval.';

        res.status(201).json({
            success: true,
            message: successMessage,
            data: {
                roomId,
                dbId: roomDbId,
                status: roomStatus,
                autoApproved: roomStatus === 'Approved'
            }
        });

    } catch (error) {
        next(error);
    }
});

// Upload room images
router.post('/upload-images', optionalAuth, handleUpload('images', 5), async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No images uploaded'
            });
        }

        const imageUrls = await uploadImageFiles(req.files, 'rooms');

        if (imageUrls.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Image upload failed. Please try again.'
            });
        }

        res.json({
            success: true,
            message: 'Images uploaded successfully',
            data: { imageUrls }
        });

    } catch (error) {
        next(error);
    }
});

// Get my rooms
router.get('/my-rooms', authenticate, requireMember, async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
        const safeOffset = (safePage - 1) * safeLimit;

        let sql = `
            SELECT r.id, r.room_id, r.listing_type, r.title, r.room_type, 
                   r.house_type, r.city, r.area, r.rent, r.deposit, r.cost,
                   r.status, r.views_count, r.post_date, r.last_updated,
                   r.images, r.is_occupied
            FROM rooms r 
            WHERE r.user_id = ? AND r.deleted_at IS NULL
        `;
        const params = [req.user.userId];

        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }

        // TiDB does not support placeholders for LIMIT/OFFSET in prepared statements.
        sql += ` ORDER BY r.post_date DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

        const rooms = await executeQuery(sql, params);

        // Get total count
        const countResult = await executeQuery(
            'SELECT COUNT(*) as total FROM rooms WHERE user_id = ? AND deleted_at IS NULL' + (status ? ' AND status = ?' : ''),
            status ? [req.user.userId, status] : [req.user.userId]
        );

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

// Get room by ID (for editing)
router.get('/my-room/:roomId', authenticate, requireMember, async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            `SELECT r.* FROM rooms r
             WHERE r.room_id = ? AND r.user_id = ? AND r.deleted_at IS NULL`,
            [req.params.roomId, req.user.userId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];

        // Owner can view their room in any status
        res.json({
            success: true,
            data: room
        });

    } catch (error) {
        next(error);
    }
});

// Update room (only if status is Hold)
router.put('/:roomId', authenticate, requireMember, checkBrokerSubscription, [
    body('title').optional().trim().notEmpty(),
    body('rent').optional().isFloat(),
    body('deposit').optional().isFloat(),
    body('availabilityFrom').optional().isISO8601(),
    body('availability_from').optional().isISO8601()
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

        // Check if room exists and belongs to user
        const rooms = await executeQuery(
            `SELECT id, status, title, listing_type, room_type, house_type, city, area,
                    address, pincode, furnishing_type, facilities, note
             FROM rooms WHERE room_id = ? AND user_id = ? AND deleted_at IS NULL`,
            [req.params.roomId, req.user.userId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Brokers with active subscription can edit at any status
        // Regular users can only edit when status is Hold
        const canEdit = req.hasBrokerSubscription && req.user.role === 'Broker';
        if (!canEdit && rooms[0].status !== 'Hold') {
            return res.status(403).json({
                success: false,
                message: 'Room can only be edited when status is Hold'
            });
        }

        const updates = [];
        const values = [];
        const fieldMappings = [
            ['title', 'title'],
            ['listingType', 'listing_type'],
            ['listing_type', 'listing_type'],
            ['roomType', 'room_type'],
            ['room_type', 'room_type'],
            ['houseType', 'house_type'],
            ['house_type', 'house_type'],
            ['rent', 'rent'],
            ['deposit', 'deposit'],
            ['cost', 'cost'],
            ['sizeSqft', 'size_sqft'],
            ['size_sqft', 'size_sqft'],
            ['availabilityFrom', 'availability_from'],
            ['availability_from', 'availability_from'],
            ['contact', 'contact'],
            ['contactVisibility', 'contact_visibility'],
            ['contact_visibility', 'contact_visibility'],
            ['email', 'email'],
            ['preferredGender', 'preferred_gender'],
            ['preferred_gender', 'preferred_gender'],
            ['furnishingType', 'furnishing_type'],
            ['furnishing_type', 'furnishing_type'],
            ['facilities', 'facilities'],
            ['note', 'note'],
            ['images', 'images'],
            ['address', 'address'],
            ['area', 'area'],
            ['city', 'city'],
            ['pincode', 'pincode'],
            ['latitude', 'latitude'],
            ['longitude', 'longitude']
        ];

        const updatedDbFields = new Set();
        for (const [requestField, dbField] of fieldMappings) {
            if (req.body[requestField] !== undefined && !updatedDbFields.has(dbField)) {
                updates.push(`${dbField} = ?`);
                values.push(typeof req.body[requestField] === 'object' ? JSON.stringify(req.body[requestField]) : req.body[requestField]);
                updatedDbFields.add(dbField);
            }
        }

        const existingRoom = rooms[0];
        const metadataPayload = buildRoomMetadata({
            title: req.body.title ?? existingRoom.title,
            listingType: req.body.listingType ?? existingRoom.listing_type,
            roomType: req.body.roomType ?? existingRoom.room_type,
            houseType: req.body.houseType ?? existingRoom.house_type,
            city: req.body.city ?? existingRoom.city,
            area: req.body.area ?? existingRoom.area,
            address: req.body.address ?? existingRoom.address,
            pincode: req.body.pincode ?? existingRoom.pincode,
            furnishingType: req.body.furnishingType ?? existingRoom.furnishing_type,
            facilities: req.body.facilities ?? existingRoom.facilities,
            note: req.body.note ?? existingRoom.note
        });
        updates.push('meta_data = ?');
        values.push(JSON.stringify(metadataPayload));

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        // Determine new status based on broker subscription
        let newStatus = 'Pending'; // Default for regular users
        if (req.hasBrokerSubscription && req.user.role === 'Broker') {
            // Keep approved status or set to approved for brokers with subscription
            newStatus = (rooms[0].status === 'Approved' || rooms[0].status === 'Pending') ? 'Approved' : rooms[0].status;
        }

        updates.push('status = ?');
        values.push(newStatus);
        updates.push('last_updated = NOW()');
        values.push(req.params.roomId);

        await executeQuery(
            `UPDATE rooms SET ${updates.join(', ')} WHERE room_id = ?`,
            values
        );

        const message = req.hasBrokerSubscription && req.user.role === 'Broker'
            ? 'Room updated successfully'
            : 'Room updated successfully and sent for re-approval';

        res.json({
            success: true,
            message,
            data: {
                newStatus
            }
        });

    } catch (error) {
        next(error);
    }
});

// Delete room (soft delete)
router.delete('/:roomId', authenticate, requireMember, async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            'SELECT id, status FROM rooms WHERE room_id = ? AND user_id = ? AND deleted_at IS NULL',
            [req.params.roomId, req.user.userId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Soft delete: set deleted_at timestamp instead of actually deleting
        await executeQuery('UPDATE rooms SET deleted_at = NOW() WHERE room_id = ?', [req.params.roomId]);

        res.json({
            success: true,
            message: 'Room deleted successfully'
        });

    } catch (error) {
        next(error);
    }
});

const setRoomOccupancyByOwner = async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            'SELECT id, room_id, is_occupied, status FROM rooms WHERE room_id = ? AND user_id = ? AND deleted_at IS NULL',
            [req.params.roomId, req.user.userId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        const room = rooms[0];
        const requestedIsOccupied = typeof req.body?.isOccupied === 'boolean'
            ? req.body.isOccupied
            : true;

        if (Boolean(room.is_occupied) === requestedIsOccupied) {
            return res.status(400).json({
                success: false,
                message: requestedIsOccupied
                    ? 'Room is already marked as occupied'
                    : 'Room is already marked as not occupied'
            });
        }

        const nextStatus = requestedIsOccupied
            ? 'Expired'
            : (room.status === 'Expired' ? 'Approved' : room.status);

        await executeQuery(
            `UPDATE rooms
             SET is_occupied = ?,
                 status = ?,
                 last_updated = NOW()
             WHERE room_id = ? AND user_id = ?`,
            [requestedIsOccupied, nextStatus, req.params.roomId, req.user.userId]
        );

        res.json({
            success: true,
            message: requestedIsOccupied
                ? 'Room marked as occupied and expired successfully'
                : 'Room marked as available successfully',
            data: {
                room_id: room.room_id,
                is_occupied: requestedIsOccupied,
                status: nextStatus
            }
        });

    } catch (error) {
        next(error);
    }
};

// Update room occupancy (owner action)
router.put('/:roomId/occupancy', authenticate, requireMember, setRoomOccupancyByOwner);

// Backward compatible endpoint: mark occupied
router.put('/:roomId/mark-occupied', authenticate, requireMember, (req, res, next) => {
    req.body = {
        ...(req.body || {}),
        isOccupied: true
    };
    return setRoomOccupancyByOwner(req, res, next);
});

// Increment view count
router.post('/:roomId/view', async (req, res, next) => {
    try {
        await executeQuery(
            'UPDATE rooms SET views_count = views_count + 1 WHERE room_id = ?',
            [req.params.roomId]
        );

        res.json({ success: true });

    } catch (error) {
        next(error);
    }
});

// Get facilities list
router.get('/facilities/list', (req, res) => {
    res.json({
        success: true,
        data: FACILITIES_LIST
    });
});

// ==================== ADMIN ROUTES ====================

// Get all rooms for admin
router.post('/admin/backfill-metadata', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const rooms = await executeQuery(
            `SELECT id, title, listing_type, room_type, house_type, city, area,
                    address, pincode, furnishing_type, facilities, note
             FROM rooms
             WHERE meta_data IS NULL OR JSON_LENGTH(meta_data) = 0`
        );

        if (rooms.length === 0) {
            return res.json({
                success: true,
                message: 'All room metadata is already populated',
                data: { updated: 0 }
            });
        }

        for (const room of rooms) {
            const metadata = buildRoomMetadata({
                title: room.title,
                listingType: room.listing_type,
                roomType: room.room_type,
                houseType: room.house_type,
                city: room.city,
                area: room.area,
                address: room.address,
                pincode: room.pincode,
                furnishingType: room.furnishing_type,
                facilities: room.facilities,
                note: room.note
            });

            await executeQuery(
                'UPDATE rooms SET meta_data = ? WHERE id = ?',
                [JSON.stringify(metadata), room.id]
            );
        }

        res.json({
            success: true,
            message: 'Room metadata backfilled successfully',
            data: { updated: rooms.length }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/admin/all', authenticate, requireAdmin, async (req, res, next) => {
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

        res.json({
            success: true,
            data: paginatedRooms,
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

// Update room status (Admin only)
router.put('/admin/:roomId/status', authenticate, requireAdmin, [
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
        await sendRoomApprovalEmail(room.email, room.name, room.title, room.room_id, status);

        // Create notification for user
        await executeQuery(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
             VALUES (?, 'Room_Approved', ?, ?, ?, 'room')`,
            [room.user_id, `Room ${status}`, `Your room "${room.title}" has been ${status.toLowerCase()}`, room.room_id]
        );

        res.json({
            success: true,
            message: `Room status updated to ${status}`
        });

    } catch (error) {
        next(error);
    }
});

// Get room statistics (Admin only)
router.get('/admin/stats/overview', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const stats = await executeQuery(`
            SELECT 
                COUNT(*) as total_rooms,
                SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_rooms,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending_rooms,
                SUM(CASE WHEN status = 'Hold' THEN 1 ELSE 0 END) as hold_rooms,
                SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected_rooms,
                SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired_rooms,
                SUM(CASE WHEN is_occupied = TRUE THEN 1 ELSE 0 END) as occupied_rooms,
                SUM(views_count) as total_views
            FROM rooms
        `);

        const todayStats = await executeQuery(`
            SELECT COUNT(*) as today_rooms
            FROM rooms
            WHERE DATE(post_date) = CURDATE()
        `);

        res.json({
            success: true,
            data: {
                ...stats[0],
                today_rooms: todayStats[0].today_rooms
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get room contact info
router.get('/:roomId/contact', authenticate, async (req, res, next) => {
    try {
        const { roomId } = req.params;

        const rooms = await executeQuery(
            `SELECT r.id, r.room_id, r.title, r.contact, r.contact_visibility, r.user_id, u.name as owner_name, u.profile_image as owner_image
             FROM rooms r
             JOIN users u ON r.user_id = u.id
             WHERE r.room_id = ? OR r.id = ?`,
            [roomId, roomId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        res.json({
            success: true,
            data: rooms[0]
        });

    } catch (error) {
        next(error);
    }
});

// Update room contact visibility
router.put('/:roomId/contact-visibility', authenticate, [
    body('visibility').isIn(['Private', 'Public'])
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

        const { roomId } = req.params;
        const { visibility } = req.body;

        // Check if room belongs to current user
        const rooms = await executeQuery(
            'SELECT id, user_id, title FROM rooms WHERE (room_id = ? OR id = ?) AND user_id = ?',
            [roomId, roomId, req.user.userId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Room not found or you do not have permission to update it'
            });
        }

        await executeQuery(
            'UPDATE rooms SET contact_visibility = ? WHERE id = ?',
            [visibility, rooms[0].id]
        );

        res.json({
            success: true,
            message: 'Contact visibility updated successfully',
            data: { 
                contact_visibility: visibility,
                room_id: roomId
            }
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
