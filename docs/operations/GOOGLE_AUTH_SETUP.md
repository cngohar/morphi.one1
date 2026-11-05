# Google sign-in: local setup

The owner approved Google-only accounts and the account-screen designs on 2026-10-23. Local account storage and server-side session handling are implemented. The owner has now supplied Google OAuth credentials in ignored `.dev.vars` (2026-10-23). The local app loads them; the owner subsequently confirmed interactive local Google OAuth works. The automated tests stop at Google's provider boundary; the real-flow evidence is owner-reported. No Google project or remote database was created by the agent.

## Prepare the local app

From the repository root:

```sh
bun install
bun run accounts:setup
bun run cf:types
bun run db:migrate:local
bun run dev --host 0.0.0.0
```

`accounts:setup` creates an ignored `.dev.vars` file with a generated local `BETTER_AUTH_SECRET` and blank Google fields. It preserves existing values and restricts the file to the current user. Do not paste secrets into chat, screenshots, issues, or source control. Do not copy `.dev.vars.example` over an existing `.dev.vars`.

Use `http://localhost:5173/account/sign-in` for Google testing. If Vite reports a different port, free port 5173 rather than silently using another callback URL. The current `BETTER_AUTH_URL` is explicitly `http://localhost:5173`; Google callback URLs must match exactly.

## Create the Google OAuth web client

1. Open the [Google Cloud Console](https://console.cloud.google.com/) using the account that should own Morphi’s OAuth setup. Choose or create a project for Morphi.
2. Configure **Google Auth platform → Branding** with Morphi’s name and the owner’s support/contact email.
3. In **Audience**, choose External for a public game. Keep it in Testing while testing locally, and add the owner/testers as test users where required by Google.
4. In **Clients**, create an OAuth client with application type **Web application**. Give it a recognizable local-development name.
5. Add this exact **Authorized redirect URI**:

   ```text
   http://localhost:5173/api/auth/callback/google
   ```

6. This implementation uses a server redirect flow, not Google’s browser widget. No browser JavaScript origin is needed for that flow. If the console asks for an application origin, use `http://localhost:5173`.
7. Copy the client ID and client secret into the existing ignored `.dev.vars` file:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

8. Preserve the generated `BETTER_AUTH_SECRET`. Restart the development server, then visit `http://localhost:5173/account/sign-in`.

Only basic OpenID/email/profile access is needed. Morphi does not request Gmail, Drive, Calendar, contacts, or offline access. Do not add unrelated API scopes or enable billing for this local sign-in setup.

## Check the real flow

- Continue with Google, select a test account, and return to Morphi.
- Choose a public player name. The name is separate from Google’s private name and email.
- Reload Your account, then sign out and back in. The player name should persist.
- Cancel Google sign-in and confirm guest play still works.
- Delete an account from the confirmation dialog. A session older than five minutes requires signing in again before deletion.
- Account pages should never show a different user’s profile. Real game-history sync and ranked scores are the next implementation slice; this slice shows empty saved progress.

A phone’s `localhost` refers to the phone itself. The LAN URL is useful for layout/guest testing, but the current Google flow is configured for the development machine’s `localhost`. Do not substitute the LAN IP into the OAuth callback. Cross-device account testing will require an owner-approved HTTPS test environment later.

## Testing status and brand verification

The owner reports the OAuth app is in **Testing** and branding has not been submitted. Keep it in Testing while completing local login. Development/testing is exempt from brand verification; this does not prevent the existing guest-play website from remaining public.

For the public Morphi Google-login release, plan to publish the production OAuth app and complete brand verification so Google displays Morphi’s name and branding. Publication status, brand verification, and sensitive/restricted-scope verification are separate. Morphi currently requests only `openid`, `email`, and `profile`, so a sensitive/restricted-data review is not needed for these sign-in scopes. Google’s current state table explicitly allows basic-identity-only apps in Testing to be used without test-user allowlisting; adding intended testers remains appropriate where Google’s console asks for them. Workspace administrator restrictions can still apply.

Before brand verification, prepare the public home page’s app description and privacy-policy link, a privacy policy hosted on the same domain, project contact/support details, and ownership verification for the authorized domain through Google Search Console. Terms of service are optional according to the current home-page requirements. Use a separate production OAuth project/client, exact HTTPS callback, and production secrets when the production rollout is authorized. Do not change DNS, publish the OAuth app, submit branding, or deploy the Worker as part of local sign-in testing.

Sources checked 2026-10-23: [Google OAuth state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), and [authentication production policy](https://developers.google.com/identity/verification/authentication-policy-compliance).

## Production comes later

The checked-in D1 binding has the explicit local-only placeholder ID `local-morphi-accounts` and `remote: false`. It is not a production database. Before any owner-approved release, create the intended remote D1 database, replace its binding ID/name, apply reviewed migrations to that target, set `BETTER_AUTH_URL` to the selected canonical HTTPS origin, and stage the matching Worker secrets. Configure a separate production Google project/web client and its exact HTTPS callback. Review Google’s publishing requirements and complete a real sign-in/deletion smoke test before release. Every deploy still needs explicit owner approval under `AGENTS.md`.

A full web admin panel is not part of this slice. The existing plan starts with an audit-logged admin command tool when ranked scores and moderation are implemented.

## References checked 2026-10-23

- [Google: OAuth web-server credentials](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)
- [Google: consent, audience, and test users](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Better Auth: Google](https://better-auth.com/docs/authentication/google)
- [Better Auth: SvelteKit integration](https://better-auth.com/docs/integrations/svelte-kit)
- [Better Auth: Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Cloudflare: local D1 development](https://developers.cloudflare.com/d1/best-practices/local-development/)

## Public release instructions

Use [GOOGLE_OAUTH_PUBLIC.md](GOOGLE_OAUTH_PUBLIC.md) for the future production project, domain/privacy preparation, exact callback, branding submission/publication, production configuration, and live smoke checks. That guide does not authorize those remote actions. Step 6 remains local until the owner separately approves provisioning and deployment.
