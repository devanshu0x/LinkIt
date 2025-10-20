import { Route, Routes } from "react-router-dom"
import Background from "./components/Background"
import LandingPage from "./pages/LandingPage"
import Dashboard from "./pages/Dashboard"



function App() {
  return (
    <div className="text-text font-inter ">
        <Background/>
        <div className="overflow-x-clip relative">
          <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path="/dashboard" element={<Dashboard/>}/>
        </Routes>
        </div>
    </div>
  )
}

export default App