
import { useState } from "react";
import "./App.css";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hoi! Ik ben Margit. Zullen we samen een woord oefenen?"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(e) {
    e.preventDefault();

    const text = input.trim();
    if (!text || loading) return;

    const conversation = [
      ...messages,
      { role: "user", content: text }
    ];

    setMessages(conversation);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages: conversation })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Er ging iets mis.");
      }

      setMessages([
        ...conversation,
        { role: "assistant", content: data.reply }
      ]);
    } catch (err) {
      setError(err.message || "Kon geen verbinding maken met Margit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Margit AI</h1>
        <p>Een leermaatje voor lezen en spellen</p>
        <p className="status">● Lokale AI via Ollama</p>
        <hr />
      </header>

      <main className="chat">
        {messages.map((message, index) => (
          <div className="message" key={index}>
            <strong>
              {message.role === "assistant" ? "Margit" : "Jij"}:
            </strong>
            <p>{message.content}</p>
          </div>
        ))}

        {error && <p className="error">{error}</p>}
      </main>

      <form onSubmit={sendMessage}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Typ een bericht..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Verstuur
        </button>
      </form>

      <footer>Prototype — Margit draait lokaal via Ollama.</footer>
    </div>
  );
}
