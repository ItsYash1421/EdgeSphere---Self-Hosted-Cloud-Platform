#!/bin/bash
# EdgeSphere — Terraform Deploy Helper
# Usage: bash scripts/tf-deploy.sh [dev|prod] [plan|apply|destroy]

set -e
ENV=${1:-dev}
ACTION=${2:-plan}
TF_DIR="terraform/environments/$ENV"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  EdgeSphere Terraform Deployer            ║${NC}"
echo -e "${BLUE}║  Environment: ${YELLOW}${ENV}${BLUE} | Action: ${YELLOW}${ACTION}${BLUE}         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
echo ""

# Preflight
command -v terraform > /dev/null 2>&1 || { echo -e "${RED}✗ terraform not found${NC}"; exit 1; }
command -v aws > /dev/null 2>&1 || { echo -e "${RED}✗ aws cli not found${NC}"; exit 1; }

TF_VERSION=$(terraform version -json | python3 -c "import sys,json; print(json.load(sys.stdin)['terraform_version'])" 2>/dev/null)
echo -e "${GREEN}✓ Terraform $TF_VERSION${NC}"

AWS_IDENTITY=$(aws sts get-caller-identity 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d['Account']} ({d['Arn'].split('/')[1]})\")" 2>/dev/null || echo "Not authenticated")
echo -e "${GREEN}✓ AWS: $AWS_IDENTITY${NC}"
echo ""

cd terraform/

echo -e "${YELLOW}→ Running terraform init...${NC}"
terraform init -backend-config="key=edgesphere/$ENV/terraform.tfstate"

echo -e "${YELLOW}→ Running terraform $ACTION...${NC}"
case $ACTION in
  plan)
    terraform plan -var-file="environments/$ENV/terraform.tfvars" -out=".terraform/$ENV.tfplan"
    echo ""
    echo -e "${GREEN}✓ Plan complete! Review above then run:${NC}"
    echo "  bash scripts/tf-deploy.sh $ENV apply"
    ;;
  apply)
    if [ -f ".terraform/$ENV.tfplan" ]; then
      terraform apply ".terraform/$ENV.tfplan"
    else
      terraform apply -var-file="environments/$ENV/terraform.tfvars" -auto-approve
    fi
    echo ""
    echo -e "${GREEN}✓ Infrastructure deployed!${NC}"
    echo ""
    terraform output
    ;;
  destroy)
    echo -e "${RED}⚠️  WARNING: This will DESTROY all infrastructure in $ENV!${NC}"
    read -p "Type 'yes' to confirm: " CONFIRM
    [ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 0; }
    terraform destroy -var-file="environments/$ENV/terraform.tfvars" -auto-approve
    echo -e "${GREEN}✓ Infrastructure destroyed${NC}"
    ;;
  *)
    echo -e "${RED}Unknown action: $ACTION (use: plan|apply|destroy)${NC}"
    exit 1
    ;;
esac
