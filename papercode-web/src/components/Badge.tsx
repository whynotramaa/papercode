import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'pink' | 'orange' | 'green' | 'blue' | 'lilac'
  size?: 'sm' | 'md'
  className?: string
}

export function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  return <span className={`document-label label-${variant} label-${size} ${className}`}>{children}</span>
}
