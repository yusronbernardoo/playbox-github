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
let updatedCount = 0;
files.forEach(file => {
  if (file.includes('FirebaseContext.tsx')) return; // Already updated manually
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  const replaceCollection = (col) => {
    const r1 = new RegExp(`collection\\(db,\\s*['"]${col}['"]\\)`, 'g');
    if (r1.test(content)) {
      content = content.replace(r1, `collection(db, 'stores', getStoreId(), '${col}')`);
      changed = true;
    }
  };

  const replaceDoc = (col) => {
    const r1 = new RegExp(`doc\\(db,\\s*['"]${col}['"]\\s*,`, 'g');
    if (r1.test(content)) {
      content = content.replace(r1, `doc(db, 'stores', getStoreId(), '${col}',`);
      changed = true;
    }
  };

  ['bookings', 'units', 'customers'].forEach(c => {
    replaceCollection(c);
    replaceDoc(c);
  });

  if (changed) {
    if (!content.includes('getStoreId')) {
      content = "import { getStoreId } from '@/lib/tenant';\n" + content;
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
    updatedCount++;
  }
});
console.log('Total files updated:', updatedCount);
