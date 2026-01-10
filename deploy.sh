#!/bin/bash

echo "🚀 Deploying Doodle Clone to Production..."

# Check if we're in a git repo
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📦 Adding files to Git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy Doodle clone with latest fixes - $(date)"

# Push to GitHub (you'll need to set the remote URL)
echo "🔄 Pushing to GitHub..."
if git remote get-url origin >/dev/null 2>&1; then
    git push origin main
else
    echo "❌ No Git remote set. Please run:"
    echo "git remote add origin https://github.com/yourusername/your-repo-name.git"
    echo "git push -u origin main"
fi

echo "✅ Deployment script complete!"
echo "📝 Next steps:"
echo "1. Connect your GitHub repo to Vercel"
echo "2. Add environment variables in Vercel dashboard"
echo "3. Deploy automatically!"

