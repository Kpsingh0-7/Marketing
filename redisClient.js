import { createClient } from "redis";

const url = "redis://default:H5QcUeAoNwiWm87llCUnylXqUCT0c4NDFQ6JE8Ul7zhKOPsvOx0BAuDTbtFf60LW@95.217.85.194:5555/0"; // Replace with yours

const client = createClient({ url });

client.on("error", (err) => console.error("❌ Redis Error:", err));

try {
  await client.connect();
  console.log("✅ Redis Connected Successfully!");
  await client.ping().then(res => console.log("Ping Response:", res));
  await client.quit();
} catch (err) {
  console.error("❌ Connection Failed:", err);
}
