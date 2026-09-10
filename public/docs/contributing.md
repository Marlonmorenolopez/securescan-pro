# SecureScan Pro v3.0 - Contributing Guide

## Getting Started

### Development Setup

1. **Fork and clone**
```bash
git clone https://github.com/Marlonmorenolopez/SecureScan.git
cd SecureScan
```

2. **Install dependencies**
```bash
# Frontend
pnpm install

# Backend
cd server
pip install -r requirements.txt
```

3. **Start development servers**
```bash
# Frontend (terminal 1)
pnpm dev

# Backend (terminal 2)
cd server
python app.py
```

## Code Standards

### TypeScript/React
- Use functional components with hooks
- Prefer named exports
- Use TypeScript strict mode
- Follow existing naming conventions

```typescript
// Good
export function ScanResultCard({ result }: ScanResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  return (...)
}

// Avoid
export default class ScanResultCard extends Component { ... }
```

### Python
- Follow PEP 8
- Use type hints
- Document public functions

```python
# Good
def calculate_score(vulnerabilities: list[dict]) -> float:
    """Calculate security score from vulnerabilities.
    
    Args:
        vulnerabilities: List of vulnerability dictionaries
        
    Returns:
        Security score between 0 and 100
    """
    ...
```

## Pull Request Process

1. **Create feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes and commit**
```bash
git add .
git commit -m "feat: add vulnerability severity filter"
```

3. **Push and create PR**
```bash
git push origin feature/your-feature-name
```

### Commit Message Format
```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructure
- test: Tests
- chore: Maintenance
```

## Testing

### Frontend
```bash
# Run tests
pnpm test

# With coverage
pnpm test:coverage
```

### Backend
```bash
cd server
pytest

# With coverage
pytest --cov=modules --cov=utils
```

## Adding New Scan Module

1. Create module file in `server/modules/`
2. Implement required interface:

```python
class NewScanner:
    def __init__(self, config: dict):
        self.config = config
    
    async def scan(self, target: str) -> dict:
        """Execute scan and return results."""
        ...
    
    def parse_output(self, raw: str) -> dict:
        """Parse tool output to standard format."""
        ...
```

3. Register in orchestrator
4. Add frontend UI component
5. Write tests
6. Update documentation

## Code Review Checklist

- [ ] Code follows project style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log or print statements
- [ ] No hardcoded values
- [ ] Error handling implemented
- [ ] Security considerations addressed

## Questions?

- Open an issue for bugs
- Start a discussion for features
- Check existing issues before creating new ones
