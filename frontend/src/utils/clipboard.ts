export async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  } catch { /* Use selection-based copy on browsers without clipboard access. */ }
  const input = document.createElement('textarea');
  input.value = value; input.setAttribute('readonly', '');
  input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  try { if (!document.execCommand('copy')) throw new Error('Copy unavailable'); }
  finally { input.remove(); }
}
