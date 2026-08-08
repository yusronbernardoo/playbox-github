const fs = require('fs');
const files = [
  'src/app/dashboard/booking/new/page.tsx',
  'src/app/dashboard/booking/[id]/invoice/page.tsx',
  'src/app/dashboard/booking/[id]/return/page.tsx',
  'src/app/dashboard/booking/[id]/timeline/page.tsx',
  'src/app/dashboard/booking/[id]/verify/page.tsx',
  'src/app/dashboard/keuangan/page.tsx',
  'src/app/dashboard/unit/new/page.tsx',
  'src/app/dashboard/unit/[id]/edit/page.tsx',
  'src/app/dashboard/unit/[id]/page.tsx',
  'src/app/dashboard/unit/page.tsx',
  'src/app/dashboard/lainnya/payments/page.tsx',
  'src/app/dashboard/lainnya/admins/page.tsx',
  'src/app/dashboard/lainnya/business/page.tsx',
  'src/app/dashboard/lainnya/toko/page.tsx'
];

let filesModified = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Add import if we are going to use getTenantStorageKey
  const needsImport = /playbox_(mock_bookings|mock_units|payments|admins|shop_settings)/.test(content);
  if (needsImport && !content.includes('getTenantStorageKey')) {
    if (content.includes('import { getStoreId } from')) {
        content = content.replace(/import \{([^}]*)getStoreId([^}]*)\} from '@\/lib\/tenant';/, "import {$1getStoreId, getTenantStorageKey$2} from '@/lib/tenant';");
    } else {
        content = content.replace(/'use client';/, "'use client';\nimport { getTenantStorageKey } from '@/lib/tenant';");
    }
  }

  // Replace literal strings with the function call
  content = content.replace(/localStorage\.setItem\('playbox_mock_bookings',/g, "localStorage.setItem(getTenantStorageKey('playbox_mock_bookings'),");
  content = content.replace(/localStorage\.getItem\('playbox_mock_bookings'\)/g, "localStorage.getItem(getTenantStorageKey('playbox_mock_bookings'))");

  content = content.replace(/localStorage\.setItem\('playbox_mock_units',/g, "localStorage.setItem(getTenantStorageKey('playbox_mock_units'),");
  content = content.replace(/localStorage\.getItem\('playbox_mock_units'\)/g, "localStorage.getItem(getTenantStorageKey('playbox_mock_units'))");
  
  content = content.replace(/localStorage\.setItem\('playbox_payments',/g, "localStorage.setItem(getTenantStorageKey('playbox_payments'),");
  content = content.replace(/localStorage\.getItem\('playbox_payments'\)/g, "localStorage.getItem(getTenantStorageKey('playbox_payments'))");
  
  content = content.replace(/localStorage\.setItem\('playbox_admins',/g, "localStorage.setItem(getTenantStorageKey('playbox_admins'),");
  content = content.replace(/localStorage\.getItem\('playbox_admins'\)/g, "localStorage.getItem(getTenantStorageKey('playbox_admins'))");
  
  content = content.replace(/localStorage\.setItem\('playbox_shop_settings',/g, "localStorage.setItem(getTenantStorageKey('playbox_shop_settings'),");
  content = content.replace(/localStorage\.getItem\('playbox_shop_settings'\)/g, "localStorage.getItem(getTenantStorageKey('playbox_shop_settings'))");

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    filesModified++;
  }
}
console.log('Modified ' + filesModified + ' files in dashboard.');
