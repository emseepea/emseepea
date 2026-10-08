import type { FeedbackEvent } from "../src/index.js";
import {
  createPostgresFeedbackUpdateConsumer,
  type PostgresFeedbackPool,
} from "../src/postgres.js";

declare const pool: PostgresFeedbackPool;
const consumer = createPostgresFeedbackUpdateConsumer({ pool, scope: "account", consumerId: "instance", batchSize: 20 });
consumer.consume(async (event) => {
  event satisfies Readonly<FeedbackEvent>;
  event.scope satisfies string;
  // @ts-expect-error update hints do not contain feedback content
  void event.body;
}) satisfies Promise<number>;
consumer.forget() satisfies Promise<void>;
// @ts-expect-error an exact scope is mandatory
createPostgresFeedbackUpdateConsumer({ pool, consumerId: "instance" });
