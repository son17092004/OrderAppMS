import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { MapPin, Phone, Image as ImageIcon } from 'lucide-react'

interface Restaurant { id: string; name: string; address: string; phone: string; images: string[]; isActive: boolean }

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/restaurants').then(r => setRestaurants(r.data.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Nhà hàng</h1>
          <p className="text-muted">Khám phá {restaurants.length} nhà hàng đang hoạt động</p>
        </div>
      </div>
      {restaurants.length === 0
        ? <div className="empty"><ImageIcon size={48} /><p className="mt-4">Chưa có nhà hàng nào</p></div>
        : (
          <div className="card-grid">
            {restaurants.map(r => (
              <div className="rest-card" key={r.id} onClick={() => nav(`/restaurants/${r.id}`)}>
                {r.images?.[0]
                  ? <img src={r.images[0]} alt={r.name} />
                  : <div className="no-img">🍽️</div>}
                <div className="info">
                  <h3>{r.name}</h3>
                  <p><MapPin size={12} style={{ marginRight: 4, display: 'inline' }} />{r.address}</p>
                  <p style={{ marginTop: 4 }}><Phone size={12} style={{ marginRight: 4, display: 'inline' }} />{r.phone}</p>
                  {r.images?.length > 1 && <p className="text-sm text-muted" style={{ marginTop: 6 }}>{r.images.length} ảnh</p>}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
