import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getMint, getAccount, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const connection = new Connection(RPC, "confirmed");
  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);
  const OLD_MINT = new PublicKey(process.env.OLD_MINT!);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    console.log("=== Migration Statistics ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("");

    // Get mint info
    const newMintInfo = await getMint(connection, NEW_MINT);
    const oldMintInfo = await getMint(connection, OLD_MINT);

    console.log("=== Token Information ===");
    console.log("Old Mint (Pump.fun):", OLD_MINT.toBase58());
    console.log("  Supply:", oldMintInfo.supply.toString());
    console.log("  Decimals:", oldMintInfo.decimals);
    console.log("");
    console.log("New Mint (zCoin):", NEW_MINT.toBase58());
    console.log("  Supply:", newMintInfo.supply.toString());
    console.log("  Decimals:", newMintInfo.decimals);
    console.log("");

    // Get config account
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) {
      console.error("❌ Config account not found. Is the migration initialized?");
      process.exit(1);
    }

    console.log("=== Migration Configuration ===");
    console.log("Config PDA:", configPda.toBase58());
    console.log("Program ID:", PROGRAM_ID.toBase58());
    console.log("");

    // Get recent redeem events
    console.log("=== Recent Migration Activity ===");
    const signatures = await connection.getSignaturesForAddress(configPda, { limit: 50 });
    
    let redeemCount = 0;
    let totalOldBurned = BigInt(0);
    let totalNewMinted = BigInt(0);
    const redeemers = new Set<string>();

    for (const sig of signatures) {
      try {
        const tx = await connection.getTransaction(sig.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0
        });
        
        if (tx?.meta?.logMessages) {
          const logs = tx.meta.logMessages;
          const redeemLog = logs.find(log => log.includes("Redeemed"));
          
          if (redeemLog) {
            redeemCount++;
            
            // Extract user from logs (simplified parsing)
            const userMatch = redeemLog.match(/user: ([A-Za-z0-9]{32,44})/);
            if (userMatch) {
              redeemers.add(userMatch[1]);
            }
            
            // Extract amounts from logs (simplified parsing)
            const burnedMatch = redeemLog.match(/burned_old: (\d+)/);
            const mintedMatch = redeemLog.match(/minted_new: (\d+)/);
            
            if (burnedMatch) {
              totalOldBurned += BigInt(burnedMatch[1]);
            }
            if (mintedMatch) {
              totalNewMinted += BigInt(mintedMatch[1]);
            }
          }
        }
      } catch (error) {
        // Skip failed transaction parsing
        continue;
      }
    }

    console.log(`Total Redeems: ${redeemCount}`);
    console.log(`Unique Redeemers: ${redeemers.size}`);
    console.log(`Total Old Burned: ${totalOldBurned.toString()}`);
    console.log(`Total New Minted: ${totalNewMinted.toString()}`);
    console.log("");

    // Calculate migration progress
    if (totalOldBurned > 0n) {
      const migrationRatio = Number(totalNewMinted) / Number(totalOldBurned);
      console.log("=== Migration Progress ===");
      console.log(`Effective Ratio: ${migrationRatio.toFixed(6)} (${totalNewMinted}/${totalOldBurned})`);
      console.log(`Expected Ratio: 0.1 (10:1)`);
      console.log("");
    }

    // Check fixed allocation ATAs if they exist
    console.log("=== Fixed Allocations ===");
    const TREASURY_OWNER = process.env.TREASURY_OWNER;
    const LIQ_OWNER = process.env.LIQUIDITY_OWNER;
    const CONTR_OWNER = process.env.CONTRIBUTORS_OWNER;

    if (TREASURY_OWNER) {
      try {
        const treasuryAta = await anchor.utils.token.getAssociatedTokenAddress(
          NEW_MINT, new PublicKey(TREASURY_OWNER), true
        );
        const treasuryAccount = await getAccount(connection, treasuryAta);
        console.log(`Treasury: ${treasuryAccount.amount.toString()} tokens`);
      } catch (error) {
        console.log("Treasury: Not found or not initialized");
      }
    }

    if (LIQ_OWNER) {
      try {
        const liquidityAta = await anchor.utils.token.getAssociatedTokenAddress(
          NEW_MINT, new PublicKey(LIQ_OWNER), true
        );
        const liquidityAccount = await getAccount(connection, liquidityAta);
        console.log(`Liquidity: ${liquidityAccount.amount.toString()} tokens`);
      } catch (error) {
        console.log("Liquidity: Not found or not initialized");
      }
    }

    if (CONTR_OWNER) {
      try {
        const contributorsAta = await anchor.utils.token.getAssociatedTokenAddress(
          NEW_MINT, new PublicKey(CONTR_OWNER), true
        );
        const contributorsAccount = await getAccount(connection, contributorsAta);
        console.log(`Contributors: ${contributorsAccount.amount.toString()} tokens`);
      } catch (error) {
        console.log("Contributors: Not found or not initialized");
      }
    }

    console.log("");
    console.log("=== Summary ===");
    console.log(`Migration is ${redeemCount > 0 ? "ACTIVE" : "INACTIVE"}`);
    console.log(`${redeemers.size} unique users have migrated`);
    console.log(`${redeemCount} total redemption transactions`);

  } catch (error) {
    console.error("Failed to get migration statistics:", error);
    throw error;
  }
})();
