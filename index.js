import express from "express";
import cors from "cors";
import fs from "fs";
import https from "https";
import http from "http";
import cookieParser from "cookie-parser";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import { Server as SocketIO } from "socket.io";
import createRouter from "./routes/controllerRoutes.js";

const app = express();

// === CORS config ===
const corsOptions = {
  origin: "https://kpw-iu7e.onrender.com", // Adjust in production
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ==============================
// HTTPS SOCKET.IO SERVER
// ==============================
const sslOptions = {
  key: fs.readFileSync("ssl/marketing.foodchow.co.uk.key"),
  cert: fs.readFileSync("ssl/marketing.foodchow.co.uk.cert"),
};

const socketApp = express(); // dummy app for socket
const socketServer = http.createServer(sslOptions, socketApp);
const io = new SocketIO(socketServer, { cors: corsOptions });

const SECRET = "super_secret_key_12345";

io.use((socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie || "";
    const cookies = cookie.parse(rawCookie);
    const token = cookies.auth_token;

    if (!token) return next(new Error("Authentication error: Token missing"));

    const decoded = jwt.verify(token, SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    console.error("Socket authentication failed:", err.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_conversation", (conversation_id) => {
    socket.join(conversation_id);
    console.log(`Socket ${socket.id} joined conversation: ${conversation_id}`);
  });

  socket.on("join_customer_room", (customer_id) => {
    socket.join(String(customer_id));
    console.log(`Socket ${socket.id} joined customer room: ${customer_id}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// === API Routes ===
const router = createRouter(io);
app.use("/", router);

// === Error handler ===
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ==============================
// HTTP API SERVER
// ==============================
const API_PORT = 60000;
const apiServer = http.createServer(app);

apiServer.listen(API_PORT, () => {
  console.log(`API running on http://localhost:${API_PORT}`);
});

const SOCKET_PORT = 60001;
socketServer.listen(SOCKET_PORT, () => {
  console.log(`Socket.IO running on https://localhost:${SOCKET_PORT}`);
});
