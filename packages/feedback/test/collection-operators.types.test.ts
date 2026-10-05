import { z } from "zod";
import {
  createInMemoryFeedbackCollectionBackend,
  defineFeedbackCollectionOperators,
  defineFeedbackCollections,
  type FeedbackCollectionOperatorOptions,
} from "../src/index.js";

const definition = defineFeedbackCollections({
  collections: ["internal"],
  operators: [{
    collection: "internal",
    access: "protected",
    requiredScopes: ["feedback:operator"],
  }],
});
const options = {
  definition,
  contextSchema: z.strictObject({ feature: z.string() }),
  backend: createInMemoryFeedbackCollectionBackend<{ feature: string }>(),
} satisfies FeedbackCollectionOperatorOptions<z.ZodObject<{ feature: z.ZodString }>>;

defineFeedbackCollectionOperators(options).length satisfies number;
