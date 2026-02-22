# React 완전 정복 강의 노트
> HUD Admin Template 프로젝트 기반 실습 가이드

**대상**: JavaScript/TypeScript 기초 지식 보유, React 입문자

---

## 목차
1. [React 소개 및 프로젝트 구조](#chapter-1-react-소개-및-프로젝트-구조)
2. [컴포넌트 기초](#chapter-2-컴포넌트-기초)
3. [JSX 문법](#chapter-3-jsx-문법)
4. [Props와 TypeScript](#chapter-4-props와-typescript)
5. [State와 useState Hook](#chapter-5-state와-usestate-hook)
6. [이벤트 처리](#chapter-6-이벤트-처리)
7. [조건부 렌더링](#chapter-7-조건부-렌더링)
8. [리스트와 Key](#chapter-8-리스트와-key)
9. [React Router](#chapter-9-react-router)
10. [컴포넌트 구조화와 레이아웃](#chapter-10-컴포넌트-구조화와-레이아웃)

---

## Chapter 1: React 소개 및 프로젝트 구조

### 1.1 React란?
React는 Facebook(현 Meta)에서 개발한 **UI 라이브러리**입니다. 
- **컴포넌트 기반**: UI를 독립적이고 재사용 가능한 조각으로 분리
- **선언적**: 원하는 UI 상태를 선언하면 React가 DOM을 업데이트
- **Virtual DOM**: 효율적인 렌더링을 위한 가상 DOM 활용

### 1.2 프로젝트 구조 이해

```
teamProjectTemplate001/
├── src/                    # 소스 코드 폴더
│   ├── main.tsx           # 앱 진입점
│   ├── App.tsx            # 루트 컴포넌트
│   ├── index.css          # 전역 스타일
│   ├── components/        # 재사용 가능한 컴포넌트
│   │   ├── common/        # 공통 컴포넌트 (Button, Card 등)
│   │   └── layout/        # 레이아웃 컴포넌트 (Header, Sidebar)
│   ├── layouts/           # 페이지 레이아웃
│   └── pages/             # 각 페이지 컴포넌트
├── index.html             # HTML 템플릿
├── package.json           # 의존성 관리
├── vite.config.ts         # Vite 설정
└── tsconfig.json          # TypeScript 설정
```

### 1.3 React 앱의 시작점 (main.tsx)

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
```

**핵심 개념:**
- `createRoot`: React 18의 새로운 루트 API
- `document.getElementById('root')!`: HTML의 root 요소를 찾음 (`!`는 TypeScript의 non-null assertion)
- `StrictMode`: 개발 중 잠재적 문제를 감지하는 도구
- `<App />`: 루트 컴포넌트를 렌더링

---

## Chapter 2: 컴포넌트 기초

### 2.1 컴포넌트란?
컴포넌트는 **UI의 독립적인 조각**입니다. 레고 블록처럼 조합하여 복잡한 UI를 구성합니다.

### 2.2 함수형 컴포넌트 (Function Component)

```tsx
// 가장 기본적인 형태
const Dashboard = () => {
    return (
        <div>
            <h1>Dashboard</h1>
        </div>
    )
}

export default Dashboard
```

**규칙:**
1. 컴포넌트 이름은 **대문자**로 시작 (Pascal Case)
2. 반드시 **JSX를 반환**해야 함
3. `export default`로 다른 파일에서 사용 가능하게 내보냄

### 2.3 화살표 함수 vs 일반 함수

```tsx
// 화살표 함수 (권장)
const Button = () => {
    return <button>Click me</button>
}

// 일반 함수
function Button() {
    return <button>Click me</button>
}
```

> 💡 현대 React에서는 화살표 함수가 더 많이 사용됩니다.

---

## Chapter 3: JSX 문법

### 3.1 JSX란?
JSX는 JavaScript XML의 약자로, **JavaScript 안에서 HTML처럼 작성**할 수 있게 해주는 문법입니다.

### 3.2 JSX 핵심 규칙

#### 규칙 1: 하나의 부모 요소로 감싸기
```tsx
// ❌ 잘못된 예
return (
    <h1>Title</h1>
    <p>Paragraph</p>
)

// ✅ 올바른 예
return (
    <div>
        <h1>Title</h1>
        <p>Paragraph</p>
    </div>
)

// ✅ Fragment 사용 (불필요한 div 방지)
return (
    <>
        <h1>Title</h1>
        <p>Paragraph</p>
    </>
)
```

#### 규칙 2: JavaScript 표현식은 중괄호 사용
```tsx
const name = "Admin User"
const count = 42

return (
    <div>
        <p>Hello, {name}!</p>
        <p>Count: {count}</p>
        <p>Sum: {1 + 2 + 3}</p>
        <p>Uppercase: {name.toUpperCase()}</p>
    </div>
)
```

#### 규칙 3: class 대신 className 사용
```tsx
// HTML에서는 class, JSX에서는 className
<div className="container">
    <button className="btn btn-primary">Click</button>
</div>
```

#### 규칙 4: 스타일은 객체로 전달
```tsx
// 인라인 스타일
<div style={{ backgroundColor: 'blue', fontSize: '16px' }}>
    Styled content
</div>
```

### 3.3 실제 프로젝트 예시 (Dashboard.tsx)
```tsx
<div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold text-hud-text-primary">Dashboard</h1>
            <p className="text-hud-text-muted mt-1">Welcome back!</p>
        </div>
    </div>
</div>
```

---

## Chapter 4: Props와 TypeScript

### 4.1 Props란?
Props는 **부모 컴포넌트에서 자식 컴포넌트로 데이터를 전달**하는 방법입니다.

### 4.2 Props 기본 사용법

```tsx
// 부모 컴포넌트
<StatCard 
    title="Total Revenue"
    value="$54,239"
    change={12.5}
/>

// 자식 컴포넌트
const StatCard = ({ title, value, change }) => {
    return (
        <div>
            <p>{title}</p>
            <p>{value}</p>
            <p>{change}%</p>
        </div>
    )
}
```

### 4.3 TypeScript로 Props 타입 정의

```tsx
// src/components/common/StatCard.tsx

// Props 타입을 interface로 정의
interface StatCardProps {
    title: string                                          // 필수 속성
    value: string | number                                 // 여러 타입 허용
    change?: number                                        // 선택적 속성 (?)
    changeLabel?: string
    icon?: ReactNode                                       // React 요소 타입
    variant?: 'default' | 'primary' | 'secondary'         // 유니온 타입으로 제한
}

const StatCard = ({
    title,
    value,
    change,
    changeLabel = 'vs last month',  // 기본값 설정
    icon,
    variant = 'default',
}: StatCardProps) => {
    // ...
}
```

### 4.4 고급 Props 패턴 (Button.tsx)

```tsx
import { ReactNode, ButtonHTMLAttributes } from 'react'

// HTML 버튼의 모든 속성을 상속받으면서 커스텀 Props 추가
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode        // 버튼 내용
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    glow?: boolean
    fullWidth?: boolean
    leftIcon?: ReactNode
    rightIcon?: ReactNode
}

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    glow = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className = '',
    ...props  // 나머지 모든 속성 (onClick, disabled 등)
}: ButtonProps) => {
    return (
        <button className={`${baseStyles} ${className}`} {...props}>
            {leftIcon && <span>{leftIcon}</span>}
            {children}
            {rightIcon && <span>{rightIcon}</span>}
        </button>
    )
}
```

**핵심 포인트:**
- `ReactNode`: 모든 렌더링 가능한 React 요소 타입
- `...props`: 나머지 속성을 spread operator로 전달
- `extends ButtonHTMLAttributes`: 기존 HTML 속성 상속

---

## Chapter 5: State와 useState Hook

### 5.1 State란?
State는 **컴포넌트 내부에서 관리하는 변경 가능한 데이터**입니다.
- Props: 외부에서 전달받는 읽기 전용 데이터
- State: 내부에서 관리하는 변경 가능한 데이터

### 5.2 useState 기본 사용법

```tsx
import { useState } from 'react'

const Settings = () => {
    // [현재값, 변경함수] = useState(초기값)
    const [darkMode, setDarkMode] = useState(true)
    const [activeSection, setActiveSection] = useState('profile')
    
    return (
        <div>
            <p>Dark Mode: {darkMode ? 'ON' : 'OFF'}</p>
            <button onClick={() => setDarkMode(!darkMode)}>
                Toggle
            </button>
        </div>
    )
}
```

### 5.3 다양한 타입의 State

```tsx
// 문자열
const [name, setName] = useState('')

// 숫자
const [count, setCount] = useState(0)

// 불리언
const [isOpen, setIsOpen] = useState(false)

// 배열 (TypeScript 타입 명시)
const [files, setFiles] = useState<string[]>([])

// 객체
const [user, setUser] = useState({ name: '', email: '' })
```

### 5.4 배열 State 업데이트 (FormElements.tsx)

```tsx
const [files, setFiles] = useState<string[]>([])

// 배열에 항목 추가
const handleFileUpload = () => {
    setFiles([...files, `file_${files.length + 1}.pdf`])
}

// 배열에서 항목 제거
const handleRemoveFile = (indexToRemove: number) => {
    setFiles(files.filter((_, idx) => idx !== indexToRemove))
}
```

> ⚠️ **중요**: State는 직접 수정하면 안 됩니다!
> ```tsx
> // ❌ 잘못된 예
> files.push('newFile.pdf')
> 
> // ✅ 올바른 예
> setFiles([...files, 'newFile.pdf'])
> ```

### 5.5 실제 프로젝트 예시 (MainLayout.tsx)

```tsx
const MainLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div>
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className={sidebarCollapsed ? 'ml-20' : 'ml-64'}>
                {/* ... */}
            </div>
        </div>
    )
}
```

---

## Chapter 6: 이벤트 처리

### 6.1 기본 이벤트 핸들러

```tsx
// 클릭 이벤트
<button onClick={() => console.log('clicked!')}>
    Click me
</button>

// 함수 참조로 전달
const handleClick = () => {
    console.log('clicked!')
}
<button onClick={handleClick}>Click me</button>
```

### 6.2 이벤트 객체 사용

```tsx
// 입력값 가져오기
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value)
}
<input onChange={handleChange} />

// 폼 제출 시 기본 동작 방지
const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // 폼 처리 로직
}
<form onSubmit={handleSubmit}>...</form>
```

### 6.3 자주 사용하는 이벤트들

| 이벤트 | 설명 | 예시 |
|--------|------|------|
| `onClick` | 클릭 시 | 버튼, 링크 |
| `onChange` | 값 변경 시 | input, select |
| `onSubmit` | 폼 제출 시 | form |
| `onFocus` | 포커스 시 | input |
| `onBlur` | 포커스 해제 시 | input |
| `onMouseEnter` | 마우스 진입 시 | hover 효과 |
| `onMouseLeave` | 마우스 떠날 시 | hover 효과 |

### 6.4 실제 프로젝트 예시 (FormElements.tsx)

```tsx
const [showPassword, setShowPassword] = useState(false)

<button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
>
    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
</button>
<input type={showPassword ? 'text' : 'password'} />
```

---

## Chapter 7: 조건부 렌더링

### 7.1 && 연산자

조건이 true일 때만 요소를 렌더링합니다.

```tsx
{change !== undefined && (
    <div className="flex items-center">
        <span>{change}%</span>
    </div>
)}
```

### 7.2 삼항 연산자

조건에 따라 다른 요소를 렌더링합니다.

```tsx
{isPositive ? (
    <TrendingUp className="text-green-500" />
) : (
    <TrendingDown className="text-red-500" />
)}
```

### 7.3 실제 프로젝트 예시 (Settings.tsx)

```tsx
const [activeSection, setActiveSection] = useState('profile')

{/* 프로필 섹션이 활성화되었을 때만 렌더링 */}
{activeSection === 'profile' && (
    <HudCard title="Profile Settings">
        {/* 프로필 내용 */}
    </HudCard>
)}

{activeSection === 'notifications' && (
    <HudCard title="Notification Preferences">
        {/* 알림 설정 내용 */}
    </HudCard>
)}

{activeSection === 'appearance' && (
    <HudCard title="Appearance">
        {/* 테마 선택 */}
        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
    </HudCard>
)}
```

### 7.4 조건부 클래스명

```tsx
<button
    className={`w-full flex items-center gap-3 px-4 py-3 ${
        activeSection === section.id
            ? 'bg-hud-accent-primary/10 text-hud-accent-primary'
            : 'text-hud-text-secondary hover:bg-hud-bg-hover'
    }`}
>
    {section.label}
</button>
```

---

## Chapter 8: 리스트와 Key

### 8.1 map()으로 리스트 렌더링

배열 데이터를 React 요소 리스트로 변환합니다.

```tsx
const recentOrders = [
    { id: '#ORD-001', customer: 'John Doe', amount: '$1,299.00' },
    { id: '#ORD-002', customer: 'Jane Smith', amount: '$899.00' },
]

{recentOrders.map((order) => (
    <tr key={order.id}>
        <td>{order.id}</td>
        <td>{order.customer}</td>
        <td>{order.amount}</td>
    </tr>
))}
```

### 8.2 Key의 중요성

Key는 React가 **어떤 항목이 변경, 추가, 삭제되었는지 식별**하는 데 사용됩니다.

```tsx
// ✅ 고유한 ID를 key로 사용
{items.map(item => <li key={item.id}>{item.name}</li>)}

// ⚠️ 인덱스는 최후의 수단 (항목 순서가 변하지 않을 때만)
{items.map((item, index) => <li key={index}>{item}</li>)}
```

### 8.3 실제 프로젝트 예시들

**차트 데이터 렌더링 (Dashboard.tsx):**
```tsx
{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => {
    const heights = [40, 55, 45, 60, 75, 65, 80, 70, 85, 75, 90, 95]
    return (
        <div key={month} className="flex-1 flex flex-col items-center">
            <div style={{ height: `${heights[i]}%` }} />
            <span>{month}</span>
        </div>
    )
})}
```

**설정 메뉴 렌더링 (Settings.tsx):**
```tsx
const settingsSections = [
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    // ...
]

{settingsSections.map((section) => (
    <button
        key={section.id}
        onClick={() => setActiveSection(section.id)}
    >
        {section.icon}
        <span>{section.label}</span>
    </button>
))}
```

---

## Chapter 9: React Router

### 9.1 React Router란?
React 애플리케이션에서 **페이지 간 이동(라우팅)**을 담당하는 라이브러리입니다.

### 9.2 기본 설정 (App.tsx)

```tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
    return (
        <Router>
            <Routes>
                {/* 독립 페이지 (레이아웃 없음) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* 레이아웃이 적용된 페이지들 */}
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route path="settings" element={<Settings />} />
                    
                    {/* 중첩 라우트 */}
                    <Route path="email/inbox" element={<EmailInbox />} />
                    <Route path="email/compose" element={<EmailCompose />} />
                    
                    {/* 동적 파라미터 */}
                    <Route path="email/detail/:id" element={<EmailDetail />} />
                </Route>
                
                {/* 404 페이지 */}
                <Route path="*" element={<Error404 />} />
            </Routes>
        </Router>
    )
}
```

### 9.3 핵심 개념

| 요소 | 설명 |
|------|------|
| `BrowserRouter` | 라우터의 최상위 컨테이너 |
| `Routes` | Route들의 컨테이너 |
| `Route` | 경로와 컴포넌트 매핑 |
| `path` | URL 경로 |
| `element` | 렌더링할 컴포넌트 |
| `index` | 부모 경로에서 기본으로 보여줄 자식 |
| `:id` | 동적 URL 파라미터 |

### 9.4 중첩 라우트와 Outlet

```tsx
// MainLayout.tsx
import { Outlet } from 'react-router-dom'

const MainLayout = () => {
    return (
        <div>
            <Sidebar />
            <Header />
            <main>
                {/* 자식 라우트가 여기에 렌더링됨 */}
                <Outlet />
            </main>
        </div>
    )
}
```

---

## Chapter 10: 컴포넌트 구조화와 레이아웃

### 10.1 컴포넌트 분리 원칙

**작은 단위로 분리:**
```
components/
├── common/           # 어디서나 재사용 가능
│   ├── Button.tsx    # 범용 버튼
│   ├── HudCard.tsx   # 카드 컨테이너
│   └── StatCard.tsx  # 통계 카드
└── layout/           # 레이아웃 전용
    ├── Header.tsx    # 헤더
    └── Sidebar.tsx   # 사이드바
```

### 10.2 Props로 컴포넌트 연결 (MainLayout.tsx)

```tsx
const MainLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div>
            {/* State를 자식에게 전달 */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            
            {/* State에 따라 스타일 변경 */}
            <div className={sidebarCollapsed ? 'ml-20' : 'ml-64'}>
                <Header onMenuToggle={() => setSidebarCollapsed(!s)} />
                <main>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
```

### 10.3 컴포넌트 조합 패턴 (Dashboard.tsx)

```tsx
const Dashboard = () => {
    return (
        <div className="space-y-6">
            {/* 통계 카드 그리드 */}
            <div className="grid grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value="$54,239" />
                <StatCard title="Total Users" value="3,842" />
            </div>
            
            {/* 카드 안에 콘텐츠 배치 */}
            <HudCard title="Recent Orders">
                <table>...</table>
            </HudCard>
            
            {/* 버튼에 아이콘 조합 */}
            <Button variant="primary" leftIcon={<Activity />}>
                View Reports
            </Button>
        </div>
    )
}
```

---

## 학습 체크리스트

- [ ] 컴포넌트를 생성하고 export/import할 수 있다
- [ ] JSX 문법 규칙을 이해하고 적용할 수 있다
- [ ] Props를 정의하고 전달할 수 있다
- [ ] TypeScript로 Props 타입을 정의할 수 있다
- [ ] useState로 상태를 관리할 수 있다
- [ ] 이벤트 핸들러를 작성할 수 있다
- [ ] 조건부 렌더링을 구현할 수 있다
- [ ] map()으로 리스트를 렌더링할 수 있다
- [ ] React Router로 페이지 라우팅을 설정할 수 있다
- [ ] 컴포넌트를 논리적으로 분리하고 조합할 수 있다

---

## 다음 단계 (심화 학습)

이 강의 노트를 마스터했다면 다음 단계로 넘어가세요:

1. ✅ **[`React_심화_강의노트.md`](React_심화_강의노트.md)** — useEffect, useContext, Custom Hooks, useReducer, React Query/SWR
2. ✅ **[`TypeScript_강의노트.md`](TypeScript_강의노트.md)** — TypeScript 완전 정복
3. ✅ **[`state-management/state-management-guide.md`](state-management/state-management-guide.md)** — Zustand, Redux Toolkit 심화
4. ✅ **[`ssr-nextjs-guide.md`](ssr-nextjs-guide.md)** — SSR & Next.js 완전 정복
5. ⏭️ **[`React_실전_전문가코스_Complete.md`](React_실전_전문가코스_Complete.md)** — 실전 프로젝트
