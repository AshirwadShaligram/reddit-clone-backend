import { v2 as cloudinary } from "cloudinary"; // Cloudinary SDK
import { validateCommunityImages } from "../middleware/uploadMiddleware.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configure Cloudinary (usually done in a separate config file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create a new community (with image uploads)
const createCommunity = [
  validateCommunityImages,
  async (req, res) => {
    try {
      const { name, description, isPublic } = req.body;
      const createdById = req.userId; // Get from auth middleware

      // Check if files were uploaded
      const files = req.files || {};

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: "Community name is required." });
      }

      // Upload images to Cloudinary (if provided)
      let bannerUrl, logoUrl;

      if (files.bannerImage) {
        const result = await cloudinary.uploader.upload(
          files.bannerImage.tempFilePath,
          {
            folder: "community_banners",
          }
        );
        bannerUrl = result.secure_url;
      }

      if (files.logoImage) {
        const result = await cloudinary.uploader.upload(
          files.logoImage.tempFilePath,
          {
            folder: "community_logos",
          }
        );
        logoUrl = result.secure_url;
      }

      // Create the community
      const community = await prisma.community.create({
        data: {
          name,
          description,
          banner: bannerUrl,
          logo: logoUrl,
          isPublic: isPublic === "true" || isPublic === true,
          createdById,
        },
      });

      res.status(201).json({
        status: "success",
        data: community,
      });
    } catch (error) {
      console.error("Error creating community:", error);
      if (error.code === "P2002") {
        return res
          .status(400)
          .json({ error: "Community name already exists." });
      }
      res.status(500).json({ error: "Internal server error." });
    }
  },
];

// Delete a community (and its images from Cloudinary)
const deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // Get from auth middleware

    // Find the community
    const community = await prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      return res.status(404).json({ error: "Community not found." });
    }

    // Check if the user is the creator
    if (community.createdById !== userId) {
      return res
        .status(403)
        .json({ error: "Only the creator can delete this community." });
    }

    // Delete images from Cloudinary (if they exist)
    if (community.banner) {
      const publicId = community.banner.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`community_banners/${publicId}`);
    }

    if (community.logo) {
      const publicId = community.logo.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`community_logos/${publicId}`);
    }

    // Delete the community from the database
    await prisma.community.delete({
      where: { id },
    });

    res.status(200).json({
      status: "success",
      message: "Community deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting community:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get all communities
const getAllCommunities = async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        banner: true,
        logo: true,
        isPublic: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            userName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      results: communities.length,
      data: communities,
    });
  } catch (error) {
    console.error("Error fetching communities:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// Get a single community by ID
const getCommunity = async (req, res) => {
  try {
    const { id } = req.params;

    const community = await prisma.community.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        banner: true,
        logo: true,
        isPublic: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            userName: true,
          },
        },
      },
    });

    if (!community) {
      return res.status(404).json({ error: "Community not found." });
    }

    res.status(200).json({
      status: "success",
      data: community,
    });
  } catch (error) {
    console.error("Error fetching community:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

export { createCommunity, deleteCommunity, getAllCommunities, getCommunity };
