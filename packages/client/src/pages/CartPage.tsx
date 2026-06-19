import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Trash2, ShoppingBag, Minus, Plus, Store } from 'lucide-react'

interface CartItem { foodItemId: string; name: string; price: number; quantity: number }
interface Cart { restaurantId: string; items: CartItem[]; totalPrice: number }

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const nav = useNavigate()

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
    setChecking(true)
    try {
      const r = await api.post('/orders/checkout')
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

          {/* Summary */}
          <div className="cart-summary-box" style={{ width: 300, flexShrink: 0 }}>
            <h3 style={{ marginBottom: 16 }}>Tóm tắt đơn hàng</h3>
            <div className="flex justify-between mb-4">
              <span className="text-muted">Số món</span>
              <span>{cart.items.reduce((s, i) => s + i.quantity, 0)} món</span>
            </div>
            <div className="divider" />
            <div className="flex justify-between mb-6">
              <span style={{ fontWeight: 600 }}>Tổng cộng</span>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)' }}>
                {cart.totalPrice.toLocaleString('vi-VN')}đ
              </span>
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
