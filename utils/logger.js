const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

// 로그 포맷 정의
const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let meta = '';
  if (Object.keys(metadata).length > 0) {
    meta = JSON.stringify(metadata);
  }
  
  return `${timestamp} [${level}]: ${message} ${meta}`;
});

// 로거 생성
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // 콘솔 출력
    new transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    }),
    // GCP Cloud Run에서는 콘솔 로그가 Cloud Logging으로 자동 전송됨
  ],
});

module.exports = logger; 