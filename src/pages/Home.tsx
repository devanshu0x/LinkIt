import { useNavigate } from "react-router-dom";
import Container from "../components/Container"

function Home() {
  const navigate=useNavigate();
  function handleCreate(){

  }
  function handleJoin(){

  }
  
 
  return (
    <div className="h-full">
        <div className="flex justify-center items-center h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2">
            <Container title={"Create room"} onClick={handleCreate}/>
            <Container title={"Join room"} onClick={handleJoin}/>
        </div>
        </div>
    </div>
  )
}

export default Home