/**
 * Input Validation & Sanitization Utility
 * Provides comprehensive form input validation, sanitization, and file handling
 * Prevents XSS, injection attacks, and data integrity issues
 */

import DOMPurify from 'dompurify';

// ═══════════════════════════════════════════════════════════
// Configuration & Constants
// ═══════════════════════════════════════════════════════════

export const VALIDATION_LIMITS = {
  // Text fields
  MIN_TEXT_LENGTH: 1,
  MAX_SHORT_TEXT: 200, // brandName, personaName, etc.
  MAX_MEDIUM_TEXT: 1000, // descriptions
  MAX_LONG_TEXT: 10000, // objections, testimonials, etc.
  MAX_TEXTAREA: 5000,

  // Files
  MAX_IMAGE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_PDF_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TEXT_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES_PER_UPLOAD: 10,

  // Numbers
  MAX_NUMBER_VALUE: Number.MAX_SAFE_INTEGER,
  MIN_NUMBER_VALUE: 0,
};

// Allowed MIME types (whitelist)
export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: ['application/pdf', 'text/plain', 'text/markdown', 'application/json'],
  videos: ['video/mp4', 'video/webm', 'video/quicktime'],
};

// File extension whitelist (secondary check)
export const ALLOWED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  documents: ['.pdf', '.txt', '.md', '.json'],
  videos: ['.mp4', '.webm', '.mov', '.avi'],
};

// ═══════════════════════════════════════════════════════════
// Text Validation & Sanitization
// ═══════════════════════════════════════════════════════════

/**
 * Validate and sanitize text input
 * Removes scripts, dangerous tags, and enforces length limits
 */
export function validateAndSanitizeText(
  value: string | undefined,
  maxLength: number = VALIDATION_LIMITS.MAX_MEDIUM_TEXT,
  minLength: number = VALIDATION_LIMITS.MIN_TEXT_LENGTH
): { isValid: boolean; sanitized: string; error?: string } {
  if (!value) {
    if (minLength > 0) {
      return { isValid: false, sanitized: '', error: 'This field is required' };
    }
    return { isValid: true, sanitized: '' };
  }

  const trimmed = value.trim();

  // Check length
  if (trimmed.length < minLength) {
    return {
      isValid: false,
      sanitized: trimmed,
      error: `Text must be at least ${minLength} characters`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      isValid: false,
      sanitized: trimmed.slice(0, maxLength),
      error: `Text must not exceed ${maxLength} characters (current: ${trimmed.length})`,
    };
  }

  // Sanitize HTML/scripts
  const sanitized = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });

  // Check if sanitization removed content (likely dangerous)
  if (sanitized.length < trimmed.length * 0.9) {
    return {
      isValid: false,
      sanitized,
      error: 'Text contains potentially dangerous content (scripts, tags, etc.)',
    };
  }

  return { isValid: true, sanitized };
}

/**
 * Sanitize text for safe HTML rendering
 */
export function sanitizeForDisplay(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// ═══════════════════════════════════════════════════════════
// Number Validation
// ═══════════════════════════════════════════════════════════

/**
 * Validate number input
 */
export function validateNumber(
  value: string | number | undefined,
  min: number = VALIDATION_LIMITS.MIN_NUMBER_VALUE,
  max: number = VALIDATION_LIMITS.MAX_NUMBER_VALUE,
  isFloat: boolean = false
): { isValid: boolean; value: number | null; error?: string } {
  if (value === undefined || value === '' || value === null) {
    return { isValid: false, value: null, error: 'Number is required' };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { isValid: false, value: null, error: 'Must be a valid number' };
  }

  if (!isFloat && !Number.isInteger(num)) {
    return { isValid: false, value: null, error: 'Must be a whole number' };
  }

  if (num < min || num > max) {
    return {
      isValid: false,
      value: num,
      error: `Number must be between ${min} and ${max}`,
    };
  }

  return { isValid: true, value: num };
}

// ═══════════════════════════════════════════════════════════
// Format Validation
// ═══════════════════════════════════════════════════════════

/**
 * Validate email format
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): { isValid: boolean; error?: string } {
  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate phone number (basic international format)
 */
export function validatePhone(phone: string): { isValid: boolean; error?: string } {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,}$/;
  if (!phoneRegex.test(phone)) {
    return { isValid: false, error: 'Invalid phone number format' };
  }
  return { isValid: true };
}

// ═══════════════════════════════════════════════════════════
// File Validation
// ═══════════════════════════════════════════════════════════

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSize: number = VALIDATION_LIMITS.MAX_IMAGE_SIZE
): { isValid: boolean; error?: string } {
  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(2);
    const fileMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      isValid: false,
      error: `File size (${fileMB}MB) exceeds maximum of ${maxMB}MB`,
    };
  }
  return { isValid: true };
}

/**
 * Validate file type using MIME type and extension
 */
export function validateFileType(
  file: File,
  allowedMimes: string[],
  allowedExts: string[] = []
): { isValid: boolean; error?: string } {
  // Check MIME type (primary)
  if (!allowedMimes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type ${file.type} is not allowed. Allowed types: ${allowedMimes.join(', ')}`,
    };
  }

  // Check extension (secondary validation)
  if (allowedExts.length > 0) {
    const fileName = file.name.toLowerCase();
    const hasValidExt = allowedExts.some((ext) =>
      fileName.endsWith(ext.toLowerCase())
    );

    if (!hasValidExt) {
      return {
        isValid: false,
        error: `File extension must be one of: ${allowedExts.join(', ')}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate image file (size + type)
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Check size
  const sizeCheck = validateFileSize(file, VALIDATION_LIMITS.MAX_IMAGE_SIZE);
  if (!sizeCheck.isValid) return sizeCheck;

  // Check type
  return validateFileType(
    file,
    ALLOWED_MIME_TYPES.images,
    ALLOWED_EXTENSIONS.images
  );
}

/**
 * Validate PDF file (size + type)
 */
export function validatePdfFile(file: File): { isValid: boolean; error?: string } {
  const sizeCheck = validateFileSize(file, VALIDATION_LIMITS.MAX_PDF_SIZE);
  if (!sizeCheck.isValid) return sizeCheck;

  return validateFileType(file, ['application/pdf'], ['.pdf']);
}

/**
 * Validate text file (size + type)
 */
export function validateTextFile(file: File): { isValid: boolean; error?: string } {
  const sizeCheck = validateFileSize(file, VALIDATION_LIMITS.MAX_TEXT_FILE_SIZE);
  if (!sizeCheck.isValid) return sizeCheck;

  return validateFileType(
    file,
    ALLOWED_MIME_TYPES.documents,
    ALLOWED_EXTENSIONS.documents
  );
}

/**
 * Comprehensive file validation with size and type checks
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number;
    allowedMimes?: string[];
    allowedExts?: string[];
  } = {}
): { isValid: boolean; error?: string } {
  const {
    maxSize = VALIDATION_LIMITS.MAX_IMAGE_SIZE,
    allowedMimes = ALLOWED_MIME_TYPES.images,
    allowedExts = ALLOWED_EXTENSIONS.images,
  } = options;

  // Check size
  const sizeCheck = validateFileSize(file, maxSize);
  if (!sizeCheck.isValid) return sizeCheck;

  // Check type
  return validateFileType(file, allowedMimes, allowedExts);
}

/**
 * Sanitize file name (remove special characters)
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path components
  let name = fileName.split(/[\\/]/).pop() || '';

  // Remove special characters, keep only alphanumeric, dash, underscore, dot
  name = name.replace(/[^\w\-. ]/g, '');

  // Remove leading dots
  name = name.replace(/^\.+/, '');

  // Limit length
  name = name.substring(0, 255);

  return name || 'file';
}

// ═══════════════════════════════════════════════════════════
// Object/Form Data Validation
// ═══════════════════════════════════════════════════════════

/**
 * Validate and sanitize form data object
 */
export function validateFormData(
  data: Record<string, any>,
  schema: Record<string, { type: string; maxLength?: number; required?: boolean }>
): { isValid: boolean; sanitized: Record<string, any>; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, any> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = data[key];

    // Check required
    if (field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[key] = `${key} is required`;
      continue;
    }

    // Skip if not required and empty
    if (!field.required && (!value || (typeof value === 'string' && !value.trim()))) {
      sanitized[key] = '';
      continue;
    }

    // Validate based on type
    if (field.type === 'text') {
      const validation = validateAndSanitizeText(value, field.maxLength);
      if (!validation.isValid) {
        errors[key] = validation.error || 'Invalid text';
      } else {
        sanitized[key] = validation.sanitized;
      }
    } else if (field.type === 'email') {
      const emailCheck = validateEmail(value);
      if (!emailCheck.isValid) {
        errors[key] = emailCheck.error;
      } else {
        sanitized[key] = value.toLowerCase().trim();
      }
    } else if (field.type === 'url') {
      const urlCheck = validateUrl(value);
      if (!urlCheck.isValid) {
        errors[key] = urlCheck.error;
      } else {
        sanitized[key] = value.trim();
      }
    } else if (field.type === 'number') {
      const numCheck = validateNumber(value);
      if (!numCheck.isValid) {
        errors[key] = numCheck.error;
      } else {
        sanitized[key] = numCheck.value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    sanitized,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════
// JSON/Data Validation
// ═══════════════════════════════════════════════════════════

/**
 * Safely parse and validate JSON
 */
export function parseJSON<T>(
  jsonString: string,
  fallback: T
): T {
  try {
    const parsed = JSON.parse(jsonString);
    // Basic validation - check if it's an object
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Validate localStorage data before use
 */
export function getStorageData<T>(
  key: string,
  fallback: T,
  isJson: boolean = false
): T {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return isJson ? parseJSON(data, fallback) : (data as unknown as T);
  } catch {
    return fallback;
  }
}

/**
 * Safely set localStorage data with validation
 */
export function setStorageData(
  key: string,
  value: any,
  isJson: boolean = false
): boolean {
  try {
    if (!key || typeof key !== 'string') return false;
    const stringValue = isJson ? JSON.stringify(value) : String(value);
    localStorage.setItem(key, stringValue);
    return true;
  } catch {
    console.warn(`Failed to save to localStorage: ${key}`);
    return false;
  }
}
