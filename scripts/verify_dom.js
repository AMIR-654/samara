const fs = require("fs");
const js = fs.readFileSync("C:/Samara/admin/modules/merchantProfile.js", "utf8");
const html = fs.readFileSync("C:/Samara/admin/index.html", "utf8");

// Extract all getElementById calls
const idRegex = /getElementById\(["']([^"']+)["']\)/g;
const ids = [];
let match;
while ((match = idRegex.exec(js)) !== null) ids.push(match[1]);

const uniqueIds = [...new Set(ids)];
let missing = [];

for (const id of uniqueIds) {
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.push(id);
  }
}

console.log("Total DOM IDs in merchantProfile.js:", uniqueIds.length);
console.log("Missing from index.html:", missing.length === 0 ? "NONE" : missing.join(", "));

if (js.includes('getElementById("profileBody").innerHTML') ||
    js.includes("getElementById('profileBody').innerHTML")) {
  console.log("ERROR: renderProfileSkeleton STILL replaces profileBody.innerHTML");
} else {
  console.log("OK: renderProfileSkeleton no longer replaces profileBody.innerHTML");
}

// Verify skeleton targets
const targets = ["profileSummaryCards", "profileCardPrices", "profileAccountingBody", "profileSettlementBody"];
let allOk = true;
for (const t of targets) {
  if (!js.includes('getElementById("' + t + '").innerHTML') && !js.includes("getElementById('" + t + "').innerHTML")) {
    console.log("ERROR: Skeleton missing target: " + t);
    allOk = false;
  }
}
if (allOk) console.log("OK: Skeleton targets all 4 child containers correctly");

// Quick syntax check
try {
  new Function(js);
  console.log("OK: JavaScript parses without syntax errors");
} catch (e) {
  console.log("ERROR: " + e.message);
}

console.log("\nDone.");
