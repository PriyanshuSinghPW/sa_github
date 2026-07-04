# Clean Up Repository - Remove node_modules from Git

## The Problem
GitHub Pages/Jekyll is trying to process files in node_modules, causing slow builds and errors.

## The Solution

### Step 1: Remove node_modules from Git tracking
Run these commands in PowerShell from your repository root:

```powershell
# Remove node_modules from Git tracking (keeps local files)
git rm -r --cached js-analytics-bridge/node_modules

# If you have node_modules in root too:
# git rm -r --cached node_modules

# Commit the removal
git commit -m "Remove node_modules from repository"

# Push to GitHub
git push origin main
```

### Step 2: Verify the changes
After pushing, check that:
- ✅ `_config.yml` exists (already created)
- ✅ `.gitignore` includes node_modules (already there)
- ✅ GitHub Pages build completes faster
- ✅ No more "Rendering: js-analytics-bridge/node_modules/..." messages

### What was fixed:
1. Created `_config.yml` with explicit exclusions
2. Configured Jekyll to skip:
   - node_modules/
   - js-analytics-bridge/node_modules/
   - dist/
   - tests/
   - config files

### Note:
The `.gitignore` file already had node_modules listed, but files committed before .gitignore was added remain in the repository. The `git rm --cached` command removes them from Git tracking while keeping your local files intact.

### Alternative: Use .nojekyll
If you want to completely disable Jekyll processing (since this is a pure HTML/CSS/JS game):
1. The `.nojekyll` file already exists in your repo
2. Make sure it's committed and pushed
3. This should bypass Jekyll entirely, but _config.yml provides more control

### Verify it worked:
After pushing, go to your GitHub repository → Settings → Pages and check the build logs. You should see a much shorter build process without all the node_modules rendering messages.
