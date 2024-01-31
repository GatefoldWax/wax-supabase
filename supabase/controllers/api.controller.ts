import { NextFunction, Request, Response } from 'npm:express@4.18.2'

const healthCheck =  (_req: Request, res: Response, _next: NextFunction): void => {
    console.log('all good from Deno')
res.status(200).send({msg: "ok"})
}

export default healthCheck
