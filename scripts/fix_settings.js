const fs = require('fs');

function processFile(file, docName) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Fix localstorage keys if not done already
  const key = 'playbox_' + docName;
  content = content.replace(new RegExp("localStorage\\.setItem\\('" + key + "',", 'g'), "localStorage.setItem(getTenantStorageKey('" + key + "'),");
  content = content.replace(new RegExp("localStorage\\.getItem\\('" + key + "'\\)", 'g'), "localStorage.getItem(getTenantStorageKey('" + key + "'))");

  // Fix firestore paths (settings -> stores/{storeId}/settings)
  content = content.replace(/doc\(db,\s*'settings',\s*'[^']+'\)/g, "doc(db, 'stores', getStoreId(), 'settings', '" + docName + "')");
  content = content.replace(/doc\(db,\s*`settings`,\s*`[^`]+`\)/g, "doc(db, 'stores', getStoreId(), 'settings', '" + docName + "')");

  // For setDoc etc
  content = content.replace(/doc\(db,\s*"settings",\s*"[^"]+"\)/g, "doc(db, 'stores', getStoreId(), 'settings', '" + docName + "')");

  // Add imports
  if (!content.includes('getTenantStorageKey') || !content.includes('getStoreId')) {
    if (content.includes('import { getStoreId } from')) {
        content = content.replace(/import \{([^}]*)getStoreId([^}]*)\} from '@\/lib\/tenant';/, "import {$1getStoreId, getTenantStorageKey$2} from '@/lib/tenant';");
    } else {
        content = content.replace(/'use client';/, "'use client';\nimport { getStoreId, getTenantStorageKey } from '@/lib/tenant';");
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(file + ' updated');
  }
}

processFile('src/app/dashboard/lainnya/payments/page.tsx', 'payments');
processFile('src/app/dashboard/lainnya/admins/page.tsx', 'admins');
processFile('src/app/dashboard/lainnya/business/page.tsx', 'shop_settings');
processFile('src/app/dashboard/lainnya/toko/page.tsx', 'shop_settings');
