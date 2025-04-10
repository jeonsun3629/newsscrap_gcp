# 프로젝트 설정 (YOUR_PROJECT_ID를 실제 프로젝트 ID로 변경)
gcloud config set project newsscrap-456408

# 필요한 API 활성화
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

# 현재 디렉토리에서 Cloud Run으로 배포
gcloud run deploy news-crawler \
  --image gcr.io/newsscrap-456408/news-crawler:latest \
  --platform managed \
  --region asia-northeast3 \
  --env-vars-file .env.yaml \
  --allow-unauthenticated \
  --timeout=300s


gcloud run services describe news-crawler --region asia-northeast3 --format="value(status.url)"

# 서비스 계정 생성
gcloud iam service-accounts create news-crawler-invoker \
  --display-name "News Crawler Invoker"

# 서비스 계정에 Cloud Run 호출 권한 부여
gcloud run services add-iam-policy-binding news-crawler \
  --member=serviceAccount:news-crawler-invoker@newsscrap-456408.iam.gserviceaccount.com \
  --role=roles/run.invoker \
  --region=asia-northeast3

# Cloud Scheduler 작업 생성 (매일 오전 7시 실행)
gcloud scheduler jobs create http daily-news-crawl \
  --schedule="0 7 * * *" \
  --uri="YOUR_CLOUD_RUN_URL" \
  --http-method=GET \
  --oidc-service-account-email=news-crawler-invoker@newsscrap-456408.iam.gserviceaccount.com \
  --oidc-token-audience="YOUR_CLOUD_RUN_URL"

# Scheduler 작업 확인
gcloud scheduler jobs describe daily-news-crawl

# 수동으로 작업 실행 테스트
gcloud scheduler jobs run daily-news-crawl

# 로그 확인
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=news-crawler" --limit 20