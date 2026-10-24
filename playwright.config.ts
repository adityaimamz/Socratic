import { defineConfig } from "@playwright/test";
export default defineConfig({
 testDir:"tests/e2e",fullyParallel:false,workers:1,timeout:60000,expect:{timeout:15000},
 use:{baseURL:"http://127.0.0.1:3100",channel:"chrome",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},
 webServer:[
  {command:"node tests/support/supabase-fixture.mjs",url:"http://127.0.0.1:54329/health",reuseExistingServer:false,timeout:60000},
  {command:"npm run dev -- --port 3100",url:"http://127.0.0.1:3100/login",reuseExistingServer:false,timeout:120000,env:{SAFE_EXAM_TEST_BUILD:"1",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54329",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-public-key",SUPABASE_SECRET_KEY:"fixture-server-secret",NEXT_PUBLIC_APP_URL:"http://127.0.0.1:3100"}}
 ]
});
