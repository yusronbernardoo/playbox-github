const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
  if (filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix bottom-[72px]
    content = content.replace(/className="fixed bottom-\[72px\] left-0 w-full/g, 'className="fixed bottom-[72px] w-full max-w-md left-1/2 -translate-x-1/2');
    // Fix bottom-0 w-full (in dashboard/layout.tsx)
    content = content.replace(/className="fixed bottom-0 w-full/g, 'className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2');
    // Fix inset-0 modals
    content = content.replace(/className="fixed inset-0 z-50/g, 'className="fixed inset-0 z-50 max-w-md mx-auto');
    content = content.replace(/className="fixed inset-0 bg-black\/60/g, 'className="fixed inset-0 bg-black/60 max-w-md mx-auto');
    // Fix fixed bottom-24 right-4 (in dashboard/page.tsx)
    content = content.replace(/className="fixed bottom-24 right-4/g, 'className="absolute bottom-24 right-4');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed:', filePath);
    }
  }
});
