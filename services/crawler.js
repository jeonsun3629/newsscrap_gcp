const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const logger = require('../utils/logger');
const firecrawl = require('./firecrawl');
const summarizer = require('./summarizer');
const notionService = require('./notion');

/**
 * 지정된 개수의 국가를 랜덤으로 선택합니다.
 * @param {number} count - 선택할 국가 수
 * @returns {string[]} - 선택된 국가 이름 배열
 */
function selectRandomCountries(count) {
  // 전체 국가 목록 가져오기
  const allCountries = Object.keys(config.allNewsSites);
  const selectedCountries = [];
  
  // 선택할 국가 수가 전체 국가 수보다 많으면 모든 국가 반환
  if (count >= allCountries.length) {
    return allCountries;
  }
  
  // Fisher-Yates 셔플 알고리즘으로 랜덤 국가 선택
  const shuffled = [...allCountries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // 필요한 만큼의 국가 반환
  return shuffled.slice(0, count);
}

/**
 * 선택된 국가들의 뉴스 사이트 목록을 생성합니다.
 * @param {string[]} countries - 국가 이름 배열
 * @returns {Array<{country: string, name: string, url: string}>} - 뉴스 사이트 정보 배열
 */
function getNewsSitesForCountries(countries) {
  const newsSites = [];
  
  countries.forEach(country => {
    const sites = config.allNewsSites[country] || [];
    
    sites.forEach(site => {
      newsSites.push({
        country: country,
        name: site.name,
        url: site.url
      });
    });
  });
  
  return newsSites;
}

/**
 * 헤드라인 추출 - FireCrawl API 또는 Cheerio 사용
 * @param {Object} site - 뉴스 사이트 정보
 * @returns {Promise<Array>} - 헤드라인 배열
 */
async function extractHeadlines(site) {
  logger.info(`${site.name}(${site.country}) 헤드라인 추출 시작`);
  
  try {
    // FireCrawl API 사용 시도 (LLM 프롬프팅 방식)
    const result = await firecrawl.scrape({
      url: site.url,
      formats: ['extract'],
      extract: {
        prompt: `이 뉴스 사이트의 메인 페이지에서 오늘의 가장 중요한 뉴스 헤드라인 5개를 찾아줘. 각 헤드라인의 제목과 링크가 필요해. 뉴스 제목은 'title' 필드에, 링크는 'url' 필드에 담아서 결과를 JSON 배열로 반환해줘.`,
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '뉴스 헤드라인 제목' },
              url: { type: 'string', description: '뉴스 기사 URL' }
            },
            required: ['title', 'url']
          }
        }
      }
    });
    
    // FireCrawl 응답에서 헤드라인 추출
    const headlines = result.result?.extract || [];
    
    if (headlines.length > 0) {
      logger.info(`${site.name}에서 ${headlines.length}개 헤드라인 추출 완료 (FireCrawl API 사용)`);
      return headlines.slice(0, config.crawler.headlinesPerSite);
    }
    
    // FireCrawl 실패 시 Cheerio 사용
    return await scrapeHeadlines(site.url);
  } catch (error) {
    logger.error(`FireCrawl API 헤드라인 추출 실패 (${site.name}): ${error.message}`);
    // 실패 시 Cheerio 사용하여 백업 추출
    return await scrapeHeadlines(site.url);
  }
}

/**
 * Cheerio로 특정 URL에서 헤드라인을 추출합니다.
 * @param {string} url - 크롤링할 URL
 * @returns {Promise<Array>} - 헤드라인 배열
 */
async function scrapeHeadlines(url) {
  try {
    const response = await axios.get(url, {
      timeout: config.crawler.timeout,
      headers: {
        'User-Agent': config.crawler.userAgent
      }
    });
    
    const $ = cheerio.load(response.data);
    const headlines = [];
    
    // 헤드라인 선택자는 사이트마다 다를 수 있음
    // 여기서는 일반적인 선택자 사용
    $('h1, h2, h3, article a, .headline a').each((i, el) => {
      if (headlines.length >= config.crawler.headlinesPerSite) return false;
      
      const title = $(el).text().trim();
      let href = $(el).attr('href') || '';
      
      // 상대 경로인 경우 기본 URL과 결합
      if (href && !href.startsWith('http')) {
        const baseUrl = new URL(url);
        href = new URL(href, baseUrl).href;
      }
      
      if (title && href && !headlines.some(h => h.title === title)) {
        headlines.push({
          title: title,
          url: href
        });
      }
    });
    
    logger.info(`Cheerio로 ${headlines.length}개 헤드라인 추출 완료: ${url}`);
    return headlines;
  } catch (error) {
    logger.error(`Cheerio 헤드라인 스크랩 실패: ${url} - ${error.message}`);
    return [];
  }
}

/**
 * 기사 내용 추출 - FireCrawl API 사용
 * @param {Object} headline - 헤드라인 정보
 * @param {Object} site - 뉴스 사이트 정보
 * @returns {Promise<Object>} - 추출된 기사 정보
 */
async function extractArticleContent(headline, site) {
  logger.info(`기사 내용 추출 시작: ${headline.title}`);
  
  try {
    // FireCrawl API로 기사 내용 추출
    const result = await firecrawl.scrape({
      url: headline.url,
      formats: ['extract'],
      extract: {
        prompt: `이 뉴스 기사의 본문 내용만 추출해주세요. 광고나 관련기사 링크, 댓글 섹션은 제외합니다. 기사 본문만 텍스트로 반환해주세요.`,
        schema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '뉴스 기사 본문 내용' }
          },
          required: ['content']
        }
      }
    });
    
    // 추출된 본문 내용
    const content = result.result?.extract?.content || '';
    
    if (!content) {
      logger.warn(`기사 내용을 추출할 수 없음: ${headline.title}`);
      return null;
    }
    
    logger.info(`기사 내용 추출 완료: ${headline.title} (${content.length} 글자)`);
    
    return {
      ...headline,
      site: site.name,
      country: site.country,
      content,
      crawledAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`기사 내용 추출 실패 (${headline.title}): ${error.message}`);
    return null;
  }
}

/**
 * 단일 기사 처리 (내용 추출 -> 요약 -> Notion 저장)
 * @param {Object} headline - 헤드라인 정보 
 * @param {Object} site - 사이트 정보
 * @returns {Promise<Object>} - 처리 결과
 */
async function processArticle(headline, site) {
  try {
    // 1. 기사 내용 추출
    const article = await extractArticleContent(headline, site);
    if (!article) return null;
    
    // 2. GPT-4로 요약
    const summary = await summarizer.summarizeArticle(article);
    if (!summary) return null;
    
    // 3. Notion에 저장
    const notionPage = await notionService.saveToNotion({
      ...article,
      summary
    });
    
    logger.info(`기사 처리 완료: ${headline.title}`);
    return {
      title: headline.title,
      summary,
      notionPageId: notionPage?.id
    };
  } catch (error) {
    logger.error(`기사 처리 실패 (${headline.title}): ${error.message}`);
    return null;
  }
}

/**
 * 뉴스 사이트 크롤링 프로세스를 시작합니다.
 * @returns {Promise<Array>} - 처리 결과
 */
async function startCrawlingProcess() {
  logger.info('뉴스 크롤링 프로세스 시작');
  
  try {
    // 랜덤 국가 선택
    const selectedCountries = selectRandomCountries(config.crawler.randomCountries);
    logger.info(`선택된 국가: ${selectedCountries.join(', ')}`);
    
    // 선택된 국가의 뉴스 사이트 가져오기
    const sites = getNewsSitesForCountries(selectedCountries);
    logger.info(`총 ${sites.length}개의 뉴스 사이트를 처리합니다.`);
    
    const results = [];
    let processed = 0;
    
    // 사이트별 처리
    for (let i = 0; i < sites.length; i += config.crawler.concurrency) {
      const batch = sites.slice(i, i + config.crawler.concurrency);
      const promises = batch.map(async (site) => {
        try {
          logger.info(`사이트 처리 시작: ${site.name} (${site.country})`);
          
          // 1. 사이트에서 헤드라인 추출
          const headlines = await extractHeadlines(site);
          if (headlines.length === 0) {
            logger.warn(`${site.name}에서 헤드라인을 추출하지 못했습니다.`);
            return;
          }
          
          // 2. 각 헤드라인에 대해 기사 처리
          const articlesProcessed = [];
          
          for (const headline of headlines) {
            const result = await processArticle(headline, site);
            if (result) articlesProcessed.push(result);
          }
          
          logger.info(`사이트 처리 완료: ${site.name} (${articlesProcessed.length}/${headlines.length} 기사 처리됨)`);
          results.push(...articlesProcessed);
        } catch (error) {
          logger.error(`사이트 처리 오류 (${site.name}): ${error.message}`);
        } finally {
          processed++;
          logger.info(`진행 상황: ${processed}/${sites.length} 사이트 처리 완료`);
        }
      });
      
      await Promise.all(promises);
    }
    
    logger.info(`크롤링 프로세스 완료: 총 ${results.length}개 기사 처리됨`);
    return results;
  } catch (error) {
    logger.error(`크롤링 프로세스 오류: ${error.message}`);
    throw error;
  }
}

module.exports = {
  startCrawlingProcess,
  selectRandomCountries,
  getNewsSitesForCountries,
  extractHeadlines,
  scrapeHeadlines,
  extractArticleContent
}; 