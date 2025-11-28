import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { parse } from "cookie";
import { registerRecordingHandlers } from "./socket/recording.js";

import { setSocketIOInstance } from "./services/audioProcessor";

export function initializeSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_APP_URL
          : "http://localhost:3001",
      credentials: true,
    },
    maxHttpBufferSize: 5e6,
  });

  // This gives the Audio Processor permission to talk to the Frontend
  setSocketIOInstance(io);
  console.log("✅ Socket.IO instance linked to AudioProcessor");

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;

      if (!cookieHeader) {
        return next(new Error("Authentication required"));
      }

      const cookies = parse(cookieHeader);
      const sessionToken = cookies["better-auth.session_token"];

      if (!sessionToken) {
        return next(new Error("No session token found"));
      }

      const tokenPart = sessionToken.split(".")[0];

      // Note: For better performance, define PrismaClient outside this function (globally)
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const session = await prisma.session.findUnique({
        where: { token: tokenPart },
        include: { user: true },
      });

      if (!session) {
        await prisma.$disconnect();
        return next(new Error("Invalid session"));
      }

      if (session.expiresAt < new Date()) {
        await prisma.$disconnect();
        return next(new Error("Expired session"));
      }

      socket.data.userId = session.userId;
      socket.data.user = session.user;

      await prisma.$disconnect();
      next();
    } catch (error) {
      console.error("❌ Socket authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `✓ Client connected: ${socket.id} (User: ${socket.data.user.email})`
    );

    registerRecordingHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`✗ Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("✓ Socket.io initialized");
  return io;
}
