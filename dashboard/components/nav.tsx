'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Phone, Settings, BarChart3, PhoneOutgoing, LogOut } from 'lucide-react'
import { Button } from './ui/button'

const navItems = [
  { href: '/calls', label: 'Звонки', icon: Phone },
  { href: '/dial', label: 'Позвонить', icon: PhoneOutgoing },
  { href: '/settings', label: 'Настройки', icon: Settings },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3 },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/login', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <nav className="flex h-16 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-6">
        <Link href="/calls" className="text-xl font-bold">
          VOIX
        </Link>
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Выйти
      </Button>
    </nav>
  )
}
