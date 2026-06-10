import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Trash2, ShoppingBag } from 'lucide-react'

interface CartItem { foodItemId: string; name: string; price: number; quantity: number }
interface Cart { restaurantId: string; items: CartItem[]; totalPrice: number }

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const nav = useNavigate()

  const fetchCart = () =>
    api.get('/cart').then(r => setCart(r.data.data)).catch(() => setCart(null)).finally(() => setLoading(false))

  useEffect(() => { fetchCart() }, [])

  const updateQty = async (foodItemId: string, quantity: number) => {
    if (quantity === 0) {
      await api.delete(`/cart/items/${foodItemId}`)
    } else {
      await api.put(`/cart/items/${foodItemId}`, { quantity })
    }
    fetchCart()
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
      <div className="page-header"><h1>Giỏ hàng</h1></div>
      {isEmpty
        ? <div className="empty"><ShoppingBag size={48} /><p className="mt-4">Giỏ hàng trống</p></div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
            <div className="card">
              {cart.items.map(item => (
                <div className="cart-item" key={item.foodItemId}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{item.name}</p>
                    <p className="text-muted text-sm">{item.price.toLocaleString('vi-VN')}đ / cái</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="qty-ctrl">
                      <button className="qty-btn" onClick={() => updateQty(item.foodItemId, item.quantity - 1)}>−</button>
                      <span>{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.foodItemId, item.quantity + 1)}>+</button>
                    </div>
                    <span style={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                      {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => updateQty(item.foodItemId, 0)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Tóm tắt đơn hàng</h3>
              <div className="flex justify-between mb-4">
                <span className="text-muted">Tổng cộng</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>
                  {cart.totalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <button className="btn btn-primary w-full" onClick={checkout} disabled={checking}>
                {checking ? 'Đang xử lý...' : 'Đặt hàng ngay'}
              </button>
            </div>
          </div>
        )
      }
    </div>
  )
}
