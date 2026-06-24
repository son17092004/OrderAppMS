import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Trash2, ShoppingBag, Minus, Plus, Store, MapPin, ChevronDown } from 'lucide-react'

interface CartItem { foodItemId: string; name: string; price: number; quantity: number }
interface Cart { restaurantId: string; items: CartItem[]; totalPrice: number }

export default function CartPage() {
  const { user } = useAuth()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const nav = useNavigate()

  // ─── Address State ───────────────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<string[]>([])
  const [selectedAddress, setSelectedAddress] = useState('')
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const fetchCart = () =>
    api.get('/cart').then(r => setCart(r.data.data)).catch(() => setCart(null)).finally(() => setLoading(false))

  useEffect(() => { fetchCart() }, [])

  useEffect(() => {
    if (cart?.restaurantId) {
      api.get(`/restaurants/${cart.restaurantId}`)
        .then(r => setRestaurantName(r.data.data?.name || cart.restaurantId))
        .catch(() => setRestaurantName(cart.restaurantId))
    } else {
      setRestaurantName('')
    }
  }, [cart?.restaurantId])

  // Tải địa chỉ đã lưu của user
  useEffect(() => {
    if (!user) return
    api.get('/auth/profile')
      .then(r => {
        const addrs: string[] = r.data.data?.addresses ?? []
        setAddresses(addrs)
        if (addrs.length > 0) {
          setSelectedAddress(addrs[0])
          setUseCustom(false)
        } else {
          setUseCustom(true)
        }
      })
      .catch(() => setUseCustom(true))
  }, [user])

  const updateQty = async (foodItemId: string, quantity: number) => {
    setUpdatingId(foodItemId)
    try {
      if (quantity === 0) {
        await api.delete(`/cart/items/${foodItemId}`)
      } else {
        await api.put('/cart', { foodItemId, quantity })
      }
      await fetchCart()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật giỏ hàng')
    } finally {
      setUpdatingId(null)
    }
  }

  const clearCart = async () => {
    if (!confirm('Xóa toàn bộ giỏ hàng?')) return
    try {
      await api.delete('/cart')
      setCart(null)
      toast.success('Đã xóa giỏ hàng')
    } catch {}
  }

  const checkout = async () => {
    const deliveryAddress = useCustom ? customAddress.trim() : selectedAddress
    if (!deliveryAddress) {
      toast.error('Vui lòng chọn hoặc nhập địa chỉ giao hàng')
      return
    }
    setChecking(true)
    try {
      const r = await api.post('/orders/checkout', { deliveryAddress })
      const orderId = r.data.data.id
      toast.success('Đặt hàng thành công!')
      nav(`/payment/${orderId}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi khi đặt hàng')
    } finally {
      setChecking(false)
    }
  }

  if (loading) return <div className="spinner" />

  const isEmpty = !cart || cart.items.length === 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>Giỏ hàng</h1>
        {!isEmpty && (
          <button className="btn btn-ghost btn-sm" onClick={clearCart}>
            <Trash2 size={14} /> Xóa tất cả
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="empty fade-in">
          <ShoppingBag size={56} strokeWidth={1.2} />
          <p className="mt-4" style={{ fontSize: '1.05rem' }}>Giỏ hàng của bạn đang trống</p>
          <button className="btn btn-primary mt-4" onClick={() => nav('/')}>Khám phá nhà hàng</button>
        </div>
      ) : (
        <div className="cart-layout" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* Items */}
          <div className="flex-1">
            {cart.restaurantId && (
              <div className="flex items-center gap-2 mb-4 text-muted text-sm">
                <Store size={14} /> <span>Đặt hàng từ nhà hàng: <strong style={{ color: 'var(--text)' }}>{restaurantName || 'Đang tải...'}</strong></span>
              </div>
            )}
            <div className="card">
              {cart.items.map(item => (
                <div className="cart-item" key={item.foodItemId}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, marginBottom: 2 }} className="truncate">{item.name}</p>
                    <p className="text-muted text-sm">{item.price.toLocaleString('vi-VN')}đ / cái</p>
                  </div>
                  <div className="flex items-center gap-4" style={{ flexShrink: 0 }}>
                    <div className="qty-ctrl">
                      <button
                        className="qty-btn"
                        onClick={() => updateQty(item.foodItemId, item.quantity - 1)}
                        disabled={updatingId === item.foodItemId}
                      >
                        {updatingId === item.foodItemId ? <span className="spinner spinner-sm" /> : <Minus size={14} />}
                      </button>
                      <span className="qty-display">{item.quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => updateQty(item.foodItemId, item.quantity + 1)}
                        disabled={updatingId === item.foodItemId}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span style={{ fontWeight: 700, minWidth: 90, textAlign: 'right', color: 'var(--accent)' }}>
                      {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => updateQty(item.foodItemId, 0)}
                      disabled={updatingId === item.foodItemId}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary + Address */}
          <div className="cart-summary-box" style={{ width: 320, flexShrink: 0 }}>
            <h3 style={{ marginBottom: 16 }}>Tóm tắt đơn hàng</h3>
            <div className="flex justify-between mb-4">
              <span className="text-muted">Số món</span>
              <span>{cart.items.reduce((s, i) => s + i.quantity, 0)} món</span>
            </div>
            <div className="divider" />
            <div className="flex justify-between mb-4">
              <span style={{ fontWeight: 600 }}>Tổng cộng</span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)' }}>
                {cart.totalPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>

            {/* ── Delivery Address Selection ─── */}
            <div style={{
              marginBottom: 16,
              padding: '14px',
              border: '1.5px solid var(--border)',
              borderRadius: 12,
              background: 'var(--bg-card)',
            }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <MapPin size={15} color="var(--accent)" />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Địa chỉ giao hàng</span>
              </div>

              {addresses.length > 0 && (
                <>
                  {/* Toggle: saved vs custom */}
                  <div className="flex gap-2" style={{ marginBottom: 10 }}>
                    <button
                      onClick={() => setUseCustom(false)}
                      className={`btn btn-sm ${!useCustom ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, fontSize: '0.78rem', padding: '5px 0' }}
                    >
                      Địa chỉ đã lưu
                    </button>
                    <button
                      onClick={() => setUseCustom(true)}
                      className={`btn btn-sm ${useCustom ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, fontSize: '0.78rem', padding: '5px 0' }}
                    >
                      Nhập mới
                    </button>
                  </div>
                </>
              )}

              {!useCustom && addresses.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowAddrDropdown(p => !p)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem',
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedAddress || 'Chọn địa chỉ...'}
                    </span>
                    <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 6, opacity: 0.6 }} />
                  </button>
                  {showAddrDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, boxShadow: 'var(--shadow-lg)', marginTop: 4, overflow: 'hidden',
                    }}>
                      {addresses.map((addr, i) => (
                        <div
                          key={i}
                          onClick={() => { setSelectedAddress(addr); setShowAddrDropdown(false) }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: selectedAddress === addr ? 'rgba(var(--accent-rgb, 234,88,12),0.08)' : 'transparent',
                            color: selectedAddress === addr ? 'var(--accent)' : 'var(--text)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--accent-rgb,234,88,12),0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = selectedAddress === addr ? 'rgba(var(--accent-rgb,234,88,12),0.08)' : 'transparent')}
                        >
                          <MapPin size={13} color={selectedAddress === addr ? 'var(--accent)' : 'var(--muted)'} />
                          {addr}
                        </div>
                      ))}
                      <div
                        onClick={() => { setUseCustom(true); setShowAddrDropdown(false) }}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem',
                          color: 'var(--accent)', borderTop: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        <Plus size={13} /> Nhập địa chỉ mới...
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    value={customAddress}
                    onChange={e => setCustomAddress(e.target.value)}
                    placeholder="Nhập địa chỉ giao hàng..."
                    style={{ margin: 0, fontSize: '0.85rem', padding: '8px 12px' }}
                  />
                  {addresses.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6, marginBottom: 0 }}>
                      💡 Bạn có thể lưu địa chỉ trong <button onClick={() => nav('/profile')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}>Hồ sơ cá nhân</button>
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary w-full"
              onClick={checkout}
              disabled={checking}
              style={{ padding: '12px' }}
            >
              {checking ? <><span className="spinner spinner-sm" /> Đang xử lý...</> : '🛒 Đặt hàng ngay'}
            </button>
            <button className="btn btn-ghost w-full mt-2" onClick={() => nav('/')}>
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
