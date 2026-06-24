// Strip ANSI escape sequences from a string
export const stripAnsiCodes = (text: string): string => {
  return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
};

export type LogLevel = 'error' | 'warn' | 'info';

// Detect log level from a message
// Check for ERROR first (higher priority), then WARN, default to info
export const detectLogLevel = (message: string): LogLevel => {
  const cleanedMessage = stripAnsiCodes(message);

  // Check for ERROR (case-insensitive)
  if (/\bERROR\b/i.test(cleanedMessage)) {
    return 'error';
  }

  // Check for WARN (case-insensitive)
  if (/\bWARN\b/i.test(cleanedMessage)) {
    return 'warn';
  }

  return 'info';
};
