# React 심화 완전 정복 강의 노트
> React 기초 강의 노트의 후속편 — 실전 프로젝트 기반 심화 가이드

**대상**: React 기초(컴포넌트, Props, State, Router) 학습 완료자
**선수 지식**: `React_강의노트.md` Chapter 1~10

---

## 목차
1. [useEffect: 사이드 이펙트 처리](#chapter-1-useeffect-사이드-이펙트-처리)
2. [useContext: 전역 상태 관리](#chapter-2-usecontext-전역-상태-관리)
3. [Custom Hooks: 로직 재사용](#chapter-3-custom-hooks-로직-재사용)
4. [useReducer: 복잡한 상태 관리](#chapter-4-usereducer-복잡한-상태-관리)
5. [React Query / SWR: 서버 상태 관리](#chapter-5-react-query--swr-서버-상태-관리)
6. [상태 관리 라이브러리: Zustand, Redux Toolkit](#chapter-6-상태-관리-라이브러리-zustand-redux-toolkit)

---

## Chapter 1: useEffect — 사이드 이펙트 처리

### 1.1 사이드 이펙트(Side Effect)란?

React 컴포넌트는 **렌더링**, 즉 Props와 State를 기반으로 UI를 그리는 것이 본질입니다. 그 **외의 모든 작업**을 사이드 이펙트라고 합니다.

| 사이드 이펙트 종류 | 예시 |
|---|---|
| **API 호출** | 서버에서 데이터 가져오기 |
| **구독(Subscription)** | WebSocket, 이벤트 리스너 등록 |
| **DOM 직접 조작** | `document.title` 변경, 스크롤 위치 조작 |
| **타이머** | `setTimeout`, `setInterval` |
| **로컬 스토리지** | `localStorage.getItem/setItem` |

> 💡 **왜 분리하는가?** 렌더링 중에 API를 호출하면 무한 루프가 발생할 수 있습니다. `useEffect`는 **렌더링이 완료된 후** 사이드 이펙트를 안전하게 실행합니다.

### 1.2 useEffect 기본 문법

```tsx
import { useEffect } from 'react'

useEffect(() => {
    // 실행할 사이드 이펙트
    console.log('컴포넌트가 렌더링되었습니다!')

    return () => {
        // 정리(Cleanup) 함수 (선택적)
        console.log('정리 작업 실행!')
    }
}, [의존성1, 의존성2])  // 의존성 배열
```

**세 가지 구성 요소:**
1. **콜백 함수**: 실행할 사이드 이펙트 로직
2. **정리(Cleanup) 함수**: 컴포넌트 언마운트 또는 재실행 전 정리 작업 (return으로 반환)
3. **의존성 배열**: 이 값이 변할 때만 이펙트 재실행

### 1.3 의존성 배열에 따른 동작 차이

이것을 정확히 이해하는 것이 `useEffect` 마스터의 핵심입니다.

```tsx
// (1) 의존성 배열 없음 → 매 렌더링마다 실행
useEffect(() => {
    console.log('렌더링될 때마다 실행됩니다')
})

// (2) 빈 배열 → 마운트 시 1회만 실행
useEffect(() => {
    console.log('컴포넌트가 처음 나타날 때 1번만 실행')

    return () => {
        console.log('컴포넌트가 사라질 때 1번만 실행')
    }
}, [])

// (3) 의존성 있음 → 해당 값이 변경될 때만 실행
useEffect(() => {
    console.log(`userId가 ${userId}로 변경되었습니다`)
}, [userId])
```

> ⚠️ **주의**: 의존성 배열을 생략하면(1번 케이스), 상태 변경 → 렌더링 → useEffect 실행 → 상태 변경의 **무한 루프**에 빠질 수 있습니다!

### 1.4 실전 예시 ① — API 데이터 가져오기

가장 흔한 useEffect 사용 사례입니다.

```tsx
import { useState, useEffect } from 'react'

interface User {
    id: number
    name: string
    email: string
}

const UserProfile = ({ userId }: { userId: number }) => {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // 비동기 함수를 내부에서 선언 (useEffect 콜백 자체는 async가 될 수 없음!)
        const fetchUser = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await fetch(`/api/users/${userId}`)

                if (!response.ok) {
                    throw new Error('사용자를 찾을 수 없습니다')
                }

                const data: User = await response.json()
                setUser(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : '알 수 없는 오류')
            } finally {
                setLoading(false)
            }
        }

        fetchUser()
    }, [userId])  // userId가 바뀔 때마다 새로운 유저 정보를 가져옴

    if (loading) return <div className="animate-pulse">로딩 중...</div>
    if (error) return <div className="text-red-500">에러: {error}</div>
    if (!user) return null

    return (
        <div className="p-6 bg-hud-bg-card rounded-xl border border-hud-border">
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-hud-text-muted">{user.email}</p>
        </div>
    )
}
```

> ⚠️ **왜 `useEffect(async () => {...})` 로 쓰면 안 되나요?**
> `useEffect`의 콜백은 `undefined` 또는 **정리 함수(클린업)**를 반환해야 합니다. `async` 함수는 `Promise`를 반환하므로 React가 혼란에 빠집니다. 반드시 내부에 별도 async 함수를 선언하세요.

### 1.5 실전 예시 ② — 이벤트 리스너 등록 & 정리

```tsx
const WindowSize = () => {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    })

    useEffect(() => {
        // 이벤트 핸들러 정의
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        // 이벤트 리스너 등록
        window.addEventListener('resize', handleResize)

        // 🧹 정리(Cleanup): 컴포넌트 언마운트 시 리스너 제거
        return () => {
            window.removeEventListener('resize', handleResize)
        }
    }, [])  // 빈 배열 → 마운트 시 1번만 등록

    return (
        <p>
            현재 창 크기: {windowSize.width} × {windowSize.height}
        </p>
    )
}
```

> 💡 **Cleanup이 없으면?** 컴포넌트가 사라져도 이벤트 리스너가 계속 살아있어 **메모리 누수(Memory Leak)**가 발생합니다. 구독/리스너 등록 시 반드시 정리 함수를 작성하세요.

### 1.6 useEffect 의존성 배열 함정과 해결

```tsx
// ❌ 무한 루프 — 렌더링마다 새로운 객체/배열이 생성됨
useEffect(() => {
    fetchData(options)
}, [options])  // options = { page: 1, limit: 10 } 이 매 렌더링마다 새로 생성

// ✅ 해결 1: 원시값으로 분리
useEffect(() => {
    fetchData({ page, limit })
}, [page, limit])

// ✅ 해결 2: useMemo로 메모이제이션
const options = useMemo(() => ({ page, limit }), [page, limit])
useEffect(() => {
    fetchData(options)
}, [options])
```

### 1.7 useEffect 흐름 정리

```
컴포넌트 마운트
    ↓
초기 렌더링
    ↓
useEffect 실행 ←──────────────────┐
    ↓                              │
사용자 인터랙션 → State 변경        │
    ↓                              │
리렌더링                            │
    ↓                              │
이전 Cleanup 실행                   │
    ↓                              │
의존성 변경 확인 ── 변경됨 ──────────┘
    │
    └── 변경 안 됨 → 이펙트 스킵

컴포넌트 언마운트
    ↓
마지막 Cleanup 실행
```

---

## Chapter 2: useContext — 전역 상태 관리

### 2.1 Props Drilling 문제

기초편에서 배운 Props 전달은 **하위 컴포넌트가 깊어질수록** 불편해집니다.

```
App (theme="dark")
 └─ MainLayout (theme="dark")      ← 전달만 할 뿐 사용 안 함
     └─ Sidebar (theme="dark")     ← 전달만 할 뿐 사용 안 함
         └─ MenuItem (theme="dark") ← 여기서만 사용!
```

이처럼 중간 컴포넌트들이 **자신은 사용하지도 않는 Props를 전달만**하는 것을 **Props Drilling**이라 합니다. useContext는 이 문제를 해결합니다.

### 2.2 Context 3단계

Context는 **생성 → 제공 → 소비** 3단계로 사용합니다.

#### Step 1: Context 생성

```tsx
// src/contexts/ThemeContext.tsx
import { createContext, useState, useContext, ReactNode } from 'react'

// 1-1. Context에 담길 데이터의 타입 정의
interface ThemeContextType {
    theme: 'light' | 'dark'
    toggleTheme: () => void
}

// 1-2. Context 생성 (기본값은 undefined)
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)
```

#### Step 2: Provider로 값 제공

```tsx
// 2. Provider 컴포넌트 생성
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark')

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
```

#### Step 3: useContext로 값 소비

```tsx
// 3. 커스텀 Hook으로 편리하게 사용
export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme은 ThemeProvider 내부에서만 사용할 수 있습니다')
    }
    return context
}
```

### 2.3 전체 적용 예시

```tsx
// main.tsx — 최상위에서 Provider 감싸기
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </StrictMode>,
)
```

```tsx
// 아무 하위 컴포넌트에서 바로 사용 — Props Drilling 없음!
const MenuItem = () => {
    const { theme, toggleTheme } = useTheme()

    return (
        <button
            onClick={toggleTheme}
            className={theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
        >
            {theme === 'dark' ? '🌙 다크 모드' : '☀️ 라이트 모드'}
        </button>
    )
}
```

### 2.4 실전 예시 — 인증(Auth) Context

실무에서 가장 많이 사용되는 Context 패턴입니다.

```tsx
// src/contexts/AuthContext.tsx
import { createContext, useState, useContext, ReactNode, useEffect } from 'react'

interface User {
    id: string
    name: string
    email: string
    role: 'admin' | 'user'
    avatar?: string
}

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // 앱 시작 시 저장된 토큰으로 자동 로그인 시도
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('auth_token')
            if (token) {
                try {
                    const response = await fetch('/api/auth/me', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (response.ok) {
                        const userData = await response.json()
                        setUser(userData)
                    }
                } catch {
                    localStorage.removeItem('auth_token')
                }
            }
            setIsLoading(false)
        }
        checkAuth()
    }, [])

    const login = async (email: string, password: string) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })

        if (!response.ok) throw new Error('로그인 실패')

        const { token, user: userData } = await response.json()
        localStorage.setItem('auth_token', token)
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('auth_token')
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth는 AuthProvider 내부에서 사용하세요')
    return context
}
```

```tsx
// 사용 예: 로그인 상태에 따른 조건부 렌더링
const Header = () => {
    const { user, isAuthenticated, logout } = useAuth()

    return (
        <header>
            {isAuthenticated ? (
                <div className="flex items-center gap-4">
                    <span>안녕하세요, {user?.name}님!</span>
                    <button onClick={logout}>로그아웃</button>
                </div>
            ) : (
                <Link to="/login">로그인</Link>
            )}
        </header>
    )
}
```

### 2.5 Context 사용 시 주의사항

| 상황 | 권장 방법 |
|---|---|
| 2~3단계 Props 전달 | Props로 충분 (Context 불필요) |
| 앱 전체에서 공유하는 데이터 | ✅ Context 적합 (테마, 인증, 언어) |
| 자주 변경되는 데이터 | ⚠️ 성능 문제 가능 → Zustand 고려 |
| 서버에서 가져오는 데이터 | React Query 추천 (Chapter 5) |

> ⚠️ **성능 주의**: Context 값이 변경되면 **해당 Context를 구독하는 모든 컴포넌트**가 리렌더링됩니다. 자주 변하는 값은 Context를 분리하세요.

---

## Chapter 3: Custom Hooks — 로직 재사용

### 3.1 Custom Hook이란?

Custom Hook은 **`use`로 시작하는 함수**로, 여러 컴포넌트에서 공통된 로직을 재사용하기 위한 패턴입니다.

```
컴포넌트 A ─┐
            ├─── 같은 로직 반복 ───→ Custom Hook으로 추출!
컴포넌트 B ─┘
```

**규칙:**
1. 이름이 반드시 `use`로 시작해야 함
2. 다른 Hook(useState, useEffect 등)을 내부에서 호출 가능
3. 일반 함수가 아닌 **Hook의 규칙**을 따름

### 3.2 기본 예시 — useToggle

```tsx
// src/hooks/useToggle.ts
import { useState, useCallback } from 'react'

const useToggle = (initialValue: boolean = false) => {
    const [value, setValue] = useState(initialValue)

    const toggle = useCallback(() => setValue(prev => !prev), [])
    const setTrue = useCallback(() => setValue(true), [])
    const setFalse = useCallback(() => setValue(false), [])

    return { value, toggle, setTrue, setFalse }
}

export default useToggle
```

```tsx
// 사용 — 모달, 사이드바, 드롭다운 등 어디서든!
const Settings = () => {
    const modal = useToggle()
    const sidebar = useToggle(true)

    return (
        <>
            <button onClick={sidebar.toggle}>
                사이드바 {sidebar.value ? '닫기' : '열기'}
            </button>
            <button onClick={modal.setTrue}>모달 열기</button>
            {modal.value && <Modal onClose={modal.setFalse} />}
        </>
    )
}
```

### 3.3 실전 예시 ① — useLocalStorage

```tsx
// src/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react'

function useLocalStorage<T>(key: string, initialValue: T) {
    // localStorage에서 초기값 로드
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch {
            return initialValue
        }
    })

    // 값이 변경될 때마다 localStorage에 저장
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue))
        } catch (error) {
            console.error('localStorage 저장 실패:', error)
        }
    }, [key, storedValue])

    return [storedValue, setStoredValue] as const
}

export default useLocalStorage
```

```tsx
// 사용 — useState와 동일한 API, 하지만 새로고침해도 값 유지!
const Settings = () => {
    const [theme, setTheme] = useLocalStorage('theme', 'dark')
    const [fontSize, setFontSize] = useLocalStorage('fontSize', 14)

    return (
        <div>
            <select
                value={theme}
                onChange={e => setTheme(e.target.value)}
            >
                <option value="dark">다크</option>
                <option value="light">라이트</option>
            </select>
        </div>
    )
}
```

### 3.4 실전 예시 ② — useFetch (API 호출 추상화)

```tsx
// src/hooks/useFetch.ts
import { useState, useEffect } from 'react'

interface UseFetchResult<T> {
    data: T | null
    loading: boolean
    error: string | null
    refetch: () => void
}

function useFetch<T>(url: string): UseFetchResult<T> {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [trigger, setTrigger] = useState(0)

    useEffect(() => {
        let cancelled = false  // 경쟁 조건(Race Condition) 방지

        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)

                const response = await fetch(url)
                if (!response.ok) throw new Error(`HTTP ${response.status}`)

                const result = await response.json()

                if (!cancelled) {
                    setData(result)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : '오류 발생')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchData()

        // Cleanup: 컴포넌트 언마운트 시 상태 업데이트 방지
        return () => {
            cancelled = true
        }
    }, [url, trigger])

    const refetch = () => setTrigger(prev => prev + 1)

    return { data, loading, error, refetch }
}

export default useFetch
```

```tsx
// 사용 — 3줄로 API 호출 완료!
const UserList = () => {
    const { data: users, loading, error, refetch } = useFetch<User[]>('/api/users')

    if (loading) return <div>로딩 중...</div>
    if (error) return <div>에러: {error} <button onClick={refetch}>재시도</button></div>

    return (
        <ul>
            {users?.map(user => <li key={user.id}>{user.name}</li>)}
        </ul>
    )
}
```

### 3.5 실전 예시 ③ — useDebounce (검색 최적화)

```tsx
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

function useDebounce<T>(value: T, delay: number = 500): T {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => clearTimeout(timer)  // 값이 바뀌면 이전 타이머 취소
    }, [value, delay])

    return debouncedValue
}

export default useDebounce
```

```tsx
// 사용 — 검색어 입력 시 500ms 후에만 API 호출
const SearchPage = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearch = useDebounce(searchTerm, 500)
    const { data: results } = useFetch<SearchResult[]>(
        `/api/search?q=${debouncedSearch}`
    )

    return (
        <div>
            <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="검색어를 입력하세요..."
            />
            {/* 타이핑할 때마다가 아닌, 멈춘 후 500ms 후에 결과 표시 */}
            {results?.map(item => <div key={item.id}>{item.title}</div>)}
        </div>
    )
}
```

---

## Chapter 4: useReducer — 복잡한 상태 관리

### 4.1 useState의 한계

`useState`는 간단한 상태에 적합하지만, **상태가 복잡해지면** 코드가 난잡해집니다.

```tsx
// ❌ useState로 복잡한 상태를 관리하면...
const [items, setItems] = useState<Item[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [page, setPage] = useState(1)
const [totalPages, setTotalPages] = useState(0)
const [sortBy, setSortBy] = useState('name')
const [filterBy, setFilterBy] = useState('all')
// ...상태 변경 함수가 7개, 어떤 조합으로 호출해야 하는지 추적이 어려움
```

### 4.2 useReducer 기본 개념

`useReducer`는 **Redux 패턴**에서 영감을 받은 Hook으로, 상태 변경 로직을 **액션(Action)** 기반으로 관리합니다.

```
현재 상태(State) + 액션(Action) → Reducer 함수 → 새로운 상태(State)
```

### 4.3 실전 예시 — 할 일 목록(Todo List)

```tsx
// 타입 정의
interface Todo {
    id: number
    text: string
    completed: boolean
}

interface TodoState {
    todos: Todo[]
    filter: 'all' | 'active' | 'completed'
    nextId: number
}

// 모든 가능한 액션을 유니온 타입으로 정의
type TodoAction =
    | { type: 'ADD_TODO'; payload: string }
    | { type: 'TOGGLE_TODO'; payload: number }
    | { type: 'DELETE_TODO'; payload: number }
    | { type: 'SET_FILTER'; payload: TodoState['filter'] }
    | { type: 'CLEAR_COMPLETED' }

// Reducer — 상태 변경의 모든 경우를 한 곳에서 관리
const todoReducer = (state: TodoState, action: TodoAction): TodoState => {
    switch (action.type) {
        case 'ADD_TODO':
            return {
                ...state,
                todos: [
                    ...state.todos,
                    { id: state.nextId, text: action.payload, completed: false }
                ],
                nextId: state.nextId + 1,
            }

        case 'TOGGLE_TODO':
            return {
                ...state,
                todos: state.todos.map(todo =>
                    todo.id === action.payload
                        ? { ...todo, completed: !todo.completed }
                        : todo
                ),
            }

        case 'DELETE_TODO':
            return {
                ...state,
                todos: state.todos.filter(todo => todo.id !== action.payload),
            }

        case 'SET_FILTER':
            return { ...state, filter: action.payload }

        case 'CLEAR_COMPLETED':
            return {
                ...state,
                todos: state.todos.filter(todo => !todo.completed),
            }

        default:
            return state
    }
}

// 초기 상태
const initialState: TodoState = {
    todos: [],
    filter: 'all',
    nextId: 1,
}
```

```tsx
// 컴포넌트에서 사용
const TodoApp = () => {
    const [state, dispatch] = useReducer(todoReducer, initialState)
    const [newTodo, setNewTodo] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (newTodo.trim()) {
            dispatch({ type: 'ADD_TODO', payload: newTodo.trim() })
            setNewTodo('')
        }
    }

    return (
        <div className="max-w-md mx-auto p-6">
            <form onSubmit={handleSubmit}>
                <input
                    value={newTodo}
                    onChange={e => setNewTodo(e.target.value)}
                    placeholder="할 일을 입력하세요..."
                />
                <button type="submit">추가</button>
            </form>

            {/* 필터 버튼 */}
            <div className="flex gap-2 my-4">
                {(['all', 'active', 'completed'] as const).map(filter => (
                    <button
                        key={filter}
                        onClick={() => dispatch({ type: 'SET_FILTER', payload: filter })}
                        className={state.filter === filter ? 'font-bold' : ''}
                    >
                        {filter === 'all' ? '전체' : filter === 'active' ? '진행 중' : '완료'}
                    </button>
                ))}
            </div>

            {/* 할 일 목록 */}
            <ul>
                {state.todos
                    .filter(todo => {
                        if (state.filter === 'active') return !todo.completed
                        if (state.filter === 'completed') return todo.completed
                        return true
                    })
                    .map(todo => (
                        <li key={todo.id} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={todo.completed}
                                onChange={() => dispatch({ type: 'TOGGLE_TODO', payload: todo.id })}
                            />
                            <span className={todo.completed ? 'line-through opacity-50' : ''}>
                                {todo.text}
                            </span>
                            <button onClick={() => dispatch({ type: 'DELETE_TODO', payload: todo.id })}>
                                🗑️
                            </button>
                        </li>
                    ))}
            </ul>

            <button onClick={() => dispatch({ type: 'CLEAR_COMPLETED' })}>
                완료된 항목 삭제
            </button>
        </div>
    )
}
```

---

## Chapter 5: React Query / SWR — 서버 상태 관리

### 5.1 클라이언트 상태 vs 서버 상태

지금까지 배운 useState, useReducer, useContext는 모두 **클라이언트 상태**를 관리합니다. 하지만 실제 앱에서는 **서버에서 오는 데이터**를 다루는 일이 훨씬 많습니다.

| 구분 | 클라이언트 상태 | 서버 상태 |
|---|---|
| **소유권** | 프론트엔드가 소유 | 서버(DB)가 소유 |
| **예시** | 모달 열기/닫기, 테마, 폼 입력 | 사용자 목록, 게시글, 상품 정보 |
| **동기화** | 필요 없음 | 서버와 항상 동기화 필요 |
| **문제** | 비교적 단순 | 캐싱, 갱신, 에러 처리, 로딩 상태 등 복잡 |

### 5.2 React Query (TanStack Query)

현재 가장 인기 있는 서버 상태 관리 라이브러리입니다.

```bash
# 설치
npm install @tanstack/react-query
```

#### useQuery — 데이터 조회

```tsx
import { useQuery } from '@tanstack/react-query'

interface User {
    id: number
    name: string
    email: string
}

// API 호출 함수 (React Query와 분리)
const fetchUsers = async (): Promise<User[]> => {
    const response = await fetch('/api/users')
    if (!response.ok) throw new Error('사용자 목록을 불러올 수 없습니다')
    return response.json()
}

const UserList = () => {
    const {
        data: users,      // 서버에서 가져온 데이터
        isLoading,        // 최초 로딩 중
        isError,          // 에러 발생 여부
        error,            // 에러 객체
        refetch,          // 수동 재조회
        isFetching,       // 백그라운드 갱신 중
    } = useQuery({
        queryKey: ['users'],           // 캐시 키 (고유 식별자)
        queryFn: fetchUsers,           // 데이터를 가져오는 함수
    })

    if (isLoading) return <div className="animate-pulse">로딩 중...</div>
    if (isError) return <div>에러: {error.message}</div>

    return (
        <div>
            {isFetching && <span className="text-xs">갱신 중...</span>}
            <ul>
                {users?.map(user => (
                    <li key={user.id}>{user.name} ({user.email})</li>
                ))}
            </ul>
            <button onClick={() => refetch()}>새로고침</button>
        </div>
    )
}
```

#### useMutation — 데이터 생성/수정/삭제

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

const CreateUserForm = () => {
    const queryClient = useQueryClient()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    const createUser = useMutation({
        // 실제 API 호출
        mutationFn: async (newUser: { name: string; email: string }) => {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
            })
            if (!response.ok) throw new Error('사용자 생성 실패')
            return response.json()
        },

        // 성공 시: 사용자 목록 캐시를 무효화하여 자동 갱신
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setName('')
            setEmail('')
        },

        // 에러 시
        onError: (error) => {
            alert(`오류: ${error.message}`)
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createUser.mutate({ name, email })
    }

    return (
        <form onSubmit={handleSubmit}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" />
            <button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? '생성 중...' : '사용자 추가'}
            </button>
        </form>
    )
}
```

### 5.3 React Query vs SWR 비교

| 기능 | React Query | SWR |
|---|---|
| **번들 크기** | ~39KB | ~12KB |
| **Mutation 지원** | ✅ 강력한 useMutation | ⚠️ 수동 처리 |
| **캐시 무효화** | ✅ invalidateQueries | ⚠️ mutate로 수동 |
| **DevTools** | ✅ 공식 DevTools | ⚠️ 커뮤니티 도구 |
| **학습 곡선** | 중간 | 낮음 |
| **추천 상황** | 복잡한 CRUD 앱 | 간단한 데이터 조회 중심 앱 |

---

## Chapter 6: 상태 관리 라이브러리 — Zustand, Redux Toolkit

> 📖 **심화 학습**: 상태 관리 라이브러리는 내용이 방대하여 **별도의 전문 강의 노트**로 분리되었습니다. 자세한 내용은 [`state-management/state-management-guide.md`](state-management/state-management-guide.md)를 참고하세요.

### 6.1 왜 외부 상태 관리 라이브러리가 필요한가?

Chapter 2에서 useContext, Chapter 4에서 useReducer를 배웠습니다. 이 둘을 조합하면 전역 상태 관리가 가능하지만, **한계**가 있습니다.

| 문제 | 설명 |
|---|---|
| **성능** | Context 값이 바뀌면 구독 컴포넌트 **전체** 리렌더링 |
| **보일러플레이트** | Provider, Context, Reducer, Action 타입... 코드가 많음 |
| **미들웨어 부재** | 로깅, 비동기 처리, 영속성 등을 직접 구현해야 함 |
| **디버깅** | 상태 변화 추적이 어려움 |

### 6.2 빠른 시작 — Zustand 기본 예시

```tsx
// src/stores/counterStore.ts
import { create } from 'zustand'

const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))

export default useCounterStore
```

```tsx
// 컴포넌트에서 사용 — Provider 없이 바로!
const Counter = () => {
  const { count, increment } = useCounterStore()
  return <button onClick={increment}>{count}</button>
}
```

### 6.3 Redux Toolkit 기본 예시

```tsx
// src/store/slices/counterSlice.ts
import { createSlice } from '@reduxjs/toolkit'

export const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1 },
    decrement: (state) => { state.value -= 1 },
  },
})
```

### 6.4 심화 학습 경로

상태 관리 라이브러리를 더 깊이 학습하고 싶다면 다음 문서를 확인하세요:

📗 **[상태 관리 라이브러리 완전 정복 — Zustand, Redux Toolkit](state-management/state-management-guide.md)**

이 문서에서 다루는 내용:
- Zustand와 Redux Toolkit의 완벽 비교
- 실전 프로젝트 예제 (사용자 인증, 장바구니, Todo 앱, 다크 모드)
- 성능 최적화 팁
- Zustand + React Query 조합 방법
- 자주 묻는 질문 (FAQ)

---

## 학습 체크리스트

### Chapter 1: useEffect
- [ ] 사이드 이펙트의 개념을 설명할 수 있다
- [ ] 의존성 배열의 세 가지 패턴(없음/빈배열/값)을 구분할 수 있다
- [ ] API 데이터 가져오기를 useEffect로 구현할 수 있다
- [ ] Cleanup 함수의 역할과 필요한 시점을 알고 있다

### Chapter 2: useContext
- [ ] Props Drilling 문제를 설명할 수 있다
- [ ] Context를 생성하고 Provider/Consumer 패턴을 구현할 수 있다
- [ ] 커스텀 Hook으로 Context 사용을 간소화할 수 있다

### Chapter 3: Custom Hooks
- [ ] Custom Hook을 만들고 컴포넌트에서 사용할 수 있다
- [ ] useLocalStorage, useFetch 같은 실용적인 Hook을 구현할 수 있다

### Chapter 4: useReducer
- [ ] useState와 useReducer의 차이를 설명할 수 있다
- [ ] Reducer 함수와 Action 타입을 정의할 수 있다

### Chapter 5: React Query / SWR
- [ ] 클라이언트 상태와 서버 상태의 차이를 이해한다
- [ ] useQuery와 useMutation을 사용할 수 있다

### Chapter 6: 상태 관리 라이브러리
- [ ] Zustand로 스토어를 만들고 컴포넌트에서 사용할 수 있다
- [ ] 프로젝트 규모에 맞는 상태 관리 도구를 선택할 수 있다

---

## 전체 상태 관리 도구 비교 총정리

| 도구 | 복잡도 | 적합한 상황 | 핵심 키워드 |
|---|---|---|---|
| **useState** | ⭐ | 단순한 컴포넌트 로컬 상태 | 간단, 로컬 |
| **useReducer** | ⭐⭐ | 복잡한 로컬 상태 | 액션 기반, 예측 가능 |
| **useContext** | ⭐⭐ | 앱 전역 상태 (소규모) | Provider, 전역, 간단 |
| **Zustand** | ⭐⭐ | 중규모 전역 상태 | 최소 코드, Provider 불필요 |
| **Redux Toolkit** | ⭐⭐⭐ | 대규모 앱, 팀 협업 | 구조화, DevTools, 미들웨어 |
| **React Query** | ⭐⭐ | 서버 데이터 관리 | 캐싱, 자동 갱신, 비동기 |
| **SWR** | ⭐⭐ | 경량 서버 데이터 관리 | 경량, 실시간 갱신 |

---

> 📖 이 강의 노트는 기초편(`React_강의노트.md`)과 함께 React의 전체 그림을 완성합니다.
> **기초편** → 컴포넌트, JSX, Props, State, Router
> **심화편** → 사이드 이펙트, 전역 상태, 로직 재사용, 서버 상태, 외부 라이브러리

> 🚀 **다음 단계**: [`state-management/state-management-guide.md`](state-management/state-management-guide.md)에서 상태 관리 라이브러리를 더 깊이 학습하세요! 그 다음 [`ssr-nextjs-guide.md`](ssr-nextjs-guide.md)로 SSR & Next.js를 마스터하세요!
