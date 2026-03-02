lsof -ti:5173,3001 | xargs kill -9 2>/dev/null; echo "포트 정리 완료"


## Railway 배포
```bash
# 로그인
railway login --browserless

# 프로젝트 연결 (이미 생성된 경우)
railway link

# 배포 (현재 코드를 Railway에 업로드)
railway up --detach

# 환경변수 확인
railway variables

# 환경변수 설정
railway variables set KEY=value

# 로그 확인
railway logs

# 상태 확인
railway status

# 도메인 생성
railway domain
```