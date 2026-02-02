import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('voix-auth')
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isApiWebhook = request.nextUrl.pathname === '/api/webhook'
  const isStaticFile = request.nextUrl.pathname.startsWith('/_next') ||
                       request.nextUrl.pathname.startsWith('/favicon')

  // Allow static files
  if (isStaticFile) return NextResponse.next()

  // Webhook without auth
  if (isApiWebhook) return NextResponse.next()

  // If not authenticated - redirect to login
  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If authenticated and on login page - redirect to main
  if (authCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/calls', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
