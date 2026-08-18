const fs = require('fs');
const content = fs.readFileSync('Network-CRM.html', 'utf8');
const match = content.match(/<script type="__bundler\/template">\n((?:.|\n)*?)<\/script>/);
if (match) {
  let str = match[1].trim();
  if (str.startsWith('"') && str.endsWith('"')) str = str.slice(1, -1);
  let unescaped = str.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u002F/g, '/');
  fs.writeFileSync('template.html', unescaped);
  console.log("Extracted template.html");
}
