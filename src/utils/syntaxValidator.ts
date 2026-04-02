/**
 * Syntax Validator
 * ================
 * Advanced syntax validation for TypeScript, JavaScript, Python, and SQL.
 * Provides detailed error reporting, warning detection, and suggestions.
 */

import { createLogger } from './logger';

const log = createLogger('SyntaxValidator');

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  code?: string;
  severity: 'error' | 'warning';
}

export interface ValidatorReport {
  valid: boolean;
  language: string;
  totalLines: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: string;
}

// ─────────────────────────────────────────────────────────────
// TypeScript/JavaScript Validator
// ─────────────────────────────────────────────────────────────

class TypeScriptValidator {
  validate(code: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = code.split('\n');

    // Track state
    const bracketStack: { type: string; line: number; char: string }[] = [];
    const stringStates: { type: string; line: number }[] = [];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let inString = false;
      let stringChar = '';
      let i = 0;

      while (i < line.length) {
        const char = line[i];
        const prev = i > 0 ? line[i - 1] : '';
        const next = i + 1 < line.length ? line[i + 1] : '';

        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
            stringStates.push({ type: char, line: lineNum });
          } else if (char === stringChar) {
            inString = false;
            stringStates.pop();
          }
        }

        // Handle brackets (outside strings)
        if (!inString) {
          if (char === '{' || char === '[' || char === '(') {
            bracketStack.push({ type: char, line: lineNum, char });
          } else if (char === '}' || char === ']' || char === ')') {
            const expected = char === '}' ? '{' : char === ']' ? '[' : '(';
            if (bracketStack.length === 0 || bracketStack[bracketStack.length - 1].type !== expected) {
              errors.push({
                line: lineNum + 1,
                column: i + 1,
                message: `Unexpected closing bracket "${char}", expected opening "${expected}"`,
                code: 'BRACKET_MISMATCH',
                severity: 'error',
              });
            } else {
              bracketStack.pop();
            }
          }
        }

        i++;
      }

      // Check for common TypeScript issues
      if (line.includes('any') && !line.includes('// @ts-ignore')) {
        const anyIndex = line.indexOf('any');
        const context = line.substring(Math.max(0, anyIndex - 10), anyIndex + 13);
        if (!context.includes('http') && !context.includes('@')) {
          // Allow 'any' in URLs or comments
          errors.push({
            line: lineNum + 1,
            column: anyIndex + 1,
            message: 'Avoid using "any" type. Use specific types instead.',
            code: 'NO_ANY',
            severity: 'warning',
          });
        }
      }

      // Check for console.log (discourage in production)
      if (line.includes('console.log')) {
        errors.push({
          line: lineNum + 1,
          column: line.indexOf('console.log') + 1,
          message: 'Remove console.log in production code',
          code: 'NO_CONSOLE',
          severity: 'warning',
        });
      }

      // Check for missing semicolons (if enabled)
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.endsWith(';') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.endsWith(',') &&
        !trimmed.endsWith(':') &&
        !trimmed.endsWith('(') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*')
      ) {
        // This is a heuristic; not all lines need semicolons
        if (trimmed.match(/^(?:const|let|var|import|export|return|throw)\s/)) {
          // Could warn about missing semicolon, but it's not an error in TS
        }
      }
    }

    // Check unclosed brackets
    for (const bracket of bracketStack) {
      errors.push({
        line: bracket.line + 1,
        message: `Unclosed bracket "${bracket.char}" from line ${bracket.line + 1}`,
        code: 'UNCLOSED_BRACKET',
        severity: 'error',
      });
    }

    // Check unclosed strings
    for (const str of stringStates) {
      errors.push({
        line: str.line + 1,
        message: `Unclosed string with delimiter "${str.type}" from line ${str.line + 1}`,
        code: 'UNCLOSED_STRING',
        severity: 'error',
      });
    }

    return errors;
  }
}

// ─────────────────────────────────────────────────────────────
// Python Validator
// ─────────────────────────────────────────────────────────────

class PythonValidator {
  validate(code: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = code.split('\n');
    const indentStack: number[] = [0];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Calculate indentation
      const indent = line.search(/\S/);

      // Check indentation consistency
      if (indent > indentStack[indentStack.length - 1]) {
        if (!trimmed.endsWith(':')) {
          errors.push({
            line: lineNum + 1,
            message: 'Indentation increase without colon on previous line',
            code: 'INDENT_ERROR',
            severity: 'error',
          });
        } else {
          indentStack.push(indent);
        }
      } else if (indent < indentStack[indentStack.length - 1]) {
        // Pop indents until we find a matching level
        while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
          indentStack.pop();
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          errors.push({
            line: lineNum + 1,
            message: 'Indentation does not match any outer indentation level',
            code: 'INDENT_MISMATCH',
            severity: 'error',
          });
        }
      }

      // Check for unmatched parentheses/brackets
      const openParens = (trimmed.match(/\(/g) || []).length;
      const closeParens = (trimmed.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push({
          line: lineNum + 1,
          message: `Unmatched parentheses: ${openParens} open, ${closeParens} close`,
          code: 'PAREN_MISMATCH',
          severity: 'error',
        });
      }

      // Check for import statements
      if (trimmed.startsWith('from ') && trimmed.includes(' import ')) {
        // Valid: from X import Y
      } else if (trimmed.startsWith('import ')) {
        // Valid: import X
      }

      // Check for missing colons on control structures
      if (trimmed.match(/^(if|elif|else|for|while|def|class|with|try|except|finally)\s/) && !trimmed.endsWith(':')) {
        if (!trimmed.endsWith('\\')) {
          errors.push({
            line: lineNum + 1,
            message: `Statement "${trimmed.split(' ')[0]}" missing colon`,
            code: 'MISSING_COLON',
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }
}

// ─────────────────────────────────────────────────────────────
// SQL Validator
// ─────────────────────────────────────────────────────────────

class SQLValidator {
  private static readonly KEYWORDS = [
    'SELECT',
    'FROM',
    'WHERE',
    'JOIN',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'ALTER',
    'DROP',
    'VALUES',
    'SET',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
  ];

  validate(code: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = code.split('\n');
    const upperCode = code.toUpperCase();

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }

      // Check for unmatched quotes
      const singleQuotes = (line.match(/(?<!\\)'/g) || []).length;
      const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length;

      if (singleQuotes % 2 !== 0) {
        errors.push({
          line: lineNum + 1,
          message: 'Odd number of single quotes',
          code: 'QUOTE_MISMATCH',
          severity: 'error',
        });
      }

      if (doubleQuotes % 2 !== 0) {
        errors.push({
          line: lineNum + 1,
          message: 'Odd number of double quotes',
          code: 'QUOTE_MISMATCH',
          severity: 'error',
        });
      }

      // Check INSERT statements
      if (trimmed.toUpperCase().startsWith('INSERT INTO')) {
        if (!upperCode.includes('VALUES')) {
          errors.push({
            line: lineNum + 1,
            message: 'INSERT statement must include VALUES clause',
            code: 'MISSING_VALUES',
            severity: 'error',
          });
        }
      }

      // Check SELECT without FROM (unless it's a constant selection)
      if (
        trimmed.toUpperCase().startsWith('SELECT') &&
        !trimmed.toUpperCase().includes('FROM') &&
        !trimmed.toUpperCase().includes('--')
      ) {
        if (!trimmed.match(/SELECT\s+\d+|SELECT\s+'|SELECT\s+\*/)) {
          // errors.push({
          //   line: lineNum + 1,
          //   message: 'SELECT statement should include FROM clause',
          //   code: 'MISSING_FROM',
          //   severity: 'warning',
          // });
        }
      }
    }

    return errors;
  }
}

// ─────────────────────────────────────────────────────────────
// Main Validator
// ─────────────────────────────────────────────────────────────

const validators = {
  typescript: new TypeScriptValidator(),
  javascript: new TypeScriptValidator(), // Use TS validator for JS too
  python: new PythonValidator(),
  sql: new SQLValidator(),
};

export function validateCode(code: string, language: string): ValidatorReport {
  const validator = validators[language as keyof typeof validators];

  if (!validator) {
    return {
      valid: false,
      language,
      totalLines: code.split('\n').length,
      errors: [
        {
          message: `Unsupported language: ${language}`,
          severity: 'error',
        },
      ],
      warnings: [],
      summary: `Unsupported language: ${language}`,
    };
  }

  const allErrors = validator.validate(code);
  const errors = allErrors.filter((e) => e.severity === 'error');
  const warnings = allErrors.filter((e) => e.severity === 'warning');

  const totalLines = code.split('\n').length;
  const valid = errors.length === 0;

  return {
    valid,
    language,
    totalLines,
    errors,
    warnings,
    summary:
      errors.length === 0
        ? warnings.length > 0
          ? `Valid with ${warnings.length} warning(s)`
          : 'Valid'
        : `${errors.length} error(s), ${warnings.length} warning(s)`,
  };
}

export const syntaxValidator = {
  validate: validateCode,
  validateTypeScript: (code: string) => validators.typescript.validate(code),
  validatePython: (code: string) => validators.python.validate(code),
  validateSQL: (code: string) => validators.sql.validate(code),
};
