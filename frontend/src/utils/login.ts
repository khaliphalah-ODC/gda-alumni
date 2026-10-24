export function loginCredentials(form: { email: string; password: string }) {
  return { email: form.email, password: form.password };
}

export function loginDestination(redirect: unknown, role: string): string {
  // Reject raw and percent-encoded escapes that could rewrite the request target
  // before allowing a same-origin relative path to be restored.
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    const raw = redirect;
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return role === 'SUPER_ADMIN' ? '/super-admin' : role === 'ADMIN' ? '/admin' : '/dashboard';
    }

    if (/[\\\u0000-\u0020]/.test(raw) || /[\\]/.test(decoded) || decoded.startsWith('//') || /(^|\/)\.\.(?=\/|$)/.test(decoded) || /[\u0000-\u001F\u007F]/.test(decoded)) {
      return role === 'SUPER_ADMIN' ? '/super-admin' : role === 'ADMIN' ? '/admin' : '/dashboard';
    }

    try {
      const target = new URL(raw, 'https://gda.invalid');
      if (target.origin === 'https://gda.invalid' && !['/login', '/register'].includes(target.pathname)) {
        return target.pathname + target.search + target.hash;
      }
    } catch {
      // Ignore malformed URLs and fall back to the default dashboard route.
    }
  }
  return role === 'SUPER_ADMIN' ? '/super-admin' : role === 'ADMIN' ? '/admin' : '/dashboard';
}
