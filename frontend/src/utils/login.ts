export function loginCredentials(form: { email: string; password: string }) {
  return { email: form.email, password: form.password };
}

export function loginDestination(redirect: unknown, role: string): string {
  // URL parsing also catches backslashes and encoded attempts to leave this app.
  if (typeof redirect === 'string' && redirect.startsWith('/') && !/[\\\u0000-\u0020]/.test(redirect)) {
    const target = new URL(redirect, 'https://gda.invalid');
    if (target.origin === 'https://gda.invalid' && !['/login', '/register'].includes(target.pathname)) {
      return target.pathname + target.search + target.hash;
    }
  }
  return role === 'SUPER_ADMIN' ? '/super-admin' : role === 'ADMIN' ? '/admin' : '/dashboard';
}
