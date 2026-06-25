import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import toast from 'react-hot-toast'
import {
  User, Mail, Shield, Hash, CreditCard, Package, Clock,
  LogOut, MapPin, Plus, Pencil, Trash2, Check, X,
  ReceiptText, RefreshCw, CheckCircle, XCircle, AlertCircle, Banknote
} from 'lucide-react'

interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: any[] }
interface Payment {
  id: string; orderId: string; amount: number; status: string;
  transactionId: string | null; refundId: string | null;
  failureReason: string | null; createdAt: string; updatedAt: string;
}

type ProfileTab = 'profile' | 'payments'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}
const STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: 'badge-yellow',
  CONFIRMED: 'badge-green',
  SHIPPING: 'badge-blue',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
}
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  COMPLETED: 'Thành công',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
}
const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow',
  COMPLETED: 'badge-green',
  FAILED: 'badge-red',
  REFUNDED: 'badge-purple',
}
const PAYMENT_STATUS_ICON: Record<string, JSX.Element> = {
  PENDING: <Clock size={15} />,
  COMPLETED: <CheckCircle size={15} />,
  FAILED: <XCircle size={15} />,
  REFUNDED: <Banknote size={15} />,
}
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-red',
  RESTAURANT_OWNER: 'badge-orange',
  CUSTOMER: 'badge-blue',
  DRIVER: 'badge-purple',
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile')

  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [refreshingPayments, setRefreshingPayments] = useState(false)

  // ─── Address Management State ───────────────────────────────────────────────
  const [addresses, setAddresses] = useState<string[]>([])
  const [loadingAddr, setLoadingAddr] = useState(true)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newAddr, setNewAddr] = useState('')
  const [savingAddr, setSavingAddr] = useState(false)

  useEffect(() => {
    api.get('/orders').then(r => setOrders(r.data.data ?? [])).finally(() => setLoadingOrders(false))
  }, [])

  useEffect(() => {
    api.get('/auth/profile')
      .then(r => setAddresses(r.data.data?.addresses ?? []))
      .finally(() => setLoadingAddr(false))
  }, [])

  const fetchPayments = useCallback(async (silent = false) => {
    if (!silent) setLoadingPayments(true)
    else setRefreshingPayments(true)
    try {
      const r = await api.get('/payments/my')
      setPayments(r.data.data ?? [])
    } catch (err: any) {
      if (!silent) toast.error('Không thể tải lịch sử thanh toán')
    } finally {
      setLoadingPayments(false)
      setRefreshingPayments(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPayments()
    }
  }, [activeTab, fetchPayments])

  if (!user) return null

  const totalSpent = orders.filter(o => o.status === 'COMPLETED').reduce((sum, o) => sum + o.totalAmount, 0)
  const pendingCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3)

  const totalRefunded = payments.filter(p => p.status === 'REFUNDED').reduce((sum, p) => sum + p.amount, 0)
  const completedPayments = payments.filter(p => p.status === 'COMPLETED').length

  const handleLogout = () => { logout(); nav('/login') }

  const saveAddresses = async (updated: string[]) => {
    setSavingAddr(true)
    try {
      const r = await api.put('/auth/profile/addresses', { addresses: updated })
      setAddresses(r.data.data?.addresses ?? updated)
      toast.success('Đã lưu địa chỉ thành công')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi khi lưu địa chỉ')
    } finally {
      setSavingAddr(false)
    }
  }

  const handleAddAddress = async () => {
    const trimmed = newAddr.trim()
    if (!trimmed) return toast.error('Vui lòng nhập địa chỉ')
    await saveAddresses([...addresses, trimmed])
    setNewAddr('')
    setAddingNew(false)
  }

  const handleEditSave = async (idx: number) => {
    const trimmed = editingVal.trim()
    if (!trimmed) return toast.error('Địa chỉ không được để trống')
    await saveAddresses(addresses.map((a, i) => (i === idx ? trimmed : a)))
    setEditingIdx(null)
  }

  const handleDelete = async (idx: number) => {
    if (!confirm('Xóa địa chỉ này?')) return
    await saveAddresses(addresses.filter((_, i) => i !== idx))
  }

  return (
    <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Hồ sơ cá nhân</h1>

      {/* ── Avatar + Info ─────────────────────────────────────────────────── */}
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

      {/* ── Tab Bar ───────────────────────────────────────────────────────── */}
      <div className="tab-bar" style={{ margin: '8px 0 0 0' }}>
        <button
          className={`tab-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          Hồ sơ & Địa chỉ
        </button>
        <button
          className={`tab-item ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <CreditCard size={14} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
          Thanh toán
          {payments.filter(p => p.status === 'REFUNDED').length > 0 && (
            <span className="badge" style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px', background: 'var(--purple, #8b5cf6)', color: '#fff' }}>
              {payments.filter(p => p.status === 'REFUNDED').length} hoàn tiền
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Profile & Addresses
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <>
          {/* ── Delivery Addresses ─────────────────────────────────────────── */}
          <div className="card section fade-in" style={{ marginTop: 4 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="var(--accent)" />
                Địa chỉ giao hàng
              </h3>
              {!addingNew && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddingNew(true)} style={{ gap: 4 }}>
                  <Plus size={14} /> Thêm địa chỉ
                </button>
              )}
            </div>

            {loadingAddr ? <div className="spinner" /> : (
              <>
                {addresses.length === 0 && !addingNew && (
                  <div style={{
                    textAlign: 'center', padding: '28px 16px',
                    border: '1.5px dashed var(--border)', borderRadius: 12, color: 'var(--muted)',
                  }}>
                    <MapPin size={32} strokeWidth={1.2} style={{ marginBottom: 8, opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Chưa có địa chỉ nào. Thêm địa chỉ để đặt hàng nhanh hơn!</p>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {addresses.map((addr, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', border: '1px solid var(--border)',
                      borderRadius: 10, background: 'var(--bg-card)',
                    }}>
                      <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                      {editingIdx === idx ? (
                        <>
                          <input
                            value={editingVal} onChange={e => setEditingVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditSave(idx); if (e.key === 'Escape') setEditingIdx(null) }}
                            autoFocus style={{ flex: 1, margin: 0, padding: '4px 8px', fontSize: '0.9rem' }}
                          />
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEditSave(idx)} disabled={savingAddr} style={{ color: 'var(--success)', padding: '4px 8px' }}>
                            {savingAddr ? <span className="spinner spinner-sm" /> : <Check size={15} />}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingIdx(null)} style={{ color: 'var(--muted)', padding: '4px 8px' }}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontSize: '0.9rem' }}>{addr}</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditingIdx(idx); setEditingVal(addr) }} style={{ color: 'var(--muted)', padding: '4px 8px' }}>
                            <Pencil size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(idx)} disabled={savingAddr} style={{ color: 'var(--danger)', padding: '4px 8px' }}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {addingNew && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', marginTop: addresses.length > 0 ? 10 : 0,
                    border: '1.5px solid var(--accent)', borderRadius: 10,
                    background: 'rgba(var(--accent-rgb, 234, 88, 12), 0.04)',
                  }}>
                    <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <input
                      value={newAddr} onChange={e => setNewAddr(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddAddress(); if (e.key === 'Escape') { setAddingNew(false); setNewAddr('') } }}
                      autoFocus placeholder="VD: 123 Lê Lợi, Quận 1, TP.HCM"
                      style={{ flex: 1, margin: 0, padding: '4px 8px', fontSize: '0.9rem' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddAddress} disabled={savingAddr || !newAddr.trim()} style={{ padding: '6px 12px' }}>
                      {savingAddr ? <span className="spinner spinner-sm" /> : <><Check size={14} /> Lưu</>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAddingNew(false); setNewAddr('') }} style={{ color: 'var(--muted)', padding: '6px 10px' }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Stats ─────────────────────────────────────────────────────── */}
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

          {/* ── Recent Orders ─────────────────────────────────────────────── */}
          <div className="section fade-in">
            <div className="page-header" style={{ marginBottom: 16 }}>
              <h2 style={{ marginBottom: 0 }}>Đơn hàng gần đây</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('/orders')}>Xem tất cả →</button>
            </div>
            {loadingOrders ? <div className="spinner" /> : recentOrders.length === 0 ? (
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Payments History
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payments' && (
        <div className="section fade-in" style={{ marginTop: 4 }}>
          {/* Payment Stats */}
          {!loadingPayments && payments.length > 0 && (
            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <ReceiptText size={20} color="var(--accent)" style={{ marginBottom: 8 }} />
                <span className="stat-val">{payments.length}</span>
                <span className="stat-label">Tổng giao dịch</span>
              </div>
              <div className="stat-card">
                <CheckCircle size={20} color="var(--success)" style={{ marginBottom: 8 }} />
                <span className="stat-val">{completedPayments}</span>
                <span className="stat-label">Thành công</span>
              </div>
              <div className="stat-card">
                <Banknote size={20} color="#8b5cf6" style={{ marginBottom: 8 }} />
                <span className="stat-val" style={{ fontSize: '1.1rem' }}>{totalRefunded.toLocaleString('vi-VN')}đ</span>
                <span className="stat-label">Đã hoàn tiền</span>
              </div>
            </div>
          )}

          {/* Header + Refresh */}
          <div className="page-header" style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 0 }}>Lịch sử thanh toán</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchPayments(true)} disabled={refreshingPayments}>
              <RefreshCw size={14} className={refreshingPayments ? 'spin' : ''} />
              {refreshingPayments ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>

          {loadingPayments ? (
            <div className="spinner" />
          ) : payments.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>
              <CreditCard size={48} strokeWidth={1.2} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {payments.map((p, idx) => (
                <div
                  key={p.id}
                  className="card fade-in"
                  style={{
                    animationDelay: `${idx * 0.04}s`,
                    borderLeft: `3px solid ${
                      p.status === 'COMPLETED' ? 'var(--success)' :
                      p.status === 'REFUNDED' ? '#8b5cf6' :
                      p.status === 'FAILED' ? 'var(--danger)' : 'var(--border)'
                    }`,
                  }}
                >
                  {/* Top row */}
                  <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
                        Đơn #{p.orderId.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(p.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${PAYMENT_STATUS_BADGE[p.status] ?? 'badge-yellow'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {PAYMENT_STATUS_ICON[p.status]}
                        {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>
                        {p.amount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {p.transactionId && (
                      <div className="flex justify-between">
                        <span>Charge ID</span>
                        <code style={{ background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem', color: 'var(--text)' }}>
                          {p.transactionId}
                        </code>
                      </div>
                    )}
                    {p.refundId && (
                      <div className="flex justify-between">
                        <span>Refund ID</span>
                        <code style={{ background: 'rgba(139,92,246,0.12)', padding: '1px 6px', borderRadius: 4, fontSize: '0.75rem', color: '#a78bfa' }}>
                          {p.refundId}
                        </code>
                      </div>
                    )}
                    {p.failureReason && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
                        <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                        <span style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>{p.failureReason}</span>
                      </div>
                    )}
                    {p.status === 'REFUNDED' && p.refundId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '8px 10px', background: 'rgba(139,92,246,0.08)', borderRadius: 8 }}>
                        <Banknote size={14} color="#8b5cf6" style={{ flexShrink: 0 }} />
                        <span style={{ color: '#a78bfa', fontSize: '0.78rem' }}>
                          Tiền đã được hoàn lại vào tài khoản của bạn.
                          {p.refundId.startsWith('re_mock_') ? ' (mô phỏng)' : ' (Stripe thật)'}
                        </span>
                      </div>
                    )}
                    {p.status === 'COMPLETED' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => nav(`/orders`)}
                          style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '3px 8px' }}
                        >
                          Xem đơn hàng →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
