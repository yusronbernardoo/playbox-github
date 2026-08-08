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

  const replaceSettings = (sub) => {
    // E.g. doc(db, 'settings', 'shop') => doc(db, 'stores', getStoreId(), 'settings', 'shop')
    // Actually, for 'shop', it's doc(db, 'stores', getStoreId())
    // For others like 'ongkir', it could be subcollections: doc(db, 'stores', getStoreId(), 'settings', 'ongkir')
    
    // Replace doc(db, 'settings', 'shop')
    if (content.includes("doc(db, 'settings', 'shop')") || content.includes('doc(db, "settings", "shop")')) {
       content = content.replace(/doc\(db,\s*['"]settings['"]\s*,\s*['"]shop['"]\)/g, "doc(db, 'stores', getStoreId())");
       changed = true;
    }
    
    // Replace doc(db, 'settings', 'payment')
    if (content.includes("doc(db, 'settings', 'payment')") || content.includes('doc(db, "settings", "payment")')) {
       content = content.replace(/doc\(db,\s*['"]settings['"]\s*,\s*['"]payment['"]\)/g, "doc(db, 'stores', getStoreId(), 'settings', 'payment')");
       changed = true;
    }

    // Replace doc(db, 'settings', 'ongkir')
    if (content.includes("doc(db, 'settings', 'ongkir')") || content.includes('doc(db, "settings", "ongkir")')) {
       content = content.replace(/doc\(db,\s*['"]settings['"]\s*,\s*['"]ongkir['"]\)/g, "doc(db, 'stores', getStoreId(), 'settings', 'ongkir')");
       changed = true;
    }

    // Replace doc(db, 'settings', 'terms')
    if (content.includes("doc(db, 'settings', 'terms')") || content.includes('doc(db, "settings", "terms")')) {
       content = content.replace(/doc\(db,\s*['"]settings['"]\s*,\s*['"]terms['"]\)/g, "doc(db, 'stores', getStoreId(), 'settings', 'terms')");
       changed = true;
    }
  };

  replaceSettings();

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
