#!/usr/bin/env bash
# ADR-0098 step 4: after everything in the release is published, merge the
# publish head back into main. Nothing is merged back before this point, which
# is what keeps the trunk untouched while a release is in flight.
#
# The merge does not fast-forward (ADR-0100), so the trunk keeps its own commit
# for the reconciliation even when it has not moved.
set -euo pipefail

expected_publish_sha="${1:-}"
if [[ ! "$expected_publish_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "expected publish SHA must be a full commit SHA" >&2
  exit 1
fi

max_attempts=3
for attempt in $(seq 1 "$max_attempts"); do
  git fetch origin main publish
  actual_publish_sha="$(git rev-parse origin/publish)"
  if [ "$actual_publish_sha" != "$expected_publish_sha" ]; then
    echo "origin/publish moved from $expected_publish_sha to $actual_publish_sha" >&2
    exit 1
  fi

  base_main_sha="$(git rev-parse origin/main)"
  git checkout --detach "$base_main_sha"
  if ! git merge --no-ff "$expected_publish_sha" \
      -m "chore(release): merge publish back into main after $expected_publish_sha"; then
    git merge --abort >/dev/null 2>&1 || true
    echo "publish merge conflicts with current main" >&2
    exit 1
  fi

  push_output="$(mktemp)"
  if git push origin HEAD:main >"$push_output" 2>&1; then
    cat "$push_output"
    rm -f "$push_output"
    git fetch origin main
    git merge-base --is-ancestor "$expected_publish_sha" origin/main \
      || { echo "released publish commit is not an ancestor of main" >&2; exit 1; }
    if find .changeset -maxdepth 1 -type f -name '*.md' ! -name README.md | grep -q .; then
      echo "consumed changesets remain on main" >&2
      exit 1
    fi
    echo "Merged $expected_publish_sha back into main on attempt $attempt."
    exit 0
  fi

  git fetch origin main
  if [ "$(git rev-parse origin/main)" = "$base_main_sha" ] \
      || ! grep -Eq 'non-fast-forward|fetch first' "$push_output"; then
    cat "$push_output" >&2
    rm -f "$push_output"
    echo "merge-back push failed without a concurrent main advance" >&2
    exit 1
  fi
  rm -f "$push_output"
  echo "main moved during merge-back attempt $attempt; retrying" >&2
done

echo "main moved during all $max_attempts merge-back attempts" >&2
exit 1
