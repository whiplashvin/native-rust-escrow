// import { AccountLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import {
//   Account,
//   Connection,
//   PublicKey,
//   SystemProgram,
//   SYSVAR_RENT_PUBKEY,
//   Transaction,
//   TransactionInstruction,
// } from "@solana/web3.js";
// import BN from "bn.js";
// import { ESCROW_ACCOUNT_DATA_LAYOUT, EscrowLayout } from "./layout";

// const connection = new Connection("http://localhost:8899", "singleGossip");

// export const initEscrow = async (
//   privateKeyByteArray: string,
//   initializerXTokenAccountPubkeyString: string,
//   amountXTokensToSendToEscrow: number,
//   initializerReceivingTokenAccountPubkeyString: string,
//   expectedAmount: number,
//   escrowProgramIdString: string,
// ) => {
//   console.log(privateKeyByteArray);
//   console.log(initializerXTokenAccountPubkeyString);
//   console.log(amountXTokensToSendToEscrow);
//   console.log(initializerReceivingTokenAccountPubkeyString);
//   console.log(expectedAmount);
//   console.log(escrowProgramIdString);

//   const initializerXTokenAccountPubkey = new PublicKey(
//     initializerXTokenAccountPubkeyString,
//   );

//   //@ts-expect-error
//   //   const XTokenMintAccountPubkey = new PublicKey(
//   //     (
//   //       await connection.getParsedAccountInfo(
//   //         initializerXTokenAccountPubkey,
//   //         "singleGossip",
//   //       )
//   //     ).value!.data.parsed.info.mint,
//   //   );

//   const XTokenMintAccountPubkey = new PublicKey(
//     "9LisugkzYor9ppAfuXHC9t85dqF3sfZo7PhYdnRrc3aQ",
//   );

//   const privateKeyDecoded = privateKeyByteArray
//     .split(",")
//     .map((s) => parseInt(s));
//   const initializerAccount = new Account(privateKeyDecoded);

//   const tempTokenAccount = new Account();
//   const createTempTokenAccountIx = SystemProgram.createAccount({
//     programId: TOKEN_PROGRAM_ID,
//     space: AccountLayout.span,
//     lamports: await connection.getMinimumBalanceForRentExemption(
//       AccountLayout.span,
//       "singleGossip",
//     ),
//     fromPubkey: initializerAccount.publicKey,
//     newAccountPubkey: tempTokenAccount.publicKey,
//   });
//   const initTempAccountIx = Token.createInitAccountInstruction(
//     TOKEN_PROGRAM_ID,
//     XTokenMintAccountPubkey,
//     tempTokenAccount.publicKey,
//     initializerAccount.publicKey,
//   );
//   const transferXTokensToTempAccIx = Token.createTransferInstruction(
//     TOKEN_PROGRAM_ID,
//     initializerXTokenAccountPubkey,
//     tempTokenAccount.publicKey,
//     initializerAccount.publicKey,
//     [],
//     amountXTokensToSendToEscrow,
//   );

//   const escrowAccount = new Account();
//   const escrowProgramId = new PublicKey(escrowProgramIdString);

//   const createEscrowAccountIx = SystemProgram.createAccount({
//     space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
//     lamports: await connection.getMinimumBalanceForRentExemption(
//       ESCROW_ACCOUNT_DATA_LAYOUT.span,
//       "singleGossip",
//     ),
//     fromPubkey: initializerAccount.publicKey,
//     newAccountPubkey: escrowAccount.publicKey,
//     programId: escrowProgramId,
//   });

//   const initEscrowIx = new TransactionInstruction({
//     programId: escrowProgramId,
//     keys: [
//       {
//         pubkey: initializerAccount.publicKey,
//         isSigner: true,
//         isWritable: false,
//       },
//       { pubkey: tempTokenAccount.publicKey, isSigner: false, isWritable: true },
//       {
//         pubkey: new PublicKey(initializerReceivingTokenAccountPubkeyString),
//         isSigner: false,
//         isWritable: false,
//       },
//       { pubkey: escrowAccount.publicKey, isSigner: false, isWritable: true },
//       { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
//       { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
//     ],
//     data: Buffer.from(
//       Uint8Array.of(0, ...new BN(expectedAmount).toArray("le", 8)),
//     ),
//   });

//   const tx = new Transaction().add(
//     createTempTokenAccountIx,
//     initTempAccountIx,
//     transferXTokensToTempAccIx,
//     createEscrowAccountIx,
//     initEscrowIx,
//   );
//   await connection.sendTransaction(
//     tx,
//     [initializerAccount, tempTokenAccount, escrowAccount],
//     { skipPreflight: false, preflightCommitment: "singleGossip" },
//   );

//   await new Promise((resolve) => setTimeout(resolve, 1000));

//   const encodedEscrowState = (await connection.getAccountInfo(
//     escrowAccount.publicKey,
//     "singleGossip",
//   ))!.data;
//   const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
//     encodedEscrowState,
//   ) as EscrowLayout;
//   return {
//     escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
//     isInitialized: !!decodedEscrowState.isInitialized,
//     initializerAccountPubkey: new PublicKey(
//       decodedEscrowState.initializerPubkey,
//     ).toBase58(),
//     XTokenTempAccountPubkey: new PublicKey(
//       decodedEscrowState.initializerTempTokenAccountPubkey,
//     ).toBase58(),
//     initializerYTokenAccount: new PublicKey(
//       decodedEscrowState.initializerReceivingTokenAccountPubkey,
//     ).toBase58(),
//     expectedAmount: new BN(
//       decodedEscrowState.expectedAmount,
//       10,
//       "le",
//     ).toNumber(),
//   };
// };

import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { ESCROW_ACCOUNT_DATA_LAYOUT, EscrowLayout } from "./layout";

const connection = new Connection("http://localhost:8899", "confirmed");

export const initEscrow = async (
  privateKeyByteArray: string,
  initializerXTokenAccountPubkeyString: string,
  amountXTokensToSendToEscrow: number,
  initializerReceivingTokenAccountPubkeyString: string,
  expectedAmount: number,
  escrowProgramIdString: string,
) => {
  const initializerXTokenAccountPubkey = new PublicKey(
    initializerXTokenAccountPubkeyString,
  );

  // Fetch the mint straight off the token account — no fragile parsed-info access
  const xTokenAccount = await getAccount(
    connection,
    initializerXTokenAccountPubkey,
  );
  const XTokenMintAccountPubkey = xTokenAccount.mint;

  // Rebuild Alice's keypair from the raw secret bytes
  const privateKeyDecoded = Uint8Array.from(
    privateKeyByteArray.split(",").map((s) => parseInt(s.trim())),
  );
  const initializerAccount = Keypair.fromSecretKey(privateKeyDecoded);

  // 1) create the temp token account (rent-exempt, owned by token program)
  const tempTokenAccount = Keypair.generate();
  const createTempTokenAccountIx = SystemProgram.createAccount({
    programId: TOKEN_PROGRAM_ID,
    space: AccountLayout.span,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span,
    ),
    fromPubkey: initializerAccount.publicKey,
    newAccountPubkey: tempTokenAccount.publicKey,
  });

  // 2) initialize it as a token account for mint X, owned by Alice (for now)
  const initTempAccountIx = createInitializeAccountInstruction(
    tempTokenAccount.publicKey,
    XTokenMintAccountPubkey,
    initializerAccount.publicKey,
    TOKEN_PROGRAM_ID,
  );

  // 3) move Alice's X tokens into the temp account
  const transferXTokensToTempAccIx = createTransferInstruction(
    initializerXTokenAccountPubkey,
    tempTokenAccount.publicKey,
    initializerAccount.publicKey,
    amountXTokensToSendToEscrow,
    [],
    TOKEN_PROGRAM_ID,
  );

  // 4) create the escrow state account, owned by your program
  const escrowAccount = Keypair.generate();
  const escrowProgramId = new PublicKey(escrowProgramIdString);
  const createEscrowAccountIx = SystemProgram.createAccount({
    space: ESCROW_ACCOUNT_DATA_LAYOUT.span,
    lamports: await connection.getMinimumBalanceForRentExemption(
      ESCROW_ACCOUNT_DATA_LAYOUT.span,
    ),
    fromPubkey: initializerAccount.publicKey,
    newAccountPubkey: escrowAccount.publicKey,
    programId: escrowProgramId,
  });

  // 5) call your program's InitEscrow instruction (tag 0 + expectedAmount u64 LE)
  const initEscrowIx = new TransactionInstruction({
    programId: escrowProgramId,
    keys: [
      {
        pubkey: initializerAccount.publicKey,
        isSigner: true,
        isWritable: false,
      },
      { pubkey: tempTokenAccount.publicKey, isSigner: false, isWritable: true },
      {
        pubkey: new PublicKey(initializerReceivingTokenAccountPubkeyString),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: escrowAccount.publicKey, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(
      Uint8Array.of(0, ...new BN(expectedAmount).toArray("le", 8)),
    ),
  });

  const tx = new Transaction().add(
    createTempTokenAccountIx,
    initTempAccountIx,
    transferXTokensToTempAccIx,
    createEscrowAccountIx,
    initEscrowIx,
  );

  await sendAndConfirmTransaction(connection, tx, [
    initializerAccount,
    tempTokenAccount,
    escrowAccount,
  ]);

  const encodedEscrowState = (await connection.getAccountInfo(
    escrowAccount.publicKey,
    "confirmed",
  ))!.data;
  const decodedEscrowState = ESCROW_ACCOUNT_DATA_LAYOUT.decode(
    encodedEscrowState,
  ) as EscrowLayout;

  return {
    escrowAccountPubkey: escrowAccount.publicKey.toBase58(),
    isInitialized: !!decodedEscrowState.isInitialized,
    initializerAccountPubkey: new PublicKey(
      decodedEscrowState.initializerPubkey,
    ).toBase58(),
    XTokenTempAccountPubkey: new PublicKey(
      decodedEscrowState.initializerTempTokenAccountPubkey,
    ).toBase58(),
    initializerYTokenAccount: new PublicKey(
      decodedEscrowState.initializerReceivingTokenAccountPubkey,
    ).toBase58(),
    expectedAmount: new BN(
      decodedEscrowState.expectedAmount,
      10,
      "le",
    ).toNumber(),
  };
};
