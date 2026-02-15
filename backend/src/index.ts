import express  from "express";
import { PORT, ROOM_ID_LEN, rooms, sockets, SYMBOLS, users } from "./configs/config";
import { customAlphabet } from "nanoid";
import cors from "cors"
import cookieParser from "cookie-parser";
import * as cookie from "cookie";
import http from "http"
import { Server } from "socket.io";
const app=express();


const server=http.createServer(app);

const io = new Server(server,{
    cors:{
        origin:"*",
        credentials:true
    }
});



io.on("connection",(socket)=>{
    const cookies= cookie.parse(socket.handshake.headers.cookie || "");
    const userId=cookies["userId"];
    if(!userId){
        return;
    }
    const userRoom=users[userId];
    console.log("User connected ",userId);

    socket.join(userRoom);
    sockets[userId]=socket.id;

    socket.to(userRoom).emit("user-joined",{userId});

    socket.on("offer", (data) => {
    socket.to(userRoom).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(userRoom).emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(userRoom).emit("ice-candidate", data);
  });
})

app.use(cors({
    origin:"http://localhost:5173",
    credentials:true
}));
app.use(express.json());
app.use(cookieParser());

app.get("/",(req,res)=>{
    res.send("Server working properly");
})

app.get("/create",(req,res)=>{
    const nanoId=customAlphabet(SYMBOLS,ROOM_ID_LEN);
    const roomId=nanoId();
    const userId=nanoId();
    rooms[roomId]=[userId];
    users[userId]=roomId;
    res.cookie("userId",userId,{httpOnly:true, sameSite:"lax"})
    res.json({
        roomId
    });
})

app.get("/join/:roomId",(req,res)=>{
    const {roomId}=req.params;
    const nanoId=customAlphabet(SYMBOLS,ROOM_ID_LEN);
    if(!rooms[roomId]){
        return res.status(404).json({
            error:"Room does not exist"
        });
    }
    if(rooms[roomId].length>=2){
        return res.status(403).json({
            error:"Room already full"
        })
    }

    const userId=nanoId();
    rooms[roomId].push(userId);
    users[userId]=roomId;

    res.cookie("userId",userId,{httpOnly:true,sameSite:"lax"});
    res.json({
        success:true
    });
})

app.get("/verify/:roomId",(req,res)=>{
    const {roomId}=req.params;
    const {userId}=req.cookies;

    if(!userId || !rooms[roomId] || !rooms[roomId].includes(userId)){
        return res.status(403).json({
            error: "Access Denied"
        });
    }

    res.json({
        success:true
    });
})



server.listen(PORT,()=>{
    console.log(`Server started on port ${PORT}`);
})