# Cognitive Accessibility Review, 9 September 2026

## Initializer Artifact Release Recovery

Result: PASS. Independent cognitive-accessibility and Markdown accessibility
reviews covered the exact release-readiness record.

The record uses clear headings, exact package versions, and direct publication
boundaries. It distinguishes the eight pending corrective initializer versions
from the packages already published. No blocking accessibility finding remains.

- `docs/reviews/current-release-readiness.md`
  SHA-256: `08a90fab609fd0a167b126c2f82b4c46f6cbc8eecdad844b2f1ff98d952882c5`

## Pluggable Authentication and Observability

Result: PASS. Independent cognitive-accessibility, Markdown accessibility, and
web accessibility reviews covered the public guidance, release prose, and all
ten maintained initializer guides.

The guidance keeps open access as the simplest default, separates protected
access from observability, uses short task-oriented sections, and consistently
explains that authentication can be added to any initializer. No blocking
accessibility finding remains.

- `.changeset/calm-peas-compose.md`
  SHA-256: `b883981ef0d742236905a77ee8c7f834f3274049ca53a564035a017453fd9ef3`
- `.github/workflows/release.yml`
  SHA-256: `0f5e2cfd0c9a9c68e89a31c3263a7cc5e88d0d2a03f1da046f4569e94fbd8128`
- `QUALITY.md`
  SHA-256: `f135107a3d07b6f3d5fbe5b93834e4ff7562fcb382fe2a283d7d66cb255415f7`
- `README.md`
  SHA-256: `5f312e660a6737931cc1d25131794bb0d6b1f192434117c1d552b410f6a4f276`
- `docs/decisions/0012-typed-operations-and-opentelemetry-boundary.superseded.md`
  SHA-256: `ec741dfa109db0c97fa24b73f02ab9a1e6888b9ec8cc564b12478e526724f31a`
- `docs/decisions/0018-public-discovery-and-invocation-scoped-oauth-security.superseded.md`
  SHA-256: `44b5bc29a4f7be77d5e7aeb8d756c8948d33a7903d13d2f5b4cc8d43e648a4ed`
- `docs/decisions/0064-typed-authentication-with-optional-permission-shaped-discovery.proposed.md`
  SHA-256: `0a27dd736fb57e99cad7ed8e1968ae6e28eb88fd9c07bd0f4f800f33383716ef`
- `docs/decisions/0065-framework-redacted-observability-adapters.proposed.md`
  SHA-256: `03a3388e84a811e38c10f05a3ad89eaf759495ea66f76228509c57971cf440ca`
- `docs/decisions/README.md`
  SHA-256: `c33110223b4bf230e25afaaa8e18844fc8277b7e1d1b0aacb8aa80db3a27c645`
- `docs/protocol-coverage.md`
  SHA-256: `741a728b6558ec2953f14622101655e936b80d2ba17dc8d41d7aa2d583dbcb61`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `5cc7ecc6db76c3c6769e247582ddd38d269bf4ea694db5c6fffadd0c871224c5`
- `docs/risks/R002-protected-tools-run-without-valid-authorization.active.md`
  SHA-256: `18270c92fd040036134632778fa4826bf067cca3fdc16691611c4f940be9c8d9`
- `docs/risks/R006-work-outlives-deadlines-or-resource-bounds.active.md`
  SHA-256: `2f2ab6269843efa72e6603e73ca3e50a71a6cd7476eca4efe35f51e054097838`
- `examples/api-backed-server/README.md`
  SHA-256: `48ee2d188a8aa5832b7bc338ccd2ad6c9cf6f1e7f61c5fca17bd1a79a0072101`
- `examples/database-schema-server/README.md`
  SHA-256: `dc6ff3913dc4911c071240a08d35ebb011dcec108168bd58da1a866cb86ebef0`
- `examples/html-ui-server/README.md`
  SHA-256: `8367aa4eef19b8f703def04bf6b79222d951f1949f2bd1102c556506bece34c2`
- `examples/mongodb-backed-server/README.md`
  SHA-256: `aea7166b217e871c1153811c3b2f44629c95ef8f6b167463deef694319e6a3aa`
- `examples/multi-instance-postgres-server/README.md`
  SHA-256: `786cf7e21bcb521665a6ba6d955957308bf44f0429117193b1cfaaabb87b7ebb`
- `examples/progress-streaming-server/README.md`
  SHA-256: `dc00ea7ca3fe519b2822930dc5512f1c5fc59ea012696bbaede7f03929997bd2`
- `examples/react-ui-server/README.md`
  SHA-256: `ecf9c95f6495e2de8bc0ece9913fc8ac45d439e6e91d6828bc81a4b28b1c9432`
- `examples/resources-and-prompts-server/README.md`
  SHA-256: `68a711e1ed23d22eb7603858d6c6f040ab8397c1b0db4d1e4230dce01b760eee`
- `examples/soap-backed-server/README.md`
  SHA-256: `2ddd44caa943b57c9b337208320b2efb1920a913b3c59caf410a89c8eb336da6`
- `examples/tool-server/README.md`
  SHA-256: `a0f2b14743384e29806d4a234944f507877361dbdda0efb7ce84befead2191c1`
- `packages/framework/README.md`
  SHA-256: `337759860caaf9475f29fc90669487ad3f2e06b67f7bbeed596612559ed3b5bc`
- `packages/testing/README.md`
  SHA-256: `b869c7394df4b73b3e4be1b3ac807d5ecd52cbc111425f1486283db73865711e`
- `website/src/content/docs/ai-tests.md`
  SHA-256: `a3cec4eb2046fb158ba8b0b01cecb3c320558b967f1adddfe7bea420403e0159`
- `website/src/content/docs/examples.md`
  SHA-256: `df3f686eb90d00a9bd8964ba996967759ed397489474b3720fb696ef0943e247`
- `website/src/content/docs/getting-started.md`
  SHA-256: `d5d1c18dee8b1593b2c5d3a1f074a39d043df7bc850ceabc95cec1e5efb65b85`
- `website/src/content/docs/index.md`
  SHA-256: `a21c4c5446f90fb2cd341951cbfb5c689f3825f68fd8455014f862148ed099a3`
- `website/src/content/docs/less-server-code.md`
  SHA-256: `f158b83933bce1bf97fba26ebbaea1795f345f80731dd20d796cce2293964fee`
