import { Route, Routes } from "react-router-dom"
import Appbar from "./components/Appbar"
import Home from "./pages/Home"
import Room from "./pages/Room"


function App() {
  return (
    <div className="h-screen">
      <Appbar/>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/room/:roomId" element={<Room/>}/>
      </Routes>
   
    </div>
  )
}

export default App