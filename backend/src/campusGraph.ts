import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db/index.ts";
import {
  campusGraphVersions,
  campusGraphNodes,
  campusGraphEdges,
} from "./db/schema.ts";

const router = Router();

router.get("/latest", async (_req, res) => {
  try {
    const [activeVersion] = await db
      .select()
      .from(campusGraphVersions)
      .where(eq(campusGraphVersions.status, "active"))
      .limit(1);

    if (!activeVersion) {
      return res.status(404).json({
        error: "No active campus graph found",
      });
    }

    const nodes = await db
      .select()
      .from(campusGraphNodes)
      .where(eq(campusGraphNodes.graphVersionId, activeVersion.id));

    const edges = await db
      .select()
      .from(campusGraphEdges)
      .where(eq(campusGraphEdges.graphVersionId, activeVersion.id));

    res.json({
      version: {
        id: activeVersion.id,
        campusId: activeVersion.campusId,
        source: activeVersion.source,
        osmRelationId: activeVersion.osmRelationId,
        fetchedAt: activeVersion.fetchedAt,
        activatedAt: activeVersion.activatedAt,
      },
      nodes,
      edges,
    });
  } catch (error) {
    console.error("Failed to fetch campus graph:", error);
    res.status(500).json({
      error: "Failed to fetch campus graph",
    });
  }
});

router.get("/version", async (_req, res) => {
  try {
    const [activeVersion] = await db
      .select()
      .from(campusGraphVersions)
      .where(eq(campusGraphVersions.status, "active"))
      .limit(1);

    if (!activeVersion) {
      return res.status(404).json({
        error: "No active campus graph found",
      });
    }

    res.json({
      id: activeVersion.id,
      campusId: activeVersion.campusId,
      source: activeVersion.source,
      osmRelationId: activeVersion.osmRelationId,
      fetchedAt: activeVersion.fetchedAt,
      activatedAt: activeVersion.activatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch campus graph version:", error);
    res.status(500).json({
      error: "Failed to fetch campus graph version",
    });
  }
});

export default router;
