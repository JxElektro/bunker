# AWS EC2 (MVP) - Comandos (CLI)

Estos comandos asumen:
- **Cuenta correcta**: `aws sts get-caller-identity` muestra `Account=299252893280`.
- Región: `us-east-2`.
- Perfil: `proxelgame`.

> Si algo no cuadra, para. No quieres crear recursos en otra cuenta.

## 0) Export de entorno
```bash
export AWS_PROFILE=proxelgame
export AWS_REGION=us-east-2
aws sts get-caller-identity
```

## 1) Tu IP pública (para SSH 22)
```bash
MY_IP="$(curl -s https://checkip.amazonaws.com | tr -d '\\n')"
echo "$MY_IP"
```

## 2) Key Pair (descarga PEM)
```bash
mkdir -p /Users/JhenN/Desktop/bunker/.secrets
aws ec2 create-key-pair \
  --key-name bunker-ec2 \
  --query 'KeyMaterial' \
  --output text > /Users/JhenN/Desktop/bunker/.secrets/bunker-ec2.pem

chmod 600 /Users/JhenN/Desktop/bunker/.secrets/bunker-ec2.pem
```

## 3) Security Group
```bash
VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
SG_ID="$(aws ec2 create-security-group --group-name bunker-server-sg --description 'bunker server' --vpc-id \"$VPC_ID\" --query 'GroupId' --output text)"
echo "$SG_ID"

# SSH solo desde tu IP
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr "$MY_IP/32"

# MVP: expone 4040 (HTTP). Para producción con Vercel, preferir 443 + TLS.
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 4040 --cidr 0.0.0.0/0

# Abre 80/443 por si usas Caddy/Nginx para TLS.
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
```

## 4) AMI Ubuntu 22.04 (SSM, con fallback)
```bash
AMI_ID="$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query 'Parameter.Value' --output text 2>/dev/null || true)"
if [ -z "$AMI_ID" ] || [ "$AMI_ID" = "None" ]; then
  AMI_ID="$(aws ec2 describe-images --owners 099720109477 \
    --filters \
      'Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' \
      'Name=state,Values=available' \
      'Name=architecture,Values=x86_64' \
      'Name=virtualization-type,Values=hvm' \
      'Name=root-device-type,Values=ebs' \
    --query 'sort_by(Images,&CreationDate)[-1].ImageId' \
    --output text)"
fi
echo "$AMI_ID"
```

## 5) Subnet default
```bash
SUBNET_ID="$(aws ec2 describe-subnets --filters Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)"
echo "$SUBNET_ID"
```

## 6) Crear instancia (con user-data)
```bash
USER_DATA_B64="$(python3 - <<'PY'\nimport base64\np='deploy/ec2/user-data.sh'\nprint(base64.b64encode(open(p,'rb').read()).decode())\nPY\n)"

INSTANCE_ID="$(aws ec2 run-instances \\\n  --image-id \"$AMI_ID\" \\\n  --instance-type t3.micro \\\n  --key-name bunker-ec2 \\\n  --security-group-ids \"$SG_ID\" \\\n  --subnet-id \"$SUBNET_ID\" \\\n  --associate-public-ip-address \\\n  --user-data \"$USER_DATA_B64\" \\\n  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=bunker-server}]' \\\n  --query 'Instances[0].InstanceId' \\\n  --output text)\n\necho \"$INSTANCE_ID\"\n"
```

## 7) Obtener IP pública
```bash
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
PUBLIC_IP="$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
echo "$PUBLIC_IP"
```

## 8) Healthcheck
```bash
curl -s "http://$PUBLIC_IP:4040/health"
```

## 9) SSH (logs)
```bash
ssh -i /Users/JhenN/Desktop/bunker/.secrets/bunker-ec2.pem ubuntu@"$PUBLIC_IP"
docker logs -f bunker-server
```

## Vercel note
Si el frontend está en Vercel (HTTPS), no uses `http://IP:4040` como socket URL en producción. Necesitas `https://api.tudominio.com` con TLS.
