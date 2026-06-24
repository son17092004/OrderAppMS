import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import toast from 'react-hot-toast'
import { User, Mail, Shield, Hash, CreditCard, Package, Clock, LogOut, MapPin, Plus, Pencil, Trash2, Check, X } from 'lucide-react'

interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: any[] }

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
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-red',
  RESTAURANT_OWNER: 'badge-orange',
  CUSTOMER: 'badge-blue',
  DRIVER: 'badge-purple',
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

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

  if (!user) return null

  const totalSpent = orders.filter(o => o.status === 'CONFIRMED').reduce((sum, o) => sum + o.totalAmount, 0)
  const pendingCount = orders.filter(o => o.status === 'PENDING_PAYMENT').length
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3)

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
    const updated = [...addresses, trimmed]
    await saveAddresses(updated)
    setNewAddr('')
    setAddingNew(false)
  }

  const handleEditSave = async (idx: number) => {
    const trimmed = editingVal.trim()
    if (!trimmed) return toast.error('Địa chỉ không được để trống')
    const updated = addresses.map((a, i) => (i === idx ? trimmed : a))
    await saveAddresses(updated)
    setEditingIdx(null)
  }

  const handleDelete = async (idx: number) => {
    if (!confirm('Xóa địa chỉ này?')) return
    const updated = addresses.filter((_, i) => i !== idx)
    await saveAddresses(updated)
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

      {/* ── Delivery Addresses ────────────────────────────────────────────── */}
      <div className="card section fade-in" style={{ marginTop: 4 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} color="var(--accent)" />
            Địa chỉ giao hàng
          </h3>
          {!addingNew && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setAddingNew(true)}
              style={{ gap: 4 }}
            >
              <Plus size={14} /> Thêm địa chỉ
            </button>
          )}
        </div>

        {loadingAddr ? (
          <div className="spinner" />
        ) : (
          <>
            {addresses.length === 0 && !addingNew && (
              <div style={{
                textAlign: 'center', padding: '28px 16px',
                border: '1.5px dashed var(--border)', borderRadius: 12,
                color: 'var(--muted)',
              }}>
                <MapPin size={32} strokeWidth={1.2} style={{ marginBottom: 8, opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Chưa có địa chỉ nào. Thêm địa chỉ để đặt hàng nhanh hơn!</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map((addr, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    border: '1px solid var(--border)', borderRadius: 10,
                    background: 'var(--bg-card)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                  {editingIdx === idx ? (
                    <>
                      <input
                        value={editingVal}
                        onChange={e => setEditingVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEditSave(idx); if (e.key === 'Escape') setEditingIdx(null) }}
                        autoFocus
                        style={{ flex: 1, margin: 0, padding: '4px 8px', fontSize: '0.9rem' }}
                        placeholder="Nhập địa chỉ..."
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleEditSave(idx)}
                        disabled={savingAddr}
                        style={{ color: 'var(--success)', padding: '4px 8px' }}
                        title="Lưu"
                      >
                        {savingAddr ? <span className="spinner spinner-sm" /> : <Check size={15} />}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditingIdx(null)}
                        style={{ color: 'var(--muted)', padding: '4px 8px' }}
                        title="Hủy"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>{addr}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingIdx(idx); setEditingVal(addr) }}
                        style={{ color: 'var(--muted)', padding: '4px 8px' }}
                        title="Sửa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(idx)}
                        disabled={savingAddr}
                        style={{ color: 'var(--danger)', padding: '4px 8px' }}
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new address input */}
            {addingNew && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', marginTop: addresses.length > 0 ? 10 : 0,
                border: '1.5px solid var(--accent)', borderRadius: 10,
                background: 'rgba(var(--accent-rgb, 234, 88, 12), 0.04)',
              }}>
                <MapPin size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                <input
                  value={newAddr}
                  onChange={e => setNewAddr(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddAddress(); if (e.key === 'Escape') { setAddingNew(false); setNewAddr('') } }}
                  autoFocus
                  placeholder="VD: 123 Lê Lợi, Quận 1, TP.HCM"
                  style={{ flex: 1, margin: 0, padding: '4px 8px', fontSize: '0.9rem' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAddAddress}
                  disabled={savingAddr || !newAddr.trim()}
                  style={{ padding: '6px 12px' }}
                >
                  {savingAddr ? <span className="spinner spinner-sm" /> : <><Check size={14} /> Lưu</>}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setAddingNew(false); setNewAddr('') }}
                  style={{ color: 'var(--muted)', padding: '6px 10px' }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
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

      {/* ── Recent Orders ──────────────────────────────────────────────────── */}
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
