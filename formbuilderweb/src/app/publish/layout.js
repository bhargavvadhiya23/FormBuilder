// Public fill page has no sidebar/topbar – just the form on a purple background
export default function FillLayout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--gf-bg, #f0ebff)' }}>
      {children}
    </div>
  );
}
