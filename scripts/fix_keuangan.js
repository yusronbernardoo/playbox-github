const fs = require('fs');

const file = 'src/app/dashboard/keuangan/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace expenses isolation
content = content.replace(/collection\(db, 'expenses'\)/g, "collection(db, 'stores', getStoreId(), 'expenses')");
content = content.replace(/doc\(db, 'expenses',/g, "doc(db, 'stores', getStoreId(), 'expenses',");

// 2. Fix empty snapshot logic for bookings
const bookingsEmptyOld = `      if (!snapshot.empty) {
        const cloudBookings: any[] = [];
        snapshot.forEach((d) => {
          cloudBookings.push({ id: d.id, ...d.data() });
        });
        localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));
        loadFinancialData();
      }`;
const bookingsEmptyNew = `      const cloudBookings: any[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((d) => {
          cloudBookings.push({ id: d.id, ...d.data() });
        });
      }
      localStorage.setItem('playbox_mock_bookings', JSON.stringify(cloudBookings));
      loadFinancialData();`;
content = content.replace(bookingsEmptyOld, bookingsEmptyNew);

// 3. Fix empty snapshot logic for expenses
const expensesEmptyOld = `      if (!snapshot.empty) {
        const cloudExpenses: any[] = [];
        snapshot.forEach((d) => {
          cloudExpenses.push({ id: d.id, ...d.data() });
        });
        cloudExpenses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        localStorage.setItem('playbox_expenses', JSON.stringify(cloudExpenses));
        loadFinancialData();
      }`;
const expensesEmptyNew = `      const cloudExpenses: any[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((d) => {
          cloudExpenses.push({ id: d.id, ...d.data() });
        });
        cloudExpenses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      }
      localStorage.setItem('playbox_expenses', JSON.stringify(cloudExpenses));
      loadFinancialData();`;
content = content.replace(expensesEmptyOld, expensesEmptyNew);

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
