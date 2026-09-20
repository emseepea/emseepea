#!/usr/bin/env bash
# ADR-0098 step 3: after promotion, each released package gets a git tag and a
# GitHub release carrying its bill of materials, checksums and notes. This ran
# inside the retired release workflow; it is a script here so retiring that
# workflow does not lose it.
set -euo pipefail

targets="release-artifacts/release-targets.tsv"
test -s "$targets"

ensure_release() {
  tag="$1"
  title="$2"
  notes="$3"
  shift 3
  expected_assets="$(printf '%s\n' "$@" | xargs -n1 basename | sort)"
  if gh release view "$tag" >/dev/null 2>&1; then
    test "$(gh release view "$tag" --json tagName --jq .tagName)" = "$tag"
    actual_assets="$(gh release view "$tag" --json assets --jq '.assets[].name' | sort)"
    if [ "$(gh release view "$tag" --json isDraft --jq .isDraft)" = "false" ] \
        && [ "$(gh release view "$tag" --json isPrerelease --jq .isPrerelease)" = "true" ] \
        && [ "$actual_assets" = "$expected_assets" ]; then
      return
    fi
    gh release edit "$tag" --draft --verify-tag --prerelease --latest=false --title "$title" --notes-file "$notes"
  else
    gh release create "$tag" --draft --verify-tag --prerelease --latest=false --title "$title" --notes-file "$notes"
  fi
  gh release view "$tag" --json assets --jq '.assets[].name' | while IFS= read -r asset; do
    if ! printf '%s\n' "$expected_assets" | grep -Fqx "$asset"; then
      gh release delete-asset "$tag" "$asset" --yes
    fi
  done
  gh release upload "$tag" "$@" --clobber
  test "$(gh release view "$tag" --json assets --jq '.assets[].name' | sort)" = "$expected_assets"
  gh release edit "$tag" --draft=false --verify-tag --prerelease --latest=false --title "$title" --notes-file "$notes"
  test "$(gh release view "$tag" --json tagName --jq .tagName)" = "$tag"
  test "$(gh release view "$tag" --json isDraft --jq .isDraft)" = "false"
  test "$(gh release view "$tag" --json isPrerelease --jq .isPrerelease)" = "true"
  test "$(gh release view "$tag" --json assets --jq '.assets[].name' | sort)" = "$expected_assets"
}

while IFS=$'\t' read -r name version key filename sbom_file notes_file release_sha; do
  tag="$name@$version"
  node scripts/ensure-release-tag.mjs "$tag" "$release_sha"
  ensure_release "$tag" "$tag" "release-artifacts/$notes_file" \
    "release-artifacts/$filename" \
    "release-artifacts/$sbom_file" \
    release-artifacts/RELEASE-EVIDENCE.md \
    release-artifacts/SHA256SUMS
done < "$targets"
