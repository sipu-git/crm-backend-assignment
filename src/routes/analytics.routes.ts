import { Router } from "express";
import * as analytics from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { teamPerformanceQuerySchema } from "../validators/analytics.validator.js";

const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get("/summary", authorize("analytics:read"), analytics.summary);
analyticsRouter.get("/pipeline", authorize("analytics:read"), analytics.pipeline);
analyticsRouter.get("/team-performance", authorize("analytics:team_performance"), validateRequest({ query: teamPerformanceQuerySchema }), analytics.teamPerformance);

export default analyticsRouter;
