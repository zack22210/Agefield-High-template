import process from 'node:process';
import {formatIntegrityIssue, validateIntegrity} from './lib/integrity.mjs';

const root = process.cwd();
const result = await validateIntegrity({root});

result.warnings.forEach((message) => console.warn(`WARNING: ${message}`));
if (result.issues.length > 0) {
  result.issues.forEach((issue) => console.error(`ERROR: ${formatIntegrityIssue(root, issue)}`));
  console.error(`Deployment integrity validation failed with ${result.issues.length} issue(s).`);
  process.exitCode = 1;
} else {
  const {locales, categories, articles, generatedRoutes, configured} = result.summary;
  console.log(
    `Deployment integrity validation passed: ${locales} locale(s), ${categories} category/categories, ` +
    `${articles} localized article file(s), ${generatedRoutes} generated route(s), ` +
    `mode=${configured ? 'configured-site' : 'blank-template'}.`
  );
}
