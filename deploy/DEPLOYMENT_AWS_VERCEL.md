# Hướng Dẫn Deploy: AWS EC2 Docker + ECR + GitHub Actions + Vercel

Tài liệu này hướng dẫn deploy project realtime chat hiện tại theo kiến trúc:

- Frontend: Vercel
- Backend: Express + Socket.IO chạy trong Docker container trên AWS EC2
- Docker image backend: AWS ECR
- CI/CD: GitHub Actions build image, push ECR, SSH vào EC2 và restart container
- Reverse proxy: Nginx trên EC2
- Domain miễn phí: DuckDNS
- HTTPS: Certbot/Let's Encrypt
- Database: MongoDB Atlas
- Upload avatar và ảnh tin nhắn: Cloudinary, không cần AWS S3

> Ghi chú: Hướng dẫn này ưu tiên deploy portfolio/demo cho nhà tuyển dụng. Cách làm giữ hệ thống đơn giản, dễ debug, nhưng vẫn có Docker, CI/CD, HTTPS, WebSocket proxy và env production đúng cách.

---

## 1. Kiến trúc production

Luôn tách 2 URL:

```txt
Frontend URL:
https://<vercel-app>.vercel.app

Backend URL:
https://<duckdns-subdomain>.duckdns.org

API URL frontend gọi:
https://<duckdns-subdomain>.duckdns.org/api

Socket URL frontend connect:
https://<duckdns-subdomain>.duckdns.org
```

Mapping env:

```env
# frontend trên Vercel
VITE_API_URL=https://<duckdns-subdomain>.duckdns.org/api
VITE_SOCKET_URL=https://<duckdns-subdomain>.duckdns.org

# backend trên EC2
CLIENT_URL=https://<vercel-app>.vercel.app
PORT=5001
```

Lưu ý quan trọng:

- `VITE_API_URL` phải có `/api`, vì frontend đang gọi các path như `/conversations`, `/messages/direct`.
- `VITE_SOCKET_URL` không có `/api`, vì Socket.IO server nằm ở backend root origin.
- Backend đang set refresh cookie với `secure: true` và `sameSite: "none"`, nên production phải dùng HTTPS thật.
- Upload ảnh/avatar đang dùng Cloudinary, không cần S3.

---

## 2. Pre-deploy checklist

### 2.1. Không commit secrets

Repo đã có `.gitignore` ignore `.env`, nhưng vẫn nên kiểm tra:

```bash
git status
git ls-files | grep -E '(^|/)\.env'
```

Nếu thấy file `.env` đã bị track, cần remove khỏi Git index:

```bash
git rm --cached backend/.env
git rm --cached frontend/.env.production
```

Không commit các giá trị:

- MongoDB connection string
- JWT secret
- Cloudinary API secret
- AWS access key
- EC2 private key
- DuckDNS token

### 2.2. Backend env production

Backend cần các biến sau:

```env
PORT=5001
CLIENT_URL=https://<vercel-app>.vercel.app
MONGODB_CONNECTIONSTRING=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
ACCESS_TOKEN_SECRET=<random-long-secret>
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
```

Tạo JWT secret mạnh:

```bash
openssl rand -hex 64
```

### 2.3. Frontend env production

Trên Vercel, set:

```env
VITE_API_URL=https://<duckdns-subdomain>.duckdns.org/api
VITE_SOCKET_URL=https://<duckdns-subdomain>.duckdns.org
```

Vite chỉ expose biến có prefix `VITE_` ra client bundle. Không đặt secrets vào frontend env.

### 2.4. Nên fix nhỏ trước production

Trong `backend/src/controllers/authController.js`, logout hiện tại đang:

```js
res.clearCookie('refreshToken');
```

Trong production cross-site cookie, nên clear cookie bằng cùng options lúc set cookie:

```js
res.clearCookie('refreshToken', {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
});
```

Nếu không sửa, login vẫn có thể chạy, nhưng logout production có thể không xóa cookie như mong đợi trên một số browser.

---

## 3. MongoDB Atlas setup

1. Vào MongoDB Atlas.
2. Tạo project/cluster.
3. Tạo database user.
4. Lấy connection string dạng `mongodb+srv://...`.
5. Vào `Network Access`.
6. Thêm IP được phép connect:
   - Cách tốt hơn: thêm public IP của EC2.
   - Cách nhanh cho demo: thêm `0.0.0.0/0`, nhưng kém an toàn hơn.

Sau khi có EC2 public IP hoặc Elastic IP, nên quay lại Atlas và chỉ whitelist IP đó.

---

## 4. Cloudinary setup

Project đã upload avatar và ảnh tin nhắn lên Cloudinary. Không cần AWS S3.

Cần lấy 3 giá trị từ Cloudinary dashboard:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Đặt các biến này trong `backend.env` trên EC2. Không đặt Cloudinary secret vào Vercel frontend env.

Cần quan tâm:

- Cloudinary quota storage/bandwidth.
- Giới hạn file upload hiện tại của backend là 5MB theo multer.
- Nginx production cần `client_max_body_size 10M;`, nếu không upload có thể bị `413 Payload Too Large`.

---

## 5. Tạo Dockerfile cho backend

Tạo file:

```txt
backend/Dockerfile
```

Nội dung:

```Dockerfile
FROM node:22-bookworm-slim AS deps

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

EXPOSE 5001

CMD ["npm", "start"]
```

Giải thích nhanh:

- `npm ci --omit=dev` cài dependency production từ `package-lock.json`.
- `nodemon` không cần trong production.
- Container chạy `npm start`, tương ứng `node src/server.js`.
- App listen port `process.env.PORT || 5001`, nên container expose `5001`.

---

## 6. Tạo `.dockerignore`

Tạo file:

```txt
backend/.dockerignore
```

Nội dung:

```dockerignore
node_modules
npm-debug.log
.env
.env.*
Dockerfile
.dockerignore
coverage
logs
*.log
.git
.gitignore
```

Mục tiêu:

- Không copy `.env` vào Docker image.
- Không copy `node_modules` local.
- Image nhẹ hơn và ít rò rỉ secrets hơn.

---

## 7. Test Docker local trước khi deploy

Chạy tại root repo:

```bash
docker build -t realtime-chat-backend:local ./backend
```

Nếu muốn test container local bằng env backend local:

```bash
docker run --rm --env-file ./backend/.env -p 5001:5001 realtime-chat-backend:local
```

Kiểm tra server:

```bash
curl http://localhost:5001/api/conversations
```

Nếu nhận `401`, `403` hoặc JSON error từ backend thì server đã sống. Endpoint này protected nên không cần mong `200`.

---

## 8. AWS EC2 setup

### 8.1. Tạo EC2 instance

Gợi ý:

- OS: Ubuntu 24.04 LTS hoặc Ubuntu 22.04 LTS
- Architecture: x86_64/amd64 để match Docker image mặc định từ GitHub Actions
- Instance type: `t3.micro` hoặc `t2.micro` cho demo nhỏ
- Storage: 20GB trở lên

### 8.2. Security Group

Inbound rules:

```txt
SSH   TCP 22   Your IP only
HTTP  TCP 80   0.0.0.0/0
HTTPS TCP 443  0.0.0.0/0
```

Không cần mở port `5001` public vì Nginx sẽ proxy nội bộ qua `127.0.0.1:5001`.

### 8.3. Elastic IP

Nên dùng Elastic IP để public IP không đổi khi restart EC2.

Lưu ý: AWS có tính phí public IPv4/Elastic IP tùy theo trạng thái và region. Sau khi không dùng nữa, nhớ release Elastic IP và terminate EC2 để tránh tính phí.

---

## 9. Cài Docker trên EC2

SSH vào EC2:

```bash
ssh -i <your-key.pem> ubuntu@<ec2-public-ip>
```

Cài Docker Engine theo apt repository:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Cho user `ubuntu` chạy Docker không cần `sudo`:

```bash
sudo usermod -aG docker ubuntu
exit
```

SSH lại vào EC2, rồi test:

```bash
docker run hello-world
docker compose version
```

---

## 10. Cài AWS CLI trên EC2

```bash
sudo apt update
sudo apt install -y unzip curl

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

aws --version
```

---

## 11. Tạo ECR repository

Trên AWS Console:

1. Vào Amazon ECR.
2. Chọn `Create repository`.
3. Visibility: `Private`.
4. Repository name:

```txt
realtime-chat-backend
```

Sau khi tạo, ECR image URI sẽ có dạng:

```txt
<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/realtime-chat-backend
```

Ví dụ:

```txt
123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/realtime-chat-backend
```

---

## 12. IAM cho EC2 pull image từ ECR

Tạo IAM Role cho EC2:

1. AWS Console -> IAM -> Roles -> Create role.
2. Trusted entity: `AWS service`.
3. Use case: `EC2`.
4. Permission policy: `AmazonEC2ContainerRegistryReadOnly`.
5. Role name ví dụ:

```txt
realtime-chat-ec2-ecr-readonly-role
```

Gắn role vào EC2:

1. EC2 -> Instances.
2. Chọn instance.
3. Actions -> Security -> Modify IAM role.
4. Chọn role vừa tạo.

Sau đó trên EC2, login ECR:

```bash
aws ecr get-login-password --region <aws-region> | \
  docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com
```

---

## 13. Tạo folder deploy trên EC2

Trên EC2:

```bash
sudo mkdir -p /opt/realtime-chat
sudo chown -R ubuntu:ubuntu /opt/realtime-chat
cd /opt/realtime-chat
```

Tạo file env cho app:

```bash
nano backend.env
```

Nội dung:

```env
PORT=5001
CLIENT_URL=https://<vercel-app>.vercel.app
MONGODB_CONNECTIONSTRING=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
ACCESS_TOKEN_SECRET=<random-long-secret>
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
```

Tạo file env riêng cho Docker Compose image:

```bash
nano deploy.env
```

Nội dung:

```env
AWS_REGION=<aws-region>
ECR_REGISTRY=<aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com
ECR_REPOSITORY=realtime-chat-backend
IMAGE_TAG=latest
```

Tạo file Docker Compose production:

```bash
nano docker-compose.prod.yml
```

Nội dung:

```yaml
services:
  backend:
    image: ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG:-latest}
    container_name: realtime-chat-api
    restart: unless-stopped
    env_file:
      - ./backend.env
    ports:
      - "127.0.0.1:5001:5001"
```

Khi image đã có trên ECR, chạy:

```bash
docker compose --env-file deploy.env -f docker-compose.prod.yml pull backend
docker compose --env-file deploy.env -f docker-compose.prod.yml up -d
docker compose --env-file deploy.env -f docker-compose.prod.yml ps
docker logs -f realtime-chat-api
```

---

## 14. GitHub Actions deploy backend lên ECR và EC2

### 14.1. Tạo IAM OIDC provider cho GitHub Actions

Trong AWS IAM:

1. Vào IAM -> Identity providers.
2. Add provider.
3. Provider type: `OpenID Connect`.
4. Provider URL:

```txt
https://token.actions.githubusercontent.com
```

5. Audience:

```txt
sts.amazonaws.com
```

### 14.2. Tạo IAM role cho GitHub Actions

Tạo role có trust policy cho repo của bạn.

Thay:

- `<aws-account-id>`
- `<github-owner>`
- `<github-repo>`

Trust policy mẫu:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<aws-account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<github-owner>/<github-repo>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

Role name ví dụ:

```txt
realtime-chat-github-actions-ecr-role
```

Gắn inline policy để push image lên ECR.

Thay:

- `<aws-account-id>`
- `<aws-region>`
- `<ecr-repository-name>`

Policy mẫu:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
        "ecr:BatchGetImage",
        "ecr:DescribeRepositories"
      ],
      "Resource": "arn:aws:ecr:<aws-region>:<aws-account-id>:repository/<ecr-repository-name>"
    }
  ]
}
```

### 14.3. GitHub repository variables và secrets

Trong GitHub repo:

Settings -> Secrets and variables -> Actions.

Variables:

```txt
AWS_REGION=<aws-region>
ECR_REPOSITORY=realtime-chat-backend
```

Secrets:

```txt
AWS_ROLE_TO_ASSUME=arn:aws:iam::<aws-account-id>:role/realtime-chat-github-actions-ecr-role
EC2_HOST=<ec2-public-ip-or-duckdns-domain>
EC2_USER=ubuntu
EC2_SSH_KEY=<private-key-content>
```

`EC2_SSH_KEY` là nội dung private key `.pem`, gồm cả:

```txt
-----BEGIN ... PRIVATE KEY-----
...
-----END ... PRIVATE KEY-----
```

### 14.4. Tạo workflow file

Tạo file:

```txt
.github/workflows/deploy-backend.yml
```

Nội dung:

```yaml
name: Deploy Backend

on:
  push:
    branches:
      - main
    paths:
      - "backend/**"
      - ".github/workflows/deploy-backend.yml"
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}
          aws-region: ${{ vars.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: ${{ vars.ECR_REPOSITORY }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build \
            --platform linux/amd64 \
            -t "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" \
            -t "$ECR_REGISTRY/$ECR_REPOSITORY:latest" \
            ./backend

          docker push "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
          docker push "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

      - name: Configure SSH
        env:
          EC2_HOST: ${{ secrets.EC2_HOST }}
          EC2_SSH_KEY: ${{ secrets.EC2_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$EC2_SSH_KEY" > ~/.ssh/ec2_key
          chmod 600 ~/.ssh/ec2_key
          ssh-keyscan -H "$EC2_HOST" >> ~/.ssh/known_hosts

      - name: Deploy on EC2
        env:
          AWS_REGION: ${{ vars.AWS_REGION }}
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: ${{ vars.ECR_REPOSITORY }}
          IMAGE_TAG: ${{ github.sha }}
          EC2_HOST: ${{ secrets.EC2_HOST }}
          EC2_USER: ${{ secrets.EC2_USER }}
        run: |
          ssh -i ~/.ssh/ec2_key "$EC2_USER@$EC2_HOST" \
            "AWS_REGION='$AWS_REGION' ECR_REGISTRY='$ECR_REGISTRY' ECR_REPOSITORY='$ECR_REPOSITORY' IMAGE_TAG='$IMAGE_TAG' bash -s" <<'EOF'
          set -euo pipefail

          cd /opt/realtime-chat

          aws ecr get-login-password --region "$AWS_REGION" | \
            docker login --username AWS --password-stdin "$ECR_REGISTRY"

          if grep -q '^ECR_REGISTRY=' deploy.env; then
            sed -i "s|^ECR_REGISTRY=.*|ECR_REGISTRY=$ECR_REGISTRY|" deploy.env
          else
            echo "ECR_REGISTRY=$ECR_REGISTRY" >> deploy.env
          fi

          if grep -q '^ECR_REPOSITORY=' deploy.env; then
            sed -i "s|^ECR_REPOSITORY=.*|ECR_REPOSITORY=$ECR_REPOSITORY|" deploy.env
          else
            echo "ECR_REPOSITORY=$ECR_REPOSITORY" >> deploy.env
          fi

          if grep -q '^IMAGE_TAG=' deploy.env; then
            sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|" deploy.env
          else
            echo "IMAGE_TAG=$IMAGE_TAG" >> deploy.env
          fi

          docker compose --env-file deploy.env -f docker-compose.prod.yml pull backend
          docker compose --env-file deploy.env -f docker-compose.prod.yml up -d --remove-orphans
          docker image prune -f
          docker ps
          EOF
```

Sau khi push lên branch `main`, vào tab Actions để xem pipeline.

---

## 15. Manual push image lên ECR lần đầu, nếu chưa muốn dùng CI/CD

Nếu muốn test ECR trước:

```bash
aws ecr get-login-password --region <aws-region> | \
  docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com

docker build --platform linux/amd64 -t realtime-chat-backend ./backend

docker tag realtime-chat-backend:latest \
  <aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/realtime-chat-backend:latest

docker push <aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com/realtime-chat-backend:latest
```

Sau đó trên EC2:

```bash
cd /opt/realtime-chat
docker compose --env-file deploy.env -f docker-compose.prod.yml pull backend
docker compose --env-file deploy.env -f docker-compose.prod.yml up -d
```

---

## 16. DuckDNS setup

1. Vào https://www.duckdns.org
2. Đăng nhập.
3. Tạo subdomain, ví dụ:

```txt
serene-chat
```

Domain sẽ là:

```txt
serene-chat.duckdns.org
```

4. Trỏ subdomain về EC2 Elastic IP hoặc public IP.

Có thể update bằng URL:

```bash
curl "https://www.duckdns.org/update?domains=<subdomain>&token=<duckdns-token>&ip=<ec2-public-ip>"
```

Nếu dùng Elastic IP, IP sẽ ổn định hơn và thường không cần cron update.

Nếu không dùng Elastic IP, tạo cron update:

```bash
mkdir -p ~/duckdns
nano ~/duckdns/duck.sh
```

Nội dung:

```bash
#!/usr/bin/env bash
echo url="https://www.duckdns.org/update?domains=<subdomain>&token=<duckdns-token>&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

Cấp quyền:

```bash
chmod 700 ~/duckdns/duck.sh
```

Thêm cron:

```bash
crontab -e
```

Thêm dòng:

```cron
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

Test DNS:

```bash
nslookup <subdomain>.duckdns.org
```

---

## 17. Cài Nginx trên EC2

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Kiểm tra:

```bash
sudo systemctl status nginx
```

---

## 18. Nginx reverse proxy cho Express + Socket.IO

Tạo config:

```bash
sudo nano /etc/nginx/sites-available/realtime-chat-api
```

Nội dung, thay `<duckdns-domain>`:

```nginx
server {
    listen 80;
    server_name <duckdns-domain>;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/realtime-chat-api /etc/nginx/sites-enabled/realtime-chat-api
sudo nginx -t
sudo systemctl reload nginx
```

Kiểm tra:

```bash
curl http://<duckdns-domain>/api/conversations
```

Nếu nhận `401`, `403` hoặc JSON error từ backend thì proxy đã tới backend. Endpoint protected nên không cần `200`.

---

## 19. HTTPS bằng Certbot

Cài Certbot:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

Cấp SSL:

```bash
sudo certbot --nginx -d <duckdns-domain>
```

Ví dụ:

```bash
sudo certbot --nginx -d serene-chat.duckdns.org
```

Test HTTPS:

```bash
curl https://<duckdns-domain>/api/conversations
```

Test auto renewal:

```bash
sudo certbot renew --dry-run
```

Từ lúc này backend production URL là:

```txt
https://<duckdns-domain>
```

---

## 20. Deploy frontend lên Vercel

### 20.1. Import project

1. Vào https://vercel.com
2. Add New Project.
3. Import GitHub repo.
4. Chọn root directory:

```txt
frontend
```

5. Framework preset: Vite.
6. Build command:

```txt
npm run build
```

7. Output directory:

```txt
dist
```

### 20.2. Set Vercel env

Trong Vercel project:

Settings -> Environment Variables.

Production:

```env
VITE_API_URL=https://<duckdns-domain>/api
VITE_SOCKET_URL=https://<duckdns-domain>
```

Sau khi thêm env, cần redeploy frontend.

### 20.3. Update backend `CLIENT_URL`

Sau khi Vercel deploy xong, lấy URL production, ví dụ:

```txt
https://serene-chat.vercel.app
```

SSH vào EC2:

```bash
cd /opt/realtime-chat
nano backend.env
```

Update:

```env
CLIENT_URL=https://serene-chat.vercel.app
```

Restart backend container:

```bash
docker compose --env-file deploy.env -f docker-compose.prod.yml up -d
```

Nếu đổi custom domain Vercel sau này, phải update lại `CLIENT_URL`.

---

## 21. Full deploy order recommended

Làm theo thứ tự này để ít lỗi nhất:

1. Tạo MongoDB Atlas cluster và connection string.
2. Tạo Cloudinary credentials.
3. Tạo ECR repository.
4. Tạo EC2 + Security Group + Elastic IP.
5. Tạo DuckDNS domain trỏ về EC2 IP.
6. Cài Docker, AWS CLI, Nginx trên EC2.
7. Tạo IAM role cho EC2 pull ECR.
8. Tạo `/opt/realtime-chat/backend.env`.
9. Tạo `/opt/realtime-chat/deploy.env`.
10. Tạo `/opt/realtime-chat/docker-compose.prod.yml`.
11. Tạo `backend/Dockerfile` và `backend/.dockerignore` trong repo.
12. Tạo GitHub OIDC role cho Actions push ECR.
13. Tạo GitHub variables/secrets.
14. Tạo `.github/workflows/deploy-backend.yml`.
15. Push code lên `main` để GitHub Actions build/push/deploy backend.
16. Config Nginx reverse proxy HTTP.
17. Cấp HTTPS bằng Certbot.
18. Deploy frontend lên Vercel.
19. Update `CLIENT_URL` trong `backend.env`.
20. Test toàn bộ app production.

---

## 22. Test checklist sau deploy

### 22.1. Backend container

Trên EC2:

```bash
docker ps
docker logs -f realtime-chat-api
```

Cần thấy log:

```txt
Server started on port: 5001
```

### 22.2. Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
```

### 22.3. HTTPS

```bash
curl -I https://<duckdns-domain>
```

### 22.4. Auth

Trên browser:

1. Mở Vercel URL.
2. Signup hoặc signin.
3. Mở DevTools -> Network.
4. Kiểm tra response signin có `Set-Cookie`.
5. Cookie refresh token phải có:
   - `HttpOnly`
   - `Secure`
   - `SameSite=None`

### 22.5. Realtime features

Test 2 account khác nhau:

- Online users.
- Direct message realtime.
- Group message realtime.
- Typing indicator.
- Friend request notification.
- Seen/delivered status.

### 22.6. Upload image/avatar

Test:

- Upload avatar.
- Gửi tin nhắn có ảnh.
- Ảnh hiện đúng trong UI.
- Kiểm tra Cloudinary dashboard có asset mới.

---

## 23. Troubleshooting

### 23.1. `502 Bad Gateway`

Nguyên nhân thường gặp:

- Container backend chưa chạy.
- Backend crash vì thiếu env.
- Nginx proxy sai port.

Debug:

```bash
docker ps
docker logs realtime-chat-api
curl http://127.0.0.1:5001/api/conversations
sudo tail -f /var/log/nginx/error.log
```

### 23.2. CORS error

Kiểm tra:

```env
CLIENT_URL=https://<exact-vercel-url>
```

Không để trailing slash:

```txt
Sai:
https://example.vercel.app/

Đúng:
https://example.vercel.app
```

Sau khi sửa:

```bash
docker compose --env-file deploy.env -f docker-compose.prod.yml up -d
```

### 23.3. Cookie không được lưu

Kiểm tra:

- Backend có HTTPS chưa.
- Frontend request có `withCredentials: true` chưa. Project hiện tại đã có trong Axios.
- Backend CORS có `credentials: true` chưa. Project hiện tại đã có.
- `CLIENT_URL` có khớp exact frontend URL không.
- Cookie có `SameSite=None` và `Secure` không.

Nếu login được nhưng logout không xóa cookie, sửa `clearCookie` như section 2.4.

### 23.4. Socket.IO không connect

Kiểm tra Vercel env:

```env
VITE_SOCKET_URL=https://<duckdns-domain>
```

Không thêm `/api`.

Kiểm tra Nginx có:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Xem browser DevTools -> Network -> WS.

Xem backend logs:

```bash
docker logs -f realtime-chat-api
```

### 23.5. Upload ảnh bị `413 Payload Too Large`

Thêm vào Nginx server block:

```nginx
client_max_body_size 10M;
```

Reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Backend multer hiện giờ giới hạn 5MB, nên 10MB trên Nginx là đủ cho overhead request.

### 23.6. MongoDB connection fail

Kiểm tra:

- `MONGODB_CONNECTIONSTRING` đúng username/password.
- Password có ký tự đặc biệt thì cần URL encode.
- Atlas Network Access đã whitelist EC2 IP.
- EC2 có internet outbound.

Debug:

```bash
docker logs realtime-chat-api
```

### 23.7. Cloudinary upload fail

Kiểm tra:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- Cloudinary quota.
- File upload có vượt 5MB không.

### 23.8. ECR pull fail trên EC2

Kiểm tra EC2 IAM role:

```bash
aws sts get-caller-identity
```

Login ECR:

```bash
aws ecr get-login-password --region <aws-region> | \
  docker login --username AWS --password-stdin <aws-account-id>.dkr.ecr.<aws-region>.amazonaws.com
```

Kiểm tra image URI trong `deploy.env`.

### 23.9. GitHub Actions fail vì AWS permission

Kiểm tra:

- `permissions: id-token: write` trong workflow.
- `AWS_ROLE_TO_ASSUME` đúng ARN role.
- Trust policy đúng owner/repo/branch.
- ECR policy có `ecr:PutImage`, `ecr:UploadLayerPart`, `ecr:GetAuthorizationToken`.

### 23.10. GitHub Actions SSH fail

Kiểm tra:

- `EC2_HOST` đúng IP/domain.
- Security Group cho SSH port 22 cho GitHub Actions. Vì GitHub Actions IP thay đổi, để đơn giản có thể tạm mở SSH `0.0.0.0/0`, nhưng không nên để lâu.
- `EC2_SSH_KEY` đúng private key.
- User là `ubuntu`.

Gợi ý an toàn hơn:

- Dùng self-hosted runner trên EC2.
- Hoặc dùng AWS SSM thay SSH.
- Với portfolio/demo, SSH qua GitHub Actions là cách dễ hiểu và dễ trình bày nhất.

---

## 24. Bảo trì và update production

### 24.1. Deploy code backend mới

Push code lên branch `main`.

GitHub Actions sẽ:

1. Build Docker image.
2. Push image lên ECR.
3. SSH vào EC2.
4. Pull image mới.
5. Restart container.

### 24.2. Xem logs

```bash
docker logs -f realtime-chat-api
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 24.3. Restart manually

```bash
cd /opt/realtime-chat
docker compose --env-file deploy.env -f docker-compose.prod.yml restart backend
```

### 24.4. Rollback image

Nếu deploy mới lỗi, có thể quay về image tag cũ.

Sửa `IMAGE_TAG` trong `deploy.env`:

```env
IMAGE_TAG=<old-git-sha>
```

Restart:

```bash
docker compose --env-file deploy.env -f docker-compose.prod.yml pull backend
docker compose --env-file deploy.env -f docker-compose.prod.yml up -d
```

---

## 25. Cleanup để tránh mất phí

Khi không cần demo nữa:

1. Vercel: có thể giữ free project nếu muốn.
2. EC2: stop hoặc terminate instance.
3. Elastic IP: release nếu không dùng.
4. ECR: xóa image cũ nếu không cần.
5. Cloudinary: xóa asset test nếu vượt quota.
6. MongoDB Atlas: pause/delete cluster nếu không cần.

Lệnh cleanup Docker trên EC2:

```bash
docker system df
docker image prune -a
```

Cẩn thận: `docker image prune -a` xóa các image không được container nào dùng.

---

## 26. Sources

- AWS ECR push image: https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html
- AWS ECR login GitHub Action: https://github.com/aws-actions/amazon-ecr-login
- AWS configure credentials GitHub Action: https://github.com/aws-actions/configure-aws-credentials
- Docker Engine on Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- Docker GitHub Actions: https://docs.docker.com/build/ci/github-actions/
- Docker Compose up: https://docs.docker.com/reference/cli/docker/compose/up/
- Docker Compose pull: https://docs.docker.com/reference/cli/docker/compose/pull/
- Nginx WebSocket proxy: https://nginx.org/en/docs/http/websocket.html
- Vercel Vite docs: https://vercel.com/docs/frameworks/frontend/vite
- GitHub Actions secrets: https://docs.github.com/en/actions/concepts/security/secrets
- DuckDNS Linux cron: https://www.duckdns.org/install.jsp?tab=linux-cron
