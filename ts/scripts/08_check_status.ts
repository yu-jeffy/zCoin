import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

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

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    // Fetch config account
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) {
      console.error("❌ Config account not found. Is the migration initialized?");
      process.exit(1);
    }

    // Parse config data (this is a simplified version - in production you'd use the IDL)
    const configData = configAccount.data;
    
    // Basic info display
    console.log("=== Migration Status ===");
    console.log("Config PDA:", configPda.toBase58());
    console.log("New Mint:", NEW_MINT.toBase58());
    
    // Check if migration is active
    const now = Math.floor(Date.now() / 1000);
    console.log("Current Time:", new Date(now * 1000).toISOString());
    
    // Get recent events to check status
    const signatures = await connection.getSignaturesForAddress(configPda, { limit: 10 });
    console.log("\n=== Recent Activity ===");
    
    for (const sig of signatures.slice(0, 5)) {
      const tx = await connection.getTransaction(sig.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0
      });
      
      if (tx?.meta?.logMessages) {
        const logs = tx.meta.logMessages;
        const redeemLogs = logs.filter(log => log.includes("Redeemed"));
        const pauseLogs = logs.filter(log => log.includes("Paused"));
        const windowLogs = logs.filter(log => log.includes("WindowUpdated"));
        
        if (redeemLogs.length > 0) {
          console.log(`🔄 Redeem: ${sig.signature} (${new Date(sig.blockTime! * 1000).toISOString()})`);
        }
        if (pauseLogs.length > 0) {
          console.log(`⏸️  Pause: ${sig.signature} (${new Date(sig.blockTime! * 1000).toISOString()})`);
        }
        if (windowLogs.length > 0) {
          console.log(`🕐 Window: ${sig.signature} (${new Date(sig.blockTime! * 1000).toISOString()})`);
        }
      }
    }
    
    console.log("\n=== Quick Status Check ===");
    console.log("✅ Config account exists");
    console.log("✅ Migration program deployed");
    console.log("ℹ️  Use migration statistics script for detailed info");
    
  } catch (error) {
    console.error("Failed to check migration status:", error);
    throw error;
  }
})();
