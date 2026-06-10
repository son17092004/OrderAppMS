import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { CreditCard, CheckCircle, XCircle } from 'lucide-react'

const STRIPE_TOKENS = [
  { label: 'Visa (thành công)', value: 'tok_visa', color: '#22c55e' },
  { label: 'Mastercard (thành công)', value: 'tok_mastercard', color: '#22c55e' },
  { label: 'Card Declined', value: 'tok_chargeDeclined', color: '#ef4444' },
  { label: 'Expired Card', value: 'tok_chargeDeclinedExpiredCard', color: '#ef4444' },
]

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const nav = useNavigate()
  const [order, setOrder] = useState<any>(null)
  const [selectedToken, setSelectedToken] = useState('tok_visa')
  const [paying, setPaying] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(r => setOrder(r.data.data))
  }, [orderId])

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
    <div className="page" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Thanh toán</h1>

      <div className="card section">
        <h3 style={{ marginBottom: 12 }}>Chi tiết đơn hàng</h3>
        <div className="flex justify-between mb-4">
          <span className="text-muted">Mã đơn</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{order.id}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span className="text-muted">Trạng thái</span>
          <span className={`badge ${order.status === 'CONFIRMED' ? 'badge-green' : order.status === 'CANCELLED' ? 'badge-red' : 'badge-orange'}`}>
            {order.status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Tổng tiền</span>
          <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent)' }}>
            ${order.totalAmount}
          </span>
        </div>
      </div>

      {!result && order.status === 'PENDING_PAYMENT' && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>
            <CreditCard size={18} style={{ marginRight: 8, display: 'inline' }} />
            Chọn thẻ thanh toán (Mock Stripe)
          </h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Chọn token để mô phỏng kết quả thanh toán:
          </p>
          <div className="token-row">
            {STRIPE_TOKENS.map(t => (
              <div
                key={t.value}
                className="token-chip"
                style={{
                  borderColor: selectedToken === t.value ? t.color : '',
                  color: selectedToken === t.value ? t.color : '',
                }}
                onClick={() => setSelectedToken(t.value)}
              >
                {t.label}
              </div>
            ))}
          </div>
          <div className="form-group mt-4">
            <label>Token đã chọn</label>
            <input readOnly value={selectedToken} style={{ fontFamily: 'monospace' }} />
          </div>
          <button className="btn btn-primary w-full" onClick={pay} disabled={paying}>
            {paying ? 'Đang xử lý...' : `Thanh toán $${order.totalAmount}`}
          </button>
        </div>
      )}

      {result && (
        <div className="card" style={{ textAlign: 'center' }}>
          {result.success
            ? <CheckCircle size={52} color="var(--success)" style={{ margin: '0 auto 16px' }} />
            : <XCircle size={52} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
          }
          <h2 style={{ color: result.success ? 'var(--success)' : 'var(--danger)', marginBottom: 8 }}>
            {result.success ? 'Thanh toán thành công!' : 'Thanh toán thất bại!'}
          </h2>
          {result.chargeId && <p className="text-muted text-sm">Charge ID: {result.chargeId}</p>}
          {result.reason && <p className="text-muted text-sm">{result.reason}</p>}
          <button className="btn btn-secondary mt-4" onClick={() => nav('/orders')}>Xem đơn hàng</button>
        </div>
      )}

      {order.status !== 'PENDING_PAYMENT' && !result && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          Đơn hàng này không ở trạng thái chờ thanh toán.
          <br /><button className="btn btn-secondary mt-4" onClick={() => nav('/orders')}>Về đơn hàng</button>
        </div>
      )}
    </div>
  )
}
