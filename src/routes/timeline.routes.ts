import { Router } from "express";
import { list } from "../controllers/timeline.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { timelineParamsSchema, timelineQuerySchema } from "../validators/timeline.validator.js";

const timelineRouter = Router();
timelineRouter.use(authenticate);
timelineRouter.get("/:entityType/:entityId", authorize("timeline:read"), validateRequest({ params: timelineParamsSchema, query: timelineQuerySchema }), list);

export default timelineRouter;
