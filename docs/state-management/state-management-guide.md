# 상태 관리 라이브러리 완전 정복 — Zustand, Redux Toolkit
> imapplepie20 Admin Template 프로젝트 기반 실습 가이드

**대상**: React 기초 지식 보유, 상태 관리 라이브러리 입문~중급 학습자
**선수 지식**: `React_강의노트.md`, `React_심화_강의노트.md` 학습 완료

---

## 목차

1. [왜 외부 상태 관리 라이브러리가 필요한가?](#chapter-1-왜-외부-상태-관리-라이브러리가-필요한가)
2. [Zustand — 심플함의 극치](#chapter-2-zustand-—-심플함의-극치)
3. [Redux Toolkit — 현대적인 Redux](#chapter-3-redux-toolkit-—-현대적인-redux)
4. [성능 최적화 팁](#chapter-4-성능-최적화-팁)
5. [Zustand vs Redux Toolkit 비교](#chapter-5-zustand-vs-redux-toolkit-비교)
6. [실전 프로젝트 적용](#chapter-6-실전-프로젝트-적용)
7. [자주 묻는 질문](#chapter-7-자주-묻는-질문)

---

## Chapter 1: 왜 외부 상태 관리 라이브러리가 필요한가?

`React_심화_강의노트.md`에서 `useContext`와 `useReducer`를 배웠습니다. 이 둘을 조합하면 전역 상태 관리가 가능하지만, **한계**가 있습니다.

### 1.1 Context + useReducer의 문제점

| 문제 | 설명 | 예시 |
|---|---|---|
| **성능** | Context 값이 바뀌면 구독 컴포넌트 **전체** 리렌더링 | `UserContext`의 `name`만 바뀌어도 `email`을 사용하는 컴포넌트도 리렌더링 |
| **보일러플레이트** | Provider, Context, Reducer, Action 타입... 코드가 많음 | 간단한 카운터도 10줄 이상 필요 |
| **미들웨어 부재** | 로깅, 비동기 처리, 영속성 등을 직접 구현해야 함 | `localStorage` 자동 저장을 직접 구현 |
| **디버깅** | 상태 변화 추적이 어려움 | 어떤 액션으로 상태가 바뀌었는지 확인 불가 |

### 1.2 상태 관리 라이브러리가 해결해주는 것

```
┌─────────────────────────────────────────────────────────────┐
│                    상태 관리 라이브러리                       │
├─────────────────────────────────────────────────────────────┤
│  ✅ 선택적 구독 (Optimistic Updates)                         │
│     → 필요한 상태만 구독하여 불필요한 리렌더링 방지           │
│                                                              │
│  ✅ DevTools 통합                                            │
│     → 상태 변화 내역을 시각적으로 확인                        │
│                                                              │
│  ✅ 미들웨어 생태계                                           │
│     → 로깅, 비동기 처리, 영속성 등을 플러그인으로 제공       │
│                                                              │
│  ✅ 타입 안전성                                               │
│     → TypeScript과 완벽한 호환                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 클라이언트 상태 vs 서버 상태

> 💡 **중요**: 상태 관리 라이브러리는 **클라이언트 상태** 관리에 특화되어 있습니다. **서버 상태**는 React Query/SWR이 더 적합합니다.

| 상태 타입 | 예시 | 추천 도구 |
|---|---|---|
| **클라이언트 상태** | UI 상태, 폼 입력, 장바구니, 테마 | Zustand, Redux Toolkit |
| **서버 상태** | API 데이터, DB 조회 결과 | React Query, SWR |
| **URL 상태** | 검색 파라미터, 페이지 번호 | URLSearchParams, React Router |

---

## Chapter 2: Zustand — 심플함의 극치

Zustand(독일어로 "상태")는 **최소한의 코드**로 전역 상태를 관리할 수 있는 라이브러리입니다.

### 2.1 왜 Zustand인가?

> 💡 **핵심 장점**: Provider 없이 즉시 사용 가능, 번들 크기 ~1KB, TypeScript 친화적

| 특징 | Zustand | Context + useReducer |
|---|---|---|
| 설정 복잡도 | Store 생성만 하면 끝 | Context + Provider + Reducer 필요 |
| 번들 크기 | ~1KB | React 내장 (0KB) |
| 선택적 구독 | 기본 지원 | 별도 구현 필요 |
| DevTools | 미들웨어로 지원 | 직접 구현 필요 |
| 배우기 난이도 | ⭐ (매우 쉬움) | ⭐⭐⭐ (중간) |

### 2.2 설치

```bash
npm install zustand
```

> ⚠️ **ESLint 버전 충돌 해결**: 필요시 `--legacy-peer-deps` 옵션 사용

### 2.3 프로젝트 구조

```
src/
├── stores/              # Zustand stores 폴더
│   ├── counterStore.ts  # 카운터 store
│   ├── userStore.ts     # 사용자 store
│   ├── cartStore.ts     # 장바구니 store
│   └── themeStore.ts    # 테마 store
```

### 2.4 기본 Store 생성

```typescript
// src/stores/counterStore.ts
import { create } from 'zustand';

// 1️⃣ State 타입 정의
interface CounterState {
  count: number;           // 상태
  increment: () => void;   // 액션
  decrement: () => void;
  reset: () => void;
  incrementBy: (amount: number) => void;
}

// 2️⃣ Store 생성
const useCounterStore = create<CounterState>((set) => ({
  // 초기 상태
  count: 0,

  // 액션들
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
  incrementBy: (amount) => set((state) => ({ count: state.count + amount })),
}));

export default useCounterStore;
```

**핵심 개념:**
- `create()`: Store를 생성하는 함수
- `set()`: 상태를 업데이트하는 함수 (useState의 setter와 유사)
- `set((state) => ...)`: 이전 상태를 참조할 때 사용

### 2.5 컴포넌트에서 사용

```tsx
// src/components/Counter.tsx
import useCounterStore from '../stores/counterStore';

function Counter() {
  // ✅ 선택적 구독: count가 변경될 때만 리렌더링
  const count = useCounterStore((state) => state.count);

  // ✅ 액션들은 참조가 안 바뀌므로 리렌더링 없음
  const increment = useCounterStore((state) => state.increment);
  const decrement = useCounterStore((state) => state.decrement);
  const reset = useCounterStore((state) => state.reset);
  const incrementBy = useCounterStore((state) => state.incrementBy);

  return (
    <div className="p-4 bg-hud-bg-card rounded-xl border border-hud-border">
      <h2 className="text-2xl font-bold mb-4">Count: {count}</h2>
      <div className="flex gap-2">
        <button onClick={increment} className="btn-primary">+</button>
        <button onClick={decrement} className="btn-primary">-</button>
        <button onClick={() => incrementBy(5)} className="btn-secondary">+5</button>
        <button onClick={reset} className="btn-secondary">Reset</button>
      </div>
    </div>
  );
}

export default Counter;
```

> 💡 **성능 최적화**: 각 상태와 액션을 별도로 구독하면, 해당 값이 변경될 때만 컴포넌트가 리렌더링됩니다.

### 2.6 실전: 사용자 인증 Store

```typescript
// src/stores/userStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  // 동기 액션
  setUser: (user: User) => void;
  logout: () => void;
  clearError: () => void;

  // 비동기 액션
  login: (email: string, password: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        // 초기 상태
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,

        // 동기 액션
        setUser: (user) => set({ user, isAuthenticated: true }),
        logout: () => set({ user: null, isAuthenticated: false }),
        clearError: () => set({ error: null }),

        // 비동기 액션
        login: async (email, password) => {
          set({ loading: true, error: null });
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            if (!response.ok) throw new Error('Login failed');
            const user = await response.json();
            set({ user, isAuthenticated: true, loading: false });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },

        fetchProfile: async () => {
          const { user } = get();
          if (!user) return;
          set({ loading: true });
          try {
            const response = await fetch(`/api/users/${user.id}`);
            const profile = await response.json();
            set({ user: profile, loading: false });
          } catch (error) {
            set({ error: error.message, loading: false });
          }
        },
      }),
      {
        name: 'user-storage', // localStorage 키
      }
    ),
    { name: 'UserStore' } // DevTools 이름
  )
);

export default useUserStore;
```

**미들웨어 설명:**
- `devtools`: Redux DevTools로 상태 변화를 시각화
- `persist`: localStorage에 자동 저장 (새로고침해도 상태 유지)

### 2.7 실전: 장바구니 Store

```typescript
// src/stores/cartStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  isCartOpen: boolean;

  // 액션
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
}

const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],
      isCartOpen: false,

      addItem: (item) =>
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [] }),
      toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
    }),
    { name: 'CartStore' }
  )
);

// 📌 Selector (Computed 값)
export const selectCartTotal = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const selectCartItemCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export default useCartStore;
```

### 2.8 실전: 다크 모드 Store

```typescript
// src/stores/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: 'dark',

      setTheme: (theme) => {
        set({ theme });

        // system 테마 감지
        if (theme === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          set({ resolvedTheme: isDark ? 'dark' : 'light' });
        } else {
          set({ resolvedTheme: theme });
        }

        // HTML class 업데이트 (Tailwind CSS 다크 모드)
        document.documentElement.classList.toggle('dark', get().resolvedTheme === 'dark');
      },
    }),
    {
      name: 'theme-storage',
    }
  )
);

export default useThemeStore;
```

### 2.9 실전: Todo 앱 Store

```typescript
// src/stores/todoStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type TodoFilter = 'all' | 'active' | 'completed';

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;

  // 액션
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, text: string) => void;
  setFilter: (filter: TodoFilter) => void;
  clearCompleted: () => void;
}

const useTodoStore = create<TodoState>()(
  devtools(
    persist(
      (set) => ({
        todos: [],
        filter: 'all',

        addTodo: (text) =>
          set((state) => ({
            todos: [
              ...state.todos,
              {
                id: Date.now().toString(),
                text,
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          })),

        toggleTodo: (id) =>
          set((state) => ({
            todos: state.todos.map((todo) =>
              todo.id === id
                ? { ...todo, completed: !todo.completed, updatedAt: new Date() }
                : todo
            ),
          })),

        deleteTodo: (id) =>
          set((state) => ({
            todos: state.todos.filter((todo) => todo.id !== id),
          })),

        updateTodo: (id, text) =>
          set((state) => ({
            todos: state.todos.map((todo) =>
              todo.id === id ? { ...todo, text, updatedAt: new Date() } : todo
            ),
          })),

        setFilter: (filter) => set({ filter }),

        clearCompleted: () =>
          set((state) => ({
            todos: state.todos.filter((todo) => !todo.completed),
          })),
      }),
      {
        name: 'todo-storage',
      }
    ),
    { name: 'TodoStore' }
  )
);

// Selector: 필터링된 todos
export const selectFilteredTodos = (state: TodoState) => {
  const { todos, filter } = state;
  switch (filter) {
    case 'active':
      return todos.filter((todo) => !todo.completed);
    case 'completed':
      return todos.filter((todo) => todo.completed);
    default:
      return todos;
  }
};

// Selector: Todo 통계
export const selectTodoStats = (state: TodoState) => ({
  total: state.todos.length,
  active: state.todos.filter((t) => !t.completed).length,
  completed: state.todos.filter((t) => t.completed).length,
});

export default useTodoStore;
```

---

## Chapter 3: Redux Toolkit — 현대적인 Redux

Redux Toolkit(RTK)은 Redux 공식 팀이 만든 **표준 방식**의 Redux 라이브러리입니다.

### 3.1 왜 Redux Toolkit인가?

> 💡 **핵심 장점**: 풍부한 미들웨어 생태계, 대규모 앱에 적합, 강력한 DevTools

| 특징 | Redux Toolkit | Zustand |
|---|---|---|
| 설정 복잡도 | Store + Slice + Hooks | Store만 있으면 됨 |
| 번들 크기 | ~10KB | ~1KB |
| 미들웨어 생태계 | 매우 풍부 | 제한적 |
| 배우기 난이도 | ⭐⭐⭐ (중간) | ⭐ (매우 쉬움) |
| 적합한 프로젝트 | 대규모 엔터프라이즈 | 소~중형 규모 |

### 3.2 설치

```bash
npm install @reduxjs/toolkit react-redux
```

### 3.3 프로젝트 구조

```
src/
├── store/                # Redux Store 폴더
│   ├── store.ts          # 메인 Store 설정
│   └── hooks.ts          # 타입 안전한 Hooks
├── features/             # Feature 기반 폴더
│   ├── counter/
│   │   └── counterSlice.ts
│   ├── user/
│   │   └── userSlice.ts
│   └── cart/
│       └── cartSlice.ts
```

### 3.4 Slice 생성

```typescript
// src/features/counter/counterSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 1️⃣ State 타입 정의
interface CounterState {
  value: number;
}

// 2️⃣ 초기 상태
const initialState: CounterState = {
  value: 0,
};

// 3️⃣ Slice 생성
export const counterSlice = createSlice({
  name: 'counter',
  initialState,
  reducers: {
    // ✅ Immer가 불변성을 자동으로 처리해줌!
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementBy: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
    reset: (state) => {
      state.value = 0;
    },
  },
});

// 4️⃣ 액션과 Reducer 추출
export const { increment, decrement, incrementBy, reset } = counterSlice.actions;
export default counterSlice.reducer;
```

**핵심 개념:**
- `createSlice()`: Action 타입, Action Creator, Reducer를 한 번에 생성
- `Immer`: 불변성을 자동으로 처리 (직접 state 수정 가능)
- `PayloadAction<T>`: 액션의 payload 타입

### 3.5 Store 설정

```typescript
// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import counterReducer from '../features/counter/counterSlice';
import userReducer from '../features/user/userSlice';
import cartReducer from '../features/cart/cartSlice';

// Store 생성
export const store = configureStore({
  reducer: {
    counter: counterReducer,
    user: userReducer,
    cart: cartReducer,
  },
});

// 타입 추론
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 3.6 타입 안전한 Hooks

```typescript
// src/store/hooks.ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// 타입 안전한 hooks
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

### 3.7 Provider 설정

```tsx
// src/main.tsx
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>
);
```

### 3.8 컴포넌트에서 사용

```tsx
// src/components/Counter.tsx
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { increment, decrement, incrementBy, reset } from '../features/counter/counterSlice';

function Counter() {
  const value = useAppSelector((state) => state.counter.value);
  const dispatch = useAppDispatch();

  return (
    <div className="p-4 bg-hud-bg-card rounded-xl border border-hud-border">
      <h2>Count: {value}</h2>
      <button onClick={() => dispatch(increment())}>+</button>
      <button onClick={() => dispatch(decrement())}>-</button>
      <button onClick={() => dispatch(incrementBy(5))}>+5</button>
      <button onClick={() => dispatch(reset())}>Reset</button>
    </div>
  );
}

export default Counter;
```

### 3.9 비동기 액션 (createAsyncThunk)

```typescript
// src/features/user/userSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  data: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  data: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// 비동기 Thunk 생성
export const loginUser = createAsyncThunk(
  'user/login',
  async (credentials: { email: string; password: string }) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  }
);

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logout: (state) => {
      state.data = null;
      state.isAuthenticated = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      });
  },
});

export const { logout } = userSlice.actions;
export default userSlice.reducer;
```

**비동기 액션 라이프사이클:**
```
loginUser.pending   → 로딩 시작
loginUser.fulfilled → 성공 (action.payload에 데이터)
loginUser.rejected  → 실패 (action.error에 에러)
```

### 3.10 Memoized Selector (성능 최적화)

```typescript
// src/features/cart/cartSelectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../store/store';

// 기본 Selector
export const selectCartItems = (state: RootState) => state.cart.items;

// Memoized Selector (계산 캐싱)
export const selectCartTotal = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

export const selectCartItemCount = createSelector(
  [selectCartItems],
  (items) => items.reduce((sum, item) => sum + item.quantity, 0)
);

// 체이닝 Selector
export const selectExpensiveItems = createSelector(
  [selectCartItems],
  (items) => items.filter((item) => item.price > 100)
);
```

---

## Chapter 4: 성능 최적화 팁

### 4.1 Zustand 성능 최적화

#### 선택적 구독 (가장 중요!)

```tsx
// ❌ 나쁜 예: 전체 state를 구독
const { count, increment } = useCounterStore();

// ✅ 좋은 예: 필요한 것만 구독
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
```

#### shallow 비교

```typescript
import { shallow } from 'zustand/shallow';

// 객체를 구독할 때 shallow 비교 사용
const { name, email } = useUserStore(
  (state) => ({ name: state.user?.name, email: state.user?.email }),
  shallow
);
```

#### Selector 분리

```typescript
// 컴포넌트 밖에서 selector 정의 (재생성 방지)
const selectCount = (state: CounterState) => state.count;
const selectIncrement = (state: CounterState) => state.increment;

function Counter() {
  const count = useCounterStore(selectCount);
  const increment = useCounterStore(selectIncrement);

  return <button onClick={increment}>{count}</button>;
}
```

### 4.2 Redux Toolkit 성능 최적화

#### Memoized Selector 활용

```typescript
// ❌ 나쁜 예: 매번 계산
const total = useAppSelector((state) =>
  state.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

// ✅ 좋은 예: createSelector로 캐싱
const total = useAppSelector(selectCartTotal);
```

#### normalizeState (대용량 데이터)

```typescript
// ❌ 나쁜 예: 배열로 관리
interface State {
  users: User[];
}

// ✅ 좋은 예: 객체로 관리 (O(1) 조회)
interface State {
  users: Record<string, User>; // { id: User }
  userIds: string[]; // 순서 유지용
}
```

---

## Chapter 5: Zustand vs Redux Toolkit 비교

### 5.1 기능 비교표

| 특징 | Zustand | Redux Toolkit |
|---|---|---|
| **학습 곡선** | ⭐ (낮음) | ⭐⭐⭐ (중간) |
| **보일러플레이트** | 최소화 | 적음 (기존 Redux보다 개선) |
| **번들 크기** | ~1KB | ~10KB |
| **DevTools** | 미들웨어로 지원 | 기본 내장 |
| **미들웨어 생태계** | 제한적 | 풍부 (Redux Saga, thunk 등) |
| **타입 지원** | 우수함 | 우수함 |
| **커뮤니티** | 성장 중 | 매우 큼 |
| **Provider 필요** | ❌ 없음 | ✅ 필요 |
| **적합한 프로젝트** | 소~중형 규모 | 대형 규모, 복잡한 상태 |

### 5.2 코드 비교

#### 카운터 예제

**Zustand:**
```typescript
// 15줄
const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

**Redux Toolkit:**
```typescript
// Slice (20줄) + Store (10줄) + Hooks (5줄) = 35줄
export const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1 },
    decrement: (state) => { state.value -= 1 },
    reset: (state) => { state.value = 0 },
  },
});
```

### 5.3 선택 가이드

```
┌─────────────────────────────────────────────────────────────┐
│                    라이브러리 선택 가이드                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🚀 Zustand 선택이 좋은 경우:                                │
│  • 빠르고 간단한 상태 관리가 필요할 때                        │
│  • 소~중형 규모의 프로젝트                                    │
│  • Redux의 복잡함 없이 전역 상태를 관리하고 싶을 때           │
│  • 최소한의 보일러플레이트를 원할 때                          │
│  • Provider 없이 바로 사용하고 싶을 때                        │
│                                                              │
│  🏢 Redux Toolkit 선택이 좋은 경우:                          │
│  • 대규모 엔터프라이즈 애플리케이션                           │
│  • 팀에서 Redux를 이미 사용 중일 때                           │
│  • 풍부한 미들웨어 생태계가 필요할 때                         │
│  • 구조화된 상태 관리 패턴이 필요할 때                        │
│  • 시간 여행 디버깅 등 고급 DevTools 기능이 필요할 때        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Chapter 6: 실전 프로젝트 적용

### 6.1 imapplepie Template에서의 상태 관리

현재 프로젝트에서는 다음과 같은 상태들을 관리할 수 있습니다:

| 상태 | 추천 라이브러리 | 이유 |
|---|---|---|
| 사용자 인 정보 | Zustand | 간단한 구조, localStorage 영속화 |
| 장바구니 | Zustand | 빠른 개발, 선택적 구독 |
| 테마 (다크/라이트) | Zustand | 간단한 boolean 값 |
| 복잡한 폼 상태 | Redux Toolkit | 다양한 미들웨어 활용 |
| 실시간 데이터 | Zustand + React Query | Zustand는 상태, React Query는 서버 상태 |

### 6.2 Zustand + React Query 조합

> 💡 **베스트 프랙티스**: 클라이언트 상태는 Zustand, 서버 상태는 React Query로 관리

```typescript
// Zustand: 클라이언트 상태 (장바구니)
const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));

// React Query: 서버 상태 (상품 목록)
const { data: products } = useQuery({
  queryKey: ['products'],
  queryFn: () => fetch('/api/products').then((res) => res.json()),
});

// 컴포넌트에서 조합
function ProductList() {
  const { data: products } = useProducts();
  const addItem = useCartStore((state) => state.addItem);

  return (
    <div>
      {products?.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={() => addItem(product)}
        />
      ))}
    </div>
  );
}
```

---

## Chapter 7: 자주 묻는 질문

### Q1. Zustand와 Context API의 차이는 무엇인가요?

**A:** 가장 큰 차이는 **성능**과 **편의성**입니다.

| 특징 | Context API | Zustand |
|---|---|---|
| 리렌더링 | Provider 값이 바뀌면 모든 자식 리렌더링 | 구독한 값이 바뀔 때만 리렌더링 |
| Provider 필요 | ✅ 필수 | ❌ 없음 |
| DevTools | ❌ 직접 구현 | ✅ 미들웨어로 지원 |
| 영속성 | ❌ 직접 구현 | ✅ persist 미들웨어 |

### Q2. 언제 Redux Toolkit을 사용해야 하나요?

**A:** 다음 상황에서 Redux Toolkit을 추천합니다:
- 대규모 엔터프라이즈 애플리케이션
- 팀에서 이미 Redux를 사용 중
- 복잡한 비동기 로직이 많음 (Redux Saga 활용)
- 시간 여행 디버깅 필요
- 미들웨어가 필수적인 경우

### Q3. 서버 상태는 무엇으로 관리하나요?

**A:** 서버 상태는 **React Query** 또는 **SWR**을 추천합니다.

| 도구 | 용도 |
|---|---|
| Zustand / Redux Toolkit | 클라이언트 상태 (UI, 장바구니, 테마 등) |
| React Query / SWR | 서버 상태 (API 데이터, DB 조회 등) |

### Q4. localStorage에 상태를 저장하려면 어떻게 하나요?

**A:** Zustand는 `persist` 미들웨어를, Redux Toolkit은 `redux-persist`를 사용하세요.

```typescript
// Zustand
import { persist } from 'zustand/middleware';
const useStore = create()(
  persist(
    (set) => ({ /* ... */ }),
    { name: 'storage-key' }
  )
);

// Redux Toolkit
import { persistStore, persistReducer } from 'redux-persist';
const persistedReducer = persistReducer({ key: 'root', storage }, rootReducer);
```

### Q5. TypeScript 타입 추론이 안 되는 문제를 해결하려면?

**A:** 제네릭 타입을 명시하고, `create()`에 타입을 전달하세요.

```typescript
// Zustand
interface State { count: number }
const useStore = create<State>()((set) => ({ count: 0 }));

// Redux Toolkit
export type RootState = ReturnType<typeof store.getState>;
export const useAppSelector = useSelector.withTypes<RootState>();
```

---

## 추가 학습 자료

- **Zustand 공식 문서**: [https://zustand-demo.pmnd.rs/](https://zustand-demo.pmnd.rs/)
- **Redux Toolkit 공식 문서**: [https://redux-toolkit.js.org/](https://redux-toolkit.js.org/)
- **Redux 공식 튜토리얼**: [https://redux.js.org/tutorials/essentials/part-1-overview-concepts](https://redux.js.org/tutorials/essentials/part-1-overview-concepts)
- **React Query 공식 문서**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)

---

**다음 학습 자료:**
- **[`ssr-nextjs-guide.md`](../ssr-nextjs-guide.md)** — SSR & Next.js 완전 정복
- **[`React_실전_전문가코스_Complete.md`](../React_실전_전문가코스_Complete.md)** — 실전 프로젝트
