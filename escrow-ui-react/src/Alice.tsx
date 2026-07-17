import { useState } from "react";
import { initEscrow } from "./util/initEscrow";

interface EscrowState {
  escrowAccountPubkey: null | string;
  isInitialized: null | boolean;
  initializerAccountPubkey: null | string;
  XTokenTempAccountPubkey: null | string;
  initializerYTokenAccount: null | string;
  expectedAmount: null | number;
}

const initialFormState = {
  privateKey: "",
  programId: "",
  aliceXTokenAccountPubkey: "",
  aliceYTokenAccountPubkey: "",
  amountXTokensToSendToEscrow: 0,
  amountYTokensAliceExpects: 0
};

const initialEscrowState: EscrowState = {
  escrowAccountPubkey: null,
  isInitialized: null,
  initializerAccountPubkey: null,
  XTokenTempAccountPubkey: null,
  initializerYTokenAccount: null,
  expectedAmount: null
};

export default function Alice() {
  const [formState, setFormState] = useState(initialFormState);
  const [escrowState, setEscrowState] = useState(initialEscrowState);

  const setField = (field: keyof typeof initialFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState(prev => ({
        ...prev,
        [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value
      }));

  const resetAliceUI = () => {
    setFormState(initialFormState);
    setEscrowState(initialEscrowState);
  };

  const onInitEscrow = async () => {
    try {
      const {
        escrowAccountPubkey,
        isInitialized,
        initializerAccountPubkey,
        XTokenTempAccountPubkey,
        initializerYTokenAccount,
        expectedAmount
      } = await initEscrow(
        formState.privateKey,
        formState.aliceXTokenAccountPubkey,
        formState.amountXTokensToSendToEscrow,
        formState.aliceYTokenAccountPubkey,
        formState.amountYTokensAliceExpects,
        formState.programId
      );
      setEscrowState({
        escrowAccountPubkey,
        isInitialized,
        initializerAccountPubkey,
        XTokenTempAccountPubkey,
        initializerYTokenAccount,
        expectedAmount
      });
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("A message-less error occurred");
      }
    }
  };

  return (
    <div className="bg">
      <p className="title">Escrow UI</p>
      <div>
        <div className="mb-1">
          <label htmlFor="2020-12-24-programId-escrow-alice">Throwaway private key (as byte array from sollet.io, without the '[]')</label>
          <input className="display-block" type="text" value={formState.privateKey} onChange={setField("privateKey")} />
        </div>
        <div className="mb-1">
          <label htmlFor="2020-12-24-programId-escrow-alice">Program id</label>
          <input className="display-block" type="text" id="2020-12-24-programId-escrow-alice" value={formState.programId} onChange={setField("programId")} />
        </div>
        <div className="mb-1">
          <label>Alice's X token account pubkey</label>
          <input className="display-block" type="text" value={formState.aliceXTokenAccountPubkey} onChange={setField("aliceXTokenAccountPubkey")} />
        </div>
        <div className="mb-1">
          <label>Amount of X tokens to send to escrow</label>
          <input className="display-block" type="number" value={formState.amountXTokensToSendToEscrow} onChange={setField("amountXTokensToSendToEscrow")} />
        </div>
        <div className="mb-1">
          <label>Alice's Y token account pubkey</label>
          <input className="display-block" type="text" value={formState.aliceYTokenAccountPubkey} onChange={setField("aliceYTokenAccountPubkey")} />
        </div>
        <div className="mb-1">
          <label>Amount of Y tokens Alice wants</label>
          <input className="display-block" type="number" value={formState.amountYTokensAliceExpects} onChange={setField("amountYTokensAliceExpects")} />
        </div>
        <div className="mb-1">
          <input style={{ marginRight: "5px" }} className="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Reset UI" onClick={resetAliceUI} />
          <input className="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Init escrow" onClick={onInitEscrow} />
        </div>
      </div>
      <div>
        <div className="mb-1">
          Escrow account:
          <div>{escrowState.escrowAccountPubkey ?? "--"}</div>
        </div>
        <div className="mb-1">
          Decoded State
        </div>
        <div className="mb-1">
          Is initialized:
          <div>{escrowState.isInitialized?.toString() ?? "--"}</div>
        </div>
        <div className="mb-1">
          Initializer account:
          <div>{escrowState.initializerAccountPubkey ?? "--"}</div>
        </div>
        <div className="mb-1">
          X token temp account:
          <div>{escrowState.XTokenTempAccountPubkey ?? "--"}</div>
        </div>
        <div className="mb-1">
          Initializer Y token account:
          <div>{escrowState.initializerYTokenAccount ?? "--"}</div>
        </div>
        <div className="mb-1">
          ExpectedAmount:
          <div>{escrowState.expectedAmount ?? "--"}</div>
        </div>
      </div>
    </div>
  );
}
