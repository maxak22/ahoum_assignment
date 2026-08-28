export default function ErrorNote({ children }) {
  if (!children) return null
  return (
    <p className="error" role="alert">
      {children}
    </p>
  )
}
