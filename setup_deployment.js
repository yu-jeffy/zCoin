#!/usr/bin/env node

import "dotenv/config";
import { execSync } from "child_process";
import fs from "fs";

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log("🔍 Checking prerequisites...", colors.yellow);
  
  // Check if Node.js is installed
  try {
    const nodeVersion = execSync("node --version", { encoding: "utf8" }).trim();
    log(`✅ Node.js: ${nodeVersion}`, colors.green);
  } catch (error) {
    log("❌ Node.js not found. Please install Node.js 18+", colors.red);
    process.exit(1);
  }
  
  // Check if Solana CLI is installed
  try {
    const solanaVersion = execSync("solana --version", { encoding: "utf8" }).trim();
    log(`✅ Solana CLI: ${solanaVersion}`, colors.green);
  } catch (error) {
    log("❌ Solana CLI not found. Please install Solana CLI", colors.red);
    process.exit(1);
  }
  
  // Check if Anchor CLI is installed
  try {
    const anchorVersion = execSync("anchor --version", { encoding: "utf8" }).trim();
    log(`✅ Anchor CLI: ${anchorVersion}`, colors.green);
  } catch (error) {
    log("❌ Anchor CLI not found. Please install Anchor CLI", colors.red);
    process.exit(1);
  }
  
  // Check if dependencies are installed
  if (!fs.existsSync("ts/node_modules")) {
    log("📦 Installing dependencies...", colors.yellow);
    try {
      execSync("cd ts && npm install", { stdio: "inherit" });
      log("✅ Dependencies installed", colors.green);
    } catch (error) {
      log("❌ Failed to install dependencies", colors.red);
      process.exit(1);
    }
  } else {
    log("✅ Dependencies already installed", colors.green);
  }
}

function checkEnvironment() {
  log("🔍 Checking environment...", colors.yellow);
  
  // Check if .env file exists
  if (!fs.existsSync(".env")) {
    if (fs.existsSync("env.example")) {
      log("📄 Creating .env from env.example...", colors.yellow);
      fs.copyFileSync("env.example", ".env");
      log("✅ .env file created. Please edit it with your values.", colors.green);
    } else {
      log("❌ No .env file found. Please create one.", colors.red);
      process.exit(1);
    }
  } else {
    log("✅ .env file found", colors.green);
  }
  
  // Check if testnet.env exists
  if (!fs.existsSync("testnet.env")) {
    if (fs.existsSync("testnet.env.example")) {
      log("📄 Creating testnet.env from testnet.env.example...", colors.yellow);
      fs.copyFileSync("testnet.env.example", "testnet.env");
      log("✅ testnet.env file created. Please edit it with your values.", colors.green);
    }
  } else {
    log("✅ testnet.env file found", colors.green);
  }
  
  // Check if mainnet.env exists
  if (!fs.existsSync("mainnet.env")) {
    if (fs.existsSync("mainnet.env.example")) {
      log("📄 Creating mainnet.env from mainnet.env.example...", colors.yellow);
      fs.copyFileSync("mainnet.env.example", "mainnet.env");
      log("✅ mainnet.env file created. Please edit it with your values.", colors.green);
    }
  } else {
    log("✅ mainnet.env file found", colors.green);
  }
}

function showMenu() {
  log("\n" + "=" * 50, colors.cyan);
  log("🚀 zCoin Deployment Menu", colors.bright);
  log("=" * 50, colors.cyan);
  log("1. Deploy to Testnet", colors.blue);
  log("2. Deploy to Mainnet", colors.red);
  log("3. Validate Deployment", colors.yellow);
  log("4. Check Prerequisites", colors.green);
  log("5. Exit", colors.magenta);
  log("=" * 50, colors.cyan);
}

async function main() {
  try {
    log("🚀 zCoin Deployment Setup", colors.bright);
    log("=" * 50, colors.cyan);
    
    // Check prerequisites
    checkPrerequisites();
    
    // Check environment
    checkEnvironment();
    
    // Show menu
    showMenu();
    
    log("\n✅ Setup complete! You can now run deployment scripts:", colors.green);
    log("  npm run deploy:testnet:safe", colors.blue);
    log("  npm run deploy:mainnet:safe", colors.red);
    log("  npm run validate", colors.yellow);
    
    log("\n📚 For detailed instructions, see:", colors.cyan);
    log("  - DEPLOYMENT_GUIDE.md", colors.blue);
    log("  - DEPLOYMENT_SAFETY.md", colors.red);
    log("  - UPGRADE_SYSTEM.md", colors.green);
    
  } catch (error) {
    log(`❌ Setup failed: ${error}`, colors.red);
    process.exit(1);
  }
}

main();
