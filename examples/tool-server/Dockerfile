FROM docker.io/library/node:24.20.0-trixie-slim@sha256:50c3b2f6988dfc307b86e5301d69611af31f4789bdf232863b07d3b02fe55ae0 AS build
WORKDIR /app
COPY . .
RUN test "$(node --version)" = "v24.20.0" \
  && test -f package-lock.json \
  && npm ci --ignore-scripts \
  && npm run build \
  && npm prune --omit=dev --ignore-scripts

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:7781e8b4fccf59240bd539af6738cccf8dad4be303165c3a1fa065c48699b937
WORKDIR /app
ENV EMSEEPEA_DEPLOYMENT_MODE=production-behind-proxy
COPY --from=build --chown=65532:65532 /app/package.json ./package.json
COPY --from=build --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=build --chown=65532:65532 /app/dist ./dist
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD ["/nodejs/bin/node", "-e", "const port=process.env.PORT||'3000';fetch(`http://127.0.0.1:${port}/healthz`).then((r)=>process.exit(r.ok?0:1),()=>process.exit(1));"]
CMD ["dist/server.js"]
