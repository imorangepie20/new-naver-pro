# Nginx 배포 가이드

기존 Nginx 서버에서 프론트(`dist`)와 API(`/api`)를 함께 서비스하는 기준입니다.

## 1. 서버 준비

```bash
# 프로젝트 경로 예시
cd /opt/imapplepieTemplate001

# 의존성 설치
npm ci

# 프론트 빌드
npm run build
```

프로덕션 환경변수 파일 준비:

```bash
cp .env.production.example .env.production
vi .env.production
```

필수 항목:
- `DATABASE_URL`
- `JWT_SECRET`
- `REB_OPEN_API_KEY`

## 2. API(systemd) 등록

서비스 파일 복사:

```bash
sudo cp deploy/systemd/imapplepie-api.service /etc/systemd/system/
```

아래 항목을 서버 값으로 수정:
- `User`, `Group`
- `WorkingDirectory`

서비스 시작:

```bash
sudo systemctl daemon-reload
sudo systemctl enable imapplepie-api
sudo systemctl restart imapplepie-api
sudo systemctl status imapplepie-api
```

로그 확인:

```bash
journalctl -u imapplepie-api -f
```

## 3. Nginx 설정

설정 파일 복사:

```bash
sudo cp deploy/nginx/imapplepieTemplate001.conf /etc/nginx/sites-available/imapplepieTemplate001.conf
```

아래 항목을 서버 값으로 수정:
- `server_name`
- `root` (프로젝트 `dist` 절대경로)

심볼릭 링크 및 반영:

```bash
sudo ln -sf /etc/nginx/sites-available/imapplepieTemplate001.conf /etc/nginx/sites-enabled/imapplepieTemplate001.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 점검

```bash
curl -I http://127.0.0.1:3001/api/health
curl -I http://YOUR_DOMAIN
curl http://YOUR_DOMAIN/api/health
```

정상 기대값:
- `/` -> `dist/index.html`
- `/api/*` -> Bun API 응답

## 5. 갱신 배포

```bash
cd /opt/imapplepieTemplate001
git pull
npm ci
npm run build
sudo systemctl restart imapplepie-api
sudo systemctl reload nginx
```

