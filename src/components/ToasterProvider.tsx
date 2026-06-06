'use client'

import { Toaster } from 'react-hot-toast'

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 5000,
        style: {
          background: '#0F172A',
          color: '#F1F5F9',
          border: '1px solid #1E293B',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          padding: '12px 16px',
        },
        success: {
          iconTheme: { primary: '#10B981', secondary: '#0F172A' },
          style: {
            borderColor: '#10B981',
          },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: '#0F172A' },
          style: {
            borderColor: '#EF4444',
          },
        },
      }}
    />
  )
}
