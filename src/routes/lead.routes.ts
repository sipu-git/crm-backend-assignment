import { Router } from "express";
import * as leads from "../controllers/lead.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize, authorizeRole } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { assignedLeadsQuerySchema, assignLeadSchema, convertLeadSchema, createLeadSchema, leadStatusSchema, leadsQuerySchema, updateLeadSchema } from "../validators/lead.validator.js";

const leadRouter = Router();
leadRouter.use(authenticate);

leadRouter.get("/", authorize("leads:read"), validateRequest({ query: leadsQuerySchema }), leads.list);
leadRouter.get("/assigned-to-me", authorizeRole("sales_executive"), validateRequest({ query: assignedLeadsQuerySchema }), leads.listAssignedToMe);
leadRouter.post("/", authorize("leads:create"), validateRequest({ body: createLeadSchema }), leads.create);
leadRouter.get("/:id", authorize("leads:read"), validateRequest({ params: idParamsSchema }), leads.getById);
leadRouter.patch("/:id", authorize("leads:update"), validateRequest({ params: idParamsSchema, body: updateLeadSchema }), leads.update);
leadRouter.patch("/:id/status", authorize("leads:update_status"), validateRequest({ params: idParamsSchema, body: leadStatusSchema }), leads.status);
leadRouter.patch("/:id/assignment", authorize("leads:assign"), validateRequest({ params: idParamsSchema, body: assignLeadSchema }), leads.assign);
leadRouter.post("/:id/convert", authorize("leads:convert"), validateRequest({ params: idParamsSchema, body: convertLeadSchema }), leads.convert);
leadRouter.delete("/:id", authorize("leads:delete"), validateRequest({ params: idParamsSchema }), leads.remove);

export default leadRouter;
