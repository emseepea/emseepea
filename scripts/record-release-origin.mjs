#!/usr/bin/env node

// ADR-0099 deploys the website build that the quality gate measured, which
// lives in a different workflow run. The release pull request has to carry a
// pointer to that run, because the publish branch cannot otherwise find it.
//
// This runs inside `version-packages`, so the file is part of the versioned
// changes the release pull request commits and rides into `publish` with them.

import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function releaseOrigin(env = process.env) {
  return {
    sha: env.GITHUB_SHA ?? "",
    qualityRunId: env.GITHUB_RUN_ID ?? "",
    recordedAt: env.EMSEEPEA_RELEASE_ORIGIN_TIME ?? new Date().toISOString(),
  };
}

export async function recordReleaseOrigin(directory = ".release", env = process.env) {
  const origin = releaseOrigin(env);
  if (!origin.sha) return undefined;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}/origin.json`, `${JSON.stringify(origin, null, 2)}\n`);
  return origin;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await recordReleaseOrigin();
}
