import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Package, RefreshCw, CreditCard } from 'lucide-react'

interface OrderItem { name: string; price: number; quantity: number }
interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: OrderItem[]; restaurantId: string }

type FilterType = 'ALL' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED'

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  DELIVERED: 'Đã giao',
}

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: 'badge-green',
  CANCELLED: 'badge-red',
  PENDING_PAYMENT: 'badge-yellow',
  DELIVERED: 'badge-blue',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const nav = useNavigate()

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const r = await api.get('/orders')
      setOrders(r.data.data ?? [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    // Auto-refresh every 20s while there are pending orders
    const id = setInterval(() => fetchOrders(true), 20_000)
    return () => clearInterval(id)
  }, [fetchOrders])

  const filtered = useMemo(() =>
    filter === 'ALL' ? orders : orders.filter(o => o.status === filter),
    [orders, filter]
  )

  const counts = useMemo(() => ({
    ALL: orders.length,
    PENDING_PAYMENT: orders.filter(o => o.status === 'PENDING_PAYMENT').length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
  }), [orders])

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Đơn hàng của tôi</h1>
          <p className="text-muted text-sm">{orders.length} đơn hàng</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => fetchOrders(true)} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="tab-bar">
        {(['ALL', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED'] as FilterType[]).map(f => (
          <button
            key={f}
            className={`tab-item ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'ALL' ? 'Tất cả' : STATUS_LABELS[f]}
            {counts[f] > 0 && (
              <span
                className="badge"
                style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 6px', background: filter === f ? 'var(--accent)' : 'var(--bg-input)', color: filter === f ? '#fff' : 'var(--muted)' }}
              >
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty fade-in">
          <Package size={52} strokeWidth={1.2} />
          <p className="mt-4">Không có đơn hàng nào</p>
          {filter === 'ALL' && <button className="btn btn-primary mt-4" onClick={() => nav('/')}>Đặt hàng ngay</button>}
        </div>
      ) : (
        <div>
          {filtered.map((o, idx) => (
            <div className="order-card fade-in" key={o.id} style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4>Đơn #{o.id.slice(0, 8).toUpperCase()}</h4>
                  <p className="text-muted text-sm">{new Date(o.createdAt).toLocaleString('vi-VN')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${STATUS_BADGE[o.status] ?? 'badge-blue'}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                  {o.status === 'PENDING_PAYMENT' && (
                    <button className="btn btn-primary btn-sm" onClick={() => nav(`/payment/${o.id}`)}>
                      <CreditCard size={13} /> Thanh toán
                    </button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div style={{ marginBottom: 12 }}>
                {o.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm" style={{ padding: '5px 0', color: 'var(--muted)', borderBottom: i < o.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span>{item.name} <strong style={{ color: 'var(--text)' }}>× {item.quantity}</strong></span>
                    <span style={{ fontWeight: 600 }}>{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span className="text-muted text-sm">Tổng cộng</span>
                <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>
                  {o.totalAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
