const OpenAI = require('openai');
const logger = require('../utils/logger');
const config = require('../config');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * 기사 내용을 요약
 * @param {Object} article - 기사 정보
 * @returns {Promise<string>} - 요약된 내용
 */
async function summarizeArticle(article) {
  logger.info(`기사 요약 시작: ${article.title}`);
  
  try {
    // GPT-4를 이용하여 기사 요약
    const prompt = `${config.summarizer.summaryPrompt}\n\n${article.content}`;
    
    const response = await openai.chat.completions.create({
      model: config.summarizer.model,
      messages: [
        { role: 'system', content: '당신은 뉴스 요약 전문가입니다. 핵심 내용을 2~3줄로 간결하게 요약해주세요.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: config.summarizer.temperature
    });
    
    const summary = response.choices[0]?.message?.content?.trim();
    
    if (!summary) {
      logger.warn(`기사 요약 실패: 응답이 비어있음 (${article.title})`);
      return null;
    }
    
    logger.info(`기사 요약 완료: ${article.title} (${summary.length} 글자)`);
    return summary;
  } catch (error) {
    logger.error(`기사 요약 오류 (${article.title}): ${error.message}`, { error });
    return null;
  }
}

module.exports = {
  summarizeArticle
}; 