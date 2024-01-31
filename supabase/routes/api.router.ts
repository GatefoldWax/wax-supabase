import { Router } from 'npm:express@4.18.2'
import healthCheck from '../controllers/api.controller.ts';

const apiRouter = Router();

apiRouter.route("/").get(healthCheck);

export default apiRouter;
