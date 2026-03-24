const path = require('path');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const normalizeFileName = (name) => {
    const raw = String(name || 'image').trim().toLowerCase();
    return raw
        .replace(/[^a-z0-9._-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'image';
};

const getProvider = () => {
    return String(process.env.IMAGE_STORAGE_PROVIDER || 'imgbb').toLowerCase();
};

const uploadToImgBB = async ({ buffer, originalName }) => {
    const imageStorageApiKey = process.env.IMAGE_STORAGE_API_KEY;
    const imageStorageUrl = process.env.IMAGE_STORAGE_URL || 'https://api.imgbb.com/1/upload';

    if (!imageStorageApiKey) {
        throw new Error('IMAGE_STORAGE_API_KEY is missing for ImgBB uploads');
    }

    const base64Image = buffer.toString('base64');
    const payload = new URLSearchParams();
    payload.append('image', base64Image);
    payload.append('name', originalName || `image-${Date.now()}`);

    const uploadResponse = await axios.post(
        `${imageStorageUrl}?key=${imageStorageApiKey}`,
        payload.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 30000,
        }
    );

    const url =
        uploadResponse?.data?.data?.display_url ||
        uploadResponse?.data?.data?.url ||
        null;

    if (!url) {
        throw new Error('ImgBB upload did not return a valid URL');
    }

    return url;
};

const getR2Client = () => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 credentials missing: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
};

const uploadToR2 = async ({ buffer, mimeType, originalName, folder = 'uploads' }) => {
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) {
        throw new Error('R2_BUCKET_NAME is missing for R2 uploads');
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const safeName = normalizeFileName(originalName || `image-${Date.now()}`);
    const objectKey = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;

    const r2Client = getR2Client();
    await r2Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Body: buffer,
            ContentType: mimeType || 'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
        })
    );

    if (publicBaseUrl) {
        return `${publicBaseUrl}/${objectKey}`;
    }

    if (accountId) {
        return `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
    }

    return objectKey;
};

const uploadImageBuffer = async ({ buffer, mimeType, originalName, folder = 'uploads' }) => {
    const provider = getProvider();

    if (provider === 'r2') {
        try {
            return await uploadToR2({ buffer, mimeType, originalName, folder });
        } catch (r2Error) {
            if (process.env.IMAGE_STORAGE_FALLBACK_TO_IMGBB === 'true') {
                console.warn('R2 upload failed, falling back to ImgBB:', r2Error.message);
                return uploadToImgBB({ buffer, originalName });
            }
            throw r2Error;
        }
    }

    return uploadToImgBB({ buffer, originalName });
};

const uploadImageFiles = async (files = [], folder = 'uploads') => {
    const uploadResults = await Promise.all(
        files.map((file) =>
            uploadImageBuffer({
                buffer: file.buffer,
                mimeType: file.mimetype,
                originalName: file.originalname,
                folder,
            })
        )
    );

    return uploadResults.filter(Boolean);
};

module.exports = {
    uploadImageBuffer,
    uploadImageFiles,
};
