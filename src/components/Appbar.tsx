import { NavLink, useParams } from "react-router-dom"

function Appbar() {
  const {roomId}=useParams();
  const connectionStatus="Connected"
  return (
    <div className="bg-black/40 border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between">
        <NavLink to={"/dashboard"} className="text-3xl sm:text-4xl font-bungee text-center">
          <span className="text-accent">Link</span>
          <span>It</span>
        </NavLink>
        <span className="text-center">Room Id: <span>{roomId}</span></span>
        <div className="text-center">
          Status : <span>{connectionStatus}</span>
        </div>
    </div>
  )
}

export default Appbar