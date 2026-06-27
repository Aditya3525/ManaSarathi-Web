import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const fileRaw = fs.readFileSync(path.join(__dirname, 'seed_data_final.json'), 'utf8');
  const data = JSON.parse(fileRaw);

  console.log("=== SEED DATA VALIDATION ===");
  console.log(`Contents count: ${data.contents?.length}`);
  console.log(`Practices count: ${data.practices?.length}`);

  // Validate contents types/subtypes
  const contentTypes = {};
  data.contents.forEach(c => {
    contentTypes[c.type] = (contentTypes[c.type] || 0) + 1;
  });
  console.log("Content Types:", contentTypes);

  // Validate practices formats/types
  const practiceTypes = {};
  data.practices.forEach(p => {
    practiceTypes[p.type] = (practiceTypes[p.type] || 0) + 1;
  });
  console.log("Practice Types:", practiceTypes);

  // Check if any fields are empty/null inappropriately
  let nullYoutubeIdCount = 0;
  data.contents.forEach(c => {
    if (c.type === 'video' && !c.youtubeUrl) {
      console.warn(`Warning: Video content "${c.title}" has no youtubeUrl!`);
    }
  });

  data.practices.forEach(p => {
    if (!p.steps || p.steps.length === 0) {
      console.warn(`Warning: Practice "${p.title}" has no steps!`);
    }
  });

  console.log("Validation completed successfully!");
} catch (e) {
  console.error("Validation failed:", e);
}
