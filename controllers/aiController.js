import { clerkClient } from "@clerk/express";
import Creation from "../models/creationModel.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
const AI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = AI.getGenerativeModel({ model: "gemini-2.0-flash" });

dotenv.config();

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const { plan, free_usage } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    await Creation.create({
      user_id: userId,
      prompt,
      content,
      type: "article",
    });

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });

  } catch (error) {
    console.error("AI Controller error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const { plan, free_usage } = req;

    if (plan !== "premium" && free_usage >= 10) {
      return res.json({
        success: false,
        message: "Limit reached. Upgrade to continue.",
      });
    }

    const result = await model.generateContent(prompt);
    const content = result.response.text();

    await Creation.create({
      user_id: userId,
      prompt,
      content,
      type: "blog-title",
    });

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.log("Blog title error:", error.message);
    res.status(500).json({ success: false, message: error.message });
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


export const removeBackgroundObject = async (req, res) => {
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
};