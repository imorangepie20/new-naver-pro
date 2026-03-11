import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuthStore } from '../../stores/authStore'

const Login = () => {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showBrandIcon, setShowBrandIcon] = useState(false)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShowBrandIcon((prev) => !prev)
    }, 3200)

    return () => window.clearInterval(interval)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const result = await login(email, password)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || '로그인에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-hud-bg-primary hud-grid-bg relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-20 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute left-10 top-1/3 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-[180px] max-w-[420px] items-center justify-center px-2">
            <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/logo0001.png"
                  alt="집돌이9 로고"
                  className={`h-full w-full object-contain mix-blend-multiply drop-shadow-[0_18px_28px_rgba(15,23,42,0.12)] transition-all duration-700 ease-out ${
                    showBrandIcon ? 'scale-90 opacity-0 blur-[2px]' : 'scale-100 opacity-100 blur-0'
                  }`}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src="/icon001.png"
                  alt="집돌이9 심볼"
                  className={`h-full w-full object-contain mix-blend-multiply drop-shadow-[0_20px_30px_rgba(15,23,42,0.14)] transition-all duration-700 ease-out ${
                    showBrandIcon ? 'scale-[0.88] opacity-100' : 'scale-75 opacity-0'
                  }`}
                />
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-hud-accent-primary/80">Real Estate Workspace</p>
            <h1 className="text-3xl font-bold tracking-tight text-hud-text-primary">환영합니다</h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-hud-text-muted">
              매물, 계약, 일정, 통계를 한 번에 관리하는 실무형 부동산 워크스페이스입니다.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="rounded-[28px] border border-white/10 bg-hud-bg-secondary/85 p-1 shadow-[0_24px_70px_rgba(15,23,42,0.28)] backdrop-blur-xl">
          <div className="rounded-[24px] border border-hud-border-secondary bg-hud-bg-primary/90 p-8">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="mb-6 flex items-center justify-between gap-3 border-b border-hud-border-secondary pb-4">
              <div>
                <h2 className="text-lg font-semibold text-hud-text-primary">로그인</h2>
                <p className="mt-1 text-sm text-hud-text-muted">계정 정보로 바로 접속합니다.</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Secure</p>
                <p className="mt-1 text-xs text-hud-text-muted">JWT 인증</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="mb-2 block text-sm text-hud-text-secondary">이메일</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="이메일을 입력하세요"
                    className="w-full rounded-xl border border-hud-border-secondary bg-hud-bg-secondary pl-12 pr-4 py-3 text-hud-text-primary placeholder-hud-text-muted transition-hud focus:border-hud-accent-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-sm text-hud-text-secondary">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full rounded-xl border border-hud-border-secondary bg-hud-bg-secondary pl-12 pr-12 py-3 text-hud-text-primary placeholder-hud-text-muted transition-hud focus:border-hud-accent-primary focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted transition-hud hover:text-hud-text-primary"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                variant="primary"
                fullWidth
                glow
                type="submit"
                disabled={isLoading}
                className="h-12 rounded-xl text-sm font-semibold"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>
            </form>

            {/* Register Link */}
            <p className="mt-6 text-center text-sm text-hud-text-muted">
              계정이 없으신가요?{' '}
              <a href="/register" className="font-medium text-hud-accent-primary hover:underline">
                회원가입
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
