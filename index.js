import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRouter from "./routes/authRoute.js";
import communityRouter from "./routes/communityRoute.js";
import postRoutes from "./routes/postRoutes.js";
import voteRoutes from "./routes/voteRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import { uploadMiddleware } from "./middleware/uploadMiddleware.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // frontend domain IP
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Global file upload middleware configuration
app.use(uploadMiddleware);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/communities", communityRouter);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/votes", voteRoutes);

const PORT = process.env.PORT || 3001;

// Add this in index.js (before app.listen)
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is healthy" });
});

async function main() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");

    app.listen(PORT, () => {
      console.log(`server is running on ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed", error);
    process.exit(1);
  }
}
main();
