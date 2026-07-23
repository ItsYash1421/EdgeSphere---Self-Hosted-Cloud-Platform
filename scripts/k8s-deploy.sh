#!/bin/bash
# EdgeSphere — Deploy to Kubernetes (Phase 5)
# Usage: bash scripts/k8s-deploy.sh [dev|prod] [--dry-run]

set -e
ENV=${1:-dev}
DRY_RUN=${2:-}
NS="edgesphere"
K8S_DIR="k8s"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EdgeSphere Kubernetes Deployer       ║${NC}"
echo -e "${BLUE}║  Environment: ${YELLOW}${ENV}${BLUE}                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# ─── Preflight checks ──────────────────────────────────────────────────────
info "Running preflight checks..."

command -v kubectl > /dev/null 2>&1 || fail "kubectl not found — install kubectl first"
kubectl cluster-info > /dev/null 2>&1 || fail "Cannot connect to Kubernetes cluster"
pass "kubectl connected to cluster"

command -v kustomize > /dev/null 2>&1 && KUSTOMIZE=kustomize || KUSTOMIZE="kubectl kustomize"
pass "kustomize available"

# ─── Check secrets file ─────────────────────────────────────────────────────
if [ ! -f "$K8S_DIR/base/secrets.local.yaml" ]; then
  info "Creating secrets template from secrets.yaml..."
  cp "$K8S_DIR/base/secrets.yaml" "$K8S_DIR/base/secrets.local.yaml"
  echo -e "${YELLOW}⚠️  Edit k8s/base/secrets.local.yaml with real values before deploying!${NC}"
fi

# ─── Dry run mode ───────────────────────────────────────────────────────────
KUBECTL_FLAGS=""
if [ "$DRY_RUN" = "--dry-run" ]; then
  KUBECTL_FLAGS="--dry-run=client"
  info "DRY RUN mode \u2014 no changes will be made"
fi

# ─── Deploy ─────────────────────────────────────────────────────────────────
info "Creating namespace..."
kubectl apply -f "$K8S_DIR/namespace.yaml" $KUBECTL_FLAGS
pass "Namespace 'edgesphere' ready"

info "Applying ConfigMap + Secrets..."
kubectl apply -f "$K8S_DIR/base/configmap.yaml" $KUBECTL_FLAGS
kubectl apply -f "$K8S_DIR/base/secrets.local.yaml" $KUBECTL_FLAGS
pass "ConfigMaps and Secrets applied"

info "Deploying infrastructure (postgres, redis, minio, kafka)..."
kubectl apply -f "$K8S_DIR/infra/" $KUBECTL_FLAGS
pass "Infrastructure manifests applied"

if [ -z "$DRY_RUN" ]; then
  info "Waiting for postgres to be ready..."
  kubectl wait --for=condition=ready pod -l app=postgres -n $NS --timeout=120s
  info "Waiting for redis to be ready..."
  kubectl wait --for=condition=ready pod -l app=redis -n $NS --timeout=60s
  pass "Infrastructure pods ready"
fi

info "Deploying applications..."
kubectl apply -f "$K8S_DIR/apps/" $KUBECTL_FLAGS
pass "Application manifests applied"

info "Deploying ingress..."
kubectl apply -f "$K8S_DIR/ingress/" $KUBECTL_FLAGS
pass "Ingress applied"

info "Deploying HPA (Horizontal Pod Autoscalers)..."
kubectl apply -f "$K8S_DIR/hpa/" $KUBECTL_FLAGS
pass "HPAs applied"

info "Deploying monitoring rules..."
kubectl apply -f "$K8S_DIR/monitoring/" $KUBECTL_FLAGS 2>/dev/null || info "Skipping monitoring (Prometheus Operator may not be installed)"

# ─── Wait for rollout ────────────────────────────────────────────────────────
if [ -z "$DRY_RUN" ]; then
  echo ""
  info "Waiting for deployments to roll out..."
  for deploy in gateway auth-service storage-service cdn-service-a dashboard; do
    kubectl rollout status deployment/$deploy -n $NS --timeout=300s && pass "$deploy ready" || fail "$deploy rollout failed"
  done
fi

# ─── Status ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Deployment Status           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
kubectl get pods -n $NS --no-headers 2>/dev/null | awk '{
  status = $3 == "Running" ? "\033[0;32m✓\033[0m" : "\033[0;31m✗\033[0m"
  printf "  %s %-35s %s\n", status, $1, $3
}' 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "  Port forward dashboard:   kubectl port-forward svc/dashboard 3100:3100 -n $NS"
echo "  Port forward gateway:     kubectl port-forward svc/gateway 3000:3000 -n $NS"
echo "  View all pods:            kubectl get pods -n $NS"
echo "  View HPA status:          kubectl get hpa -n $NS"
echo "  View logs (gateway):      kubectl logs -l app=gateway -n $NS --tail=50"
echo ""
