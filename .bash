#!/bin/bash
set -e

##############################
# 1. 프로젝트 설정 및 API 활성화
##############################
PROJECT_ID="newsscrap-456408"
gcloud config set project ${PROJECT_ID}
echo "프로젝트 ${PROJECT_ID} 설정 완료"

gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
echo "필요 API 활성화 완료"

##############################
# 2. Cloud Run에 애플리케이션 배포 (Secrets 업데이트 포함)
##############################
gcloud run deploy news-crawler \
  --image gcr.io/${PROJECT_ID}/news-crawler:latest \
  --platform managed \
  --region asia-northeast3 \
  --update-secrets=OPENAI_API_KEY=projects/${PROJECT_ID}/secrets/OPENAI_API_KEY:latest,NOTION_TOKEN=projects/${PROJECT_ID}/secrets/NOTION_TOKEN:latest,FIRECRAWL_API_KEY=projects/${PROJECT_ID}/secrets/FIRECRAWL_API_KEY:latest \
  --allow-unauthenticated \
  --timeout=300s

# 배포 완료 후 Cloud Run URL 확인 (출력된 URL을 복사)
CLOUD_RUN_URL=$(gcloud run services describe news-crawler --region asia-northeast3 --format="value(status.url)")
echo "Cloud Run 서비스 URL: ${CLOUD_RUN_URL}"

##############################
# 3. Cloud Run 서비스에 Invoker 권한 부여 (지정된 서비스 계정 사용)
##############################
SERVICE_ACCOUNT="753507636298-compute@developer.gserviceaccount.com"
gcloud run services add-iam-policy-binding news-crawler \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role=roles/run.invoker \
  --region asia-northeast3
echo "Cloud Run Invoker 권한 부여 완료"

##############################
# 4. Secret Manager에서 각 Secret에 대해 Secret Accessor 권한 부여
##############################
gcloud secrets add-iam-policy-binding OPENAI_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding NOTION_TOKEN \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding FIRECRAWL_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

echo "Secret Manager 권한 부여 완료"

##############################
# 5. Cloud Scheduler 작업 생성 (매일 오전 8시 실행)
##############################
gcloud scheduler jobs create http daily-news-crawl \
  --schedule="0 8 * * *" \
  --uri="${CLOUD_RUN_URL}" \
  --http-method=GET \
  --oidc-service-account-email="${SERVICE_ACCOUNT}" \
  --oidc-token-audience="${CLOUD_RUN_URL}"
echo "Cloud Scheduler 작업 생성 완료"

gcloud scheduler jobs describe daily-news-crawl

##############################
# 6. (선택 사항) 수동 실행 테스트 및 로그 확인
##############################
gcloud scheduler jobs run daily-news-crawl

echo "배포 및 스케줄링 작업 완료. Cloud Run 로그를 확인하세요:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=news-crawler" --limit 20
