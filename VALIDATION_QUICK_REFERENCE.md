# Input Validation Quick Reference

## Using the Validation Utility

### 1. Text Validation
```typescript
import { validateAndSanitizeText, VALIDATION_LIMITS } from '../utils/inputValidation';

// Validate form input
const validation = validateAndSanitizeText(userInput, VALIDATION_LIMITS.MAX_MEDIUM_TEXT);
if (validation.isValid) {
  saveData(validation.sanitized);  // Use sanitized value
} else {
  showError(validation.error);     // Show error to user
}
```

### 2. File Validation
```typescript
import { validateImageFile, validateTextFile, validateFile } from '../utils/inputValidation';

// Validate image
const imgValidation = validateImageFile(file);
if (!imgValidation.isValid) {
  alert(`Error: ${imgValidation.error}`);
  return;
}

// Validate text file
const textValidation = validateTextFile(file);

// Generic validation with options
const fileValidation = validateFile(file, {
  maxSize: 10 * 1024 * 1024,
  allowedMimes: ['application/pdf'],
  allowedExts: ['.pdf']
});
```

### 3. File Name Sanitization
```typescript
import { sanitizeFileName } from '../utils/inputValidation';

const safeName = sanitizeFileName(file.name);
// '../../../etc/passwd.txt' → 'passwd.txt'
// 'malicious<script>.jpg' → 'maliciousscript.jpg'
```

### 4. Sanitizing for Display
```typescript
import { sanitizeForDisplay, escapeHtml } from '../utils/inputValidation';

// Safe HTML rendering with limited tags
const html = sanitizeForDisplay(userContent);
<div dangerouslySetInnerHTML={{ __html: html }} />

// Escape HTML for plain text display
const safe = escapeHtml(userInput);
<div>{safe}</div>
```

### 5. Form Data Validation
```typescript
import { validateFormData } from '../utils/inputValidation';

const schema = {
  email: { type: 'email', required: true },
  name: { type: 'text', maxLength: 200, required: true },
  bio: { type: 'text', maxLength: 1000, required: false },
};

const result = validateFormData(formData, schema);
if (result.isValid) {
  saveForm(result.sanitized);
} else {
  displayErrors(result.errors);  // { email: 'Invalid email format', ... }
}
```

### 6. localStorage Safety
```typescript
import { setStorageData, getStorageData } from '../utils/inputValidation';

// Safe write
const success = setStorageData('my-key', data, true);  // true = JSON.stringify
if (!success) {
  console.warn('Failed to save data');
}

// Safe read
const data = getStorageData('my-key', defaultValue, true);  // true = JSON.parse
// Will return defaultValue if key not found or invalid JSON
```

## Validation Limits

```typescript
import { VALIDATION_LIMITS } from '../utils/inputValidation';

// Text field sizes
VALIDATION_LIMITS.MAX_SHORT_TEXT      // 200 chars (names)
VALIDATION_LIMITS.MAX_MEDIUM_TEXT     // 1000 chars (descriptions)
VALIDATION_LIMITS.MAX_LONG_TEXT       // 10000 chars (details)

// File sizes
VALIDATION_LIMITS.MAX_IMAGE_SIZE      // 25MB
VALIDATION_LIMITS.MAX_PDF_SIZE        // 50MB
VALIDATION_LIMITS.MAX_TEXT_FILE_SIZE  // 10MB

// Counts
VALIDATION_LIMITS.MAX_FILES_PER_UPLOAD // 10 files
```

## Allowed File Types

```typescript
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from '../utils/inputValidation';

// Images
ALLOWED_MIME_TYPES.images     // ['image/jpeg', 'image/png', 'image/gif', ...]
ALLOWED_EXTENSIONS.images     // ['.jpg', '.jpeg', '.png', ...]

// Documents
ALLOWED_MIME_TYPES.documents  // ['application/pdf', 'text/plain', ...]
ALLOWED_EXTENSIONS.documents  // ['.pdf', '.txt', '.md', ...]

// Videos
ALLOWED_MIME_TYPES.videos     // ['video/mp4', 'video/webm', ...]
ALLOWED_EXTENSIONS.videos     // ['.mp4', '.webm', ...]
```

## Common Patterns

### Form Input Handler
```typescript
const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { isValid, sanitized, error } = validateAndSanitizeText(
    e.target.value,
    VALIDATION_LIMITS.MAX_MEDIUM_TEXT
  );

  if (isValid) {
    setValue(sanitized);
    setError(null);
  } else {
    setError(error);
    // Don't update state if validation failed
  }
};
```

### File Upload Handler
```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  for (const file of files) {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      showError(`${file.name}: ${validation.error}`);
      continue;
    }

    // Process valid file
    const safeName = sanitizeFileName(file.name);
    processFile(file, safeName);
  }

  e.target.value = '';  // Reset input
};
```

### Safe localStorage
```typescript
// Save
const data = { name: 'test', items: [] };
if (!setStorageData('app-data', data, true)) {
  console.warn('Could not save data');
}

// Load
const loaded = getStorageData('app-data', { name: '', items: [] }, true);
// Safely handles: missing key, invalid JSON, etc.
```

## Error Handling

All validation functions return consistent error objects:

```typescript
{
  isValid: boolean,
  error?: string,      // User-friendly error message
  sanitized?: string,  // Sanitized value (if applicable)
  value?: number       // Numeric value (if applicable)
}
```

### Handling Errors
```typescript
const result = validateAndSanitizeText(input, 1000);

if (!result.isValid) {
  // Show error to user
  setErrorMessage(result.error);  // "Text must not exceed 1000 characters"
  // Don't proceed with invalid data
  return;
}

// Use sanitized value
useData(result.sanitized);
```

## Configuration

All limits are easily configurable in `inputValidation.ts`:

```typescript
export const VALIDATION_LIMITS = {
  MAX_SHORT_TEXT: 200,        // ← Change brand name limit
  MAX_MEDIUM_TEXT: 1000,      // ← Change description limit
  MAX_IMAGE_SIZE: 25 * 1024 * 1024,  // ← Change image size limit
  // ... etc
};

export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', /* add more if needed */],
  // ... etc
};
```

## Testing

```typescript
// Test text validation
const result = validateAndSanitizeText('<script>alert("xss")</script>', 100);
assert(!result.isValid);  // Should fail
assert(result.error);

// Test file validation
const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
const validation = validateImageFile(file);
assert(validation.isValid);

// Test sanitization
const safe = sanitizeFileName('../../../etc/passwd');
assert(!safe.includes('/'));  // No path traversal
```

## Best Practices

1. **Always validate on input** — Check user data immediately
2. **Sanitize before storage** — Use sanitized values for localStorage
3. **Sanitize for display** — Use escapeHtml() or sanitizeForDisplay()
4. **Check file sizes first** — Fast rejection of oversized files
5. **Validate MIME + extension** — Don't rely on one alone
6. **Use whitelists** — Only allow known-safe types
7. **Provide clear errors** — Tell users what's wrong
8. **Log security events** — Track validation failures
9. **Test edge cases** — Empty strings, huge inputs, malformed data
10. **Review limits** — Adjust based on your requirements

## Debugging

Enable console logging of validation issues:

```typescript
// In inputValidation.ts, errors are logged:
console.warn(`Validation failed for field ${name}: ${validation.error}`);

// In browser console, search for:
// "Validation failed" — find validation errors
// "Invalid image" — find file validation errors
// "Failed to save" — find storage errors
```

## Support

For questions or issues with validation:
1. Check the error message — it usually explains the problem
2. Review VALIDATION_LIMITS — ensure your data fits requirements
3. Check ALLOWED_MIME_TYPES — ensure file type is allowed
4. Review the audit report — detailed examples and explanations

