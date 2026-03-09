import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuthStore } from '../../stores/authStore'

const Register = () => {
  const navigate = useNavigate()
  const { register, isLoading } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null)

  // 비밀번호 강도 체크
  const checkPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return 'weak'
    if (pwd.length < 10) return 'medium'
    return 'strong'
  }

  const handlePasswordChange = (value: string) => {
    setPassword(value)
    if (value) {
      setPasswordStrength(checkPasswordStrength(value))
    } else {
      setPasswordStrength(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 유효성 검사
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    const result = await register(email, name, password)

    if (result.success) {
      navigate('/profile?from=register')
    } else {
      setError(result.error || '회원가입에 실패했습니다.')
    }
  }

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'strong': return 'bg-green-500'
      default: return 'bg-gray-600'
    }
  }

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'weak': return '약함'
      case 'medium': return '보통'
      case 'strong': return '강함'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-hud-bg-primary hud-grid-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-hud-accent-primary to-hud-accent-info rounded-lg flex items-center justify-center font-bold text-xl text-hud-bg-primary">
              H
            </div>
            <span className="font-bold text-2xl text-hud-text-primary text-glow">집 돌이</span>
          </div>
          <h1 className="text-2xl font-bold text-hud-text-primary">회원가입</h1>
          <p className="text-hud-text-muted mt-2">새 계정을 만들어주세요</p>
        </div>

        {/* Register Form */}
        <div className="hud-card hud-card-bottom rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm text-hud-text-secondary mb-2">이름</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-hud-text-secondary mb-2">이메일</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일을 입력하세요"
                  className="w-full pl-12 pr-4 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-hud-text-secondary mb-2">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="비밀번호 (최소 6자)"
                  className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordStrength && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getPasswordStrengthColor()} transition-all`}
                      style={{ width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%' }}
                    />
                  </div>
                  <span className="text-xs text-hud-text-muted">{getPasswordStrengthText()}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm text-hud-text-secondary mb-2">비밀번호 확인</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-hud-text-muted" size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full pl-12 pr-12 py-3 bg-hud-bg-primary border border-hud-border-secondary rounded-lg text-hud-text-primary placeholder-hud-text-muted focus:outline-none focus:border-hud-accent-primary transition-hud"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-hud-text-muted hover:text-hud-text-primary transition-hud"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-green-500">비밀번호가 일치합니다</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-red-500">비밀번호가 일치하지 않습니다</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-hud-border-secondary bg-hud-bg-primary text-hud-accent-primary focus:ring-hud-accent-primary"
                required
              />
              <span className="text-sm text-hud-text-secondary">
                이용약관 및 개인정보 처리방침에 동의합니다
              </span>
            </label>

            {/* Submit */}
            <Button
              variant="primary"
              fullWidth
              glow
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          {/* Login Link */}
          <p className="text-center text-sm text-hud-text-muted mt-6">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-hud-accent-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
