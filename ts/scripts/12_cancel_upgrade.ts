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

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  try {
    console.log("=== Cancelling Program Upgrade ===");
    console.log("Upgrade Authority:", upgradeAuthority.publicKey.toBase58());
    console.log("Config PDA:", configPda.toBase58());

    // Check if upgrade is pending
    const configAccount = await program.account.config.fetch(configPda);
    
    if (!configAccount.upgradePending) {
      console.error("❌ No upgrade pending to cancel");
      process.exit(1);
    }

    console.log("✅ Cancelling pending upgrade...");
    console.log("Target Program:", configAccount.upgradeTarget.toBase58());
    console.log("Timelock:", new Date(configAccount.upgradeTimelock * 1000).toISOString());

    const tx = await program.methods.cancelUpgrade()
    .accounts({
      config: configPda,
      upgradeAuthority: upgradeAuthority.publicKey,
      newMint: NEW_MINT,
    })
    .rpc();

    console.log("✅ Upgrade cancelled successfully!");
    console.log("Transaction:", tx);
    console.log("");
    console.log("The upgrade proposal has been cancelled.");

  } catch (error) {
    console.error("❌ Failed to cancel upgrade:", error);
    throw error;
  }
})();
