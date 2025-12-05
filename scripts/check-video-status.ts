#!/usr/bin/env tsx
/**
 * Check Video Generation Status
 * 
 * This script checks if there are any stuck video generation requests
 * by examining active HTTP connections and process states.
 */

import { execSync } from "child_process";

console.log("🔍 Checking video generation status...\n");

// Check for active Node.js processes
console.log("📊 Active Node.js processes:");
try {
  const nodeProcesses = execSync("ps aux | grep -E 'node.*3000|next dev' | grep -v grep", {
    encoding: "utf-8",
  });
  if (nodeProcesses.trim()) {
    console.log(nodeProcesses);
  } else {
    console.log("  No Next.js dev server found\n");
  }
} catch (error) {
  console.log("  Could not check processes\n");
}

// Check for active connections to port 3000
console.log("\n🌐 Active connections on port 3000:");
try {
  const connections = execSync("lsof -i :3000 2>/dev/null | grep -E 'ESTABLISHED|LISTEN' || echo 'No active connections'", {
    encoding: "utf-8",
  });
  console.log(connections);
} catch (error) {
  console.log("  Could not check connections\n");
}

// Check for fal.ai API connections
console.log("\n🔗 Active connections to fal.ai (port 443):");
try {
  const falConnections = execSync(
    "lsof -i :443 2>/dev/null | grep -E 'ESTABLISHED.*fal|node' || echo 'No active fal.ai connections found'",
    { encoding: "utf-8" }
  );
  console.log(falConnections);
} catch (error) {
  console.log("  Could not check fal.ai connections\n");
}

// Check API endpoint health
console.log("\n🏥 API Health Check:");
try {
  const healthCheck = execSync(
    "curl -s http://localhost:3000/api/video/assemble 2>&1 | head -5",
    { encoding: "utf-8", timeout: 5000 }
  );
  console.log("  Video assembly endpoint:", healthCheck.trim() ? "✅ Available" : "❌ Not responding");
} catch (error) {
  console.log("  Video assembly endpoint: ❌ Not responding");
}

console.log("\n💡 Tips:");
console.log("  - If video generation appears stuck, check the browser console for error messages");
console.log("  - Video generation can take 2-10 minutes per clip depending on settings");
console.log("  - Check the Next.js dev server logs for detailed progress");
console.log("  - If truly stuck, restart the dev server: npm run dev");

