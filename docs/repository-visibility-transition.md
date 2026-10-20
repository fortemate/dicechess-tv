# Repository visibility transition

The release preparation tracks the portrait pack so an authorized clone has the artwork needed for a complete build. The original asset notice and digest lock remain authoritative. Changing repository visibility does not change those terms or rewrite already published history.

**Note, October 20, 2026.** The owner made the repository private on October 18, 2026, and the portrait pack was committed while it was private ([PR #435](https://github.com/fortemate/dicechess-tv/pull/435), 1.0.3/build 34). On October 20, 2026, the owner made it public again: the portraits were already shown on the public site and in the demo video, a public repository needs no reviewer invitations, and the SonarCloud scan and CodeQL, which did not run while it was private, run again. The handoff below is kept as it was written for the private period; the portrait notice and lock remain authoritative, and nothing in the published history was rewritten.

## Owner handoff

1. Review and merge the 1.0.3/build 34 preparation PR. Rebuild the final packages from main, publish the authorized GitHub release and verify its downloads.
2. Decide when the repository and its releases should require GitHub access. Once the repository is private, public source and download links need an access plan for testers and reviewers. The public project site is deployed separately by `.github/workflows/deploy-site.yaml` to Cloudflare; verify it and its GitHub links after the transition. Check the repository's separate GitHub Pages settings too.
3. Change the repository visibility as an owner action. Read back the resulting visibility and verify a clone using an intended reviewer's access. Invite reviewers only when authorized.
4. Review [PR #336](https://github.com/fortemate/dicechess-tv/pull/336), which prepares a separate licensing change and is intended for merge at or after the private transition. Refresh it against current main before review; it predates the en-US and portrait changes. No license change is implied by a visibility change.
5. Recheck Actions, CodeQL, SonarCloud and the site deployment under the new visibility. GitHub's private-repository code-scanning availability depends on the organization's security entitlement; confirm that entitlement rather than treating the earlier public-repository pass as proof. See [GitHub's visibility guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
6. Reconcile [issue #212](https://github.com/fortemate/dicechess-tv/issues/212) once the private-visibility requirement and portrait validation are both satisfied. Review whether the optional vendoring task in [PR #270](https://github.com/fortemate/dicechess-tv/pull/270) is still useful now that ordinary builds have the pinned pack.

Before the visibility switch, new commits and release assets in this repository are public. Making the repository private later does not make existing public forks private; GitHub documents that they are detached into their own network. Do not use a visibility change as a way to retract material already distributed.
