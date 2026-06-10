import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShoppingCart, User, LogOut, LayoutDashboard, Utensils } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  const handleLogout = () => { logout(); nav('/login') }

  return (
    <nav>
      <div className="inner">
        <NavLink to="/" className="brand">
          <Utensils size={20} /> FoodOrder
        </NavLink>
        <div className="links">
          <NavLink to="/">Nhà hàng</NavLink>
          {user && <NavLink to="/cart"><ShoppingCart size={15} style={{ marginRight: 4 }} />Giỏ hàng</NavLink>}
          {user && <NavLink to="/orders">Đơn hàng</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin"><LayoutDashboard size={15} style={{ marginRight: 4 }} />Admin</NavLink>}
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
