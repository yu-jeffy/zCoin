import "dotenv/config";
import fs from "fs";
import {
  Connection, Keypair, PublicKey, SystemProgram
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID
} from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";
function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const payer = readKeypair(process.env.WALLET!);
  const provider = new anchor.AnchorProvider(
    new Connection(RPC, "confirmed"),
    new anchor.Wallet(payer),
    {}
  );
  anchor.setProvider(provider);

  const PROGRAM_ID = new PublicKey(process.env.ZCOIN_PROGRAM!);
  const program = new anchor.Program(
    await anchor.Program.fetchIdl(PROGRAM_ID, provider) as anchor.Idl,
    PROGRAM_ID,
    provider
  );

  const OLD_MINT = new PublicKey(process.env.OLD_MINT!);
  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);
  const ADMIN = new PublicKey(process.env.GOVERNANCE!);

  // Derive PDAs
  const [mintAuthPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_auth"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), NEW_MINT.toBuffer()],
    PROGRAM_ID
  );

  // Create destination ATAs
  const TREASURY_OWNER = new PublicKey(process.env.TREASURY_OWNER!);
  const LIQ_OWNER = new PublicKey(process.env.LIQUIDITY_OWNER!);
  const CONTR_OWNER = new PublicKey(process.env.CONTRIBUTORS_OWNER!);

  const treasuryAta = await getAssociatedTokenAddress(NEW_MINT, TREASURY_OWNER, true);
  const liquidityAta = await getAssociatedTokenAddress(NEW_MINT, LIQ_OWNER, true);
  const contributorsAta = await getAssociatedTokenAddress(NEW_MINT, CONTR_OWNER, true);

  const ixs = [
    createAssociatedTokenAccountInstruction(payer.publicKey, treasuryAta, TREASURY_OWNER, NEW_MINT),
    createAssociatedTokenAccountInstruction(payer.publicKey, liquidityAta, LIQ_OWNER, NEW_MINT),
    createAssociatedTokenAccountInstruction(payer.publicKey, contributorsAta, CONTR_OWNER, NEW_MINT),
  ];

  // Supply plan example: 100,000,000 NEW @ 9 decimals
  const TOTAL_CAP = BigInt(process.env.TOTAL_CAP!);          // in base units, use string->BigInt
  const MIGRATION_CAP = (TOTAL_CAP * 60n) / 100n;            // 60%
  const TREASURY_AMT = (TOTAL_CAP * 20n) / 100n;             // 20%
  const LIQ_AMT = (TOTAL_CAP * 10n) / 100n;                  // 10%
  const CONTR_AMT = (TOTAL_CAP * 10n) / 100n;                // 10%

  const now = Math.floor(Date.now() / 1000);
  const startTs = now + 3600;              // open in 1 hour
  const endTs = startTs + 180 * 86400;     // 180 days

  await program.methods.initialize({
    admin: ADMIN,
    upgradeAuthority: new PublicKey(process.env.UPGRADE_AUTHORITY!),
    ratioNum: new anchor.BN("1"),          // 10 OLD : 1 NEW
    ratioDen: new anchor.BN("10"),
    totalCap: new anchor.BN(TOTAL_CAP.toString()),
    migrationCap: new anchor.BN(MIGRATION_CAP.toString()),
    treasuryAmount: new anchor.BN(TREASURY_AMT.toString()),
    liquidityAmount: new anchor.BN(LIQ_AMT.toString()),
    contributorsAmount: new anchor.BN(CONTR_AMT.toString()),
    startTs: new anchor.BN(startTs),
    endTs: new anchor.BN(endTs),
  })
  .accounts({
    payer: payer.publicKey,
    admin: ADMIN,
    oldMint: OLD_MINT,
    newMint: NEW_MINT,
    mintAuthority: mintAuthPda,
    config: configPda,
    treasuryAta,
    liquidityAta,
    contributorsAta,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .preInstructions(ixs)
  .rpc();

  console.log("Initialized config:", configPda.toBase58());
})();
