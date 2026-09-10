# SecureScan Pro v3.0 - Deployment Guide

## Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 20+ (for frontend development)
- Python 3.12+ (for backend development)

## Quick Start with Docker

### 1. Clone Repository
```bash
git clone https://github.com/Marlonmorenolopez/SecureScan.git
cd SecureScan
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 3. Start Services
```bash
docker-compose up -d
```

### 4. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/docs

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=SecureScan Pro
```

### Backend (.env)
```bash
# Server
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
PORT=5000

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Tool Configuration
WHATWEB_PATH=/usr/bin/whatweb
NMAP_PATH=/usr/bin/nmap
GOBUSTER_PATH=/usr/bin/gobuster
ZAP_API_URL=http://zap:8080

# Optional: ZAP API Key
ZAP_API_KEY=

# Logging
LOG_LEVEL=INFO
```

## Production Deployment

### Vercel (Frontend)

1. Connect GitHub repository
2. Configure environment variables
3. Deploy

```bash
# Or use Vercel CLI
vercel --prod
```

### Docker Swarm (Backend)

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml securescan
```

### Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: securescan-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: securescan-backend
  template:
    metadata:
      labels:
        app: securescan-backend
    spec:
      containers:
      - name: backend
        image: securescan/backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: securescan-secrets
              key: secret-key
```

## Scaling Considerations

### Horizontal Scaling
- Frontend: Stateless, scale freely
- Backend: Use Redis for session/state sharing
- Scans: Queue-based processing recommended

### Resource Requirements

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| Frontend | 0.5 | 512MB | 1GB |
| Backend | 2 | 2GB | 5GB |
| ZAP | 2 | 4GB | 10GB |

## Monitoring

### Health Checks
```bash
# Frontend
curl http://localhost:3000/api/health

# Backend
curl http://localhost:5000/health
```

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

## Troubleshooting

### Common Issues

**Port conflicts**
```bash
# Check ports
lsof -i :3000
lsof -i :5000
```

**Container not starting**
```bash
# Check logs
docker-compose logs backend

# Rebuild
docker-compose build --no-cache
```

**Tool not found**
```bash
# Enter container
docker-compose exec backend bash

# Verify tool paths
which nmap whatweb gobuster
```
