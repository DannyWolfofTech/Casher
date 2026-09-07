import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'../../tests/production',timeout:45000,workers:1,
  outputDir:'../../.audit-results/live-browser',reporter:'list',
  use:{baseURL:'https://trycasher.com',headless:true,trace:'off'},
});
