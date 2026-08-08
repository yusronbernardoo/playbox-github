const fs = require('fs');

function processFile(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Fix localstorage keys if not done already
  const key = 'playbox_shop_settings';
  content = content.replace(new RegExp("localStorage\\.setItem\\('" + key + "',", 'g'), "localStorage.setItem(getTenantStorageKey('" + key + "'),");
  content = content.replace(new RegExp("localStorage\\.getItem\\('" + key + "'\\)", 'g'), "localStorage.getItem(getTenantStorageKey('" + key + "'))");

  // Add imports
  if (!content.includes('getTenantStorageKey') || !content.includes('getStoreId')) {
    if (content.includes('import { getStoreId } from')) {
        content = content.replace(/import \{\s*getStoreId\s*\} from '@\/lib\/tenant';/, "import { getStoreId, getTenantStorageKey } from '@/lib/tenant';");
    } else {
        content = content.replace(/'use client';/, "'use client';\nimport { getStoreId, getTenantStorageKey } from '@/lib/tenant';");
    }
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(file + ' updated');
  }
}

processFile('src/app/dashboard/lainnya/page.tsx');
