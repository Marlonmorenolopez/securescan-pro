# SecureScan Pro v3.0 - Architecture

## Overview

SecureScan Pro is a comprehensive web security scanning platform built with a modern microservices architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js 16)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Scanner │  │  History │  │   Lab    │  │   Docs   │        │
│  │   Page   │  │   Page   │  │   Page   │  │   Page   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │               │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐         │
│  │              React Context (State Management)      │         │
│  └────────────────────────┬──────────────────────────┘         │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP/WebSocket
┌───────────────────────────┼─────────────────────────────────────┐
│                    Backend (Python/Flask)                        │
│  ┌────────────────────────┴──────────────────────────┐          │
│  │                   API Gateway                      │          │
│  │         (Rate Limiting, Auth, Validation)          │          │
│  └────────────────────────┬──────────────────────────┘          │
│                           │                                      │
│  ┌────────────────────────┴──────────────────────────┐          │
│  │                   Orchestrator                     │          │
│  └──┬──────┬──────┬──────┬──────┬──────┬────────────┘          │
│     │      │      │      │      │      │                        │
│  ┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐                    │
│  │What ││Nmap ││Gobus││ ZAP ││Expl-││Scor-│                    │
│  │Web  ││     ││ter  ││     ││oitDB││ing  │                    │
│  └─────┘└─────┘└─────┘└─────┘└─────┘└─────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Technology Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5.8
- **Styling**: Tailwind CSS 4.0
- **Components**: shadcn/ui + Radix UI
- **State**: React Context + SWR

### Key Components
1. **ScanForm**: URL input with validation
2. **ScanProgress**: Real-time progress tracking
3. **ResultsDashboard**: Vulnerability visualization
4. **Header**: Navigation and theme toggle

## Backend Architecture

### Technology Stack
- **Runtime**: Python 3.12+
- **Framework**: Flask 3.x with async support
- **Validation**: Pydantic v2
- **Security**: Flask-CORS, Flask-Limiter

### Module Structure
```
server/
├── app.py              # Main application entry
├── modules/
│   ├── orchestrator.py # Scan coordination
│   ├── whatweb.py      # Technology detection
│   ├── nmap_scanner.py # Port scanning
│   ├── gobuster.py     # Directory enumeration
│   ├── zap_scanner.py  # Vulnerability scanning
│   └── exploitdb.py    # Exploit correlation
└── utils/
    ├── scoring.py      # Risk calculation
    └── reporter.py     # Report generation
```

## Data Flow

1. User submits URL via ScanForm
2. Frontend validates and sends to backend API
3. Orchestrator coordinates parallel module execution
4. Results aggregated and scored
5. Frontend receives and displays results
6. Reports generated on demand

## Security Considerations

- Input validation at all layers
- Rate limiting on API endpoints
- CORS properly configured
- No sensitive data in client storage
- Secure headers enforced
