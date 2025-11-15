import mongoose from "mongoose";

const creationSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    prompt: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, required: true, default: "article" },
    publish: { type: Boolean, default: false },
    likes: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export default mongoose.model("Creation", creationSchema);
