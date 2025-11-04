import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
const BACKEND_URL= import.meta.env.VITE_BACKEND_URL

function Dashboard() {
  const [roomId,setRoomId]=useState<string>("");
  const navigate=useNavigate();
  const createRoomHandler= async ()=>{
    const res= await axios.get(`${BACKEND_URL}/create`, {withCredentials:true});
    if(res.data){
      navigate(`/room/${res.data.roomId}`);
    }

  }
  const joinRoomHandler= async ()=>{
    if(roomId.length==0){
      return toast.error("Enter Room Id first!")
    }
    try{
      await axios.get(`${BACKEND_URL}/join/${roomId}`,{withCredentials:true});
      navigate(`/room/${roomId}`);
    }
    catch(e:any){
      if(axios.isAxiosError(e)){
        toast.error(e.response?.data.error);
      }
      else{
        toast.error("Something went Wrong");
      }
    }
  }
  return (
    <div>
      <div className="my-8 sm:my-14 mx-6 sm:mx-10 ">
        <h1 className="text-5xl sm:text-6xl text-center  font-bungee">
          <span className="text-accent">Link</span>
          <span>It</span>
        </h1>
        <h4 className="text-center text-xl md:text-2xl my-2 md:my-4 text-text-muted">
          Create or join room to start sharing files
        </h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 my-8 sm:my-12 ">
          <div className="border py-4 px-3 sm:px-5 relative bg-black/30 min-h-62 md:h-72 flex flex-col">
            <img src="bg2.svg" className="absolute left-0 right-0 bottom-0" />
              <h4 className="text-center text-2xl sm:text-3xl text-accent font-bold">
                Create Room
              </h4>
              <p className="text-center pb-3">
                Create a room and start sharing
              </p>
              <div className="flex-grow flex flex-col gap-4 justify-end items-center z-2 pb-12">

                <button onClick={createRoomHandler} className="px-5 py-2 font-extrabold bg-highlight-accent/50 cursor-pointer rounded-lg shadow-[0_0_8px_3px_rgba(255,255,255,0.4)] hover:rotate-3 transition-all duration-300">
                  Create Room
                </button>
             
            </div>
          </div>
          <div className="border py-4 px-3 sm:px-5 relative bg-black/30 min-h-62 md:h-72 flex flex-col">
            <img
              src="bg1.svg"
              alt=""
              className="absolute left-0 right-0 bottom-0"
            />
            <h4 className="text-center text-2xl sm:text-3xl text-accent-secondary font-bold">
              Join Room
            </h4>
            <p className="text-center pb-3">
              Already got room code? Join a room
            </p>
            <div className="flex-grow flex flex-col gap-4 justify-end items-center z-2 pb-12">
              <input value={roomId} spellCheck="false" onChange={(e)=>setRoomId(e.target.value.toUpperCase())} type="text" placeholder="Enter Room Code" className="outline-none rounded-lg px-4 py-2 bg-accent-secondary w-45 shadow-[0_0_5px_3px_rgba(164,92,255,0.4)] placeholder:text-text-muted text-center" />
              <button onClick={joinRoomHandler} className="px-5 py-2 font-extrabold bg-highlight-secondary/50 cursor-pointer rounded-lg shadow-[0_0_8px_3px_rgba(255,255,255,0.4)] hover:rotate-3 transition-all duration-300">
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
