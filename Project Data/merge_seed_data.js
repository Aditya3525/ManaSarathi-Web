import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log("Starting merge of ManaSarathi seed data...");

  // Load Part 1 (wrapped in an object with "contents")
  const part1Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part1_articles.json'), 'utf8');
  const part1 = JSON.parse(part1Raw);
  let contents = [...part1.contents];

  // Load other contents parts
  const part2Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part2_generated.json'), 'utf8');
  const part2 = JSON.parse(part2Raw);
  contents.push(...part2);

  const part3Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part3_stories_media.json'), 'utf8');
  const part3 = JSON.parse(part3Raw);
  contents.push(...part3);

  const part5Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part5_articles_and_generated_2.json'), 'utf8');
  const part5 = JSON.parse(part5Raw);
  contents.push(...part5);

  const part6Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part6_media_2.json'), 'utf8');
  const part6 = JSON.parse(part6Raw);
  contents.push(...part6);

  console.log(`Merged ${contents.length} total content items.`);

  // Load practices parts
  const part4Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part4_practices.json'), 'utf8');
  const part4 = JSON.parse(part4Raw);
  let practices = [...part4];

  const part7Raw = fs.readFileSync(path.join(__dirname, 'seed_data_part7_practices_2.json'), 'utf8');
  const part7 = JSON.parse(part7Raw);
  practices.push(...part7);

  console.log(`Merged ${practices.length} total practice items.`);

  // Final combined JSON structure
  const finalSeedData = {
    contents: contents,
    practices: practices
  };

  // Write final seed data file
  fs.writeFileSync(
    path.join(__dirname, 'seed_data_final.json'), 
    JSON.stringify(finalSeedData, null, 2), 
    'utf8'
  );

  console.log("Success! seed_data_final.json has been written successfully.");
} catch (error) {
  console.error("Error during merge:", error);
}
