const axios = require('axios');
const logger = require('../utils/logger');

/**
 * FireCrawl API로 웹 페이지 스크래핑 요청
 * @param {Object} options - 스크래핑 옵션
 * @returns {Promise<Object>} 스크래핑 결과
 */
async function scrape(options) {
  try {
    logger.info(`FireCrawl API 스크래핑 시작: ${options.url}`);
    
    // FireCrawl API 직접 호출
    const response = await axios.post('https://api.firecrawl.dev/scrape', options, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      timeout: 60000 // 60초 타임아웃 설정
    });
    
    logger.info(`FireCrawl API 스크래핑 완료: ${options.url}`);
    return response.data;
  } catch (error) {
    // 오류 응답 정보 기록
    if (error.response) {
      // 서버에서 응답이 왔지만 오류 상태 코드
      logger.error(`FireCrawl API 오류 응답: ${error.response.status}`, {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // 요청이 이루어졌으나 응답이 없음
      logger.error('FireCrawl API 응답 없음', { request: error.request });
    } else {
      // 요청 설정 중 오류 발생
      logger.error(`FireCrawl API 요청 오류: ${error.message}`);
    }
    
    // 대체 방법: 지정된 웹사이트에서 직접 크롤링 시도
    logger.info(`대체 방법으로 직접 크롤링 시도: ${options.url}`);
    
    try {
      const cheerio = require('cheerio');
      
      // 웹페이지 가져오기
      const pageResponse = await axios.get(options.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        },
        timeout: 30000
      });
      
      // HTML 파싱
      const $ = cheerio.load(pageResponse.data);
      
      // 결과 객체
      let result = {};
      
      // 요청에 formats가 있고 extract가 포함되어 있는 경우
      if (options.formats && options.formats.includes('extract')) {
        // 헤드라인과 링크 추출하는 경우
        if (options.extract?.prompt?.includes('헤드라인')) {
          // 뉴스 사이트별 헤드라인 추출 로직
          let headlines = [];
          const baseUrl = new URL(options.url).origin;
          
          // 사이트별 선택자 로직
          if (options.url.includes('chosun.com')) {
            $('h2.news_title a, .center-card h2 a, .news_list_item a').each(function(i) {
              if (i < 5) {
                const title = $(this).text().trim();
                let url = $(this).attr('href');
                
                // URL이 상대경로인 경우 절대경로로 변환
                if (url && !url.startsWith('http')) {
                  url = url.startsWith('/') ? baseUrl + url : baseUrl + '/' + url;
                }
                
                // 유효한 제목과 URL이 있는 경우만 추가
                if (title && url) {
                  headlines.push({ title, url });
                }
              }
            });
          } else {
            // 기본 선택자 - 일반적인 뉴스 사이트 패턴
            $('h1 a, h2 a, h3 a, .headline a, .title a, .card a').each(function(i) {
              if (i < 5 && headlines.length < 5) {
                const title = $(this).text().trim();
                let url = $(this).attr('href');
                
                if (url && !url.startsWith('http')) {
                  url = url.startsWith('/') ? baseUrl + url : baseUrl + '/' + url;
                }
                
                // 중복 방지
                if (title && url && !headlines.some(h => h.title === title)) {
                  headlines.push({ title, url });
                }
              }
            });
          }
          
          result.result = { extract: headlines };
          logger.info(`대체 방법으로 ${headlines.length}개 헤드라인 추출 완료: ${options.url}`);
        } 
        // 기사 본문 추출하는 경우
        else if (options.extract?.prompt?.includes('본문')) {
          let content = '';
          
          // 사이트별 본문 추출 로직
          if (options.url.includes('chosun.com')) {
            content = $('.article, #news_body_id').text().trim();
          } else {
            // 일반적인 뉴스 사이트 패턴
            content = $('article, .article, .article-content, .story-content, .news-content, .entry-content, .post-content').text().trim();
          }
          
          result.result = { extract: { content } };
          logger.info(`대체 방법으로 기사 본문 추출 완료 (${content.length} 글자): ${options.url}`);
        }
      }
      
      return result;
    } catch (fallbackError) {
      logger.error(`대체 크롤링 방법도 실패: ${fallbackError.message}`);
      throw error; // 원래 오류를 다시 던짐
    }
  }
}

// 불필요한 함수들 - 인터페이스 유지를 위해 빈 함수 제공
async function startMcpServer() {
  logger.info('FireCrawl API 직접 호출 방식 사용 - 서버 시작 필요 없음');
  return;
}

async function stopMcpServer() {
  logger.info('FireCrawl API 직접 호출 방식 사용 - 서버 종료 필요 없음');
  return;
}

module.exports = {
  scrape,
  startMcpServer,
  stopMcpServer
}; 