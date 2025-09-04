import { NextRequest, NextResponse } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/sites',
  '/controllers', 
  '/admin',
  '/api/sites',
  '/api/controllers',
  '/api/health',
  '/api/audit',
  '/api/users'
];

// Admin-only routes
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin',
  '/api/users'
];

// Public routes that should not be checked
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout', 
  '/api/auth/me'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes and static assets
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/favicon') ||
    pathname === '/' ||
    PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route))
  ) {
    return NextResponse.next();
  }

  // Check if route needs protection
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Get token from cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // Redirect to login page with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For API routes, just validate token exists (detailed validation in API handlers)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // For page routes, do basic token validation
  try {
    // Simple JWT format validation (detailed validation happens in components)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Basic payload check - parse the payload without verification
    const payload = JSON.parse(atob(tokenParts[1]));
    if (!payload.id || !payload.role) {
      throw new Error('Invalid token payload');
    }

    return NextResponse.next();
  } catch (error) {
    // Invalid token, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)  
     * - favicon.ico (favicon file)
     * - / (root path)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};