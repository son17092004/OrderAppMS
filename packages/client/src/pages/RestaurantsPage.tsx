import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { MapPin, Phone, Search } from 'lucide-react'

interface Restaurant { id: string; name: string; address: string; phone: string; images: string[]; isActive: boolean }

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-img" />
      <div style={{ padding: 16 }}>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line w-3-4" />
        <div className="skeleton skeleton-line w-1-2" />
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const nav = useNavigate()

  useEffect(() => {
    api.get('/restaurants').then(r => setRestaurants(r.data.data ?? [])).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return restaurants.filter(r => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.address.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || (filter === 'active' ? r.isActive : !r.isActive)
      return matchSearch && matchFilter
    })
  }, [restaurants, search, filter])

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero fade-in">
        <h1>Đặt món ngon<br />mọi lúc mọi nơi</h1>
        <p>Khám phá hàng trăm nhà hàng, chọn món yêu thích và nhận hàng tận nơi trong tích tắc.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span className="badge badge-green">✓ Giao nhanh</span>
          <span className="badge badge-blue">✓ Thanh toán an toàn</span>
          <span className="badge badge-orange">✓ Đa dạng món ăn</span>
        </div>
        <div className="hero-emoji">🍜</div>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <div className="search-bar">
          <Search size={16} color="var(--muted)" />
          <input
            placeholder="Tìm kiếm nhà hàng, địa chỉ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="filter-chips">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? `Tất cả (${restaurants.length})` : f === 'active' ? `Đang mở (${restaurants.filter(r => r.isActive).length})` : `Tạm nghỉ (${restaurants.filter(r => !r.isActive).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🍽️</div>
          <p>{search ? `Không tìm thấy kết quả cho "${search}"` : 'Chưa có nhà hàng nào'}</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((r, idx) => (
            <div
              className="rest-card"
              key={r.id}
              style={{ animationDelay: `${idx * 0.05}s` }}
              onClick={() => nav(`/restaurants/${r.id}`)}
            >
              {r.images?.[0]
                ? <img src={r.images[0]} alt={r.name} />
                : <div className="no-img">🍽️</div>}
              <div className="info">
                <h3>{r.name}</h3>
                <p><MapPin size={12} style={{ marginRight: 4, display: 'inline' }} />{r.address}</p>
                <p style={{ marginTop: 4 }}><Phone size={12} style={{ marginRight: 4, display: 'inline' }} />{r.phone}</p>
                <div className="rest-tags">
                  <span className={`badge ${r.isActive ? 'badge-green' : 'badge-red'}`}>
                    {r.isActive ? '● Đang mở' : '● Tạm nghỉ'}
                  </span>
                  {r.images?.length > 1 && <span className="badge badge-blue">{r.images.length} ảnh</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
