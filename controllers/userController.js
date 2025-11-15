import Creation from "../models/creationModel.js";

export const getUserCreations = async (req, res) => {
  try {
    const { userId } = req.auth();
    const creations = await Creation.find({ user_id: userId }).sort({
      created_at: -1,
    });
    res.json({ success: true, creations });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const getPublishedCreations = async (req, res) => {
  try {
    const publish = await Creation.find({ publish: true }).sort({
      created_at: -1,
    });
    res.json({ success: true, publish });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

export const toggleLikeCreation = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;

    const creation = await Creation.findById(id);
    if (!creation) {
      return res.json({
        success: false,
        message: "Creation not found",
      });
    }

    const userIdStr = userId.toString();
    let updatedLikes = [];
    let message = "";

    // Check if the user already liked this creation
    if (creation.likes.includes(userIdStr)) {
      // Unlike
      updatedLikes = creation.likes.filter((u) => u !== userIdStr);
      message = "Creation Unliked";
    } else {
      // Like
      updatedLikes = [...creation.likes, userIdStr];
      message = "Creation Liked";
    }

    // Update creation
    creation.likes = updatedLikes;
    await creation.save();

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
};