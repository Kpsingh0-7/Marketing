// import express from 'express';
// import cors from 'cors';
// import http from 'http';
// import cookieParser from 'cookie-parser';
// import cookie from 'cookie';
// import jwt from 'jsonwebtoken';
// import { Server as SocketIO } from 'socket.io';

// import createRouter from './routes/controllerRoutes.js';

// const app = express();

// // === CORS config ===
// const corsOptions = {
//   origin: 'https://marketing.tenacioustechies.com.au', // Adjust in production
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true,
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); 
// app.use(express.json());
// app.use(cookieParser());

// // ✅ First, create the HTTP server
// const server = http.createServer(app);

// // ✅ Then, pass it to Socket.IO
// const io = new SocketIO(server, {
//   cors: corsOptions,
// });

// // ✅ Now pass `io` to your routes
// const router = createRouter(io);
// app.use('/', router);

// // === Error handler ===
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
//   res.status(500).json({ error: 'Internal Server Error' });
// });

// const SECRET = 'super_secret_key_12345';

// io.use((socket, next) => {
//   try {
//     const rawCookie = socket.handshake.headers.cookie || '';
//     const cookies = cookie.parse(rawCookie);
//     const token = cookies.auth_token;

//     if (!token) return next(new Error('Authentication error: Token missing'));

//     const decoded = jwt.verify(token, SECRET);
//     socket.user = decoded; // ✅ Attach user to socket
//     next();
//   } catch (err) {
//     console.error('Socket authentication failed:', err.message);
//     next(new Error('Authentication error: Invalid token'));
//   }
// });
// // === Socket.IO Events ===
// io.on('connection', (socket) => {
//   console.log('Socket connected:', socket.id);

//   socket.on('join_conversation', (conversation_id) => {
//     socket.join(conversation_id);
//     console.log(`Socket ${socket.id} joined conversation: ${conversation_id}`);
//   });

//   // ✅ Join a customer-wide room for global notifications
//   socket.on('join_customer_room', (customer_id) => {
//     socket.join(String(customer_id));
//     console.log(`Socket ${socket.id} joined customer room: ${customer_id}`);
//   });

//   socket.on('disconnect', () => {
//     console.log('Socket disconnected:', socket.id);
//   });
// });

// // === Start Unified Server ===
// const PORT = 3000;
// server.listen(PORT, () => {
//   console.log(`Server (API + Socket.IO) running on http://localhost:${PORT}`);
// });


import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { Server as SocketIO } from 'socket.io';

import createRouter from './routes/controllerRoutes.js';

const app = express();

// ✅ Manual CORS headers fix (add this before cors middleware)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://marketing.tenacioustechies.com.au');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// === CORS config ===
const corsOptions = {
  origin: 'https://marketing.tenacioustechies.com.au',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ✅ First, create the HTTP server
const server = http.createServer(app);

// ✅ Then, pass it to Socket.IO
const io = new SocketIO(server, {
  cors: corsOptions,
});

// ✅ Now pass `io` to your routes
const router = createRouter(io);
app.use('/', router);

;

// ✅ Ensure CORS headers apply to every route in the router
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://marketing.tenacioustechies.com.au');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});


const SECRET = 'super_secret_key_12345';

io.use((socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie || '';
    const cookies = cookie.parse(rawCookie);
    const token = cookies.auth_token;

    if (!token) return next(new Error('Authentication error: Token missing'));

    const decoded = jwt.verify(token, SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    console.error('Socket authentication failed:', err.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// === Socket.IO Events ===
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_conversation', (conversation_id) => {
    socket.join(conversation_id);
    console.log(`Socket ${socket.id} joined conversation: ${conversation_id}`);
  });

  socket.on('join_customer_room', (customer_id) => {
    socket.join(String(customer_id));
    console.log(`Socket ${socket.id} joined customer room: ${customer_id}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// === Start Unified Server ===
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server (API + Socket.IO) running on http://localhost:${PORT}`);
});
