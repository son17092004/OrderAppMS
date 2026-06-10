import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { ShoppingCart, Plus, MapPin, Phone, ChevronLeft } from 'lucide-react'

interface FoodItem { id: string; name: string; description: string; price: number; images: string[]; isAvailable: boolean; categoryId: string }
interface Category { id: string; name: string; foodItems: FoodItem[] }
interface Restaurant { id: string; name: string; address: string; phone: string; images: string[]; categories: Category[] }

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const nav = useNavigate()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [mainImg, setMainImg] = useState(0)

  useEffect(() => {
    api.get(`/restaurants/${id}/menu`).then(r => setRestaurant(r.data.data)).finally(() => setLoading(false))
  }, [id])

  const addToCart = async (item: FoodItem) => {
    if (!user) { toast.error('Vui lòng đăng nhập'); nav('/login'); return }
    setAddingItem(item.id)
    try {
      await api.post('/cart/items', { foodItemId: item.id, quantity: 1 })
      toast.success(`Đã thêm ${item.name} vào giỏ!`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Lỗi khi thêm vào giỏ')
    } finally {
      setAddingItem(null)
    }
  }

  if (loading) return <div className="spinner" />
  if (!restaurant) return <div className="empty">Không tìm thấy nhà hàng</div>

  const allImages = restaurant.images ?? []

  return (
    <div className="page">
      <button className="btn btn-ghost mb-4" onClick={() => nav(-1)}><ChevronLeft size={16} />Quay lại</button>

      {/* Hero */}
      <div className="card section">
        {allImages.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <img src={allImages[mainImg]} alt={restaurant.name} style={{ width: '100%', height: 280, objectFit: 'cover', borderRadius: 10 }} />
            {allImages.length > 1 && (
              <div className="img-grid" style={{ marginTop: 8 }}>
                {allImages.map((img, i) => (
                  <img key={i} src={img} alt="" style={{ cursor: 'pointer', opacity: i === mainImg ? 1 : 0.55, border: i === mainImg ? '2px solid var(--accent)' : '' }}
                    onClick={() => setMainImg(i)} />
                ))}
              </div>
            )}
          </div>
        )}
        <h1>{restaurant.name}</h1>
        <p className="text-muted"><MapPin size={14} style={{ marginRight: 6, display: 'inline' }} />{restaurant.address}</p>
        <p className="text-muted mt-4"><Phone size={14} style={{ marginRight: 6, display: 'inline' }} />{restaurant.phone}</p>
      </div>

      {/* Menu */}
      <h2>Thực đơn</h2>
      {restaurant.categories?.length === 0
        ? <div className="empty">Chưa có thực đơn</div>
        : restaurant.categories?.map(cat => (
          <div key={cat.id} className="section">
            <h3 style={{ marginBottom: 14, color: 'var(--accent)' }}>{cat.name}</h3>
            <div className="card-grid">
              {cat.foodItems?.map(item => (
                <div className="item-card" key={item.id}>
                  {item.images?.[0]
                    ? <img src={item.images[0]} alt={item.name} />
                    : <div className="no-img">🍜</div>}
                  <div className="info">
                    <h4>{item.name}</h4>
                    <p>{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="price">{item.price.toLocaleString('vi-VN')}đ</span>
                      {!item.isAvailable && <span className="badge badge-red">Hết</span>}
                    </div>
                    <div className="actions">
                      <button
                        className="btn btn-primary btn-sm w-full"
                        disabled={!item.isAvailable || addingItem === item.id}
                        onClick={() => addToCart(item)}
                      >
                        <Plus size={14} />{addingItem === item.id ? 'Đang thêm...' : 'Thêm vào giỏ'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  )
}
