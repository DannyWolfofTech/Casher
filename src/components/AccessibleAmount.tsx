import { isNativeApp } from '@/lib/mobile-platform';

// Give native accessibility one meaningful announcement instead of a bare
// currency token. Keep visible formatting and web table semantics unchanged.
export function AccessibleAmount({ value, label }: { value: string; label: string }) {
  const native = isNativeApp();
  return <span role={native ? 'group' : undefined} tabIndex={native ? 0 : undefined} aria-label={native ? label : undefined}><span aria-hidden={native || undefined}>{value}</span></span>;
}
