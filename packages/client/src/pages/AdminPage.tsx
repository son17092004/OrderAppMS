import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2, ToggleLeft, ToggleRight, CreditCard, Store, Utensils, Search, UserCheck, X, Users, ShieldAlert, Shield, ShieldOff } from 'lucide-react'

interface Restaurant { id: string; name: string; address: string; phone: string; images: string[]; ownerId: string; isActive: boolean }
interface Category { id: string; name: string; restaurantId: string; foodItems?: FoodItem[] }
interface FoodItem { id: string; name: string; price: number; images: string[]; isAvailable: boolean; description: string }
interface Order { id: string; status: string; totalAmount: number; createdAt: string; items: any[]; restaurantId: string; restaurantName?: string; userEmail?: string; userId: string }
interface UserResult { id: string; email: string; role: string; isBanned?: boolean }

const STATUS_BADGE: Record<string, string> = { CONFIRMED: 'badge-green', CANCELLED: 'badge-red', PENDING_PAYMENT: 'badge-yellow' }
const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Đã xác nhận', CANCELLED: 'Đã hủy', PENDING_PAYMENT: 'Chờ TT' }

// ─── UserPicker Component ──────────────────────────────────────────────────────
function UserPicker({ value, onChange }: { value: string; onChange: (email: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [selected, setSelected] = useState<UserResult | null>(null)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.get(`/auth/users/search?q=${encodeURIComponent(query)}`)
        setResults(r.data.data ?? [])
        setOpen(true)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const select = (u: UserResult) => {
    setSelected(u)
    onChange(u.email)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const clear = () => { setSelected(null); onChange(''); setQuery('') }

  const ROLE_BADGE: Record<string, string> = { ADMIN: 'badge-red', RESTAURANT_OWNER: 'badge-orange', CUSTOMER: 'badge-blue' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ fontSize: '0.84rem', color: 'var(--muted)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
        <UserCheck size={13} style={{ marginRight: 4, display: 'inline' }} />Chủ nhà hàng
      </label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selected.email}</span>
            <span className={`badge ${ROLE_BADGE[selected.role] ?? 'badge-blue'}`} style={{ marginLeft: 8, fontSize: '0.65rem' }}>{selected.role}</span>
          </div>
          <button type="button" onClick={clear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
            <X size={15} />
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Tìm theo email..."
            style={{ paddingLeft: 36 }}
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {searching && <span className="spinner spinner-sm" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />}
        </div>
      )}
      {open && results.length > 0 && !selected && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: 'var(--shadow)', maxHeight: 220, overflowY: 'auto', marginTop: 4,
        }}>
          {results.map(u => (
            <div
              key={u.id}
              onMouseDown={() => select(u)}
              style={{
                padding: '10px 14px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: '0.88rem' }}>{u.email}</span>
              <span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>{u.role}</span>
            </div>
          ))}
        </div>
      )}
      {open && !searching && results.length === 0 && query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
          Không tìm thấy user nào với email "{query}"
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'restaurants' | 'foods' | 'payments' | 'users'>('restaurants')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState('')
  const [uploadingRestaurantId, setUploadingRestaurantId] = useState('')
  const [uploadingFoodId, setUploadingFoodId] = useState('')
  const [togglingFoodId, setTogglingFoodId] = useState('')
  const [usersList, setUsersList] = useState<UserResult[]>([])

  const [restForm, setRestForm] = useState({ name: '', address: '', phone: '', ownerEmail: '' })
  const [editForm, setEditForm] = useState({ id: '', name: '', address: '', phone: '', isActive: true })
  const [catForm, setCatForm] = useState({ name: '' })
  const [foodForm, setFoodForm] = useState({ name: '', description: '', price: '', categoryId: '' })

  const fetchRestaurants = () => api.get('/restaurants').then(r => setRestaurants(r.data.data ?? []))
  const fetchMenu = (rid: string) => api.get(`/restaurants/${rid}/menu`).then(r => setCategories(r.data.data?.categories ?? []))
  const fetchUsers = () => api.get('/auth/users').then(r => setUsersList(r.data.data ?? []))

  const displayedRestaurants = user?.role === 'ADMIN' ? restaurants : restaurants.filter(r => r.ownerId === user?.id)

  useEffect(() => { fetchRestaurants() }, [])
  useEffect(() => { if (selectedRestaurant) fetchMenu(selectedRestaurant) }, [selectedRestaurant])
  useEffect(() => { if (tab === 'users' && user?.role === 'ADMIN') fetchUsers() }, [tab, user])

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await api.post(`/auth/users/${userId}/role`, { role })
      toast.success('Cập nhật role thành công!')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật role')
    }
  }

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    try {
      await api.post(`/auth/ban/${userId}`, { isBanned })
      toast.success(isBanned ? 'Đã khóa tài khoản!' : 'Đã mở khóa tài khoản!')
      fetchUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi cập nhật trạng thái')
    }
  }

  const createRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api.post('/restaurants', restForm); toast.success('Tạo nhà hàng thành công!'); setRestForm({ name: '', address: '', phone: '', ownerEmail: '' }); fetchRestaurants() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const handleUpdateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api.put(`/restaurants/${editForm.id}`, { name: editForm.name, address: editForm.address, phone: editForm.phone, isActive: editForm.isActive }); toast.success('Cập nhật thành công!'); fetchRestaurants() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant) { toast.error('Chọn nhà hàng trước'); return }
    try { await api.post(`/restaurants/${selectedRestaurant}/categories`, catForm); toast.success('Tạo danh mục thành công!'); setCatForm({ name: '' }); fetchMenu(selectedRestaurant) }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const createFood = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRestaurant) { toast.error('Chọn nhà hàng trước'); return }
    try {
      await api.post(`/restaurants/${selectedRestaurant}/items`, { ...foodForm, price: Number(foodForm.price) })
      toast.success('Tạo món ăn thành công!'); setFoodForm({ name: '', description: '', price: '', categoryId: '' }); fetchMenu(selectedRestaurant)
    } catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const toggleFoodAvailability = async (item: FoodItem) => {
    setTogglingFoodId(item.id)
    try {
      await api.patch(`/restaurants/items/${item.id}`, { isAvailable: !item.isAvailable })
      toast.success(`Đã ${!item.isAvailable ? 'bật' : 'tắt'} món ${item.name}`)
      if (selectedRestaurant) fetchMenu(selectedRestaurant)
    } catch { toast.error('Không thể cập nhật trạng thái') }
    finally { setTogglingFoodId('') }
  }
  const uploadRestaurantImages = async (restaurantId: string, files: FileList) => {
    const fd = new FormData(); Array.from(files).forEach(f => fd.append('files', f))
    setUploadingRestaurantId(restaurantId)
    try { await api.post(`/restaurants/${restaurantId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Upload ảnh thành công!'); fetchRestaurants() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi upload') }
    finally { setUploadingRestaurantId('') }
  }
  const uploadFoodImages = async (foodId: string, files: FileList) => {
    const fd = new FormData(); Array.from(files).forEach(f => fd.append('files', f))
    setUploadingFoodId(foodId)
    try { await api.post(`/restaurants/items/${foodId}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Upload ảnh thành công!'); if (selectedRestaurant) fetchMenu(selectedRestaurant) }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi upload') }
    finally { setUploadingFoodId('') }
  }
  const deleteRestaurantImage = async (restaurantId: string, imageUrl: string) => {
    if (!confirm('Xóa ảnh này?')) return
    try { await api.delete(`/restaurants/${restaurantId}/images`, { data: { imageUrl } }); toast.success('Đã xóa ảnh!'); fetchRestaurants() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const deleteFoodImage = async (foodId: string, imageUrl: string) => {
    if (!confirm('Xóa ảnh này?')) return
    try { await api.delete(`/restaurants/items/${foodId}/images`, { data: { imageUrl } }); toast.success('Đã xóa ảnh!'); if (selectedRestaurant) fetchMenu(selectedRestaurant) }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const deleteFood = async (itemId: string) => {
    if (!confirm('Xóa món ăn này?')) return
    try { await api.delete(`/restaurants/items/${itemId}`); toast.success('Đã xóa món ăn!'); if (selectedRestaurant) fetchMenu(selectedRestaurant) }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }
  const deleteRestaurant = async (id: string) => {
    if (!confirm('Xóa nhà hàng này?')) return
    try { await api.delete(`/restaurants/${id}`); toast.success('Đã xóa'); fetchRestaurants() }
    catch (err: any) { toast.error(err.response?.data?.message ?? 'Lỗi') }
  }

  if (user?.role !== 'ADMIN' && user?.role !== 'RESTAURANT_OWNER')
    return <div className="empty">Bạn không có quyền truy cập trang này.</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Bảng quản trị</h1>
          <p className="text-muted text-sm">{user.role === 'ADMIN' ? 'Quản trị viên hệ thống' : 'Chủ nhà hàng'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[
          { key: 'restaurants', label: 'Nhà hàng', icon: <Store size={14} /> },
          { key: 'foods', label: 'Món ăn', icon: <Utensils size={14} /> },
          { key: 'payments', label: 'Đơn hàng & TT', icon: <CreditCard size={14} /> },
          ...(user?.role === 'ADMIN' ? [{ key: 'users', label: 'Người dùng', icon: <Users size={14} /> }] : []),
        ].map(t => (
          <button key={t.key} className={`tab-item ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key as any)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB RESTAURANTS ─── */}
      {tab === 'restaurants' && (
        <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            {user?.role === 'ADMIN' && (
              <div className="section">
                <h2>Tạo nhà hàng mới</h2>
                <div className="card">
                  <form onSubmit={createRestaurant}>
                    <div className="form-group">
                      <UserPicker
                        value={restForm.ownerEmail}
                        onChange={email => setRestForm(p => ({ ...p, ownerEmail: email }))}
                      />
                    </div>
                    <div className="form-group"><label>Tên nhà hàng</label><input value={restForm.name} onChange={e => setRestForm(p => ({ ...p, name: e.target.value }))} required /></div>
                    <div className="grid-2">
                      <div className="form-group"><label>Địa chỉ</label><input value={restForm.address} onChange={e => setRestForm(p => ({ ...p, address: e.target.value }))} required /></div>
                      <div className="form-group"><label>Số điện thoại</label><input value={restForm.phone} onChange={e => setRestForm(p => ({ ...p, phone: e.target.value }))} required /></div>
                    </div>
                    <button className="btn btn-primary w-full" disabled={!restForm.ownerEmail}><Plus size={16} />Tạo nhà hàng</button>
                  </form>
                </div>
              </div>
            )}
            {editForm.id && (
              <div className="section">
                <h2>Chỉnh sửa nhà hàng</h2>
                <div className="card">
                  <form onSubmit={handleUpdateRestaurant}>
                    <div className="form-group"><label>Tên nhà hàng</label><input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required /></div>
                    <div className="grid-2">
                      <div className="form-group"><label>Địa chỉ</label><input value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} required /></div>
                      <div className="form-group"><label>Số điện thoại</label><input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} required /></div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <input type="checkbox" id="isActive" checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} />
                      <label htmlFor="isActive" style={{ margin: 0, cursor: 'pointer' }}>Đang hoạt động</label>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-primary flex-1">Cập nhật</button>
                      <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditForm({ id: '', name: '', address: '', phone: '', isActive: true })}>Hủy</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div>
            <h2>Danh sách nhà hàng ({displayedRestaurants.length})</h2>
            {displayedRestaurants.map(r => (
              <div className="card-sm" key={r.id} style={{ marginBottom: 12 }}>
                <div className="flex justify-between items-center mb-2">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <p style={{ fontWeight: 700, margin: 0 }} className="truncate">{r.name}</p>
                      <span className={`badge ${r.isActive ? 'badge-green' : 'badge-red'}`} style={{ flexShrink: 0 }}>
                        {r.isActive ? 'Mở' : 'Đóng'}
                      </span>
                    </div>
                    <p className="text-muted text-xs truncate">{r.address}</p>
                  </div>
                  <div className="flex gap-2" style={{ flexShrink: 0, marginLeft: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditForm({ id: r.id, name: r.name, address: r.address, phone: r.phone, isActive: r.isActive })}>Sửa</button>
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      <Upload size={13} />{uploadingRestaurantId === r.id ? '...' : 'Ảnh'}
                      <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files && uploadRestaurantImages(r.id, e.target.files)} />
                    </label>
                    {user?.role === 'ADMIN' && <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRestaurant(r.id)}><Trash2 size={13} /></button>}
                  </div>
                </div>
                {r.images?.length > 0 && (
                  <div className="img-grid">
                    {r.images.map((img, i) => (
                      <div className="img-item" key={i}>
                        <img src={img} alt="" />
                        <div className="delete-overlay" onClick={() => deleteRestaurantImage(r.id, img)}>
                          <button type="button" className="delete-btn"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB FOODS ─── */}
      {tab === 'foods' && (
        <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <h2>Quản lý thực đơn</h2>
            <div className="card section">
              <div className="form-group">
                <label>Chọn nhà hàng</label>
                <select value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
                  <option value="">-- Chọn nhà hàng --</option>
                  {displayedRestaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            {selectedRestaurant && (
              <>
                <h3>Tạo danh mục</h3>
                <div className="card section">
                  <form onSubmit={createCategory}>
                    <div className="form-group"><label>Tên danh mục</label><input value={catForm.name} onChange={e => setCatForm({ name: e.target.value })} required /></div>
                    <button className="btn btn-secondary w-full"><Plus size={15} />Tạo danh mục</button>
                  </form>
                </div>
                <h3>Tạo món ăn</h3>
                <div className="card">
                  <form onSubmit={createFood}>
                    <div className="form-group"><label>Danh mục</label>
                      <select value={foodForm.categoryId} onChange={e => setFoodForm(p => ({ ...p, categoryId: e.target.value }))} required>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label>Tên món</label><input value={foodForm.name} onChange={e => setFoodForm(p => ({ ...p, name: e.target.value }))} required /></div>
                    <div className="form-group"><label>Mô tả</label><textarea value={foodForm.description} onChange={e => setFoodForm(p => ({ ...p, description: e.target.value }))} required /></div>
                    <div className="form-group"><label>Giá (VNĐ)</label><input type="number" value={foodForm.price} onChange={e => setFoodForm(p => ({ ...p, price: e.target.value }))} required min={0} /></div>
                    <button className="btn btn-primary w-full"><Plus size={15} />Tạo món ăn</button>
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
                    <h4 style={{ color: 'var(--accent)', marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{cat.name}</h4>
                    {cat.foodItems?.map((item: FoodItem) => (
                      <div className="card-sm" key={item.id} style={{ marginBottom: 8 }}>
                        <div className="flex justify-between items-start mb-2">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 mb-1">
                              <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0 }} className="truncate">{item.name}</p>
                              <span className={`badge ${item.isAvailable ? 'badge-green' : 'badge-red'}`} style={{ flexShrink: 0, fontSize: '0.65rem' }}>
                                {item.isAvailable ? 'Còn' : 'Hết'}
                              </span>
                            </div>
                            <p className="text-muted text-sm">{item.price?.toLocaleString('vi-VN')}đ</p>
                          </div>
                          <div className="flex gap-2" style={{ flexShrink: 0, marginLeft: 8 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => toggleFoodAvailability(item)}
                              disabled={togglingFoodId === item.id}
                              title={item.isAvailable ? 'Tắt món' : 'Bật món'}
                            >
                              {item.isAvailable ? <ToggleRight size={15} color="var(--success)" /> : <ToggleLeft size={15} color="var(--muted)" />}
                            </button>
                            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                              <Upload size={13} />{uploadingFoodId === item.id ? '...' : ''}
                              <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files && uploadFoodImages(item.id, e.target.files)} />
                            </label>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteFood(item.id)}><Trash2 size={13} /></button>
                          </div>
                        </div>
                        {item.images?.length > 0 && (
                          <div className="img-grid">
                            {item.images.map((img: string, i: number) => (
                              <div className="img-item" key={i}>
                                <img src={img} alt="" />
                                <div className="delete-overlay" onClick={() => deleteFoodImage(item.id, img)}>
                                  <button type="button" className="delete-btn"><Trash2 size={13} /></button>
                                </div>
                              </div>
                            ))}
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

      {/* ─── TAB PAYMENTS ─── */}
      {tab === 'payments' && <PaymentsTab displayedRestaurants={displayedRestaurants} isAdmin={user?.role === 'ADMIN'} />}

      {/* ─── TAB USERS ─── */}
      {tab === 'users' && user?.role === 'ADMIN' && (
        <UsersTab users={usersList} onUpdateRole={handleUpdateRole} onBanToggle={handleBanToggle} />
      )}
    </div>
  )
}

function PaymentsTab({ displayedRestaurants, isAdmin }: { displayedRestaurants: Restaurant[]; isAdmin: boolean }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState<any>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/orders/management').then(r => setOrders(r.data.data ?? [])).finally(() => setLoading(false))
  }, [])

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanId = lookupId.trim();
    if (!cleanId) {
      toast.error('Vui lòng điền mã đơn hàng!');
      return;
    }

    // Strip leading '#' if present
    if (cleanId.startsWith('#')) {
      cleanId = cleanId.substring(1);
    }

    // Auto-resolve 8-char short ID to full UUID if matched in orders
    if (cleanId.length === 8) {
      const matched = orders.find(o => o.id.slice(0, 8).toLowerCase() === cleanId.toLowerCase());
      if (matched) {
        cleanId = matched.id;
      }
    }

    setLookupLoading(true)
    try {
      const r = await api.get(`/payments/order/${cleanId}`);
      setLookupResult(r.data.data);
    }
    catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Không tìm thấy thông tin thanh toán');
      setLookupResult(null);
    }
    finally {
      setLookupLoading(false);
    }
  }

  const handleQuickLookup = async (id: string) => {
    setLookupId(id)
    setLookupLoading(true)
    try {
      const r = await api.get(`/payments/order/${id}`)
      setLookupResult(r.data.data)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Không tìm thấy thông tin thanh toán')
      setLookupResult(null)
    } finally {
      setLookupLoading(false)
    }
  }

  const totalRevenue = orders.filter(o => o.status === 'CONFIRMED').reduce((s, o) => s + o.totalAmount, 0)
  const pending = orders.filter(o => o.status === 'PENDING_PAYMENT').length

  return (
    <div>
      {/* Stats */}
      <div className="stat-grid section">
        <div className="stat-card"><span className="stat-val">{orders.length}</span><span className="stat-label">Tổng đơn hàng</span></div>
        <div className="stat-card"><span className="stat-val" style={{ fontSize: '1.1rem' }}>{totalRevenue.toLocaleString('vi-VN')}đ</span><span className="stat-label">Doanh thu xác nhận</span></div>
        <div className="stat-card"><span className="stat-val" style={{ color: 'var(--warning)' }}>{pending}</span><span className="stat-label">Chờ thanh toán</span></div>
        <div className="stat-card"><span className="stat-val" style={{ color: 'var(--success)' }}>{orders.filter(o => o.status === 'CONFIRMED').length}</span><span className="stat-label">Đã xác nhận</span></div>
      </div>

      <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Orders Table */}
        <div>
          <h2>Tất cả đơn hàng</h2>
          {loading ? <div className="spinner" /> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Thời gian</th>
                      <th>Khách hàng</th>
                      <th>Nhà hàng</th>
                      <th>Chi tiết món</th>
                      <th>Trạng thái</th>
                      <th>Tổng tiền</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Chưa có đơn hàng</td></tr>
                    ) : orders.map(o => {
                      const restName = o.restaurantName || displayedRestaurants.find(r => r.id === o.restaurantId)?.name || `ID: ${o.restaurantId.slice(0, 8)}...`;
                      return (
                        <tr key={o.id}>
                          <td className="font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</td>
                          <td className="text-muted text-xs">{new Date(o.createdAt).toLocaleString('vi-VN')}</td>
                          <td className="text-xs" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.userEmail || o.userId}>
                            {o.userEmail || o.userId.slice(0, 8) + '...'}
                          </td>
                          <td style={{ fontWeight: 500 }} className="text-xs">{restName}</td>
                          <td>
                            <div className="text-xs text-muted" style={{ maxHeight: 60, overflowY: 'auto' }}>
                              {o.items?.map((item: any) => (
                                <div key={item.id} style={{ whiteSpace: 'nowrap' }}>
                                  • {item.name} <span style={{ color: 'var(--accent)' }}>x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td><span className={`badge ${STATUS_BADGE[o.status] ?? 'badge-blue'}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }} className="text-xs">{o.totalAmount.toLocaleString('vi-VN')}đ</td>
                          <td>
                            {o.status === 'PENDING_PAYMENT' && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleQuickLookup(o.id)}>
                                Tra cứu TT
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Payment Lookup */}
        <div>
          <h2>Tra cứu thanh toán</h2>
          <div className="card">
            <form onSubmit={lookup}>
              <div className="form-group">
                <label>Order ID</label>
                <input value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="uuid..." required className="font-mono" style={{ fontSize: '0.8rem' }} />
              </div>
              <button className="btn btn-primary w-full" disabled={lookupLoading}>{lookupLoading ? 'Đang tìm...' : 'Tra cứu'}</button>
            </form>
            {lookupResult && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div className="flex justify-between mb-2"><span className="text-muted text-sm">Trạng thái</span><span className={`badge ${lookupResult.status === 'COMPLETED' ? 'badge-green' : 'badge-red'}`}>{lookupResult.status}</span></div>
                <div className="flex justify-between mb-2"><span className="text-muted text-sm">Số tiền</span><span style={{ fontWeight: 700, color: 'var(--accent)' }}>{lookupResult.amount?.toLocaleString('vi-VN')}đ</span></div>
                {lookupResult.transactionId && <div className="flex justify-between"><span className="text-muted text-sm">Transaction ID</span><span className="font-mono text-xs">{lookupResult.transactionId}</span></div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function toast_error(msg: string) { toast.error(msg) }

function UsersTab({
  users,
  onUpdateRole,
  onBanToggle,
}: {
  users: UserResult[];
  onUpdateRole: (userId: string, role: string) => void;
  onBanToggle: (userId: string, isBanned: boolean) => void;
}) {
  const [search, setSearch] = useState('')
  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))

  const ROLE_BADGE: Record<string, string> = {
    ADMIN: 'badge-red',
    RESTAURANT_OWNER: 'badge-orange',
    CUSTOMER: 'badge-blue',
  }

  return (
    <div>
      <div className="section flex justify-between items-center" style={{ marginBottom: 16 }}>
        <h2>Quản lý người dùng</h2>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo email..."
            style={{ paddingLeft: 36, margin: 0 }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Vai trò (Role)</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                    Không có người dùng nào khớp
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{u.email}</span>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => onUpdateRole(u.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                          fontSize: '0.85rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="CUSTOMER">CUSTOMER</option>
                        <option value="RESTAURANT_OWNER">RESTAURANT_OWNER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.isBanned ? 'badge-red' : 'badge-green'}`}>
                        {u.isBanned ? 'Bị khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${u.isBanned ? 'btn-primary' : 'btn-danger'}`}
                        onClick={() => onBanToggle(u.id, !u.isBanned)}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        {u.isBanned ? (
                          <>
                            <Shield size={12} style={{ marginRight: 4, display: 'inline' }} />Kích hoạt
                          </>
                        ) : (
                          <>
                            <ShieldOff size={12} style={{ marginRight: 4, display: 'inline' }} />Khóa
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
