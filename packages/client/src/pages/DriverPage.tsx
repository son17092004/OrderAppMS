import { useEffect, useState } from 'react'
import api from '../api/client'
import { Check, X, MapPin, Truck, AlertTriangle, CheckCircle, Package } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Delivery {
  id: string
  orderId: string
  restaurantId: string
  restaurantName: string
  userId: string
  userEmail: string
  deliveryAddress: string | null
  status: 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED'
  driverId: string | null
  failReason: string | null
  createdAt: string
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  ASSIGNED: 'Chờ tài xế',
  PICKED_UP: 'Đang giao hàng',
  DELIVERED: 'Đã giao thành công',
  CANCELLED: 'Đã hủy / Thất bại',
}
const DELIVERY_STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-yellow',
  ASSIGNED: 'badge-yellow',
  PICKED_UP: 'badge-blue',
  DELIVERED: 'badge-green',
  CANCELLED: 'badge-red',
}

export default function DriverPage() {
  const { user } = useAuth()
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([])
  const [myDeliveries, setMyDeliveries] = useState<Delivery[]>([])
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = async () => {
    if (!user || user.role !== 'DRIVER') return
    setLoading(true)
    try {
      const [availRes, myRes] = await Promise.all([
        api.get('/deliveries/available'),
        api.get('/deliveries/driver')
      ])
      setAvailableDeliveries(availRes.data?.data || [])
      setMyDeliveries(myRes.data?.data || [])
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Không thể tải danh sách giao hàng', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  const handleAccept = async (orderId: string) => {
    setActionLoading(orderId)
    try {
      await api.post(`/deliveries/accept/${orderId}`)
      showToast('Đã nhận đơn giao hàng thành công!', 'success')
      fetchData()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi nhận giao đơn', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async (orderId: string) => {
    setActionLoading(orderId)
    try {
      await api.post(`/deliveries/complete/${orderId}`)
      showToast('Đã cập nhật đơn hàng hoàn thành!', 'success')
      fetchData()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleFail = async (orderId: string) => {
    const reason = prompt('Vui lòng nhập lý do giao hàng thất bại:')
    if (reason === null) return
    if (!reason.trim()) {
      showToast('Vui lòng nhập lý do thất bại', 'error')
      return
    }

    setActionLoading(orderId)
    try {
      await api.post(`/deliveries/fail/${orderId}`, { reason })
      showToast('Đã cập nhật đơn hàng giao thất bại và huỷ đơn thành công.', 'success')
      fetchData()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (!user || user.role !== 'DRIVER') {
    return (
      <div className="page" style={{ padding: '40px', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="empty" style={{ maxWidth: '480px', margin: '0 auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px' }}>
          <AlertTriangle size={48} className="empty-icon" style={{ strokeWidth: 1.5, color: '#ef4444', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Quyền truy cập bị từ chối</h2>
          <p className="text-muted text-sm" style={{ marginBottom: '16px', lineHeight: '1.5' }}>
            Bảng điều khiển này chỉ dành riêng cho Tài xế (DRIVER). Tài khoản hiện tại của bạn ({user?.role || 'Khách'}) không có quyền truy cập trang này.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>Bảng điều khiển tài xế</h1>
          <p className="text-muted text-sm">Nhận đơn và cập nhật trạng thái vận chuyển cho các đơn hàng của bạn.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchData} disabled={loading}>
          Làm mới dữ liệu
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-val" style={{ color: '#3b82f6' }}>
            {availableDeliveries.length}
          </div>
          <div className="stat-label">Đơn chờ tài xế</div>
        </div>

        <div className="stat-card">
          <div className="stat-val" style={{ color: '#f59e0b' }}>
            {myDeliveries.filter(d => d.status !== 'DELIVERED' && d.status !== 'CANCELLED').length}
          </div>
          <div className="stat-label">Đơn đang nhận giao</div>
        </div>

        <div className="stat-card">
          <div className="stat-val" style={{ color: '#10b981' }}>
            {myDeliveries.filter(d => d.status === 'DELIVERED').length}
          </div>
          <div className="stat-label">Đơn hoàn thành</div>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-item ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
        >
          Đơn chờ nhận ({availableDeliveries.length})
        </button>
        <button
          className={`tab-item ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          Đơn của tôi ({myDeliveries.length})
        </button>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : activeTab === 'available' ? (
        <div className="table-wrap" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 0' }}>
          {availableDeliveries.length === 0 ? (
            <div className="empty" style={{ padding: '40px' }}>
              <Package size={48} className="empty-icon" style={{ strokeWidth: 1.5 }} />
              <p>Không có đơn hàng nào chờ tài xế</p>
              <p className="text-muted text-xs" style={{ marginTop: 4 }}>
                Các đơn hàng sau khi hoàn tất thanh toán sẽ tự động xuất hiện ở đây.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Nhà hàng</th>
                  <th>Khách hàng</th>
                  <th>Địa chỉ giao</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {availableDeliveries.map(d => (
                  <tr key={d.id}>
                    <td><span className="font-mono text-sm">{d.orderId.substring(0, 8)}...</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} style={{ color: '#ec4899' }} />
                        <strong>{d.restaurantName || 'Unknown Restaurant'}</strong>
                      </div>
                    </td>
                    <td>{d.userEmail || 'Unknown Customer'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', maxWidth: 200 }}>
                        <MapPin size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                          {d.deliveryAddress || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Không có địa chỉ</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${DELIVERY_STATUS_BADGE[d.status] ?? 'badge-yellow'}`}>
                        {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAccept(d.orderId)}
                        disabled={actionLoading !== null}
                      >
                        {actionLoading === d.orderId ? 'Đang nhận...' : 'Nhận giao đơn'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="table-wrap" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 0' }}>
          {myDeliveries.length === 0 ? (
            <div className="empty" style={{ padding: '40px' }}>
              <Truck size={48} className="empty-icon" style={{ strokeWidth: 1.5 }} />
              <p>Bạn chưa nhận giao đơn hàng nào</p>
              <p className="text-muted text-xs" style={{ marginTop: 4 }}>
                Chuyển qua tab "Đơn chờ nhận" để nhận đơn hàng đầu tiên.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Nhà hàng</th>
                  <th>Khách hàng</th>
                  <th>Địa chỉ giao</th>
                  <th>Trạng thái</th>
                  <th>Lý do thất bại</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {myDeliveries.map(d => (
                  <tr key={d.id}>
                    <td><span className="font-mono text-sm">{d.orderId.substring(0, 8)}...</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} style={{ color: '#ec4899' }} />
                        <strong>{d.restaurantName || 'Unknown Restaurant'}</strong>
                      </div>
                    </td>
                    <td>{d.userEmail || 'Unknown Customer'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', maxWidth: 200 }}>
                        <MapPin size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                          {d.deliveryAddress || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Không có địa chỉ</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${DELIVERY_STATUS_BADGE[d.status] ?? 'badge-blue'}`}>
                        {DELIVERY_STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td>
                      {d.failReason ? (
                        <span style={{ color: 'var(--danger)', fontSize: '13px' }}>
                          {d.failReason}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {d.status === 'ASSIGNED' || d.status === 'PICKED_UP' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-sm btn-success"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleComplete(d.orderId)}
                            disabled={actionLoading !== null}
                          >
                            <Check size={14} /> Giao xong
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleFail(d.orderId)}
                            disabled={actionLoading !== null}
                          >
                            <X size={14} /> Báo lỗi
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Đã kết thúc</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
