import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;

    fetch("/api/message").then(async (res) => {
      if (res.ok) {
        const body = await res.json();
        if (abort) {
          return;
        }
        setMessage(body.message);
      }
    });

    return () => {
      abort = true;
    };
  }, []);

  return (
    <>
      <h1>RenewMap code challenge</h1>
      <p className="read-the-docs">
        This is the starter repository for the code challenge provided to you by
        the interviewer.
      </p>
      <div className="card">{message || "🌀🌀🌀"}</div>
    </>
  );
}

export default App;
