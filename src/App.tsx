import { Route, Routes } from "react-router-dom"
import Background from "./components/Background"
import LandingPage from "./pages/LandingPage"
import Dashboard from "./pages/Dashboard"
import Footer from "./components/Footer"



function App() {
  return (
    <div className="text-text font-inter min-h-screen flex flex-col">
        <Background/>
        <div className="overflow-x-clip relative flex-grow">
          <Routes>
          <Route path="/" element={<LandingPage/>}/>
          <Route path="/dashboard" element={<Dashboard/>}/>
        </Routes>
        </div>
        <Footer/>
    </div>
  )
}

export default App