import { clerkClient } from "@clerk/express";

export const auth = async (req, res, next) => {
  try {
    const { userId, has } = req.auth();

    const hasPremiumPlan = typeof has === "function" ? await has({ plan: "premium" }) : false;

    const user = await clerkClient.users.getUser(userId);

    const freeUsage = user?.privateMetadata?.free_usage ?? 0;

    if (!hasPremiumPlan && freeUsage > 0) {
      req.free_usage = freeUsage;
    } else {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: freeUsage },
      });
      req.free_usage = freeUsage;
    }

    req.plan = hasPremiumPlan ? "premium" : "free";
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ success: false, message: error.message || "Unauthorized" });
  }
};