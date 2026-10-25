const http = require("http");

const TARGET_PORT = 3000;
const LISTEN_PORT = 8000;

const server = http.createServer((clientReq, clientRes) => {
  const options = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: clientReq.headers.host || `localhost:${LISTEN_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on("error", (err) => {
    clientRes.writeHead(502, { "Content-Type": "text/plain" });
    clientRes.end(`Next.js server on port ${TARGET_PORT} error: ${err.message}`);
  });

  clientReq.pipe(proxyReq, { end: true });
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log(`Port forwarder active: http://localhost:${LISTEN_PORT} -> http://127.0.0.1:${TARGET_PORT}`);
});
