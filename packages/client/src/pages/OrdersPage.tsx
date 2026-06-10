import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Package } from 'lucide-react'

interface OrderItem { name: string; price: number; quantity: number }
interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: OrderItem[] }

const statusColor = (s: string) => {
  if (s === 'CONFIRMED') return 'badge-green'
  if (s === 'CANCELLED') return 'badge-red'
  if (s === 'PENDING_PAYMENT') return 'badge-orange'
  return 'badge-blue'
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/orders').then(r => setOrders(r.data.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-header"><h1>Đơn hàng của tôi</h1></div>
      {orders.length === 0
        ? <div className="empty"><Package size={48} /><p className="mt-4">Chưa có đơn hàng nào</p></div>
        : orders.map(o => (
          <div className="order-card" key={o.id}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4>Đơn #{o.id.slice(0, 8)}...</h4>
                <p className="text-muted text-sm">{new Date(o.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${statusColor(o.status)}`}>{o.status}</span>
                {o.status === 'PENDING_PAYMENT' && (
                  <button className="btn btn-primary btn-sm" onClick={() => nav(`/payment/${o.id}`)}>
                    Thanh toán
                  </button>
                )}
              </div>
            </div>
            {o.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm" style={{ padding: '4px 0', color: 'var(--muted)' }}>
                <span>{item.name} × {item.quantity}</span>
                <span>{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
              </div>
            ))}
            <div className="divider" />
            <div className="flex justify-between">
              <span className="text-muted">Tổng</span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>${o.totalAmount}</span>
            </div>
          </div>
        ))
      }
    </div>
  )
}
