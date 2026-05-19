Circuit: Recommendation ready. The direction is ready to use.

- Recommendation: Recommend a phased path: ship a plugin-plus-separate-CLI install with an npm-packaged CLI as the canonical distribution channel, gated behind a bootstrap check inside the plugin that detects a missing/outdated circuit-next binary and prints a single copy-pasteable install command (npm i -g circuit-next or equivalent).
- Reviewer: Accepted the direction, with notes to fold in.
- Follow-up: Licensing/distribution implications of publishing circuit-next to npm (package name squatting, org ownership, public vs. scoped) are not weighed, which can constrain the npm-as-canonical-channel recommendation.
- Follow-up: Offline/air-gapped and corporate-proxy install scenarios are not considered, which materially affect whether npm-global is a viable default channel for some Claude Code users.
- Follow-up: No discussion of how the plugin detects an outdated (vs. merely missing) circuit-next and whether the version-skew prompt is silent on match, which is the part of the detect-and-prompt UX most likely to regress first-run success.
