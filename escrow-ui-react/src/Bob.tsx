import { useState } from "react";
import { takeTrade } from "./util/takeTrade";

const initialFormState = {
  privateKey: "",
  programId: "",
  takerXAccAddress: "",
  takerYAccAddress: "",
  escrowAccAddress: "",
  XTokenExpectedAmount: 0
};

export default function Bob() {
  const [formState, setFormState] = useState(initialFormState);

  const setField = (field: keyof typeof initialFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState(prev => ({
        ...prev,
        [field]: e.target.type === "number" ? Number(e.target.value) : e.target.value
      }));

  const resetUI = () => {
    setFormState(initialFormState);
  };

  const onTakeTrade = async () => {
    try {
      await takeTrade(
        formState.privateKey,
        formState.escrowAccAddress,
        formState.takerXAccAddress,
        formState.takerYAccAddress,
        formState.XTokenExpectedAmount,
        formState.programId
      );
      alert("Success! Alice and Bob have traded their tokens and all temporary accounts have been closed");
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
          <label>Bob's X token account pubkey</label>
          <input className="display-block" type="text" value={formState.takerXAccAddress} onChange={setField("takerXAccAddress")} />
        </div>
        <div className="mb-1">
          <label>Bob's Y token account pubkey</label>
          <input className="display-block" type="text" value={formState.takerYAccAddress} onChange={setField("takerYAccAddress")} />
        </div>
        <div className="mb-1">
          <label>Escrow account pubkey</label>
          <input className="display-block" type="text" value={formState.escrowAccAddress} onChange={setField("escrowAccAddress")} />
        </div>
        <div className="mb-1">
          <label>Amount X tokens Bob wants</label>
          <input className="display-block" type="number" value={formState.XTokenExpectedAmount} onChange={setField("XTokenExpectedAmount")} />
        </div>
        <div className="mb-1">
          <input style={{ marginRight: "5px" }} className="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Reset UI" onClick={resetUI} />
          <input className="cursor-pointer border-none bg-btn normal-font-size" type="submit" value="Take trade" onClick={onTakeTrade} />
        </div>
      </div>
    </div>
  );
}
