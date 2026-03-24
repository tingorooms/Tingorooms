const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { executeQuery, withTransaction } = require('../config/database');
const { authenticate, requireMember } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');
const { generateGroupId, generateInviteToken } = require('../utils/helpers');
const { sendRoommateInviteEmail } = require('../utils/email');
const { uploadImageBuffer } = require('../utils/imageStorage');

let ensureExpenseGroupSchemaPromise = null;

const getCurrentMonthExpenseLabel = () => {
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    return `${monthName} Expense`;
};

const ensureExpenseGroupSchema = async () => {
    if (!ensureExpenseGroupSchemaPromise) {
        ensureExpenseGroupSchemaPromise = (async () => {
            const columns = await executeQuery('SHOW COLUMNS FROM roommate_groups');
            const names = new Set(columns.map((column) => column.Field));

            if (!names.has('expense_category')) {
                await executeQuery("ALTER TABLE roommate_groups ADD COLUMN expense_category VARCHAR(20) NOT NULL DEFAULT 'Daily' AFTER group_name");
            }
            if (!names.has('expense_label')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN expense_label VARCHAR(180) NULL AFTER expense_category');
            }
            if (!names.has('expense_status')) {
                await executeQuery("ALTER TABLE roommate_groups ADD COLUMN expense_status VARCHAR(20) NOT NULL DEFAULT 'Ongoing' AFTER expense_category");
            }
            if (!names.has('allow_member_edit_history')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN allow_member_edit_history TINYINT(1) NOT NULL DEFAULT 0 AFTER expense_status');
            }
            if (!names.has('closed_at')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN closed_at TIMESTAMP NULL DEFAULT NULL AFTER allow_member_edit_history');
            }
            if (!names.has('admin_upi_id')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN admin_upi_id VARCHAR(120) NULL AFTER closed_at');
            }
            if (!names.has('admin_scanner_url')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN admin_scanner_url TEXT NULL AFTER admin_upi_id');
            }
            if (!names.has('admin_drive_link')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN admin_drive_link TEXT NULL AFTER admin_scanner_url');
            }
            if (!names.has('is_deleted')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_drive_link');
            }
            if (!names.has('deleted_at')) {
                await executeQuery('ALTER TABLE roommate_groups ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER is_deleted');
            }
        })().catch((error) => {
            ensureExpenseGroupSchemaPromise = null;
            throw error;
        });
    }

    return ensureExpenseGroupSchemaPromise;
};

const getGroupOwnerId = async (groupId) => {
    const creatorRows = await executeQuery(
        `SELECT user_id, group_name
         FROM roommates
         WHERE group_id = ?
           AND user_id IS NOT NULL
           AND invited_by = user_id
         ORDER BY created_at ASC
         LIMIT 1`,
        [groupId]
    );

    const canonicalOwner = creatorRows[0]?.user_id || null;
    const canonicalGroupName = creatorRows[0]?.group_name || `Group ${groupId}`;

    const groupRows = await executeQuery(
        'SELECT created_by FROM roommate_groups WHERE group_id = ? LIMIT 1',
        [groupId]
    );

    if (groupRows.length > 0) {
        const storedOwner = groupRows[0].created_by;
        if (canonicalOwner && storedOwner !== canonicalOwner) {
            await executeQuery(
                'UPDATE roommate_groups SET created_by = ?, group_name = ? WHERE group_id = ?',
                [canonicalOwner, canonicalGroupName, groupId]
            );
            return canonicalOwner;
        }
        return storedOwner;
    }

    // Backfill owner for legacy groups created before roommate_groups was populated.
    const fallbackOwnerRows = creatorRows.length > 0
        ? creatorRows
        : await executeQuery(
            `SELECT user_id, group_name
             FROM roommates
             WHERE group_id = ? AND user_id IS NOT NULL
             ORDER BY created_at ASC
             LIMIT 1`,
            [groupId]
        );

    if (fallbackOwnerRows.length === 0) {
        return null;
    }

    const fallbackOwner = fallbackOwnerRows[0];
    await executeQuery(
        `INSERT INTO roommate_groups (group_id, group_name, created_by)
         VALUES (?, ?, ?)`,
        [groupId, fallbackOwner.group_name || `Group ${groupId}`, fallbackOwner.user_id]
    );

    return fallbackOwner.user_id;
};

const isAcceptedGroupMember = async (groupId, userId) => {
        const currentUserRows = await executeQuery('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
        const currentUserEmail = currentUserRows[0]?.email || null;

        const membership = await executeQuery(
                `SELECT id
                 FROM roommates
                 WHERE group_id = ?
                     AND status = 'Accepted'
                     AND (
                                user_id = ? OR
                                linked_user_id = ? OR
                                (? IS NOT NULL AND LOWER(email) = LOWER(?))
                     )
                 LIMIT 1`,
                [groupId, userId, userId, currentUserEmail, currentUserEmail]
        );

        return membership.length > 0;
};

// Get my roommate groups
router.get('/groups', authenticate, requireMember, async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        const includeDeleted = String(req.query.includeDeleted || '0') === '1';
        await executeQuery(
            `INSERT INTO roommate_groups (group_id, group_name, created_by)
             SELECT src.group_id, src.group_name, src.created_by
             FROM (
                SELECT r1.group_id,
                       COALESCE(r1.group_name, CONCAT('Group ', r1.group_id)) as group_name,
                       r1.user_id as created_by
                FROM roommates r1
                INNER JOIN (
                    SELECT group_id, MIN(created_at) as first_created_at
                    FROM roommates
                    WHERE user_id IS NOT NULL AND invited_by = user_id
                    GROUP BY group_id
                ) c ON c.group_id = r1.group_id AND c.first_created_at = r1.created_at
             ) src
             LEFT JOIN roommate_groups rg ON rg.group_id = src.group_id
             WHERE rg.group_id IS NULL AND src.created_by IS NOT NULL`
        );

        const currentUserRows = await executeQuery('SELECT email FROM users WHERE id = ? LIMIT 1', [req.user.userId]);
        const currentUserEmail = currentUserRows[0]?.email || null;

        const groups = await executeQuery(
            `SELECT DISTINCT r.group_id,
                    COALESCE(rg.group_name, r.group_name) as group_name,
                    rg.created_by,
                    rg.expense_category,
                                        rg.expense_label,
                    rg.expense_status,
                    COALESCE(rg.is_deleted, 0) as is_deleted,
                    rg.allow_member_edit_history,
                                        rg.admin_upi_id,
                                        rg.admin_scanner_url,
                                        rg.admin_drive_link,
                                        rg.closed_at,
                                                                                (
                                                                                        SELECT COUNT(*)
                                                                                        FROM expenses e
                                                                                        WHERE e.group_id = r.group_id
                                                                                            AND e.is_settled = FALSE
                                                                                ) as ongoing_expense_count,
                                        MAX(COALESCE(r.accepted_at, r.invited_at, r.created_at)) as latest_created_at
             FROM roommates r
             LEFT JOIN roommate_groups rg ON rg.group_id = r.group_id
             WHERE r.status = 'Accepted'
               AND (
                    r.user_id = ? OR
                    r.linked_user_id = ? OR
                    (? IS NOT NULL AND LOWER(r.email) = LOWER(?))
                                                                                                                 )
                             AND (? = 1 OR COALESCE(rg.is_deleted, 0) = 0)
                         GROUP BY r.group_id, COALESCE(rg.group_name, r.group_name), rg.created_by, rg.expense_category,
                                                                                        rg.expense_label, rg.expense_status, rg.is_deleted, rg.allow_member_edit_history,
                                            rg.admin_upi_id, rg.admin_scanner_url, rg.admin_drive_link, rg.closed_at
                         ORDER BY latest_created_at DESC, r.group_id DESC`,
                        [req.user.userId, req.user.userId, currentUserEmail, currentUserEmail, includeDeleted ? 1 : 0]
        );

        // Get members for each group
        for (const group of groups) {
            const members = await executeQuery(
                `SELECT r.id, r.user_id, r.linked_user_id, r.name, r.email, r.contact, r.city, r.status,
                        u.unique_id, u.profile_image
                 FROM roommates r
                 LEFT JOIN users u ON u.id = COALESCE(r.linked_user_id, r.user_id)
                 WHERE r.group_id = ?`,
                [group.group_id]
            );
            group.members = members;
        }

        res.json({
            success: true,
            data: groups
        });

    } catch (error) {
        next(error);
    }
});

// Get group details
router.get('/group/:groupId', authenticate, requireMember, async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        // Check if user is part of the group
        const hasMembership = await isAcceptedGroupMember(req.params.groupId, req.user.userId);

        if (!hasMembership) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Get group info
        const groupInfo = await executeQuery(
            `SELECT rg.group_id,
                    COALESCE(rg.group_name, r.group_name) as group_name,
                    rg.created_by,
                    rg.expense_category,
                      rg.expense_label,
                    rg.expense_status,
                    rg.allow_member_edit_history,
                          rg.admin_upi_id,
                          rg.admin_scanner_url,
                          rg.admin_drive_link,
                                        rg.closed_at,
                                        rg.is_deleted
             FROM roommate_groups rg
             LEFT JOIN roommates r ON r.group_id = rg.group_id
             WHERE rg.group_id = ?
             LIMIT 1`,
            [req.params.groupId]
        );

        let resolvedGroup = groupInfo[0] || null;

        if (groupInfo.length === 0) {
            const fallbackGroup = await executeQuery(
                'SELECT group_id, group_name FROM roommates WHERE group_id = ? LIMIT 1',
                [req.params.groupId]
            );

            if (fallbackGroup.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            const ownerId = await getGroupOwnerId(req.params.groupId);
            fallbackGroup[0].created_by = ownerId;
            resolvedGroup = fallbackGroup[0];
        }

        if (Number(resolvedGroup?.is_deleted || 0) === 1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        // Get all members
        const members = await executeQuery(
            `SELECT r.id, r.user_id, r.linked_user_id, r.name, r.email, r.contact, r.city, r.status, r.invited_at, r.accepted_at,
                    u.unique_id, u.profile_image, inviter.name as invited_by_name
             FROM roommates r
             LEFT JOIN users u ON u.id = COALESCE(r.linked_user_id, r.user_id)
             LEFT JOIN users inviter ON r.invited_by = inviter.id
             WHERE r.group_id = ?
             ORDER BY r.created_at`,
            [req.params.groupId]
        );

        // Get recent expenses
        const expenses = await executeQuery(
            `SELECT e.expense_id, e.title, e.cost, e.expense_date, e.is_settled,
                    u.name as paid_by_name
             FROM expenses e
             JOIN users u ON e.paid_by = u.id
             WHERE e.group_id = ?
             ORDER BY e.expense_date DESC
             LIMIT 5`,
            [req.params.groupId]
        );

        res.json({
            success: true,
            data: {
                group: resolvedGroup,
                members,
                recentExpenses: expenses
            }
        });

    } catch (error) {
        next(error);
    }
});

// Create new group and add first roommate
router.post('/group', authenticate, requireMember, [
    body('groupName').optional().trim(),
    body('expenseLabel').optional().trim(),
    body('expenseCategory').optional().isIn(['Daily', 'TripOther']),
    body('allowMemberEditHistory').optional().isBoolean(),
    body('roommates').optional().isArray()
], async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const {
            groupName,
            expenseLabel,
            roommates = [],
            expenseCategory = 'Daily',
            allowMemberEditHistory = false
        } = req.body;

        const resolvedGroupName = String(groupName || `Group ${groupId}`).trim();
        const resolvedExpenseLabel = String(
            expenseLabel || (expenseCategory === 'Daily' ? getCurrentMonthExpenseLabel() : resolvedGroupName)
        ).trim();

        // Generate group ID
        let groupId;
        let isUnique = false;
        while (!isUnique) {
            groupId = generateGroupId();
            const existing = await executeQuery(
                'SELECT id FROM roommate_groups WHERE group_id = ?',
                [groupId]
            );
            if (existing.length === 0) isUnique = true;
        }

        // Add creator as first member
        const creator = await executeQuery(
            'SELECT name, email, contact FROM users WHERE id = ?',
            [req.user.userId]
        );

        await executeQuery(
            `INSERT INTO roommate_groups (
                group_id, group_name, created_by, expense_category, expense_label, expense_status, allow_member_edit_history
             ) VALUES (?, ?, ?, ?, ?, 'Ongoing', ?)`,
            [groupId, resolvedGroupName, req.user.userId, expenseCategory, resolvedExpenseLabel, allowMemberEditHistory ? 1 : 0]
        );

        await executeQuery(
            `INSERT INTO roommates (
                user_id, name, email, contact, group_id, group_name,
                linked_user_id, status, invited_by, accepted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Accepted', ?, NOW())`,
            [
                req.user.userId, creator[0].name, creator[0].email, creator[0].contact,
                groupId, resolvedGroupName, req.user.userId, req.user.userId
            ]
        );

        // Add other roommates
        for (const roommate of roommates) {
            if (String(roommate.email || '').toLowerCase() === String(creator[0].email || '').toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot add your own email as a roommate'
                });
            }

            const inviteToken = generateInviteToken();
            
            await executeQuery(
                `INSERT INTO roommates (
                    name, email, contact, city, group_id, group_name,
                    invite_token, invited_by, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
                [
                    roommate.name, roommate.email, roommate.contact || null,
                    roommate.city || null, groupId, groupName || `Group ${groupId}`,
                    inviteToken, req.user.userId
                ]
            );

            // Send invitation email
            await sendRoommateInviteEmail(
                roommate.email,
                roommate.name,
                creator[0].name,
                groupId,
                inviteToken,
                resolvedGroupName || `Room ${groupId}`
            );
        }

        res.status(201).json({
            success: true,
            message: 'Group created successfully',
            data: { groupId, groupName: resolvedGroupName }
        });

    } catch (error) {
        next(error);
    }
});

// Add roommate to existing group
router.post('/group/:groupId/add', authenticate, requireMember, [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('contact').optional(),
    body('city').optional()
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

        const { name, email, contact, city } = req.body;
        const { groupId } = req.params;

        // Check if user is part of the group
        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);

        if (!hasMembership) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        // Check if email already in group
        const existing = await executeQuery(
            'SELECT id FROM roommates WHERE group_id = ? AND email = ?',
            [groupId, email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'This email is already in the group'
            });
        }

        // Get group name
        const groupInfo = await executeQuery(
            'SELECT group_name FROM roommates WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        // Get inviter name
        const inviter = await executeQuery(
            'SELECT name, email FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (String(inviter[0]?.email || '').toLowerCase() === String(email || '').toLowerCase()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add your own email as a roommate'
            });
        }

        const inviteToken = generateInviteToken();

        await executeQuery(
            `INSERT INTO roommates (
                name, email, contact, city, group_id, group_name,
                invite_token, invited_by, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
            [
                name, email, contact || null, city || null,
                groupId, groupInfo[0]?.group_name || `Group ${groupId}`,
                inviteToken, req.user.userId
            ]
        );

        // Send invitation email
        await sendRoommateInviteEmail(
            email,
            name,
            inviter[0].name,
            groupId,
            inviteToken,
            groupInfo[0]?.group_name || `Room ${groupId}`
        );

        res.json({
            success: true,
            message: 'Roommate invited successfully'
        });

    } catch (error) {
        next(error);
    }
});

router.post('/group/:groupId/expense-settings', authenticate, requireMember, async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();

        const { groupId } = req.params;
        const { groupName, expenseCategory, expenseLabel, expenseStatus, allowMemberEditHistory, adminUpiId, adminScannerUrl, adminDriveLink, createdBy } = req.body;

        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);
        if (!hasMembership) {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const deletedRows = await executeQuery(
            'SELECT is_deleted FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (deletedRows[0] && Number(deletedRows[0].is_deleted || 0) === 1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const updates = [];
        const values = [];

        const groupMetaRows = await executeQuery(
            'SELECT created_by, is_deleted FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (groupMetaRows.length === 0 || Number(groupMetaRows[0].is_deleted || 0) === 1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        if (groupName !== undefined) {
            const normalizedGroupName = String(groupName || '').trim();
            if (!normalizedGroupName) {
                return res.status(400).json({
                    success: false,
                    message: 'Group name is required'
                });
            }
            if (normalizedGroupName.length > 180) {
                return res.status(400).json({
                    success: false,
                    message: 'Group name is too long'
                });
            }

            const groupRows = await executeQuery(
                'SELECT created_by FROM roommate_groups WHERE group_id = ? LIMIT 1',
                [groupId]
            );

            if (!groupRows[0]) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            if (Number(groupRows[0].created_by) !== Number(req.user.userId) && req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only current group admin can edit group name'
                });
            }

            updates.push('group_name = ?');
            values.push(normalizedGroupName);
        }

        if (expenseCategory !== undefined) {
            updates.push('expense_category = ?');
            values.push(expenseCategory);
        }

        if (expenseLabel !== undefined) {
            if (Number(groupMetaRows[0].created_by) !== Number(req.user.userId) && req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only current group admin can change expense label'
                });
            }
            const normalizedLabel = String(expenseLabel || '').trim();
            if (!normalizedLabel) {
                return res.status(400).json({
                    success: false,
                    message: 'Expense label is required'
                });
            }
            if (normalizedLabel.length > 180) {
                return res.status(400).json({
                    success: false,
                    message: 'Expense label is too long'
                });
            }
            updates.push('expense_label = ?');
            values.push(normalizedLabel);
        }

        if (expenseStatus !== undefined) {
            if (Number(groupMetaRows[0].created_by) !== Number(req.user.userId) && req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only current group admin can close or reopen group expenses'
                });
            }
            updates.push('expense_status = ?');
            values.push(expenseStatus);
            updates.push('closed_at = ?');
            values.push(expenseStatus === 'Closed' ? new Date() : null);
        }

        if (allowMemberEditHistory !== undefined) {
            updates.push('allow_member_edit_history = ?');
            values.push(allowMemberEditHistory ? 1 : 0);
        }

        if (adminUpiId !== undefined) {
            const normalizedUpi = String(adminUpiId || '').trim();
            if (normalizedUpi.length > 120) {
                return res.status(400).json({
                    success: false,
                    message: 'Admin UPI ID is too long'
                });
            }
            updates.push('admin_upi_id = ?');
            values.push(normalizedUpi || null);
        }

        if (adminScannerUrl !== undefined) {
            const normalizedScanner = String(adminScannerUrl || '').trim();
            if (normalizedScanner.length > 2048) {
                return res.status(400).json({
                    success: false,
                    message: 'Admin scanner URL is too long'
                });
            }
            updates.push('admin_scanner_url = ?');
            values.push(normalizedScanner || null);
        }

        if (adminDriveLink !== undefined) {
            const normalizedDrive = String(adminDriveLink || '').trim();
            if (normalizedDrive.length > 2048) {
                return res.status(400).json({
                    success: false,
                    message: 'Admin drive link is too long'
                });
            }
            updates.push('admin_drive_link = ?');
            values.push(normalizedDrive || null);
        }

        if (createdBy !== undefined) {
            const groupRows = await executeQuery(
                'SELECT created_by FROM roommate_groups WHERE group_id = ? LIMIT 1',
                [groupId]
            );

            if (!groupRows[0]) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            if (Number(groupRows[0].created_by) !== Number(req.user.userId) && req.user.role !== 'Admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only current group admin can assign a new admin'
                });
            }

            const nextAdminId = Number(createdBy);
            if (!Number.isInteger(nextAdminId) || nextAdminId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid admin user id'
                });
            }

            const acceptedMemberRows = await executeQuery(
                `SELECT id
                 FROM roommates
                 WHERE group_id = ?
                   AND status = 'Accepted'
                   AND (user_id = ? OR linked_user_id = ?)
                 LIMIT 1`,
                [groupId, nextAdminId, nextAdminId]
            );

            if (acceptedMemberRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected admin must be an accepted group member'
                });
            }

            updates.push('created_by = ?');
            values.push(nextAdminId);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No expense group settings provided'
            });
        }

        values.push(groupId);

        await executeQuery(
            `UPDATE roommate_groups
             SET ${updates.join(', ')}
             WHERE group_id = ?`,
            values
        );

        if (groupName !== undefined) {
            await executeQuery(
                'UPDATE roommates SET group_name = ? WHERE group_id = ?',
                [String(groupName).trim(), groupId]
            );
        }

        res.json({
            success: true,
            message: 'Expense group settings updated successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Update roommate details (any accepted group member can edit)
router.put('/group/:groupId/member/:memberId', authenticate, requireMember, [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('contact').optional(),
    body('city').optional(),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { groupId, memberId } = req.params;
        const { name, email, contact, city } = req.body;

        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);
        if (!hasMembership && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group',
            });
        }

        const memberRows = await executeQuery(
            'SELECT id FROM roommates WHERE id = ? AND group_id = ? LIMIT 1',
            [memberId, groupId]
        );

        if (memberRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found',
            });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(String(name).trim());
        }

        if (email !== undefined) {
            const normalizedEmail = String(email).trim().toLowerCase();

            const duplicateRows = await executeQuery(
                'SELECT id FROM roommates WHERE group_id = ? AND LOWER(email) = LOWER(?) AND id <> ? LIMIT 1',
                [groupId, normalizedEmail, memberId]
            );

            if (duplicateRows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'This email is already used by another member in this group',
                });
            }

            updates.push('email = ?');
            params.push(normalizedEmail);
        }

        if (contact !== undefined) {
            const normalizedContact = String(contact || '').trim();
            updates.push('contact = ?');
            params.push(normalizedContact || null);
        }

        if (city !== undefined) {
            const normalizedCity = String(city || '').trim();
            updates.push('city = ?');
            params.push(normalizedCity || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No member details provided to update',
            });
        }

        params.push(memberId, groupId);

        await executeQuery(
            `UPDATE roommates
             SET ${updates.join(', ')}
             WHERE id = ? AND group_id = ?`,
            params
        );

        res.json({
            success: true,
            message: 'Member details updated successfully',
        });
    } catch (error) {
        next(error);
    }
});

// Upload admin scanner image for a group (only group admin)
router.post('/group/:groupId/admin-scanner-upload', authenticate, requireMember, handleUpload('scanner', 1), async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        const { groupId } = req.params;

        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);
        if (!hasMembership && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const groupRows = await executeQuery(
            'SELECT created_by FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (!groupRows[0] || Number(groupRows[0].created_by) !== Number(req.user.userId)) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can upload scanner image'
            });
        }

        const scannerFile = req.files && req.files[0] ? req.files[0] : null;
        if (!scannerFile) {
            return res.status(400).json({
                success: false,
                message: 'Please select a scanner image to upload'
            });
        }

        const scannerUrl = await uploadImageBuffer({
            buffer: scannerFile.buffer,
            mimeType: scannerFile.mimetype,
            originalName: scannerFile.originalname || `scanner-${Date.now()}`,
            folder: 'scanner'
        });

        if (!scannerUrl) {
            return res.status(400).json({
                success: false,
                message: 'Scanner upload failed. Please try again.'
            });
        }

        await executeQuery(
            'UPDATE roommate_groups SET admin_scanner_url = ? WHERE group_id = ?',
            [scannerUrl, groupId]
        );

        res.json({
            success: true,
            message: 'Scanner uploaded successfully',
            data: { scannerUrl }
        });
    } catch (error) {
        next(error);
    }
});

// Accept invitation
router.post('/accept-invite', authenticate, async (req, res, next) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Invitation token is required'
            });
        }

        const invitations = await executeQuery(
            'SELECT * FROM roommates WHERE invite_token = ? AND status = ?',
            [token, 'Pending']
        );

        if (invitations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invitation'
            });
        }

        const invitation = invitations[0];

        const users = await executeQuery(
            'SELECT id, email FROM users WHERE id = ? LIMIT 1',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Please login to accept this invitation'
            });
        }

        const currentUser = users[0];
        if (String(currentUser.email || '').toLowerCase() !== String(invitation.email || '').toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: 'Please login with the invited email address to accept this invitation'
            });
        }

        await executeQuery(
            `UPDATE roommates 
             SET user_id = ?, linked_user_id = ?, status = 'Accepted', 
                 accepted_at = NOW(), invite_token = NULL 
             WHERE id = ?`,
            [currentUser.id, currentUser.id, invitation.id]
        );

        res.json({
            success: true,
            message: 'Invitation accepted successfully',
            data: {
                requiresRegistration: false,
                email: invitation.email,
                groupId: invitation.group_id
            }
        });

    } catch (error) {
        next(error);
    }
});

// Accept invitation after fresh registration + OTP verification.
router.post('/accept-invite-after-registration', [
    body('token').trim().notEmpty(),
    body('email').isEmail().normalizeEmail()
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

        const { token, email } = req.body;

        const invitations = await executeQuery(
            'SELECT * FROM roommates WHERE invite_token = ? AND status = ?',
            [token, 'Pending']
        );

        if (invitations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired invitation'
            });
        }

        const invitation = invitations[0];
        if (String(invitation.email || '').toLowerCase() !== String(email || '').toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: 'Invitation email does not match registered email'
            });
        }

        const users = await executeQuery(
            'SELECT id, email FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not registered. Please register first.'
            });
        }

        const registeredUser = users[0];

        await executeQuery(
            `UPDATE roommates
             SET user_id = ?, linked_user_id = ?, status = 'Accepted',
                 accepted_at = NOW(), invite_token = NULL
             WHERE id = ?`,
            [registeredUser.id, registeredUser.id, invitation.id]
        );

        res.json({
            success: true,
            message: 'Invitation accepted successfully',
            data: {
                email: invitation.email,
                groupId: invitation.group_id
            }
        });
    } catch (error) {
        next(error);
    }
});

// Remove roommate from group
router.delete('/group/:groupId/member/:memberId', authenticate, requireMember, async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        const { groupId, memberId } = req.params;

        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);
        if (!hasMembership && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const groupRows = await executeQuery(
            'SELECT created_by, is_deleted FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (!groupRows[0] || Number(groupRows[0].is_deleted || 0) === 1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const isGroupAdmin = Number(groupRows[0].created_by || 0) === Number(req.user.userId) || req.user.role === 'Admin';
        if (!isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can remove members'
            });
        }

        const membership = await executeQuery(
            'SELECT id, invited_by, user_id FROM roommates WHERE id = ? AND group_id = ?',
            [memberId, groupId]
        );

        if (membership.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const targetRows = await executeQuery(
            'SELECT created_by FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (targetRows[0] && Number(targetRows[0].created_by || 0) === Number(membership[0].user_id || 0)) {
            return res.status(400).json({
                success: false,
                message: 'Group admin cannot be removed. Assign new admin first.'
            });
        }

        // Delete the row – this also invalidates any pending invite_token for this member
        await executeQuery(
            'DELETE FROM roommates WHERE id = ?',
            [memberId]
        );

        res.json({
            success: true,
            message: 'Member removed successfully'
        });

    } catch (error) {
        next(error);
    }
});

// Delete expense group (soft delete metadata only; keep expense history intact)
router.delete('/group/:groupId', authenticate, requireMember, async (req, res, next) => {
    try {
        await ensureExpenseGroupSchema();
        const { groupId } = req.params;

        const groupRows = await executeQuery(
            'SELECT created_by, is_deleted FROM roommate_groups WHERE group_id = ? LIMIT 1',
            [groupId]
        );

        if (!groupRows[0] || Number(groupRows[0].is_deleted || 0) === 1) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }

        const hasMembership = await isAcceptedGroupMember(groupId, req.user.userId);
        if (!hasMembership && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        const isGroupAdmin = Number(groupRows[0].created_by || 0) === Number(req.user.userId) || req.user.role === 'Admin';
        if (!isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only group admin can delete this group'
            });
        }

        const ongoingRows = await executeQuery(
            `SELECT expense_id
             FROM expenses
             WHERE group_id = ? AND is_settled = FALSE
             LIMIT 1`,
            [groupId]
        );

        if (ongoingRows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete group while ongoing expenses exist. Please settle or close them first.'
            });
        }

        await executeQuery(
            `UPDATE roommate_groups
             SET is_deleted = 1,
                 deleted_at = NOW(),
                 expense_status = 'Closed',
                 closed_at = COALESCE(closed_at, NOW())
             WHERE group_id = ?`,
            [groupId]
        );

        res.json({
            success: true,
            message: 'Group deleted successfully. Expense history remains unchanged.'
        });
    } catch (error) {
        next(error);
    }
});

// Leave group
router.post('/group/:groupId/leave', authenticate, requireMember, async (req, res, next) => {
    try {
        const membership = await executeQuery(
            'SELECT id FROM roommates WHERE group_id = ? AND user_id = ?',
            [req.params.groupId, req.user.userId]
        );

        if (membership.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'You are not a member of this group'
            });
        }

        await executeQuery(
            'DELETE FROM roommates WHERE id = ?',
            [membership[0].id]
        );

        res.json({
            success: true,
            message: 'You have left the group'
        });

    } catch (error) {
        next(error);
    }
});

// Get pending invitations for current user
router.get('/invitations/pending', authenticate, requireMember, async (req, res, next) => {
    try {
        const invitations = await executeQuery(
            `SELECT r.*, inviter.name as invited_by_name
             FROM roommates r
             JOIN users inviter ON r.invited_by = inviter.id
             WHERE r.email = (SELECT email FROM users WHERE id = ?) 
             AND r.status = 'Pending'`,
            [req.user.userId]
        );

        res.json({
            success: true,
            data: invitations
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
