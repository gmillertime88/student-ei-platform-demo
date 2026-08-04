# Student EI Demo: Cloudflare + GitHub Deploy Cheat Sheet

## 1) How Deploys Work
1. Edit files locally.
2. Commit changes in git.
3. Push to GitHub (`main` for production).
4. Cloudflare Pages auto-detects push and deploys.
5. Cloudflare Access policy stays in front of the site for every new deploy.

Flow:
Local files -> Git commit -> GitHub repo -> Cloudflare Pages deploy -> Cloudflare Access login gate -> Live site

## 2) Daily Update Steps (Production)
From project folder:

```bash
git status
git add .
git commit -m "Describe your change"
git push origin main
```

Then:
1. Open Cloudflare dashboard -> Workers & Pages -> your project -> Deployments.
2. Confirm latest commit hash shows success.
3. Test live URL in normal and incognito window.

## 3) Cloudflare Access Basics
Access is identity-based, not a shared site password.

- "Allow Emails" = who is allowed in.
- "Authentication provider" = how they prove identity.

Examples:
- One-time PIN: user gets email code.
- Google/Microsoft/GitHub: user signs in with existing account password.

## 4) Add More People
1. Zero Trust -> Access controls -> Applications -> your app.
2. Edit policy (for example "Student EI Access").
3. Under Include add either:
   - `Emails` for specific users, or
   - `Email domain` for whole company (example: `proactivetech.com`).
4. Save policy, then Save application.

## 5) New App Setup (One Time)
### Cloudflare Pages
- Repo: `gmillertime88/student-ei-platform-demo`
- Branch: `main`
- Framework: `None`
- Build command: blank
- Output directory: `/`

### Cloudflare Access App
- App type: `Self-hosted`
- Hostname: `student-ei-platform-demo.pages.dev`
- Path: `*` (equivalent to `/*`)
- Policy action: `Allow`
- Include rule: your email(s) or domain
- Session duration: 8 to 24 hours

## 6) Quick Troubleshooting
### Site shows old version
1. Check Cloudflare deployment commit hash.
2. Hard refresh (`Cmd+Shift+R`).
3. Test with cache-busting URL, example:
   `https://student-ei-platform-demo.pages.dev/?v=<commit-hash>`

### Access login fails
1. Confirm your email is in Allow rule.
2. Confirm at least one auth provider is enabled.
3. Test in incognito.

### Prompt asks for password but none was created
That password belongs to the selected identity provider account (Google/Microsoft/GitHub), not a new site password.

## 7) Safe Branch Workflow (Optional)
1. Create a feature branch locally.
2. Push branch for Cloudflare preview deploy.
3. Review preview URL.
4. Merge to `main` only when ready for production.

## 8) Current Live URLs
- GitHub repo: https://github.com/gmillertime88/student-ei-platform-demo
- Cloudflare Pages: https://student-ei-platform-demo.pages.dev

---
Keep this file in the repo root for quick reference.
