import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Cast a vote (create or update)
const castVote = async (req, res) => {
  try {
    const { postId, type } = req.body;
    const userId = req.userId; // From auth middleware

    // Validate required fields
    if (!postId || !type) {
      return res.status(400).json({ error: "PostId and type are required." });
    }

    // Validate vote type
    if (type !== "UP" && type !== "DOWN") {
      return res.status(400).json({ error: "Vote type must be UP or DOWN." });
    }

    // Check if post exists
    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!postExists) {
      return res.status(404).json({ error: "Post not found." });
    }

    // Check if vote exists
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    let vote;

    if (existingVote) {
      // If vote type is the same, remove the vote (toggle)
      if (existingVote.type === type) {
        await prisma.vote.delete({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
        });

        vote = null;
      } else {
        // Update the vote
        vote = await prisma.vote.update({
          where: {
            userId_postId: {
              userId,
              postId,
            },
          },
          data: {
            type,
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Create a new vote
      vote = await prisma.vote.create({
        data: {
          type,
          userId,
          postId,
        },
      });
    }

    // Get current vote counts
    const upvotes = await prisma.vote.count({
      where: {
        postId,
        type: "UP",
      },
    });

    const downvotes = await prisma.vote.count({
      where: {
        postId,
        type: "DOWN",
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        vote,
        voteScore: upvotes - downvotes,
        upvotes,
        downvotes,
      },
    });
  } catch (error) {
    console.error("Error casting vote:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get a user's vote on a post
const getUserVote = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Find the vote
    const vote = await prisma.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    res.status(200).json({
      status: "success",
      data: vote || null,
    });
  } catch (error) {
    console.error("Error fetching vote:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Delete a vote
const deleteVote = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Find the vote
    const vote = await prisma.vote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    if (!vote) {
      return res.status(404).json({ error: "Vote not found." });
    }

    // Delete the vote
    await prisma.vote.delete({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });

    // Get current vote counts
    const upvotes = await prisma.vote.count({
      where: {
        postId,
        type: "UP",
      },
    });

    const downvotes = await prisma.vote.count({
      where: {
        postId,
        type: "DOWN",
      },
    });

    res.status(200).json({
      status: "success",
      message: "Vote removed successfully.",
      data: {
        voteScore: upvotes - downvotes,
        upvotes,
        downvotes,
      },
    });
  } catch (error) {
    console.error("Error deleting vote:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export { castVote, getUserVote, deleteVote };
