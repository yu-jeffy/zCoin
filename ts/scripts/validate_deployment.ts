#!/usr/bin/env node

import "dotenv/config";
import fs from "fs";
import {
  Connection, PublicKey
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getMint, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";
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

async function validateProgram(connection: Connection) {
  log("🔍 Validating program deployment...", colors.yellow);
  
  try {
    const programInfo = await connection.getAccountInfo(PROGRAM_ID);
    if (!programInfo) {
      throw new Error("Program not found on chain");
    }
    
    log(`✅ Program found at: ${PROGRAM_ID.toBase58()}`, colors.green);
    log(`   Owner: ${programInfo.owner.toBase58()}`, colors.blue);
    log(`   Executable: ${programInfo.executable}`, colors.blue);
    log(`   Data Length: ${programInfo.data.length} bytes`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Program validation failed: ${error}`, colors.red);
    return false;
  }
}

async function validateConfig(connection: Connection, newMint: PublicKey) {
  log("🔍 Validating config account...", colors.yellow);
  
  try {
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(Keypair.generate()), // dummy wallet
      {}
    );
    anchor.setProvider(provider);
    
    const program = new anchor.Program(
      await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
      PROGRAM_ID,
      provider
    );
    
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      PROGRAM_ID
    );
    
    const configAccount = await program.account.config.fetch(configPda);
    
    log(`✅ Config account found: ${configPda.toBase58()}`, colors.green);
    log(`   Version: ${configAccount.version}`, colors.blue);
    log(`   Admin: ${configAccount.admin.toBase58()}`, colors.blue);
    log(`   Upgrade Authority: ${configAccount.upgradeAuthority.toBase58()}`, colors.blue);
    log(`   Old Mint: ${configAccount.oldMint.toBase58()}`, colors.blue);
    log(`   New Mint: ${configAccount.newMint.toBase58()}`, colors.blue);
    log(`   Ratio: ${configAccount.ratioNum.toString()}:${configAccount.ratioDen.toString()}`, colors.blue);
    log(`   Migration Cap: ${configAccount.migrationCap.toString()}`, colors.blue);
    log(`   Paused: ${configAccount.paused}`, colors.blue);
    log(`   Finalized: ${configAccount.finalized}`, colors.blue);
    log(`   Start TS: ${new Date(configAccount.startTs.toNumber() * 1000).toISOString()}`, colors.blue);
    log(`   End TS: ${new Date(configAccount.endTs.toNumber() * 1000).toISOString()}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Config validation failed: ${error}`, colors.red);
    return false;
  }
}

async function validateMints(connection: Connection, oldMint: PublicKey, newMint: PublicKey) {
  log("🔍 Validating mints...", colors.yellow);
  
  try {
    // Validate old mint
    const oldMintInfo = await getMint(connection, oldMint, "confirmed", TOKEN_PROGRAM_ID);
    log(`✅ Old mint validated: ${oldMint.toBase58()}`, colors.green);
    log(`   Decimals: ${oldMintInfo.decimals}`, colors.blue);
    log(`   Supply: ${oldMintInfo.supply.toString()}`, colors.blue);
    log(`   Mint Authority: ${oldMintInfo.mintAuthority?.toBase58() ?? "None"}`, colors.blue);
    log(`   Freeze Authority: ${oldMintInfo.freezeAuthority?.toBase58() ?? "None"}`, colors.blue);
    
    // Validate new mint
    const newMintInfo = await getMint(connection, newMint, "confirmed", TOKEN_PROGRAM_ID);
    log(`✅ New mint validated: ${newMint.toBase58()}`, colors.green);
    log(`   Decimals: ${newMintInfo.decimals}`, colors.blue);
    log(`   Supply: ${newMintInfo.supply.toString()}`, colors.blue);
    log(`   Mint Authority: ${newMintInfo.mintAuthority?.toBase58() ?? "None"}`, colors.blue);
    log(`   Freeze Authority: ${newMintInfo.freezeAuthority?.toBase58() ?? "None"}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Mint validation failed: ${error}`, colors.red);
    return false;
  }
}

async function validatePDAs(connection: Connection, newMint: PublicKey) {
  log("🔍 Validating PDAs...", colors.yellow);
  
  try {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      PROGRAM_ID
    );
    
    const [mintAuthPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_auth"), newMint.toBuffer()],
      PROGRAM_ID
    );
    
    // Check config PDA
    const configInfo = await connection.getAccountInfo(configPda);
    if (!configInfo) {
      throw new Error("Config PDA not found");
    }
    log(`✅ Config PDA: ${configPda.toBase58()}`, colors.green);
    
    // Check mint auth PDA
    const mintAuthInfo = await connection.getAccountInfo(mintAuthPda);
    if (!mintAuthInfo) {
      throw new Error("Mint Auth PDA not found");
    }
    log(`✅ Mint Auth PDA: ${mintAuthPda.toBase58()}`, colors.green);
    
    return true;
  } catch (error) {
    log(`❌ PDA validation failed: ${error}`, colors.red);
    return false;
  }
}

async function validateTokenAccounts(connection: Connection, newMint: PublicKey) {
  log("🔍 Validating token accounts...", colors.yellow);
  
  try {
    const treasuryOwner = new PublicKey(process.env.TREASURY_OWNER!);
    const liquidityOwner = new PublicKey(process.env.LIQUIDITY_OWNER!);
    const contributorsOwner = new PublicKey(process.env.CONTRIBUTORS_OWNER!);
    
    const treasuryAta = await getAssociatedTokenAddress(newMint, treasuryOwner);
    const liquidityAta = await getAssociatedTokenAddress(newMint, liquidityOwner);
    const contributorsAta = await getAssociatedTokenAddress(newMint, contributorsOwner);
    
    // Check treasury ATA
    const treasuryInfo = await connection.getAccountInfo(treasuryAta);
    if (!treasuryInfo) {
      throw new Error("Treasury ATA not found");
    }
    log(`✅ Treasury ATA: ${treasuryAta.toBase58()}`, colors.green);
    
    // Check liquidity ATA
    const liquidityInfo = await connection.getAccountInfo(liquidityAta);
    if (!liquidityInfo) {
      throw new Error("Liquidity ATA not found");
    }
    log(`✅ Liquidity ATA: ${liquidityAta.toBase58()}`, colors.green);
    
    // Check contributors ATA
    const contributorsInfo = await connection.getAccountInfo(contributorsAta);
    if (!contributorsInfo) {
      throw new Error("Contributors ATA not found");
    }
    log(`✅ Contributors ATA: ${contributorsAta.toBase58()}`, colors.green);
    
    return true;
  } catch (error) {
    log(`❌ Token account validation failed: ${error}`, colors.red);
    return false;
  }
}

async function validateUpgradeSystem(connection: Connection, newMint: PublicKey) {
  log("🔍 Validating upgrade system...", colors.yellow);
  
  try {
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(Keypair.generate()), // dummy wallet
      {}
    );
    anchor.setProvider(provider);
    
    const program = new anchor.Program(
      await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
      PROGRAM_ID,
      provider
    );
    
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), newMint.toBuffer()],
      PROGRAM_ID
    );
    
    const configAccount = await program.account.config.fetch(configPda);
    
    // Check upgrade authority
    if (configAccount.upgradeAuthority.toBase58() === PublicKey.default.toBase58()) {
      throw new Error("Upgrade authority not set");
    }
    log(`✅ Upgrade Authority: ${configAccount.upgradeAuthority.toBase58()}`, colors.green);
    
    // Check upgrade flags
    log(`   Upgrade Pending: ${configAccount.upgradePending}`, colors.blue);
    log(`   Upgrade Target: ${configAccount.upgradeTarget.toBase58()}`, colors.blue);
    log(`   Upgrade Timelock: ${configAccount.upgradeTimelock}`, colors.blue);
    
    return true;
  } catch (error) {
    log(`❌ Upgrade system validation failed: ${error}`, colors.red);
    return false;
  }
}

async function generateValidationReport(results: any) {
  const report = {
    timestamp: new Date().toISOString(),
    programId: PROGRAM_ID.toBase58(),
    rpc: RPC,
    validation: results,
    overall: Object.values(results).every((result: any) => result === true)
  };
  
  const reportPath = `validation-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  log(`📄 Validation report saved: ${reportPath}`, colors.green);
  
  return report;
}

async function main() {
  try {
    log("🔍 Starting zCoin Deployment Validation", colors.bright);
    log("=" * 50, colors.cyan);
    
    const connection = new Connection(RPC, "confirmed");
    const oldMint = new PublicKey(process.env.OLD_MINT!);
    const newMint = new PublicKey(process.env.NEW_MINT!);
    
    const results = {
      program: await validateProgram(connection),
      config: await validateConfig(connection, newMint),
      mints: await validateMints(connection, oldMint, newMint),
      pdas: await validatePDAs(connection, newMint),
      tokenAccounts: await validateTokenAccounts(connection, newMint),
      upgradeSystem: await validateUpgradeSystem(connection, newMint)
    };
    
    const allPassed = Object.values(results).every(result => result === true);
    
    log("=" * 50, colors.cyan);
    if (allPassed) {
      log("🎉 All validations passed!", colors.green);
    } else {
      log("❌ Some validations failed!", colors.red);
    }
    log("=" * 50, colors.cyan);
    
    // Generate report
    await generateValidationReport(results);
    
  } catch (error) {
    log(`❌ Validation failed: ${error}`, colors.red);
    process.exit(1);
  }
}

main();
