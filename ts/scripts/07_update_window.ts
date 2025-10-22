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

  // Parse window parameters
  const START_TS = parseInt(process.env.WINDOW_START_TS ?? "0", 10);
  const END_TS = parseInt(process.env.WINDOW_END_TS ?? "0", 10);

  if (START_TS === 0 || END_TS === 0) {
    console.error("❌ Please set WINDOW_START_TS and WINDOW_END_TS in environment");
    console.log("Example:");
    console.log("WINDOW_START_TS=1734567890  # Unix timestamp");
    console.log("WINDOW_END_TS=1742147890   # Unix timestamp");
    process.exit(1);
  }

  if (START_TS >= END_TS) {
    console.error("❌ WINDOW_START_TS must be before WINDOW_END_TS");
    process.exit(1);
  }

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    const tx = await program.methods.updateWindow(
      new anchor.BN(START_TS),
      new anchor.BN(END_TS)
    )
    .accounts({
      config: configPda,
      admin: admin.publicKey,
      newMint: NEW_MINT,
    })
    .rpc();

    console.log("Migration window updated successfully!");
    console.log("Transaction:", tx);
    console.log(`Start: ${new Date(START_TS * 1000).toISOString()}`);
    console.log(`End: ${new Date(END_TS * 1000).toISOString()}`);
    console.log(`Duration: ${Math.floor((END_TS - START_TS) / 86400)} days`);
  } catch (error) {
    console.error("Failed to update migration window:", error);
    throw error;
  }
})();
