import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomRouter from "./room";
import integrationsRouter from "./integrations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(integrationsRouter);
router.use(roomRouter);

export default router;
