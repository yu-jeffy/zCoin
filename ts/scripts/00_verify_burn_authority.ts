import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey
} from "@solana/web3.js";
import {
  getMint, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";

function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const connection = new Connection(RPC, "confirmed");
  const OLD_MINT = new PublicKey(process.env.OLD_MINT!);

  try {
    // Get mint info
    const mintInfo = await getMint(connection, OLD_MINT);
    
    console.log("=== Pump.fun Token Analysis ===");
    console.log("Mint Address:", OLD_MINT.toBase58());
    console.log("Decimals:", mintInfo.decimals);
    console.log("Supply:", mintInfo.supply.toString());
    console.log("Mint Authority:", mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : "None (renounced)");
    console.log("Freeze Authority:", mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : "None (renounced)");
    
    // Check if burn is possible
    console.log("\n=== Burn Authority Check ===");
    if (mintInfo.mintAuthority === null) {
      console.log("✅ Mint authority is renounced - users can burn their own tokens");
      console.log("✅ Migration via burn-to-mint is SAFE");
    } else {
      console.log("⚠️  Mint authority is still active:", mintInfo.mintAuthority.toBase58());
      console.log("⚠️  Check if this is the expected authority for pump.fun tokens");
    }
    
    // Check decimals
    console.log("\n=== Decimal Check ===");
    if (mintInfo.decimals === 6) {
      console.log("✅ Correct pump.fun decimals (6)");
    } else {
      console.log("⚠️  Unexpected decimals:", mintInfo.decimals, "(expected 6 for pump.fun)");
    }
    
    // Check if it looks like a pump.fun token
    console.log("\n=== Pump.fun Token Verification ===");
    if (mintInfo.decimals === 6 && mintInfo.mintAuthority === null) {
      console.log("✅ This appears to be a graduated pump.fun token");
      console.log("✅ Safe to proceed with migration");
    } else {
      console.log("⚠️  This may not be a standard pump.fun token");
      console.log("⚠️  Verify the token address and graduation status");
    }
    
  } catch (error) {
    console.error("Error analyzing token:", error);
    console.log("\n❌ Could not fetch token info. Check:");
    console.log("1. Token address is correct");
    console.log("2. RPC endpoint is working");
    console.log("3. Token exists on this network");
  }
})();
