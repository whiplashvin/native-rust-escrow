# escrow-ui-react

React port of the escrow UI used in [this guide](https://paulx.dev/blog/2021/01/14/programming-on-solana-an-introduction/).

Routes:
- `#/` — Alice: initialize an escrow
- `#/bob` — Bob: take the trade

The UI expects a local Solana validator at `http://localhost:8899`.

## How to run locally

Install dependencies
```
npm install
```

Serve
```
npm run dev
```
