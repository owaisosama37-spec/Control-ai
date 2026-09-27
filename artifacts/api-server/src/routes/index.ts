import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomRouter from "./room";
import integrationsRouter from "./integrations";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(webhooksRouter);
router.use(roomRouter);

export default router;
