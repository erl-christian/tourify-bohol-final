import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { ActionStatusProvider } from "./context/ActionStatusContext"
import "./index.css"

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActionStatusProvider>
        <App />
      </ActionStatusProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
