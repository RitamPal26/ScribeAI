import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { parse } from "cookie";
import { registerRecordingHandlers } from "./socket/recording.js";

export function initializeSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_APP_URL
          : "http://localhost:3001",
      credentials: true,
    },
    maxHttpBufferSize: 5e6, // 5MB max message size for audio chunks
  });

  // Authentication middleware
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;

      console.log("🔍 Auth check - Cookie header:", cookieHeader);

      if (!cookieHeader) {
        console.log("❌ No cookie header");
        return next(new Error("Authentication required"));
      }

      const cookies = parse(cookieHeader);
      const sessionToken = cookies["better-auth.session_token"];

      console.log("🔍 Session token from cookie:", sessionToken);

      if (!sessionToken) {
        console.log("❌ No session token in cookies");
        return next(new Error("No session token found"));
      }

      // Better Auth stores only the first part in DB (before the signature)
      const tokenPart = sessionToken.split(".")[0];
      console.log("🔍 Token part to lookup:", tokenPart);

      // Verify session exists in database
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const session = await prisma.session.findUnique({
        where: { token: tokenPart },
        include: { user: true },
      });

      console.log("🔍 Session from DB:", session ? "Found" : "Not found");

      if (!session) {
        await prisma.$disconnect();
        console.log("❌ Session not found in database");
        return next(new Error("Invalid session"));
      }

      if (session.expiresAt < new Date()) {
        await prisma.$disconnect();
        console.log("❌ Session expired:", session.expiresAt);
        return next(new Error("Expired session"));
      }

      // Attach user info to socket
      socket.data.userId = session.userId;
      socket.data.user = session.user;

      console.log("✅ Auth successful for user:", session.user.email);

      await prisma.$disconnect();
      next();
    } catch (error) {
      console.error("❌ Socket authentication error:", error);
      next(new Error("Authentication failed"));
    }
  });

  // Connection handler
  io.on("connection", (socket) => {
    console.log(
      `✓ Client connected: ${socket.id} (User: ${socket.data.user.email})`
    );

    // Register recording event handlers
    registerRecordingHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`✗ Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("✓ Socket.io initialized");
  return io;
}
