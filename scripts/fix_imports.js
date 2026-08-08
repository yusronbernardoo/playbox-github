const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('getStoreId(') && !content.includes('import { getStoreId }')) {
    // Inject import safely after "use client" if it exists, otherwise at the top.
    const useClientRegex = /^(?:['"]use client['"];?\s*)?/m;
    content = content.replace(useClientRegex, match => (match || '') + "import { getStoreId } from '@/lib/tenant';\n");
    fs.writeFileSync(file, content);
    console.log('Fixed:', file);
  }
});
