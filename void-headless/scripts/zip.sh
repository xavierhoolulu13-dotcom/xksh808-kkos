#!/bin/bash
echo "📦 Zipping void-headless..."
zip -r void-headless-dist.zip dist/ package.json .env.example
echo "✅ void-headless-dist.zip ready"
