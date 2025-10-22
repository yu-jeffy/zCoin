import "dotenv/config";
import fs from "fs";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { freezeAccount, thawAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const RPC = process.env.RPC ?? "http://127.0.0.1:8899";
function readKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")))
  );
}

(async () => {
  const admin = readKeypair(process.env.GOV_WALLET!);
  const connection = new Connection(RPC, "confirmed");

  const NEW_MINT = new PublicKey(process.env.NEW_MINT!);
  const TARGET_ATA = new PublicKey(process.env.TARGET_ATA!);
  const ACTION = (process.env.ACTION ?? "freeze").toLowerCase();

  if (ACTION === "freeze") {
    const sig = await freezeAccount(connection, admin, TARGET_ATA, NEW_MINT, admin, [], undefined, TOKEN_PROGRAM_ID);
    console.log("FROZE", TARGET_ATA.toBase58(), "sig", sig);
  } else {
    const sig = await thawAccount(connection, admin, TARGET_ATA, NEW_MINT, admin, [], undefined, TOKEN_PROGRAM_ID);
    console.log("THAWED", TARGET_ATA.toBase58(), "sig", sig);
  }
})();
