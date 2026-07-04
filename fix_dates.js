const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) getFiles(fullPath, files);
    else if (fullPath.endsWith('.tsx')) files.push(fullPath);
  });
  return files;
}

const files = getFiles('app');
let count = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('${month}-31')) {
    if (content.includes('import {') && content.includes('@/lib/calculations') && !content.includes('getDaysInMonth')) {
      content = content.replace(/import \{ ([^}]+) \} from '@\/lib\/calculations'/, 'import { $1, getDaysInMonth } from \'@/lib/calculations\'');
    }
    content = content.replace(/\$\{month\}-31/g, '${month}-${getDaysInMonth(month)}');
    fs.writeFileSync(file, content);
    count++;
    console.log('Fixed', file);
  }
}
console.log('Total files fixed:', count);
