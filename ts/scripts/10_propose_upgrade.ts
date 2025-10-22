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
  const upgradeAuthority = readKeypair(process.env.UPGRADE_AUTHORITY!);
  const provider = new anchor.AnchorProvider(
    new Connection(RPC, "confirmed"),
    new anchor.Wallet(upgradeAuthority),
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
  const TARGET_PROGRAM = new PublicKey(process.env.TARGET_PROGRAM!);
  const TIMELOCK_DAYS = parseInt(process.env.TIMELOCK_DAYS ?? "7", 10);

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    console.log("=== Proposing Program Upgrade ===");
    console.log("Upgrade Authority:", upgradeAuthority.publicKey.toBase58());
    console.log("Target Program:", TARGET_PROGRAM.toBase58());
    console.log("Timelock Days:", TIMELOCK_DAYS);
    console.log("Config PDA:", configPda.toBase58());

    const tx = await program.methods.proposeUpgrade(
      TARGET_PROGRAM,
      TIMELOCK_DAYS
    )
    .accounts({
      config: configPda,
      upgradeAuthority: upgradeAuthority.publicKey,
      newMint: NEW_MINT,
    })
    .rpc();

    console.log("✅ Upgrade proposed successfully!");
    console.log("Transaction:", tx);
    console.log("");
    console.log("Next steps:");
    console.log("1. Wait for timelock to expire");
    console.log("2. Run execute_upgrade.ts to execute the upgrade");
    console.log("3. Or run cancel_upgrade.ts to cancel if needed");

  } catch (error) {
    console.error("❌ Failed to propose upgrade:", error);
    throw error;
  }
})();
