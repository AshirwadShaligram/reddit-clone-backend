import express from "express";
import {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  getPostsByAuthorId,
} from "../controller/postController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/", getPosts);
router.get("/:id", getPost);

// Protected routes (authentication required)
router.get("/author/posts", protect, getPostsByAuthorId);
router.post("/", protect, createPost);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);

export default router;
