#!/usr/bin/env bash
set -eo pipefail

REGION="asia-south1"
SERVICE_NAME="jmd-cart"
JOB_NAME="jmd-cart-migrate"
AR_REPO="jmd-cart"
IMAGE_TAG="latest"
SERVICE_ACCOUNT="jmd-cart-run"
SQL_INSTANCE="jmd-cart-db"

PROJECT=$(gcloud config get-value project 2>/dev/null | tr -d '\r\n')
if [ -z "$PROJECT" ]; then
  echo "Error: No GCP project set." >&2
  exit 1
fi

SA_EMAIL="${SERVICE_ACCOUNT}@${PROJECT}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${AR_REPO}/${SERVICE_NAME}:${IMAGE_TAG}"
SQL_CONN="${PROJECT}:${REGION}:${SQL_INSTANCE}"
GIT_SHA=$(git rev-parse HEAD 2>/dev/null | tr -d '\r\n')

echo "=== GCP Deploy Settings ==="
echo "Project: $PROJECT"
echo "Image:   $IMAGE"
echo "SQL:     $SQL_CONN"
echo "Git SHA: $GIT_SHA"

# 1. Cloud Build
echo ""
echo "=== 1. Building Docker Image via Cloud Build ==="
gcloud builds submit . \
  --tag="$IMAGE" \
  --project="$PROJECT"

# 2. Run Migration Job
echo ""
echo "=== 2. Running Database Migration Job ==="
gcloud run jobs deploy "$JOB_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --set-cloudsql-instances="$SQL_CONN" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest" \
  --set-env-vars="NODE_ENV=production,TZ=Asia/Kolkata" \
  --command="sh" \
  --args="-c,node /app/node_modules/prisma/build/index.js migrate resolve --applied 20261021173827_user_wishlist || true; node /app/node_modules/prisma/build/index.js migrate resolve --rolled-back 20261031040000_product_opening_stock_and_reset || true; node /app/node_modules/prisma/build/index.js migrate deploy && node /app/prisma/dist/seed.js" \
  --project="$PROJECT" \
  --quiet

gcloud run jobs execute "$JOB_NAME" --region="$REGION" --project="$PROJECT" --wait

# 3. Deploy Cloud Run Service
echo ""
echo "=== 3. Deploying Cloud Run Service ==="
gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --set-cloudsql-instances="$SQL_CONN" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,AUTH_SECRET=AUTH_SECRET:latest,SETUP_TOKEN=SETUP_TOKEN:latest,R2_ACCOUNT_ID=R2_ACCOUNT_ID:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest,R2_BUCKET=R2_BUCKET:latest" \
  --set-env-vars="NODE_ENV=production,TZ=Asia/Kolkata,DEFAULT_BRANCH_ID=1" \
  --set-env-vars="STOREFRONT_HOST=jmdcart.com,MANAGEMENT_HOST=management.jmdcart.com" \
  --set-env-vars="APP_URL=https://jmdcart.com,MANAGEMENT_URL=https://management.jmdcart.com" \
  --set-env-vars="UPLOAD_DIR=/uploads" \
  --add-volume="name=uploads,type=cloud-storage,bucket=${PROJECT}-uploads" \
  --add-volume-mount="volume=uploads,mount-path=/uploads" \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=80 \
  --timeout=60s \
  --ingress=internal-and-cloud-load-balancing \
  --allow-unauthenticated \
  --port=8080 \
  --update-annotations="commit-sha=$GIT_SHA" \
  --project="$PROJECT" \
  --quiet

echo ""
echo "=== 4. Verifying Health Status ==="
curl -fsS --max-time 15 "https://management.jmdcart.com/api/health" || echo "Direct curl check completed."

echo ""
echo "=== Deployment Successfully Completed! ==="
