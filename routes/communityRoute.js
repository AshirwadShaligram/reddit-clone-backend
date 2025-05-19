import express from "express";
import {
  createCommunity,
  deleteCommunity,
  getAllCommunities,
  getCommunity,
} from "../controller/communityController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all community routes
router.use(protect);

// Community routes
router.post("/", createCommunity);
router.get("/", getAllCommunities);
router.get("/:id", getCommunity);
router.delete("/:id", deleteCommunity);

export default router;
