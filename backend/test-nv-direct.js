const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const token = process.env.NVIDIA_API_KEY_1 || process.env.NVIDIA_API_KEY;
const model = process.env.NVIDIA_MODEL || 'moonshotai/kimi-k2.5';
const url = process.env.NVIDIA_INVOKE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';

console.log("Using Token:", token ? token.substring(0, 15) + "..." : "none");
console.log("Using Model:", model);
console.log("Using URL:", url);

async function run() {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
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
