# EdgeSphere — Kubernetes Deployment Guide

## Prerequisites
- kubectl >= 1.28
- helm >= 3.12
- A Kubernetes cluster (EKS/GKE/AKS or local kind/minikube)

## Quick Deploy

### 1. Create namespace
kubectl apply -f k8s/namespace.yaml

### 2. Configure secrets
cp k8s/base/secrets.yaml k8s/base/secrets.local.yaml
# Edit secrets.local.yaml with real values
kubectl apply -f k8s/base/secrets.local.yaml

### 3. Deploy infrastructure
kubectl apply -f k8s/infra/

### 4. Wait for infra ready
kubectl wait --for=condition=ready pod -l app=postgres -n edgesphere --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n edgesphere --timeout=60s

### 5. Deploy applications
kubectl apply -f k8s/apps/

### 6. Deploy ingress
kubectl apply -f k8s/ingress/

### 7. Deploy HPA
kubectl apply -f k8s/hpa/

### Or deploy everything at once:
kubectl apply -k k8s/

## Local Testing with kind
kind create cluster --name edgesphere
kubectl apply -k k8s/

## Port Forwarding (local dev)
kubectl port-forward svc/gateway 3000:3000 -n edgesphere
kubectl port-forward svc/dashboard 3100:3100 -n edgesphere

## Scaling
kubectl scale deployment gateway --replicas=5 -n edgesphere

## Rolling Update
kubectl set image deployment/gateway gateway=ghcr.io/your-org/edgesphere-gateway:v2 -n edgesphere

## Check HPA
kubectl get hpa -n edgesphere

## View all pods
kubectl get pods -n edgesphere
