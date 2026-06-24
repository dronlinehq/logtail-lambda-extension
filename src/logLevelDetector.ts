// Strip ANSI escape sequences from a string
export const stripAnsiCodes = (text: string): string => {
  // eslint-disable-next-line no-control-regex -- ANSI escape sequences use ESC (0x1b)
  return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
};

export type LogLevel = 'error' | 'warn' | 'info';

const isDbtSummaryLine = (cleanedMessage: string): boolean => /^Done\.\s+PASS=/i.test(cleanedMessage);

// Detect log level from a message
// Check for ERROR first (higher priority), then WARN/WARNING, default to info
export const detectLogLevel = (message: string, preCleaned = false): LogLevel => {
  const cleanedMessage = preCleaned ? message : stripAnsiCodes(message);

  if (isDbtSummaryLine(cleanedMessage)) {
    return 'info';
  }

  // Check for ERROR (case-insensitive)
  if (/\bERROR\b/i.test(cleanedMessage)) {
    return 'error';
  }

  // Check for WARN or WARNING (case-insensitive)
  if (/\b(WARNING|WARN)\b/i.test(cleanedMessage)) {
    return 'warn';
  }

  return 'info';
};
