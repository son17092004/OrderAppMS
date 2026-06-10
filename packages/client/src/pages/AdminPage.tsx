import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2 } from 'lucide-react'

interface Restaurant { id: string; name: string; address: string; phone: string; images: string[] }
interface Category { id: string; name: string; restaurantId: string }

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'restaurants' | 'foods' | 'payments'>('restaurants')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [payments, setPayments] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const foodFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingRestaurantId, setUploadingRestaurantId] = useState('')
  const [uploadingFoodId, setUploadingFoodId] = useState('')

  // Create restaurant form
  const [restForm, setRestForm] = useState({ name: '', address: '', phone: '' })
  const [catForm, setCatForm] = useState({ name: '' })
  const [foodForm, setFoodForm] = useState({ name: '', description: '', price: '', categoryId: '' })

  const fetchRestaurants = () =>
    api.get('/restaurants').then(r => setRestaurants(r.data.data))

  useEffect(() => { fetchRestaurants() }, [])

  useEffect(() => {
    if (!selectedRestaurant) return
    api.get(`/restaurants/${selectedRestaurant}/menu`)
      .then(r => setCategories(r.data.data?.categories ?? []))
  }, [selectedRestaurant])

  const createRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/restaurants', restForm)
      toast.success('Tạo nhà hàng thành công!')
      setRestForm({ name: '', address: '', phone: '' })
      fetchRestaurants()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant) { toast.error('Chọn nhà hàng trước'); return }
    try {
      await api.post(`/restaurants/${selectedRestaurant}/categories`, catForm)
      toast.success('Tạo danh mục thành công!')
      setCatForm({ name: '' })
      api.get(`/restaurants/${selectedRestaurant}/menu`).then(r => setCategories(r.data.data?.categories ?? []))
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }

  const createFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant) { toast.error('Chọn nhà hàng trước'); return }
    try {
      await api.post(`/restaurants/${selectedRestaurant}/items`, {
        ...foodForm, price: Number(foodForm.price), categoryId: foodForm.categoryId,
      })
      toast.success('Tạo món ăn thành công!')
      setFoodForm({ name: '', description: '', price: '', categoryId: '' })
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }

  const uploadRestaurantImages = async (restaurantId: string, files: FileList) => {
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('files', f))
    setUploadingRestaurantId(restaurantId)
    try {
      await api.post(`/restaurants/${restaurantId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Upload ảnh nhà hàng thành công!')
      fetchRestaurants()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi upload') }
    finally { setUploadingRestaurantId('') }
  }

  const uploadFoodImages = async (foodId: string, files: FileList) => {
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('files', f))
    setUploadingFoodId(foodId)
    try {
      await api.post(`/restaurants/items/${foodId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Upload ảnh món ăn thành công!')
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi upload') }
    finally { setUploadingFoodId('') }
  }

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Xóa nhà hàng này?')) return
    try {
      await api.delete(`/restaurants/${id}`)
      toast.success('Đã xóa')
      fetchRestaurants()
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }

  if (user?.role !== 'ADMIN' && user?.role !== 'RESTAURANT_OWNER') {
    return <div className="empty">Bạn không có quyền truy cập trang này.</div>
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 24 }}>Bảng quản trị</h1>
      <div className="flex gap-2 mb-8">
        {(['restaurants', 'foods', 'payments'] as const).map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
            {t === 'restaurants' ? 'Nhà hàng' : t === 'foods' ? 'Món ăn' : 'Thanh toán'}
          </button>
        ))}
      </div>

      {/* ─── TAB: RESTAURANTS ─── */}
      {tab === 'restaurants' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <h2>Tạo nhà hàng mới</h2>
            <div className="card">
              <form onSubmit={createRestaurant}>
                <div className="form-group">
                  <label>Tên nhà hàng</label>
                  <input value={restForm.name} onChange={e => setRestForm(p => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Địa chỉ</label>
                  <input value={restForm.address} onChange={e => setRestForm(p => ({ ...p, address: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input value={restForm.phone} onChange={e => setRestForm(p => ({ ...p, phone: e.target.value }))} required />
                </div>
                <button className="btn btn-primary w-full"><Plus size={16} />Tạo nhà hàng</button>
              </form>
            </div>
          </div>
          <div>
            <h2>Danh sách nhà hàng</h2>
            {restaurants.map(r => (
              <div className="card-sm" key={r.id} style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center">
                  <div>
                    <p style={{ fontWeight: 600 }}>{r.name}</p>
                    <p className="text-muted text-sm">{r.address}</p>
                    {r.images?.length > 0 && <p className="text-sm text-accent">{r.images.length} ảnh</p>}
                  </div>
                  <div className="flex gap-2">
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      <Upload size={14} />{uploadingRestaurantId === r.id ? '...' : 'Ảnh'}
                      <input type="file" multiple accept="image/*" style={{ display: 'none' }}
                        onChange={e => e.target.files && uploadRestaurantImages(r.id, e.target.files)} />
                    </label>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteRestaurant(r.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
                {r.images?.length > 0 && (
                  <div className="img-grid">
                    {r.images.map((img, i) => <img key={i} src={img} alt="" />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB: FOODS ─── */}
      {tab === 'foods' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <h2>Quản lý thực đơn</h2>
            <div className="card section">
              <div className="form-group">
                <label>Chọn nhà hàng</label>
                <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
                  <option value="">-- Chọn nhà hàng --</option>
                  {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {selectedRestaurant && (
              <>
                <h3 style={{ marginBottom: 12 }}>Tạo danh mục</h3>
                <div className="card section">
                  <form onSubmit={createCategory}>
                    <div className="form-group">
                      <label>Tên danh mục</label>
                      <input value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} required />
                    </div>
                    <button className="btn btn-secondary w-full"><Plus size={16} />Tạo danh mục</button>
                  </form>
                </div>

                <h3 style={{ marginBottom: 12 }}>Tạo món ăn</h3>
                <div className="card">
                  <form onSubmit={createFood}>
                    <div className="form-group">
                      <label>Danh mục</label>
                      <select value={foodForm.categoryId} onChange={e => setFoodForm(p => ({ ...p, categoryId: e.target.value }))} required>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Tên món</label>
                      <input value={foodForm.name} onChange={e => setFoodForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Mô tả</label>
                      <textarea value={foodForm.description} onChange={e => setFoodForm(p => ({ ...p, description: e.target.value }))} required />
                    </div>
                    <div className="form-group">
                      <label>Giá (VNĐ)</label>
                      <input type="number" value={foodForm.price} onChange={e => setFoodForm(p => ({ ...p, price: e.target.value }))} required min={0} />
                    </div>
                    <button className="btn btn-primary w-full"><Plus size={16} />Tạo món ăn</button>
                  </form>
                </div>
              </>
            )}
          </div>

          <div>
            <h2>Danh sách món ăn</h2>
            {!selectedRestaurant
              ? <p className="text-muted">Chọn nhà hàng để xem món ăn</p>
              : categories.length === 0
                ? <p className="text-muted">Chưa có danh mục nào</p>
                : categories.map(cat => (
                  <div key={cat.id} style={{ marginBottom: 20 }}>
                    <h4 style={{ color: 'var(--accent)', marginBottom: 8 }}>{cat.name}</h4>
                    {(cat as any).foodItems?.map((item: any) => (
                      <div className="card-sm" key={item.id} style={{ marginBottom: 8 }}>
                        <div className="flex justify-between items-center">
                          <div>
                            <p style={{ fontWeight: 600 }}>{item.name}</p>
                            <p className="text-muted text-sm">{item.price?.toLocaleString('vi-VN')}đ</p>
                            {item.images?.length > 0 && <p className="text-sm text-accent">{item.images.length} ảnh</p>}
                          </div>
                          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                            <Upload size={14} />{uploadingFoodId === item.id ? '...' : 'Ảnh'}
                            <input type="file" multiple accept="image/*" style={{ display: 'none' }}
                              onChange={e => e.target.files && uploadFoodImages(item.id, e.target.files)} />
                          </label>
                        </div>
                        {item.images?.length > 0 && (
                          <div className="img-grid">
                            {item.images.map((img: string, i: number) => <img key={i} src={img} alt="" />)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ─── TAB: PAYMENTS (Admin only) ─── */}
      {tab === 'payments' && (
        <div>
          <h2>Xem lịch sử thanh toán</h2>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Nhập Order ID để tra cứu thanh toán (Admin only)</p>
          <div className="card" style={{ maxWidth: 480 }}>
            <PaymentLookup />
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentLookup() {
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const lookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api.get(`/payments/order/${orderId}`)
      setResult(r.data.data)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Không tìm thấy')
      setResult(null)
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={lookup}>
      <div className="form-group">
        <label>Order ID</label>
        <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="uuid..." required style={{ fontFamily: 'monospace' }} />
      </div>
      <button className="btn btn-primary w-full" disabled={loading}>{loading ? '...' : 'Tra cứu'}</button>
      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="flex justify-between mb-4"><span className="text-muted">Status</span><span className={`badge ${result.status === 'COMPLETED' ? 'badge-green' : 'badge-red'}`}>{result.status}</span></div>
          <div className="flex justify-between mb-4"><span className="text-muted">Amount</span><span>${result.amount}</span></div>
          {result.transactionId && <div className="flex justify-between"><span className="text-muted">Transaction ID</span><span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{result.transactionId}</span></div>}
        </div>
      )}
    </form>
  )
}

function toast_error(msg: string) { toast.error(msg) }
