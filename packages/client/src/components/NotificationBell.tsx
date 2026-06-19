import { useEffect, useState, useRef } from 'react'
import { Bell } from 'lucide-react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Notification {
  _id: string
  userId: string
  orderId: string
  type: 'EMAIL' | 'SMS'
  content: string
  sentAt: string
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Only load notifications if user is CUSTOMER (backend requirement)
  const isCustomer = user?.role === 'CUSTOMER'

  const fetchNotifications = async () => {
    if (!isCustomer) return
    try {
      const res = await api.get('/notifications')
      const list = res.data?.data || []
      // Sort by sentAt descending
      list.sort((a: Notification, b: Notification) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      
      // Compare with previous list to check if new notifications arrived to trigger highlight
      if (list.length > notifications.length && notifications.length > 0) {
        setUnreadCount(prev => prev + (list.length - notifications.length))
      } else if (notifications.length === 0) {
        // Initial load: show count of recent notifications (max 3 for badge indicator)
        setUnreadCount(Math.min(list.length, 3))
      }
      setNotifications(list)
    } catch (err) {
      console.warn('Failed to load notifications:', err)
    }
  }

  useEffect(() => {
    if (!isCustomer) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15_000) // check every 15s

    return () => clearInterval(interval)
  }, [user, isCustomer])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setUnreadCount(0) // mark as read when opened
    }
  }

  const formatTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Vừa xong'
      if (diffMins < 60) return `${diffMins} phút trước`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours} giờ trước`
      return new Date(isoString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const handleItemClick = (orderId: string) => {
    setIsOpen(false)
    navigate('/orders') // navigate to orders list where customer can view details
  }

  if (!isCustomer) return null

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className={`bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`} 
        onClick={handleToggle}
        title="Thông báo"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Thông báo của bạn</h3>
            {notifications.length > 0 && (
              <span className="count-tag">{notifications.length} tin</span>
            )}
          </div>
          <div className="dropdown-body">
            {notifications.length === 0 ? (
              <div className="empty-state">Không có thông báo nào</div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif._id} 
                  className={`notif-item ${notif.content.includes('successful') || notif.content.includes('thành công') ? 'success' : 'failed'}`}
                  onClick={() => handleItemClick(notif.orderId)}
                >
                  <div className="notif-indicator" />
                  <div className="notif-content">
                    <p className="message">{notif.content}</p>
                    <div className="meta">
                      <span className="channel-chip">{notif.type}</span>
                      <span className="time">{formatTime(notif.sentAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
