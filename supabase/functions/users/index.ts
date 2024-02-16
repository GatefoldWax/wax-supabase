import express, {
  NextFunction,
  Request,
  Response,
  Router,
  ErrorRequestHandler,
} from "npm:express@4.18.2";
import format from "npm:pg-format";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

//* connection
const db = new Client(Deno.env.get("DB_CONN_STR"));

//* interfaces

//* models
const checkFollows = async (username): Promise<void> => {
  const formattedQuery = format(
    `SELECT following FROM users
    WHERE username = '%s'
    ;`,
    username
  );
  const { rows } = await db.queryObject(formattedQuery);
  return rows[0];
};

const updateFollows = async (username, new_follow): Promise<void> => {
  const formattedQuery = format(
    `UPDATE users
    WHERE username = %s
    SET
    ;`,
    username
  );
  const { rows } = await db.queryObject(formattedQuery);
  return rows as Review[];
};

//* controllers
const getFollows = async (req: Request, res: Response, next: NextFunction) => {
  const { username } = req.params;
  try {
    const following = await checkFollows(username);
    res.status(200).send(following);
  } catch (err) {
    next(err);
  }
};

const addFriend = async (req: Request, res: Response, next: NextFunction) => {
  const { new_follow } = req.body;
  const { username } = req.params;
  try {
    const { following } = await checkFollows(username);
    if (!following.includes()) {
      await updateFollows(username, new_follow);
      res
        .status(200)
        .send({ msg: `${username} is now following ${new_follow}` });
    } else res.status(400).send({msg: "User already followed"})
  } catch (err) {
    next(err);
  }
};

//* router
const reviewRouter = Router();

reviewRouter.route("/:username").get(getFollows);
// .patch(addFriend);

//* error handlers
const handleCustomError: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.status) {
    res.status(err.status).send({ msg: err.msg });
  } else next(err);
};

const handlePsqlErrors: ErrorRequestHandler = (err, _req, res, next) => {
  switch (err.code) {
    case "22P02":
    case "23502":
      res.status(400).send({ msg: "bad request" });
      break;
    case "23503":
      res.status(404).send({ msg: "not found" });
      break;
    default:
      next(err);
      break;
  }
};

const handle404 = (_req: Request, res: Response) => {
  res.status(404).send({ msg: "incorrect path - path not found" });
};

const handleServerErrors: ErrorRequestHandler = (err, _req, res, next) => {
  console.log(err);
  res.status(500).send({ msg: "internal server error" });
};

//* listener
const app = express();
app.use(express.json());

app.use("/users", reviewRouter);

app.all("*", handle404);

app.use(handlePsqlErrors);
app.use(handleCustomError);
app.use(handleServerErrors);

app.listen(3030);
