const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY_1;
const model = process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

console.log("Using Token:", token ? token.substring(0, 15) + "..." : "none");
console.log("Using Model:", model);

async function run() {
  try {
    const res = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 10
      })
    });
    console.log("HTTP Status:", res.status);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
run();
