import mongoose from 'mongoose';
import express from 'express';
import authRoutes from "./database/Routes/auth.js";
import projectRoutes from "./database/Routes/projects.js";
import userRoutes from "./database/Routes/users.js";
import cookieParser from 'cookie-parser';
import http from 'http';
import 'dotenv/config'
import dotenv from 'dotenv'
import cors from 'cors'
import { Server as SocketIOServer } from "socket.io";
import { createClient } from 'redis';

// Since this is a smaller scope, dictionaries are used for temporary code storage in the server
// Basically, when a new user joins the websocket room, the data will be  saved into these dictionaries.
//
// This data does not persist between server resets. There is a save button I have implemented that will
// save the data to MongoDB, and will load the data from there instead when the first person joins the room.
//
// Perhaps this can be solved with redis?

const roomData = {};
const roomLang = {};
const roomMessages = {};

dotenv.config()
const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
const server = http.createServer(app);
console.log("\n\x1b[32m[server.js] Express server initialized :)\x1b[0m")


const redisClient = createClient();


// redis
async function redis() {
    try {
        await redisClient.connect();
        console.log("\x1b[32m[server.js] Redis client initialized :)\x1b[0m")
    } catch(error) {
        console.log("\x1b[31m[server.js] Redis error :(\x1b[0m")
        console.error(error)
    }
}



// MongoDB

async function connect() {
    try {
        await mongoose.connect(process.env.MONGODB_KEY)
        console.log("\x1b[32m[server.js] Connected to MongoDB :)\x1b[0m")
    } catch(error) {
        console.log("\x1b[31m[server.js] Could not connect to MongoDB :(\x1b[0m")
    }
}


// Socketing

async function websockets() {

    const io = new SocketIOServer(server, {
        cors: {
            origin: ["http://localhost:5173"]
        }
    });

    io.on("connection", (socket) => {
        socket.on('join-room', (roomId) => {
            const users = io.sockets.adapter.rooms.get(roomId);
            const userCount = users ? users.size : 0
            console.log(`\x1b[33m[${roomId}] UserCount: ${userCount}\x1b[0m`);
            
            socket.join(roomId);
            if (userCount == 1) {
                socket.emit('editor-initialization', {room: roomId})
            } else {
                if (roomData[roomId]) {
                    socket.emit('editor-update-return', { room: roomId, value: roomData[roomId] });
                }
                if (roomMessages[roomId]) {
                    socket.emit('chat-history', { room: roomId, messages: roomMessages[roomId] });
        
                }
                if (roomLang[roomId]) {
                    socket.emit('language-update-return', { room: roomId, language: roomLang[roomId] });
                }
            }
        });


        socket.on('chat-message', ({ room, message }) => {
            if (!roomMessages[room]) {
                roomMessages[room] = [];
            }
            roomMessages[room].push(message);
            io.to(room).emit('chat-message-return', { room, message });
        });
        socket.on('editor-update', ({ room, value }) => {
            roomData[room] = value; // Store latest code for the room
            io.to(room).emit('editor-update-return', { room, value }); // Sends update to all clients in the room
        });
        
        socket.on('language-update', ({ room, language }) => {
            roomLang[room] = language;
            io.to(room).emit('language-update-return', { room, language });
        });

        socket.on('disconnect', () => {
            
            console.log(`User disconnected: ${socket.id}`);
        });
    });

    console.log("\x1b[32m[server.js] Websocket server initialized :)\x1b[0m");
}


// Express

app.get('/', (req, res) => {
    res.send('Hello, world!');
});

app.use(cookieParser())
app.use(express.json()) 
app.use("/api/auth", authRoutes)
app.use("/api/projects", projectRoutes)
app.use("/api/users", userRoutes)


server.listen(3000, async () => {
    await connect()
    await websockets()
    await redis()
    console.log('\x1b[32m[server.js] Server running on port 3000 :)\x1b[0m\n');
  });