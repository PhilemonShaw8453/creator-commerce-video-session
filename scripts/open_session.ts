async function main() {
  const response = await fetch("http://localhost:3000/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: "drop-042",
      creator: { id: "creator-17", displayName: "Mina" },
      subscriber: { id: "member-81", displayName: "Alex" },
      asset: {
        id: "lookbook-spring",
        title: "Spring lookbook",
        downloadUrl: "https://downloads.example.com/lookbook-spring.pdf",
      },
    }),
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

void main();
