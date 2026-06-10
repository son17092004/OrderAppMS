import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(email, password)
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.')
      nav('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <h2>Tạo tài khoản</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" required />
          </div>
          <div className="form-group">
            <label>Mật khẩu (tối thiểu 6 ký tự)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" minLength={6} required />
          </div>
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>
        <p className="text-muted text-sm mt-4" style={{ textAlign: 'center' }}>
          Đã có tài khoản? <Link to="/login" className="text-accent">Đăng nhập</Link>
        </p>
      </div>
    </div>
  )
}
