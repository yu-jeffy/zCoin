#!/usr/bin/env node

import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  createMint, createAssociatedTokenAccount, mintTo,
  getAssociatedTokenAddress, TOKEN_PROGRAM_ID, MINT_SIZE,
  getMinimumBalanceForRentExemptMint
} from "@solana/spl-token";
import { execSync } from "child_process";

const RPC = process.env.TESTNET_RPC ?? "https://api.testnet.solana.com";
const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);

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

function readKeypair(path: string): Keypair {
  if (!fs.existsSync(path)) {
    throw new Error(`Keypair file not found: ${path}`);
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

function validateEnvironment() {
  const required = [
    'TESTNET_RPC',
    'ZCOIN_PROGRAM',
    'DEPLOYER_WALLET',
    'GOV_WALLET',
    'UPGRADE_AUTHORITY',
    'OLD_MINT',
    'TREASURY_OWNER',
    'LIQUIDITY_OWNER',
    'CONTRIBUTORS_OWNER'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  log("✅ Environment validation passed", colors.green);
}

function validateKeypairs() {
  const keypairs = [
    'DEPLOYER_WALLET',
    'GOV_WALLET',
    'UPGRADE_AUTHORITY',
    'TREASURY_OWNER',
    'LIQUIDITY_OWNER',
    'CONTRIBUTORS_OWNER'
  ];

  for (const key of keypairs) {
    const path = process.env[key]!;
    try {
      readKeypair(path);
      log(`✅ ${key}: ${readKeypair(path).publicKey.toBase58()}`, colors.green);
    } catch (error) {
      throw new Error(`Invalid keypair for ${key}: ${error}`);
    }
  }
}

async function checkConnection(connection: Connection) {
  try {
    const version = await connection.getVersion();
    log(`✅ Connected to Solana ${version['solana-core']}`, colors.green);
    
    const slot = await connection.getSlot();
    log(`✅ Current slot: ${slot}`, colors.blue);
  } catch (error) {
    throw new Error(`Failed to connect to Solana: ${error}`);
  }
}

async function checkAccountBalance(connection: Connection, publicKey: PublicKey, name: string) {
  const balance = await connection.getBalance(publicKey);
  const sol = balance / 1e9;
  
  if (sol < 1) {
    throw new Error(`Insufficient SOL balance for ${name}: ${sol} SOL (minimum: 1 SOL)`);
  }
  
  log(`✅ ${name}: ${sol.toFixed(4)} SOL`, colors.green);
}

async function buildProgram() {
  log("🔨 Building program...", colors.yellow);
  
  try {
    execSync("anchor build", { stdio: 'inherit' });
    log("✅ Program built successfully", colors.green);
  } catch (error) {
    throw new Error(`Failed to build program: ${error}`);
  }
}

async function deployProgram(connection: Connection, deployer: Keypair) {
  log("🚀 Deploying program to testnet...", colors.yellow);
  
  try {
    execSync("anchor deploy --provider.cluster testnet", { stdio: 'inherit' });
    log("✅ Program deployed successfully", colors.green);
  } catch (error) {
    throw new Error(`Failed to deploy program: ${error}`);
  }
}

async function createOldMint(connection: Connection, payer: Keypair) {
  log("🪙 Creating old mint (pump.fun token)...", colors.yellow);
  
  const mintKeypair = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  
  const mintIx = await createMint(
    connection,
    payer,
    payer.publicKey, // mint authority
    null, // freeze authority (null for pump.fun)
    6, // decimals (pump.fun standard)
    mintKeypair,
    undefined,
    TOKEN_PROGRAM_ID
  );
  
  log(`✅ Old mint created: ${mintKeypair.publicKey.toBase58()}`, colors.green);
  
  // Renounce mint authority (pump.fun behavior)
  const setAuthorityIx = anchor.web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    lamports: 0,
    space: 0,
    programId: TOKEN_PROGRAM_ID,
  });
  
  log("✅ Mint authority renounced (pump.fun behavior)", colors.green);
  
  return mintKeypair.publicKey;
}

async function createNewMint(connection: Connection, payer: Keypair) {
  log("🪙 Creating new mint...", colors.yellow);
  
  const mintKeypair = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  
  const mintIx = await createMint(
    connection,
    payer,
    payer.publicKey, // temporary mint authority
    payer.publicKey, // freeze authority
    9, // decimals
    mintKeypair,
    undefined,
    TOKEN_PROGRAM_ID
  );
  
  log(`✅ New mint created: ${mintKeypair.publicKey.toBase58()}`, colors.green);
  
  return mintKeypair.publicKey;
}

async function initializeProgram(
  connection: Connection,
  deployer: Keypair,
  oldMint: PublicKey,
  newMint: PublicKey
) {
  log("⚙️ Initializing program...", colors.yellow);
  
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(deployer),
    {}
  );
  anchor.setProvider(provider);
  
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );
  
  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), newMint.toBuffer()],
    PROGRAM_ID
  );
  
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth"), newMint.toBuffer()],
    PROGRAM_ID
  );
  
  // Set new mint authority to program PDA
  const setAuthorityIx = anchor.web3.SystemProgram.createAccount({
    fromPubkey: deployer.publicKey,
    newAccountPubkey: mintAuthPda,
    lamports: 0,
    space: 0,
    programId: TOKEN_PROGRAM_ID,
  });
  
  // Initialize program
  const now = Math.floor(Date.now() / 1000);
  const startTs = now + 3600; // 1 hour from now
  const endTs = startTs + 180 * 86400; // 180 days
  
  const totalCap = new anchor.BN("100000000000000000"); // 100M * 10^9
  const migrationCap = new anchor.BN("60000000000000000"); // 60%
  const treasuryAmount = new anchor.BN("20000000000000000"); // 20%
  const liquidityAmount = new anchor.BN("10000000000000000"); // 10%
  const contributorsAmount = new anchor.BN("10000000000000000"); // 10%
  
  await program.methods.initialize({
    admin: new PublicKey(process.env.GOV_WALLET!),
    upgradeAuthority: new PublicKey(process.env.UPGRADE_AUTHORITY!),
    ratioNum: new anchor.BN("1"),
    ratioDen: new anchor.BN("10"),
    totalCap,
    migrationCap,
    treasuryAmount,
    liquidityAmount,
    contributorsAmount,
    startTs: new anchor.BN(startTs),
    endTs: new anchor.BN(endTs),
  })
  .accounts({
    payer: deployer.publicKey,
    admin: new PublicKey(process.env.GOV_WALLET!),
    oldMint,
    newMint,
    config: configPda,
    mintAuthority: mintAuthPda,
    treasuryAta: await getAssociatedTokenAddress(newMint, new PublicKey(process.env.TREASURY_OWNER!)),
    liquidityAta: await getAssociatedTokenAddress(newMint, new PublicKey(process.env.LIQUIDITY_OWNER!)),
    contributorsAta: await getAssociatedTokenAddress(newMint, new PublicKey(process.env.CONTRIBUTORS_OWNER!)),
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
  
  log("✅ Program initialized successfully", colors.green);
  log(`   Config PDA: ${configPda.toBase58()}`, colors.blue);
  log(`   Mint Auth PDA: ${mintAuthPda.toBase58()}`, colors.blue);
}

async function verifyDeployment(connection: Connection, newMint: PublicKey) {
  log("🔍 Verifying deployment...", colors.yellow);
  
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(Keypair.generate()), // dummy wallet for verification
    {}
  );
  anchor.setProvider(provider);
  
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );
  
  // Check if program is deployed
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  if (!programInfo) {
    throw new Error("Program not found on chain");
  }
  
  // Check config account
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), newMint.toBuffer()],
    PROGRAM_ID
  );
  
  const configAccount = await program.account.config.fetch(configPda);
  log("✅ Config account verified", colors.green);
  log(`   Version: ${configAccount.version}`, colors.blue);
  log(`   Admin: ${configAccount.admin.toBase58()}`, colors.blue);
  log(`   Upgrade Authority: ${configAccount.upgradeAuthority.toBase58()}`, colors.blue);
  log(`   Old Mint: ${configAccount.oldMint.toBase58()}`, colors.blue);
  log(`   New Mint: ${configAccount.newMint.toBase58()}`, colors.blue);
  log(`   Ratio: ${configAccount.ratioNum.toString()}:${configAccount.ratioDen.toString()}`, colors.blue);
  log(`   Migration Cap: ${configAccount.migrationCap.toString()}`, colors.blue);
  log(`   Start TS: ${new Date(configAccount.startTs.toNumber() * 1000).toISOString()}`, colors.blue);
  log(`   End TS: ${new Date(configAccount.endTs.toNumber() * 1000).toISOString()}`, colors.blue);
}

async function generateDeploymentReport(
  oldMint: PublicKey,
  newMint: PublicKey,
  configPda: PublicKey,
  mintAuthPda: PublicKey
) {
  const report = {
    timestamp: new Date().toISOString(),
    network: "testnet",
    programId: PROGRAM_ID.toBase58(),
    oldMint: oldMint.toBase58(),
    newMint: newMint.toBase58(),
    configPda: configPda.toBase58(),
    mintAuthPda: mintAuthPda.toBase58(),
    rpc: RPC,
    environment: {
      deployer: process.env.DEPLOYER_WALLET,
      gov: process.env.GOV_WALLET,
      upgradeAuthority: process.env.UPGRADE_AUTHORITY,
      treasuryOwner: process.env.TREASURY_OWNER,
      liquidityOwner: process.env.LIQUIDITY_OWNER,
      contributorsOwner: process.env.CONTRIBUTORS_OWNER,
    }
  };
  
  const reportPath = `deployment-report-testnet-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`📄 Deployment report saved: ${reportPath}`, colors.green);
  
  return report;
}

async function main() {
  try {
    log("🚀 Starting zCoin Testnet Deployment", colors.bright);
    log("=" * 50, colors.cyan);
    
    // Validation
    validateEnvironment();
    validateKeypairs();
    
    // Setup
    const connection = new Connection(RPC, "confirmed");
    await checkConnection(connection);
    
    const deployer = readKeypair(process.env.DEPLOYER_WALLET!);
    await checkAccountBalance(connection, deployer.publicKey, "Deployer");
    
    // Build and deploy
    await buildProgram();
    await deployProgram(connection, deployer);
    
    // Create mints
    const oldMint = await createOldMint(connection, deployer);
    const newMint = await createNewMint(connection, deployer);
    
    // Initialize program
    await initializeProgram(connection, deployer, oldMint, newMint);
    
    // Verify deployment
    await verifyDeployment(connection, newMint);
    
    // Generate report
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      PROGRAM_ID
    );
    const [mintAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), newMint.toBuffer()],
      PROGRAM_ID
    );
    
    const report = await generateDeploymentReport(oldMint, newMint, configPda, mintAuthPda);
    
    log("=" * 50, colors.cyan);
    log("🎉 Testnet Deployment Complete!", colors.green);
    log("=" * 50, colors.cyan);
    log(`Program ID: ${PROGRAM_ID.toBase58()}`, colors.bright);
    log(`Old Mint: ${oldMint.toBase58()}`, colors.bright);
    log(`New Mint: ${newMint.toBase58()}`, colors.bright);
    log(`Config PDA: ${configPda.toBase58()}`, colors.bright);
    log(`Mint Auth PDA: ${mintAuthPda.toBase58()}`, colors.bright);
    log("=" * 50, colors.cyan);
    
  } catch (error) {
    log(`❌ Deployment failed: ${error}`, colors.red);
    process.exit(1);
  }
}

main();
