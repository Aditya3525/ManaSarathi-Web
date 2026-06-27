import fs from 'fs';
import path from 'path';

const root = 'C:\\Engineering\\Final Year Project\\ManaSarathi';

const excludeDirs = ['.git', 'node_modules', 'dist', 'build', '.next', 'graphify-out', '.vercel'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk(root);
let count = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if file has either string
    if (content.includes('ManaSarathi') || content.includes('manasarathi')) {
      const oldContent = content;
      
      content = content.replace(/ManaSarathi/g, 'ManaSarathi');
      content = content.replace(/manasarathi/g, 'manasarathi');
      
      // Revert the specific URLs that the user asked to exclude
      content = content.replace(/manasarathi-backend\.onrender\.com/g, 'maansarathi-backend.onrender.com');
      content = content.replace(/manasarathi\.app/g, 'maansarathi.app');
      
      if (oldContent !== content) {
        fs.writeFileSync(file, content, 'utf8');
        count++;
        console.log(`Updated ${file}`);
      }
    }
  } catch (e) {
    // Ignore binary files or read errors
  }
});

console.log(`Finished updating ${count} files.`);
