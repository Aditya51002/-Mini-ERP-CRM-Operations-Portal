# EC2 Setup Guide

This guide prepares one AWS EC2 instance for the Mini ERP + CRM Operations
Portal deployment pipeline. The GitHub Actions workflow expects the compose
stack to live at `/opt/mini-erp-crm`.

## 1. Launch the Instance

1. Open the AWS EC2 console.
2. Launch a new instance using an Ubuntu Server LTS AMI.
3. Choose `t2.micro` for the instance type.
4. Create or select an SSH key pair and download the private key.
5. Create a security group with inbound rules:
   - SSH: TCP `22` from your IP address.
   - HTTP: TCP `80` from `0.0.0.0/0`.
   - HTTPS: TCP `443` from `0.0.0.0/0`.
6. Launch the instance.

## 2. Allocate an Elastic IP

1. In EC2, open Elastic IPs.
2. Allocate a new Elastic IP.
3. Associate it with the new instance.
4. Use this Elastic IP as the `EC2_HOST` GitHub secret.

## 3. Install Docker and Docker Compose

SSH into the instance:

```bash
ssh -i path/to/key.pem ubuntu@YOUR_ELASTIC_IP
```

Install Docker Engine and the Compose plugin:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Log out and SSH back in so the Docker group membership is active. Then verify:

```bash
docker --version
docker compose version
```

## 4. Create the Deploy Directory

```bash
sudo mkdir -p /opt/mini-erp-crm
sudo chown ubuntu:ubuntu /opt/mini-erp-crm
cd /opt/mini-erp-crm
```

## 5. Create the Production docker-compose.yml

Create `/opt/mini-erp-crm/docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -uroot -p$${MYSQL_ROOT_PASSWORD}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  backend:
    image: ${DOCKERHUB_USERNAME}/mini-erp-crm-backend:${IMAGE_TAG:-latest}
    restart: unless-stopped
    env_file:
      - ./.env
    depends_on:
      mysql:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "node -e \"fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""
        ]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  frontend:
    image: ${DOCKERHUB_USERNAME}/mini-erp-crm-frontend:${IMAGE_TAG:-latest}
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  mysql_data:
```

The backend image already runs `npx prisma migrate deploy` from its entrypoint,
so a new MySQL volume is migrated automatically on first start.

## 6. Create the .env File

Create `/opt/mini-erp-crm/.env`:

```env
DOCKERHUB_USERNAME=your-dockerhub-username
IMAGE_TAG=latest

MYSQL_ROOT_PASSWORD=replace_with_a_strong_root_password
MYSQL_DATABASE=mini_erp_crm
MYSQL_USER=erp_user
MYSQL_PASSWORD=replace_with_a_strong_app_password

PORT=4000
DATABASE_URL=mysql://erp_user:replace_with_a_strong_app_password@mysql:3306/mini_erp_crm
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://YOUR_ELASTIC_IP
```

Keep this file on the server only. Do not commit production secrets.

## 7. First Manual Start

Log in to Docker Hub if the images are private:

```bash
docker login
```

Start the stack:

```bash
cd /opt/mini-erp-crm
docker compose pull
docker compose up -d
docker compose ps
```

Seed the four test users:

```bash
docker compose exec backend npm run seed
```

Open:

```text
http://YOUR_ELASTIC_IP
```

## 8. Add GitHub Secrets

In the GitHub repository, go to Settings, Secrets and variables, Actions, then
add:

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
EC2_HOST
EC2_USER
EC2_SSH_KEY
```

Use `ubuntu` for `EC2_USER` if you launched an Ubuntu AMI. `EC2_SSH_KEY` must
be the private key contents, not the `.pub` file.

## 9. Pipeline Verification

After pushing to `main`, confirm the server pulled the SHA-tagged images:

```bash
cd /opt/mini-erp-crm
docker compose ps
docker compose images
```

The image tag should match the GitHub commit SHA from the successful workflow
run.
