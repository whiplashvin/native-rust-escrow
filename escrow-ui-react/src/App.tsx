import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";

const Alice = lazy(() => import("./Alice"));
const Bob = lazy(() => import("./Bob"));

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Alice />} />
          <Route path="/bob" element={<Bob />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
