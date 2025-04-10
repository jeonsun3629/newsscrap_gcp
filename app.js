require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const crawler = require('./services/crawler');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 8080;

// 헬스 체크용 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 메인 크롤링 엔드포인트 - GCP Cloud Scheduler에서 호출됨
app.get('/', async (req, res) => {
  logger.info('뉴스 크롤링 요약 작업 시작');
  
  try {
    // 크롤링 및 요약 프로세스 시작
    const results = await crawler.startCrawlingProcess();
    
    res.status(200).send({
      status: 'success',
      message: '뉴스 크롤링 및 요약 작업이 완료되었습니다.',
      processed: results.length
    });
    
    logger.info(`뉴스 크롤링 요약 작업 완료: ${results.length}개 기사 처리됨`);
  } catch (error) {
    logger.error(`크롤링 처리 중 오류 발생: ${error.message}`, { error });
    
    res.status(500).send({
      status: 'error',
      message: '뉴스 크롤링 및 요약 작업 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  logger.info(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  logger.info(`환경: ${process.env.NODE_ENV || 'production'}`);
  logger.info(`매일 ${config.crawler.randomCountries}개 국가의 뉴스 사이트를 크롤링합니다.`);
});

// 정상적인 종료 처리
process.on('SIGTERM', () => {
  logger.info('SIGTERM 신호 수신, 서버 종료 중...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT 신호 수신, 서버 종료 중...');
  process.exit(0);
});