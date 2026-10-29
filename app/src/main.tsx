import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// The oliverz.dev type: bundled, the app never loads fonts from the web
import '@fontsource-variable/archivo'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './theme/tokens.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
