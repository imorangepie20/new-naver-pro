# SSR & Next.js 완전 정복 가이드
> React SPA를 넘어 서버 사이드 렌더링�까지

**대상**: React SPA 경험 있으며, SSR/Next.js를 배우고 싶은 개발자
**선수 지식**: `React_강의노트.md`, `React_심화_강의노트.md` 학습 완료

---

## 목차

1. [CSR vs SSR: 무엇이 다른가?](#chapter-1-csr-vs-ssr-무엇이-다른가)
2. [Next.js 기본](#chapter-2-nextjs-기본)
3. [App Router (Next.js 13+)](#chapter-3-app-router-nextjs-13)
4. [Data Fetching](#chapter-4-data-fetching)
5. [Server Components](#chapter-5-server-components)
6. [성능 최적화](#chapter-6-성능-최적화)
7. [배포](#chapter-7-배포)

---

## Chapter 1: CSR vs SSR: 무엇이 다른가?

### 1.1 CSR (Client-Side Rendering)

React SPA(Single Page Application)의 기본 방식입니다.

```
사용자 접속
    ↓
빈 HTML + JS 파일 다운로드
    ↓
React 앱 실행 (로딩 화면...)
    ↓
API 호출 → 데이터 수신
    ↓
화면 렌더링
```

**장점:**
- 페이지 전환 없는 부드한 UX
- 클라이언트 상호작용이 풍부한 앱
- 프론트엔드 중심 개발

**단점:**
- **SEO 문제**: 검색 엔진이 빈 HTML을 크롤링 못 함
- **느린 초기 로딩**: JS 실행 전까지 빈 화면
- **클라이언 부담**: 모든 처리를 브라우저가 담당

### 1.2 SSR (Server-Side Rendering)

서버에서 HTML을 렌더링�하는 방식입니다.

```
사용자 접속
    ↓
서버에서 HTML 렌더링� (데이터까지 포함)
    ↓
완성된 HTML 전송 (이미 콘텐츠가 있음!)
    ↓
브라우저가 즉시 표시
    ↓
React hydrate (이벤트 리스너 등록)
```

**장점:**
- **SEO 우수**: 검색 엔진이 크롤링 잘 함
- **빠른 첫 화면**: 서버에서 렌더링된 HTML을 즉시 표시
- **소셜 미리보기**: Open Graph 태그 등

**단점:**
- 서버 부하 증가
- 페이지 전환 시 깜빡임 (처음만 빠름)
- 개발 복잡도 증가

### 1.3 SSG (Static Site Generation)

빌드 시점에 HTML을 미리 생성하는 방식입니다.

```
빌드 타임
    ↓
모든 페이지 HTML 미리 생성
    ↓
CDN에 배포
    ↓
사용자 접속 → 즉시 HTML 제공 (가장 빠름!)
```

**장점:**
- **최고 성능**: CDN에서 정적 파일 제공
- **비용 효율**: 서버 필요 없음
- **안정성**: 정적 파일이므로 안전

**단점:**
- 동적 콘텐츠 어려움
- 빌드 시 모든 페이지 생성 (빌드 시간 길어짐)

### 1.4 ISR (Incremental Static Regeneration)

SSG + SSR의 하이브리드 방식입니다.

```
빌드 타임
    ↓
일부 페이지 미리 생성
    ↓
사용자 요청
    ↓
1. 캐시된 HTML 반환 (빠름)
2. 백그라운드에서 재생성 ( stale-while-revalidate)
    ↓
다음 요청부터 새 HTML 제공
```

---

## Chapter 2: Next.js 기본

### 2.1 Next.js란?

Vercel 팀이 만든 **React 기반 SSR 프레임워크**입니다.

| 특징 | 설명 |
|---|---|
| **Zero Config** | 설정 없이 바로 시작 가능 |
| **File-based Routing** | 파일 경로 = URL 경로 |
| **API Routes** | /api/*로 백엔드 API 작성 |
| **Built-in Image Optimization** | 자동 이미지 최적화 |
| **Fast Refresh** | 에디터 저장 시 즉시 반영 |

### 2.2 설치

```bash
npx create-next-app@latest my-app
cd my-app
npm run dev
```

### 2.3 프로젝트 구조

```
my-app/
├── app/                    # App Router (Next.js 13+)
│   ├── (root)/page.tsx     # / (홈페이지)
│   ├── about/page.tsx     # /about
│   └── blog/
│       ├── page.tsx         # /blog
│       └── [id]/page.tsx    # /blog/123
├── components/
├── public/                # 정적 파일
└── lib/                   # 유틸리티 함수
```

---

## Chapter 3: App Router (Next.js 13+)

Next.js 13부터 도입된 새로운 라우터입니다.

### 3.1 라우팅 규칙

```
파일 경로                    →  URL 경로
app/page.tsx               →  /
app/about/page.tsx         →  /about
app/blog/[id]/page.tsx     →  /blog/123
app/dashboard/settings/page.tsx →  /dashboard/settings
```

### 3.2 기본 페이지

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main>
      <h1>Welcome to my app!</h1>
    </main>
  )
}
```

### 3.3 동적 라우트

```tsx
// app/blog/[id]/page.tsx
interface Props {
  params: { id: string }
}

export default function BlogPost({ params }: Props) {
  return <div>Blog post #{params.id}</div>
}
```

---

## Chapter 4: Data Fetching

### 4.1 Server Components에서 데이터 가져오기

```tsx
// app/users/page.tsx
async function fetchUsers() {
  const res = await fetch('https://api.example.com/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

export default async function UsersPage() {
  const users = await fetchUsers()

  return (
    <ul>
      {users.map((user: { id: string; name: string }) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
}
```

### 4.2 강제 로딩 & 스트리밍

```tsx
// app/products/page.tsx
export const revalidate = 3600 // 재생성 주기 (초)

export async function generateStaticParams() {
  // 빌드 타임에 생성할 경로
  return [{ id: '1' }, { id: '2' }, { id: '3' }]
}

interface Props {
  params: { id: string }
}

export default async function ProductPage({ params }: Props) {
  const product = await fetch(`https://api.example.com/products/${params.id}`)
    .then((res) => res.json())

  return <div>Product: {product.name}</div>
}
```

---

## Chapter 5: Server Components

### 5.1 Server vs Client Components

```tsx
// 📌 Server Component (기본)
export default async function Page() {
  const data = await fetch('...').then(r => r.json())
  return <div>{data.name}</div>
}

// 📌 Client Component ('use client' 지시)
'use client'
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### 5.2 언제 Client Component가 필요한가?

| 상황 | 컴포넌트 타입 |
|---|---|
| 데이터 가져오기 | Server |
| useState, useEffect 사용 | Client |
| 이벤트 핸들러 (onClick 등) | Client |
| 브라우저 API 사용 | Client |
| Third-party 라이브러리 (차트, 애니메이션) | Client |

---

## Chapter 6: 성능 최적화

### 6.1 Image Optimization

```tsx
import Image from 'next/image'

export default function Page() {
  return (
    <Image
      src="/hero.png"
      alt="Hero"
      width={800}
      height={600}
      priority // LCP 이미지
    />
  )
}
```

### 6.2 Font Optimization

```tsx
import { Geist, Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### 6.3 Script 최적화

```tsx
import Script from 'next/script'

export default function Page() {
  return (
    <>
      <Script
        src="https://third-party.com/script.js"
        strategy="afterInteractive"
      />
    </>
  )
}
```

---

## Chapter 7: 배포

### 7.1 Vercel (추천)

```bash
npm install -g vercel
vercel
```

### 7.2 Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs /app/.next/standalone ./
EXPOSE 3000

CMD ["node", "server.js"]
```

### 7.3 Vercel 이외의 호스팅

- **Netlify**: netlify.toml 설정
- **AWS Amplify**: CLI 배포
- **Self-hosted**: Docker, Node.js

---

## 추가 학습 자료

- **Next.js 공식 문서**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **Next.js Learn**: [https://nextjs.org/learn](https://nextjs.org/learn)
- **Vercel 배포 가이드**: [https://vercel.com/docs](https://vercel.com/docs)

---

**다음 학습 순서**:
1. ✅ `React_강의노트.md` - React 기초
2. ✅ `React_심화_강의노트.md` - React 심화
3. ✅ `TypeScript_강의노트.md` - TypeScript
4. ✅ `state-management/state-management-guide.md` - Zustand, Redux Toolkit
5. ✅ **이 문서** - SSR & Next.js
6. ⏭️ `React_실전_전문가코스_Complete.md` - 실전 프로젝트
