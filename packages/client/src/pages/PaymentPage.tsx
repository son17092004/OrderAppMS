import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { CreditCard, CheckCircle, XCircle, Package } from 'lucide-react'

const STRIPE_TOKENS = [
  { label: 'Visa (thành công)', value: 'tok_visa', color: 'var(--success)', icon: '💳' },
  { label: 'Mastercard (thành công)', value: 'tok_mastercard', color: 'var(--success)', icon: '💳' },
  { label: 'Card Declined', value: 'tok_chargeDeclined', color: 'var(--danger)', icon: '🚫' },
  { label: 'Expired Card', value: 'tok_chargeDeclinedExpiredCard', color: 'var(--danger)', icon: '⏰' },
]

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const nav = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [selectedToken, setSelectedToken] = useState('tok_visa')
  const [paying, setPaying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(r => setOrder(r.data.data))
  }, [orderId])

  // Auto redirect after success
  useEffect(() => {
    if (!result?.success) return
    if (countdown <= 0) { nav('/orders'); return }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [result, countdown, nav])

  const pay = async () => {
    setPaying(true)
    try {
      const r = await api.post('/payments/stripe/charge', {
        orderId,
        stripeToken: selectedToken,
        amount: order?.totalAmount,
      })
      setResult(r.data.data)
      if (r.data.data.success) {
        toast.success('Thanh toán thành công!')
        setCountdown(5)
      } else {
        toast.error('Thanh toán bị từ chối!')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi thanh toán')
    } finally {
      setPaying(false)
    }
  }

  if (!order) return <div className="spinner" />

  return (
    <div className="page" style={{ maxWidth: 580, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 6 }}>Thanh toán</h1>
      <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Hoàn tất đơn hàng của bạn</p>

      {/* Order Info */}
      <div className="card section">
        <h3><Package size={16} style={{ marginRight: 8, display: 'inline', verticalAlign: 'middle' }} />Chi tiết đơn hàng</h3>
        <div className="flex justify-between mb-2 mt-4">
          <span className="text-muted text-sm">Mã đơn</span>
          <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>#{order.id.slice(0, 12).toUpperCase()}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-muted text-sm">Trạng thái</span>
          <span className={`badge ${order.status === 'CONFIRMED' ? 'badge-green' : order.status === 'CANCELLED' ? 'badge-red' : 'badge-yellow'}`}>
            {order.status === 'PENDING_PAYMENT' ? 'Chờ thanh toán' : order.status === 'CONFIRMED' ? 'Đã xác nhận' : order.status}
          </span>
        </div>
        {order.items?.length > 0 && (
          <div style={{ margin: '12px 0', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {order.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm" style={{ padding: '4px 0', color: 'var(--muted)' }}>
                <span>{item.name} × {item.quantity}</span>
                <span>{(item.price * item.quantity).toLocaleString('vi-VN')}đ</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between mt-2">
          <span style={{ fontWeight: 600 }}>Tổng tiền</span>
          <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)' }}>
            {order.totalAmount?.toLocaleString('vi-VN')}đ
          </span>
        </div>
      </div>

      {/* Payment Form */}
      {!result && order.status === 'PENDING_PAYMENT' && (
        <div className="card fade-in">
          <h3><CreditCard size={16} style={{ marginRight: 8, display: 'inline', verticalAlign: 'middle' }} />Chọn phương thức (Mock Stripe)</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Chọn token để mô phỏng kết quả thanh toán:</p>
          <div className="token-row">
            {STRIPE_TOKENS.map(t => (
              <div
                key={t.value}
                className={`token-chip ${selectedToken === t.value ? 'selected' : ''}`}
                style={{ borderColor: selectedToken === t.value ? t.color : '', color: selectedToken === t.value ? t.color : '' }}
                onClick={() => setSelectedToken(t.value)}
              >
                {t.icon} {t.label}
              </div>
            ))}
          </div>
          <div className="form-group mt-4">
            <label>Token đã chọn</label>
            <input readOnly value={selectedToken} className="font-mono" />
          </div>
          <button
            className="btn btn-primary w-full"
            onClick={pay}
            disabled={paying}
            style={{ padding: '13px', fontSize: '1rem', marginTop: 4 }}
          >
            {paying
              ? <><span className="spinner spinner-sm" style={{ display: 'inline-block' }} /> Đang xử lý...</>
              : `💳 Thanh toán ${order.totalAmount?.toLocaleString('vi-VN')}đ`
            }
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card result-screen">
          {result.success ? (
            <>
              <CheckCircle size={64} color="var(--success)" className="result-icon" strokeWidth={1.5} />
              <h2 style={{ color: 'var(--success)', marginBottom: 8 }}>Thanh toán thành công!</h2>
              {result.chargeId && <p className="text-muted text-sm font-mono" style={{ marginBottom: 16 }}>Charge: {result.chargeId}</p>}
              <p className="text-muted text-sm">Tự động chuyển hướng sau <strong style={{ color: 'var(--accent)' }}>{countdown}s</strong>...</p>
              <div className="countdown-bar mt-2">
                <div className="countdown-fill" style={{ width: `${(countdown / 5) * 100}%` }} />
              </div>
              <button className="btn btn-primary mt-4 w-full" onClick={() => nav('/orders')}>
                Xem đơn hàng ngay
              </button>
            </>
          ) : (
            <>
              <XCircle size={64} color="var(--danger)" className="result-icon" strokeWidth={1.5} />
              <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Thanh toán thất bại!</h2>
              {result.reason && <p className="text-muted text-sm" style={{ marginBottom: 16 }}>{result.reason}</p>}
              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary flex-1" onClick={() => { setResult(null); }}>Thử lại</button>
                <button className="btn btn-secondary flex-1" onClick={() => nav('/orders')}>Về đơn hàng</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Order not pending */}
      {order.status !== 'PENDING_PAYMENT' && !result && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <p>Đơn hàng này không ở trạng thái chờ thanh toán.</p>
          <button className="btn btn-secondary mt-4" onClick={() => nav('/orders')}>Về đơn hàng</button>
        </div>
      )}
    </div>
  )
}
