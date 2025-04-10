FROM node:18-buster

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 먼저 복사하여 캐시 효율 높이기
COPY package*.json ./

# 종속성 설치
RUN npm ci --production

# 애플리케이션 코드 복사
COPY . .

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=8080

# 포트 노출
EXPOSE 8080

# 앱 실행
CMD ["node", "app.js"] 