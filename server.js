import express from "express";
import cors from "cors";
import "dotenv/config";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import { connectDB } from "./configs/db.js";
import aiRouter from "./routes/aiRoutes.js";
import connectCloudinary from "./configs/cloudinary.js";
import userRouter from "./routes/userRoutes.js";

const app = express();
await connectCloudinary();
app.use(cors());
app.use(clerkMiddleware());
app.use(express.json());

// Connect to MongoDB Cloud
connectDB();

app.get("/", (req, res) => res.send("Server is Live!"));

app.use(requireAuth());
app.use("/api/ai", aiRouter);
app.use("/api/user", userRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
