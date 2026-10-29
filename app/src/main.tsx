import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './theme/tokens.css'
import './styles.css'

// The window's title bar is the app's own ground (titleBarStyle Overlay):
// a strip the traffic lights sit in, which drags the window
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="titlebar" data-tauri-drag-region />
    <App />
  </StrictMode>
)
