import { Link, Route, Routes } from 'react-router-dom'
import StyleGuide from './StyleGuide'
import { LoginDemo, AuthorShellDemo, AdminShellDemo } from './LayoutDemos'

/** Dev-only design system preview. Open http://localhost:5173/theme-preview */
export default function ThemePreview() {
  return (
    <Routes>
      <Route index element={<StyleGuide />} />
      <Route path="login" element={<LoginDemo />} />
      <Route path="author/*" element={<AuthorShellDemo />} />
      <Route path="admin/*" element={<AdminShellDemo />} />
      <Route path="*" element={<Link to="/theme-preview">Back to theme preview</Link>} />
    </Routes>
  )
}
