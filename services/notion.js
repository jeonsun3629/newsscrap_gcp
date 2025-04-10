const { Client } = require('@notionhq/client');
const logger = require('../utils/logger');
const config = require('../config');

// Notion 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

/**
 * 기사 정보를 Notion 데이터베이스에 저장
 * @param {Object} article - 저장할 기사 정보
 * @returns {Promise<Object>} - 생성된 Notion 페이지 정보
 */
async function saveToNotion(article) {
  logger.info(`Notion에 저장 시작: ${article.title}`);
  
  try {
    // 현재 날짜 생성
    const today = new Date().toISOString().split('T')[0];
    
    // Notion 페이지 생성 요청
    const response = await notion.pages.create({
      parent: { database_id: config.notion.databaseId },
      properties: {
        // 제목 속성
        "Title": {
          title: [{ text: { content: article.title } }]
        },
        // 요약 속성
        "Summary": {
          rich_text: [{ text: { content: article.summary } }]
        },
        // 국가 속성 (select 유형)
        "Country": {
          select: { name: article.country }
        },
        // 출처 속성
        "Source": {
          rich_text: [{ text: { content: article.site } }]
        },
        // 날짜 속성
        "Date": {
          date: { start: today }
        },
        // URL 속성
        "URL": {
          url: article.url
        }
      }
    });
    
    logger.info(`Notion에 저장 완료: ${article.title} (페이지 ID: ${response.id})`);
    return response;
  } catch (error) {
    logger.error(`Notion 저장 오류 (${article.title}): ${error.message}`, { error });
    return null;
  }
}

module.exports = {
  saveToNotion
}; 