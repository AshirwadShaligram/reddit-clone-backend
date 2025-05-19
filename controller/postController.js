import { v2 as cloudinary } from "cloudinary";
import { validateMediaUpload } from "../middleware/uploadMiddleware.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a new post
const createPost = [
  validateMediaUpload("postImage"),
  async (req, res) => {
    try {
      const { title, content, communityId, authorId } = req.body;
      const userId = req.userId; // From auth middleware

      // Validate mandatory title
      if (!title) {
        return res.status(400).json({ error: "Title is required." });
      }

      // Validate either content or image must be provided
      if (!content && !req.files?.postImage) {
        return res.status(400).json({
          error: "Either content or image must be provided.",
        });
      }

      // Validate posting entity - either user or community
      if (!authorId && !communityId) {
        return res.status(400).json({
          error:
            "Either authorId (for user post) or communityId (for community post) must be provided.",
        });
      }

      if (authorId && communityId) {
        return res.status(400).json({
          error:
            "Provide only one - authorId for user posts or communityId for community posts.",
        });
      }

      // If it's a user post
      if (authorId) {
        // Verify the authenticated user is the author
        if (authorId !== userId) {
          return res.status(403).json({
            error: "You can only create posts as yourself.",
          });
        }

        // Verify user exists
        const userExists = await prisma.user.findUnique({
          where: { id: authorId },
        });
        if (!userExists) {
          return res.status(404).json({ error: "User not found." });
        }
      }

      // If it's a community post
      if (communityId) {
        // Verify community exists
        const communityExists = await prisma.community.findUnique({
          where: { id: communityId },
          include: { createdBy: true },
        });

        if (!communityExists) {
          return res.status(404).json({ error: "Community not found." });
        }

        // Verify the authenticated user is the community creator
        if (communityExists.createdById !== userId) {
          return res.status(403).json({
            error: "Only community creator can post as the community.",
          });
        }
      }

      // Upload media if provided
      let imageUrl;
      if (req.files?.postImage) {
        const file = req.files.postImage;
        const isVideo = req.isVideo;

        const result = await cloudinary.uploader.upload(file.tempFilePath, {
          resource_type: isVideo ? "video" : "image",
          folder: "post_media",
        });
        imageUrl = result.secure_url;
      }

      // Create the post
      const post = await prisma.post.create({
        data: {
          title,
          content,
          imageUrl,
          ...(authorId && { authorId }),
          ...(communityId && { communityId }),
        },
        include: {
          author: {
            select: {
              id: true,
              userName: true,
            },
          },
          community: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(201).json({
        status: "success",
        data: post,
      });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  },
];

// Update a post
const updatePost = [
  validateMediaUpload("postImage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content } = req.body;
      const userId = req.userId;

      // Find the post
      const post = await prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        return res.status(404).json({ error: "Post not found." });
      }

      // Check if user is the author
      if (post.authorId !== userId) {
        return res
          .status(403)
          .json({ error: "You can only update your own posts." });
      }

      // Update media if provided
      let imageUrl = post.imageUrl;
      if (req.files && req.files.postImage) {
        // Delete old media if exists
        if (post.imageUrl) {
          // Extract the public ID from the URL
          const urlParts = post.imageUrl.split("/");
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split(".")[0];
          const folderName = urlParts[urlParts.length - 2];

          // Check if it's a video URL
          const isExistingVideo =
            post.imageUrl.includes("video") ||
            urlParts.some((part) => part.includes("video"));

          // Delete the resource with the appropriate resource_type
          await cloudinary.uploader.destroy(`post_media/${publicId}`, {
            resource_type: isExistingVideo ? "video" : "image",
          });
        }

        // Upload new media
        const isVideo = req.isVideo;
        const result = await cloudinary.uploader.upload(
          req.files.postImage.tempFilePath,
          {
            resource_type: isVideo ? "video" : "image",
            folder: "post_media",
          }
        );

        imageUrl = result.secure_url;
      }

      // Update the post
      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          title: title || post.title,
          content: content || post.content,
          imageUrl,
          updatedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              userName: true,
            },
          },
          community: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      res.status(200).json({
        status: "success",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  },
];

// Delete a post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Check if user is the author
    if (post.authorId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own posts." });
    }

    // Delete media from Cloudinary if exists
    if (post.imageUrl) {
      // Extract the public ID from the URL
      const urlParts = post.imageUrl.split("/");
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = publicIdWithExtension.split(".")[0];

      // Check if it's a video URL
      const isVideo =
        post.imageUrl.includes("video") ||
        urlParts.some((part) => part.includes("video"));

      // Delete the resource with the appropriate resource_type
      await cloudinary.uploader.destroy(`post_media/${publicId}`, {
        resource_type: isVideo ? "video" : "image",
      });
    }

    // Delete the post (comments and votes will cascade delete)
    await prisma.post.delete({
      where: { id },
    });

    res.status(200).json({
      status: "success",
      message: "Post deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};
// Get all posts (with optional community filter)
const getPosts = async (req, res) => {
  try {
    const { communityId } = req.query;

    const filter = communityId ? { communityId } : {};

    const posts = await prisma.post.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          },
        },
      },
    });

    // Calculate vote count for each post
    const postsWithVoteCount = await Promise.all(
      posts.map(async (post) => {
        const upvotes = await prisma.vote.count({
          where: {
            postId: post.id,
            type: "UP",
          },
        });

        const downvotes = await prisma.vote.count({
          where: {
            postId: post.id,
            type: "DOWN",
          },
        });

        return {
          ...post,
          voteScore: upvotes - downvotes,
          upvotes,
          downvotes,
        };
      })
    );

    res.status(200).json({
      status: "success",
      results: posts.length,
      data: postsWithVoteCount,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get a single post by ID
const getPost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                userName: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Get vote counts
    const upvotes = await prisma.vote.count({
      where: {
        postId: id,
        type: "UP",
      },
    });

    const downvotes = await prisma.vote.count({
      where: {
        postId: id,
        type: "DOWN",
      },
    });

    // Check if user has voted on this post
    let userVote = null;
    if (req.userId) {
      const vote = await prisma.vote.findUnique({
        where: {
          userId_postId: {
            userId: req.userId,
            postId: id,
          },
        },
      });

      if (vote) {
        userVote = vote.type;
      }
    }

    const postWithVotes = {
      ...post,
      voteScore: upvotes - downvotes,
      upvotes,
      downvotes,
      userVote,
    };

    res.status(200).json({
      status: "success",
      data: postWithVotes,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const getPostsByAuthorId = async (req, res) => {
  try {
    const { authorId } = req.query;

    // Return error if authorId is missing
    if (!authorId) {
      return res.status(400).json({
        status: "fail",
        message: "authorId is required in query parameters.",
      });
    }

    // Fetch posts ONLY for the specified author
    const posts = await prisma.post.findMany({
      where: { authorId }, // Strict filter
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            id: true,
            userName: true,
          },
        },
        community: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            votes: true,
          },
        },
      },
    });

    // Calculate vote counts (optimized batch query)
    const voteCounts = await prisma.vote.groupBy({
      by: ["postId", "type"],
      where: {
        postId: { in: posts.map((post) => post.id) },
      },
      _count: true,
    });

    // Map vote counts to posts
    const postsWithVoteCount = posts.map((post) => {
      const postVotes = voteCounts.filter((v) => v.postId === post.id);
      const upvotes = postVotes.find((v) => v.type === "UP")?._count || 0;
      const downvotes = postVotes.find((v) => v.type === "DOWN")?._count || 0;

      return {
        ...post,
        voteScore: upvotes - downvotes,
        upvotes,
        downvotes,
      };
    });

    res.status(200).json({
      status: "success",
      results: posts.length,
      data: postsWithVoteCount,
    });
  } catch (error) {
    console.error("Error fetching posts by author:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getPostsByAuthorId,
};
