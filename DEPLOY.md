# Deploy — GitHub Pages + custom domain

Static single file. Host is GitHub Pages serving `main` at root. No CI, no build.

## 1. Repo

```bash
cd ~/projects/my-new-site
git init && git add -A && git commit -m "initial site"
gh repo create <owner>/<repo> --public --source=. --push   # Pages needs public on the free plan
```

GitHub → repo **Settings → Pages**: Source = "Deploy from a branch", branch `main`,
folder `/ (root)`. First build takes ~1 min.

## 2. Custom domain

Add a `CNAME` file at the repo root containing just the apex domain:
```bash
echo 'example.com' > CNAME && git add CNAME && git commit -m "custom domain" && git push
```

In **Settings → Pages → Custom domain**, enter `example.com`, Save. Tick
**Enforce HTTPS** once the cert issues (minutes to ~an hour).

## 3. DNS (at your registrar)

| Type | Host | Value |
|------|------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `<owner>.github.io` |

The `www` CNAME points at `<owner>.github.io` (NOT the apex, NOT a third party) —
GitHub then redirects `www` → apex over HTTPS. If `https://www…` fails to load
after a day, re-add the custom domain in Settings → Pages to force cert re-issue.

## 4. Harden it (do once, right after go-live)

```bash
# tag the known-good version
git tag -a v1.0 -m "launch" && git push origin v1.0

# block force-push and branch deletion on main (normal push still works)
gh api -X PUT repos/<owner>/<repo>/branches/main/protection --input - <<'JSON'
{ "required_status_checks": null, "enforce_admins": true,
  "required_pull_request_reviews": null, "restrictions": null,
  "allow_force_pushes": false, "allow_deletions": false }
JSON

# offline backup (repeat any time)
mkdir -p ~/backups && git bundle create ~/backups/<repo>-$(date +%Y%m%d).bundle --all
```

Then: 2FA on the GitHub + registrar accounts, registrar auto-renew ON with a valid
card, and copy `RUNBOOK.template.md` → `RUNBOOK.md` with the blanks filled in.

## 5. Verify

```bash
curl -sI https://example.com | head -3            # HTTP/2 200, server: GitHub.com
curl -s https://example.com | grep -c df-root      # > 0
dig +short example.com A                           # the four 185.199.108-111.153
```
