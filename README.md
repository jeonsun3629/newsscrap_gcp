# 뉴스 크롤링 요약 자동화 파이프라인

이 프로젝트는 다양한 국가의 뉴스 사이트에서 헤드라인과 기사 내용을 크롤링하고, OpenAI GPT-4를 활용하여 요약한 뒤, Notion 데이터베이스에 저장하는 자동화 파이프라인입니다. Google Cloud Platform(GCP)에 배포하여 매일 정해진 시간에 자동으로 실행되도록 설계되었습니다.

## 기술 스택

- **동적 웹 크롤링**: Playwright MCP 서버 (Node.js)
- **텍스트 요약**: OpenAI GPT-4 API
- **데이터 저장**: Notion API
- **배포 환경**: Google Cloud Platform (Cloud Run, Cloud Scheduler)

## 주요 기능

1. **헤드라인 크롤링**: 5개국 × 2개 뉴스 사이트(총 10개 사이트)의 상위 5개 헤드라인 추출
2. **기사 내용 수집**: 각 헤드라인 링크를 통해 기사 본문 수집
3. **요약 생성**: GPT-4 API를 사용하여 각 기사를 2~3줄로 요약
4. **Notion에 저장**: 요약 결과를 Notion 데이터베이스에 저장
5. **자동 실행**: GCP Cloud Run과 Cloud Scheduler를 통해 매일 정해진 시간에 실행

## 시작하기

### 필수 요구사항

- Node.js 18 이상
- OpenAI API 키
- Notion Integration 토큰 및 데이터베이스 ID
- (선택) Docker
- (배포용) GCP 계정

### 로컬 개발 환경 설정

1. 저장소 클론
```
git clone https://github.com/yourusername/news-crawler.git
cd news-crawler
```

2. 의존성 설치
```
npm install
```

3. `.env` 파일 생성 (`.env.example` 참고)
```
cp .env.example .env
```
`.env` 파일을 편집하여 필요한 API 키와 토큰을 입력합니다.

4. 애플리케이션 실행
```
npm start
```

### Docker로 실행

1. Docker 이미지 빌드
```
docker build -t news-crawler .
```

2. Docker 컨테이너 실행
```
docker run -p 8080:8080 --env-file .env news-crawler
```

## GCP 배포 가이드

### Cloud Run 배포

1. GCP 프로젝트 설정
2. Docker 이미지 빌드 및 GCP Container Registry에 푸시
```
docker build -t gcr.io/[PROJECT-ID]/news-crawler .
docker push gcr.io/[PROJECT-ID]/news-crawler
```

3. Cloud Run 서비스 배포
```
gcloud run deploy news-crawler \
  --image gcr.io/[PROJECT-ID]/news-crawler \
  --platform managed \
  --region [REGION] \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=[YOUR-API-KEY],NOTION_TOKEN=[YOUR-TOKEN],NOTION_DATABASE_ID=[YOUR-DB-ID]"
```

### Cloud Scheduler 설정

1. Cloud Scheduler 작업 생성
```
gcloud scheduler jobs create http daily-news-crawling \
  --schedule="0 7 * * *" \
  --uri="[CLOUD-RUN-SERVICE-URL]" \
  --http-method=GET \
  --time-zone="Asia/Seoul"
```

## 프로젝트 구조

```
news-crawler/
├── app.js                 # 애플리케이션 진입점
├── config.js              # 설정 파일
├── Dockerfile             # Docker 이미지 정의
├── package.json           # 프로젝트 메타데이터 및 의존성
├── services/              # 핵심 서비스
│   ├── crawler.js         # 크롤링 관련 기능
│   ├── summarizer.js      # GPT-4 요약 관련 기능
│   └── notion.js          # Notion API 연동 기능
└── utils/                 # 유틸리티
    └── logger.js          # 로깅 유틸리티
```

## 라이센스

ISC 

// FireCrawl MCP 서버를 활용하여 프롬프트 기반으로 뉴스 추출
const result = await firecrawl.scrape({
  url: site.url,
  prompt: "이 페이지에서 가장 중요한 5개 뉴스 헤드라인과 링크를 찾아서 반환해주세요."
});

// 기사 내용도 프롬프트로 추출
const article = await firecrawl.scrape({
  url: headline.url,
  prompt: "이 뉴스 기사의 본문 내용만 추출해주세요. 광고나 관련기사 링크는 제외합니다."
}); 