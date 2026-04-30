#!/bin/bash

echo "Removing MISTRAL_KEYS from Vercel..."
vercel env rm MISTRAL_KEYS production --yes 2>/dev/null || echo "Not in production"
vercel env rm MISTRAL_KEYS preview --yes 2>/dev/null || echo "Not in preview"
vercel env rm MISTRAL_KEYS development --yes 2>/dev/null || echo "Not in development"
echo "Removing GOOGLE_AI_KEYS from Vercel..."
vercel env rm GOOGLE_AI_KEYS production --yes 2>/dev/null || echo "Not in production"
vercel env rm GOOGLE_AI_KEYS preview --yes 2>/dev/null || echo "Not in preview"
vercel env rm GOOGLE_AI_KEYS development --yes 2>/dev/null || echo "Not in development"
