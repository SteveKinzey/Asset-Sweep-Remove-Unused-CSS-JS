#!/bin/bash

# Asset Sweep - Complete Setup Script
# This script copies all project files to ~/code/asset-sweep and commits them

set -e  # Exit on error

ASSET_SWEEP_DIR="$HOME/code/asset-sweep"
DOWNLOADS_DIR="$HOME/Downloads"  # Adjust if files are in a different location

echo "🚀 Asset Sweep - Complete Setup"
echo "================================="
echo ""

# Check if asset-sweep directory exists
if [ ! -d "$ASSET_SWEEP_DIR" ]; then
    echo "❌ Error: $ASSET_SWEEP_DIR does not exist"
    echo "Please create it first with: mkdir -p ~/code/asset-sweep"
    exit 1
fi

echo "📁 Target directory: $ASSET_SWEEP_DIR"
echo ""

# Create necessary directories
echo "📂 Creating directory structure..."
mkdir -p "$ASSET_SWEEP_DIR/.github/ISSUE_TEMPLATE"
mkdir -p "$ASSET_SWEEP_DIR/.github/workflows"

# Copy documentation files
echo "📄 Copying documentation files..."
cp asset-sweep-README.md "$ASSET_SWEEP_DIR/README.md"
cp asset-sweep-ABOUT.md "$ASSET_SWEEP_DIR/ABOUT.md"
cp asset-sweep-CONTRIBUTING.md "$ASSET_SWEEP_DIR/CONTRIBUTING.md"
cp asset-sweep-CHANGELOG.md "$ASSET_SWEEP_DIR/CHANGELOG.md"
cp asset-sweep-CODE_OF_CONDUCT.md "$ASSET_SWEEP_DIR/CODE_OF_CONDUCT.md"
cp asset-sweep-LICENSE "$ASSET_SWEEP_DIR/LICENSE"

# Copy configuration files
echo "⚙️  Copying configuration files..."
cp asset-sweep-package.json "$ASSET_SWEEP_DIR/package.json"
cp asset-sweep-.gitignore "$ASSET_SWEEP_DIR/.gitignore"
cp asset-sweep-tsconfig.json "$ASSET_SWEEP_DIR/tsconfig.json"
cp asset-sweep-.eslintrc.json "$ASSET_SWEEP_DIR/.eslintrc.json"
cp asset-sweep-.prettierrc.json "$ASSET_SWEEP_DIR/.prettierrc.json"
cp asset-sweep-jest.config.js "$ASSET_SWEEP_DIR/jest.config.js"

# Copy GitHub templates
echo "🔧 Copying GitHub templates..."
cp asset-sweep-PULL_REQUEST_TEMPLATE.md "$ASSET_SWEEP_DIR/.github/PULL_REQUEST_TEMPLATE.md"
cp asset-sweep-BUG_REPORT_TEMPLATE.md "$ASSET_SWEEP_DIR/.github/ISSUE_TEMPLATE/bug_report.md"
cp asset-sweep-FEATURE_REQUEST_TEMPLATE.md "$ASSET_SWEEP_DIR/.github/ISSUE_TEMPLATE/feature_request.md"

# Copy CI/CD workflow
echo "🔄 Copying CI/CD workflow..."
cp asset-sweep-ci.yml "$ASSET_SWEEP_DIR/.github/workflows/ci.yml"

echo ""
echo "✅ All files copied successfully!"
echo ""

# Change to asset-sweep directory
cd "$ASSET_SWEEP_DIR"

# Show file structure
echo "📋 Current directory structure:"
echo ""
ls -la
echo ""

# Git commit
echo "📝 Committing files to Git..."
git add -A

git commit -m "docs: add comprehensive documentation, configuration, and GitHub workflows

- Add README.md with full feature documentation and usage examples
- Add ABOUT.md with project philosophy and vision
- Add CONTRIBUTING.md with development guidelines
- Add CHANGELOG.md with version history
- Add CODE_OF_CONDUCT.md for community standards
- Add MIT LICENSE
- Add package.json with proper metadata and scripts
- Add TypeScript, ESLint, Prettier, and Jest configurations
- Add GitHub issue and PR templates
- Add GitHub Actions CI/CD workflow
- Create .github directory structure"

echo ""
echo "✅ Git commit successful!"
echo ""
echo "📤 Ready to push! Run this command:"
echo ""
echo "   cd $ASSET_SWEEP_DIR && git push -u origin main"
echo ""
echo "🎉 Setup complete!"
