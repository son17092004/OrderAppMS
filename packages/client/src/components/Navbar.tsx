import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, User, LogOut, LayoutDashboard, Utensils } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../api/client'
import NotificationBell from './NotificationBell'

function useCartCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) { setCount(0); return }
    let cancelled = false
    const fetch = () =>
      api.get('/cart').then(r => {
        if (!cancelled) setCount(r.data.data?.items?.length ?? 0)
      }).catch(() => {})
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [user])

  return count
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const cartCount = useCartCount()

  const handleLogout = () => { logout(); nav('/login') }

  return (
    <nav>
      <div className="inner">
        <NavLink to="/" className="brand">
          <Utensils size={20} /> FoodOrder
        </NavLink>
        <div className="links">
          <NavLink to="/">Nhà hàng</NavLink>
          {user && (
            <NavLink to="/cart" className="cart-link">
              <ShoppingCart size={15} style={{ marginRight: 4 }} />Giỏ hàng
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </NavLink>
          )}
          {user && <NavLink to="/orders">Đơn hàng</NavLink>}
          {user && <NotificationBell />}
          {(user?.role === 'ADMIN' || user?.role === 'RESTAURANT_OWNER') && (
            <NavLink to="/admin"><LayoutDashboard size={15} style={{ marginRight: 4 }} />Quản trị</NavLink>
          )}
          {!user ? (
            <>
              <NavLink to="/login">Đăng nhập</NavLink>
              <NavLink to="/register" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '7px 14px' }}>Đăng ký</NavLink>
            </>
          ) : (
            <div className="user-badge">
              <NavLink to="/profile"><User size={15} style={{ marginRight: 4 }} />{user.email.split('@')[0]}</NavLink>
              <span className="role-chip">{user.role}</span>
              <button onClick={handleLogout}><LogOut size={15} /></button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
