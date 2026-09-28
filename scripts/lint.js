const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const servicesDir = path.join(__dirname, "..", "services");
const services = fs.readdirSync(servicesDir);

let hasError = false;
let checkedCount = 0;

for (const service of services) {
  const srcDir = path.join(servicesDir, service, "src");
  if (!fs.existsSync(srcDir)) continue;

  const files = fs.readdirSync(srcDir).filter(f => f.endsWith(".js"));
  for (const file of files) {
    const fullPath = path.join(srcDir, file);
    try {
      execSync(`node --check "${fullPath}"`);
      console.log(`✓ Syntax valid: services/${service}/src/${file}`);
      checkedCount++;
    } catch (err) {
      console.error(`✗ Syntax error in file: services/${service}/src/${file}`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`\nAll ${checkedCount} JavaScript files passed syntax verification successfully.`);
