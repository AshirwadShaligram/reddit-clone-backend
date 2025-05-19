import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create a new comment
const createComment = async (req, res) => {
  try {
    const { content, postId } = req.body;
    const authorId = req.userId; // From auth middleware

    // Validate required fields
    if (!content || !postId) {
      return res
        .status(400)
        .json({ error: "Content and postId are required." });
    }

    // Check if post exists
    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!postExists) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId,
      },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
      },
    });

    res.status(201).json({
      status: "success",
      data: comment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get comments for a post
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    // Check if post exists
    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!postExists) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Get comments for the post
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      results: comments.length,
      data: comments,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: "Content is required." });
    }

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found." });
    }

    // Check if user is the author
    if (comment.authorId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only update your own comments." });
    }

    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        content,
        updatedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      data: updatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found." });
    }

    // Check if user is the author
    if (comment.authorId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own comments." });
    }

    // Delete the comment
    await prisma.comment.delete({
      where: { id },
    });

    res.status(200).json({
      status: "success",
      message: "Comment deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get comments by a specific user
const getUserComments = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if the user exists
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      return res.status(404).json({ error: "User not found." });
    }

    // Get comments made by the user
    const comments = await prisma.comment.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Get vote counts for each comment (if your schema supports comment votes)
    // If you don't have comment votes, you can remove this part
    const commentsWithMeta = await Promise.all(
      comments.map(async (comment) => {
        // This is optional - only if you implement comment voting
        // If you don't have comment voting, simply return the comment
        return comment;
      })
    );

    res.status(200).json({
      status: "success",
      results: comments.length,
      data: commentsWithMeta,
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export {
  createComment,
  getPostComments,
  updateComment,
  deleteComment,
  getUserComments,
};
