import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { User, Mail, Shield, Hash, CreditCard, Package, Clock, LogOut } from 'lucide-react'

interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: any[] }

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
}
const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'badge-green',
  CANCELLED: 'badge-red',
  PENDING_PAYMENT: 'badge-yellow',
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-red',
  RESTAURANT_OWNER: 'badge-orange',
  CUSTOMER: 'badge-blue',
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    api.get('/orders').then(r => setOrders(r.data.data ?? [])).finally(() => setLoadingOrders(false))
  }, [])

  if (!user) return null

  const totalSpent = orders.filter(o => o.status === 'CONFIRMED').reduce((sum, o) => sum + o.totalAmount, 0)
  const pendingCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3)

  const handleLogout = () => { logout(); nav('/login') }

  return (
    <div className="page" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Hồ sơ cá nhân</h1>

      {/* Avatar + Info */}
      <div className="card section fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', color: '#fff', fontWeight: 700,
            boxShadow: 'var(--shadow-accent)', flexShrink: 0,
          }}>
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, marginBottom: 6 }}>{user.email.split('@')[0]}</h2>
            <span className={`badge ${ROLE_COLORS[user.role] ?? 'badge-blue'}`}>{user.role}</span>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label><Mail size={13} style={{ marginRight: 4, display: 'inline' }} />Email</label>
            <input readOnly value={user.email} />
          </div>
          <div className="form-group">
            <label><Shield size={13} style={{ marginRight: 4, display: 'inline' }} />Vai trò</label>
            <input readOnly value={user.role} />
          </div>
        </div>
        <div className="form-group">
          <label><Hash size={13} style={{ marginRight: 4, display: 'inline' }} />User ID</label>
          <input readOnly value={user.id} className="font-mono" style={{ fontSize: '0.8rem' }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--danger)', marginTop: 4 }}>
          <LogOut size={14} /> Đăng xuất
        </button>
      </div>

      {/* Stats */}
      {!loadingOrders && (
        <div className="stat-grid section fade-in">
          <div className="stat-card">
            <Package size={20} color="var(--accent)" style={{ marginBottom: 8 }} />
            <span className="stat-val">{orders.length}</span>
            <span className="stat-label">Tổng đơn hàng</span>
          </div>
          <div className="stat-card">
            <CreditCard size={20} color="var(--success)" style={{ marginBottom: 8 }} />
            <span className="stat-val" style={{ fontSize: '1.2rem' }}>{totalSpent.toLocaleString('vi-VN')}đ</span>
            <span className="stat-label">Tổng chi tiêu</span>
          </div>
          <div className="stat-card">
            <Clock size={20} color="var(--warning)" style={{ marginBottom: 8 }} />
            <span className="stat-val">{pendingCount}</span>
            <span className="stat-label">Chờ thanh toán</span>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="section fade-in">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 0 }}>Đơn hàng gần đây</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/orders')}>Xem tất cả →</button>
        </div>
        {loadingOrders ? (
          <div className="spinner" />
        ) : recentOrders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px' }}>
            <p>Chưa có đơn hàng nào</p>
            <button className="btn btn-primary btn-sm mt-4" onClick={() => nav('/')}>Đặt hàng ngay</button>
          </div>
        ) : (
          recentOrders.map(o => (
            <div className="order-card" key={o.id}>
              <div className="flex justify-between items-center">
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>#{o.id.slice(0, 10).toUpperCase()}</p>
                  <p className="text-muted text-xs">{new Date(o.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${STATUS_BADGE[o.status] ?? 'badge-blue'}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {o.totalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
              {o.status === 'PENDING_PAYMENT' && (
                <button className="btn btn-primary btn-sm w-full mt-2" onClick={() => nav(`/payment/${o.id}`)}>
                  Thanh toán ngay
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
