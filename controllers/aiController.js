import { clerkClient } from "@clerk/express";
import Creation from "../models/creationModel.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const generateTextWithGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from environment variables.");
  }
  const AI = new GoogleGenerativeAI(apiKey);
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview"
  ];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = AI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result?.response?.text();
      if (text) return text;
    } catch (err) {
      console.warn(`Gemini model ${modelName} failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(lastError?.message || "All Gemini API models failed to generate content.");
};

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const { plan, free_usage = 0 } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const content = await generateTextWithGemini(prompt);

    await Creation.create({
      user_id: userId,
      prompt,
      content,
      type: "article",
    });

    if (plan !== "premium") {
      try {
        await clerkClient.users.updateUserMetadata(userId, {
          privateMetadata: { free_usage: (free_usage || 0) + 1 },
        });
      } catch (metadataErr) {
        console.warn("Failed to update Clerk metadata:", metadataErr.message);
      }
    }

    res.json({ success: true, content });

  } catch (error) {
    console.error("AI Controller error (generateArticle):", error);
    res.status(500).json({ success: false, message: error.message || "Failed to generate article" });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const { plan, free_usage = 0 } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const content = await generateTextWithGemini(prompt);

    await Creation.create({
      user_id: userId,
      prompt,
      content,
      type: "blog-title",
    });

    if (plan !== "premium") {
      try {
        await clerkClient.users.updateUserMetadata(userId, {
          privateMetadata: { free_usage: (free_usage || 0) + 1 },
        });
      } catch (metadataErr) {
        console.warn("Failed to update Clerk metadata:", metadataErr.message);
      }
    }

    res.json({ success: true, content });
  } catch (error) {
    console.error("Blog title error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to generate blog title" });
  }
};

export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth(); 
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    const formData = new FormData();
    formData.append("prompt", prompt);

    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: {
          "x-api-key": process.env.CLIPDROP_API_KEY,
          ...formData.getHeaders(),
        },
        responseType: "arraybuffer",
      }
    );

    const base64Image = `data:image/png;base64,${Buffer.from(data, "binary").toString("base64")}`;

    const { secure_url } = await cloudinary.uploader.upload(base64Image, {
      folder: "generated_images",
    });

    await Creation.create({
      user_id: userId,
      prompt,
      content: secure_url,
      type: "image",
      publish: publish ?? false,
    });

    res.json({ success: true, content: secure_url });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No image uploaded" 
      });
    }

    console.log("Processing background removal for user:", userId);

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "background_remove",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const upload = await uploadPromise;

    const transformedUrl = cloudinary.url(upload.public_id, {
      effect: "background_removal",
      fetch_format: "auto",
      quality: "auto",
    });

    console.log("Transformed URL:", transformedUrl);

    await Creation.create({
      user_id: userId,
      prompt: "Remove background",
      content: transformedUrl,
      type: "image",
    });

    res.json({ success: true, content: transformedUrl });
  } catch (error) {
    console.error("BG remove ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to remove background",
    });
  }
};

export const removeBackgroundObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No image uploaded" 
      });
    }

    if (!object) {
      return res.status(400).json({ 
        success: false, 
        message: "No object specified" 
      });
    }

    console.log("Processing object removal:", object, "for user:", userId);

    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "object_removal",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const upload = await uploadPromise;

    const transformedUrl = cloudinary.url(upload.public_id, {
      effect: `gen_remove:prompt_${object}`,
      fetch_format: "auto",
      quality: "auto",
    });

    console.log("Transformed URL:", transformedUrl);

    await Creation.create({
      user_id: userId,
      prompt: `Remove ${object}`,
      content: transformedUrl,
      type: "image",
    });

    return res.json({ success: true, content: transformedUrl });
  } catch (err) {
    console.error("Object removal ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to remove object",
    });
  }
};

/*export const removeBackgroundObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const plan = req.plan;
    const image = req.file?.path;

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (!image) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    if (!object) {
      return res.status(400).json({ success: false, message: "No object specified to remove" });
    }

    const { public_id } = await cloudinary.uploader.upload(image, {
      resource_type: "image",
    });

    const imageUrl = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      resource_type: "image",
    });

    await Creation.create({
      user_id: userId,
      prompt: `Removed ${object} from image`,
      content: imageUrl,
      type: "image",
    });

    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const removeImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();
    const plan = req.plan;
    const image = req.file?.path;

    console.log("Remove background request:", { userId, plan, hasFile: !!req.file });

    if (plan !== "premium") {
      return res.json({
        success: false,
        message: "This feature is only available for premium subscriptions",
      });
    }

    if (!image) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const uploadResult = await cloudinary.uploader.upload(image, {
      folder: "background_removal",
    });

    const processedUrl = cloudinary.url(uploadResult.public_id, {
      transformation: [
        { effect: "background_removal" }
      ]
    });

    console.log("Processed URL:", processedUrl);

    await Creation.create({
      user_id: userId,
      prompt: "Remove background from image",
      content: processedUrl,
      type: "image",
    });

    if (fs.existsSync(image)) {
      fs.unlinkSync(image);
    }

    res.json({ success: true, content: processedUrl });
  } catch (error) {
    console.error("Remove background error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};*/