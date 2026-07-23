# Phase 5 — Production Grade

## Kubernetes Deployment
- 10 app deployments in `edgesphere` namespace
- Zero-downtime rolling updates (maxUnavailable: 0)
- HPA: gateway (2-20), cdn (2-10), auth (1-5), storage (1-5)
- Ingress: Nginx with TLS, rate limiting, 5GB body size
- Prometheus rules: 5 alert rules (error rate, latency, cache, pod crash, kafka lag)
- Kustomize for environment management

## Terraform
- VPC with 3 public + 3 private subnets across 3 AZs
- EKS 1.28 with SPOT instances (cost savings)
- RDS PostgreSQL 15 with Multi-AZ in prod
- ElastiCache Redis with cluster mode
- S3 for Terraform state with DynamoDB locking
- Separate dev/prod tfvars

## CI/CD (GitHub Actions)
- `ci.yml`: lint → typecheck → test (with real postgres + redis) → docker build (matrix: 9 images) → push to GHCR → deploy to EKS
- `security.yml`: weekly Trivy scan + pnpm audit
- `release.yml`: semantic release on git tag
- Build cache: GitHub Actions cache for Docker layers (fast rebuilds)

## Load Testing (k6)
- 5 test scenarios: smoke, auth, CDN, storage, full platform
- Full platform: 1000 req/sec sustained for 5 minutes
- Targets: P95 <200ms API, P95 <50ms CDN cached, >80% cache hit, <1% error rate

## Performance Baselines
| Metric | Target | Notes |
|--------|--------|-------|
| CDN Cached P95 | <50ms | Redis L1 HIT |
| API Gateway P95 | <200ms | JWT verify + upstream |
| Full Platform RPS | >1000 | With 200 VUs |
| Cache Hit Ratio | >80% | After warmup |
