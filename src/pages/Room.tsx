import { useEffect } from "react"
import Appbar from "../components/Appbar"
import { useNavigate, useParams } from "react-router-dom"
import axios from "axios"
import toast from "react-hot-toast"
const BACKEND_URL= import.meta.env.VITE_BACKEND_URL

function Room() {
  const navigate=useNavigate();
  const {roomId}= useParams();
  useEffect(()=>{
    async function checkValidRoom(){
      try{
        await axios.get(`${BACKEND_URL}/verify/${roomId}`,{withCredentials:true});
      }catch(e){
        if(axios.isAxiosError(e)){
          toast.error(e.response?.data.error);
        }
        else{
          toast.error("Some error occured!")
        }
        navigate("/dashboard");
      }
      
    }
    checkValidRoom();
  },[])
  return (
    <div className="my-2 sm:my-4 mx-6 sm:mx-10">
      <Appbar/>
    </div>
  )
}

export default Room