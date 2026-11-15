# AgriGlobal Marketplace - Production Deployment & Operations Guide

## 1. System Architecture Overview

AgriGlobal Marketplace is an enterprise AI-powered agricultural aggregation and international export facilitation platform. The production deployment consists of four core services running behind a hardened reverse proxy with TLS/SSL:

```
[ International Buyers & Farmers (HTTPS:443) ]
                     │
                     ▼
       ┌───────────────────────────┐
       │     Nginx Reverse Proxy   │ (SSL Termination, Rate Limiting, SPA Routing)
       └──────┬─────────────┬──────┘
              │             │
              ▼             ▼
      ┌──────────────┐ ┌──────────────┐
      │ Frontend SPA │ │ Backend API  │ (Express + Node.js :5000)
      │  (Static)    │ └──────┬───────┘
      └──────────────┘        │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ MongoDB 7.0  │ │  AI Service  │ │ Razorpay API │
     │  (Port 27017)│ │(FastAPI :8000│ │ (Webhooks)   │
     └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 2. Server Prerequisites & Recommended Sizing

| Component | Minimum | Recommended Production |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022 | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB or 16 GB |
| **Storage** | 30 GB SSD | 100 GB NVMe SSD |
| **Docker Engine** | v24.0+ | Docker Engine 26.0+ & Compose v2.27+ |
| **Node.js** | v20.x LTS | v20.x LTS |
| **Python** | v3.11+ | v3.11+ with scikit-learn 1.5.2 |
| **MongoDB** | 7.0 Community / Atlas | MongoDB 7.0 Enterprise or Atlas Cluster |

---

## 3. Production Deployment with Docker Compose (Recommended)

### Step 1: Clone and Configure Environment
```bash
git clone <repository_url> agriglobal
cd agriglobal

# Copy production environment template
cp .env.production.example .env.production

# Generate secure cryptographic JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env.production

# Edit domain, origins, and payment keys
nano .env.production
```

### Step 2: Build and Launch Services
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 3: Verify Container Health
```bash
docker compose -f docker-compose.prod.yml ps
```
All containers (`agriglobal-mongo`, `agriglobal-ai`, `agriglobal-backend`, `agriglobal-frontend`) must report status `healthy` or `running`.

### Step 4: Verify Health Probes
```bash
# Backend API Health Probe
curl -f http://localhost:5000/api/health

# AI Service Health Probe
curl -f http://localhost:8000/health

# Frontend HTTP Status
curl -I http://localhost/
```

---

## 4. Standalone Host Deployment (PM2 & Systemd)

If deploying directly onto a virtual machine (without Docker containers):

### 1. Database Setup
Ensure MongoDB 7.0 service is running:
```bash
sudo systemctl enable --now mongod
mongosh --eval "db.adminCommand('ping')"
```

### 2. AI Service Setup
```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start via PM2
pm2 start "python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000" --name "agriglobal-ai"
```

### 3. Backend Setup
```bash
cd ../backend
npm ci --only=production
cp ../.env.production.example .env
# Edit .env with production credentials

# Start via PM2
pm2 start src/server.js --name "agriglobal-backend"
pm2 save
pm2 startup
```

### 4. Frontend Build
```bash
cd ../frontend
npm ci
npm run build
# The compiled static files will be located in frontend/dist/
```

---

## 5. Host Nginx & SSL/TLS Configuration with Let's Encrypt

Create `/etc/nginx/sites-available/agriglobal`:

```nginx
server {
    listen 80;
    server_name agriglobal.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name agriglobal.example.com;

    ssl_certificate /etc/letsencrypt/live/agriglobal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/agriglobal.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Static Frontend SPA
    root /var/www/agriglobal/frontend/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 10M;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site and provision SSL certificates with Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/agriglobal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d agriglobal.example.com
```

---

## 6. Automated Backup & Disaster Recovery

### Scheduling Daily Backups via Cron (Linux)
Add to `/etc/crontab` or `crontab -e`:
```bash
# Run backup daily at 02:00 AM UTC and retain last 14 days
0 2 * * * /var/www/agriglobal/scripts/backup-db.sh >> /var/log/agriglobal_backup.log 2>&1
```

### Scheduling Backups on Windows Server
Use Windows Task Scheduler to run:
```powershell
powershell.exe -ExecutionPolicy Bypass -File "C:\agriglobal\scripts\backup-db.ps1"
```

### Performing Disaster Recovery / Restoration
```bash
# Linux
./scripts/restore-db.sh logs/mongo-backup/agri_marketplace_backup_YYYYMMDD_HHMMSS.gz

# Windows PowerShell
.\scripts\restore-db.ps1 -ArchiveFile "logs\mongo-backup\agri_marketplace_backup_YYYYMMDD_HHMMSS.gz"
```

---

## 7. Security Hardening Checklist

- [x] **Strict Transport Security**: Enforce HTTPS with HSTS headers.
- [x] **Rate Limiting**: Auth endpoints throttled to 300 req / 15 min; payments throttled to 600 req / 15 min.
- [x] **NoSQL Injection Protection**: Recursive sanitize middleware strips operator keys (`$`) and dotted keys.
- [x] **Cryptographic Webhooks**: HMAC SHA256 signature verification on Razorpay events.
- [x] **Granular RBAC**: Independent user portals with server-side role validation (`farmer`, `buyer`, `admin`).
- [x] **Audit Trail**: Administrative actions logged in `AuditLog` collection with timestamp, IP, and actor metadata.
- [x] **Safe Secrets Management**: Public endpoints never leak private keys, webhook secrets, or salt hashes.
