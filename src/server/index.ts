import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});
