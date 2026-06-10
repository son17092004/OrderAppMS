import { useAuth } from '../context/AuthContext'
import { User, Mail, Shield } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="page" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 24 }}>Hồ sơ cá nhân</h1>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: '#fff' }}>
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{user.email.split('@')[0]}</h2>
            <span className="badge badge-orange">{user.role}</span>
          </div>
        </div>
        <div className="form-group">
          <label><Mail size={13} style={{ marginRight: 4, display: 'inline' }} />Email</label>
          <input readOnly value={user.email} />
        </div>
        <div className="form-group">
          <label><Shield size={13} style={{ marginRight: 4, display: 'inline' }} />Role</label>
          <input readOnly value={user.role} />
        </div>
        <div className="form-group">
          <label><User size={13} style={{ marginRight: 4, display: 'inline' }} />User ID</label>
          <input readOnly value={user.id} style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
        </div>
      </div>
    </div>
  )
}
