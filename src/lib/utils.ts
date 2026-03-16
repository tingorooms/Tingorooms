import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse images from various formats (string or array)
 * Handles JSON strings, arrays, and invalid formats
 */
export function parseImages(images: unknown): string[] {
  // If already an array, return it
  if (Array.isArray(images)) {
    return images.filter(img => typeof img === 'string' && img.trim().length > 0);
  }

  // If it's a string, try to parse as JSON
  if (typeof images === 'string' && images.trim().length > 0) {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) {
        return parsed.filter(img => typeof img === 'string' && img.trim().length > 0);
      }
    } catch {
      // Not valid JSON, return empty array
    }
  }

  return [];
}

/**
 * Get the first image from images (handles both formats)
 */
export function getFirstImage(images: unknown): string {
  const parsed = parseImages(images);
  return parsed.length > 0 ? parsed[0] : '';
}

/**
 * Format profile image URL to use the correct API base URL
 * Handles relative paths like /uploads/profiles/filename
 */
export function getProfileImageUrl(profileImage: string | null | undefined): string {
  return getMediaAssetUrl(profileImage);
}

export function getMediaAssetUrl(assetUrl: string | null | undefined): string {
  const raw = String(assetUrl || '').trim();
  if (!raw) return '';

  const decoded = raw
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/g, '/')
    .replace(/&#x3A;/gi, ':')
    .replace(/&#58;/g, ':')
    .replace(/&#x3F;/gi, '?')
    .replace(/&#63;/g, '?')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#61;/g, '=')
    .trim();

  if (!decoded) return '';
  if (/^https?:\/\//i.test(decoded)) return decoded;

  const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const cleanPath = decoded.startsWith('/') ? decoded : `/${decoded}`;
  return `${apiOrigin}${cleanPath}`;
}

export function normalizePhoneForWhatsApp(value?: string | null): string {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  let digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Default to India country code when only local 10-digit number is provided.
  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length >= 11) {
    return digits;
  }

  return '';
}

export function buildWhatsAppUrl(value?: string | null, message?: string): string {
  const normalizedPhone = normalizePhoneForWhatsApp(value);
  if (!normalizedPhone) return '';

  if (!message) {
    return `https://wa.me/${normalizedPhone}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function toSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function buildRoomPath(roomId: string | number, title?: string, area?: string, city?: string): string {
  const slugSource = [title, area, city].filter(Boolean).join('-');
  const slug = toSlug(slugSource);
  return slug ? `/room/${roomId}/${slug}` : `/room/${roomId}`;
}

export function buildBrokerPath(brokerIdOrUniqueId: string | number, brokerName?: string): string {
  const slug = toSlug(String(brokerName || ''));
  return slug ? `/broker/${brokerIdOrUniqueId}/${slug}` : `/broker/${brokerIdOrUniqueId}`;
}
