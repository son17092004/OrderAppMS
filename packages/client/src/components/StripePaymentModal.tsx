import React, { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { X, CreditCard, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

// Hardcode publishableKey directly to bypass environment variable caching issue
const publishableKey = 'pk_test_51TlrD3Q39GV8nvYcHAsLRUWrJGde1KWfzrhW8JLWRMYXkNKXPRIYS09Kb0gqZbhgUDEcivT1QjGK2rws1NDpNz2R00O3sLOSqt'
const stripePromise = loadStripe(publishableKey)

interface StripePaymentModalProps {
  amount: number
  orderId: string
  onClose: () => void
  onSuccess: (token: string) => void
}

function CardForm({ amount, orderId, onClose, onSuccess }: StripePaymentModalProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      toast.error('Stripe chưa sẵn sàng')
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      toast.error('Không tìm thấy CardElement')
      return
    }

    setSubmitting(true)
    try {
      const { token, error } = await stripe.createToken(cardElement)
      if (error) {
        toast.error(error.message || 'Lỗi tạo token Stripe')
      } else if (token) {
        onSuccess(token.id)
      }
    } catch (err: any) {
      toast.error('Lỗi kết nối tới Stripe')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stripe-form">
      <div className="card-element-container">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#e8ecf0',
                fontFamily: 'Inter, system-ui, sans-serif',
                '::placeholder': {
                  color: '#7c84a3',
                },
              },
              invalid: {
                color: '#ef4444',
                iconColor: '#ef4444',
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="stripe-submit-btn"
      >
        {submitting ? (
          <>
            <Loader2 className="spinner spinner-sm" style={{ margin: 0 }} /> Đang xác thực...
          </>
        ) : (
          <>
            <CreditCard size={18} /> Xác nhận & Thanh toán {amount.toLocaleString('vi-VN')}đ
          </>
        )}
      </button>
    </form>
  )
}

export default function StripePaymentModal(props: StripePaymentModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="stripe-close-btn" onClick={props.onClose}>
          <X size={20} />
        </button>
        <h3 style={{ marginBottom: 8, paddingRight: 24 }}>Thanh toán bằng thẻ Stripe</h3>
        <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
          Sử dụng thẻ test Stripe sandbox: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>4242 4242 4242 4242</code>
        </p>

        <Elements stripe={stripePromise}>
          <CardForm {...props} />
        </Elements>
      </div>
    </div>
  )
}
