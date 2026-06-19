const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logsDir = path.resolve(__dirname, '..', '..', 'logs');
fs.mkdirSync(logsDir, { recursive: true });

const formatter = winston.format.printf((info) => {
  const { timestamp, level, message, stack, ...meta } = info;
  const metaText = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${stack || message}${metaText}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    formatter
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
  ],
});

module.exports = logger;
