import type { NativeChatGptAuthorization, NativeChatGptJourney } from "../src/chatgpt.js";

declare const journey: NativeChatGptJourney;
declare const authorization: NativeChatGptAuthorization;

// @ts-expect-error Native execution requires an affirmative opt-in.
const disabled: NativeChatGptJourney = { ...journey, enabled: false };
// @ts-expect-error Declared ownership approval cannot default to false.
const unapproved: NativeChatGptAuthorization = { ...authorization, approved: false };
// @ts-expect-error Production learner data is not a native browser fixture policy.
const learnerData: NativeChatGptAuthorization = { ...authorization, fixturePolicy: "production" };
void disabled;
void unapproved;
void learnerData;
