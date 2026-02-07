#!/usr/bin/env bash
set -euo pipefail

# Idempotent-ish EC2 launcher for the Bunker Socket.IO server (MVP).
# - Creates (or reuses) a security group.
# - Creates a NEW keypair + PEM file (safe default).
# - Launches an Ubuntu 22.04 t3.micro with user-data to build+run the container.
#
# Requirements:
# - AWS CLI configured with a profile that points to Account 299252893280.
# - Region: us-east-2 (default below).
#
# Usage:
#   export AWS_PROFILE=proxelgame
#   ./deploy/ec2/create-ec2.sh

AWS_PROFILE="${AWS_PROFILE:-proxelgame}"
AWS_REGION="${AWS_REGION:-us-east-2}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SECRETS_DIR="$ROOT_DIR/.secrets"
USER_DATA_PATH="$ROOT_DIR/deploy/ec2/user-data.sh"

mkdir -p "$SECRETS_DIR"

echo "[bunker/ec2] Using profile=$AWS_PROFILE region=$AWS_REGION"
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" sts get-caller-identity >/dev/null

MY_IP="$(curl -fsSL https://checkip.amazonaws.com | tr -d '\n' || true)"
if [[ -z "$MY_IP" ]]; then
  echo "[bunker/ec2] ERROR: could not determine public IP (curl checkip)."
  echo "[bunker/ec2] Fix: run from a network with outbound internet, or set MY_IP manually and rerun."
  exit 1
fi
echo "[bunker/ec2] MY_IP=$MY_IP"

KEY_NAME="bunker-ec2-$(date +%Y%m%d-%H%M%S)"
PEM_PATH="$SECRETS_DIR/$KEY_NAME.pem"
echo "[bunker/ec2] Creating keypair $KEY_NAME -> $PEM_PATH"
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 create-key-pair \
  --key-name "$KEY_NAME" \
  --query 'KeyMaterial' \
  --output text > "$PEM_PATH"
chmod 600 "$PEM_PATH"

VPC_ID="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-vpcs \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)"
if [[ -z "$VPC_ID" || "$VPC_ID" == "None" ]]; then
  echo "[bunker/ec2] ERROR: could not find default VPC."
  exit 1
fi

SG_NAME="bunker-server-sg"
SG_ID="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || true)"
if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  echo "[bunker/ec2] Creating security group $SG_NAME"
  SG_ID="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "bunker server" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' \
    --output text)"
else
  echo "[bunker/ec2] Reusing security group $SG_NAME ($SG_ID)"
fi

echo "[bunker/ec2] Authorizing ingress rules (idempotent)"
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MY_IP/32" 2>/dev/null || true
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" --protocol tcp --port 4040 --cidr 0.0.0.0/0 2>/dev/null || true
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true
aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true

AMI_ID="$(
  aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ssm get-parameter \
    --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
    --query 'Parameter.Value' \
    --output text 2>/dev/null || true
)"

if [[ -z "$AMI_ID" || "$AMI_ID" == "None" ]]; then
  echo "[bunker/ec2] SSM Ubuntu AMI param not found; falling back to describe-images (Canonical)."
  AMI_ID="$(
    aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-images \
      --owners 099720109477 \
      --filters \
        "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
        "Name=state,Values=available" \
        "Name=architecture,Values=x86_64" \
        "Name=virtualization-type,Values=hvm" \
        "Name=root-device-type,Values=ebs" \
      --query 'sort_by(Images,&CreationDate)[-1].ImageId' \
      --output text
  )"
fi

if [[ -z "$AMI_ID" || "$AMI_ID" == "None" ]]; then
  echo "[bunker/ec2] ERROR: could not resolve an Ubuntu 22.04 AMI ID."
  exit 1
fi

echo "[bunker/ec2] AMI_ID=$AMI_ID"

SUBNET_ID="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-subnets \
  --filters Name=default-for-az,Values=true \
  --query 'Subnets[0].SubnetId' \
  --output text)"
echo "[bunker/ec2] SUBNET_ID=$SUBNET_ID"

USER_DATA_B64="$(python3 - <<PY
import base64
p=r'''$USER_DATA_PATH'''
print(base64.b64encode(open(p,'rb').read()).decode())
PY
)"

echo "[bunker/ec2] Launching instance..."
INSTANCE_ID="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 run-instances \
  --image-id "$AMI_ID" \
  --instance-type t3.micro \
  --key-name "$KEY_NAME" \
  --security-group-ids "$SG_ID" \
  --subnet-id "$SUBNET_ID" \
  --associate-public-ip-address \
  --user-data "$USER_DATA_B64" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=bunker-server}]' \
  --query 'Instances[0].InstanceId' \
  --output text)"

aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 wait instance-running --instance-ids "$INSTANCE_ID"
PUBLIC_IP="$(aws --profile "$AWS_PROFILE" --region "$AWS_REGION" ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

cat > "$SECRETS_DIR/ec2.env" <<EOF
AWS_PROFILE=$AWS_PROFILE
AWS_REGION=$AWS_REGION
INSTANCE_ID=$INSTANCE_ID
PUBLIC_IP=$PUBLIC_IP
KEY_NAME=$KEY_NAME
PEM_PATH=$PEM_PATH
SG_ID=$SG_ID
EOF

echo "[bunker/ec2] INSTANCE_ID=$INSTANCE_ID"
echo "[bunker/ec2] PUBLIC_IP=$PUBLIC_IP"
echo "[bunker/ec2] PEM_PATH=$PEM_PATH"
echo "[bunker/ec2] Saved $SECRETS_DIR/ec2.env"

echo "[bunker/ec2] Waiting for /health (can take a few minutes on first boot)..."
for i in {1..40}; do
  if curl -fsS "http://$PUBLIC_IP:4040/health" >/dev/null 2>&1; then
    echo "[bunker/ec2] OK: http://$PUBLIC_IP:4040/health"
    exit 0
  fi
  sleep 10
done

echo "[bunker/ec2] WARN: /health not ready yet."
echo "[bunker/ec2] SSH: ssh -i \"$PEM_PATH\" ubuntu@$PUBLIC_IP"
echo "[bunker/ec2] Then: docker logs -f bunker-server"
exit 0
