# Git Guide — So You Never Get Stuck

A practical reference for the Git procedures you’ll use most (clone, commit, push, pull, remotes). Keep this open when you use the terminal.

---

## 1. Core Ideas (in 30 seconds)

| Term | What it means |
|------|----------------|
| **Repository (repo)** | A folder that Git tracks. Your project + its history. |
| **Remote** | A copy of the repo somewhere else (e.g. GitHub). Usually named `origin`. |
| **Branch** | A line of commits. Default is often `main` or `master`. |
| **Commit** | A saved snapshot of your project at a point in time. |
| **Stage (staging)** | Marking which changes should go into the next commit. |
| **Push** | Send your commits from your PC to the remote (e.g. GitHub). |
| **Pull** | Get commits from the remote and update your local branch. |

**Flow:** Edit files → Stage → Commit → Push (to sync with GitHub).

---

## 2. First-Time Setup (new repo on GitHub)

You create an **empty** repo on GitHub (no README, no .gitignore). Then on your PC:

```bash
cd path/to/your/project

# If this folder is NOT a Git repo yet:
git init
git add .
git commit -m "Initial commit"

# Add GitHub as the remote (use YOUR username and repo name)
git remote add origin https://github.com/YOUR_USERNAME/EduQuiz.git

# Use main as the branch name (GitHub’s default)
git branch -M main

# Push and set upstream so future pushes are easy
git push -u origin main
```

After this, your code is on GitHub and `main` is linked to `origin/main`.

---

## 3. Daily Workflow (you already have a repo)

When you’ve changed files and want to save and sync:

```bash
# 1. See what changed
git status

# 2. Stage everything (or stage specific files: git add src/App.tsx)
git add .

# 3. Commit with a short message
git commit -m "Add login page"

# 4. Push to GitHub (if you used -u origin main once, this is enough)
git push
```

If you’re on another branch (e.g. `feature-auth`):

```bash
git push -u origin feature-auth   # first time
git push                          # after that
```

---

## 4. Remotes — Where Git Pushes/Pulls

Your repo can have several “remotes” (other copies of the repo). The one for GitHub is usually called `origin`.

| Task | Command |
|------|--------|
| List remotes | `git remote -v` |
| Add a remote | `git remote add origin https://github.com/USER/REPO.git` |
| Change URL of `origin` | `git remote set-url origin https://github.com/USER/REPO.git` |
| Remove a remote | `git remote remove origin` |

**Typical issue:** You created a new repo (e.g. EduQuiz) but `origin` still points to an old repo (e.g. Quiz_web). Fix:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/EduQuiz.git
git push -u origin main
```

---

## 5. Branches (quick reference)

| Task | Command |
|------|--------|
| List branches | `git branch` |
| Current branch | `git branch` (the one with `*`) |
| Create and switch to a new branch | `git checkout -b feature-name` |
| Switch branch | `git checkout main` or `git checkout feature-name` |
| Push a new branch to GitHub | `git push -u origin feature-name` |

`-u` (or `--set-upstream`) links your local branch to the remote one so later you can just `git push` and `git pull`.

---

## 6. Pull Before Push (avoid “rejected” errors)

If someone else (or you from another PC) updated the same branch on GitHub, a plain `git push` can be rejected. Always pull first, then push:

```bash
git pull origin main
# fix any merge conflicts if Git says so
git push origin main
```

Or, if your branch already has an upstream set:

```bash
git pull
git push
```

---

## 7. Common Problems and Fixes

### “Permission denied” or “Authentication failed”

- **HTTPS:** Git will ask for username/password. For GitHub, use a **Personal Access Token (PAT)** instead of your account password.
- **SSH:** Use an SSH key and add it to GitHub (Settings → SSH and GPG keys). Then use the SSH URL:  
  `git@github.com:YOUR_USERNAME/EduQuiz.git`

### “Failed to push: updates were rejected”

Remote has commits you don’t have (e.g. README added on GitHub). Pull first:

```bash
git pull origin main --rebase
git push origin main
```

(`--rebase` puts your commits on top of the remote ones; often cleaner.)

### “Push cannot contain secrets” / GH013 (GitHub Push Protection)

GitHub blocks the push because it detected **secrets** in your code (passwords, API keys, tokens, etc.).

**What to do:**

1. **Find and remove the secret** from the repo:
   - Remove hardcoded passwords, `DB_PASSWORD`, `JWT_SECRET`, API keys, etc. from source and docs.
   - Use environment variables (e.g. `.env`) and keep `.env` in `.gitignore`.
   - In docs (e.g. DEPLOYMENT.md), use placeholders like `your-db-password`, not real values.

2. **If the secret was in an earlier commit**, it’s still in history. Options:
   - **Preferred:** Create a *new* commit that removes the secret and push. For the future, rotate the exposed secret (new DB password, new JWT secret, etc.) since the old one is compromised.
   - **Advanced:** Rewrite history to remove the secret (e.g. `git filter-branch` or BFG Repo-Cleaner), then force-push. Only do this if you understand the impact.

3. **Unblock in GitHub (temporary):** In your repo go to **Security → Secret scanning → Unblock secret** and follow the link from the error. Use this only to unblock after you’ve removed the secret from the code and (if needed) rotated it.

Never commit `.env` or real credentials; use `.env.example` with placeholders only.

### “Remote origin already exists”

You already added `origin`. Change its URL instead of adding again:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/EduQuiz.git
```

### “Branch ‘main’ has no upstream branch”

Git doesn’t know where to push. Set it once:

```bash
git push -u origin main
```

### Wrong branch / “I’m on the wrong branch”

```bash
git branch              # see current branch (*)
git checkout main       # switch to main
# or
git checkout -b new-branch   # create and switch to new branch
```

### “Merge conflict” after pull

Git will list conflicted files. Open them, look for `<<<<<<<`, `=======`, `>>>>>>>`, edit to the correct version, then:

```bash
git add .
git commit -m "Resolve merge conflict"
git push
```

### Undo last commit (keep changes)

```bash
git reset --soft HEAD~1
```

### See the commit history

```bash
git log --oneline
```

---

## 8. Cheat Sheet (copy-paste friendly)

```bash
# First time: connect folder to new GitHub repo
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main

# Daily: save and sync
git add .
git commit -m "Your message"
git pull
git push

# Fix wrong remote URL
git remote set-url origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Check where origin points
git remote -v
```

---

## 9. GitHub Personal Access Token (for HTTPS)

If GitHub asks for a password and rejects your account password:

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).
2. Generate new token, give it a name, choose expiry, enable at least `repo`.
3. Copy the token and use it **as the password** when Git asks (username = your GitHub username).

Keep the token secret; don’t commit it.

---

Once you’re used to: **status → add → commit → pull → push** and **remotes**, you’ll rarely get stuck. Use this file whenever something doesn’t work and match the error message to the section above.
