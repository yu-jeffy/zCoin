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
  const admin = readKeypair(process.env.GOV_WALLET!);
  const provider = new anchor.AnchorProvider(
    new Connection(RPC, "confirmed"),
    new anchor.Wallet(admin),
    {}
  );
  anchor.setProvider(provider);

  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );

  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);
  const ACTION = (process.env.ADMIN_ACTION ?? "pause").toLowerCase();

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  const paused = ACTION === "pause";

  try {
    const tx = await program.methods.setPause(paused)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        newMint: NEW_MINT,
      })
      .rpc();

    console.log(`Migration ${paused ? "PAUSED" : "UNPAUSED"} successfully!`);
    console.log("Transaction:", tx);
    
    if (paused) {
      console.log("⚠️  Users can no longer redeem tokens until unpaused");
    } else {
      console.log("✅ Users can now redeem tokens again");
    }
  } catch (error) {
    console.error("Failed to update pause status:", error);
    throw error;
  }
})();
