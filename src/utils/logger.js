function formatTimestamp() {
  return new Date().toISOString();
}

function writeLog(stream, level, message, meta) {
  const prefix = `[${formatTimestamp()}] [${level}]`;
  if (meta !== undefined) {
    const serialized = meta instanceof Error ? (meta.stack || meta.message) : JSON.stringify(meta);
    stream.write(`${prefix} ${message} ${serialized}\n`);
    return;
  }
  stream.write(`${prefix} ${message}\n`);
}

export const logger = {
  info(message, meta) {
    writeLog(process.stdout, 'INFO', message, meta);
  },
  warn(message, meta) {
    writeLog(process.stderr, 'WARN', message, meta);
  },
  error(message, meta) {
    writeLog(process.stderr, 'ERROR', message, meta);
  },
};
