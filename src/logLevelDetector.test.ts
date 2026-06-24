import { stripAnsiCodes, detectLogLevel } from '~/logLevelDetector';

describe('stripAnsiCodes', () => {
  test('should remove ANSI escape sequences', () => {
    const input = '\x1B[31mERROR\x1B[0m creating sql view model';
    const output = stripAnsiCodes(input);
    expect(output).toBe('ERROR creating sql view model');
  });

  test('should handle multiple ANSI codes', () => {
    const input = '\x1B[1m\x1B[31mERROR\x1B[0m \x1B[33mWARNING\x1B[0m';
    const output = stripAnsiCodes(input);
    expect(output).toBe('ERROR WARNING');
  });

  test('should return unchanged text if no ANSI codes', () => {
    const input = 'Plain text message';
    const output = stripAnsiCodes(input);
    expect(output).toBe('Plain text message');
  });

  test('should handle common ANSI sequences', () => {
    const input = 'Normal \x1B[1mBold\x1B[0m \x1B[4mUnderline\x1B[0m text';
    const output = stripAnsiCodes(input);
    expect(output).toBe('Normal Bold Underline text');
  });
});

describe('detectLogLevel', () => {
  test('should detect ERROR level (case-insensitive)', () => {
    expect(detectLogLevel('ERROR: something failed')).toBe('error');
    expect(detectLogLevel('error: something failed')).toBe('error');
    expect(detectLogLevel('Error: something failed')).toBe('error');
  });

  test('should detect ERROR with ANSI codes', () => {
    expect(detectLogLevel('\x1B[31mERROR\x1B[0m creating sql view model')).toBe('error');
  });

  test('should detect WARN level (case-insensitive)', () => {
    expect(detectLogLevel('WARN: this is a warning')).toBe('warn');
    expect(detectLogLevel('warn: this is a warning')).toBe('warn');
    expect(detectLogLevel('Warn: this is a warning')).toBe('warn');
  });

  test('should detect WARNING level from dbt-style logs', () => {
    expect(detectLogLevel('Warning in test my_model')).toBe('warn');
    expect(detectLogLevel('1 of 5 WARNING table missing')).toBe('warn');
  });

  test('should prioritize ERROR over WARN', () => {
    expect(detectLogLevel('ERROR in WARN section')).toBe('error');
  });

  test('should treat dbt summary lines as info', () => {
    expect(detectLogLevel('Done. PASS=3 WARN=0 ERROR=16')).toBe('info');
  });

  test('should default to info for other messages', () => {
    expect(detectLogLevel('Starting task')).toBe('info');
    expect(detectLogLevel('Process completed successfully')).toBe('info');
  });

  test('should match ERROR/WARN as word boundaries', () => {
    // Should not match ERROR/WARN that are part of other words
    expect(detectLogLevel('MOREOVER starting task')).toBe('info');
    expect(detectLogLevel('WARNING_SYSTEM running')).toBe('info');
  });

  test('should handle mixed case with special characters', () => {
    expect(detectLogLevel('[ERROR] Model failed')).toBe('error');
    expect(detectLogLevel('2023-01-01 WARN: issue detected')).toBe('warn');
  });
});
