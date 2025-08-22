# ================================================
# DEPLOY PARA GOOGLE CLOUD RUN
# Serverless, escalável e econômico
# ================================================

# Configurar o projeto GCP
gcloud config set project YOUR_PROJECT_ID
gcloud config set compute/region us-central1

# ================================================
# 1. PREPARAR IMAGEM DOCKER
# ================================================

# Fazer build da imagem
docker build -t gcr.io/YOUR_PROJECT_ID/whatsapp-bot:latest .

# Fazer push para Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/whatsapp-bot:latest

# ================================================
# 2. CONFIGURAR CLOUD SQL (POSTGRESQL)
# ================================================

# Criar instância Cloud SQL
gcloud sql instances create whatsapp-postgres \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=03:00

# Criar banco de dados
gcloud sql databases create whatsapp_campaigns \
    --instance=whatsapp-postgres

# Criar usuário
gcloud sql users create postgres \
    --instance=whatsapp-postgres \
    --password=YOUR_SECURE_PASSWORD

# ================================================
# 3. CONFIGURAR MEMORYSTORE (REDIS)
# ================================================

# Criar instância Redis
gcloud redis instances create whatsapp-redis \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_7_0

# ================================================
# 4. DEPLOY CLOUD RUN
# ================================================

# Deploy da aplicação
gcloud run deploy whatsapp-bot \
    --image gcr.io/YOUR_PROJECT_ID/whatsapp-bot:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production \
    --set-env-vars DB_HOST=CLOUD_SQL_IP \
    --set-env-vars DB_USER=postgres \
    --set-env-vars DB_PASSWORD=YOUR_SECURE_PASSWORD \
    --set-env-vars DB_NAME=whatsapp_campaigns \
    --set-env-vars REDIS_HOST=REDIS_IP \
    --set-env-vars PORT=3006 \
    --memory 1Gi \
    --cpu 1 \
    --concurrency 80 \
    --timeout 900

# ================================================
# 5. CONFIGURAR DOMÍNIO CUSTOMIZADO
# ================================================

# Mapear domínio customizado
gcloud run domain-mappings create \
    --service whatsapp-bot \
    --domain your-domain.com \
    --region us-central1

# ================================================
# VANTAGENS DO GOOGLE CLOUD RUN:
# ================================================
# ✅ Pay-per-use (só paga quando há requisições)
# ✅ Auto-scaling (0 a 1000+ instâncias automático)
# ✅ SSL gratuito
# ✅ Deploy em segundos
# ✅ Integração nativa com outros serviços Google
# ✅ 2 milhões de requisições grátis por mês

# ================================================
# ESTIMATIVA DE CUSTOS (MENSAL):
# ================================================
# Cloud Run: $0-50 (depende do uso)
# Cloud SQL: $7-25 (db-f1-micro)
# Memorystore: $25-50 (1GB Redis)
# TOTAL: $32-125/mês
